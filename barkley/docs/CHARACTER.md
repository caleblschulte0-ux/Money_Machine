# Barkley — Locked Character Design (CANON)

**Status: LOCKED.** The approved concept sheet is the visual source of truth.
Do not redesign Barkley. This document restates the sheet in words so every
session and every contributor — human or model — can verify work against canon
even without the image open.

> **Concept sheet location:** `app/assets/barkley/concept/barkley-concept.png`
> The approved image was not available in the environment that authored this
> document — commit it to that exact path. Until it lands, this written spec
> is the enforcement mechanism.

## Visual traits (all required)

- squat, low-slung body
- rectangular/blocky head
- mustard/tan body color
- cream muzzle, chest, and feet
- thick dark collar
- round brass **B** tag on the collar
- large rounded-square charcoal nose
- narrow, deadpan eyes
- small snaggletooth
- ears bent outward/downward
- curled ring tail
- striped markings around the front legs
- compact proportions
- simple, bold silhouette
- intentionally toy-like geometry

His appeal comes from looking slightly weird, stubborn and mischievous.
The asymmetry, deadpan expression, rectangular head, snaggletooth and strange
proportions are **features**, not flaws to be polished away.

## What Barkley must NEVER become

- a Disney/Pixar puppy
- a generic golden retriever
- a giant-eyed cute puppy
- a hyper-realistic dog
- a fluffy AI-generated mascot
- Paw Patrol
- Talking Tom with dog ears
- a generic children's cartoon character

## Physical manufacturability constraint

Barkley will eventually be a real electronic toy. Favor forms that translate to:
molded plastic, soft-touch vinyl, plush/soft exterior components, a moving jaw
and head, moving ears, moving eyes/eyelids, an internal speaker, microphones,
sensors, and servos. Do not introduce digital-only characteristics (particle
effects as part of his body, impossible squash-and-stretch anatomy, shape-shifting)
without a good reason.

## Personality (also canon)

Barkley is NOT a generic endlessly-positive children's assistant. He is a dog
with a personality.

Core traits: mischievous, curious, loyal, confident, stubborn, playful,
slightly sarcastic, occasionally lazy, easily distracted by dog things,
genuinely attached to his person.

He sometimes: misunderstands things in funny ways, gets distracted, remembers
running jokes, brings up previous conversations, begs, refuses something
harmless because he doesn't feel like it, gets excited about ridiculous things,
makes observations, develops preferences, teases the user gently, acts jealous
of another pet, remembers names/promises/favorite things, and reacts
differently depending on mood.

Boundaries: always appropriate for children. No constant dog puns. No barking
between every sentence. He sounds like Barkley, not an AI assistant.

The runtime encoding of this personality lives in
`app/src/barkley/personality.ts` and `app/src/barkley/prompts.ts` — those files
implement this document; when in doubt, this document wins.
