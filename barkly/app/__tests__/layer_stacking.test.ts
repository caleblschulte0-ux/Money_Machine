declare const require: (m: string) => any;
declare const __dirname: string;

const { readFileSync } = require('fs') as { readFileSync: (p: string, e: string) => string };
const { join } = require('path') as { join: (...p: string[]) => string };

function source(...parts: string[]): string {
  return readFileSync(join(__dirname, '..', ...parts), 'utf8');
}

/*
 * A REGRESSION THIS EXACT CHANGE CAUSED, WRITTEN DOWN SO IT CANNOT RECUR.
 *
 * Giving WorldObject a baseline-derived zIndex is what stopped the park bench
 * being drawn through a tree trunk. It also, silently, put Town's shop sign
 * BEHIND the shopfront it names: a plain View has no zIndex, and among
 * siblings anything with one beats it. The symptom was "BARKLY'S" rendering in
 * dark teal against a teal wall above the painted plaque -- which looks like a
 * font or a position bug, not a stacking one, and was only caught by zooming
 * into a capture.
 *
 * The rule that keeps it fixed: inside a layer that contains a WorldObject,
 * every code-drawn element must state its own depth. Layers with no
 * WorldObject in them are unaffected and are not the subject here.
 */
const OBJECT_LAYERS = ['distant', 'landmark', 'props', 'foreground'];

type Block = { file: string; layer: string; body: string; line: number };

function layerBlocks(file: string): Block[] {
  const text = source('src', 'ui', 'scenes', file);
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let layer: string | null = null;
  let start = 0;
  let buf: string[] = [];
  lines.forEach((line, i) => {
    const open = /<WorldLayer name="(\w+)"/.exec(line);
    if (open) {
      layer = open[1];
      start = i + 1;
      buf = [];
    }
    if (layer) buf.push(line);
    if (layer && line.includes('</WorldLayer>')) {
      blocks.push({ file, layer, body: buf.join('\n'), line: start });
      layer = null;
    }
  });
  return blocks;
}

describe('anything sharing a layer with a prop states its own depth', () => {
  const blocks = ['OutdoorRenderedScenes.tsx', 'HomeRenderedScene.tsx'].flatMap(layerBlocks);

  it('found the scene layers to check', () => {
    expect(blocks.length).toBeGreaterThan(8);
    expect(blocks.some((b) => OBJECT_LAYERS.includes(b.layer))).toBe(true);
  });

  it('never leaves a code-drawn element to lose to a rendered prop', () => {
    const offenders: string[] = [];
    for (const block of blocks) {
      if (!OBJECT_LAYERS.includes(block.layer)) continue;
      if (!block.body.includes('<WorldObject')) continue;
      // Strip comments so prose about Views is not mistaken for a View.
      const code = block.body.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
      const raw = /<(View|Text|Animated\.View)\b/.test(code);
      if (raw && !code.includes('zIndex')) {
        offenders.push(`${block.file}:${block.line} layer="${block.layer}"`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
