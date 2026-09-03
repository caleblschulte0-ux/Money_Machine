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
 * ONE SIZE IS NOT A SWEEP. `--size` existed from the start and nothing ever
 * passed it, so every run in this repo's history looked at 390x844 -- and
 * Barkly's Plan shipped unclosable on a 360x568 phone with the gate green.
 * `npm run check:a11y` and `check:ui` now drive the smallest, the reference and
 * the largest phone in turn, so the short-screen case is covered by the
 * standing command rather than by somebody remembering to pass a flag.
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
import { assertFreshArtifact } from './fresh-artifact.mjs';

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
assertFreshArtifact(html, 'npm run build:web');
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
  const parse = (css) => {
    const p = (css.match(/[\d.]+/g) || []).map(Number);
    return p.length >= 3 ? { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } : null;
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const css = (c) => `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;

  /*
   * One paintable layer, with its EFFECTIVE alpha.
   *
   * `background-color: rgba(...)` is only half the story: this codebase leans
   * on view-level `opacity` for its decorative plates (a gloss at 0.34, tape
   * at 0.84, a skirting board at 0.66), and CSS multiplies that through. A
   * layer read at its own alpha only is a layer reported as far more opaque
   * than it paints, which is the same class of mistake as measuring against
   * the wrong element -- the number comes out confident and wrong.
   *
   * `visibility: hidden` and `opacity: 0` still have a box and a background
   * colour, so they have to be rejected explicitly; `display: none` collapses
   * the rect and is caught by the caller's `covers` test.
   */
  const bgLayerOf = (node) => {
    const cs = getComputedStyle(node);
    if (cs.visibility === 'hidden') return null;
    const alpha = parseFloat(cs.opacity);
    const scale = Number.isFinite(alpha) ? alpha : 1;
    if (scale <= 0) return null;
    const withScale = (c) => (c.a * scale > 0 ? { ...c, a: c.a * scale } : null);
    const img = cs.backgroundImage || '';
    if (/gradient\(/.test(img)) {
      const stops = (img.match(/rgba?\([^)]*\)/g) || []).map(parse).filter(Boolean);
      if (stops.length) {
        return withScale({
          r: stops.reduce((t, c) => t + c.r, 0) / stops.length,
          g: stops.reduce((t, c) => t + c.g, 0) / stops.length,
          b: stops.reduce((t, c) => t + c.b, 0) / stops.length,
          a: stops.reduce((t, c) => t + c.a, 0) / stops.length,
        });
      }
    }
    const solid = parse(cs.backgroundColor || '');
    return solid && solid.a > 0 ? withScale(solid) : null;
  };

  /*
   * What is ACTUALLY behind this text.
   *
   * Three ways to get this wrong, and every one of them makes the checker LIE
   * rather than merely miss something -- which is worse, because a harness that
   * cries wolf on a correct screen gets switched off. All three were live:
   *
   *   1. A GRADIENT IS NOT A background-color. It is a background-IMAGE, so
   *      looking only at background-color skips straight past it.
   *   2. THE PAINTER IS USUALLY A SIBLING. Almost every sheet here paints
   *      itself with an absolutely-positioned <LinearGradient> INSIDE the
   *      container, next to the text rather than around it. Walking ancestors
   *      cannot see that: the Plan sheet's near-black-on-yellow title was
   *      measured against the dark scrim two levels up and reported at 1.2:1.
   *   3. TRANSLUCENT LAYERS COMPOSITE. A half-opaque plate over cream is
   *      neither the plate nor the cream.
   *
   * `document.elementsFromPoint` looks like the answer to (2) and is not: it
   * honours `pointer-events`, and every one of these decorative fills sets
   * `pointerEvents="none"` precisely so it does not eat taps. It returns the
   * stack with exactly the layers we need missing. Reading the paint order out
   * of the DOM instead is deterministic and does not care about hit-testing:
   * within a container the background paints first, then children in document
   * order, so what is behind a piece of text is its container's background
   * plus the earlier siblings that cover it.
   */
  const PAGE = { r: 255, g: 249, b: 236, a: 1 };
  const backgroundOf = (el) => {
    const box = el.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const covers = (n) => {
      const r = n.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.left <= x && r.right >= x && r.top <= y && r.bottom >= y;
    };
    // Nearest-to-the-text first; the compositor below walks it back to front.
    const layers = [];
    const push = (layer) => {
      if (!layer) return false;
      layers.push(layer);
      return layer.a >= 0.999;
    };
    let child = el;
    for (let node = el.parentElement; node; child = node, node = node.parentElement) {
      const kids = [...node.children];
      const at = kids.indexOf(child);
      // Earlier siblings paint underneath, topmost of them nearest the text.
      for (let i = (at < 0 ? kids.length : at) - 1; i >= 0; i -= 1) {
        const sib = kids[i];
        if (sib === el || sib.contains(el) || !covers(sib)) continue;
        /*
         * A sibling's own CHILDREN paint on top of its background, so they are
         * nearer the text and must be pushed first -- and among themselves the
         * later one paints over the earlier, so they go in reverse DOM order.
         * Pushing the wrapper first (as this did) puts the layers in the wrong
         * sequence, which is invisible while everything is opaque and quietly
         * wrong the moment one of them is a translucent plate -- which is
         * exactly the case this branch exists to handle.
         */
        const inners = [...sib.children].filter(covers);
        let sealed = false;
        for (let j = inners.length - 1; j >= 0; j -= 1) {
          if (push(bgLayerOf(inners[j]))) { sealed = true; break; }
        }
        if (sealed || push(bgLayerOf(sib))) break;
      }
      if (layers.length && layers[layers.length - 1].a >= 0.999) break;
      if (push(bgLayerOf(node))) break;
    }
    let acc = PAGE;
    for (let i = layers.length - 1; i >= 0; i -= 1) acc = over(layers[i], acc);
    return css(acc);
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
      /*
       * Composite the TEXT over its background before comparing. Half-opaque
       * ink is not ink -- reading `color` alone rates it as though it painted
       * at full strength, which flatters exactly the text most likely to be
       * too faint to read.
       */
      const bg = backgroundOf(el);
      const fg = parse(cs.color);
      const inked = fg && fg.a < 0.999 ? css(over(fg, parse(bg))) : cs.color;
      const got = ratio(inked, bg);
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

/*
 * DOES THE CHECKER STILL BITE?
 *
 * A contrast harness that has just been made more accurate has to prove it did
 * not simply get quieter, and "I checked once by hand on a Tuesday" is not a
 * property of the tool. This plants two probes built exactly like the real
 * surfaces that used to defeat it -- an absolutely-positioned gradient sibling
 * with `pointer-events: none`, which is why `elementsFromPoint` cannot see it
 * -- one that must be caught and one that must not, and fails the run if
 * either verdict is wrong. If a future change to `backgroundOf` starts
 * resolving the wrong layer again, this trips before anybody trusts a
 * "clean" report.
 */
const selfTest = await page.evaluate((auditSrc) => {
  const audit = new Function(`return (${auditSrc})`)();
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:300px;height:80px;z-index:99999';
  /*
   * The gradient is DARK on purpose, and that is the whole trick.
   *
   * The first version of this probe used a light yellow gradient, which proved
   * nothing: when the resolver failed to see the gradient it fell through to
   * the cream page background, and pale-on-cream and dark-on-cream give the
   * SAME two verdicts as pale-on-yellow and dark-on-yellow. The test passed
   * with the bug deliberately reintroduced. A probe has to be built so that
   * resolving the wrong layer FLIPS both answers -- light text over a dark
   * plate reads as legible only if the dark plate was actually found, and as
   * illegible the moment the checker falls back to the page.
   */
  probe.innerHTML =
    '<div style="position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;'
    + 'background-image:linear-gradient(rgb(20,30,70),rgb(30,40,90))"></div>'
    + '<span id="probe-illegible" style="position:relative;font-size:13px;color:rgb(105,105,105)">probe illegible</span>'
    + '<span id="probe-legible" style="position:relative;font-size:13px;color:rgb(255,255,255)">probe legible</span>';
  document.body.appendChild(probe);
  const found = audit('selftest').lowContrast.map((c) => c.text);
  probe.remove();
  return {
    caughtIllegible: found.some((t) => t.includes('probe illegible')),
    flaggedLegible: found.some((t) => t.includes('probe legible')),
  };
}, auditInPage.toString());

if (!selfTest.caughtIllegible || selfTest.flaggedLegible) {
  failures += 1;
  console.log('\nSELF-TEST FAILED — the contrast check is not measuring what it thinks it is.');
  if (!selfTest.caughtIllegible) console.log('  grey-on-dark over a gradient sibling was NOT caught');
  if (selfTest.flaggedLegible) console.log('  white-on-dark over a gradient sibling WAS wrongly flagged (the gradient was not found)');
} else {
  console.log('\nself-test — the contrast check still bites');
}

report(await page.evaluate(auditInPage, 'room'));
await shoot('room');

/*
 * Every sheet a player can reach from a cold start, not three of them.
 *
 * This walked Shop, Pack Book and Settings. FOOD -- which is the sheet a
 * player opens more often than any of those, because it is how you feed him --
 * had never been contrast-checked, tap-target-checked or looked at. Neither
 * had Barkly's plan. A harness that covers the
 * three surfaces somebody happened to think of on the day is how the defects
 * on the other five survive review.
 *
 * `optional` sheets depend on game state (a plan has to exist for the plan
 * chip to be there), so a missing opener is a skip, not a failure -- but a
 * missing opener for a sheet that should ALWAYS be reachable still fails.
 */
/** A string only that sheet puts on screen, used to confirm it really opened. */
const sheetMarker = {
  shop: 'STUFF',
  pack: 'THE PACK BOOK',
  food: 'Barkly',
  settings: 'Settings',
  plan: "BARKLY'S NOTE",
  // The composer's own send button: it only exists while typing is open.
  composer: 'send',
};

const SHEETS = [
  { name: 'shop', open: '[aria-label^="Shop."]' },
  { name: 'pack', open: '[aria-label^="Pack Book"]' },
  { name: 'food', open: '[data-testid="kit-feed"]' },
  { name: 'settings', open: '[aria-label="Settings"]' },
  { name: 'plan', open: '[aria-label^="Barkly\'s plan"]', optional: true },
  /*
   * The composer is a surface too. It is where a child types the thing the
   * whole app is about, and it had never been audited or photographed --
   * because the sweep only ever visited things that look like sheets. It closes
   * with a x rather than the sheets' cross, so it names its own closer.
   */
  { name: 'composer', open: '[aria-label="Type to Barkly"]', close: '[aria-label="Close typing"]' },
];
for (const { name, open: selector, optional, close: closeSelector } of SHEETS) {
  const opener = page.locator(selector).first();
  if (!(await opener.count())) {
    if (optional) {
      console.log(`\n${name} — not reachable in this save (skipped)`);
      continue;
    }
    failures += 1;
    console.log(`\n${name} — COULD NOT OPEN (${selector} found nothing)`);
    continue;
  }
  await opener.click({ force: true });
  await page.waitForTimeout(900);
  /*
   * PROVE THE SHEET IS ACTUALLY OPEN before believing anything measured on it.
   *
   * Both clicks here are `force: true`, which switches off Playwright's
   * actionability check, and the close locator takes the FIRST matching glyph
   * on the page. If a close misses, the next iteration clicks through a sheet
   * that is still up, the audit measures the PREVIOUS surface under the new
   * name, the screenshot saves the wrong screen, and the run reports it clean.
   * Silently auditing the wrong thing is the same failure mode as measuring
   * text against the wrong background: confident and wrong. `marker` is
   * something only that sheet renders.
   */
  const marker = await page.evaluate((want) => {
    const text = document.body.innerText || '';
    return text.includes(want);
  }, sheetMarker[name]);
  if (!marker) {
    failures += 1;
    console.log(`\n${name} — OPENED THE WRONG SCREEN (expected to find "${sheetMarker[name]}")`);
  } else {
    report(await page.evaluate(auditInPage, name));
    await shoot(name);
  }
  /*
   * A sheet you cannot close is an accessibility failure, not a crash.
   *
   * This was a bare `await close.click({ force: true })`, and when Barkly's
   * Plan grew taller than a 360x568 screen its own X ended up above y=0 --
   * Playwright threw "Element is outside of the viewport", the harness died
   * with a stack trace, and the run reported nothing at all. Now it is a
   * counted failure with the sheet's name on it, and the sweep carries on to
   * the sheets after it.
   */
  const close = closeSelector
    ? page.locator(closeSelector).first()
    : page.getByText('✕', { exact: true }).first();
  if (await close.count()) {
    try {
      await close.click({ force: true, timeout: 4000 });
    } catch {
      failures += 1;
      console.log(`\n${name} — CANNOT BE CLOSED at ${width}x${height}: the X is outside the viewport`);
      await page.keyboard.press('Escape').catch(() => {});
    }
  }
  await page.waitForTimeout(600);
}

await browser.close();
console.log(
  failures === 0
    ? '\nPASS — every control is reachable and every word is readable.'
    : `\nFAIL — ${failures} accessibility problem(s).`,
);
process.exit(failures === 0 ? 0 : 1);
