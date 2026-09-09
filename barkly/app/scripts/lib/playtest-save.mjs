/**
 * GETTING INTO THE WHOLE GAME, ONCE, FOR EVERY HARNESS THAT NEEDS IT.
 *
 * Three places in the world are locked on a fresh save, so any tool that wants
 * to look at all four has to load the developed playtest save first. Two
 * harnesses grew their own copy of that walk and they did not stay equal:
 * `blocking.mjs` used the stable testIDs, retried, and refused to report a
 * place it could not open; `composition.mjs` clicked on visible TEXT, gave up
 * silently, and then measured the Beach by clicking its padlocked tab -- which
 * leaves you standing in Town. On 2026-09-09 it printed a beach row that was
 * town's numbers to the decimal, 29 props and massX 0.47 on both lines, and
 * exited 0.
 *
 * A locked tab is still rendered, still clickable, and clicking it makes him
 * SAY he cannot go. So "reachable" here always means THE SCENE APPEARED, never
 * "a tab with that name exists".
 */

/**
 * Walk Settings -> playtest -> the long-term save. Quiet on failure; the
 * caller decides how loud to be, because `showPlace` is the real evidence.
 */
export async function loadDevelopedSave(page) {
  try {
    const gear = page.getByLabel('Settings').first();
    if (!(await gear.count())) return;
    await gear.click({ timeout: 6000 });
    await page.waitForTimeout(520);
    const entry = page.locator('[data-testid="playtest-settings"]').first();
    if (!(await entry.count())) return;
    await entry.click({ timeout: 6000 });
    await page.waitForTimeout(650);
    const slot = page.locator('[data-testid="playtest-longterm"]').first();
    if (!(await slot.count())) return;
    await slot.click({ force: true, timeout: 6000 });
    await page.waitForSelector('[data-testid="dialogue-panel"]', { timeout: 20000 }).catch(() => {});
  } catch { /* the caller checks showPlace */ }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(900);
}

/** True only when the scene for `place` is actually on screen. */
export async function showPlace(page, place) {
  if (place === 'home') return true;
  const tab = page.getByRole('tab', { name: new RegExp(place, 'i') }).first();
  if (!(await tab.count())) return false;
  await tab.click({ timeout: 6000 }).catch(() => {});
  await page.waitForSelector(`[data-testid="world-scene-${place}"]`, { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(1200);
  return (await page.locator(`[data-testid="world-scene-${place}"]`).count()) > 0;
}

/**
 * Get to `place`, reloading the save if the first try lands nowhere -- the
 * menu is a few animated steps and any of them can be missed, which reads
 * exactly like "that scene does not exist". Returns false only after retrying.
 */
export async function reachPlace(page, place, attempts = 3) {
  for (let i = 0; i < attempts; i += 1) {
    if (await showPlace(page, place)) return true;
    await loadDevelopedSave(page);
  }
  return false;
}

/**
 * PIN THE CLOCK BEFORE YOU JUDGE THE ART.
 *
 * The app reads `new Date().getHours()` and grades the whole world from it --
 * sky band, key colour, the pools, the night wash. Nothing in this repo ever
 * controlled that, so every scene capture ever taken here was shot at whatever
 * hour the runner happened to be in, and a contact sheet built by walking the
 * four places could put the park at 2pm next to the town at 6pm.
 *
 * On 2026-09-09 that produced the exact confusion it sounds like: three
 * consecutive measurement passes comparing sat/val "between scenes" were
 * partly comparing TIMES OF DAY, and the conclusion "the places do not match"
 * was measured against a moving target. A place is allowed to look different
 * at six than at two. It has to be the same six.
 *
 * Call this BEFORE `page.goto`. It patches the constructor and getHours so a
 * clock read at any point in the session answers with the hour you asked for.
 */
export async function pinHour(page, hour) {
  /*
   * Playwright's own clock, not a hand-rolled `Date` override. The first
   * version of this replaced the global Date class, which the app's animation
   * loop also reads: every scene rendered as a bare cream field with no dog in
   * it. `page.clock.install` fakes the wall clock at the browser level and
   * `resume` lets it tick normally from there, so requestAnimationFrame and
   * Animated keep working while `new Date().getHours()` answers what we asked.
   */
  const at = new Date();
  at.setHours(hour, 0, 0, 0);
  await page.clock.install({ time: at });
  await page.clock.resume();
}
