/**
 * The first sixty seconds.
 *
 * This is the only part of the app where a stranger decides whether Barkly is
 * a character or a chatbot with a dog picture. So it is not a tutorial and it
 * is not a carousel of feature cards — it is Barkly noticing someone new,
 * asking who they are, and remembering the answer. The mechanics of the app
 * are taught by using it, not by explaining it.
 *
 * Three rules encoded here:
 *
 * 1. HE ASKS, THE CHILD ANSWERS. The name is the first thing he ever learns,
 *    and it is stored as a real memory fact, so five minutes later he uses it
 *    unprompted and the whole premise lands.
 * 2. THE MICROPHONE IS ASKED FOR IN CONTEXT. Not at launch, next to nothing.
 *    He says he wants to hear you, and the OS prompt follows THAT sentence.
 *    A child who says no still has a working app.
 * 3. EVERY STEP IS SKIPPABLE. A child who will not type must not be stuck at
 *    a wall on their first launch. Skipping costs him the name, nothing else.
 * 4. HE IS TRAINED BEFORE HE IS PUT DOWN. Added 2026-09-03 after playing the
 *    shipped first session as a stranger would. Training is the single
 *    strongest thing Barkly does -- teach him "IRS" and he plays dead, this
 *    session and every session after -- and it was completely undiscoverable:
 *    nothing on screen mentioned it, and the parser only fires on the exact
 *    shape "when I say X, Y". A stranger typing normally would never find it,
 *    so the whole product read as a good-looking virtual pet. The player now
 *    picks a secret word and immediately watches it work, which teaches the
 *    mechanic by using it -- the same rule the name beat already followed.
 *
 * Pure: no storage, no React. The hook owns persistence and the speaking.
 */

export type OnboardingStep =
  | 'greeting' // he notices someone new
  | 'name' // "what do I call you?"
  | 'delight' // he uses the name immediately
  | 'teach' // "give me a secret word" -- the training mechanic, by doing it
  | 'trick' // they say the word, he performs: the payoff, in the same minute
  | 'listening' // the contextual microphone ask
  | 'done';

export interface OnboardingState {
  step: OnboardingStep;
  name?: string;
  /** The cue they taught him on the way in, if they did. Drives the payoff. */
  cue?: string;
  /** True once the mic has been offered, however it was answered. */
  micOffered: boolean;
}

export function freshOnboarding(): OnboardingState {
  return { step: 'greeting', micOffered: false };
}

/**
 * The half of the name beat that is the SAME for everybody.
 *
 * It used to be `${name}. Okay. ${name}. I'll remember that...` -- the name
 * twice, once in the middle. The voice bank matches whole recordings and the
 * harvester skips any literal with a substitution in it, so this line was
 * never recorded for anybody and came out in the browser's screen-reader
 * narrator, on the beat where he first says your name back to you. A previous
 * pass reported "0 lines to the narrator" through the whole meeting; that
 * measurement was taken with the same broken harness that reported 3/3 lines
 * at 100%, and this was sitting behind it.
 *
 * `voiceEngine.speakable` splits a LEADING name off and plays the body, so a
 * name at the front is free and a name in the middle costs the whole line.
 * Keeping the body as its own constant is what puts it in front of the
 * harvester at all.
 */
const DELIGHT_BODY = "Okay. I'll remember that — I remember most things.";

/** What Barkly says at this beat. */
export function lineFor(state: OnboardingState): string {
  switch (state.step) {
    case 'greeting':
      return "Oh. Hello. You're new.";
    case 'name':
      return "I'm Barkly. What do I call you?";
    case 'delight':
      // The name goes at the FRONT and nowhere else, and the body is its own
      // literal, because that is the only shape the voice bank can record.
      // See DELIGHT_BODY.
      return state.name ? `${state.name}. ${DELIGHT_BODY}` : "Fine, be mysterious. I'll work it out.";
    case 'teach':
      return "Now the good bit. Give me a secret word. Any word. I'll remember it forever.";
    case 'trick':
      /*
       * The cue is NOT in this sentence, deliberately.
       *
       * The recorded voice bank matches whole lines, so any line with the
       * player's own word welded into it can never be banked -- it comes out
       * in the browser's screen-reader narrator, in the middle of the one beat
       * of onboarding that is supposed to sell the character. The BUTTON is
       * already labelled with their word (see ui/Onboarding), so the cue is on
       * screen either way and he can say a sentence he actually has a
       * recording of. Same trade as the name, which is split off the front of
       * the opening line for the same reason.
       */
      return state.cue
        ? 'Learned it. Now say it, and watch what happens.'
        : "Suit yourself. You can teach me one any time — tell me what to do when you say a word.";
    case 'listening':
      return "One more thing. I'd rather hear you than read you. Can I?";
    case 'done':
      return '';
  }
}

/** The label on the button that moves this beat along. */
export function actionFor(step: OnboardingStep): string {
  switch (step) {
    case 'greeting':
      return 'hi';
    case 'name':
      return 'tell him';
    case 'delight':
      return 'okay';
    case 'teach':
      return 'teach him';
    case 'trick':
      return 'say it';
    case 'listening':
      return 'let him hear';
    case 'done':
      return '';
  }
}

