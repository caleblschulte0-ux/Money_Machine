# ChatGPT App Store Sprint — Claude Review Handoff

**Branch:** `chatgpt/barkly-appstore-hardening-20260827`  
**Base:** Claude branch `claude/barkley-mvp-mobile-qbegtj` at `60b24656923ee7b309c24307715575c97890a70a`  
**Do not merge blindly. Claude should review this branch first.**

## Why this branch exists

The operator asked ChatGPT to continue while Claude is unavailable, while keeping ChatGPT code clearly isolated so Claude can inspect, edit, cherry-pick or reject it before anything reaches `main`.

Claude's latest branch already contained the large App Store hardening work: structured memory, conversation-state locks, resilient dialogue, onboarding, parental/privacy UI, Barkly voice routing, progression/shop, dev mode, character initiative and real-device-oriented failure handling. This sprint intentionally does **not** redo those systems.

## What ChatGPT added

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

Settings now shows **Tricks you taught Barkly**, including cue, instruction and local use count. The same individual-delete path used for facts can remove one trick. `Forget everything` also deletes training.

This matters for both product quality and privacy: Barkly should not acquire invisible behavior the person cannot inspect or remove.

### 4. Prompt contract extended safely

`prompts.ts` now has a `teach` section in the strict JSON reply contract. Existing learned tricks are shown to the model only as fenced reference data so Barkly can answer questions like "what tricks did I teach you?"; the model is explicitly told it does **not** decide when those cues fire.

Model speech is also bounded through the existing sanitizer before it reaches the app.

## Tests added

`app/__tests__/training.test.ts` covers:

- explicit-teaching detection;
- punctuation normalization;
- no substring trigger (`sit` must not fire inside `situation`);
- reteaching replaces rather than duplicates;
- longest matching cue wins;
- persistence and individual deletion;
- learned cue bypasses the dialogue provider entirely.

## Claude review checklist

1. Run the full app test suite and TypeScript build.
2. Review `training.ts` trigger matching. Decide whether v1 should require exact cue, allow surrounding words as implemented, or add a user-selectable trigger mode.
3. Try live examples through the configured brain:
   - "When I say intruder alert, act terrified."
   - close/reopen app;
   - "intruder alert";
   - reteach the same cue with a different behavior;
   - verify Settings shows one updated rule.
4. Decide whether to add a dedicated **Teach** surface later. This branch deliberately uses natural conversation first so Barkly does not become a menu-driven toy.
5. Expand `BodyAction` only when the renderer/physical contract can support the new action. Do not let training invent device-specific motor commands.
6. Consider a future camera/object trigger type as a sibling of voice cues, not as a string hack in this store.

## Known limitation, intentionally left for the next pass

A learned trick currently stores one short Barkly response plus the body actions available today. That makes the cue reliable, but not infinitely generative. The next evolution should support safe trigger kinds such as `voice_phrase`, `seen_object`, `seen_person`, `location`, and `gesture`, with the same principle: **the model may interpret a teaching moment, but the application owns what was learned and when it fires.**
