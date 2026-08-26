# Barkly — Locked Character Design (CANON)

**Status: LOCKED.** The approved concept sheet ("Barkley – Concept 3") is the
visual source of truth and is committed at
**`app/assets/barkly/concept/barkly-concept.png`**. Do not redesign Barkly.
This document restates the sheet in words so any session can verify work
against canon without the image open. If this text and the sheet ever
disagree, the sheet wins.

> Note on spelling: the concept sheet is titled "Barkley"; the product and
> code use the operator's spelling **Barkly**. Same dog.

## From the sheet

Barkly is a **terrier-beagle mix with a mischievous deadpan streak and a nose
for trouble** — rendered as a collectible vinyl/clay toy: soft surfaces, no
outlines, bold silhouette, satisfying to hold.

Trait list (verbatim from the sheet):

- rectangular head
- long nose with rounded square tip
- stiff, bent ears that angle outward
- tiny snaggletooth
- thick collar
- striped knit-sock markings on front paws
- ring-shaped tail curl
- low-slung body

Additional reads from the artwork:

- **the head dominates** — it is wider than the body and roughly half the
  character's height
- cream **blaze** runs down the center of the face into a long, broad cream
  muzzle; mustard patches around the eyes and head sides
- **huge charcoal-brown rounded-square nose** sitting on the muzzle
- **smug half-lidded eyes**: solid dark pills with heavy flat upper lids
  tilted slightly down-outward
- thick dark-brown **belt-style collar with a brass buckle**, strap end, and
  a round brass **B** tag on a ring
- cream chest/belly; front legs in cream "knit socks" with **three** charcoal
  stripes; feet with toe grooves
- standing on four short, stout legs (front view is the app's default)

## Color palette (from the sheet)

| Name | Use | Approx |
|---|---|---|
| Mustard tan | body, head, ears (deeper) | `#C6952F` / ears `#AF7F22` |
| Cream | blaze, muzzle, chest, socks, feet | `#F1E6CB` |
| Charcoal | nose, sock stripes, eyes | `#3E332A` / `#35302A` |
| Collar brown | collar | `#4B3527` |
| Brass | buckle, tag | `#B98F3E` |

## What Barkly must NEVER become

- a Disney/Pixar puppy
- a generic golden retriever
- a giant-eyed cute puppy
- a hyper-realistic dog
- a fluffy AI-generated mascot
- Paw Patrol
- Talking Tom with dog ears
- a generic children's cartoon character

His asymmetry, deadpan expression, rectangular head, snaggletooth and strange
proportions are **features**, not flaws to be polished away.

## Physical manufacturability constraint

Barkly will be a real electronic toy. The sheet's footer says it plainly:
collectible toy character, bold silhouette, solid + sturdy feel, made to stand
out on any shelf. Favor forms that translate to molded plastic, soft-touch
vinyl, plush components, a moving jaw and head, moving ears, moving
eyes/eyelids, an internal speaker, microphones, sensors, and servos. No
digital-only characteristics without a good reason.

## Personality (also canon)

Barkly is NOT a generic endlessly-positive children's assistant. He is a dog
with a personality: mischievous, curious, loyal, confident, stubborn, playful,
slightly sarcastic, occasionally lazy, easily distracted by dog things,
genuinely attached to his person.

He sometimes: misunderstands things in funny ways, gets distracted, remembers
running jokes, brings up previous conversations, begs, refuses something
harmless because he doesn't feel like it, gets excited about ridiculous
things, makes observations, develops preferences, teases the user gently,
acts jealous of another pet, remembers names/promises/favorite things, and
reacts differently depending on mood.

Boundaries: always appropriate for children. No constant dog puns. No barking
between every sentence. He sounds like Barkly, not an AI assistant.

The runtime encoding of this personality lives in
`app/src/barkly/personality.ts` and `app/src/barkly/prompts.ts` — those files
implement this document; when in doubt, this document (and the sheet) win.
