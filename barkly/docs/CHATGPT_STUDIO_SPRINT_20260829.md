# Barkly — ChatGPT Studio Sprint / Claude Review Contract

**Date:** 2026-08-29  
**ChatGPT branch:** `chatgpt/barkly-studio-sprint-20260829`  
**Exact Claude base:** `ada6de8e9b8d091bed744f1a8b49145b9035bdef` (`claude/barkley-mvp-mobile-qbegtj`)  
**Governance:** this branch is review material only. Do not merge to `main` from here. Claude owns acceptance/rework/cherry-pick decisions back onto the Claude Barkly line.

## Product north star

> **Barkly is not an AI chatbot shaped like a dog. He is a dog who becomes different because of what you do together.**

Every major addition should pass this test:

> Could two people use this feature for a month and end up with noticeably different Barklys?

And the presentation rule is now equally important:

> **Do not merely store history. Make the room, body, possessions, opinions, relationships, routines, NPC world and stories become evidence of that history.**

---

# What ChatGPT changed in this branch

These are intentionally reviewable slices, not a giant rewrite.

## 1. Barkly's Plan uses the player's local calendar day

`src/game/adventure.ts`

The old `toISOString().slice(0, 10)` used UTC. In US time zones a plan could roll over in the evening. `adventureDay()` now uses the device-local year/month/date. A test was added.

**Claude review:** confirm this agrees with the intended product definition of "today" and that the full Plan persistence flow still rolls correctly when the app backgrounds/resumes.

## 2. Treasure favorites are earned instead of newest-wins

`src/barkly/character.ts`

The old `withTreasure()` made every new find the favorite. That made "favorite" mean "the last thing RNG returned."

This branch adds durable `treasureAffinities` and `noteTreasureAffinity()`:

- first treasure can become the initial favorite;
- a later discovery becomes a temporary obsession but does not automatically erase the old favorite;
- repeated history can actually change Barkly's preference;
- old saves with a `favoriteTreasure` but no affinity record are backfilled without rerolling the dog;
- future systems (naming, displaying, defending from Duke, story use, repeated handling) have one shared way to strengthen attachment.

**Claude review:** inspect save compatibility carefully. Then wire meaningful object interactions into `noteTreasureAffinity()` instead of inventing new favorite flags elsewhere.

## 3. Pack Book v2 — relationship scrapbook, not analytics

`src/ui/PackBookSheet.tsx`

The underlying relationship system is strong. The old presentation exposed machinery: numeric trait scores, meters, intensity dots, numbered memory rows and a long explanation of the product thesis.

This branch keeps the same data model but presents:

- relationship identity as the cover;
- stage as a quiet five-step visual rather than a progress KPI;
- traits as identity stamps, with no visible score;
- current saga as "current drama";
- rituals as running bits;
- lore as receipts / beef files / sacred junk;
- memories as taped cards;
- almost all product-explainer copy removed.

**Claude review:** screenshot every saved-life preset at the five standard phone sizes. Keep the scrapbook direction even if individual styling needs rework.

## 4. Barkly's Plan v2 — Barkly's note, not a productivity sheet

`src/ui/AdventureSheet.tsx`

Same mechanics, different emotional framing:

- three ideas on a taped note;
- checkboxes and scribbles instead of KPI cards;
- rewards demoted to a small side note;
- no streak pressure remains;
- completion is Barkly's verdict rather than a task-app success state.

**Claude review:** preserve this framing. The long-term target is eventually an in-world object (fridge/corkboard/note) rather than a bottom sheet.

## 5. Onboarding happens in Barkly's actual Home scene

`src/ui/Onboarding.tsx`

The source comment claimed first launch happened in Barkly's room, but implementation used a generic gradient. This branch reuses `HomeScene` directly and keeps the same character renderer and candy-control language.

**Claude review:** visually inspect very short and very tall phones. If the positioning needs tuning, fix the layout without reverting to a separate onboarding universe.

---

# Claude's next pass: do this first

1. Rebase/recreate these changes against the latest Barkly head if Claude has advanced beyond the base SHA.
2. Run the complete Barkly gate: Jest, server tests, typecheck, layout/overlap, a11y, voice check, release gate and the 29-step acceptance playthrough.
3. Open all standard playtester saves and visually inspect Pack Book, Plan and onboarding at 360x640, 375x667, 390x844, 412x915 and 430x932.
4. Fix regressions in this branch's ideas rather than dropping the ideas because a first implementation needs tuning.
5. Once green, continue the roadmap below in priority order.

---

# P0 — finish the illusion before adding breadth

