// The figures a visitor can place, by id. Sizes are true scale: the point of
// a world-locked figure is walking around something the size it really is.
//
// Each figure has a real 3D model (glTF, meshopt-compressed, for any device
// with a glTF loader; USDZ for Apple's AR Quick Look), made from openly
// licensed sources recorded here and in ori_tour/CREDITS.md, plus a stand-in
// drawn in code (src/web/figures3d.ts) that a browser shows if the model
// fails to load. A figure makes no claim about any real person or place.

import type { FigureSpec } from "./anchoring.ts";

export interface FigureModel {
  /** glTF binary, relative to the app root. */
  glb: string;
  /** USDZ for AR Quick Look (iPhone), relative to the app root. */
  usdz: string;
  /** Turn that makes the model's front look down -z (this code's convention), degrees about +y. */
  frontYawDeg: number;
  /** Tint for a model with no colour texture (the bare scan), as 0xRRGGBB, or null. */
  tint: number | null;
  /** Looping clip to play while it stands, if the model has one. */
  idleClip: string | null;
}

export interface FigureInfo extends FigureSpec {
  /** Who made the model, where it comes from, and its licence. Shown to visitors. */
  credit: string;
  /** Licence name ("CC0 1.0", "CC BY 4.0"). */
  licence: string;
  /** The source page the licence was checked on. */
  sourceUrl: string;
  model: string;
  file: FigureModel;
  /** Download budgets, bytes, for a phone on a cell connection. test/figures.test.ts holds the files to them. */
  budgetBytes: { glb: number; usdz: number };
}

export const FIGURES: readonly FigureInfo[] = [
  {
    id: "mammoth",
    name: "mammoth",
    model: "mammoth",
    // the specimen's own measured size: 3.44 m tall, 5.08 m long (Smithsonian scan, units in metres)
    heightM: 3.44,
    footprintM: 2.6,
    yawDeg: 90,
    credit:
      'Woolly mammoth skeleton, "Mammuthus primigenius (Blumbach)", USNM V23792: 3D scan by the Smithsonian Institution, National Museum of Natural History. Public domain (CC0).',
    licence: "CC0 1.0",
    sourceUrl: "https://3d.si.edu/object/3d/mammuthus-primigenius-blumbach:341c96cd-f967-4540-8ed1-d3fc56d31f12",
    file: {
      glb: "assets/figures/mammoth-skeleton.glb",
      usdz: "assets/figures/mammoth-skeleton.usdz",
      frontYawDeg: 180, // the scan faces +z (checked: tools/build_figures.mjs --views)
      tint: 0xd9ccb0,
      idleClip: null,
    },
    budgetBytes: { glb: 2_000_000, usdz: 3_600_000 },
  },
  {
    id: "mammoth-calf",
    name: "mammoth calf",
    model: "mammoth-calf",
    // the model as published: about 2 m long and 1.28 m tall, calf proportions
    heightM: 1.28,
    footprintM: 1.0,
    yawDeg: 90,
    credit:
      '"3D High-poly Baby Woolly Mammoth" by SDPM Esare, CC BY 4.0; rigged and animated by the Prehistoric Animal Museum project (github.com/s010s/prehistoric-animal-museum), CC BY 4.0. A life restoration, not a specimen.',
    licence: "CC BY 4.0",
    sourceUrl: "https://sketchfab.com/3d-models/3d-high-poly-baby-woolly-mammoth-fce1c86ccedf47a5b9627098be6719d5",
    file: {
      glb: "assets/figures/mammoth-calf.glb",
      usdz: "assets/figures/mammoth-calf.usdz",
      frontYawDeg: -90, // the model faces -x (checked: tools/build_figures.mjs --views)
      tint: null,
      idleClip: "Idle",
    },
    budgetBytes: { glb: 1_300_000, usdz: 2_100_000 },
  },
  {
    id: "settler",
    name: "settler",
    model: "settler",
    heightM: 1.75,
    footprintM: 0.4,
    yawDeg: 0,
    credit:
      'Stylized frontier figure ("Cowboy_Male") from the "Ultimate Animated Character Pack" by Quaternius, CC0. Represents no real person; not a period-accurate costume.',
    licence: "CC0 1.0",
    sourceUrl: "https://quaternius.com/packs/ultimatedanimatedcharacter.html",
    file: {
      glb: "assets/figures/settler.glb",
      usdz: "assets/figures/settler.usdz",
      frontYawDeg: 180, // the model faces +z (checked: tools/build_figures.mjs --views)
      tint: null,
      idleClip: "Idle",
    },
    budgetBytes: { glb: 400_000, usdz: 700_000 },
  },
];

export const figureById = (id: string): FigureInfo | undefined => FIGURES.find((f) => f.id === id);
