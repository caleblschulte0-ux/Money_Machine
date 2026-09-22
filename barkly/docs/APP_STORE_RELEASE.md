# Barkly — App Store Release Gate

This is a **release gate**, not a claim that Barkly is legally compliant or that a device test happened when it did not.

## Automated preflight

From `barkly/app`, run the release environment and then:

```bash
npm run release:check
```

The script fails closed if a release candidate still looks like a development/demo build. It checks, among other things:

- final iOS bundle identifier is present;
- final Android application id is present;
- version/build numbers are valid;
- production backend is HTTPS and not localhost;
- production app token is configured;
- no direct Anthropic key is being bundled into the app;
- developer bypass is off;
- forced-keyboard demo mode is off;
- placeholder vector renderer is not selected;
- Barkly's production voice is not deliberately disabled;
- required iOS microphone/speech purpose strings exist.

The check intentionally remains RED until the final bundle/package identifiers and production environment are supplied. Do not weaken it just to get a green line.

## Status, 2026-09-22

`release:check` under a release environment fails on exactly **two** items,
both decisions only the Apple/Google account holder can make, both permanent
once the first build is uploaded:

    expo.ios.bundleIdentifier     e.g. com.<you>.barkly
    expo.android.package          usually the same string

Everything software can supply is in the repo and checked:

| Item | Where | Checked by |
|---|---|---|
| Build profiles, dev flags blanked in production | `app/eas.json` | release:check (HIDE_DEV) |
| Splash screen | `expo-splash-screen` plugin in `app.json` | expo-doctor |
| SDK deps aligned, missing `expo-asset` peer added | `app/package.json` | expo-doctor 21/21 |
| Opaque 1024×1024 icon | `app/assets/icon.png` | release:check (PNG header) |
| Privacy manifest (required-reason APIs, data types) | `app.json` `ios.privacyManifests` | release:check |
| Export compliance (HTTPS only, exempt) | `app.json` `ios.config` | release:check |
| No white screen on a render crash | `src/ui/CrashScreen.tsx` | `crash_boundary.test.tsx` |
| Privacy policy URL | `/privacy/`, rendered from `docs/PRIVACY.md` | built by `build:pages` |
| Support URL | `/support/` | built by `build:pages` |
| Listing copy, review notes, draft privacy + age answers | `barkly/store/` | — |
| Screenshots, 6.7" and 6.1" | `npm run store:screenshots` (gitignored) | — |
| Proxy deploy (Docker, Fly, one machine) | `barkly/server/` | 54 server tests, prod boot verified |

**The path to submission, in order, and whose it is:**

1. *You:* pick the bundle id; set it and the Android package in `app.json`.
2. *You:* deploy the proxy — `cd barkly/server && fly launch --copy-config
   --no-deploy`, `fly secrets set` (the four in `fly.toml`), `fly deploy`.
   Then put its URL and `BARKLY_APP_TOKEN` in EAS secrets as
   `EXPO_PUBLIC_BARKLY_BACKEND_URL` / `EXPO_PUBLIC_BARKLY_APP_TOKEN`.
3. *You:* create the App Store Connect record; paste its id into
   `eas.json` → `submit.production.ios.ascAppId`.
4. `npm run release:check` green under that environment.
5. `eas build -p ios --profile production`, then `eas submit -p ios`.
6. *You:* TestFlight on a real iPhone (the list under "Still human-gated").
7. *You and counsel:* Kids Category decision, then the privacy
   questionnaire from `store/privacy-labels.md` and the age rating from
   `store/age-rating.md`.

## Release scope decision: iPhone first

`ios.supportsTablet` is false for the initial release branch. The current product has not been through iPad layout/device QA, so advertising native iPad support would create an unnecessary review and quality surface. Turn it back on only after iPad screenshots, safe-area/layout checks, audio/STT and interaction testing are real.

## Developer controls

The Settings developer panel is now rendered only in a build explicitly created with:

```text
EXPO_PUBLIC_BARKLY_DEV=1
```

`release:check` treats that flag as a hard failure. Production users should have no path to grant coins, jump levels or open the free-shop bypass.

Note, resolved: `useBarkly.goTo()` once re-checked `areaUnlocked` without the
dev flag while the UI's `isUnlocked()` passed it, so a dev-only tab could look
open and then refuse to move him. Both now go through one `canGo()` that reads
`devRef.current`, and a refusal is spoken rather than silent.

## Still human-gated before submission

The following cannot honestly be certified by source changes alone:

1. **Production backend deployment.** The real proxy must be live over HTTPS with provider secrets only server-side, model allowlist, budget/rate caps and the intended origin policy.
2. **Production Barkly voice.** Confirm the voice vendor/key/voice id server-side and test latency/fallback behavior.
3. **Physical iPhone QA.** Fresh install, upgrade, mic permission allow/deny, repeated conversation, AirPods/Bluetooth, interruptions, background/foreground, lock/unlock, airplane mode, weak network, storage persistence and deletion.
4. **TestFlight.** Run the exact signed candidate with real people before App Review.
5. **Privacy / child-directed classification.** Engineering posture is not legal advice. Decide Kids Category / audience strategy and have privacy/data flows reviewed appropriately.
6. **App Store Connect.** Final privacy policy/support URLs, privacy disclosures, age rating, screenshots, description/subtitle/keywords, review notes, copyright/content rights.
7. **Final art/animation.** The photo renderer is acceptable for product testing, but the handoff still identifies a rigged production character/animation pass as the visual ceiling-breaker.

## Build rule

A candidate is not a release candidate because it bundles. It is a release candidate only when:

- `npm run test:all` passes;
- `npm run typecheck` passes;
- `npm run release:check` passes under the exact release environment;
- physical-device regression passes;
- TestFlight passes;
- the privacy/legal review is complete.

No ChatGPT branch should be merged to `main` merely because these files exist. Claude/operator review remains required.
