# Barkly art-production toolbox

This branch is infrastructure only. It exists so visual work can be built and judged off to the side before anything touches the playable branch.

## Goal

Move Barkly from “good React Native screen” to a cohesive premium toy-diorama game without guessing from JSX.

The production loop is:

1. **Reference** — approve a visual target (concept render, material board, or one hero screenshot).
2. **Build** — implement on an isolated `chatgpt/barkly-art-*` branch.
3. **Render** — capture the real app at phone, landscape, and tablet sizes.
4. **Motion** — record a short real-app clip so animation/transition quality is judged too.
5. **Audit** — check image dimensions/file weight and reject accidental asset bloat.
6. **Review twice** — first for visual quality, second for code/release cleanliness.
7. **Ship** — only after the real CI, visual matrix, motion review, and playtest acceptance are clean.

## Existing tools we already have

- Expo / React Native web build artifact.
- Playwright browser rendering.
- responsive overlap/collision checking.
- accessibility checking.
- voice checking.
- real automated playtest acceptance.
- world screenshots.
- Barkly render processing and derived face/collar frames.
- a renderer contract that can later host Rive, Spine, Live2D, sprites, or 3D without changing Barkly’s brain.

## Added by this toolbox

### `scripts/asset-audit.mjs`

Scans production art assets and reports PNG dimensions, byte weight, suspicious names, and oversized files. It fails only on clear production mistakes; aesthetic judgment remains human/vision review.

### `scripts/art-matrix.mjs`

Builds a real visual review matrix:

- Home at 360×640
- Home at 390×844
- Home at 430×932
- Home at 667×375
- Home at 768×1024
- Home at 1024×768
- Park / Town / Beach at the canonical 390×844 portrait size

It also writes `art-review/index.html`, a contact sheet so the whole device matrix can be judged at once.

### `scripts/motion-review.mjs`

Records a short 390×844 WebM of the actual app idling and moving between locations. This catches the class of problems screenshots cannot: dead motion, abrupt swaps, weak easing, and UI/world transitions that do not feel premium.

### `.github/workflows/barkly-art-toolbox.yml`

Runs the toolbox on isolated art branches and uploads one review artifact containing screenshots, the contact sheet, motion video, and the asset-audit report.

## Visual target

The current target is **not** “maximum gloss everywhere.” It is roughly 70–80% of the premium candy/toy concept direction:

- Barkly remains the emotional hero.
- warm molded toy materials.
- one coherent lighting direction.
- clear foreground / Barkly / midground / background planes.
- chunky silhouettes and beveled physical UI.
- controlled highlights rather than universal glow.
- compact UI that does not steal the stage.
- animation, squash/rebound, parallax, and reaction beats used selectively.

## Asset strategy

Use three levels, in this order:

1. **Layered 2D + React Native motion** for most UI/world work. Fast, light, and good enough for a premium fake-3D look.
2. **Pre-rendered character/prop frames** when a piece needs richer material realism than vectors can provide.
3. **Rive (preferred) or another rigged renderer** when Barkly’s body animation becomes the limiting factor. The renderer seam already exists.

A full real-time 3D rewrite is not required to hit the intended quality bar and should not be the default solution.

## What the operator needs to provide

Nothing is required to start building premium visual work. ChatGPT can generate concept/asset candidates, edit code, create isolated branches, run the review harness, and ship verified work through GitHub.

Helpful but optional later:

- approve one hero-screen reference as the canonical art-direction target;
- connect Figma if a conventional editable design handoff becomes useful;
- use a Rive/Spine authoring workflow if we decide Barkly needs a true articulated production rig rather than render swaps.

No paid image API key is required for the current build-review loop because concept and asset generation can happen interactively before assets are committed.
