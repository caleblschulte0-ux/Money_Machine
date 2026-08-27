# Barkly handoff package — for ChatGPT

Drop these into a ChatGPT conversation. Everything is self-contained; ChatGPT
needs no repo access.

## What to attach

| File | Why |
|---|---|
| `BARKLY_FOR_CHATGPT.md` | **The brief.** Product, locked character, everything built, honest gaps, and the specific asks. Attach this first. |
| `barkly-concept.png` | The locked character sheet — the visual reference for any art it generates. |
| `screenshots/*.png` | The app actually running. Attach as many as you like; `02`, `05`, and `06` show the most. |
| `CODE_SNAPSHOT.md` | Every source file concatenated. Only needed if you want a code review. |

## Suggested opening message

> Here's the full brief for Barkly, an AI virtual dog app I'm building
> (`BARKLY_FOR_CHATGPT.md`), the locked character sheet you originally
> generated, and screenshots of it running. Read the brief, then:
> 1. Generate the nine pose renders described in §7a, matching the sheet exactly.
> 2. Give me the honest product review in §7b.

If ChatGPT can only take one file, `BARKLY_FOR_CHATGPT.md` plus the concept
sheet is enough for the art ask.

## Keeping it fresh

Run `./build_handoff.sh` from this directory after any significant change: it
regenerates `CODE_SNAPSHOT.md` from live source, refreshes the concept-sheet
copy, and rebuilds the zip. `BARKLY_FOR_CHATGPT.md` is hand-written — edit it
by hand when the product changes.

(The zip and the concept-sheet copy are build outputs and aren't committed;
everything else here is.)
