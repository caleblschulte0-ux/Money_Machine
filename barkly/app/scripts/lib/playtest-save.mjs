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
