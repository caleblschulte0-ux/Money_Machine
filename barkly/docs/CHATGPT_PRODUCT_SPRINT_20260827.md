# ChatGPT Product Sprint — 2026-08-27

## Claude: review this as PRODUCT work, not release-hardening work

This sprint intentionally changed priority. The operator asked to stop spending the current cycle on App Store/engineering hardening and instead make Barkly materially more special, polished and defensible as a product.

Everything remains isolated on `chatgpt/barkly-appstore-hardening-20260827`. Do not merge it blindly. The point is to give you a large, coherent product pass to inspect, edit, rewrite or cherry-pick.

---

# Product thesis

**Barkly is not an AI chatbot shaped like a dog. He is a dog who becomes different because of what you do together.**

Talking is commodity. The moat is accumulated relationship state that changes the creature: private routines, rituals, recurring friendships and rivalries, favorite junk, grudges, shared stories and a personality another user cannot reproduce by downloading the same app.

See `docs/PRODUCT_IDENTITY.md` for the full product playbook.

---

# What this sprint built

## 1. Relationship DNA

New: `app/src/barkly/relationship.ts`

Barkly now derives a legible identity from actual history rather than selecting a personality at onboarding.

### Bond stages

- Just Met
- Buddies
- Packmates
- Best Friends
- Basically Family

### Emergent traits

Traits only appear after enough evidence exists. A fresh Barkly has no fake day-one labels.

- Knows your lore
- Actually trained
- Adventure-brained
- Treasure goblin
- Dog-park politician
- Velcro dog

### Archetypes

The strongest real traits combine into a one-line identity such as:

- Coach & Confidant
- Adventure Academy
- Treasure School
- Certified Menaces
- Velcro Apprentice
- Neighborhood Gossips
- Dirt-Digging Legends
- Park Regulars
- Two-Person Pack

These are derived, not randomly awarded.

## 2. The Pack Book

New: `app/src/ui/PackBookSheet.tsx`

There is now a first-class PACK button in the main room header. It opens a relationship yearbook showing:

- current bond stage
- archetype/tagline
- emerged traits
- active saga
- private rituals
- recurring social lore
- core memories

The important UX idea is that the relationship is visible as a product object. A kid should be able to show a friend the Pack Book and immediately prove their Barkly is different.

## 3. Multi-step custom routines

Updated:

- `app/src/barkly/types.ts`
- `app/src/barkly/training.ts`
- `app/src/barkly/dialogue.ts`
- `app/src/hooks/useBarkly.ts`
- `app/src/barkly/prompts.ts`

A user can now teach ordered choreography, not just one static trick.

Example:

> When I say showtime, spin, sit, then play dead.

This becomes a persisted ordered routine. When `showtime` is said later, Barkly performs each beat in order using the existing single voice/body lifecycle. The repeated cue does not require another dialogue-model call.

The representation remains device-agnostic. That is intentional: the same RoutineBeat sequence should eventually drive physical Barkly servos and speaker.

## 4. Private rituals

A taught cue used repeatedly stops being presented merely as “a command.”

- 2+ uses: it becomes a private ritual in the Pack Book.
- 6+ uses: it becomes a signature tradition.

This is a product framing decision: repetition should create lore, not just increment counters.

## 5. Evolving NPC relationships

Updated: `app/src/barkly/character.ts`

Biscuit, Duke, etc. now accumulate persistent encounter history.

Friends evolve:

1. park acquaintance
2. actual buddy
3. best friend
4. pack family

Rivals evolve:

1. annoying dog
2. official rival
3. nemesis
4. generational feud

These labels feed back into initiative and dialogue. Barkly can now say Duke is his nemesis because six bad encounters actually happened, rather than because a canned line called Duke a rival.

## 6. Treasure history became character history

Repeated digging is no longer only a minigame/currency source. Character state now tracks how many treasures Barkly has found and which one is the favorite. The Pack Book and story system use that history.

## 7. Emergent Story Engine — first layer

New: `app/src/barkly/story.ts`

This is NOT a fixed quest list. It names the strongest story implied by history the user already caused.

Current examples:

### The Duke Situation

If Barkly has a real recurring Duke rivalry and a favorite treasure, those two systems combine into an ongoing saga. Its chapter escalates as the rivalry escalates.

### Dog Park Politics

A meaningful friendship plus meaningful rivalry creates a social storyline with both recurring characters.

### The Bit Has Escaped Containment

A signature private routine plus recurring NPCs creates a story where Barkly’s private joke starts becoming part of his public reputation.

### The Museum of Questionable Objects

Repeated treasure hunting becomes a collection saga rather than six unrelated dig events.

The active saga is shown in the Pack Book AND included in relationship prompt context, so the live Barkly can naturally reference what is going on.

This is deliberately the first story layer. The next step should make these arcs interactive: choices, consequences, chapter persistence and NPC reactions.

---

# Why this is different

The main differentiation loop is now:

**do things → history accumulates → Barkly changes → relationships evolve → rituals form → systems combine into a story → Barkly talks differently because that story is true**

The intended result is that two users can run the same app for a month and end up with meaningfully different characters.

This is much harder to replace than coins, levels or chat history alone.

---

# Product review priorities for Claude

Please judge these questions more than code style:

1. Does Pack Book feel like a compelling proof of ownership/relationship, or too dashboard-like?
2. Are the archetype names strong enough to be shareable/brag-worthy?
3. Does 2-use ritual / 6-use signature feel right, or should rituals require more contextual repetition?
4. Is 4 beats enough for routine v1? I think yes; later timing/repeats can expand the language.
5. Should routine performance keep Barkly's spoken line on every beat, or should some beats be silent physical action?
6. Does the social ladder need explicit positive/negative choices, not merely repeated taps?
7. Story Engine v2 should probably be the next large sprint: persistent chapters + user choices + consequences.

---

# Tests added/updated

- `__tests__/training.test.ts` — custom choreography, exact ordered routine, offline execution
- `__tests__/character.test.ts` — friendship/rivalry progression and durable history
- `__tests__/relationship.test.ts` — earned traits, rituals, social lore, treasure identity
- `__tests__/story.test.ts` — generated sagas from real history
- `__tests__/prompts.test.ts` — relationship-aware prompt context and model-taught routine parsing

Run the full CI before taking the branch. Do not merge to main without review.
