/**
 * Every surface render has a shape, and the scenes state it as a literal.
 *
 * `OutdoorRenderedScenes` sizes each piece of cover by width and derives its
 * height from an aspect ratio written next to the `require`. That ratio is a
 * copy of the PNG's own dimensions, and a copy drifts: re-render the treeline
 * a little taller and the declared 640/119 silently stretches it across the
 * horizon. Same guard the shop's item art gets, for the same reason.
 *
 * The second test is the one that matters more. `scripts/blocking.mjs` fails
 * the build when scenery covers a name plate or a control badge, but it runs
 * against a rendered page and takes minutes; this reproduces its geometry from
 * the source in under a second, so the placement table can be edited without
 * finding out at the end of a build battery. It caught two clashes in the
 * first authored pass -- which is the whole reason it exists.
 */

declare const require: (m: string) => any;
declare const __dirname: string;

type Bytes = { readUInt32BE: (offset: number) => number; toString: () => string };
const { readFileSync } = require('fs') as { readFileSync: (p: string) => Bytes };
const { join } = require('path') as { join: (...p: string[]) => string };

const ROOT = join(__dirname, '..');
const SCENE = join(ROOT, 'src', 'ui', 'scenes', 'OutdoorRenderedScenes.tsx');
const source = () => readFileSync(SCENE).toString();

function pngAspect(place: string, file: string): number {
  const buf = readFileSync(join(ROOT, 'assets', 'world', place, 'props', file));
  return buf.readUInt32BE(16) / buf.readUInt32BE(20);
}

function declaredAspect(name: string, where = source()): number {
  const m = new RegExp(`const ${name} = (\\d+) / (\\d+);`).exec(where);
  if (!m) throw new Error(`${name} is not declared as W / H any more`);
  return Number(m[1]) / Number(m[2]);
}

const homeSource = () =>
  readFileSync(join(ROOT, 'src', 'ui', 'scenes', 'HomeRenderedScene.tsx')).toString();

function pngAspectAt(...parts: string[]): number {
  const buf = readFileSync(join(ROOT, ...parts));
  return buf.readUInt32BE(16) / buf.readUInt32BE(20);
}

