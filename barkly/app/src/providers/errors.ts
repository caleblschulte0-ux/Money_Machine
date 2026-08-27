/**
 * Failure vocabulary for everything that can go wrong between a child speaking
 * and Barkly answering.
 *
 * Two rules this file exists to enforce:
 *
 * 1. A child never sees a stack trace, an HTTP status, or the word "provider".
 *    Every failure carries `barklyLine` — what the dog says about it, in his
 *    voice. "I lost that. Say it again."
 * 2. The code above can tell APART "try again" from "this will keep failing,
 *    fall back to the offline Barkly". That distinction is `recoverable` and
 *    `shouldFallback`, decided here once rather than re-guessed at each call.
 */

export type DialogueFailure =
  | 'offline' // no network at all
  | 'timeout' // we gave up waiting
  | 'rate_limited' // too fast, or the day's budget is gone
  | 'unavailable' // provider/proxy is down (5xx)
  | 'unauthorized' // bad or missing app token / key
  | 'bad_request' // we sent something the API refused — our bug
  | 'malformed' // a reply we could not understand
  | 'unknown';

interface FailureShape {
  /** Worth trying the same thing again shortly. */
  recoverable: boolean;
  /** The model path is not going to work now — use scripted Barkly instead. */
  shouldFallback: boolean;
  /** What Barkly says. Never technical, never alarming, always in character. */
  barklyLine: string;
}

const SHAPES: Record<DialogueFailure, FailureShape> = {
  offline: {
    recoverable: true,
    shouldFallback: true,
    barklyLine: "I can't hear the outside right now. Still here though.",
  },
  timeout: {
    recoverable: true,
    shouldFallback: false,
    barklyLine: 'I lost that. Say it again?',
  },
  rate_limited: {
    recoverable: true,
    shouldFallback: true,
    barklyLine: 'Slow down, slow down. One thing at a time.',
  },
  unavailable: {
    recoverable: true,
    shouldFallback: true,
    barklyLine: "My brain's being weird. Give me a second.",
  },
  unauthorized: {
    recoverable: false,
    shouldFallback: true,
    barklyLine: "Something's off with my end. Not your fault.",
  },
  bad_request: {
    recoverable: false,
    shouldFallback: true,
    barklyLine: "That got tangled up. Try saying it a different way?",
  },
  malformed: {
    recoverable: true,
    shouldFallback: false,
    barklyLine: 'Hm. I had a thought and then a bird went past.',
  },
  unknown: {
    recoverable: true,
    shouldFallback: true,
    barklyLine: 'I lost that. Say it again?',
  },
};

export class DialogueError extends Error {
  readonly kind: DialogueFailure;
  readonly status?: number;
  readonly recoverable: boolean;
  readonly shouldFallback: boolean;
  readonly barklyLine: string;

  constructor(
    kind: DialogueFailure,
    opts: { status?: number; cause?: unknown; forceFallback?: boolean } = {},
  ) {
    const shape = SHAPES[kind];
    super(`dialogue ${kind}${opts.status ? ` (${opts.status})` : ''}`);
    this.name = 'DialogueError';
    this.kind = kind;
    this.status = opts.status;
    this.recoverable = shape.recoverable;
    // The backend can insist on a fallback even where the status alone would
    // not imply one - it is the side that knows the budget is gone.
    this.shouldFallback = shape.shouldFallback || opts.forceFallback === true;
    this.barklyLine = shape.barklyLine;
  }
}

/** Map an HTTP status from the proxy (or Anthropic) onto our vocabulary. */
export function failureForStatus(status: number): DialogueFailure {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 408 || status === 504) return 'timeout';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'unavailable';
  if (status >= 400) return 'bad_request';
  return 'unknown';
}

/** Whatever a failure turns out to be, there is always a line for the dog. */
export function barklyLineFor(err: unknown): string {
  if (err instanceof DialogueError) return err.barklyLine;
  return SHAPES.unknown.barklyLine;
}
