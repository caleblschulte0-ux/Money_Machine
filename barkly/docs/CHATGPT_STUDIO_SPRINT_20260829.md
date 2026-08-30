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

# P0 now: stop looking like generated app UI

Read `barkly/docs/VISUAL_DIRECTION_KIDS_GAME.md` before changing any player-facing surface.

The current biggest product risk is that increasingly sophisticated Barkly systems are still capable of being presented with the visual grammar of a generated React app: cream cards, rounded pills, flat vectors, equal-width rows and generic modal sheets.

The target is a **bright, toy-like, polished kids game**. A screenshot should read as a game from five feet away, before anybody sees Barkly speak.

The ChatGPT branch now includes a cosmetic wave for Claude to review/rework:

- a candy/toy global theme instead of cream-on-cream;
- stronger molded elevation and gloss hierarchy;
- a colored molded `DialoguePanel` rather than a white speech card;
- a colorful `StoreSheet` toy shelf;
- a colorful `FoodSheet` snack tray;
- Barkly's Plan as a bright kid-made artifact;
- encounters as physical colorful choice moments over the visible world;
- contests as bright arcade-style dog duel HUDs while retaining the tested timing engine;
- `ToyHud.tsx`, a reviewable main-screen replacement prototype with four illustrated destination tiles, a physical mini Pack Book, a taped Plan note, a toy settings control and molded coin pod.

`ToyHud.tsx` is deliberately not jammed into the 60KB `BarklyRoom.tsx` without the normal viewport pass. Wire/rework it there, delete the old segmented-tabs presentation, and verify the five standard phone sizes before accepting it.

Cosmetic rejection test:

- If it could belong to a finance app after removing Barkly, redesign it.
- If the main read is beige/white rounded rectangles, redesign it.
- If color is the only state cue, redesign it.
- If a child needs to read a paragraph to find the fun thing, redesign it.
- If the art does not look like the same physical universe as Barkly, redesign it.

---

# Already implemented in this ChatGPT branch

## Real product fixes

### Local calendar day

Barkly's Plan now rolls over on the player's actual local calendar date rather than UTC midnight.

### Treasure attachment

Newest find no longer automatically means favorite. Character state now carries durable treasure affinity, old saves backfill the previous favorite without rerolling Barkly's identity, and later systems have one `noteTreasureAffinity()` path for strengthening attachment.

### Pack Book presentation

Pack Book has moved away from raw scores/dashboard language toward scrapbook evidence: stamps, memories, receipts, rituals and current drama.

### Onboarding continuity

First launch happens in Barkly's actual Home scene rather than a disposable gradient world.

---

# New large-scale systems for Claude to integrate

## Barkly Identity Engine — `barkly/identity.ts`

History-derived identity instead of a personality picker. It produces formed preferences, Barkly's own opinions, personality axes and evidence receipts from the actual relationship history.

It should eventually affect:
- dialogue
- idle behavior
- Plan generation
- room composition
- story triggers
- Barkly's reactions
- Pack Book presentation

## Barkly Co-Authorship — `barkly/coauthor.ts`

Once the player has authored enough history, Barkly starts proposing canon back:
- naming a treasured object;
- declaring a frequently visited place “our spot”;
- declaring a repeated cue “our thing”;
- giving a recurring dog a private nickname.

Player accepts/rejects. Either answer is durable. The same proposal does not nag forever.

This is the concrete implementation of:

> User authors Barkly, then Barkly starts co-authoring the relationship.

## Autonomous World Incidents — `world/incidents.ts`

History can create world beats without the user tapping an NPC first:
- Duke notices a treasured object;
- Biscuit needs help;
- Pepper has heard about a private routine;
- gull treasure chaos;
- private rituals leaking into public life.

Includes cooldown/durable-choice state so this does not become a notification machine.

## Home-as-Biography — `world/biography.ts`

Relationship history can become a curated set of physical room evidence:
- favorite treasure display;
- Biscuit photo;
- Duke dossier;
- ritual award;
- current-saga souvenir.

The room should become a biography, not an inventory dump.

## Story Engine v2 — `barkly/storyV2.ts`

Persistent branching sagas with:
- durable chapters;
- route/decision state;
- consequences;
- finales;
- resolved-story archive.

Resolved stories must not silently reset to Chapter I.

---

# P0 remaining illusion breaks

## Barkly Rig v3

Preserve the exact approved Barkly design. Expand the layered rig beyond current front-pose head/ears/pupils/body control.

Independent targets:
- tail
- front-left paw
- front-right paw
- rear/body mass
- chest
- muzzle/jaw
- neck/head
- ears
- eyelids/pupils

Rig at least front and three-quarter poses.

Desired behaviors:
- eyes lead head
- one-ear perk / ear flick
- paw bowl
- brace during tug
- watch thrown object
- play bow
- stretch
- scratch
- sit unevenly
- recoil annoyed
- lean into petting
- independent tail
- sleepy eyelids
- stronger speech mouth

## Unique NPC bodies

Biscuit, Pepper and Duke must stop being recolored Barkly variants.

Same toy universe, distinct silhouettes:
- Biscuit: lanky/smaller, huge floppy ears, big paws, goofy open stance.
- Pepper: sleek/narrow, smaller elegant ears, composed skeptical face.
- Duke: stockier, wide chest, heavier muzzle, proud brow/stance.

Give each a different movement personality too.

## Real soundscape

Add physical SFX/ambience rather than constant music:
- paws by surface
- collar jingle
- bowl clink
- crunch/chew
- squeaky ball
- rope friction
- digging
- bed rustle
- body shake
- Home/Park/Town/Beach ambience
- gulls/waves/bakery/park life

