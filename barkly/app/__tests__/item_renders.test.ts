/**
 * The shop's icons are RENDERS now, and a render has a shape.
 *
 * `ItemIcon` fits each image inside the caller's square using an aspect ratio
 * written next to the `require`. That number is a copy of the PNG's own
 * dimensions, and a copy drifts: re-render the rope a little longer and the
 * declared 160/58 silently squashes it. So the copy is checked against the
 * file, here, from the PNG header.
 *
 * It also holds the other two ends of the wiring: every purchasable item is
 * either rendered or drawn (never neither), and every render that exists in
 * assets is actually used (never a file nobody loads).
 */

declare const require: (m: string) => any;
declare const __dirname: string;

// No @types/node in this project, so the two calls used here are typed by hand.
// A PNG header is read as bytes; the sources are read as text.
type Bytes = { readUInt32BE: (offset: number) => number; toString: () => string };
const { readFileSync, readdirSync } = require('fs') as {
  readFileSync: (path: string) => Bytes;
  readdirSync: (path: string) => string[];
};
const { join } = require('path') as { join: (...parts: string[]) => string };

import { STORE } from '../src/game/progression';

const ROOT = join(__dirname, '..');
const ITEM_DIR = join(ROOT, 'assets', 'world', 'item');

/** Width and height straight out of the PNG IHDR chunk. */
function pngSize(file: string): { width: number; height: number } {
  const buf = readFileSync(file);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** The `id: { source: require('...x.png'), aspect: W / H }` table in ItemIcon. */
function declaredAspects(): Map<string, { path: string; file: string; aspect: number }> {
  const src = readFileSync(join(ROOT, 'src', 'ui', 'ItemIcon.tsx')).toString();
  const table = src.slice(src.indexOf('const RENDERED'), src.indexOf('};', src.indexOf('const RENDERED')));
  const out = new Map<string, { path: string; file: string; aspect: number }>();
  const entry = /(\w+):\s*\{\s*source:\s*require\('([^']+)'\),\s*aspect:\s*([\d.]+)\s*\/\s*([\d.]+)\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = entry.exec(table))) {
    // The require path is relative to src/ui/.
    const rel = m[2].replace(/^\.\.\/\.\.\//, '');
    out.set(m[1], { path: join(ROOT, ...rel.split('/')), file: m[2].split('/').pop() as string, aspect: Number(m[3]) / Number(m[4]) });
  }
  return out;
}

describe('rendered store items', () => {
  const declared = declaredAspects();

  it('declares every render it ships', () => {
    // Everything in the item pack is loaded by something. Renders that live
    // elsewhere -- the bed is a room prop the shop also sells -- are allowed to
    // be referenced from here, they just are not part of this directory.
    const onDisk = readdirSync(ITEM_DIR).filter((f) => f.endsWith('.png')).sort();
    const referenced = [...declared.values()].map((v) => v.file);
    for (const file of onDisk) expect(referenced).toContain(file);
  });

  it('states each render aspect as the PNG actually is', () => {
    expect(declared.size).toBeGreaterThan(0);
    for (const [id, { path, aspect }] of declared) {
      const { width, height } = pngSize(path);
      // One pixel of rounding is fine; a re-render that changes the shape is not.
      expect(Math.abs(aspect - width / height)).toBeLessThan(0.02);
      expect(id).toBeTruthy();
    }
  });

  it('leaves no purchasable item without art', () => {
    const src = readFileSync(join(ROOT, 'src', 'ui', 'ItemIcon.tsx')).toString();
    const drawn = src.slice(src.indexOf('const BY_ID'), src.indexOf('};', src.indexOf('const BY_ID')));
    for (const item of STORE) {
      const hasRender = declared.has(item.id);
      const hasDrawing = item.id.startsWith('collar_') || drawn.includes(`${item.id}:`);
      expect(hasRender || hasDrawing).toBe(true);
    }
  });
});

/**
 * And the ground they stand on.
 *
 * The panes in the theme are the strongest tint of each category colour that
 * still leaves every item render readable against it. That is a MEASUREMENT,
 * and a measurement written down as a hex literal decays: someone turns the
 * coral back up because the shop looks washed out, and the biscuit goes back
 * to 1.61:1 with every test green. So the numbers are recomputed here, from
 * the actual pixels of the actual PNGs.
 *
 * 3:1 is the WCAG floor for a graphical object you are meant to identify.
 */

const zlib = require('zlib') as { inflateSync: (b: any) => any };
// Same reason as `Bytes` above: no @types/node, so the two Buffer statics used
// here are declared rather than imported.
const Buf = (globalThis as any).Buffer as {
  concat: (parts: any[]) => any;
  alloc: (size: number) => any;
};

/**
 * Mean RGB of the opaque pixels in an 8-bit PNG, truecolour OR palette.
 *
 * Palette support is not decoration. The shipped props are quantised to 256
 * colours without dithering (see scripts/promote-props.py -- the size win that
 * does not counterfeit the surface gate), which makes them colour type 3, and
 * this decoder used to throw "not 8-bit RGBA" on sight. The choice was to stop
 * quantising inventory art for the sake of a test's decoder, or to teach the
 * decoder the format the art is actually in. This is the second one: it costs
 * a PLTE/tRNS lookup and it keeps 268KB out of the bundle.
 */
function meanColor(file: string): [number, number, number] {
  const buf: any = readFileSync(file);
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 6;
  let palette: number[][] = [];
  let alphas: number[] = [];
  const idat: any[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const kind = buf.toString.call(buf, 'ascii', pos + 4, pos + 8);
    if (kind === 'IHDR') {
      width = buf.readUInt32BE(pos + 8);
      height = buf.readUInt32BE(pos + 12);
      colorType = buf[pos + 17];
      if (buf[pos + 16] !== 8 || (colorType !== 6 && colorType !== 3)) {
        throw new Error(`${file}: not 8-bit RGBA or palette`);
      }
    } else if (kind === 'PLTE') {
      for (let i = 0; i < len; i += 3) {
        palette.push([buf[pos + 8 + i], buf[pos + 9 + i], buf[pos + 10 + i]]);
      }
    } else if (kind === 'tRNS') {
      // Palette transparency is optional and may cover only a prefix of the
      // palette; entries it does not mention are fully opaque.
      for (let i = 0; i < len; i += 1) alphas.push(buf[pos + 8 + i]);
    } else if (kind === 'IDAT') {
      idat.push(buf.subarray(pos + 8, pos + 8 + len));
    } else if (kind === 'IEND') break;
    pos += len + 12;
  }
  const raw = zlib.inflateSync(Buf.concat(idat));
  const samples = colorType === 6 ? 4 : 1;
  const stride = width * samples;
  const out = Buf.alloc(height * stride);
  let sum = [0, 0, 0];
  let seen = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x += 1) {
      const a = x >= samples ? out[y * stride + x - samples] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= samples && y > 0 ? out[(y - 1) * stride + x - samples] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = v & 255;
    }
    for (let x = 0; x < width; x += 1) {
      const i = y * stride + x * samples;
      if (colorType === 6) {
        if (out[i + 3] > 200) {
          sum = [sum[0] + out[i], sum[1] + out[i + 1], sum[2] + out[i + 2]];
          seen += 1;
        }
      } else {
        const index = out[i];
        const alpha = index < alphas.length ? alphas[index] : 255;
        const rgb = palette[index];
        if (alpha > 200 && rgb) {
          sum = [sum[0] + rgb[0], sum[1] + rgb[1], sum[2] + rgb[2]];
          seen += 1;
        }
      }
    }
  }
  if (!seen) throw new Error(`${file}: fully transparent`);
  return [sum[0] / seen, sum[1] / seen, sum[2] / seen];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

