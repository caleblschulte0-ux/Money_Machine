# Credits

Everything in this folder that ORI did not make, who made it, and the licence
it is used under. The figure list in `src/core/figures.ts` carries the same
credit line for each model and shows it to visitors; `test/figures.test.ts`
fails if a figure is missing from this file.

## 3D figures (`assets/figures/`)

### Woolly mammoth skeleton: `mammoth-skeleton.glb`, `mammoth-skeleton.usdz`

- **What:** a 3D scan of a mounted woolly mammoth skeleton, *Mammuthus
  primigenius* (Blumbach), USNM V23792, Smithsonian Institution, National
  Museum of Natural History. The specimen's own measured size: 3.44 m tall,
  5.08 m long.
- **Licence:** CC0 1.0 (public domain), as stated on the Smithsonian 3D
  object page: https://3d.si.edu/object/3d/mammuthus-primigenius-blumbach:341c96cd-f967-4540-8ed1-d3fc56d31f12
- **Where the file came from:** the cloud build machine cannot reach
  3d.si.edu, so the Smithsonian's own glTF export ("woolly-mammoth-100k-4096",
  generator MeshSmith) was taken from a public copy in
  `GoogleChromeLabs/css-web-ui-demos`, commit `dbb54120`,
  `html-in-canvas/public/assets/woolly-mammoth-100k-4096-gltf_std/`.
- **Changes:** meshopt-compressed; normal and occlusion maps converted to 2048 px
  WebP (the scan has no colour texture; the app tints it bone-coloured). The
  USDZ is the same model decimated to 60,000 triangles with its 2048 px normal
  map as JPEG, written by Blender through `tools/build_figures.mjs --usdz`.

### Woolly mammoth (fleshed) and mammoth calf: `mammoth-calf.glb`, `woolly-mammoth.usdz`, `mammoth-calf.usdz`

- **What:** "3D High-poly Baby Woolly Mammoth" by **SDPM Esare**, rigged and
  given an idle animation by the **Prehistoric Animal Museum** project. A life
  restoration (an artist's model), not a specimen.
- **Licence:** CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
  Source page: https://sketchfab.com/3d-models/3d-high-poly-baby-woolly-mammoth-fce1c86ccedf47a5b9627098be6719d5
  The rigged file is from `s010s/prehistoric-animal-museum` on GitHub, commit
  `3b8adfd3`, whose `LICENSING.md` keeps the models under CC BY 4.0.
- **Changes:** the material's metalness set to 0 and roughness to 0.9 (the file
  left metalness at the glTF default of 1, which drew the fur almost black).
  The USDZ keeps the full mesh, the 1024 px texture (as JPEG), the rig and the
  idle animation, written by Blender through `tools/build_figures.mjs --usdz`.
- **Two uses of one model:** "mammoth calf" shows it at the size it was
  published (1.28 m). "Woolly mammoth" shows the same model scaled to an adult
  woolly mammoth's shoulder height (about 3 m), because its proportions and
  tusks are an adult's and no openly licensed adult model exists that we could
  verify; the visitor-facing credit says it is shown at adult size.

### Settler: `settler.glb`, `settler.usdz`

- **What:** "Cowboy_Male" from the **Ultimate Animated Character Pack** by
  **Quaternius**. A stylised character; it represents no real person and is
  not a period-accurate costume.
- **Licence:** CC0 1.0, as stated on the pack page:
  https://quaternius.com/packs/ultimatedanimatedcharacter.html
- **Where the file came from:** a public copy of the pack in
  `AbrahamBrookes/hey-you-steal-that-bling`, commit `5b8a8c0d`,
  `stolen_assets/Quaternius-characters/`.
- **Changes:** materials merged into one palette texture and meshopt-compressed.
  The skin, clothes and animations are the artist's.

## Software

- **three.js** 0.186.1, MIT licence, bundled into `vendor/three.js` by
  `tools/vendor_three.mjs`; licence text in `vendor/three.LICENSE`.
- **Narration voice:** Kokoro-82M, Apache-2.0, run locally by
  `tools/make_narration.py`.

## Not used, and why

Searched 2026-10-07: Smithsonian Open Access, Sketchfab (CC0 and CC BY),
Poly Pizza, Quaternius, Kenney, Mixamo, GitHub.

- Kenchoo's "Mammoth" on Sketchfab: CC BY-NC-SA (non-commercial), so not usable
  by a company.
- Sketchfab "MAMMOTH" (5e0a1d6b…) and identical copies: the same mesh is
  posted by at least four accounts under CC BY, CC BY-SA and CC BY-NC, so the
  uploader's licence cannot be trusted.
- `ir-engine/ir-engine-assets-basic` WoolyMammoth.glb: no per-asset licence;
  it matches kenchoo's CC BY-NC-SA model.
- Other CC BY mammoths found were untextured fur tests, static statues of
  unclear origin, or over a million triangles.
- "RDR1 - John Marston": labelled CC BY but described as ripped from a game.
- No realistic, openly licensed 19th-century settler was found; the settler
  stays Quaternius's stylised figure.
