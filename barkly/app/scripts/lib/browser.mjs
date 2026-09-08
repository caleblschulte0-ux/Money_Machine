/*
 * ONE PLACE THAT KNOWS HOW TO FIND CHROMIUM.
 *
 * Four scripts drive a real browser. Two of them resolved the executable by
 * probing candidates and falling back to whatever Playwright installed; two
 * hardcoded `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, which is a
 * path inside one particular dev sandbox and does not exist on a GitHub
 * runner. So CI failed at `prop-clear-check` with "executable doesn't exist"
 * while the checks either side of it passed, which reads like a broken check
 * rather than a hardcoded path.
 *
 * The resolution order, most specific first:
 *   CHROMIUM_PATH        an explicit override, for an unusual environment
 *   PLAYWRIGHT_BROWSERS_PATH/chromium*   where a sandbox pre-installs it
 *   /opt/pw-browsers/chromium*           the sandbox default
 *   (nothing)            let Playwright use its own download, which is what
 *                        `npx playwright install chromium` just put in place
 *                        on CI
 *
 * The glob matters: the sandbox path carries a build number
 * (chromium-1194) that changes with every Playwright bump, so naming one
 * exactly is a break waiting for the next upgrade.
 */
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

function insideBrowsersDir(root) {
  if (!root || !existsSync(root)) return null;
  // Either <root>/chromium/chrome-linux/chrome or <root>/chromium-<build>/...
  const candidates = [];
  try {
    for (const entry of readdirSync(root)) {
      if (entry === 'chromium' || entry.startsWith('chromium-')) {
        candidates.push(join(root, entry, 'chrome-linux', 'chrome'));
        candidates.push(join(root, entry));
      }
    }
  } catch {
    return null;
  }
  // Newest build number last in readdir order is not guaranteed, so prefer
  // the highest-numbered directory rather than whichever came back first.
  candidates.sort().reverse();
  return candidates.find((path) => existsSync(path)) ?? null;
}

/** Launch options for chromium.launch(), with the executable resolved. */
export function browserOptions(extraArgs = []) {
  const args = ['--no-sandbox', ...extraArgs];
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)) {
    return { executablePath: process.env.CHROMIUM_PATH, args };
  }
  for (const root of [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers']) {
    const found = insideBrowsersDir(root);
    if (found) return { executablePath: found, args };
  }
  // No override: Playwright's own resolution. On CI this is the browser that
  // `npx playwright install chromium` just downloaded.
  return { args };
}
