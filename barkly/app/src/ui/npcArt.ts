/**
 * The other dogs' approved renders, in ONE place.
 *
 * These were declared inside `BarklyRoom` and were therefore only available to
 * the world stage. The Pack Book needs the same faces — a rivalry receipt that
 * says "Duke: Nemesis" in words next to a photograph of Duke is a different
 * screen from one that only says it — and a second `require` map in the sheet
 * would be two lists to keep in step with `assets/barkly/renders/npcs/`.
 */

import { NpcId } from '../world/npcs';

/**
 * A DIFFERENT POSE PER DOG, BECAUSE THEY WERE ONE DRAWING IN THREE PALETTES.
 *
 * Measured on the shipped art, Duke's and Biscuit's alpha silhouettes were
 * IDENTICAL -- 0.00%, pixel for pixel -- so the nemesis and the best friend
 * differed by hue alone, which is the one thing the visual doctrine says a
 * difference may never be. `build` and `stance` in world/npcs.ts already make
 * them different SIZES and shapes; this makes them different SHAPES.
 *
 * The fix needed no new art, because the art was already here. Every NPC has a
 * three-quarter render next to its front one and nothing had ever imported a
 * single one of them. Measured across every pairing, the assignment below is
 * the one that separates all three:
 *
 *     Biscuit (front) vs Duke (3/4)     29.0%
 *     Biscuit (front) vs Pepper (3/4)   28.8%
 *     Duke (3/4)      vs Pepper (3/4)   40.8%
 *
 * It also reads right for who they are: the two dogs Barkly has opinions about
 * stand turned toward you, and the friend faces you square on.
 *
 * THE ASPECT TRAVELS WITH THE POSE. The front renders are 416x520 and the box
 * they go into is size x size*1.25 -- exactly the same aspect, which is why
 * `stretch` and `contain` were interchangeable and why world/npcs.ts documents
 * `stance` as the only thing that may ever distort them. The three-quarter
 * renders are 416x480. Dropping one into the old fixed box would squash it 8%
 * and quietly break that guarantee, so the ratio is declared per pose and the
 * renderers read it.
 */
export type NpcArt = {
  source: ReturnType<typeof require>;
  /** height / width of the source render. */
  aspect: number;
};

const FRONT = 520 / 416;
const THREE_QUARTER = 480 / 416;

export const NPC_ART: Record<NpcId, NpcArt> = {
  biscuit: { source: require('../../assets/barkly/renders/npcs/biscuit_front.png'), aspect: FRONT },
  pepper: { source: require('../../assets/barkly/renders/npcs/pepper_tq.png'), aspect: THREE_QUARTER },
  duke: { source: require('../../assets/barkly/renders/npcs/duke_tq.png'), aspect: THREE_QUARTER },
};
