/**
 * Accessibility, held by the source rather than by good intentions.
 *
 * The three controls this whole app runs on — play, feed, sleep — plus the
 * talk button, the text field, Barkly himself and every NPC shipped with no
 * accessibility role and no label. With VoiceOver or TalkBack on, the app
 * announced nothing and the buttons could not be found at all: not "hard to
 * use", unusable.
 *
 * A one-off pass fixes that once. This test is what keeps the next Pressable
 * from arriving bare, which is how it happened the first time.
 */

// This app has no @types/node (it is an Expo app, and pulling Node's globals
// in changes typings across the whole project). The test needs exactly three
// fs calls and a path join, so it declares just those.
declare const require: (m: string) => any;
declare const __dirname: string;
const { readdirSync, readFileSync, statSync } = require('fs') as {
  readdirSync: (p: string) => string[];
  readFileSync: (p: string, enc: string) => string;
  statSync: (p: string) => { isDirectory(): boolean };
};
const { join } = require('path') as { join: (...parts: string[]) => string };

const UI_DIR = join(__dirname, '..', 'src', 'ui');

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/**
 * Every `<Pressable` opening tag in the file, as raw text. Crude on purpose:
 * a parser here would be a second thing to maintain, and the question this
 * asks — "does this tag carry any accessibility props at all" — survives being
 * answered crudely.
 */
function pressableTags(source: string): string[] {
  const tags: string[] = [];
  let i = source.indexOf('<Pressable');
  while (i !== -1) {
    // Walk to the end of the opening tag, ignoring '>' inside braces/strings.
    let depth = 0;
    let quote: string | null = null;
    let j = i;
    for (; j < source.length; j++) {
      const c = source[j];
      if (quote) {
        if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    tags.push(source.slice(i, j + 1));
    i = source.indexOf('<Pressable', j);
  }
  return tags;
}

describe('every tappable thing announces itself', () => {
  const files = tsxFiles(UI_DIR);

  it('finds the UI to check (a passing test over zero files is not a pass)', () => {
    expect(files.length).toBeGreaterThan(5);
    expect(files.flatMap((f) => pressableTags(readFileSync(f, 'utf8'))).length).toBeGreaterThan(15);
  });

  for (const file of files) {
    const short = file.slice(file.indexOf('src/'));
    it(`${short}: no bare Pressable`, () => {
      // Either it announces itself, or it opts out ON PURPOSE. A backdrop or
      // a tap-swallowing wrapper is not a control and should not be in the
      // screen-reader order — but saying so has to be explicit.
      const bare = pressableTags(readFileSync(file, 'utf8')).filter(
        (tag) => !/accessibilityRole|accessibilityLabel|accessible=\{false\}/.test(tag),
      );
      // The message matters more than the assertion: it has to say WHICH tag.
      expect(bare.map((t) => t.replace(/\s+/g, ' ').slice(0, 90))).toEqual([]);
    });
  }
});
