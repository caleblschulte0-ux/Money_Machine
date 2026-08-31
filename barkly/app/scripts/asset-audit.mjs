#!/usr/bin/env node

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] || 'assets');
const reportPath = resolve(process.argv[3] || 'art-review/asset-audit.txt');
const rows = [];
let failures = 0;
let warnings = 0;

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else await inspect(full);
  }
}

function pngInfo(buf) {
  if (buf.length < 26 || buf.toString('ascii', 1, 4) !== 'PNG') return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const colorType = buf[25];
  const alpha = colorType === 4 || colorType === 6;
  return { width, height, alpha };
}

async function inspect(path) {
  const ext = extname(path).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return;
  const info = await stat(path);
  const rel = relative(root, path);
  const flags = [];
  let dimensions = 'unknown';
  if (/\s/.test(rel)) flags.push('space-in-name');
  if (info.size > 2_500_000) {
    flags.push('FAIL >2.5MB');
    failures += 1;
  } else if (info.size > 1_000_000) {
    flags.push('WARN >1MB');
    warnings += 1;
  }

  if (ext === '.png') {
    const buf = await readFile(path);
    const meta = pngInfo(buf);
    if (meta) {
      dimensions = `${meta.width}x${meta.height}${meta.alpha ? ' alpha' : ''}`;
      if (meta.width > 4096 || meta.height > 4096) {
        flags.push('FAIL >4096px');
        failures += 1;
      } else if (meta.width > 2048 || meta.height > 2048) {
        flags.push('WARN >2048px');
        warnings += 1;
      }
    }
  }

  rows.push(`${rel}\t${dimensions}\t${(info.size / 1024).toFixed(1)}KB${flags.length ? `\t${flags.join(', ')}` : ''}`);
}

await walk(root);
rows.sort();
const report = [
  `Barkly asset audit`,
  `root: ${root}`,
  `files: ${rows.length}`,
  `warnings: ${warnings}`,
  `failures: ${failures}`,
  '',
  'path\tdimensions\tsize\tflags',
  ...rows,
  '',
].join('\n');

await writeFile(reportPath, report).catch(async (err) => {
  if (err.code !== 'ENOENT') throw err;
  const { mkdir } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, report);
});

console.log(report);
if (failures) process.exit(1);
