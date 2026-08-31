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
  const scenes = source('src', 'ui', 'scenes', 'CandyScenesV2.tsx');
  const nativeFacade = source('src', 'ui', 'scenes', 'Scenes.tsx');
  const webFacade = source('src', 'ui', 'scenes', 'Scenes.web.tsx');

  it('web and native use the same code-owned renderer', () => {
    expect(nativeFacade).toContain("from './CandyScenesV2'");
    expect(webFacade).toContain("from './CandyScenesV2'");
  });

  it('does not ship a monolithic generated world plate', () => {
    expect(scenes).not.toMatch(/assets\/world|DioramaPlate|background(?:Image|Plate)/);
    expect(scenes).not.toMatch(/require\s*\(\s*['"][^'"]+\.(?:png|jpe?g|webp)['"]\s*\)/);
  });

  it('keeps furniture and outdoor landmarks as independent draw calls', () => {
    for (const component of [
      'HomeObjectLayer',
      'Window',
      'Sofa',
      'Lamp',
      'SideCabinet',
      'Tree',
      'Bench',
      'Shop',
      'TownFountain',
      'Umbrella',
      'Castle',
    ]) {
      expect(scenes).toMatch(new RegExp(`function ${component}\\b`));
    }
  });

  for (const item of STORE.filter((entry) => entry.slot === 'home')) {
    it(`renders ${item.id} from state`, () => {
      expect(scenes).toContain(`has('${item.id}')`);
    });
  }
});