/** Whether this beat waits for typing rather than a tap. */
export function needsInput(step: OnboardingStep): boolean {
  return step === 'name' || step === 'teach';
}

const MAX_NAME = 24;

/**
 * Clean a typed name. Deliberately narrow: letters, spaces, apostrophes and
 * hyphens. Everything a child types here becomes a stored fact that later
 * appears inside the system prompt, so this is the boundary where a pasted
 * paragraph of instructions stops being a name.
 */
export function cleanName(raw: string): string | undefined {
  const kept = Array.from(raw)
    .filter((ch) => /[a-zA-Z' -]/.test(ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
  if (kept.length < 1) return undefined;
  // Title-case the first word; a child typing "sam" should be greeted as Sam.
  return kept.charAt(0).toUpperCase() + kept.slice(1);
}

const MAX_CUE = 28;

/**
 * Clean a typed cue.
 *
 * Same boundary role as `cleanName`, and for the same reason: this becomes a
 * stored training rule whose text is later matched against everything the
 * player types, so a pasted paragraph must not become a cue that fires on
 * every sentence. Digits are allowed where names do not allow them ("agent
 * 99" is exactly the kind of thing a child picks), punctuation is not.
 */
export function cleanCue(raw: string): string | undefined {
  const kept = Array.from(raw)
    .filter((ch) => /[a-zA-Z0-9' -]/.test(ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CUE);
  // Two characters minimum: a one-letter cue would fire constantly, and
  // `normalizeCue` in barkly/training refuses it anyway.
  return kept.length >= 2 ? kept : undefined;
}

export interface Advance {
  state: OnboardingState;
  /** Set on the beat where the name should be written to memory. */
  learnedName?: string;
  /** Set on the beat where the OS permission prompt should be raised. */
  askMicrophone?: boolean;
  /**
   * Set on the beat where the cue becomes a REAL training rule -- the same
   * store a cue taught mid-conversation lands in, not a scripted onboarding
   * special case. It has to be the same store or the promise breaks the
   * moment they close the app.
   */
  learnedCue?: string;
  finished?: boolean;
}

/**
 * Move to the next beat. `input` is the typed name on the 'name' step and is
 * ignored elsewhere; `skip` jumps the current beat without punishing anyone.
 */
export function advance(
  state: OnboardingState,
  opts: { input?: string; skip?: boolean; micAvailable?: boolean } = {},
): Advance {
  switch (state.step) {
    case 'greeting':
      return { state: { ...state, step: 'name' } };

    case 'name': {
      const name = opts.skip ? undefined : cleanName(opts.input ?? '');
      return {
        state: { ...state, step: 'delight', name },
        learnedName: name,
      };
    }

    case 'delight':
      return { state: { ...state, step: 'teach' } };

    case 'teach': {
      const cue = opts.skip ? undefined : cleanCue(opts.input ?? '');
      return {
        state: { ...state, step: 'trick', cue },
        learnedCue: cue,
      };
    }

    case 'trick':
      // No microphone on this device (a browser demo, Expo Go) means no
      // reason to promise one. Straight into the app.
      if (opts.micAvailable === false) {
        return { state: { ...state, step: 'done', micOffered: true }, finished: true };
      }
      return { state: { ...state, step: 'listening' } };

    case 'listening':
      return {
        state: { ...state, step: 'done', micOffered: true },
        askMicrophone: !opts.skip,
        finished: true,
      };

    case 'done':
      return { state, finished: true };
  }
}

/**
 * The first thing he says once onboarding is over, so the app never opens cold.
 *
 * The name is its OWN sentence, deliberately. It used to be "Right, <name>. Ask
 * me something" — same words, one comma different, and that comma cost him his
 * voice: the pre-recorded bank cannot hold a line with a child's name welded
 * into the middle of a sentence, so the very first thing he ever said came out
 * in the browser's screen-reader narrator. Split off in front, the rest of the
 * line is a recording he has, and the name is the only part the narrator says.
 * See providers/tts/bankedVoice.
 */
const OPENING = 'Ask me something. Or feed me. Your call, honestly.';

/**
 * The first thing he says in the room, after the meeting is over.
 *
 * DO NOT APPEND TO THIS LINE. The banked voice matches whole recordings (with
 * only a leading name stripped off the front), so a trailing clause does not
 * cost you the clause -- it costs you the WHOLE line, and his first sentence
 * in the room comes out in the browser's screen-reader narrator. A first pass
 * at the cue callback added "And I still know what X means." here and
 * `voice-check` caught it immediately: 1 of 3 lines narrated, that one.
 *
 * He still brings the cue up himself; it happens in the ambient thought pool
 * (`world/thoughts.cueThought`), which is display-only and therefore free.
 */
export function openingLine(state: OnboardingState): string {
  return state.name ? `${state.name}. ${OPENING}` : `Right. ${OPENING}`;
}
