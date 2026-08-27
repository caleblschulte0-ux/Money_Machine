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
 *
 * Pure: no storage, no React. The hook owns persistence and the speaking.
 */

export type OnboardingStep =
  | 'greeting' // he notices someone new
  | 'name' // "what do I call you?"
  | 'delight' // he uses the name immediately
  | 'listening' // the contextual microphone ask
  | 'done';

export interface OnboardingState {
  step: OnboardingStep;
  name?: string;
  /** True once the mic has been offered, however it was answered. */
  micOffered: boolean;
}

export function freshOnboarding(): OnboardingState {
  return { step: 'greeting', micOffered: false };
}

/** What Barkly says at this beat. */
export function lineFor(state: OnboardingState): string {
  switch (state.step) {
    case 'greeting':
      return "Oh. Hello. You're new.";
    case 'name':
      return "I'm Barkly. What do I call you?";
    case 'delight':
      return state.name
        ? `${state.name}. Okay. ${state.name}. I'll remember that — I remember most things.`
        : "Fine, be mysterious. I'll work it out.";
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
    case 'listening':
      return 'let him hear';
    case 'done':
      return '';
  }
}

/** Whether this beat waits for typing rather than a tap. */
export function needsInput(step: OnboardingStep): boolean {
  return step === 'name';
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

export interface Advance {
  state: OnboardingState;
  /** Set on the beat where the name should be written to memory. */
  learnedName?: string;
  /** Set on the beat where the OS permission prompt should be raised. */
  askMicrophone?: boolean;
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

/** The first thing he says once onboarding is over, so the app never opens cold. */
export function openingLine(state: OnboardingState): string {
  if (state.name) {
    return `Right, ${state.name}. Ask me something. Or feed me. Your call, honestly.`;
  }
  return 'Right. Ask me something. Or feed me. Your call, honestly.';
}
