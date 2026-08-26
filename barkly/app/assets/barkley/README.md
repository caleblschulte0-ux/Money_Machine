# Barkly character assets

Canon reference: [`../../../docs/CHARACTER.md`](../../../docs/CHARACTER.md) — the design is **locked**.

## Expected files

| Path | What | Status |
|---|---|---|
| `concept/barkly-concept.png` | The approved concept sheet (visual source of truth). | **MISSING — commit the approved image here.** It was not available in the environment that scaffolded this repo. |
| `rive/barkly.riv` | Production animated character (recommended path — see below). Inputs must mirror `src/barkly/types.ts`: one state-machine input per `BarklyState`, one trigger per `BodyAction`. | not started |
| `sprites/` | Alternative: sprite-sheet frames per state, if Rive is not chosen. | not started |
| `audio/` | Barkly sound effects (grumble, single bark, snore) — optional polish. | not started |

## Current placeholder

Development rendering does not use image assets at all: `src/ui/BarklyView.tsx`
draws a deliberately blocky Barkly from plain React Native Views, following the
locked traits (squat mustard body, rectangular head, cream muzzle, deadpan eyes,
snaggletooth, bent ears, ring tail, leg stripes, brass "B" tag). It exists so no
one wastes time polishing temporary art.

## Recommendation: Rive

For the MVP-to-production path, **Rive** is the recommended animation approach:

- Its state machines map 1:1 onto our `BarklyState` + `BodyAction` model — the
  brain's outputs literally become Rive inputs, no translation layer.
- Tiny runtime, hardware-accelerated, first-class React Native/Expo support
  (`rive-react-native`), designer-friendly editor.
- The toy-like 2D geometry of the locked design suits Rive's vector rendering
  perfectly, and rigged vector parts (jaw, ears, eyelids, tail) mirror the
  servo layout of the eventual physical toy.

Live2D/Spine/3D remain viable behind the same `BarklyRenderProps` contract
(`src/animation/renderer.ts`) if production art direction demands them.
