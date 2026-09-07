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
    ['HEADLAND_ASPECT', 'beach', 'headland.png'],
    ['SHELLS_ASPECT', 'beach', 'shells.png'],
    ['MARRAM_ASPECT', 'beach', 'dune_grass.png'],
    ['SURF_ASPECT', 'beach', 'surf.png'],
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

  /*
   * The clouds are not a location's props -- park, town and beach share one
   * `SceneSky` -- so they live in `assets/world/sky/` and need their own
   * reader. Same rule: the declared aspect is a claim about a file on disk.
   */
  for (const [name, file] of [
    ['CLOUD_ASPECT', 'cloud.png'],
    ['CLOUD_FAR_ASPECT', 'cloud_far.png'],
  ] as [string, string][]) {
    it(`${name} is what sky/${file} actually is`, () => {
      const real = pngAspectAt('assets', 'world', 'sky', file);
      expect(Math.abs(declaredAspect(name) - real)).toBeLessThan(0.02);
    });
  }

  /*
   * The window vista, same rule as every other render: its height is derived
   * from its width and this aspect. It shipped for one build drawn with
   * `resizeMode="stretch"` into the leftover pane, which squashed a 2.43:1
   * landscape into a nearly square hole and smeared its two trees into the
   * ridge -- the dig mound's bug from the other direction.
   */
  it('VISTA_ASPECT is what home/vista.png actually is', () => {
    const real = pngAspectAt('assets', 'world', 'home', 'props', 'vista.png');
    expect(Math.abs(declaredAspect('VISTA_ASPECT', homeSource()) - real)).toBeLessThan(0.02);
  });

  /*
   * THE FLOOR IS DRAWN, AND THAT IS THE RIGHT ANSWER -- but it shipped with
   * six plank lines 90pt apart on a 390pt screen and four horizontals crossing
   * them, so the room read as a grid of four big tiles. A rendered course was
   * built and rejected (a cross-laid course with staggered butt joints is
   * running bond, which is masonry however the proportions are tuned), so
   * these hold the two parameters that were actually wrong.
   */
  it('draws a floor of boards rather than a grid of tiles', () => {
    const src = homeSource();
    const m = /Array\.from\(\{ length: (\d+) \}, \(_, i\) => \(i \+ 0\.5\) \* \(420 \/ (\d+)\)\)/.exec(src);
    if (!m) throw new Error('the floor no longer generates its plank lines from one count');
    const count = Number(m[1]);
    expect(Number(m[2])).toEqual(count);
    // At the wall the boards must be narrower than a tenth of the room. Six
    // lines in a 420 viewBox put them at 72 units -- 17% of the floor each.
    expect(420 / count).toBeLessThan(42);
    // And no horizontal rules: those were what made the squares.
    expect(src).not.toMatch(/d=\{`M0 \$\{y\}H420`\}/);
  });

  it('draws no hand-drawn landscape behind the window glass any more', () => {
    const src = homeSource();
    const pane = src.slice(src.indexOf('<Svg width={apertureW}'), src.indexOf('windowGlint'));
    // The three SVG bands and four ellipse "trees" the vista replaced. The sun
    // and moon stay -- they are lights with a RadialGlow behind them, not a
    // landscape.
    expect(pane).not.toContain('<Ellipse');
    expect(pane.match(/<Path/g) ?? []).toHaveLength(1);
    expect(pane).toContain('source={VISTA}');
  });

  /*
   * NO IMAGE MAY BE SIZED BY AN INSET STYLE ALONE.
   *
   * `styles.fill` is `position: absolute` with all four insets and no width.
   * That constrains a View. It does NOT constrain an Image:
   * react-native-web renders one as a div carrying the PNG's own intrinsic
   * dimensions, and those win over the insets. The two clouds shipped that way
   * for one build -- wrappers a correct 140x36 and 90x23, the images inside
   * them 536x137 and 361x93, the files' pixel sizes -- so the sky filled with
   * cloud and the sun went from 6,927 lit pixels to 160. Nothing failed: the
   * wrapper measured right, the asset was right, and the aspect locks passed
   * because the aspect WAS correct. It was four times too big.
   *
   * The rule that catches it: an Image's own style must carry a width. Not a
   * substitute for looking at the render, but this one is invisible in a
   * diff, which is exactly what a test is for.
   */
  it('never sizes an Image by insets alone', () => {
    const files = [
      ['src', 'ui', 'scenes', 'OutdoorRenderedScenes.tsx'],
      ['src', 'ui', 'scenes', 'HomeRenderedScene.tsx'],
    ];
    const offenders: string[] = [];
    for (const parts of files) {
      const src = readFileSync(join(ROOT, ...parts)).toString();
      // Every <Image ...> tag, however it is broken across lines.
      for (const m of src.matchAll(/<Image\b[\s\S]*?\/>/g)) {
        const tag = m[0];
        if (!/\bwidth\b/.test(tag)) offenders.push(`${parts[parts.length - 1]}: ${tag.slice(0, 90)}`);
      }
    }
    expect(offenders).toEqual([]);
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

  it('keeps the beach scatter clear of its badges and his face', () => {
    /*
     * Same geometry as the park's check, against the beach's own boxes. Both
     * sets are `scripts/blocking.mjs` output at 390x844, and the face column
     * and dog top are `scripts/prop-clear-check.mjs`. `sandTop` is `tide + 15`
     * and `tide` is `horizon + 120`, with horizon clamped to 172..210 -- so
     * the sand starts between 307 and 345, and every value in between is a
     * live frame. Sweeping the range, because checking the two ends of a clamp
     * only finds the worst case when the worst case is at an end.
     */
    const src = source();
    const table = src.slice(src.indexOf('const BEACH_COVER'), src.indexOf('];', src.indexOf('const BEACH_COVER')));
    const cover = [...table.matchAll(/\{ fx: ([\d.]+), dy: (\d+), s: ([\d.]+)[^}]*?(flower: true)?\s*\}/g)].map((m) => ({
      fx: Number(m[1]),
      dy: Number(m[2]),
      s: Number(m[3]),
      flower: Boolean(m[4]),
    }));
    expect(cover.length).toBeGreaterThan(5);

    const WIDTH = 390;
    const LABELS = [
      { name: 'BISCUIT', x0: 50, x1: 114, y0: 620, y1: 638 },
      { name: 'SIFT', x0: 59, x1: 105, y0: 453, y1: 471 },
    ];
    const FACE = { x0: 162, x1: 226, y0: 419, y1: 497 };
    const DOG_TOP = 387;
    const MARGIN = 12;
    const shells = declaredAspect('SHELLS_ASPECT');
    const marram = declaredAspect('MARRAM_ASPECT');

    const clashes: string[] = [];
    for (let horizon = 172; horizon <= 210; horizon += 2) {
      const sandTop = horizon + 135;
      for (const c of cover) {
        const w = (c.flower ? 54 : 58) * c.s;
        const h = w / (c.flower ? marram : shells);
        const left = WIDTH * c.fx - w / 2;
        const bottom = sandTop + c.dy;
        const box = { x0: left, x1: left + w, y0: bottom - h, y1: bottom };
        for (const label of LABELS) {
          if (box.x1 > label.x0 && box.x0 < label.x1 && box.y1 > label.y0 && box.y0 < label.y1) {
            clashes.push(`horizon ${horizon}: fx ${c.fx} dy ${c.dy} covers ${label.name}`);
          }
        }
        if (
          box.x1 > FACE.x0 - MARGIN &&
          box.x0 < FACE.x1 + MARGIN &&
          box.y1 > FACE.y0 &&
          box.y0 < FACE.y1 &&
          box.y0 < DOG_TOP
        ) {
          clashes.push(`horizon ${horizon}: fx ${c.fx} dy ${c.dy} crosses his face`);
        }
      }
    }
    expect(clashes).toEqual([]);
  });

  it('never buries a piece of beach scatter inside another prop', () => {
    /*
     * The third distinct way this has gone wrong, so it is written down too.
     * `scripts/blocking.mjs` fails a small prop that sits inside a bigger one
     * at the same distance -- not depth, clutter -- and a shell at fx 0.94
     * landed 100% inside the right-hand dune.
     *
     * Boxes are that gate's own output for BEACH at 390x844. Only the big
     * ones matter: a shell overlapping another shell is not what it catches.
     */
    const PROPS = [
      { name: 'lifeguard', x0: 9, x1: 156, y0: 221, y1: 450, base: 450 },
      { name: 'umbrella', x0: 256, x1: 408, y0: 242, y1: 449, base: 449 },
      { name: 'dune left', x0: -105, x1: 50, y0: 438, y1: 533, base: 533 },
      { name: 'dune right', x0: 298, x1: 437, y0: 478, y1: 564, base: 564 },
      { name: 'castle', x0: 271, x1: 381, y0: 464, y1: 610, base: 610 },
    ];
    const src = source();
    const table = src.slice(src.indexOf('const BEACH_COVER'), src.indexOf('];', src.indexOf('const BEACH_COVER')));
    const cover = [...table.matchAll(/\{ fx: ([\d.]+), dy: (\d+), s: ([\d.]+)[^}]*?(flower: true)?\s*\}/g)].map((m) => ({
      fx: Number(m[1]),
      dy: Number(m[2]),
      s: Number(m[3]),
      flower: Boolean(m[4]),
    }));
    const shells = declaredAspect('SHELLS_ASPECT');
    const marram = declaredAspect('MARRAM_ASPECT');
    const buried: string[] = [];
    for (let horizon = 172; horizon <= 210; horizon += 2) {
      const sandTop = horizon + 135;
      for (const c of cover) {
        const w = (c.flower ? 54 : 58) * c.s;
        const h = w / (c.flower ? marram : shells);
        const left = 390 * c.fx - w / 2;
        const base = sandTop + c.dy;
        for (const prop of PROPS) {
          const inside = Math.max(0, Math.min(prop.x1, left + w) - Math.max(prop.x0, left)) / w;
          // "Same distance" is what makes it clutter rather than depth.
          const sameDistance = Math.abs(base - prop.base) < 44;
          if (inside > 0.6 && sameDistance) {
            buried.push(`horizon ${horizon}: fx ${c.fx} dy ${c.dy} is ${Math.round(inside * 100)}% inside ${prop.name}`);
          }
        }
      }
    }
    expect(buried).toEqual([]);
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
