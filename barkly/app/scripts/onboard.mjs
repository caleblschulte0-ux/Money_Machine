/**
 * Walk a fresh Barkly through onboarding, in ONE place.
 *
 * Eight harnesses had their own copy of this loop -- a11y, art-lab, overlap,
 * nav-state, no-playtest, playtest-acceptance, voice, world-art-snapshot --
 * each with the same hardcoded list of button labels. When onboarding grew a
 * teaching beat on 2026-09-03, all eight walked into it and stopped: every
 * browser-driven check in the repo failed at once, on a change that broke
 * none of the things they measure. That is the cost of eight copies, and it
 * is the reason there is now one.
 *
 * The contract this file owns: get from a cold load to the room, whatever
 * beats onboarding currently has, and say so honestly if it could not.
 */

/** Every button that advances a beat, including the taught cue's payoff. */
const ADVANCE = /^(hi|tell him|next|okay|skip|teach him|say it|let him hear|not right now)$/i;

/**
 * @param page       Playwright page, already loaded.
 * @param opts.name  What to type when he asks who you are.
 * @param opts.cue   The word to teach him on the training beat.
 * @param opts.settle  ms to wait after each beat.
 * @returns true once the room is reachable.
 */
export async function walkOnboarding(page, opts = {}) {
  const name = opts.name ?? 'Caleb';
  const cue = opts.cue ?? 'IRS';
  const settle = opts.settle ?? 700;

  for (let i = 0; i < 12; i += 1) {
    // Already in the room: the destination tray only exists there.
    if (await page.locator('[aria-label^="Pack Book"]').count()) return true;

    const input = page.locator('input:visible').first();
    if (await input.count()) {
      const ph = (await input.getAttribute('placeholder')) || '';
      if (/name|call/i.test(ph)) await input.fill(name);
      // The teaching beat asks for a word, not a name.
      else if (/secret word/i.test(ph)) await input.fill(cue);
    }

    // The payoff beat labels its button with the CUE ITSELF, so no fixed list
    // can match it; fall back to the primary control when nothing else fits.
    let next = page.getByRole('button').filter({ hasText: ADVANCE }).first();
    if (!(await next.count())) {
      next = page.getByRole('button').filter({ hasText: new RegExp(`^${cue}$`, 'i') }).first();
    }
    if (!(await next.count())) break;

    /*
     * A DISABLED BUTTON IS NOT THE END OF ONBOARDING.
     *
     * The trick beat disables its control for ~2.4s while he actually plays
     * dead -- the payoff the beat exists for. Treating "disabled" as "no more
     * beats" made every harness stop dead in the middle of the meeting and
     * report that onboarding never finished. Wait it out instead.
     */
    /*
     * Every check is bounded and swallows its own failure. A beat button is
     * detached the instant its beat advances, and a bare `isEnabled()` on a
     * detached locator waits the full default timeout -- 30 seconds, then a
     * thrown error, in a helper eight harnesses depend on. Ask with a short
     * deadline and treat "gone" as "not ready", which is what it means.
     */
    const enabled = () => next.isEnabled({ timeout: 1000 }).catch(() => false);
    let ready = await enabled();
    for (let waited = 0; !ready && waited < 4000; waited += 400) {
      await page.waitForTimeout(400);
      // The beat may have moved on under us; re-resolving is the point.
      if (await page.locator('[aria-label^="Pack Book"]').count()) return true;
      ready = await enabled();
    }
    if (!ready) break;

    await next.click().catch(() => {});
    await page.waitForTimeout(settle);
  }

  await page.waitForTimeout(1200);
  return (await page.locator('[aria-label^="Pack Book"]').count()) > 0;
}
