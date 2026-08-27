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
  /**
   * What the NPC "says" when Barkly greets them (shown over the NPC).
   *
   * These are NOT paired with `barklyLines` by index any more. They used to
   * be, off a single counter shared by all three dogs, so the same greeting
   * always drew the same reply in the same order — and which line Biscuit
   * said depended on how many times you had tapped Duke. See world/npcExchange.
   */
  lines: string[];
  /** Barkly's replies (spoken + shown in his bubble). Drawn independently. */
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
      'Do you ever think about how grass is just... a lot of tiny sticks?',
      'I met a bee today. We did not get along. I have learned nothing.',
      'Someone said my ears are big. I have decided that was a compliment.',
    ],
    barklyLines: [
      "Biscuit. Buddy. That's the same stick as yesterday. ...Okay it's a great stick.",
      "You forgot again? Classic Biscuit. Fine, I'll dig. But I get half.",
      "Nobody stands that well, Biscuit. Teach me nothing, I'm already better at it.",
      'Biscuit, I have thought about this more than you have and I still have nothing.',
      'Every time you talk I get slightly less sure about the world. Keep going.',
      "That's the most Biscuit sentence anyone has ever said. I'm framing it.",
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
      'The delivery man came at ten. I allowed it. Barely.',
      'Someone new moved in on the corner. I am forming an opinion.',
      'You are early. Or I am late. One of us is wrong and it is not me.',
    ],
    barklyLines: [
      "Pepper. You say that like it's not a compliment.",
      'A NOON crumb? And you didn\'t call me? We\'re supposed to be a team.',
      "I can do dignified. Watch. ...Okay I saw a pigeon, dignity's over.",
      'You ALLOWED it? Pepper, you are one small dog with enormous confidence.',
      'Forming an opinion. Listen to her. I just bark at things and hope.',
      'It is definitely you. I have never been wrong about a time in my life.',
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
      'That collar is a choice. I respect the confidence, not the choice.',
      "I've been training. You wouldn't understand the regimen.",
      'My person says I am the best dog here. She has never met you, so.',
    ],
    barklyLines: [
      "Duke. Still doing the eyebrow thing, I see. Bold, for a guy who's scared of the sprinkler.",
      "Cool, cool. I marked the fire hydrant. The BIG one. Checkmate.",
      'National level? Duke, you brought back the wrong ball. Twice. I counted.',
      'Coming from a dog who wears a bandana ironically. Allegedly ironically.',
      'The regimen. Say more. I want every detail so I can repeat it to Biscuit.',
      "She has met me. She said 'oh no, this one.' I'm choosing to take it well.",
    ],
    memories: [
      'Had a stare-down with Duke at the park. Barkly won (self-reported).',
      'Duke claimed every tree again. The feud continues.',
    ],
  },
};
