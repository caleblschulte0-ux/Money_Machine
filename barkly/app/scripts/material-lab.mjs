#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const outDir = resolve(process.argv[2] || 'art-review/material-lab');
await mkdir(outDir, { recursive: true });

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Barkly Material Lab</title><style>
:root{--bg:#1b1511;--cream:#fff4d9;--ink:#30231b;--shadow:#120d0a;--wood:#8b572f;--woodEdge:#4b2e1f;--woodHi:#e2ad72;--aqua:#4bc8ee;--aquaEdge:#2189ae;--coral:#ff7769;--coralEdge:#b74740;--violet:#a967dd;--violetEdge:#674097;--brass:#dca83e;--brassEdge:#795013}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% 0,#4a2d1f 0,#1b1511 48%,#100b08 100%);color:#fff7e9;font:15px system-ui,sans-serif;padding:28px}.wrap{max-width:1180px;margin:auto}h1{margin:0 0 8px;font-size:34px}p{color:#cdbda8;margin:0 0 24px}.grid{display:grid;grid-template-columns:repeat(3,minmax(230px,1fr));gap:22px}.card{border-radius:28px;padding:18px;background:#2b211b;border:1px solid #4f3a2e;min-height:240px;box-shadow:0 22px 50px #0008}.sample{height:132px;border-radius:26px;position:relative;overflow:hidden;margin-bottom:14px;transform:translateZ(0)}.sample:after{content:'';position:absolute;left:10%;right:10%;top:8%;height:14%;border-radius:999px;background:#fff;opacity:.28;filter:blur(.4px)}.sample:before{content:'';position:absolute;left:12%;right:12%;bottom:5%;height:18%;border-radius:999px;background:#000;opacity:.2;filter:blur(8px)}.cream{background:linear-gradient(#fffdf2,#ffe9ba);border:4px solid #d7b87d;box-shadow:inset 0 -10px 0 #e3c58d,0 10px 18px #0005}.wood{background:linear-gradient(145deg,var(--woodHi),var(--wood) 42%,#6a3f28);border:4px solid var(--woodEdge);box-shadow:inset 0 -14px 0 #593521,0 10px 18px #0006}.rubber{background:radial-gradient(circle at 34% 24%,#ff8275 0 12%,var(--coral) 13% 55%,var(--coralEdge) 78%);border:4px solid #81312d;box-shadow:inset -10px -14px 0 #9d3c36,0 12px 20px #0005}.plastic{background:linear-gradient(155deg,#9beaff 0 18%,var(--aqua) 19% 62%,var(--aquaEdge) 100%);border:4px solid #176c8c;box-shadow:inset 0 -12px 0 #2d9dc4,0 12px 20px #0005}.plush{background:linear-gradient(145deg,#c38af0,var(--violet));border:4px solid var(--violetEdge);box-shadow:inset 0 -10px 0 #8652b7,0 10px 20px #0005}.brass{background:radial-gradient(circle at 30% 20%,#fff1ad 0 10%,#edc758 22%,var(--brass) 60%,var(--brassEdge) 100%);border:4px solid #5d3b0e;box-shadow:inset 0 -10px 0 #9b691e,0 10px 20px #0005}.glass{background:linear-gradient(145deg,#ffffffaa 0 8%,#b8ecf999 12% 45%,#6cc9e477 70%,#2883a055 100%);border:4px solid #8ed6e7aa;box-shadow:inset 0 -8px 12px #165d7555,0 12px 20px #0005}.meta{display:flex;justify-content:space-between;gap:14px;align-items:start}.meta b{font-size:18px}.meta span{font-size:12px;color:#bfae9a}.rules{margin-top:26px;padding:20px;border:1px dashed #82664e;border-radius:22px;background:#211812}.rules strong{color:#ffe49c}.pillrow{display:flex;gap:14px;margin-top:22px}.pill{padding:12px 20px;border-radius:999px;color:#24170f;font-weight:800;box-shadow:inset 0 -6px 0 #0002,0 8px 14px #0005;border:3px solid #0003}.pill.a{background:linear-gradient(#8ee7ff,#43c7ef)}.pill.b{background:linear-gradient(#fff8e9,#f0d4a9)}.pill.c{background:linear-gradient(#ffc0b7,#ff7769)}
@media(max-width:760px){.grid{grid-template-columns:1fr 1fr}}
</style></head><body><div class="wrap"><h1>Barkly material lab</h1><p>One lighting/material grammar for UI and world props. Tune here before spreading it across scenes.</p><div class="grid">
${[
['cream','Cream enamel','Warm base · darker molded edge · narrow white highlight'],
['wood','Painted wood','Readable grain-color family · warm lip · deep front face'],
['rubber','Soft rubber','Round specular highlight · darker lower hemisphere · strong contact shadow'],
['plastic','Candy plastic','Bright controlled highlight · saturated body · restrained edge shade'],
['plush','Plush / fabric','Softer contrast · broad highlight · less glossy than plastic'],
['brass','Brass / reward metal','Tiny hot highlight · warm midtone · deep brown edge'],
['glass','Toy glass','Transparent color · edge tint · reflected highlight, never flat cyan'],
].map(([c,n,d])=>`<section class="card"><div class="sample ${c}"></div><div class="meta"><b>${n}</b><span>${d}</span></div></section>`).join('')}
</div><div class="rules"><strong>Material rule:</strong> every major object gets a confident base, one darker molded edge, one controlled highlight, and a contact shadow. Gloss level communicates the material; saturation alone does not.</div><div class="pillrow"><div class="pill a">Talk</div><div class="pill b">Type</div><div class="pill c">Reward</div></div></div></body></html>`;

await writeFile(resolve(outDir, 'index.html'), html);
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 980 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({ path: resolve(outDir, 'material-lab.png'), fullPage: true });
await browser.close();
console.log(`material lab written to ${outDir}`);
