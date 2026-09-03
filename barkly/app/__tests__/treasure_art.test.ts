/**
 * Every treasure Barkly can dig up has a drawing.
 *
 * The Pack Book's stash shelf draws each find. `TreasureIcon` has a deliberate
 * `Unknown` fallback so a save from a future build can never render a hole —
 * but that fallback is a safety net, not a licence to add a 25th treasure and
 * ship it as a lump in a rag. This test is what makes the net honest: add a
 * treasure to `world/stash.ts` without drawing it and this fails, naming it.
 *
 * Read as source rather than rendered, because the map is a module-level
 * literal of SVG elements and asserting on the KEYS is the whole contract.
 */

import { TREASURES } from '../src/world/stash';

// `require` rather than an import: the suite runs without node types on the
// tsconfig, the same way `no_dead_palette` reads the palette file.
const { readFileSync } = require('fs') as { readFileSync: (p: string, enc: string) => string };
const { join } = require('path') as { join: (...p: string[]) => string };

const src = readFileSync(join(process.cwd(), 'src/ui/TreasureIcon.tsx'), 'utf8');

function drawnIds(): string[] {
  const block = src.slice(
    src.indexOf('const TREASURE_ART'),
    src.indexOf('export function hasTreasureArt'),
  );
  expect(block.length).toBeGreaterThan(100);
  return [...block.matchAll(/^\s{2}(\w+):\s*</gm)].map((m) => m[1]);
}

describe('treasure art', () => {
  it('draws every treasure in the world list', () => {
    const drawn = new Set(drawnIds());
    const missing = TREASURES.filter((t) => !drawn.has(t.id)).map((t) => t.id);
    expect(missing).toEqual([]);
  });

  it('draws nothing that is not a treasure', () => {
    const known = new Set(TREASURES.map((t) => t.id));
    const orphans = drawnIds().filter((id) => !known.has(id));
    expect(orphans).toEqual([]);
  });
});
