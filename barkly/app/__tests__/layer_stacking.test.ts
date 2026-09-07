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
    /*
     * PER ELEMENT, NOT PER LAYER.
     *
     * The first version asked only whether the string `zIndex` appeared
     * anywhere in the block, which meant one stated depth excused every other
     * element beside it. Removing the sea gradient's zIndex from Beach's
     * "distant" layer -- leaving it to lose to a rendered headland -- did not
     * fail this test, because the surf Svg two lines below still had one.
     *
     * Only DIRECT children of the layer are checked. A gradient nested inside
     * a View inherits that View's stacking context and needs nothing of its
     * own, so the rule follows indentation: the layer's children sit two
     * spaces in from it.
     */
    const offenders: string[] = [];
    for (const block of blocks) {
      if (!OBJECT_LAYERS.includes(block.layer)) continue;
      if (!block.body.includes('<WorldObject')) continue;
      const lines = block.body.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').split('\n');
      const open = lines[0];
      const indent = (open.match(/^\s*/) as RegExpMatchArray)[0].length;
      const childAt = ' '.repeat(indent + 2) + '<';
      for (let i = 0; i < lines.length; i += 1) {
        if (!lines[i].startsWith(childAt)) continue;
        const tag = /^<(View|Text|Animated\.View|LinearGradient|Svg)\b/.exec(lines[i].slice(indent + 2));
        if (!tag) continue;
        // The element's own opening tag: from here to the line that closes it
        // at this indent, or the next sibling, whichever comes first.
        let own = lines[i];
        for (let j = i + 1; j < lines.length; j += 1) {
          if (lines[j].startsWith(childAt)) break;
          own += `\n${lines[j]}`;
          if (/^\s*\/?>\s*$/.test(lines[j]) || /\/>\s*$/.test(lines[j])) break;
        }
        if (!own.includes('zIndex')) {
          offenders.push(`${block.file}:${block.line + i} layer="${block.layer}" <${tag[1]}>`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
