#!/usr/bin/env node
/**
 * The accessibility audit, as a check you can run.
 *
 * This started as a throwaway script in a scratch directory. It found 41 text
 * elements below WCAG AA and every single tappable control under the 44px
 * minimum — and then it would have been thrown away, which means the next
 * screen reintroduces both and nobody knows. A measurement you run once is a
 * fact about a Tuesday; a measurement in CI is a property of the app.
 *
 *     node scripts/a11y-check.mjs [--html path] [--size 390x844]
 *
 * It checks three things on the room and on every sheet:
 *
 *   TAP TARGETS  every control is at least 44x44. Note that `hitSlop` does
 *                NOT count — React Native Web ignores it entirely, which is
 *                how the app shipped 38px buttons that the code claimed were
 *                52px. Only the real box counts, because only the real box is
 *                what a finger gets.
 *   LABELS       every control announces itself to a screen reader.
 *   CONTRAST     every piece of text clears 4.5:1 against what is actually
 *                behind it (3:1 for large text, per WCAG). The unit test in
 *                __tests__/contrast.test.ts checks the TOKENS; this checks the
 *                pairs that really occur on screen, which is how the Pack
 *                Book's dark-on-dark blurb was found.
 *
 * The two together are the point: the unit test is fast and runs on every
 * commit, this one is slower and catches what the tokens cannot predict.
 */

import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