## A. Move major moments out of software-looking modals

### Encounters

Keep the existing durable choice mechanics, but stop replacing the world with a centered form.

Target:

- scene remains visible;
- camera/attention pushes toward Barkly + NPC;
- NPC says the setup in-world;
- Barkly physically reacts and looks to the player;
- three choices live near the bottom of the scene;
- selection produces body animation + dialogue + durable consequence;
- learned routines may appear as unique choices when relevant.

### Contests

Keep the tested timing rules, but render the fiction.

Fetch duel target:

- Barkly and Duke visible;
- ball visible;
- timing input controls the throw/start;
- both dogs animate the result;
- score is secondary, not the entire screen.

The mechanic may still be a timing bar internally. The player should experience dogs competing, not a React Native meter.

## B. Barkly Rig v3

The front puppet is the correct direction but is incomplete.

Add independent or properly parented control for, in roughly this order:

- tail;
- front paws;
- chest/shoulders;
- jaw/muzzle where practical;
- three-quarter pose rig;
- later, lying/sleep interaction rig.

Required new physical beats:

- paw bowl / nose toward food;
- scratch;
- stretch;
- play bow;
- brace during tug;
- paw at object;
- lean into petting;
- turn away unimpressed;
- partial flop/roll;
- better pick-up/carry transitions.

Do not redesign Barkly. At rest he must remain the locked approved character.

## C. Unique NPC bodies

Biscuit, Pepper and Duke should no longer read as Barkly recolors.

Same collectible toy universe, different silhouettes.

- Biscuit: floppy/long-eared, loose, goofy, slightly uncoordinated physical acting.
- Pepper: sleek/narrow, economical movement, controlled eye language.
- Duke: broad/chunky, chest-forward, eyebrow swagger, takes up space.

Black-silhouette test: each should be identifiable without color.

## D. Real soundscape

Voice is strong. The world is still comparatively quiet.

Add a small event-driven SFX/ambience layer:

- collar jingle;
- paws by surface;
- bowl clink;
- chew/crunch;
- ball squeak;
- rope/tug friction;
- digging dirt and sand;
- bed rustle;
- body shake/sniff/exhale;
- park ambience;
- town ambience;
- beach ambience/waves/gulls;
- subtle contest/story accents.

Speech should duck ambience slightly. Mute must silence body/ambience/haptics consistently with existing feel philosophy.

## E. Settings cleanup

Consumer Settings should eventually be:

- Sound
- Voice
- speech/text preference
- Accessibility
- Memory & Privacy
- Help
- About

Move fun state out:

- stash -> room / Pack Book;
- tricks -> Pack Book / training;
- care stats -> Barkly/body or a lightweight care surface;
- memories -> Pack Book.

Provider, breaker, fallback and implementation details belong in dev diagnostics, not normal consumer IA.

---

# P1 — make *this* Barkly impossible to replace

## F. Story Engine v2: persistent chapters, not inferred labels

Current Story Engine derives the strongest implied saga from state. Keep that discovery layer, then persist actual arcs.

Suggested shape:

```ts
interface StoryState {
  active?: StoryInstance;
  archive: StoryInstance[];
}

interface StoryInstance {
  id: string;
  template: string;
  startedAt: number;
  cast: string[];
  subjectIds: string[];
  chapter: number;
  branch: string;
  decisions: StoryDecision[];
  status: 'active' | 'resolved' | 'abandoned';
  resolvedAt?: number;
  souvenirId?: string;
}
```

Stories should:

- begin from actual relationship/object/routine state;
- persist across sessions;
- branch from player choices;
- alter social/object history;
- resolve;
- archive forever;
- leave a room/Pack Book souvenir;
- be recallable in future dialogue.

Example: Duke insults favorite treasure -> user defends it -> treasure goes missing -> Biscuit knows something -> recover it -> create permanent "Treasure Security" lore/souvenir.

## G. Object identity

Do not stop at item ownership.

Important toys/treasures should be able to accumulate:

- stable id;
- user/Barkly name;
- acquired/found date;
- interaction count;
- last interaction;
- preference/affinity;
- story references;
- NPC references;
- visible wear state;
- lost/recovered state later;
- display/home placement later.

A random rock is content. A rock Barkly calls Steve, defended from Duke, displayed for three months is relationship state.

## H. Wire treasure affinity into the world

The branch adds the shared `noteTreasureAffinity()` primitive. Use it when something actually happens:

- object is named;
- object is displayed at Home;
- Barkly chooses/references it repeatedly;
- an NPC interacts with it;
- a story is about it;
- user protects/recovers it;
- Barkly carries/uses it later.

