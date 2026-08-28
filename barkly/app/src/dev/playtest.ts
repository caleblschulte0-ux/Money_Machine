/**
 * The gate on the playtester, and it is deliberately two locks.
 *
 * The point of the playtester is that somebody who is not Caleb — ChatGPT, in a
 * browser — can jump between realistic stages of Barkly's life and actually
 * play them. The point of the GATE is that a child who opens the App Store
 * build never sees any of it, and cannot reach it by typing something into the
 * address bar of a WebView.
 *
 * So a build has to opt IN at build time before the runtime flag means
 * anything:
 *
 *   EXPO_PUBLIC_BARKLY_DEV=1             the existing dev mode. Everything on.
 *   EXPO_PUBLIC_BARKLY_PLAYTEST=1        honour ?playtest=1 in the URL.
 *   EXPO_PUBLIC_BARKLY_PLAYTEST=always   this IS the playtest build.
 *
 * A normal production build sets neither, and `?playtest=1` on it does exactly
 * nothing — there is no code path from the query string to the menu, because
 * the check below returns false before it ever looks at the URL.
 */

/**
 * Baked in at export time.
 *
 *   unset      production. There is no path to the menu at all.
 *   '1'        this build will honour ?playtest=1 in the URL.
 *   'always'   this build is the playtest build; no query string needed.
 *
 * The deployed playtest page uses 'always' so the URL is just a URL — a query
 * string is one navigation away from being lost, and a tester who suddenly
 * cannot find the menu assumes it broke.
 *
 * Note what is NOT used here: EXPO_PUBLIC_BARKLY_DEV. Dev mode unlocks every
 * area and every shop item regardless of level, which would make the presets
 * lie — "Established Barkly can reach the beach" has to mean he earned it.
 */
const PLAYTEST_BUILD = process.env.EXPO_PUBLIC_BARKLY_PLAYTEST;
const BUILD_ALLOWS_FLAG = PLAYTEST_BUILD === '1';
const ALWAYS_ON = PLAYTEST_BUILD === 'always';
const DEV_BUILD = process.env.EXPO_PUBLIC_BARKLY_DEV === '1';

const STICKY = 'barkly.playtest';

/**
 * Sticky within the tab, because loading a preset reloads the page. The query
 * string survives a `location.reload()` on its own; this covers the case where
 * something navigates and drops it, which would otherwise strand the tester in
 * a build whose menu vanished.
 */
function flaggedInUrl(): boolean {
  try {
    const w = globalThis as { location?: { search?: string; hash?: string }; sessionStorage?: Storage };
    if (!w.location) return false;
    const hit = /(^|[?&#])playtest(=1|=true)?(&|$)/.test(`${w.location.search ?? ''}${w.location.hash ?? ''}`);
    if (hit) {
      try {
        w.sessionStorage?.setItem(STICKY, '1');
      } catch {
        /* private mode; the query string alone will have to do */
      }
      return true;
    }
    return w.sessionStorage?.getItem(STICKY) === '1';
  } catch {
    return false;
  }
}

/** True when the playtester menu and its PLAYTEST badge may exist at all. */
export function playtestAllowed(): boolean {
  if (DEV_BUILD || ALWAYS_ON) return true;
  if (!BUILD_ALLOWS_FLAG) return false;
  return flaggedInUrl();
}
