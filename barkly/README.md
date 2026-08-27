# Barkly

**An AI-powered virtual dog.** Launches first as a mobile app; the long-term plan
is a physical interactive toy driven by the same brain.

The product test, in one sentence:

> Does Barkly feel like a specific little dog you are getting to know,
> rather than ChatGPT wearing a dog skin?

## Layout

| Path | What it is |
|---|---|
| [`app/`](app/) | The React Native (Expo + TypeScript) mobile app — the MVP. Setup and run instructions in its README. |
| [`server/`](server/) | Backend proxy that holds the Anthropic key in production (the app never ships a key). |
| [`docs/CHARACTER.md`](docs/CHARACTER.md) | Barkly's **locked** character design. Canon. Do not redesign him. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture: brain/body split, provider adapters, memory, animation swap path, child-safety posture. |
| `app/assets/barkly/` | Character art slot — where the approved concept sheet and future animation assets go (documented in its README). |

## The one rule

Barkly's character design and personality are canon. The concept sheet is the
visual source of truth. He is squat, blocky, mustard-and-cream, deadpan,
snaggletoothed, stubborn and mischievous — **on purpose**. Any change that makes
him cuter, rounder, fluffier or more generic is a regression, not an improvement.