Do not award affinity merely because a value was rendered on screen.

## I. Formed preferences beyond treasures

Build one coherent opinion/preference model rather than many unrelated favorite flags.

Candidates:

- favorite toy;
- favorite food;
- favorite location;
- favorite sleeping spot;
- favorite routine;
- favorite time/context;
- likes/dislikes of recurring world things.

Preferences should change slowly from evidence.

## J. Barkly opinions

Facts answer "what happened." Character requires "what does Barkly think about it?"

Persist bounded opinions such as:

- loves cheese;
- thinks Beach is overrated;
- distrusts pigeons;
- trusts Pepper's judgment;
- thinks the vacuum is evil;
- loves one particular rope.

Dialogue and initiative should use them as texture. Opinions can strengthen, weaken or reverse from experience.

## K. Barkly invents things back

The player authors Barkly first. High-bond Barkly should then co-author the relationship.

Examples:

- invent nickname for player;
- rename a routine;
- name a treasure;
- declare a chair/spot "mine";
- invent a greeting ritual;
- declare a favorite;
- refuse/retire an overused bit;
- create a two-part routine and ask the player to participate.

Where appropriate, give the player accept/reject/tease-back agency.

## L. Home becomes biography

Home must visibly accumulate history.

Possible evidence:

- favorite toy lying around;
- treasure shelf;
- named treasure label;
- Biscuit photo/card;
- Duke photo vandalized or annotated;
- contest trophy/souvenir;
- resolved-story artifact;
- worn bed/rope/ball;
- routine certificate or ridiculous note;
- seasonal/time-of-day clutter later.

A veteran Home screenshot should immediately look different from a fresh Home screenshot.

---

# P1 — living world instead of waiting room

## M. World Incidents

Ambient motion is good. Add semantic events that Barkly can notice.

Examples:

- squirrel crosses Park;
- pigeon lands in Town;
- bakery crumb drops;
- wave carries something in;
- gull steals/eyes an object;
- someone passes Home window;
- lamp clicks on;
- distant bark;
- ball rolls;
- Biscuit arrives/leaves;
- Duke storms off;
- weather/thunder later.

Some incidents are pure flavor. Some are tappable. Some become memory/story material.

The key difference: a moving cloud decorates the world; a squirrel Barkly notices makes him seem alive.

## N. NPC agency

NPCs should not exist only after a tap.

They should be able to:

- arrive/leave;
- initiate a greeting;
- ask for a favor;
- interrupt a location with a situation;
- react to each other;
- react to Barkly's possessions/routines/reputation;
- remember last specific incident;
- bring back unresolved business.

## O. NPC-to-NPC relationships

The town cannot revolve entirely around Barkly.

Examples:

- Biscuit is intimidated by Duke;
- Pepper tolerates Duke but respects one thing about him;
- Biscuit tells Pepper something Barkly did;
- Duke resents Biscuit siding with Barkly;
- relationships change after shared incidents.

This creates the promised tiny soap opera.

## P. Deeper locations, not more locations

Do not add twenty generic tabs.

Make the four existing places mechanically distinct:

- **Home:** intimacy, training, personal conversation, possessions, rest, memories.
- **Park:** social chaos, Biscuit/Duke, fetch, dig, contests, incidents.
- **Town:** Pepper, observation, bakery/pigeons, gossip, local social events.
- **Beach:** physical play, waves, sand, unique finds, gulls/tide incidents.

Add a location only when it supports a genuinely new relationship/world loop.

---

# P1 — direct physical interaction

## Q. Gesture play

Expand the correct move away from PLAY/FEED/SLEEP buttons.

- drag/throw the ball;
- hold and pull the rope;
- drag/select special food with physical confirmation;
- contextual pet regions;
- tap/hold treasure on shelf;
- tap bed/spot;
- tap world incident.

Touch location should matter where understandable:

- head pet;
- ear touch;
- back rub;
- paw touch reaction;
- belly rub while lying down later.

Do not turn this into hidden-gesture frustration. Affordances can be taught by Barkly looking/moving, subtle object motion and first-use hints.

## R. Training v2

Current routines are a real differentiator. Expand carefully:

- pauses/timing;
- repeated beats;
- intensity;
- routine chaining;
- user naming/renaming;
- Barkly naming/renaming later;
- favorite/signature routine;
- imperfect early performance / mastery where fun;
- NPC reputation from repeated public performance.

Share-worthy target: "Look what I taught my Barkly."

---

# P2 — retention, growth and shipping foundations

## S. Shareable Barkly moments

