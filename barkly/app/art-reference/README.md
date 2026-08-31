# Barkly approved visual targets

This folder is the visual source-of-truth shelf for art direction. It is intentionally separate from production assets.

## Canonical target

When a Home mockup is approved, save it here as:

`home-target.png`

The art-toolbox workflow will automatically compare it to the real `390x844` Home render and produce:

- target vs actual
- 50/50 overlay
- pixel-difference panel

Pixel difference is **not** a quality score. It is for composition: Barkly scale, HUD footprint, care-dock position, negative space, and major depth masses.

## Upper-bound concept

`upper-bound-gloss.jpg` is a tiny, deliberately compressed reference copied directly into GitHub through the binary Git-data pipeline. It proves ChatGPT-generated images can be moved into isolated repo work without making the operator manually transfer files. It is **not** the approved production target and must never be imported by the app.

## Approval rule

Only put an image at `home-target.png` after the operator explicitly chooses it as a direction. Experimental AI generations belong outside the canonical target slot. The target can be replaced later when art direction changes; production code never imports these files.

## Current art direction

- Premium toy-diorama / candy-mobile-game finish.
- Warm, physically believable lighting rather than flat gradients.
- Barkly remains the emotional hero.
- More screen means more world, not larger chrome.
- UI and scenery share one material grammar: confident base, darker molded edge, controlled highlight, contact shadow.
- The recent glossy concept is deliberately an **upper bound**: production should move strongly toward it without becoming over-rendered or visually noisy.
