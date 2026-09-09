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
