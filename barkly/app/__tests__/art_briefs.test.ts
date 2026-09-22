/**
 * The art briefs are how the world gets made now: the Blender pipeline cannot
 * produce what the concept sheet is (docs/ART_STYLE.md), so every on-screen
 * piece is generated from a brief by the image model that made the sheet.
 *
 * Two things must stay true, and both drifted before this test existed: every
 * piece the app shows has a character list (a prop without one renders
 * correctly and reads as dead -- the operator's own verdict), and
 * barkly/art/BRIEFS.md, the file a person actually pastes from, matches the
 * generator. Home's furniture lives in a second manifest that the generator
 * once never read, so its briefs could not be emitted at all.
 */
declare const require: (m: string) => any;
declare const __dirname: string;
const { execFileSync } = require('child_process') as {
  execFileSync: (cmd: string, args: string[], opts: object) => unknown;
};
const { join } = require('path') as { join: (...p: string[]) => string };

it('every on-screen piece has a brief, and the pack is current', () => {
  execFileSync('python3', [join(__dirname, '..', 'scripts', 'prop-briefs.py'), '--check'], {
    cwd: join(__dirname, '..'),
    stdio: 'pipe',
  });
});
