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

export const NPC_ART: Record<NpcId, ReturnType<typeof require>> = {
  biscuit: require('../../assets/barkly/renders/npcs/biscuit_front.png'),
  pepper: require('../../assets/barkly/renders/npcs/pepper_front.png'),
  duke: require('../../assets/barkly/renders/npcs/duke_front.png'),
};
