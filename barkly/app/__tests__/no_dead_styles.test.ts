/**
 * A stylesheet with nothing referencing it.
 *
 * The redesign moved his speech, his thought and the NPC's line into one
 * panel, and left FIFTEEN style entries behind in BarklyRoom.tsx —
 * `bubbleTail`, `thoughtDot1`, `npcBubbleBand` and the rest — describing
 * elements that no longer render. Nothing failed: dead style is valid style.
 *
 * That residue is a real part of what "this looks like AI vibe code" means.
 * The next person reading the file cannot tell which half of the stylesheet is
 * the design and which half is sediment, so they copy from whichever they hit
 * first. This test makes the deletion part of the change that removed the
 * element, instead of a cleanup nobody schedules.
 */

declare const require: (m: string) => any;
declare const __dirname: string;
const { readdirSync, readFileSync, statSync } = require('fs') as {
  readdirSync: (p: string) => string[];
  readFileSync: (p: string, enc: string) => string;
  statSync: (p: string) => { isDirectory(): boolean };
};
const { join } = require('path') as { join: (...p: string[]) => string };

const UI = join(__dirname, '..', 'src', 'ui');

function files(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

describe('no dead styles', () => {
  for (const file of files(UI)) {
    const src = readFileSync(file, 'utf8');
    const at = src.indexOf('StyleSheet.create({');
    if (at < 0) continue;
    const short = file.slice(file.indexOf('src/'));

    it(`${short}: every style is used`, () => {
      const body = src.slice(at);
      const before = src.slice(0, at);
      // Top-level keys only: two spaces of indent inside `create({`.
      const keys = [...body.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*): /gm)].map((m) => m[1]);
      const unused = keys.filter((k) => !new RegExp(`styles\\.${k}\\b`).test(before));
      expect(unused).toEqual([]);
    });
  }
});
