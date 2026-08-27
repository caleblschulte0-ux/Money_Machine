/**
 * Expression coverage. The failure this guards against is quiet: someone adds
 * a state to the machine, nothing breaks, and Barkly just wears his neutral
 * face for it forever.
 */

import { faceFrame } from '../src/ui/BarklyPhotoView';
import { BarklyState } from '../src/barkly/types';

const ALL_STATES: BarklyState[] = [
  'idle',
  'listening',
  'thinking',
  'speaking',
  'happy',
  'excited',
  'annoyed',
  'sleepy',
  'hungry',
  'playing',
  'eating',
];

const frame = (over: Partial<Parameters<typeof faceFrame>[0]> = {}) =>
  faceFrame({ talking: false, jawOpen: false, lid: 0, state: 'idle', ...over });

describe('Barkly wears a face for every state', () => {
  it('always resolves to something renderable', () => {
    for (const state of ALL_STATES) {
      expect(frame({ state })).toBeDefined();
    }
  });

  it('the emotional states he shows head-on each look different', () => {
    // These are the ones the front pose actually renders; the rest cut to a
    // different pose entirely, which is its own kind of expression.
    const distinct = new Set(
      (['idle', 'listening', 'happy', 'annoyed', 'hungry'] as BarklyState[]).map((state) =>
        JSON.stringify(frame({ state })),
      ),
    );
    expect(distinct.size).toBe(5);
  });

  it('speaking beats everything — a mouth that stops mid-sentence breaks it', () => {
    const talkingFace = frame({ talking: true, jawOpen: true, lid: 2, state: 'annoyed' });
    expect(talkingFace).toEqual(frame({ talking: true, jawOpen: true, state: 'happy' }));
    // ...but a closed jaw between syllables falls through to the emotion.
    expect(frame({ talking: true, jawOpen: false, state: 'happy' })).toEqual(
      frame({ state: 'happy' }),
    );
  });

  it('blinks through a half-lid on the way down and back up', () => {
    const open = frame({ lid: 0 });
    const half = frame({ lid: 1 });
    const shut = frame({ lid: 2 });
    expect(half).not.toEqual(open);
    expect(half).not.toEqual(shut);
    expect(shut).not.toEqual(open);
  });

  it('an eyelid outranks the emotion — you cannot smile with your eyes shut', () => {
    expect(frame({ lid: 2, state: 'happy' })).toEqual(frame({ lid: 2, state: 'annoyed' }));
  });
});
