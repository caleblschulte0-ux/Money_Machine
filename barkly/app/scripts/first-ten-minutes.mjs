/**
 * THE ONLY TEST THAT ASKS WHETHER BARKLY IS THE THING HE CLAIMS TO BE.
 *
 * The product's standing gate is one sentence: a stranger should understand
 * within ten minutes that Barkly LEARNS, REMEMBERS, DEVELOPS HISTORY and
 * BECOMES UNIQUELY THEIRS. Everything else in this repo tests whether the app
 * works -- controls reachable, text legible, nothing standing on his face,
 * saves surviving a refresh. Nothing tests whether the promise lands, and a
 * game can pass every gate we have while being a very well-behaved toy that
 * forgets you.
 *
 * So this plays the opening the way a stranger would, on a FRESH profile: name
 * him, pet him, feed him, play, talk to him, take him somewhere, dig. Then it
 * opens the Pack Book -- the place his history is supposed to live -- and
 * reports what a person would actually have seen.
 *
 * It deliberately does NOT score. There is no threshold at which a dog is
 * sufficiently characterful, and a number here would be false precision on the
 * one question that most needs a human to look. It prints the transcript and
 * the history, and a person reads it.
 *
 *   node scripts/first-ten-minutes.mjs [url]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { browserOptions } from './lib/browser.mjs';

// Resolved, not hardcoded: that build number changes with every
// Playwright bump and the path exists in one sandbox only.
const CHROME = browserOptions().executablePath;
const url = process.argv[2] || `file://${process.cwd()}/dist/playtest/index.html`;
const NAME = 'Sam';
const SECRET = 'pineapple';

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const said = [];
let last = '';
async function listen(label) {
  const text = (await page.locator('[data-testid="conversation-dock"]').first().innerText().catch(() => '')).trim();
  /*
   * The dock contains his speech AND its own chrome -- the "BARKLY" byline and
   * the "type" button. A first transcript recorded him saying "type" after a
   * walk to the park, which is the harness quoting the UI back at itself and
   * would read, to anyone skimming, as the dog producing nonsense.
   */
  const CHROME = /^(type|barkly|barkly brain|•)$/i;
  const line = text.split('\n').map((l) => l.trim()).filter((l) => l && !CHROME.test(l)).pop() || '';
  if (line && line !== last) {
    said.push({ after: label, line });
    last = line;
  }
}

async function tap(nameRe, label, wait = 2600) {
  const b = page.getByRole('button', { name: nameRe }).first();
  if (!(await b.count())) return false;
  await b.click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(wait);
  await listen(label);
  return true;
}

await page.goto(url);
await page.waitForTimeout(5000);

// --- Onboarding, as a stranger meets it -------------------------------------
const onboarding = [];
for (let step = 0; step < 10; step += 1) {
  const input = page.locator('input:visible').first();
  if (await input.count()) {
    const ph = (await input.getAttribute('placeholder')) || '';
    if (/name|call/i.test(ph)) await input.fill(NAME);
    else if (/secret|word/i.test(ph)) await input.fill(SECRET);
  }
  const heading = (await page.locator('body').innerText().catch(() => '')).split('\n').filter(Boolean).slice(0, 3);
  /*
   * The real sequence, walked once and written down rather than guessed:
   *   hi -> [your name] -> tell him -> okay -> [a secret word] -> teach him -> say it
   * A first version stopped at "say it" and reported a silent dog, which looks
   * exactly like a broken game and was a broken regex.
   */
  /*
   * The last step is labelled with YOUR OWN SECRET WORD, not with a generic
   * "say it" -- onboarding finishes by having you say the word you just
   * invented to him, which is a lovely thing and completely defeats a fixed
   * regex. Two harness runs reported a silent dog because of it, and a silent
   * dog is indistinguishable from a broken game, which is exactly the kind of
   * false negative this file exists to avoid producing.
   */
  const next = page.getByRole('button')
    .filter({ hasText: new RegExp(`^(hi|tell him|teach him|say it|${SECRET}|next|okay|start|continue|got it|let's go|meet)$`, 'i') })
    .first();
  if ((await next.count()) && (await next.isEnabled().catch(() => false))) {
    onboarding.push(heading.join(' / '));
    await next.click().catch(() => {});
    await page.waitForTimeout(900);
  } else break;
}
await page.waitForSelector('[data-testid="barkly-sprite"]', { timeout: 30_000 }).catch(() => {});
await page.waitForTimeout(2500);
await listen('arriving');

// --- Ten minutes of being a new owner ---------------------------------------
const sprite = page.locator('[data-testid="barkly-sprite"]').first();
for (const [i] of [[1], [2], [3]].entries()) {
  await sprite.click().catch(() => {});
  await page.waitForTimeout(1500);
  await listen(`petting him (${i + 1})`);
}
await tap(/food/i, 'opening his bowl', 1500);
await tap(/^FEED$/i, 'feeding him');
await tap(/Close food/i, 'closing the bowl', 1200);
await tap(/^(ball|stick|rope|waves|play)/i, 'playing with him', 3200);

// Talking is the whole point of him.
for (const line of ['hello', 'good boy', 'sit']) {
  const floor = page.getByRole('button', { name: 'Type to Barkly' }).first();
  if (await floor.count()) { await floor.click().catch(() => {}); await page.waitForTimeout(700); }
  const input = page.locator('input:visible').first();
  if (await input.count()) {
    await input.fill(line);
    await input.press('Enter').catch(() => {});
    await page.waitForTimeout(3600);
    await listen(`saying "${line}"`);
  }
}

// Somewhere new, and something that leaves a trace.
const park = page.getByRole('tab').filter({ hasText: /park/i }).first();
if (await park.count()) {
  await park.click().catch(() => {});
  await page.waitForTimeout(3200);
  await listen('taking him to the park');
  await tap(/dig/i, 'digging', 4200);
}

// --- What history does he have to show for it? ------------------------------
let packBook = '';
const pack = page.getByRole('button', { name: /pack/i }).first();
if (await pack.count()) {
  await pack.click().catch(() => {});
  await page.waitForTimeout(1800);
  packBook = (await page.locator('body').innerText().catch(() => '')).trim();
}

await mkdir('art-review', { recursive: true });
await writeFile('art-review/first-ten-minutes.txt',
  [`Barkly's first ten minutes, as a stranger sees them`, `named him: ${NAME}`, '',
    'ONBOARDING', ...onboarding.map((o) => `  ${o}`), '',
    'WHAT HE SAID', ...said.map((s) => `  [${s.after}]\n    ${s.line}`), '',
    'THE PACK BOOK AFTERWARDS', packBook.split('\n').filter(Boolean).map((l) => `  ${l}`).join('\n'),
  ].join('\n') + '\n');

console.log(`named him ${NAME}; he said ${said.length} things\n`);
for (const s of said) console.log(`[${s.after}]\n  ${s.line}\n`);
console.log('--- PACK BOOK ---');
console.log(packBook.split('\n').filter(Boolean).slice(0, 40).join('\n'));
await browser.close();
