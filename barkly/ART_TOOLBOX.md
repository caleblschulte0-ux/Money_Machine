# Barkly Art Toolbox

Free-only production tooling for pushing Barkly toward premium toy-diorama mobile-game polish without experimenting on the live app.

## Guardrails

- Build and review on `chatgpt/barkly-art-*` branches.
- No art-toolbox workflow deploys Pages or mutates the live Barkly branch.
- Do not add paid APIs, metered image services, hidden trials, or required subscriptions.
- Production art only moves to the playable branch after visual review + normal Barkly CI.

## Existing app review tools

- `scripts/overlap-check.mjs` — multi-device collision / visual-spacing contract.
- `scripts/a11y-check.mjs` — accessibility and target-size checks.
- `scripts/voice-check.mjs` — conversation/voice interaction checks.
- `scripts/playtest-acceptance.mjs` — automated real game playthrough.
- `scripts/world-art-snapshot.mjs` — canonical location screenshots.

## Art toolbox tools

- `scripts/asset-audit.mjs` — inventory and flag production image problems.
- `scripts/asset-intake.py` — trim, orient, resize, metadata-strip and optimize generated/raw PNG art using Pillow.
- `scripts/art-matrix.mjs` — render Home across six device classes plus Park/Town/Beach at canonical phone size.
- `scripts/reference-compare.py` — compare the real Home render with an explicitly approved target in `app/art-reference/home-target.png`.
- `scripts/material-lab.mjs` — render the Barkly material grammar before applying it everywhere.
- `scripts/juice-lab.mjs` — prototype button squash, reward pops, care nudges, conversation morphing and depth motion.
- `scripts/sfx-lab.py` — generate free/reproducible button pops, toy thuds, coin chimes, reward blooms and transition whooshes for timing/game-feel studies.
- `scripts/layout-debug.mjs` — overlay the real app with Barkly/UI hitboxes and clear-line references without changing app code.
- `scripts/performance-review.mjs` — collect headless frame pacing, long-task and memory trend signals on phone/tablet Home and Park.
- `scripts/motion-review.mjs` — record the real app moving through scenes at phone size.

## Generated-image intake

The Git-data path (`create blob → create tree → create commit → fast-forward isolated branch`) supports binary art, so ChatGPT-generated images can move into the isolated repo without making the operator manually download and re-upload them. `app/art-reference/upper-bound-gloss.jpg` is the proof artifact; it is deliberately compressed and explicitly **not** production art.

## 3D lab

`tools/blender/material_scene.py` uses free/open-source Blender in headless GitHub Actions. The lab is validated and already emits a real `.blend` file plus a rendered PNG. It can be extended into:

- pre-rendered toy props
- controlled lighting studies
- UI medallions / coins / reward objects
- furniture and environment pieces
- normal/depth/mask passes for fake-3D compositing

The workflow is `.github/workflows/barkly-blender-lab.yml` and does not run in the normal release path.

## CI artifacts

`.github/workflows/barkly-art-toolbox.yml` packages the device matrix, asset report, normalized-asset smoke test, reference comparison status, material lab, juice lab, procedural SFX studies, geometry overlays, frame-pacing report and real motion review into one artifact.

`.github/workflows/barkly-blender-lab.yml` packages Blender renders and the generated `.blend` study file separately.

## Useful local commands

From `barkly/app`:

- `npm run art:audit`
- `npm run art:matrix`
- `npm run art:materials`
- `npm run art:juice`
- `npm run art:sfx`
- `npm run art:debug-layout`
- `npm run art:performance`
- `npm run art:motion`

Python image tools require free Pillow (`python -m pip install Pillow`). CI installs it automatically. The SFX lab uses only Python's standard library. Blender is installed only in its isolated GitHub Actions workflow.

## What may require the operator later

Nothing is required for the current pipeline. Optional future additions may require a free account rather than money (for example an editable design/animation service). Do not make such a service mandatory when a local/open-source path can do the job.
