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
function declaredAspects(): Map<string, { file: string; aspect: number }> {
  const src = readFileSync(join(ROOT, 'src', 'ui', 'ItemIcon.tsx')).toString();
  const table = src.slice(src.indexOf('const RENDERED'), src.indexOf('};', src.indexOf('const RENDERED')));
  const out = new Map<string, { file: string; aspect: number }>();
  const entry = /(\w+):\s*\{\s*source:\s*require\('([^']+)'\),\s*aspect:\s*([\d.]+)\s*\/\s*([\d.]+)\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = entry.exec(table))) {
    out.set(m[1], { file: m[2].split('/').pop() as string, aspect: Number(m[3]) / Number(m[4]) });
  }
  return out;
}

describe('rendered store items', () => {
  const declared = declaredAspects();

  it('declares every render it ships', () => {
    const onDisk = readdirSync(ITEM_DIR).filter((f) => f.endsWith('.png')).sort();
    const referenced = [...declared.values()].map((v) => v.file).sort();
    expect(referenced).toEqual(onDisk);
  });

  it('states each render aspect as the PNG actually is', () => {
    expect(declared.size).toBeGreaterThan(0);
    for (const [id, { file, aspect }] of declared) {
      const { width, height } = pngSize(join(ITEM_DIR, file));
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

/** Mean RGB of the opaque pixels in an 8-bit RGBA PNG. */
function meanColor(file: string): [number, number, number] {
  const buf: any = readFileSync(file);
  let pos = 8;
  let width = 0;
  let height = 0;
  const idat: any[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const kind = buf.toString.call(buf, 'ascii', pos + 4, pos + 8);
    if (kind === 'IHDR') {
      width = buf.readUInt32BE(pos + 8);
      height = buf.readUInt32BE(pos + 12);
      if (buf[pos + 16] !== 8 || buf[pos + 17] !== 6) throw new Error(`${file}: not 8-bit RGBA`);
    } else if (kind === 'IDAT') {
      idat.push(buf.subarray(pos + 8, pos + 8 + len));
    } else if (kind === 'IEND') break;
    pos += len + 12;
  }
  const raw = zlib.inflateSync(Buf.concat(idat));
  const stride = width * 4;
  const out = Buf.alloc(height * stride);
  let sum = [0, 0, 0];
  let seen = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x += 1) {
      const a = x >= 4 ? out[y * stride + x - 4] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y > 0 ? out[(y - 1) * stride + x - 4] : 0;
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
      const i = y * stride + x * 4;
      if (out[i + 3] > 200) {
        sum = [sum[0] + out[i], sum[1] + out[i + 1], sum[2] + out[i + 2]];
        seen += 1;
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
  it('keeps every render legible against every pane it can land on', () => {
    const theme = readFileSync(join(ROOT, 'src', 'ui', 'theme.ts')).toString();
    const panes = [...theme.matchAll(/(\w+Pane): '(#[0-9A-Fa-f]{6})'/g)].map((m) => ({
      name: m[1],
      rgb: hexRgb(m[2]),
    }));
    // Five categories; if one is dropped the shop lost a section, so say so here.
    expect(panes.length).toBe(5);

    const items = readdirSync(ITEM_DIR).filter((f) => f.endsWith('.png'));
    expect(items.length).toBeGreaterThan(0);
    const worst: string[] = [];
    for (const file of items) {
      const mean = meanColor(join(ITEM_DIR, file));
      for (const pane of panes) {
        const ratio = contrast(mean, pane.rgb as [number, number, number]);
        if (ratio < 3) worst.push(`${file} on ${pane.name}: ${ratio.toFixed(2)}:1`);
      }
    }
    expect(worst).toEqual([]);
  });
});
