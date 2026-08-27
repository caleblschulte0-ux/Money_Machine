/**
 * What Barkly says when something goes wrong.
 *
 * Every failure a child can reach has a line here, and none of them is an
 * error message wearing a costume. The rules:
 *
 * - No status codes, no "provider", no "failed", no "unavailable", no
 *   apologising in a support-desk voice. He is a slightly rude little dog,
 *   not a dialog box.
 * - It is never the child's fault, and it is never framed as broken. "I lost
 *   that" is a dog missing a sentence; "Speech recognition error" is a bug
 *   report a seven-year-old cannot act on.
 * - Variety, so a repeated failure does not sound like a loop. A dog who says
 *   the exact same sentence three times is a dog you stop believing in.
 *
 * Dialogue-path failures have their own vocabulary in
 * providers/errors.ts (they need `recoverable` / `shouldFallback` too); this
 * covers everything else — the microphone, hearing, and storage.
 */

export type Mishap =
  | 'mic_denied' // the OS said no
  | 'mic_broken' // permission granted, capture still failed
  | 'heard_nothing' // he listened and got silence
  | 'memory_lost' // stored state was unreadable
  | 'memory_unwritable'; // we cannot save what just happened

const LINES: Record<Mishap, string[]> = {
  mic_denied: [
    "I can't hear you. Something about ears. Check your settings?",
    'My ears are switched off, apparently. Not my choice.',
  ],
  mic_broken: [
    'My ears did a weird thing. Try again?',
    "Say that again — I wasn't listening properly. I admit it.",
  ],
  heard_nothing: [
    'I heard nothing. Which is fine. Rude, but fine.',
    "Nothing? Okay. I'll wait.",
    'Was that a very quiet thing, or nothing? Say it louder.',
  ],
  memory_lost: [
    "I've forgotten some stuff. Don't ask me how. Tell me about you again?",
    "Something's gone from my head. Remind me — who are you?",
  ],
  memory_unwritable: [
    "I'm not going to remember this bit. Sorry. Say the important parts twice.",
    "That one's not sticking. My head's full or something.",
  ],
};

/**
 * A line for this mishap, avoiding the one used last time so a repeated
 * failure does not sound like a loop.
 */
export function mishapLine(kind: Mishap, previous?: string | null): string {
  const pool = LINES[kind];
  const fresh = pool.filter((l) => l !== previous);
  const options = fresh.length > 0 ? fresh : pool;
  return options[Math.floor(Math.random() * options.length)];
}

/** Every line, for the test that asserts none of them sounds like a computer. */
export const ALL_MISHAP_LINES: string[] = Object.values(LINES).flat();
