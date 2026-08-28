/**
 * Drive his head from what he is attending to.
 *
 * Split from attention.ts so the DECISION stays pure and testable and only the
 * clock lives here. The alternation is the whole behaviour: he checks the thing
 * he wants, then checks you, then checks it again — see the note in
 * attention.ts about why the looking-back is the half that means something.
 */

import { useEffect, useRef, useState } from 'react';
import { Attending, AttentionInput, GLANCE, Look, attentionFor, lookFor } from './attention';

export function useAttention(input: AttentionInput): Look | null {
  const target = attentionFor(input);
  const key = target.at === 'npc' ? `npc:${target.id}` : target.at;
  const [away, setAway] = useState(false);
  const at = useRef<Attending>(target);
  at.current = target;

  useEffect(() => {
    if (key === 'you') {
      setAway(false);
      return;
    }
    // Start by looking AT it, then alternate. Starting on "you" would delay the
    // beat that carries the meaning by two and a half seconds.
    setAway(true);
    let timer: ReturnType<typeof setTimeout>;
    const tick = (isAway: boolean) => {
      timer = setTimeout(() => {
        setAway(!isAway);
        tick(!isAway);
      }, isAway ? GLANCE.away : GLANCE.back);
    };
    tick(true);
    return () => clearTimeout(timer);
  }, [key]);

  if (key === 'you') return null;
  return away ? lookFor(target) : lookFor({ at: 'you' });
}
