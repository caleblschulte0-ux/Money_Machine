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

The model may return a validated `teach` candidate containing the exact cue, human-readable instruction, Barkly speech for the future trigger, optional allowed reaction, and allowed device-agnostic body actions.

The application only persists model-proposed training when the **user's own text** clearly looks like explicit teaching. A model hallucination on an ordinary turn cannot silently install behavior.

### 2. Simple teaching works without a model

For a deliberately small set of physical tricks that map cleanly to Barkly's existing body-action vocabulary, `training.ts` can parse an explicit form such as:

> "When I say intruder alert, act terrified."

That teaching turn and every later trigger can therefore work with zero dialogue-provider calls. This is intentionally conservative: ambiguous instructions, arbitrary speech, and compound choreography return `null` and fall through to the live model rather than being fake-understood.

### 3. Learned cues run locally

Before making an AI request, `DialogueEngine` checks the learned-rule store. If a cue matches, Barkly executes the stored response/actions directly.

Consequences:

- the trick still works when the provider is down;
- repeated tricks cost zero model tokens;
- a learned trick is deterministic enough to feel genuinely "trained";
- future physical Barkly can map the same allowed body actions to hardware;
- reteaching the same cue updates the existing rule instead of creating contradictory duplicates.

A sentence that is itself teaching/reteaching never fires the old trick while it is being edited.

### 4. Training is visible and deletable

Settings shows **Tricks you taught Barkly**, including cue, instruction and times used. The same individual-delete path used for facts can remove one trick. `Forget everything` also deletes training.

### 5. Prompt contract extended safely

`prompts.ts` has a `teach` section in the strict JSON reply contract. Existing learned tricks are shown to the model only as fenced reference data so Barkly can answer questions like "what tricks did I teach you?"; the model is explicitly told it does **not** decide when those cues fire.

The new reply field is optional at the TypeScript boundary so old/fallback providers remain compatible; the current parser always supplies an array.

## Release hardening added in the same branch

- Developer controls in Settings are hidden unless the build explicitly has `EXPO_PUBLIC_BARKLY_DEV=1`.
- `.env.example` documents that flag as development-only.
- Offline scripted Barkly no longer emits the forbidden app-owned `playing` reaction.
- App/package marketing version aligned to `1.0.0`, iOS build number and Android version code established.
- Initial native iPad support disabled until it has actually been tested.
- `npm run release:check` added as a fail-closed production preflight.
- Full release gate documented in `docs/APP_STORE_RELEASE.md`.

The preflight intentionally fails until final iOS/Android identifiers and real production backend environment are supplied. That is desired behavior.

## Tests added

`app/__tests__/training.test.ts` covers explicit-teaching detection, local simple-trick parsing, refusal to fake-understand compound/unsupported choreography, cue normalization, no substring trigger, reteaching, longest-cue preference, persistence/deletion, local execution, and teach+trigger with zero provider calls.

**Important:** GitHub has no workflow run attached to this draft PR, and this environment cannot clone GitHub over the network. These new tests have therefore been authored but **not executed by ChatGPT**. Claude should run the full suite/typecheck before accepting anything.

## Claude review checklist

1. Run `npm run test:all` and `npm run typecheck`.
2. Review `training.ts` trigger matching and local teaching parser.
3. Try teach → relaunch → trigger → reteach both offline and through the configured live brain.
4. Run `npm run release:check` with a production-like environment and leave it red until identifiers/backend are real.
5. Fix the dev-only `goTo()` mismatch noted in `APP_STORE_RELEASE.md` when touching `useBarkly.ts`.
6. Decide whether to add a dedicated **Teach** surface later. This branch deliberately uses natural conversation first so Barkly does not become a menu-driven toy.
7. Expand `BodyAction` only when the renderer/physical contract can support the new action. Do not let training invent device-specific motor commands.
8. Consider future trigger kinds — `seen_object`, `seen_person`, `location`, `gesture` — as siblings of voice cues, not string hacks in this store.

## Known limitation

A learned trick currently stores one short Barkly response plus simultaneous body actions available today. Compound choreography is intentionally rejected by the local parser because the renderer has no action-sequence contract yet. The next evolution should add explicit sequences and safe trigger kinds such as `seen_object`, `seen_person`, `location`, and `gesture`, preserving the rule: **the model may interpret a teaching moment, but the application owns what was learned and when it fires.**
