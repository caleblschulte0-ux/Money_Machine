/*
 * THE FRAME A PLAYER SEES MOST.
 *
 * Every other branch of faceFrame() is an EVENT -- listening, happy, annoyed,
 * hungry. Between events he fell through to one fixed render, and between
 * events is nearly all of the time: an art review on 2026-09-08 walked four
 * locations at four times of day plus every screen in the product and found
 * the same face in all of them.
 *
 * This holds the resting face against his drives, because the promise of the
 * product is a dog who shows how he is doing and the most-seen frame in the
 * app was the one that never moved.
 */
import { restingFace } from '../src/ui/BarklyPhotoView';
import { BarklyStats } from '../src/barkly/types';

const OK: BarklyStats = { mood: 55, energy: 60, hunger: 60, affection: 40, curiosity: 50 };
const at = (over: Partial<BarklyStats>): BarklyStats => ({ ...OK, ...over });

describe('the face he rests in', () => {
  it('is not one frame for every possible dog', () => {
    const faces = new Set([
      restingFace(at({})),
      restingFace(at({ energy: 10 })),
      restingFace(at({ mood: 12 })),
      restingFace(at({ mood: 90, affection: 90 })),
    ]);
    expect(faces.size).toBeGreaterThan(1);
  });

  it('looks tired when he is tired, and hungry reads the same honest way', () => {
    expect(restingFace(at({ energy: 10 }))).toEqual(restingFace(at({ hunger: 8 })));
    expect(restingFace(at({ energy: 10 }))).not.toEqual(restingFace(at({})));
  });

  it('rests smiling only when he is BOTH happy and attached', () => {
    const smile = restingFace(at({ mood: 90, affection: 90 }));
    expect(smile).not.toEqual(restingFace(at({})));
    // Happy but barely knows you is not the same as happy with you.
    expect(restingFace(at({ mood: 90, affection: 20 }))).toEqual(restingFace(at({})));
  });

  /*
   * A tired dog who likes you is still tired. The order of the branches is the
   * behaviour here, not an implementation detail: if affection ever wins over
   * exhaustion he grins through being worn out, which is the exact dishonesty
   * this file exists to prevent.
   */
  it('lets exhaustion win over affection', () => {
    expect(restingFace(at({ mood: 95, affection: 95, energy: 8 })))
      .toEqual(restingFace(at({ energy: 8 })));
  });

  /*
   * Thresholds sit away from the middle so the face is stable. A drive
   * hovering at 50 must not flicker between two frames.
   */
  it('holds one face across the middle of every drive', () => {
    const mid = [45, 48, 50, 52, 55];
    for (const v of mid) {
      expect(restingFace(at({ mood: v, energy: v, hunger: v, affection: v })))
        .toEqual(restingFace(at({})));
    }
  });

  it('falls back to the neutral face when there are no stats at all', () => {
    expect(restingFace(undefined)).toEqual(restingFace(at({})));
  });
});