Build a lightweight "Barkly Reel" / memory-card output for naturally good moments, not referral spam.

Candidate triggers:

- learned routine;
- signature ritual;
- first nemesis/best-friend promotion;
- ridiculous treasure;
- Barkly-created nickname;
- story resolution;
- contest upset;
- bizarre dream later.

Output should be visually Barkly-native and easy to save/share.

## T. Personalized dreams

A short dream scene can remix the day's actual inputs:

- steak moon;
- giant Duke;
- rubber duck army;
- user's custom routine;
- weird treasure;
- Beach/waves.

Dreams should be personalized state combinations, not random prewritten cutscenes.

## U. Return-from-absence scenes

No guilt, no "you abandoned me" engagement manipulation.

Use actual unfinished context:

- "You missed the pigeon situation."
- "Duke came by. I handled it badly."
- "I kept thinking about Steve."

The return greeting system already exists; evolve it from elapsed-time flavor into history-based continuation.

## V. Privacy-conscious product analytics before external beta

Do **not** log private conversation contents as generic analytics.

Useful events:

- session start/end;
- onboarding steps/complete;
- first conversation/pet/feed/play;
- routine taught/used;
- NPC relationship promotion;
- encounter entered/choice made;
- contest played;
- Pack Book opened;
- Plan completed;
- location visited;
- shop purchase/equip;
- return day/session.

Questions to answer:

- where do players stop in first 20 minutes?
- does teaching a routine correlate with next-day return?
- do retained players use relationships/Pack Book more?
- which world verbs actually get repeated voluntarily?

## W. Save schema versioning and migrations

Barkly's moat is his history. Treat persisted state as sacred.

Before state grows much further, introduce explicit schema versions and deterministic migrations for durable profile domains. Never silently reset incompatible relationship/memory/object history.

Test migrations with real old fixtures / playtester saves.

## X. Longitudinal simulation tests

Add simulation coverage beyond unit correctness:

- day 1;
- day 30;
- day 100;
- day 365;
- huge fact/memory counts;
- all NPC rungs;
- repeated story resolution;
- old-save migration;
- preferences changing without thrashing;
- no duplicate/corrupt relationship identities.

## Y. Accessibility next pass

Existing a11y discipline is good. Add explicit coverage for:

- Dynamic Type / larger text;
- Reduce Motion;
- motion-independent state communication;
- high-contrast/system accessibility where practical;
- gesture alternatives for direct-manipulation actions.

## Z. Break up `BarklyRoom.tsx` before the next giant feature wave

The screen currently orchestrates too many concerns.

Suggested extraction boundaries:

- `WorldStage`
- `StageMotionController`
- `BarklyInteractionController`
- `NPCStage`
- `NoticeLayer`
- `ConversationControls`
- `SurfaceRouter`

Also replace the collection of mutually exclusive sheet booleans with one typed surface state where practical.

Do this as a behavior-preserving refactor with screenshot/acceptance coverage, not a simultaneous redesign.

---

# Things we should deliberately NOT chase right now

- generic endless runner;
- match-3;
- generic minigame count as a KPI;
- battle pass;
- streak pressure;
- random loot boxes/chests;
- leaderboards;
- many currencies;
- 50 costume recolors;
- 20 shallow locations;
- "AI can see your camera" as the marketing hook by itself;
- generic chatbot assistant behavior.

Camera later should be **Teach Barkly your real world**, not generic object detection: show him an object, name it, build a relationship/routine around that specific real thing.

---

# Marketing/product test

The app should produce moments that can be described as:

- **"Look what I taught my Barkly."**
- **"This idiot remembers why he hates Duke."**
- **"My Barkly named this stupid rock and now it has lore."**

Do not lead consumer positioning with "AI virtual pet." AI is machinery.

The emotional proposition is closer to:

- **No two Barklys grow up the same.**
- **Teach him things you'll regret.**
- **Raise a little menace.**

Long-term physical continuation remains:

> **Give your Barkly a body.**

The physical product must inherit the Barkly the user already raised rather than resetting identity.

---

# Definition of "better" for Claude's continuation

A change is good when it makes at least one of these more true:

1. Barkly physically reacts instead of UI explaining.
2. History produces a visible consequence.
3. Different player behavior produces a different Barkly.
4. Existing systems collide to create new outcomes.
5. The world keeps moving without demanding chores.
6. A screenshot/video looks like a designed toy/game universe, not a web app.
7. A player has a story worth telling another person.
8. The code preserves durable history safely enough that attachment is not a liability.

If a feature adds another menu but does none of those, question it hard.
