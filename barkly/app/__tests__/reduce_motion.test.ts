declare const require: (m: string) => any;
declare const __dirname: string;

const { readFileSync, readdirSync, statSync } = require('fs') as {
  readFileSync: (p: string, e: string) => string;
  readdirSync: (p: string) => string[];
  statSync: (p: string) => { isDirectory: () => boolean };
};
const { join } = require('path') as { join: (...p: string[]) => string };

const SCENES = join(__dirname, '..', 'src', 'ui', 'scenes');

function sceneFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sceneFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/*
 * THE SETTING EXISTED AND REACHED NOTHING THAT RENDERS.
 *
 * The app had a correct reduce-motion implementation for a long time. It lived
 * in LivingScenes.tsx, which nothing had imported for a long time either, and
 * the scene files that actually run carried their own copy of the same hook
 * WITHOUT the check. So a player who asked their phone to stop moving things
 * got a swaying, drifting, camera-pushing world anyway, and the app looked
 * compliant to anyone reading the wrong file.
 *
 * The policy, deliberately not "freeze everything": what stops is the WORLD --
 * sway, bob, drifting light, dust, the camera push. What does NOT stop is
 * Barkly's own breathing and idle performance, because the setting exists for
 * vestibular triggers and a pet frozen mid-breath reads as a crash rather than
 * as consideration. That distinction is why this is a test about scene files
 * and not about every Animated.loop in the app.
 */
describe('reduce motion reaches the scenes that actually render', () => {
  const files = sceneFiles(SCENES);

  it('found the scene files', () => {
    expect(files.length).toBeGreaterThan(3);
  });

  it('gates every looping animation in every scene file', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      if (!src.includes('Animated.loop')) continue;
      const gated = /reduceMotion|\bstill\b/.test(src);
      if (!gated) offenders.push(file.split('/').pop()!);
    }
    expect(offenders).toEqual([]);
  });

  it('keeps one implementation of the setting, not one per file', () => {
    const owners = files.filter((f) => readFileSync(f, 'utf8').includes('AccessibilityInfo'));
    expect(owners).toEqual([]);
    const motion = readFileSync(join(__dirname, '..', 'src', 'ui', 'motion.ts'), 'utf8');
    expect(motion).toContain('AccessibilityInfo');
    expect(motion).toContain('reduceMotionChanged');
  });
});
