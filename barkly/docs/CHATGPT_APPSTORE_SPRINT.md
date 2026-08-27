# ChatGPT App Store Sprint — Claude Review Handoff

**Branch:** `chatgpt/barkly-appstore-hardening-20260827`  
**Base:** Claude branch `claude/barkley-mvp-mobile-qbegtj` at `60b24656923ee7b309c24307715575c97890a70a`  
**Draft review PR:** #2, targeting the Claude branch — **not `main`**  
**Do not merge blindly. Claude should review this branch first.**

## Why this branch exists

The operator asked ChatGPT to continue while Claude is unavailable, while keeping ChatGPT code clearly isolated so Claude can inspect, edit, cherry-pick or reject it before anything reaches `main`.

Claude's latest branch already contained the large App Store hardening work: structured memory, conversation-state locks, resilient dialogue, onboarding, parental/privacy UI, Barkly voice routing, progression/shop, dev mode, character initiative and real-device-oriented failure handling. This sprint intentionally does **not** redo those systems.

## Product work: user-taught Barkly

### 1. User-taught tricks as a first-class subsystem

New: `app/src/barkly/training.ts`.

Barkly can now learn an explicitly taught reusable cue rather than merely remember a sentence about it.

Example teaching turn:

> "When I say intruder alert, act terrified."

The model may return a validated `teach` candidate containing:

- exact cue
- human-readable instruction
- Barkly speech for the future trigger
- optional allowed emotional reaction
- allowed device-agnostic body actions

The application will only persist that candidate when the **user's own text** clearly looks like explicit teaching. A model hallucination on an ordinary turn therefore cannot silently install a behavior.

### 2. Learned cues run locally

Before making an AI request, `DialogueEngine` checks the learned-rule store. If a cue matches, Barkly executes the stored response/actions directly.

Consequences:

- the trick still works when the provider is down;
- repeated tricks cost zero model tokens;
- a learned trick is deterministic enough to feel genuinely "trained";
- future physical Barkly can map the same allowed body actions to hardware;
- reteaching the same cue updates the existing rule instead of creating contradictory duplicates.

A sentence that is itself teaching/reteaching never fires the old trick while it is being edited.

### 3. Training is visible and deletable

Learned rules live alongside memory persistence but remain a distinct category because they change behavior rather than merely describe the user.

Settings now shows **Tricks you taught Barkly**, including cue, instruction and times used. The same individual-delete path used for facts can remove one trick. `Forget everything` also deletes training.

### 4. Prompt contract extended safely

`prompts.ts` now has a `teach` section in the strict JSON reply contract. Existing learned tricks are shown to the model only as fenced reference data so Barkly can answer questions like "what tricks did I teach you?"; the model is explicitly told it does **not** decide when those cues fire.

The new reply field is optional at the TypeScript boundary so old/fallback providers remain compatible; the current parser always supplies an array.

## Release hardening added in the same branch

- Developer controls in Settings are hidden unless the build explicitly has `EXPO_PUBLIC_BARKLY_DEV=1`.
- `.env.example` now documents that flag as development-only.
- Offline scripted Barkly no longer emits the forbidden app-owned `playing` reaction.
- App/package marketing version aligned to `1.0.0`, iOS build number and Android version code established.
- Initial native iPad support disabled until it has actually been tested.
- `npm run release:check` added as a fail-closed production preflight.
- Full release gate documented in `docs/APP_STORE_RELEASE.md`.

The preflight intentionally fails until final iOS/Android identifiers and real production backend environment are supplied. That is desired behavior.

## Tests added

`app/__tests__/training.test.ts` covers:

- explicit-teaching detection;
- punctuation normalization;
- no substring trigger (`sit` must not fire inside `situation`);
- reteaching replaces rather than duplicates;
- longest matching cue wins;
- persistence and individual deletion;
- learned cue bypasses the dialogue provider entirely.

**Important:** GitHub has no workflow run attached to this draft PR, and this environment cannot clone GitHub over the network. These new tests have therefore been authored but **not executed by ChatGPT**. Claude should run the full suite/typecheck before accepting anything.

## Claude review checklist

1. Run `npm run test:all` and `npm run typecheck`.
2. Review `training.ts` trigger matching. Decide whether v1 should require exact cue, allow surrounding words as implemented, or add a user-selectable trigger mode.
3. Try live examples through the configured brain:
   - "When I say intruder alert, act terrified."
   - close/reopen app;
   - "intruder alert";
   - reteach the same cue with a different behavior;
   - verify Settings shows one updated rule.
4. Run `npm run release:check` with a production-like environment and leave it red until identifiers/backend are real.
5. Fix the dev-only `goTo()` mismatch noted in `APP_STORE_RELEASE.md` when touching `useBarkly.ts`.
6. Decide whether to add a dedicated **Teach** surface later. This branch deliberately uses natural conversation first so Barkly does not become a menu-driven toy.
7. Expand `BodyAction` only when the renderer/physical contract can support the new action. Do not let training invent device-specific motor commands.
8. Consider future trigger kinds — `seen_object`, `seen_person`, `location`, `gesture` — as siblings of voice cues, not string hacks in this store.

## Known limitation, intentionally left for the next pass

A learned trick currently stores one short Barkly response plus the body actions available today. That makes the cue reliable, but not infinitely generative. The next evolution should support safe trigger kinds such as `voice_phrase`, `seen_object`, `seen_person`, `location`, and `gesture`, with the same principle: **the model may interpret a teaching moment, but the application owns what was learned and when it fires.**
