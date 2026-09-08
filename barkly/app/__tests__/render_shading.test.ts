/*
 * WHAT MAKES THE WORLD MATCH THE CHARACTER, held in the render packs.
 *
 * Barkly is clean and cartoon: big smooth forms, soft gradients, and a crisp
 * dark seam wherever two shapes meet. That last part is ambient occlusion, and
 * the prop pack -- which renders every prop in the game -- did not have it,
 * while the scene pack did. Five spheres of a hedge met with no seam between
 * them and read as one blurry mass; a bench had no shadow in its slat gaps.
 *
 * A whole pass went into surface NOISE before that was spotted, and the noise
 * was the wrong answer twice over: it did not fix the flatness, and at the
 * strength it needed to be visible it made the background read as FELT, which
 * is a material the character does not have. The operator's words, and they
 * are the standard this file exists to hold: "barkly ... still looks very
 * clean and cartoon ... the background now give a felt vibe which is not what
 * barkly has going on and no[t] what I want for the background."
 *
 * So this asserts the two things that keep the world in the character's
 * language, both of which are one line in a render script and both of which
 * were silently wrong or absent at some point:
 *
 *   1. every pack that renders something enables ambient occlusion
 *   2. no surface is strong enough to read as fabric
 *
 * There is no measurement of the PNGs here. There was, and it was deleted:
 * a gate that refused a prop for having too LITTLE surface texture encoded
 * exactly the hypothesis that turned out to be wrong, and a gate defending a
 * rejected direction is worse than none.
 */
declare const require: (m: string) => any;
declare const __dirname: string;

const { readFileSync } = require('fs') as { readFileSync: (p: string) => { toString: () => string } };
const { join } = require('path') as { join: (...p: string[]) => string };

const ROOT = join(__dirname, '..');
const packs = ['world_prop_pack.py', 'world_scene_pack.py'];

function source(name: string): string {
  return readFileSync(join(ROOT, 'tools', 'blender', name)).toString();
}

describe('render packs', () => {
  it('darkens where forms meet, in every pack that renders', () => {
    for (const pack of packs) {
      expect({ pack, ao: source(pack).includes('use_gtao') }).toEqual({ pack, ao: true });
    }
  });

  /*
   * THE FABRIC CEILING. `bump` perturbs the normal, which is most of what says
   * "woven" under a hard key light, and `mottle` is how far the colour strays
   * from the authored value. At bump 0.34-0.80 and mottle 0.11-0.24 the world
   * read as felt. These ceilings sit above where the surfaces are now and well
   * below where they were, so the test fails on a drift back toward fabric
   * rather than on ordinary tuning.
   */
  it('keeps every surface below the strength that reads as fabric', () => {
    const pack = source('world_prop_pack.py');
    const block = pack.slice(pack.indexOf('SURFACES = {'), pack.indexOf('"smooth":  None'));
    const tooStrong: string[] = [];
    for (const [, value] of block.matchAll(/"bump":\s*([0-9.]+)/g)) {
      if (Number(value) > 0.20) tooStrong.push(`bump ${value}`);
    }
    for (const [, value] of block.matchAll(/"mottle":\s*([0-9.]+)/g)) {
      if (Number(value) > 0.08) tooStrong.push(`mottle ${value}`);
    }
    // Roughness variation reads as nap. Nothing should ask for it by default.
    for (const [, value] of block.matchAll(/"rough":\s*([0-9.]+)/g)) {
      if (Number(value) > 0) tooStrong.push(`rough ${value}`);
    }
    expect(tooStrong).toEqual([]);
  });

  it('keeps the scene ground below it too', () => {
    const scene = source('world_scene_pack.py');
    for (const [, value] of scene.matchAll(/bump:\s*float\s*=\s*([0-9.]+)/g)) {
      expect({ where: 'ground default', ok: Number(value) <= 0.20 })
        .toEqual({ where: 'ground default', ok: true });
    }
    for (const [, value] of scene.matchAll(/bump=([0-9.]+)/g)) {
      expect({ where: 'ground call', ok: Number(value) <= 0.20 })
        .toEqual({ where: 'ground call', ok: true });
    }
  });
});
