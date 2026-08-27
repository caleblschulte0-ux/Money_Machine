/**
 * The other dogs in Barkly's world. Art: recolored variants of the approved
 * renders (assets/barkly/renders/npcs/) so everyone shares the toy style.
 *
 * Personality text feeds the dialogue prompt so Claude-Barkly gossips about
 * them accurately; the line pools drive the on-screen bark exchanges.
 */

export type NpcId = 'biscuit' | 'pepper' | 'duke';

export interface Npc {
  id: NpcId;
  name: string;
  relationship: 'friend' | 'rival';
  /** One-liner for the dialogue prompt. */
  personality: string;
  /** What the NPC "says" when Barkly greets them (shown over the NPC). */
  lines: string[];
  /** Barkly's replies (spoken + shown in his bubble). */
  barklyLines: string[];
  /** Occasional durable memories from hanging out. */
  memories: string[];
}

export const NPCS: Record<NpcId, Npc> = {
  biscuit: {
    id: 'biscuit',
    name: 'Biscuit',
    relationship: 'friend',
    personality:
      "Biscuit — a pale blond dog, Barkly's best friend. Sweet, gullible, believes everything Barkly says, which Barkly mildly exploits.",
    lines: [
      'Barkly!! I found a stick. It might be THE stick.',
      'I buried something here. I forget what. Wanna help?',
      "You came! I've been standing here being a good boy for HOURS.",
    ],
    barklyLines: [
      "Biscuit. Buddy. That's the same stick as yesterday. ...Okay it's a great stick.",
      "You forgot again? Classic Biscuit. Fine, I'll dig. But I get half.",
      "Nobody stands that well, Biscuit. Teach me nothing, I'm already better at it.",
    ],
    memories: [
      'Helped Biscuit dig for the thing he buried (he forgot what it was).',
      "Biscuit found 'THE stick' at the park again.",
    ],
  },
  pepper: {
    id: 'pepper',
    name: 'Pepper',
    relationship: 'friend',
    personality:
      'Pepper — a calm blue-grey dog who runs the town square like she owns it. Unimpressed by everyone, secretly fond of Barkly.',
    lines: [
      'Barkly. You look like trouble on four legs, as usual.',
      "The bakery dropped a crumb at noon. I'm still thinking about it.",
      'Walk with me. Slowly. We are dignified.',
    ],
    barklyLines: [
      "Pepper. You say that like it's not a compliment.",
      'A NOON crumb? And you didn\'t call me? We\'re supposed to be a team.',
      "I can do dignified. Watch. ...Okay I saw a pigeon, dignity's over.",
    ],
    memories: [
      'Walked the town square with Pepper, very dignified, until the pigeon.',
      'Pepper told Barkly about the legendary noon crumb.',
    ],
  },
  duke: {
    id: 'duke',
    name: 'Duke',
    relationship: 'rival',
    personality:
      "Duke — a big russet dog, Barkly's rival. Thinks he's the best dog at the park. He is not. Their feud is dramatic and entirely harmless.",
    lines: [
      "Well, well. They let *you* in the park?",
      'I marked that tree first, Barkly. And the other one. All of them, actually.',
      "Heard you can 'talk to humans'. Cute trick. I fetch at a national level.",
    ],
    barklyLines: [
      "Duke. Still doing the eyebrow thing, I see. Bold, for a guy who's scared of the sprinkler.",
      "Cool, cool. I marked the fire hydrant. The BIG one. Checkmate.",
      'National level? Duke, you brought back the wrong ball. Twice. I counted.',
    ],
    memories: [
      'Had a stare-down with Duke at the park. Barkly won (self-reported).',
      'Duke claimed every tree again. The feud continues.',
    ],
  },
};
