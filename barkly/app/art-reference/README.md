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

## Approval rule

Only put an image here after the operator explicitly chooses it as a direction. Experimental AI generations belong outside this folder. The target can be replaced later when art direction changes; production code never imports these files.

## Current art direction

- Premium toy-diorama / candy-mobile-game finish.
- Warm, physically believable lighting rather than flat gradients.
- Barkly remains the emotional hero.
- More screen means more world, not larger chrome.
- UI and scenery share one material grammar: confident base, darker molded edge, controlled highlight, contact shadow.
- The recent glossy concept is deliberately an **upper bound**: production should move strongly toward it without becoming over-rendered or visually noisy.
