/**
 * The sounds the WORLD makes.
 *
 * Barkly shipped with a fully recorded speaking voice and no sound effects at
 * all -- no `assets/sfx`, no playback path, not a single call. He talked, and
 * everything he did was silent: eating, digging, levelling up, arriving
 * somewhere new. For a phone game aimed at children that is the largest single
 * gap in the product, and it is the one item on the visual-direction build
 * order that had never been started.
 *
 * IT RIDES THE VOCABULARY THAT ALREADY EXISTS. `ui/feel.ts` defines five
 * feelings -- touch, act, arrive, refuse, thump -- and they are already wired
 * at the places where something physical happens. Sound follows that same
 * vocabulary rather than growing a parallel one, so a `feel()` that is already
 * correct becomes audible for free and the two can never drift apart about
 * what counts as an event.
 *
 * THE AUDIO IS SYNTHESISED AND NOBODY HAS HEARD IT. `scripts/make-sfx.py`
 * builds each clip from a description of a physical event and checks it
 * numerically: duration, peak, a tail that ends in true silence, and a
 * spectral centroid in the band the description implies. That check has
 * already earned its keep -- `eat` and `dig` are meant to be dull and muffled
 * and came out brighter than the coin, because a one-pole filter is 6dB per
 * octave and barely a filter at all. The clips are deliberately plain, short
 * and quiet so that replacing them is a file swap and being wrong is cheap.
 */
import { createAudioPlayer } from 'expo-audio';

export type SfxName =
  | 'tap' | 'pop' | 'close' | 'coin' | 'levelup' | 'eat' | 'dig' | 'arrive' | 'nope';

const CLIPS: Record<SfxName, number> = {
  tap: require('../../assets/sfx/tap.wav'),
  pop: require('../../assets/sfx/pop.wav'),
  close: require('../../assets/sfx/close.wav'),
  coin: require('../../assets/sfx/coin.wav'),
  levelup: require('../../assets/sfx/levelup.wav'),
  eat: require('../../assets/sfx/eat.wav'),
  dig: require('../../assets/sfx/dig.wav'),
  arrive: require('../../assets/sfx/arrive.wav'),
  nope: require('../../assets/sfx/nope.wav'),
};

/**
 * One mute for the whole toy. Muting the dog mutes his world too -- the same
 * rule `feel.ts` states for haptics, for the same reason.
 */
let muted = false;
export function setSfxMuted(next: boolean): void {
  muted = next;
}

/*
 * A FLOOR BETWEEN REPEATS OF THE SAME SOUND.
 *
 * A child mashing the dog fires `touch` as fast as the screen samples, and
 * nine overlapping copies of one click is not nine times the feedback, it is
 * a fault noise. Per-name, so a coin during a dig is still both.
 */
const MIN_GAP_MS = 70;
const lastAt: Partial<Record<SfxName, number>> = {};

type Player = ReturnType<typeof createAudioPlayer>;
/*
 * The seam takes the NAME as well as the module id, because under jest every
 * asset resolves to the same number -- a test that asserted two different
 * clips played was comparing 1 with 1 and passing for the wrong reason until
 * it happened to fail.
 */
let makePlayer: (source: number, name: SfxName) => Player = (source) => createAudioPlayer(source);
/** Test seam: the unit tests must not open real audio devices. */
export function __setSfxPlayerFactory(fn: (source: number, name: SfxName) => Player): void {
  makePlayer = fn;
}

/*
 * Cleanup timers are held so they can be cancelled. Without this a fire-and-
 * forget sound keeps an event loop alive for 1.2s after the app is done with
 * it -- harmless in an app, but it hangs a jest run, which is how I noticed.
 */
const pending = new Set<ReturnType<typeof setTimeout>>();

export function playSfx(name: SfxName, now: number = Date.now()): void {
  if (muted) return;
  const previous = lastAt[name] ?? 0;
  if (now - previous < MIN_GAP_MS) return;
  lastAt[name] = now;
  try {
    const player = makePlayer(CLIPS[name], name);
    player.play();
    // Bounded cleanup. A clip that never reports finishing must not leak a
    // player, and nothing is waiting on this -- sound is fire-and-forget.
    const timer = setTimeout(() => {
      pending.delete(timer);
      try { player.remove(); } catch { /* already gone */ }
    }, 1200);
    pending.add(timer);
  } catch {
    // No audio device, autoplay blocked before the first gesture, a codec the
    // platform will not open. A missing sound never interrupts anything.
  }
}

/** For tests: forget the rate-limit history and drop pending cleanup timers. */
export function __resetSfx(): void {
  for (const key of Object.keys(lastAt) as SfxName[]) delete lastAt[key];
  for (const timer of pending) clearTimeout(timer);
  pending.clear();
}
