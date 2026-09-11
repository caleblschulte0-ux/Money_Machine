declare const require: (m: string) => any;
declare const __dirname: string;

const { readFileSync, readdirSync } = require('fs') as { readFileSync: (path: string, encoding: string) => string; readdirSync: (path: string) => string[] };
const { join } = require('path') as { join: (...parts: string[]) => string };

import { STORE } from '../src/game/progression';

function source(...parts: string[]): string {
  return readFileSync(join(__dirname, '..', ...parts), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ');
}

// Shell globs contain `/*`, which the comment-stripping above eats. Anything
// that has to be read literally -- a workflow, a manifest -- comes through here.
function raw(...parts: string[]): string {
  return readFileSync(join(__dirname, '..', ...parts), 'utf8');
}

describe('world scenery stays modular', () => {
  const outdoorScenes = source('src', 'ui', 'scenes', 'OutdoorRenderedScenes.tsx');
  const homeScene = source('src', 'ui', 'scenes', 'HomeRenderedScene.tsx');
  const presentation = source('src', 'ui', 'scenes', 'WorldScene.tsx');
  const nativeFacade = source('src', 'ui', 'scenes', 'Scenes.tsx');
  const webFacade = source('src', 'ui', 'scenes', 'Scenes.web.tsx');
  const characterRig = source('src', 'ui', 'BarklyRig.tsx');
  const worldFactory = source('tools', 'blender', 'world_prop_pack.py');
  const homeFactory = source('tools', 'blender', 'home_prop_pack.py');
  const architectureFactory = source('tools', 'blender', 'home_architecture.py');
  const worldManifest = source('assets', 'world', 'manifest.json');

  it('web and native route Home through the same production renderer', () => {
    for (const facade of [nativeFacade, webFacade]) {
      expect(facade).toContain("export { HomeScene } from './HomeRenderedScene'");
      expect(facade).toContain("from './OutdoorRenderedScenes'");
    }
  });

  it('does not ship a monolithic generated world plate', () => {
    expect(outdoorScenes).not.toMatch(/DioramaPlate|background(?:Image|Plate)|(?:park|town|beach)(?:_world|World|Background)\.(?:png|jpe?g|webp)/i);
    expect(homeScene).not.toMatch(/DioramaPlate|background(?:Image|Plate)|home(?:_room|Room|Background)\.(?:png|jpe?g|webp)/i);
  });

  it('keeps Home architecture and furniture as independently addressable assets', () => {
    for (const asset of ['chair.png', 'lamp.png', 'bed.png', 'rug.png', 'shelf.png', 'window_frame.png']) {
      expect(homeScene).toContain(asset);
    }
    expect(homeScene).toContain('<WorldObject');
    expect(homeScene).toContain('function RenderedWindow');
  });

  it('keeps outdoor landmarks as independently addressable rendered modules', () => {
    for (const asset of [
      'tree.png',
      'bench.png',
      'hedge.png',
      'store_coral.png',
      'store_aqua.png',
      'store_violet.png',
      'fountain.png',
      'lamp.png',
      'planter.png',
      'umbrella.png',
      'lifeguard.png',
      'dune.png',
      'castle.png',
      'palm.png',
    ]) {
      expect(outdoorScenes).toContain(asset);
    }
    expect(outdoorScenes).toContain('<WorldObject');
    expect(outdoorScenes).toContain('function SceneSky');
    expect(outdoorScenes).toMatch(/<Path\b/);
  });

  it('routes every location through one presentation engine', () => {
    for (const scene of [homeScene, outdoorScenes]) {
      expect(scene).toContain("from './WorldScene'");
      expect(scene).toContain('<WorldScene');
      expect(scene).toContain('<WorldLayer');
      expect(scene).toContain('<WorldLighting');
    }
    for (const layer of ['sky', 'distant', 'ground', 'landmark', 'props', 'foreground', 'fx']) {
      expect(presentation).toContain(`'${layer}'`);
    }
    expect(presentation).toContain('export function WorldObject');
    expect(presentation).toContain('export function WorldScene');
  });

  it('keeps every rendered module on one front-weighted camera', () => {
    const camera = 'CAMERA_LOCATION = (3.0, -10.8, 4.5)';
    for (const factory of [worldFactory, homeFactory, architectureFactory]) {
      expect(factory).toContain(camera);
    }
    expect(homeFactory).toContain('yaw = 0');
    expect(worldFactory).toContain('front-weighted orthographic v3');
    expect(worldManifest).toContain('Barkly shared front-weighted orthographic v3');
  });

  /*
   * These two guard the 2026-09-02 master-grade pass. Both defects were
   * invisible in code review and only showed up as numbers on the contact
   * sheet, so they get numbers-free structural tests here instead.
   */
  it('lights all four locations from ONE grade, not four', () => {
    // The grade constant lives in WorldScene and nowhere else. A scene that
    // starts hand-rolling its own wash is how Park ended up cold while the
    // other three ran warm.
    expect(presentation).toMatch(/const GRADE(?::[^=]+)?\s*=\s*\{/);
    expect(presentation).toContain('function WorldLighting');
    for (const scene of [outdoorScenes, homeScene]) {
      expect(scene).toContain('<WorldLighting');
      expect(scene).not.toContain('const GRADE');
    }
    // Night is a colour with warm pools in it, not a dimmer switch.
    expect(presentation).toMatch(/night:\s*\{[\s\S]*?pool:/);
  });

  it('renders every Blender pack through Standard, never AgX', () => {
    // AgX is a filmic transform that rolls saturated highlights toward white.
    // It is why every prop shipped pastel -- store_violet measured 45% of its
    // pixels under 0.18 chroma -- while its authored base colour was candy.
    for (const factory of [worldFactory, homeFactory, architectureFactory]) {
      // The rigs are allowed to NAME AgX in a comment explaining why they do
      // not use it; what must never come back is the assignment.
      expect(factory).not.toMatch(/view_settings\.look\s*=\s*['"]AgX/);
      expect(factory).toMatch(/view_transform\s*=\s*['"]Standard['"]/);
    }
  });

  /*
   * The care tray. It is the one rendered prop that is UI rather than
   * scenery -- it sits under Barkly in all four locations -- and it was drawn
   * with Views long after everything around it had become a render.
   *
   * Two things here, both of which bit:
   *
   * The rotation is DERIVED from the shared camera, never typed. The camera
   * sits 15.5 degrees off-axis, which is invisible on a compact prop and
   * catastrophic on one five units long: the tray's first render came out as a
   * diagonal plank, because the long axis picks up sin(pitch)*sin(yaw) of drop
   * per unit. Cancelling the camera's own yaw fixes it inside the builder
   * instead of forking the camera every other prop shares -- but only while the
   * angle is read from CAMERA_LOCATION, so a camera move takes the tray with it.
   *
   * And it has to be PROMOTED. The workflow copied home/rug.png by name, so a
   * second home prop rendered in CI and reached the app never; the builder and
   * the shipped asset would have drifted apart with everything green.
   */
  it('renders the care tray Barkly stands over, from the shared camera', () => {
    const kit = source('src', 'ui', 'BarklyKit.tsx');
    expect(worldFactory).toContain('def home_care_tray');
    expect(worldFactory).toContain('"home/care_tray"');
    expect(worldFactory).toContain('math.atan2(CAMERA_LOCATION[0], -CAMERA_LOCATION[1])');
    expect(kit).toContain('care_tray.png');
    // The render owns the wood; the app owns anything that changes. A baked
    // copy of the three dishes underneath the live ones drew everything twice.
    expect(worldFactory).not.toMatch(/def home_care_tray[\s\S]*?\bwell_/);
  });

  /*
   * PROMOTION HAS ONE IMPLEMENTATION, and it is not in the workflow.
   *
   * This used to assert that the workflow contained a `cp <family>/*.png` line
   * per family, guarding the bug where it copied home/rug.png by name and a
   * second home prop was rendered in CI and reached the app never. Good guard,
   * wrong place: the workflow was a SECOND copy of the promotion recipe next
   * to scripts/promote-props.py, and on 2026-09-08 they disagreed -- the
   * script had started quantising props to a 256-colour palette, the workflow
   * had not, and because the workflow runs on every push touching the pack and
   * commits over the branch, CI silently replaced the whole quantised world
   * with unquantised renders at three times the bytes.
   *
   * So the guard moves to where promotion lives. The list of props still may
   * not be hand-written -- it is derived from the pack's own BUILDERS -- and
   * the workflow may not grow its own copy of the recipe back.
   */
  it('promotes from the pack\'s own builder list, in exactly one place', () => {
    const workflow = raw('..', '..', '.github', 'workflows', 'barkly-world-prop-render.yml');
    const promote = raw('scripts', 'promote-props.py');

    expect(workflow).toContain('python3 scripts/promote-props.py');

    /*
     * EVERY workflow, not just this one. The guard used to read only the file
     * it knew about, and `barkly-home-prop-render.yml` sat beside it for
     * months carrying its own recipe: four hand-listed props, an inline
     * `convert -trim`, and `cp` into assets/ with no quantise and no contour.
     * Both fire on a `claude/barkly-*` push, so they took turns overwriting
     * the same four files -- CI commit 181aa5a shipped chair.png at 99KB with
     * no ink edge, 64cd288 put it back at 20KB with one, and which art you got
     * depended on which job finished last.
     *
     * A test that names one file cannot catch a second copy of the thing it is
     * guarding against. This one reads the directory.
     */
    const dir = join(__dirname, '..', '..', '..', '.github', 'workflows');
    for (const file of readdirSync(dir).filter((f: string) => f.endsWith('.yml'))) {
      const raw_ = readFileSync(join(dir, file), 'utf8');
      // Comment lines are stripped first, or this fails on the note that
      // explains what was removed -- a guard that cannot survive its own
      // explanation gets the explanation deleted instead.
      const yml = raw_.split('\n').filter((l: string) => !/^\s*#/.test(l)).join('\n');
      if (!/art-review\//.test(yml)) continue;
      expect({ file, copiesArtByHand: /^\s*cp art-review\//m.test(yml) })
        .toEqual({ file, copiesArtByHand: false });
      expect({ file, resizesArtByHand: /convert .*-(resize|trim)/.test(yml) })
        .toEqual({ file, resizesArtByHand: false });
      expect({ file, promotesWithTheScript: yml.includes('scripts/promote-props.py') })
        .toEqual({ file, promotesWithTheScript: true });
    }

    // And the script derives its props rather than listing them.
    expect(promote).toContain('BUILDERS = {');
    // A PROP, not a family. This was `includes("home/")` and it failed the day
    // the home pack was brought into this same script: promotion maps a home
    // builder key to its shipped path with `f"home/{key}"`, which is the path
    // SHAPE, and is exactly as derived as the rest of it. What must never
    // appear is a prop's own name.
    for (const family of ['park', 'town', 'beach', 'home']) {
      // A COMPLETE quoted name. `"home/architecture/` is a folder in a path
      // shape, the same as `f"home/{key}"`; `"home/lamp"` is a prop somebody
      // typed, which is the thing that must never be here.
      const named = new RegExp(`"${family}/[a-z_0-9]+"`);
      expect({ family, handListed: named.test(promote) })
        .toEqual({ family, handListed: false });
    }
  });

  /*
   * The pastel that survived the AgX fix.
   *
   * Blender's Base Color input is LINEAR; a hex off a palette is sRGB. Handing
   * `int(hex) / 255` straight to the shader tells Blender that #E14B45's 0.29
   * green is a linear 0.29, and the render encodes it back out through sRGB on
   * the way to the PNG, which lifts mid-tones hard. Under a perfectly neutral
   * unit light and with nothing else wrong, #E14B45 comes back #F1948E and
   * #37B4CD comes back #80DBE8. Measured over all twenty props, correcting it
   * moved mean saturation 0.444 -> 0.641 and colourless pixels 2.7% -> 1.3%.
   *
   * Dropping AgX was a real fix and it could not reach this one: the base
   * colours were already wrong before a single light hit them.
   */
  it('converts authored sRGB hex to linear before handing it to a shader', () => {
    for (const factory of [worldFactory, homeFactory, architectureFactory]) {
      expect(factory).toContain('def _srgb_to_linear');
      expect(factory).toMatch(/\(\(channel \+ 0\.055\) \/ 1\.055\) \*\* 2\.4/);
      // The raw division must not survive anywhere as the value handed to a material.
      expect(factory).not.toMatch(/return tuple\(int\(value\[[^\]]+\], 16\) \/ 255/);
      expect(factory).toMatch(/_srgb_to_linear\(int\(/);
    }
  });

  it('uses composition lanes instead of arbitrary per-prop tilts', () => {
    expect(outdoorScenes).toContain('const COMPOSITION =');
    expect(outdoorScenes).not.toMatch(/<WorldObject[^>]*\srotate=/);
    expect(homeScene).not.toMatch(/<WorldObject[^>]*\srotate=/);
  });

  it('gives Barkly an autonomous idle performance', () => {
    expect(characterRig).toContain('function useIdlePerformance');
    expect(characterRig).toContain('idlePerformance.v');
    expect(characterRig).toContain('idleEye');
    expect(characterRig).toContain("location === 'park'");
    expect(characterRig).toContain("location === 'town'");
    expect(characterRig).toContain("location === 'beach'");
    expect(outdoorScenes).toContain("BARKLY'S");
  });

  for (const item of STORE.filter((entry) => entry.slot === 'home')) {
    it(`renders ${item.id} from state in the production Home scene`, () => {
      expect(homeScene).toContain(`has('${item.id}')`);
    });
  }
});

/*
 * A RENDER DIRECTORY SAYS WHICH BUILDER MADE IT.
 *
 * Promotion used to refuse any render whose mtime predated the pack's. That is
 * wrong in both directions and both were felt: `git rebase` rewrites a source
 * file's timestamp without changing a byte, which marked all 49 renders stale
 * and cost a fifteen-minute re-render to produce identical files; and a `git
 * stash pop` can restore an OLDER pack with a NEWER time, which the mtime
 * check waves straight through and ships a world built by two versions of
 * itself -- the exact failure the check exists to prevent.
 *
 * Each pack now writes a sha256 of its own source into its render directory,
 * LAST, and only on a full pass. This holds that contract from the source
 * side; `python3 scripts/promote-props.py --check` is what enforces it.
 */
describe('renders record the builder that made them', () => {
  const PACKS = ['world_prop_pack.py', 'home_prop_pack.py', 'home_architecture.py'];

  test.each(PACKS)('%s stamps its render directory', (file: string) => {
    const src = readFileSync(join(__dirname, '..', 'tools', 'blender', file), 'utf8');
    expect(src).toContain('def stamp_pack(');
    expect(src).toContain('.pack-sha256');
    // Only a full pass may claim the directory is current: a narrowed run
    // leaves the rest of the pack behind, which is the half-rendered world
    // the marker exists to refuse.
    // Comment lines are allowed between the guard and the call -- two of the
    // three packs explain themselves there -- but the guard has to be the
    // thing immediately above it, and there must be exactly one call site.
    expect(src).toMatch(/if not only:\n(?:\s*#[^\n]*\n)*\s+stamp_pack\(OUT\)/);
    expect(src.match(/^\s*stamp_pack\(OUT\)/gm) || []).toHaveLength(1);
  });

  it('promotion asks the hash, not the clock', () => {
    const promote = readFileSync(join(__dirname, '..', 'scripts', 'promote-props.py'), 'utf8');
    expect(promote).toContain('def pack_fingerprint(');
    expect(promote).toContain('packfile.fingerprint(');
    // The mtime path survives only as the fallback for a directory rendered
    // before markers existed, and it is guarded by the marker being absent.
    expect(promote).toContain('got is None and render.stat().st_mtime');
  });

  /*
   * AND THE HASH HAS TO COVER WHAT THE RENDER ACTUALLY DEPENDS ON.
   *
   * Every one of these packs computed its own marker as
   * `sha256(Path(__file__).read_bytes())` -- three copies of a digest over ONE
   * file. `palette.py` holds every colour in the game, both lights, the sky
   * fill strength and, since the sun pass, the elevation each pack lights
   * from; `ink.py` holds the contour; `proportion.py` holds the cartoon dials.
   * None of them were in it. The single most behaviour-changing number in the
   * render pipeline could be edited and the freshness check would wave every
   * stale render in the repo straight through -- silently, which is the part
   * that matters, because the failure looks like art that quietly did not
   * change.
   *
   * The digest is `packfile.fingerprint`, one implementation shared by all
   * four writers and the reader. A marker the writer and the reader compute
   * differently is worse than no marker.
   */
  test.each(PACKS)('%s fingerprints its shared modules, not just itself', (file: string) => {
    const src = readFileSync(join(__dirname, '..', 'tools', 'blender', file), 'utf8');
    const stamp = src.slice(src.indexOf('def stamp_pack('));
    const body = stamp.slice(0, stamp.indexOf('def ', 10) + 1 || undefined);
    expect(body).toContain('packfile.fingerprint(');
    // The one-file digest is what this replaced. If it comes back anywhere in
    // the pack, something has grown a second opinion about freshness.
    expect(src).not.toContain('hashlib.sha256(Path(__file__)');
  });

  /*
   * NO PACK DRAWS AN EDGE WITHOUT ASKING ink.py FIRST.
   *
   * `world_scene_pack.py` set `use_freestyle = True` flat, consulting nothing.
   * So when the contour was switched off game-wide, the three PLATES kept
   * theirs -- 4.69% of the shipped park plate was still ink pixels after the
   * commit that said the outline had come off everything. The plates are the
   * largest art in the game, which is most of the change, and it is why the
   * operator looked at the live build and reported no difference. He was right;
   * the explanation I gave him ("a subtle change") was wrong, because half of
   * it had not been made.
   *
   * `ink.py` names its three consumers in its own docstring. This asserts all
   * three actually route through it rather than deciding for themselves.
   */
  it('lets no pack turn Freestyle on without asking ink.py', () => {
    for (const file of ['world_prop_pack.py', 'world_scene_pack.py']) {
      const src = readFileSync(join(__dirname, '..', 'tools', 'blender', file), 'utf8');
      // `scene.render.use_freestyle` is the master switch: with it off the
      // per-view-layer flag is inert, so that one is allowed to be a literal.
      const enables = src.match(/scene\.render\.use_freestyle\s*=\s*([^\n]+)/g) ?? [];
      expect(enables.length).toBeGreaterThan(0);
      for (const line of enables) {
        // Either bound to the switch, or to a call that consults it.
        expect(line).toMatch(/contour_on\(\)|takes_ink|bool\(enabled\)|enabled/);
        expect(line).not.toMatch(/=\s*True\s*$/);
      }
    }
    // And the switch has to be reachable from the scene pack at all.
    const scene = readFileSync(join(__dirname, '..', 'tools', 'blender', 'world_scene_pack.py'), 'utf8');
    // A FUNCTION, not the constant. `from ink import CONTOUR` binds the
    // value at import, so the scene pack held a frozen copy of the switch and
    // flipping `ink.CONTOUR` at runtime did nothing to it -- the probe's
    // inked and un-inked styles rendered identically, 0.0 apart out of 255.
    expect(scene).toMatch(/from ink import [^\n]*contour_on/);
    expect(scene).not.toMatch(/from ink import [^\n]*\bCONTOUR\b/);
    const inkModule = readFileSync(join(__dirname, '..', 'tools', 'blender', 'ink.py'), 'utf8');
    expect(inkModule).toMatch(/def contour_on\(/);
    // The contour-off path RETURNS EARLY, and for one render it returned out
    // of `setup()` itself -- so with the line switched off the pack built no
    // camera, no sun and no world, and Blender refused the frame outright.
    // The version of this test above passed the whole time: it reads the
    // assignment, and the assignment was correct. So the early return has to
    // live in a function whose only job is the ink pass.
    expect(scene).toMatch(/def _ink_pass\(/);
    const setupBody = scene.slice(scene.indexOf('\ndef setup('));
    const setupOnly = setupBody.slice(0, setupBody.indexOf('\ndef ', 1));
    expect(setupOnly).toContain('_ink_pass(scene)');
    expect(setupOnly).not.toMatch(/^\s*return\s*$/m);
  });

  it('fingerprints the whole shared layer, and every pack reaches all of it', () => {
    const packfile = readFileSync(join(__dirname, '..', 'tools', 'blender', 'packfile.py'), 'utf8');
    // It must FOLLOW imports rather than hard-coding a list, or the list is
    // the next thing to go stale.
    expect(packfile).toContain('ast.parse');
    expect(packfile).not.toMatch(/\[\s*["']palette["']/);
    // Nothing in here may import bpy: the packs run inside Blender and the
    // promote script does not, and both have to be able to call it.
    // Anchored to the start of a line: the module's own docstring explains
    // why an `import bpy` is not part of what this repo renders with, and a
    // bare substring match reads that sentence as the defect it describes.
    expect(packfile).not.toMatch(/^import bpy/m);
    expect(packfile).not.toMatch(/^from bpy/m);
  });
});
