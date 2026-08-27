/**
 * The provider the app actually talks to: the real model, with the offline
 * Barkly standing behind it.
 *
 * The brief's rule is that the scripted provider stays because Barkly should
 * not completely die during a service outage, but users should normally be
 * interacting with the actual model. That is exactly two behaviours:
 *
 * - A failure the backend calls terminal (budget gone, provider down, bad
 *   credentials) drops to scripted for THIS turn. The child still gets a dog.
 * - Repeated failures open a circuit breaker so the next few turns skip the
 *   doomed network call entirely instead of making the child wait 15 seconds
 *   to hear the same fallback line. It closes again on its own.
 *
 * What it does NOT do is hide the outage. `status()` reports which brain
 * answered and why, and the UI surfaces it in Barkly's voice, once.
 */

import { DialogueError } from '../errors';
import { DialogueProvider, DialogueRequest } from '../types';

export interface ResilientOptions {
  /** Consecutive terminal failures before the breaker opens. */
  threshold?: number;
  /** How long the breaker stays open before letting one request through. */
  cooldownMs?: number;
  now?: () => number;
  onFallback?: (err: DialogueError) => void;
}

export interface DialogueStatus {
  /** Which provider answered the most recent turn. */
  using: 'primary' | 'fallback';
  breakerOpen: boolean;
  consecutiveFailures: number;
  lastFailure?: DialogueError;
}

export function createResilientDialogue(
  primary: DialogueProvider,
  fallback: DialogueProvider,
  opts: ResilientOptions = {},
): DialogueProvider & { status(): DialogueStatus } {
  const threshold = opts.threshold ?? 2;
  const cooldownMs = opts.cooldownMs ?? 60_000;
  const now = opts.now ?? (() => Date.now());

  let failures = 0;
  let openedAt = 0;
  let using: DialogueStatus['using'] = 'primary';
  let lastFailure: DialogueError | undefined;

  const breakerOpen = () => failures >= threshold && now() - openedAt < cooldownMs;

  return {
    name: `${primary.name}+${fallback.name}`,
    isAvailable: () => true, // the fallback is always available; that is the point

    status: () => ({
      using,
      breakerOpen: breakerOpen(),
      consecutiveFailures: failures,
      lastFailure,
    }),

    async complete(req: DialogueRequest): Promise<string> {
      if (!primary.isAvailable() || breakerOpen()) {
        using = 'fallback';
        return fallback.complete(req);
      }

      try {
        const text = await primary.complete(req);
        failures = 0;
        lastFailure = undefined;
        using = 'primary';
        return text;
      } catch (err) {
        const e = err instanceof DialogueError ? err : new DialogueError('unknown', { cause: err });
        lastFailure = e;

        // A recoverable blip the caller can retry is not a fallback case:
        // "say that again" keeps him a real dog. Only terminal-ish failures
        // hand the turn to the scripted brain.
        if (!e.shouldFallback) {
          throw e;
        }

        failures += 1;
        if (failures === threshold) openedAt = now();
        opts.onFallback?.(e);
        using = 'fallback';
        return fallback.complete(req);
      }
    },
  };
}
