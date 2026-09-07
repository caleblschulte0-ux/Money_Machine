declare const require: (m: string) => any;
declare const __dirname: string;

const { readFileSync, readdirSync, statSync } = require('fs') as {
  readFileSync: (p: string, e: string) => string;
  readdirSync: (p: string) => string[];
  statSync: (p: string) => { isDirectory: () => boolean };
};
const { join } = require('path') as { join: (...p: string[]) => string };

const SRC = join(__dirname, '..', 'src');

function srcFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) srcFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/*
 * A SOUND NOBODY PLAYS IS NOT A SOUND, IT IS 8KB OF BUNDLE.
 *
 * `close.wav` was synthesised, listed in SfxName, required into CLIPS, inlined
 * into every build and never played once -- sheets opened with a sound and shut
 * in silence. Nothing could see it: the clip exists, the type is exhaustive,
 * the module is imported, and the unit tests for the audio layer all pass,
 * because a clip that is never requested is not a failure of anything they
 * assert.
 *
 * An interaction that answers when you start it and says nothing when you
 * finish it reads as dropped input, which matters most in a game a child taps
 * at speed.
 */
describe('every sound in the bank has somewhere it plays', () => {
  const sfx = readFileSync(join(SRC, 'audio', 'sfx.ts'), 'utf8');
  const names = (sfx.match(/^export type SfxName =\n?([\s\S]*?);/m)?.[1] ?? '')
    .split('|')
    .map((s) => s.trim().replace(/['\n\s]/g, ''))
    .filter(Boolean);

  const callers = srcFiles(SRC)
    .filter((f) => !f.endsWith(join('audio', 'sfx.ts')))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');

  it('read the sound names', () => {
    expect(names.length).toBeGreaterThan(5);
    expect(names).toContain('close');
  });

  it('has a call site for each one', () => {
    // Either playSfx('name') directly, or feel(kind, 'name'), or the Feel map.
    const unplayed = names.filter((n) => !new RegExp(`'${n}'`).test(callers));
    expect(unplayed).toEqual([]);
  });
});
