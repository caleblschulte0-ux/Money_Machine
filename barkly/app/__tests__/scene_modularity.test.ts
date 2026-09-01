declare const require: (m: string) => any;
declare const __dirname: string;

const { readFileSync } = require('fs') as { readFileSync: (path: string, encoding: string) => string };
const { join } = require('path') as { join: (...parts: string[]) => string };

import { STORE } from '../src/game/progression';

function source(...parts: string[]): string {
  return readFileSync(join(__dirname, '..', ...parts), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ');
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

  it('uses atmospheric lighting without a hard-edged screen sweep', () => {
    expect(presentation).toContain('styles.horizonHaze');
    expect(presentation).toContain('styles.bottomGrade');
    expect(presentation).not.toContain('styles.keySweep');
    expect(presentation).not.toContain('styles.keyPool');
  });

  it('lets outdoor worlds react to active gameplay', () => {
    expect(outdoorScenes).toContain('function useActionPulse');
    expect(outdoorScenes).toContain("active={motion === 'active'}");
    expect(outdoorScenes).toContain('parkActionPuff');
    expect(outdoorScenes).toContain('beachActionDrop');
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
