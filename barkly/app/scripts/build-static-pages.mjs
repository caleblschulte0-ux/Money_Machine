#!/usr/bin/env node
/**
 * The two pages App Store Connect requires a URL for: the privacy policy and
 * a support page. Both are published on the same GitHub Pages site as the
 * playable build, so they exist the moment this branch is pushed and cost
 * nothing to host:
 *
 *   https://caleblschulte0-ux.github.io/Money_Machine/privacy/
 *   https://caleblschulte0-ux.github.io/Money_Machine/support/
 *
 * The privacy page is RENDERED FROM docs/PRIVACY.md, not written twice -- that
 * document is the factual account of what the software does with data, and
 * it says on its own face that it is not a compliance claim. Publishing it
 * verbatim is the honest version of a privacy policy this project can make;
 * counsel edits the markdown, the page follows.
 *
 *   node scripts/build-static-pages.mjs [--out dist]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const APP = resolve(new URL('..', import.meta.url).pathname);
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const outDir = resolve(APP, arg('--out', 'dist'));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

/** A small, dependency-free markdown subset: the constructs PRIVACY.md uses. */
export function markdownToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;
  const para = [];
  const flushPara = () => {
    if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para.length = 0; }
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { flushPara(); i += 1; continue; }
    if (/^---+\s*$/.test(line)) { flushPara(); out.push('<hr>'); i += 1; continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      const id = h[2].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      out.push(`<h${h[1].length} id="${id}">${inline(h[2])}</h${h[1].length}>`);
      i += 1; continue;
    }
    if (/^\s*\|/.test(line)) {
      flushPara();
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(lines[i]); i += 1; }
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const [head, , ...body] = rows;
      out.push('<table><thead><tr>' + cells(head).map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>'
        + body.map((r) => '<tr>' + cells(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('')
        + '</tbody></table>');
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushPara();
      out.push('<ul>');
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*[-*]\s+/, '');
        i += 1;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i])) { item += ' ' + lines[i].trim(); i += 1; }
        out.push(`<li>${inline(item)}</li>`);
      }
      out.push('</ul>');
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      flushPara();
      out.push('<ol>');
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*\d+\.\s+/, '');
        i += 1;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) { item += ' ' + lines[i].trim(); i += 1; }
        out.push(`<li>${inline(item)}</li>`);
      }
      out.push('</ol>');
      continue;
    }
    if (/^```/.test(line)) {
      flushPara();
      const code = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i += 1; }
      i += 1;
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
      continue;
    }
    para.push(line.trim());
    i += 1;
  }
  flushPara();
  return out.join('\n');
}

const STYLE = `
  :root { color-scheme: light; }
  body { margin: 0; padding: 32px 20px 64px; background: #FBF7EE; color: #2B2620; font: 16px/1.55 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  main { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 30px; line-height: 1.2; margin: 0 0 8px; }
  h2 { font-size: 22px; margin: 36px 0 10px; }
  h3 { font-size: 18px; margin: 24px 0 8px; }
  p, li { max-width: 68ch; }
  code { background: #F0E8D8; padding: 1px 5px; border-radius: 4px; font-size: 0.92em; }
  pre { background: #F0E8D8; padding: 12px 14px; border-radius: 8px; overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 15px; display: block; overflow-x: auto; }
  th, td { text-align: left; vertical-align: top; padding: 8px 10px; border-bottom: 1px solid #E4DCCB; }
  th { background: #F0E8D8; }
  a { color: #8A5A1E; }
  hr { border: 0; border-top: 1px solid #E4DCCB; margin: 32px 0; }
  .meta { color: #6B6258; font-size: 14px; margin-bottom: 28px; }
  nav a { margin-right: 16px; }
`;

const page = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><style>${STYLE}</style></head>
<body><main>
<nav><a href="../">Play Barkly</a><a href="../privacy/">Privacy</a><a href="../support/">Support</a></nav>
${body}
</main></body></html>
`;

const privacyMd = await readFile(join(APP, '..', 'docs', 'PRIVACY.md'), 'utf8');
const privacyHtml = page('Barkly — Privacy',
  `<p class="meta">Barkly privacy policy. This page is generated from the project's data-flow document and changes with it.</p>\n` + markdownToHtml(privacyMd));

const supportHtml = page('Barkly — Support', `
<h1>Barkly support</h1>
<p class="meta">Help with the Barkly app.</p>
<h2 id="contact">Contact</h2>
<p>Email <a href="mailto:caleblschulte0@gmail.com">caleblschulte0@gmail.com</a> with the word <strong>Barkly</strong> in the subject. Include your phone model and iOS version; do not include anything your child said to Barkly — it is not needed and it stays on your phone.</p>
<h2 id="the-microphone">The microphone</h2>
<p>Barkly listens only while the TALK button is held. If he cannot hear you, check Settings &rarr; Privacy &amp; Security &rarr; Microphone and Speech Recognition on your iPhone, and make sure Barkly is allowed. Without permission the app falls back to typing, so nothing is lost.</p>
<h2 id="deleting-everything">Deleting everything Barkly remembers</h2>
<p>In the app: Settings &rarr; For parents &rarr; <strong>Delete everything Barkly remembers</strong>. This is guarded by a short arithmetic question so a young child cannot do it by accident, and it cannot be undone. Deleting the app also removes everything, because all of it lives on the phone.</p>
<h2 id="what-leaves-the-phone">What leaves the phone</h2>
<p>The text of what you say (never the audio), plus the facts Barkly has learned, are sent to the dialogue service so he can answer. The full account is on the <a href="../privacy/">privacy page</a>.</p>
<h2 id="the-published-demo">The published web demo</h2>
<p>The version at this site runs an offline, scripted Barkly and cannot use a microphone. It exists for testing; the App Store app is the real one.</p>
`);

await mkdir(join(outDir, 'privacy'), { recursive: true });
await mkdir(join(outDir, 'support'), { recursive: true });
await writeFile(join(outDir, 'privacy', 'index.html'), privacyHtml);
await writeFile(join(outDir, 'support', 'index.html'), supportHtml);
console.log(`wrote ${outDir}/privacy/index.html and ${outDir}/support/index.html`);
