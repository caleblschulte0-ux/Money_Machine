# Barkley character assets

Canon reference: [`../../../docs/CHARACTER.md`](../../../docs/CHARACTER.md) — the design is **locked**.

## Expected files

| Path | What | Status |
|---|---|---|
| `concept/barkley-concept.png` | The approved concept sheet (visual source of truth). | **MISSING — commit the approved image here.** It was not available in the environment that scaffolded this repo. |
| `rive/barkley.riv` | Production animated character (recommended path — see below). Inputs must mirror `src/barkley/types.ts`: one state-machine input per `BarkleyState`, one trigger per `BodyAction`. | not started |
| `sprites/` | Alternative: sprite-sheet frames per state, if Rive is not chosen. | not started |
| `audio/` | Barkley sound effects (grumble, single bark, snore) — optional polish. | not started |

## Current placeholder

Development rendering does not use image assets at all: `src/ui/BarkleyView.tsx`
draws a deliberately blocky Barkley from plain React Native Views, following the
locked traits (squat mustard body, rectangular head, cream muzzle, deadpan eyes,
snaggletooth, bent ears, ring tail, leg stripes, brass "B" tag). It exists so no
one wastes time polishing temporary art.

## Recommendation: Rive

For the MVP-to-production path, **Rive** is the recommended animation approach:

- Its state machines map 1:1 onto our `BarkleyState` + `BodyAction` model — the
  brain's outputs literally become Rive inputs, no translation layer.
- Tiny runtime, hardware-accelerated, first-class React Native/Expo support
  (`rive-react-native`), designer-friendly editor.
- The toy-like 2D geometry of the locked design suits Rive's vector rendering
  perfectly, and rigged vector parts (jaw, ears, eyelids, tail) mirror the
  servo layout of the eventual physical toy.

Live2D/Spine/3D remain viable behind the same `BarkleyRenderProps` contract
(`src/animation/renderer.ts`) if production art direction demands them.
