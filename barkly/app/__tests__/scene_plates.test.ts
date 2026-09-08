/*
 * THE PLATE CONTRACT.
 *
 * A plate is one Blender render of a whole location, and the app puts the dog's
 * feet on its painted ground using anchors that `world_scene_pack.py` projects
 * through the real camera. Everything here holds that contract, because every
 * number in it is a claim about a PNG that a re-render can silently change.
 *
 * The switch itself is checked too. Both paths -- plated and composited -- have
 * to stay reachable, because the plate is a bet: a better picture bought with
 * less responsive freedom, and going back must never mean restoring assets.
 */
declare const require: (m: string) => any;
declare const __dirname: string;

type Bytes = { readUInt32BE: (offset: number) => number; toString: () => string };
const { readFileSync, existsSync, readdirSync } = require('fs') as {
  readFileSync: (p: string) => Bytes;
  existsSync: (p: string) => boolean;
  readdirSync: (p: string) => string[];
};
const { join } = require('path') as { join: (...p: string[]) => string };

const ROOT = join(__dirname, '..');
const manifest = JSON.parse(
  readFileSync(join(ROOT, 'assets', 'world', 'scenes', 'manifest.json')).toString(),
) as {
  scenes: Record<string, {
    file: string; width: number; height: number; unitPx?: number;
    anchors: Record<string, { x: number; y: number }>;
  }>;
};

describe('scene plates', () => {
  /*
   * WHICH SCENES THESE TESTS ARE ABOUT: the ones that SHIP.
   *
   * The manifest is the render record, and it deliberately never narrows --
   * rendering one scene still publishes every scene's anchors, because a
   * partial run that dropped the others would ship a manifest that had
   * forgotten where the dog stands. So it can describe a plate that is built
   * and held back: the beach plate exists, was judged worse than its
   * composited fallback, and is not in ScenePlate's PLATE_ART.
   *
   * The contract that matters is therefore the other direction. Every plate on
   * disk must be fully and correctly described. An earlier version asserted
   * that every DESCRIBED scene ships, which made "render a scene, don't like
   * it, don't ship it" a test failure -- so the suite sat two red for days,
   * which is how a suite stops being read.
   */
  const shipped = readdirSync(join(ROOT, 'assets', 'world', 'scenes'))
    .filter((f) => f.endsWith('.png'));
  const names = Object.keys(manifest.scenes).filter((n) =>
    shipped.indexOf(manifest.scenes[n].file) !== -1);

  it('describes every plate it ships', () => {
    expect(shipped.length).toBeGreaterThan(0);
    expect(names.length).toEqual(shipped.length);
    for (const name of names) {
      expect(existsSync(join(ROOT, 'assets', 'world', 'scenes', manifest.scenes[name].file))).toBe(true);
    }
  });

  it('publishes dimensions that match the file on disk', () => {
    for (const name of names) {
      const meta = manifest.scenes[name];
      const buf = readFileSync(join(ROOT, 'assets', 'world', 'scenes', meta.file));
      expect({ name, w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) })
        .toEqual({ name, w: meta.width, h: meta.height });
    }
  });

  /*
   * The anchors are what stop the dog floating. `stand` is his feet, `horizon`
   * is where the sky meets the ground, and both are projected rather than
   * typed -- so the only thing worth asserting is that they are present, on
   * the plate, and in the right order.
   */
  it('anchors the dog to the ground and puts the horizon above him', () => {
    for (const name of names) {
      const a = manifest.scenes[name].anchors;
      expect(Object.keys(a).sort()).toEqual(['horizon', 'stand', 'standTop']);
      for (const [key, point] of Object.entries(a)) {
        expect({ name, key, onPlate: point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1 })
          .toEqual({ name, key, onPlate: true });
      }
      expect(a.horizon.y).toBeLessThan(a.stand.y);
      expect(a.standTop.y).toBeLessThan(a.stand.y);
    }
  });

  /*
   * HOW MUCH OF THE COMPOSITION SURVIVES ON A PHONE.
   *
   * With the anchor pinned, the scale is forced -- so a badly framed plate is
   * one that has to be blown up and cropped to its middle. The first park
   * plate stood the dog at 0.595 of the image and came out cropped to 63% of
   * its width on a 390x844: the framing bushes fell off both edges. This walks
   * the same arithmetic `ScenePlate` uses, at the viewports the other gates
   * use, and refuses a plate that loses more than a quarter of its width.
   */
  it('keeps most of every plate on screen at every tested viewport', () => {
    const tight: string[] = [];
    for (const name of names) {
      const meta = manifest.scenes[name];
      const { x: ax, y: ay } = meta.anchors.stand;
      for (const [vw, vh, groundFrac] of [[360, 568, 0.76], [390, 844, 0.772], [430, 932, 0.772]]) {
        const groundY = vh * groundFrac;
        const scale = Math.max(
          vw / (2 * ax) / meta.width,
          vw / (2 * (1 - ax)) / meta.width,
          groundY / ay / meta.height,
          (vh - groundY) / (1 - ay) / meta.height,
        );
        const shown = vw / (meta.width * scale);
        if (shown < 0.75) tight.push(`${name} at ${vw}x${vh}: only ${(shown * 100).toFixed(0)}% of the width`);
      }
    }
    expect(tight).toEqual([]);
  });

  it('keeps the composited path alive so the plate can be turned off', () => {
    const plate = readFileSync(join(ROOT, 'src', 'ui', 'scenes', 'ScenePlate.tsx')).toString();
    expect(plate).toMatch(/export const SCENE_PLATES = (true|false);/);
    const scenes = readFileSync(join(ROOT, 'src', 'ui', 'scenes', 'OutdoorRenderedScenes.tsx')).toString();
    // Both implementations, and a switch that picks between them.
    expect(scenes).toContain('function ParkScenePlated(');
    expect(scenes).toContain('function ParkSceneComposited(');
    expect(scenes).toMatch(/hasPlate\('park'\)\s*\?\s*<ParkScenePlated/);
  });
});
