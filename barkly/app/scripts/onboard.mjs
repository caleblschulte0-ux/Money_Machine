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

  for (let i = 0; i < 18; i += 1) {
    // Already in the room: the destination tray only exists there.
    if (await page.locator('[aria-label^="Pack Book"]').count()) return true;

    const input = page.locator('input:visible').first();
    if (await input.count()) {
      const ph = (await input.getAttribute('placeholder')) || '';
      if (/name|call/i.test(ph)) await input.fill(name);
      // The teaching beat asks for a word, not a name.
      else if (/secret word/i.test(ph)) await input.fill(cue);
    }

    /*
     * ONE locator matching EITHER a named beat button or the cue.
     *
     * The payoff beat labels its button with the CUE ITSELF, so no fixed list
     * can match it. `.or()` re-resolves at use time, so whichever is on screen
     * is what gets clicked.
     */
    const next = page
      .getByRole('button')
      .filter({ hasText: ADVANCE })
      .or(page.getByRole('button').filter({ hasText: new RegExp(`^${cue}$`, 'i') }))
      .first();

    /*
     * NOTHING MATCHED IS USUALLY "NOT YET", NOT "NEVER".
     *
     * Playwright's role engine excludes `aria-disabled="true"` from
     * getByRole('button') entirely -- so while the trick beat plays its 2.4s
     * performance, the button does not merely look disabled, it is INVISIBLE
     * to the walker. Treating that as the end of onboarding stranded all eight
     * harnesses one beat short of the room. Wait and go round again; the outer
     * cap is what bounds this.
     */
    if (!(await next.count())) {
      await page.waitForTimeout(700);
      continue;
    }

    await next.click().catch(() => {});
    await page.waitForTimeout(settle);
  }

  await page.waitForTimeout(1200);
  return (await page.locator('[aria-label^="Pack Book"]').count()) > 0;
}
