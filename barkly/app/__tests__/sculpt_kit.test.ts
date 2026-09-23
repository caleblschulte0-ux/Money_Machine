/*
 * THE SCULPT KIT CONTRACT.
 *
 * A sculpted scene (`world_scene_pack.py`, SCENE_STYLE) asks the kit
 * (`tools/sculpt/kit.py`) for each object by name. The kit is built in system
 * python with numpy + scikit-image, which the app's test job does not have --
 * so this reads both files as text and holds them to each other. A name the
 * scene asks for that the kit never makes fails the Blender run on a render
 * runner, forty minutes after the push; this fails it here, in a second.
 */
declare const require: (m: string) => any;
declare const __dirname: string;

const { readFileSync } = require('fs') as { readFileSync: (p: string) => { toString: () => string } };
const { join } = require('path') as { join: (...p: string[]) => string };

const ROOT = join(__dirname, '..');
const scene = readFileSync(join(ROOT, 'tools', 'blender', 'world_scene_pack.py')).toString();
const kit = readFileSync(join(ROOT, 'tools', 'sculpt', 'kit.py')).toString();

describe('sculpt kit', () => {
  it('makes every fixed object a sculpted scene asks for', () => {
    const asked = [...scene.matchAll(/\bkit\("([a-z_]+)"/g)].map((m) => m[1]);
    expect(asked.length).toBeGreaterThan(0);
    for (const name of asked) {
      expect({ name, made: kit.includes(`KIT["${name}"]`) }).toEqual({ name, made: true });
    }
  });

  it('makes at least one variant of every kind the scene picks from', () => {
    const kinds = [...scene.matchAll(/_pick\("([a-z]+)"/g)].map((m) => m[1]);
    expect(kinds.sort()).toEqual(['bush', 'hedge', 'tree', 'tuft']);
    for (const kind of kinds) {
      expect({ kind, made: kit.includes(`KIT[f"${kind}_{`) }).toEqual({ kind, made: true });
    }
  });

  it('makes a flower bed for every petal colour the park plants', () => {
    // The scene maps a bed's petal tone onto one of these families.
    const families = scene.match(/family = next\(\(f for f in \(([^)]*)\)/);
    expect(families).not.toBeNull();
    const wanted = [...(families as RegExpMatchArray)[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
    const petals = kit.match(/PETALS = \{([^}]*)\}/);
    expect(petals).not.toBeNull();
    for (const fam of wanted) {
      expect({ fam, made: (petals as RegExpMatchArray)[1].includes(`"${fam}"`) }).toEqual({ fam, made: true });
    }
  });

  it('keeps the way back one word: every scene names a real style', () => {
    const table = scene.match(/^SCENE_STYLE = \{([^}]*)\}/m);
    expect(table).not.toBeNull();
    const styles = [...(table as RegExpMatchArray)[1].matchAll(/"(\w+)": "(\w+)"/g)];
    expect(styles.map((m) => m[1]).sort()).toEqual(['beach', 'park', 'town']);
    for (const m of styles) expect(['sculpt', 'primitive']).toContain(m[2]);
  });

  it('never falls back to primitives silently when the kit cannot be built', () => {
    // ensure_kit runs the kit with check=True: a missing numpy/skimage raises
    // and the render fails, instead of shipping the rejected look green.
    expect(scene).toMatch(/def ensure_kit\(\):[\s\S]*?check=True/);
    expect(scene).toMatch(/if SCULPTED:\s*\n\s*ensure_kit\(\)/);
  });

  it('keeps the tree paint ids in one place', () => {
    // The first cut numbered BARK/LEAF in the kit independently, the other way
    // round from tree.py, and every tree rendered brown-canopied.
    expect(kit).toMatch(/^BARK, LEAF = tree\.BARK, tree\.LEAF$/m);
  });
});