async function loadChromium() {
  for (const m of ['playwright', 'playwright-core', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try {
      return (await import(m)).chromium;
    } catch {}
  }
  console.error('playwright is not installed — run `npm ci` (it is a devDependency).');
  process.exit(2);
}
const chromium = await loadChromium();

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const html = resolve(arg('--html', 'barkly-artifact.html'));
if (!existsSync(html)) {
  console.error(`no such file: ${html}\nBuild it first: node scripts/build-artifact.mjs`);
  process.exit(2);
}
const [width, height] = arg('--size', '390x844').split('x').map(Number);

function browserOptions() {
  const args = ['--no-sandbox'];
  for (const candidate of [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium']) {
    if (candidate && existsSync(candidate)) return { executablePath: candidate, args };
  }
  return { args };
}

/** Runs INSIDE the page. Returns the three failure lists for one screen. */
function auditInPage(where) {
  const out = { where, tiny: [], unlabelled: [], lowContrast: [] };

  const luminance = (css) => {
    const parts = css.match(/[\d.]+/g);
    if (!parts) return 0;
    const [r, g, b] = parts.slice(0, 3).map(Number).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  // The nearest ancestor that actually paints something. A transparent parent
  // is not the background; the thing behind it is.
  const backgroundOf = (el) => {
    let node = el;
    while (node) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg;
      node = node.parentElement;
    }
    return 'rgb(255, 249, 236)';
  };

  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;

    const role = el.getAttribute('role');
    const isControl = el.tagName === 'BUTTON' || ['button', 'tab', 'switch', 'link'].includes(role);
    if (isControl) {
      const name = el.getAttribute('aria-label') || el.innerText.trim();
      if (box.width < 44 || box.height < 44) {
        out.tiny.push({ name: name.slice(0, 40), w: Math.round(box.width), h: Math.round(box.height) });
      }
      if (!name) out.unlabelled.push({ tag: el.tagName, role, cls: String(el.className).slice(0, 40) });
    }

    // Only elements that own a text node — otherwise every wrapper is counted
    // with its child's colour and the report is mostly duplicates.
    const ownsText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (ownsText) {
      const size = parseFloat(cs.fontSize);
      const bold = parseInt(cs.fontWeight, 10) >= 700;
      const large = size >= 24 || (size >= 18.66 && bold);
      const need = large ? 3 : 4.5;
      const got = ratio(cs.color, backgroundOf(el));
      if (got < need) {
        out.lowContrast.push({ text: el.innerText.slice(0, 34), size, ratio: +got.toFixed(2), need });
      }
    }
  }
  return out;
}

const browser = await chromium.launch(browserOptions());
const ctx = await browser.newContext({ viewport: { width, height } });
// A fixed hour so a night palette does not make this pass or fail by clock.
await ctx.addInitScript('Date.prototype.getHours = function () { return 14; };');
const page = await ctx.newPage();
await page.goto('file://' + html);
await page.waitForTimeout(2600);

// Through onboarding, or every screen below is the welcome flow.
for (let i = 0; i < 8; i += 1) {
  const input = page.locator('input:visible').first();
  if (await input.count()) {
    const ph = (await input.getAttribute('placeholder')) || '';
    if (/name|call/i.test(ph)) await input.fill('Caleb');
  }
  const next = page.getByRole('button').filter({ hasText: /^(hi|tell him|next|okay|skip)$/i }).first();
  if ((await next.count()) && (await next.isEnabled())) {
    await next.click();
    await page.waitForTimeout(700);
  } else break;
}
await page.waitForTimeout(1200);

/**
 * Confirm we are actually IN the app.
 *
 * If onboarding does not complete — a changed button label, a slow machine —
 * every audit below silently measures the welcome flow instead of the room,
 * and reports either a clean run on the wrong screen or a pile of failures
 * that name controls the reader cannot place. Both are worse than stopping.
 */
if (!(await page.locator('[data-testid="conversation-dock"]').first().count())) {
  console.error(
    'never reached the room — onboarding did not complete.\n' +
      'This check measures the app, not the welcome flow, so it is stopping rather\n' +
      'than reporting on the wrong screen.',
  );
  await browser.close();
  process.exit(2);
}

let failures = 0;
const report = (a) => {
  const total = a.tiny.length + a.unlabelled.length + a.lowContrast.length;
  failures += total;
  console.log(`\n${a.where} — ${total === 0 ? 'clean' : `${total} problem(s)`}`);
  for (const t of a.tiny) console.log(`  TAP TARGET ${t.w}x${t.h} (need 44x44)  ${t.name}`);
  for (const u of a.unlabelled) console.log(`  UNLABELLED ${u.tag} role=${u.role} ${u.cls}`);
  for (const c of a.lowContrast) console.log(`  CONTRAST ${c.ratio}:1 (need ${c.need}) ${c.size}px  "${c.text}"`);
};

/*
 * SHOTS.
 *
 * This harness already walks every sheet to measure it; it cost one line to
 * also SAVE what it walked. Until now nothing captured the sheets as images at
 * all -- the art lab shoots the world, the overlap harness measures boxes, and
 * the three surfaces a player opens most often had never once been reviewed
 * side by side. Same lesson as morning and evening: you do not fix what the
 * harness cannot show you.
 */
const shotDir = arg('--shots', '');
if (shotDir) await mkdir(shotDir, { recursive: true });
const shoot = async (name) => {
  if (shotDir) await page.screenshot({ path: `${shotDir}/${name}.png` });
};

report(await page.evaluate(auditInPage, 'room'));
await shoot('room');

const SHEETS = [
  ['shop', '[aria-label^="Shop."]'],
  ['pack', '[aria-label^="Pack Book"]'],
  ['settings', '[aria-label="Settings"]'],
];
for (const [name, selector] of SHEETS) {
  const opener = page.locator(selector).first();
  if (!(await opener.count())) {
    failures += 1;
    console.log(`\n${name} — COULD NOT OPEN (${selector} found nothing)`);
    continue;
  }
  await opener.click();
  await page.waitForTimeout(900);
  report(await page.evaluate(auditInPage, name));
  await shoot(name);
  const close = page.getByText('✕', { exact: true }).first();
  if (await close.count()) await close.click();
  await page.waitForTimeout(600);
}

await browser.close();
console.log(
  failures === 0
    ? '\nPASS — every control is reachable and every word is readable.'
    : `\nFAIL — ${failures} accessibility problem(s).`,
);
process.exit(failures === 0 ? 0 : 1);