describe('scene surface renders', () => {
  // Every surface render the scenes size by width and derive height for.
  const cases: [string, string, string][] = [
    ['TREELINE_ASPECT', 'park', 'treeline.png'],
    ['TUFT_ASPECT', 'park', 'grass_tuft.png'],
    ['FLOWERS_ASPECT', 'park', 'wildflowers.png'],
    ['CLUMP_ASPECT', 'park', 'grass_clump.png'],
    ['ROOFTOPS_ASPECT', 'town', 'rooftops.png'],
    ['KERB_ASPECT', 'town', 'kerb.png'],
    ['PAVING_ASPECT', 'town', 'paving.png'],
  ];

  for (const [name, place, file] of cases) {
    it(`${name} is what ${file} actually is`, () => {
      expect(Math.abs(declaredAspect(name) - pngAspect(place, file))).toBeLessThan(0.02);
    });
  }

  /*
   * EVERY DERIVED HEIGHT IN THE APP, HELD AGAINST ITS FILE.
   *
   * These used to be hand-typed width/height PAIRS, and one of them was
   * already wrong when this test was written: the dig site was drawn at
   * 118x47 while its render is 529x165, so it shipped squashed by 22%. A typed
   * height cannot be checked against anything, which is why nothing caught it.
   * Every one of them is a width plus the render's own aspect now, and this is
   * what makes that worth doing.
   */
  const derived: [string, string, string[]][] = [
    ['kit_bowl', 'src/ui/BarklyKit.tsx', ['assets', 'world', 'item', 'kit_bowl.png']],
    ['kit_stick', 'src/ui/BarklyKit.tsx', ['assets', 'world', 'item', 'kit_stick.png']],
    ['toy_ball', 'src/ui/BarklyKit.tsx', ['assets', 'world', 'item', 'toy_ball.png']],
    ['toy_rope', 'src/ui/BarklyKit.tsx', ['assets', 'world', 'item', 'toy_rope.png']],
    ['bed', 'src/ui/BarklyKit.tsx', ['assets', 'world', 'home', 'props', 'bed.png']],
  ];
  for (const [name, file, asset] of derived) {
    it(`the care tray draws ${name} at the shape it is`, () => {
      const src = readFileSync(join(ROOT, ...file.split('/'))).toString();
      const m = new RegExp(`${name}\\.png'\\),[^}]*?aspect: (\\d+) / (\\d+)`).exec(src);
      if (!m) throw new Error(`${name} no longer declares its aspect as W / H`);
      expect(Math.abs(Number(m[1]) / Number(m[2]) - pngAspectAt(...asset))).toBeLessThan(0.02);
    });
  }

  it('the stage draws the dig mound and the ball at the shape they are', () => {
    const src = readFileSync(join(ROOT, 'src', 'ui', 'StageProps.tsx')).toString();
    const pairs: [string, string[]][] = [
      ['MOUND_ASPECT', ['assets', 'world', 'park', 'props', 'dig_mound.png']],
      ['MOUND_ASPECT', ['assets', 'world', 'beach', 'props', 'sand_mound.png']],
      ['BALL_ASPECT', ['assets', 'world', 'item', 'toy_ball.png']],
    ];
    for (const [name, asset] of pairs) {
      const m = new RegExp(`const ${name} = (\\d+) / (\\d+);`).exec(src);
      if (!m) throw new Error(`${name} no longer declares its aspect as W / H`);
      expect(Math.abs(Number(m[1]) / Number(m[2]) - pngAspectAt(...asset))).toBeLessThan(0.02);
    }
  });

  it('keeps every paving course above the name-plate band', () => {
    /*
     * MEASURED, NOT REASONED FROM THE CLAMP.
     *
     * The first version of this test computed the courses' position from
     * `Math.max(372, ground - 116)` by taking the 372, and passed a placement
     * that `scripts/blocking.mjs` then failed: a course landed at y 624..642,
     * which is PEPPER's plate exactly. On a 390x844 frame the real value is
     * 529 -- read straight off that gate's own output, where the kerb (which
     * hangs off `sidewalk`) measures y 509..533.
     *
     * So this uses the measurement, with margin, like every other box here.
     */
    const src = source();
    const table = src.slice(
      src.indexOf('const TOWN_PAVING_COURSES'),
      src.indexOf('];', src.indexOf('const TOWN_PAVING_COURSES')),
    );
    const courses = [...table.matchAll(/\{ dy: (\d+), w: ([\d.]+)/g)].map((m) => ({
      dy: Number(m[1]),
      w: Number(m[2]),
    }));
    expect(courses.length).toBeGreaterThan(1);

    const WIDTH = 390;
    const SIDEWALK = 529;
    const PEPPER_TOP = 624;
    const MARGIN = 10;
    const aspect = declaredAspect('PAVING_ASPECT');
    const low: string[] = [];
    for (const c of courses) {
      // worldScale is a little over 1 on a 390pt frame; 1.1 is a safe bound.
      const bottom = SIDEWALK + c.dy * 1.1 + (WIDTH * c.w) / aspect;
      if (bottom > PEPPER_TOP - MARGIN) {
        low.push(`course dy ${c.dy} ends at y ${Math.round(bottom)}, into the plate band`);
      }
    }
    expect(low).toEqual([]);
  });

  // The home scene declares its own; same rule, different file.
  for (const [name, file] of [
    ['SKIRTING_ASPECT', 'skirting.png'],
    ['PANELLING_ASPECT', 'panelling.png'],
  ] as [string, string][]) {
    it(`${name} is what ${file} actually is`, () => {
      expect(Math.abs(declaredAspect(name, homeSource()) - pngAspect('home', file))).toBeLessThan(0.02);
    });
  }

  it('keeps every piece of cover clear of the labels the blocking gate protects', () => {
    const src = source();
    const table = src.slice(src.indexOf('const PARK_COVER'), src.indexOf('];', src.indexOf('const PARK_COVER')));
    const cover = [...table.matchAll(/\{ fx: ([\d.]+), dy: (\d+), s: ([\d.]+)[^}]*?(flower: true)?\s*\}/g)].map((m) => ({
      fx: Number(m[1]),
      dy: Number(m[2]),
      s: Number(m[3]),
      flower: Boolean(m[4]),
    }));
    expect(cover.length).toBeGreaterThan(8);

    // Measured by scripts/blocking.mjs at 390x844, in that frame's own points.
    const WIDTH = 390;
    // And by scripts/prop-clear-check.mjs, which is the gate that actually
    // failed on the first authored pass: a tuft at fx 0.44 covered 65% of his
    // face column. Both frames it reports are checked, scaled to this one.
    const FACE = [
      { at: 390, x0: 162, x1: 226, y0: 419, y1: 497 },
      { at: 430, x0: 184, x1: 250, y0: 462, y1: 547 },
    ];
    const LABELS = [
      { name: 'BISCUIT', x0: 50, x1: 114, y0: 620, y1: 638 },
      { name: 'DUKE', x0: 295, x1: 344, y0: 625, y1: 643 },
      { name: 'DIG', x0: 61, x1: 102, y0: 453, y1: 471 },
    ];

    // The scene's own arithmetic: `horizon` is clamped, so both ends are live
    // frames and both have to be clear.
    const clashes: string[] = [];
    for (const horizon of [148, 184]) {
      for (const c of cover) {
        const w = (c.flower ? 74 : 92) * c.s;
        const h = w / (c.flower ? declaredAspect('FLOWERS_ASPECT') : declaredAspect('TUFT_ASPECT'));
        const left = WIDTH * c.fx - w / 2;
        const bottom = horizon + c.dy;
        const box = { x0: left, x1: left + w, y0: bottom - h, y1: bottom };
        for (const label of LABELS) {
          if (box.x1 > label.x0 && box.x0 < label.x1 && box.y1 > label.y0 && box.y0 < label.y1) {
            clashes.push(
              `horizon ${horizon}: cover at fx ${c.fx} dy ${c.dy} ` +
                `(${Math.round(box.x0)}..${Math.round(box.x1)} x ${Math.round(box.y0)}..${Math.round(box.y1)}) ` +
                `covers ${label.name}`,
            );
          }
        }
      }
    }
    expect(clashes).toEqual([]);
  });

  it('never puts a piece of cover across his face', () => {
    const src = source();
    const table = src.slice(src.indexOf('const PARK_COVER'), src.indexOf('];', src.indexOf('const PARK_COVER')));
    const cover = [...table.matchAll(/\{ fx: ([\d.]+), dy: (\d+), s: ([\d.]+)[^}]*?(flower: true)?\s*\}/g)].map((m) => ({
      fx: Number(m[1]),
      dy: Number(m[2]),
      s: Number(m[3]),
      flower: Boolean(m[4]),
    }));

    /*
     * The same three conditions scripts/prop-clear-check.mjs applies, because
     * a looser rule here would be a different rule, and a stricter one would
     * ban the thing the scene is FOR. Scenery may pass behind him -- that is
     * depth. What it may not do is rise above his head and cross his face.
     *
     * Boxes measured by that gate and by scripts/blocking.mjs at the two
     * frames they both report.
     */
    const FRAMES = [
      { at: 390, face: { x0: 162, x1: 226, y0: 419, y1: 497 }, dogTop: 387 },
      { at: 430, face: { x0: 184, x1: 250, y0: 462, y1: 547 }, dogTop: 427 },
    ];
    /*
     * MARGIN, AND EVERY HORIZON IN BETWEEN.
     *
     * Both of those were learned from a failure this test had already passed.
     * The wildflowers at fx 0.36 came out at 118.94..161.86 against a face
     * column starting at 162 -- clear by fourteen hundredths of a pixel -- and
     * the gate failed anyway, because the sprite's measured column had moved
     * four pixels between builds. And it only failed at ONE horizon: 179, an
     * interior value this test was not sampling, because checking the two ends
     * of a clamp only finds the worst case when the worst case is at an end.
     */
    const MARGIN = 12;
    const onHisFace: string[] = [];
    for (const frame of FRAMES) {
      const k = frame.at / 390;
      for (let horizon = 148; horizon <= 184; horizon += 3) {
        for (const c of cover) {
          const w = (c.flower ? 74 : 92) * c.s * k;
          const h = w / (c.flower ? declaredAspect('FLOWERS_ASPECT') : declaredAspect('TUFT_ASPECT'));
          const left = frame.at * c.fx - w / 2;
          const bottom = (horizon + c.dy) * k;
          const top = bottom - h;
          const crossesX = left + w > frame.face.x0 - MARGIN && left < frame.face.x1 + MARGIN;
          const reachesFace = bottom > frame.face.y0 && top < frame.face.y1;
          const risesAboveHim = top < frame.dogTop;
          if (crossesX && reachesFace && risesAboveHim) {
            onHisFace.push(`${frame.at}pt horizon ${horizon}: cover at fx ${c.fx} dy ${c.dy}`);
          }
        }
      }
    }
    expect(onHisFace).toEqual([]);
  });
});