describe('the pane an item stands on', () => {
  /*
   * THE DECODER IS PART OF THE MEASUREMENT, so it is checked against known
   * answers rather than trusted. It grew palette support when the props were
   * quantised, and a decoder that silently returns the wrong mean turns every
   * contrast assertion below into a green light that means nothing. These
   * three numbers were taken independently (Pillow, opaque pixels only) from
   * the same shipped files.
   */
  it('decodes a palette PNG to the same mean an independent reader gets', () => {
    const cases: Array<[string, [number, number, number]]> = [
      ['collar_red', [151.63, 65.98, 43.64]],
      ['toy_ball', [176.83, 78.74, 65.14]],
      ['treat_cheese', [175.36, 125.37, 36.21]],
    ];
    for (const [name, expected] of cases) {
      const got = meanColor(join(ROOT, 'assets', 'world', 'item', `${name}.png`));
      for (let i = 0; i < 3; i += 1) {
        expect({ name, i, off: Math.abs(got[i] - expected[i]) < 0.5 })
          .toEqual({ name, i, off: true });
      }
    }
  });

  it('keeps every render legible against every pane it can land on', () => {
    const theme = readFileSync(join(ROOT, 'src', 'ui', 'theme.ts')).toString();
    const panes = [...theme.matchAll(/(\w+Pane): '(#[0-9A-Fa-f]{6})'/g)].map((m) => ({
      name: m[1],
      rgb: hexRgb(m[2]),
    }));
    // Five categories; if one is dropped the shop lost a section, so say so here.
    expect(panes.length).toBe(5);

    // Only the things that actually stand on a pane: the shop's cards and the
    // food tray's rows. The care tray's bowl and stick stand on wood, which is
    // a different ground with a different answer.
    const shown = STORE.map((item) => item.id).filter((id) => declaredAspects().has(id));
    expect(shown.length).toBeGreaterThan(0);
    const worst: string[] = [];
    for (const id of shown) {
      const mean = meanColor(declaredAspects().get(id)!.path);
      for (const pane of panes) {
        const ratio = contrast(mean, pane.rgb as [number, number, number]);
        if (ratio < 3) worst.push(`${id} on ${pane.name}: ${ratio.toFixed(2)}:1`);
      }
    }
    expect(worst).toEqual([]);
  });
});
