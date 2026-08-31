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
  const nativeFacade = source('src', 'ui', 'scenes', 'Scenes.tsx');
  const webFacade = source('src', 'ui', 'scenes', 'Scenes.web.tsx');

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
    expect(homeScene).toContain('function RenderedProp');
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
    expect(outdoorScenes).toContain('function RenderedProp');
    expect(outdoorScenes).toContain('function SceneSky');
    expect(outdoorScenes).toMatch(/<Path\b/);
  });

  for (const item of STORE.filter((entry) => entry.slot === 'home')) {
    it(`renders ${item.id} from state in the production Home scene`, () => {
      expect(homeScene).toContain(`has('${item.id}')`);
    });
  }
});
