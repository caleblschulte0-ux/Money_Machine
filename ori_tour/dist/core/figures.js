// The figures a visitor can place, by id. Sizes are true scale: the point of
// a world-locked figure is walking around something the size it really is.
//
// Each figure has a real 3D model (glTF, meshopt-compressed, for any device
// with a glTF loader; USDZ for Apple's AR Quick Look), made from openly
// licensed sources recorded here and in ori_tour/CREDITS.md, plus a stand-in
// drawn in code (src/web/figures3d.ts) that a browser shows if the model
// fails to load. A figure makes no claim about any real person or place.
export const FIGURES = [
    {
        id: "woolly-mammoth",
        name: "woolly mammoth",
        model: "woolly-mammoth",
        // The only openly licensed fleshed mammoth we found (CREDITS.md) is titled
        // a baby by its author but has adult proportions and tusks; shown here at
        // an adult woolly mammoth's shoulder height, about 3 m. Said in the credit.
        heightM: 3.0,
        footprintM: 2.3,
        yawDeg: 90,
        credit: 'Woolly mammoth, a life restoration: "3D High-poly Baby Woolly Mammoth" by SDPM Esare, CC BY 4.0, rigged and animated by the Prehistoric Animal Museum project (github.com/s010s/prehistoric-animal-museum), CC BY 4.0; shown by ORI at adult size (about 3 m at the shoulder).',
        licence: "CC BY 4.0",
        sourceUrl: "https://sketchfab.com/3d-models/3d-high-poly-baby-woolly-mammoth-fce1c86ccedf47a5b9627098be6719d5",
        file: {
            glb: "assets/figures/mammoth-calf.glb",
            usdz: "assets/figures/woolly-mammoth.usdz",
            frontYawDeg: -90, // the model faces -x (checked: tools/build_figures.mjs --views)
            tint: null,
            idleClip: "Idle",
        },
        budgetBytes: { glb: 1_300_000, usdz: 2_100_000 },
    },
    {
        id: "mammoth",
        name: "mammoth skeleton",
        model: "mammoth",
        // the specimen's own measured size: 3.44 m tall, 5.08 m long (Smithsonian scan, units in metres)
        heightM: 3.44,
        footprintM: 2.6,
        yawDeg: 90,
        credit: 'Woolly mammoth skeleton, "Mammuthus primigenius (Blumbach)", USNM V23792: 3D scan by the Smithsonian Institution, National Museum of Natural History. Public domain (CC0).',
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
        credit: '"3D High-poly Baby Woolly Mammoth" by SDPM Esare, CC BY 4.0; rigged and animated by the Prehistoric Animal Museum project (github.com/s010s/prehistoric-animal-museum), CC BY 4.0. A life restoration, not a specimen.',
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
        credit: 'Stylized frontier figure ("Cowboy_Male") from the "Ultimate Animated Character Pack" by Quaternius, CC0. Represents no real person; not a period-accurate costume.',
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
export const figureById = (id) => FIGURES.find((f) => f.id === id);
