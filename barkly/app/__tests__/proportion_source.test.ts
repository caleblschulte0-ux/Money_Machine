/*
 * ONE SET OF PROPORTIONS, AND BOTH PACKS DRAW TO IT.
 *
 * Sibling of `palette_source.test.ts`, and for the same reason. The palette
 * pass made every place share a colour and a light and the world still did
 * not look like one game, because the FORMS were honestly proportioned: a
 * lamp post that measured like a lamp post, a bench with six evenly spaced
 * slats, a tree trunk that tapered gently into five identical canopy balls.
 * The reference draws what a thing reads as at thumbnail size, not what it
 * measures, and `tools/blender/proportion.py` is where that read lives.
 *
 * The specific drift this guards is the park. The park is the one location
 * rendered as a single composed PLATE, so `world_scene_pack.py` carries its
 * own tree and its own bench next to the modular ones in
 * `world_prop_pack.py`. Two trees proportioned by two different hands is
 * exactly how one game starts looking like two, and it is invisible in
 * review because each file is internally consistent.
 *
 * The numbers themselves are checked by `python3 scripts/proportion.py`
 * against the form every builder records. This checks the thing a rendered
 * measurement cannot: that both packs are still reading from the same file.
 */
declare const require: (m: string) => any;
declare const __dirname: string;
const { readFileSync } = require('fs') as { readFileSync: (p: string, enc: string) => string };
const { join } = require('path') as { join: (...p: string[]) => string };

const DIR = join(__dirname, '..', 'tools', 'blender');
const read = (f: string) => readFileSync(join(DIR, f), 'utf8');

describe('both render packs proportion from one file', () => {
  test.each(['world_prop_pack.py', 'world_scene_pack.py'])(
    '%s imports the dials rather than restating them',
    (file: string) => {
      expect(read(file)).toMatch(/^from proportion import /m);
    },
  );

  test('the dials are declared once, in proportion.py', () => {
    const dials = ['OVERHANG', 'TAPER', 'FLARE', 'BITE', 'STOUT'];
    const source = read('proportion.py');
    for (const dial of dials) {
      expect(source).toMatch(new RegExp(`^${dial} = `, 'm'));
    }
    // ...and nowhere else. A pack that assigns its own OVERHANG has forked
    // the art direction, which is the failure this whole file is about.
    for (const file of ['world_prop_pack.py', 'world_scene_pack.py', 'home_prop_pack.py']) {
      for (const dial of dials) {
        expect(read(file)).not.toMatch(new RegExp(`^${dial} = `, 'm'));
      }
    }
  });

  test('the park plate uses the shared helpers on its tree', () => {
    // Not a style preference: `_tree` and `_bench` in the scene pack ARE
    // park/tree.png and park/bench.png at plate scale.
    const scene = read('world_scene_pack.py');
    const tree = scene.slice(scene.indexOf('def _tree('), scene.indexOf('def _bench('));
    expect(tree).toMatch(/\bshaft\(/);
    expect(tree).toMatch(/\bcrown\(/);
    expect(tree).toMatch(/\bstack\(/);
  });

  test('every primitive records its form, or the gate measures a subset', () => {
    // `scripts/proportion.py` reads what `_record` logged. A helper that
    // returns `obj` instead of `_record(obj)` drops that part out of the
    // silhouette silently, and the numbers still look plausible.
    const pack = read('world_prop_pack.py');
    const builders = ['def cube(', 'def sphere(', 'def cylinder(', 'def cone(', 'def torus(', 'def metablob('];
    for (const head of builders) {
      const start = pack.indexOf(head);
      expect(start).toBeGreaterThan(-1);
      const body = pack.slice(start, pack.indexOf('\ndef ', start + 1));
      expect(body).toContain('return _record(obj)');
    }
  });
});

/*
 * ONE INK, AND EVERY PLACE THAT DRAWS IT READS THE SAME FILE.
 *
 * Three different steps put a dark edge on this game's art, for three good
 * reasons: `scripts/promote-props.py` grows the OUTER edge off a shipped
 * PNG's alpha (only that step knows the final pixel size), the prop packs draw
 * the INTERNAL edges with Freestyle at render time (only they know where one
 * part of a prop stops and the next begins), and the scene pack draws both
 * because a plate is opaque edge to edge with no alpha to dilate.
 *
 * Three steps is fine. Three opinions about the colour, the width, and what
 * counts as atmosphere is not -- that is how the world ends up with two darks
 * in it. `tools/blender/ink.py` holds the rules and this holds everyone to it.
 *
 * The internal edges exist because of the operator's read on the first contact
 * sheet: the lamp post and the fountain hit the target and the rest did not.
 * Those two are tiered, and every tier meets the next at a hard break in a
 * different material, which reads as a line. A tree was one smooth green mass,
 * because an alpha dilation can only ever see the outside of a thing.
 */
describe('one ink, read from one file', () => {
  const readTool = (f: string) => readFileSync(join(DIR, f), 'utf8');
  const readScript = (f: string) =>
    readFileSync(join(DIR, '..', '..', 'scripts', f), 'utf8');

  test.each(['world_prop_pack.py', 'world_scene_pack.py'])(
    '%s takes the ink from ink.py',
    (file: string) => {
      expect(readTool(file)).toMatch(/^from ink import /m);
    },
  );

  it('promote-props takes the colour, the width and the exemptions from it', () => {
    const src = readScript('promote-props.py');
    expect(src).toMatch(/^from ink import /m);
    // ...and states none of them itself.
    expect(src).not.toMatch(/^CONTOUR_EXEMPT/m);
    expect(src).not.toMatch(/^def contour_width/m);
  });

  it('ink.py is the only file that names the edge colour', () => {
    expect(readTool('ink.py')).toMatch(/^INK = tone\("ink", "deep"\)$/m);
    for (const file of ['world_prop_pack.py', 'world_scene_pack.py', 'home_prop_pack.py']) {
      const src = readTool(file);
      const lines = src.split('\n').filter((l: string) => /linestyle\.color|CONTOUR_RGB/.test(l));
      for (const line of lines) {
        expect({ file, line, usesShared: /\bINK\b/.test(line) }).toEqual({ file, line, usesShared: true });
      }
    }
  });

  it('the things thinner than the line are kept out of it', () => {
    // A grass blade is a few pixels wide at render size; inked on both sides
    // it fills in solid, and near_grass came out as a row of black spikes.
    const src = readTool('world_prop_pack.py');
    const list = src.slice(src.indexOf('INK_SKIP_WORDS = ('), src.indexOf(')', src.indexOf('INK_SKIP_WORDS = (')));
    for (const word of ['glint', 'blade', 'stem', 'grass']) {
      expect({ word, listed: list.includes(`"${word}"`) }).toEqual({ word, listed: true });
    }
  });
});
