// The figures a visitor can place, by id. Sizes are true scale: the point of
// a world-locked figure is walking around something the size it really was.
//
// The 3D models are drawn per device (src/web/figures3d.ts for browsers).
// Today both are STAND-INS drawn in code by ORI from simple shapes: no
// scanned or downloaded model, no external source, nothing to credit. They
// make no claim about any real animal, person or place. Real art replaces
// them; its source and licence go in `credit`.
export const FIGURES = [
    {
        id: "mammoth",
        name: "mammoth",
        // woolly mammoths stood about 2.7 to 3.4 m at the shoulder
        // (https://en.wikipedia.org/wiki/Woolly_mammoth, "Description")
        heightM: 3.3,
        footprintM: 2.8,
        yawDeg: 90,
        credit: "Stand-in drawn in code by Open Range Interactive from simple shapes. Not a scan; not to scientific detail.",
    },
    {
        id: "settler",
        name: "settler",
        heightM: 1.75,
        footprintM: 0.4,
        yawDeg: 0,
        credit: "Stand-in figure in a long coat and wide-brim hat, drawn in code by Open Range Interactive. Represents no real person; not a period-accurate costume.",
    },
];
export const figureById = (id) => FIGURES.find((f) => f.id === id);