Duck ambience slightly under Barkly speech.

## Authored diorama art

The current code-drawn scenes are technically improved but remain a visual ceiling. Major environment assets should gradually become authored molded/clay/vinyl diorama pieces that look manufactured from the same physical world as Barkly. Continue layering/animating them programmatically.

---

# Make history visible

## Object identity

Meaningful possessions should accumulate:
- acquiredAt
- use count
- stories/contests
- Barkly affinity
- nickname
- visible wear
- lost/recovered state
- NPC interactions

A ball should be able to become **The Ball**.

## Emergent favorites

Build sticky preference scoring for:
- treasure
- toy
- food
- location
- NPC
- sleeping spot
- routine

Favorites may change slowly from evidence, not every session.

## Barkly opinions

Separate Barkly's persistent opinions from facts about the player.
Examples:
- loves cheese
- distrusts pigeons
- thinks the Beach is overrated
- trusts Pepper
- thinks Duke is insecure

Opinions should evolve through experience.

---

# Story Engine v2 integration

Persist story state through the existing hydrated controller/save layer:
- arc ID
- chapter
- route
- trigger
- cast
- possessions/memories involved
- decisions
- consequences
- next beats
- resolution
- souvenir
- resolved archive

Example treasure saga:
1. Duke insults treasured object.
2. Object disappears.
3. Biscuit had it “for protection.”
4. Player chooses forgive / blame / security protocol.
5. Resolution creates lasting relationship changes + a room souvenir.
6. Barkly later references it naturally.

---

# Autonomous world / NPC agency

Integrate `world/incidents.ts` and build staging for semantic incidents:
- squirrel runs by
- gull eyes treasure
- Biscuit arrives with a problem
- Duke notices favorite object
- Pepper heard about a private routine
- bakery drops crumb
- wave exposes something
- shadow passes Home window

Some are ambient, some become choices, some create memory/story.

NPCs should eventually:
- arrive and leave on their own
- interact with each other
- develop NPC-to-NPC relationships
- remember prior incidents

---

# Direct manipulation

Continue replacing abstract buttons with physical gestures:
- drag/throw ball
- grab/pull rope
- pet specific body regions
- drag special food toward Barkly
- pick treasure off room shelf

Barkly should react to HOW and WHERE the player touched, not merely that a verb fired.

---

# Training v2

Current reusable custom routines are a differentiator. Extend carefully:
- pauses/timing
- repeated beats
- intensity/speed variants
- Barkly making small early mistakes
- mastery through repetition
- private vs public routine reputation
- routines affecting NPC encounters and stories

Keep choreography device-agnostic so it can later drive physical Barkly.

---

# Shareability / growth

Build Barkly-native share moments rather than referral spam.

Potential Barkly Reel moments:
- ridiculous learned routine
- Nemesis promotion
- weird treasure
- relationship archetype
- story resolution
- Barkly-created nickname/tradition
- contest upset

Marketing should sell consequence rather than “AI”:
- Your dog learns your weirdness.
- No two Barklys grow up the same.
- Teach him things you'll regret.
- Raise a little menace.

Later physical extension:
> **Give your Barkly a body.**

---

# Engineering guardrails

## Save schema

History is the moat. Add explicit schema versioning and deterministic migrations before new persistent systems land.

Never silently discard old memories, relationships, stories, preferences or routines.

## Hydration

Continue using the existing hydration gate. No new store writes defaults before load completes.

## Controller decomposition

`useBarkly.ts` and `BarklyRoom.tsx` are large orchestration surfaces. Before another tightly coupled feature wave, extract coherent subsystems rather than adding independent booleans/timers.

Suggested boundaries:
- world/incident controller
- story controller
- identity/preference controller
- stage motion controller
- surface router
- NPC stage
- world HUD

## Analytics

Before external beta, add privacy-conscious product events only. Do not collect raw conversation contents as product analytics.

Useful events:
- onboarding complete
- first talk/pet/feed/play
- first NPC
- routine taught/repeated
- encounter/choice
- contest
- Pack Book opened
- Plan completed
- purchase
- location visit
- return day

---

# QA / simulation

Add longitudinal state simulation:
- Day 1
- Day 30
- Day 100
- Day 365

Check:
- contradictory preferences/opinions
- duplicate memories
- stuck stories
- save migration
- relationship coherence
- huge fact/memory lists
- old resolved arcs restarting
- favorites thrashing

Visual acceptance must cover the existing five phone sizes. Also test Reduce Motion and larger text.

---

# Do not redo already-solved work

Do not spend a sprint rebuilding these from scratch unless there is a regression:
- action row removed
- in-world bowl/toy/bed
- haptics
- voice + typing
- mute moved out of header
- FoodSheet wired
- Home purchases visible
- rope/ball behavior
- Barkly enlarged/grounded
- collar rendering
- Beach
- contest mechanics
- relationship ladders
- learned routines
- current voice bank/dialect foundation
- accessibility/layout testing

---

# Final quality questions

Before calling a feature done:

1. Did we add a menu, or make Barkly/the world more alive?
2. Can the player SEE the consequence?
3. Does Barkly physically react?
4. Does it change future history?
5. Will two long-term users experience it differently?
6. Would someone screen-record it and send it?
7. Does this screen look like a polished kids game from five feet away?
8. Could it belong to a finance app if Barkly disappeared? If yes, redesign it.

Goal:

> **Make people forget they are interacting with software for a minute.**
