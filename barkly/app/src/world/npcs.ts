/**
 * The other dogs in Barkly's world. Art: recolored variants of the approved
 * renders (assets/barkly/renders/npcs/) so everyone shares the toy style.
 *
 * Personality text feeds the dialogue prompt so Claude-Barkly gossips about
 * them accurately; the line pools drive the on-screen bark exchanges.
 */

export type NpcId = 'biscuit' | 'pepper' | 'duke';

/**
 * A pool that takes over once the relationship has climbed to `at` encounters
 * (the escalation-ladder thresholds: 3, 6, 12 — see barkly/escalation).
 *
 * Stages exist because the flat pools could not tell a stranger from a best
 * friend: "Biscuit Best Friend" (34 hangouts on record) opened with the same
 * introductory lines as day-one Biscuit, and "Duke Nemesis" sounded like a
 * dog Barkly had merely met. The HISTORY was stored; the dialogue never read
 * it. Now the current rung selects the pool.
 */
export interface NpcStagePool {
  /** Minimum encounters for this pool. The highest satisfied stage wins. */
  at: number;
  lines: string[];
  barklyLines: string[];
}

export interface Npc {
  id: NpcId;
  name: string;
  relationship: 'friend' | 'rival';
  /** One-liner for the dialogue prompt. */
  personality: string;
  /**
   * What the NPC "says" when Barkly greets them (shown over the NPC),
   * BEFORE there is any real history — the acquaintance pool.
   *
   * These are NOT paired with `barklyLines` by index any more. They used to
   * be, off a single counter shared by all three dogs, so the same greeting
   * always drew the same reply in the same order — and which line Biscuit
   * said depended on how many times you had tapped Duke. See world/npcExchange.
   */
  lines: string[];
  /** Barkly's replies (spoken + shown in his bubble). Drawn independently. */
  barklyLines: string[];
  /** Pools that replace the base ones as the bond climbs the ladder. */
  stages?: NpcStagePool[];
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
    stages: [
      {
        // Actual buddy: he expects to see Barkly, and there are running bits.
        at: 3,
        lines: [
          'Barkly! I saved you half a stick. The good half.',
          "You're here! I dug our hole a bit deeper. It's really coming along.",
          'I told the bee about you. We are on speaking terms now. Me and the bee.',
          'I practised standing since last time. Watch. ...That was it.',
          'I found a puddle with our names on it. Not literally. Come see.',
          'You always show up! I counted on it and I was RIGHT.',
        ],
        barklyLines: [
          "You saved me the good half? Biscuit, that's the nicest dumb thing anyone's done for me.",
          "Our hole. I like that it's ours now. Dig on, buddy.",
          'You and the bee have HISTORY, Biscuit. Bad history. Be careful out there.',
          "I watched. I'm proud. I don't know of what, but I'm proud.",
          "A puddle with our names on it. Sure. We're that kind of team now.",
          'Of course I showed up. We have a whole thing going. Keep up.',
        ],
      },
      {
        // Best friend and beyond: shared lore, no introductions, ever.
        at: 6,
        lines: [
          "Barkly!! Best friend alert. That's you. You're the alert.",
          'I kept watch on your stash all morning. Nothing got past me. One squirrel got past me.',
          "I told Duke you'd say something clever. Say something clever, quick.",
          "Remember the vacuum incident? I still sit facing the door. For us.",
          'I saved you a spot next to me. It is the same as every other spot but it is YOURS.',
          "When you weren't here I did our bark. The two-part one. Alone it's just a bark.",
        ],
        barklyLines: [
          "Biscuit. Buddy. Best friend. We don't do introductions, we do arrivals.",
          'One squirrel out of one squirrel. Biscuit, your record stands. Perfect in spirit.',
          "Tell Duke I said something devastating. I'll think of it tonight.",
          "The vacuum incident bonded us, Biscuit. Soldiers don't talk about it. Neither do we.",
          "My spot. Obviously it's my spot. It's next to you, that's the entire point of it.",
          "The two-part bark needs both of us. That's not sentiment, that's engineering. Okay, it's sentiment.",
        ],
      },
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
    stages: [
      {
        // Pepper doesn't gush at any stage — her arc is the slow granting of
        // ACCESS. A buddy gets intelligence briefings, not enthusiasm. That is
        // what keeps her from being a second Biscuit with a different palette.
        at: 3,
        lines: [
          'Barkly. Punctual-ish. I have square business to discuss.',
          'The corner dog has been re-assessed. My opinion is filed. You may read it.',
          "I mentioned you to the bakery. Don't make me regret the endorsement.",
          'Walk the perimeter with me. You have earned the perimeter.',
          "There was an incident at the fountain. I handled it. You'd have barked.",
          'You may sit in my shade. This is not a small thing.',
        ],
        barklyLines: [
          "Square business. I'm listening. I'm honoured and I'm listening.",
          'Filed? Pepper, you have a filing system for OPINIONS. I want one.',
          'An endorsement from you at the bakery is worth actual bread. I know the rates.',
          "The perimeter! I've been promoted. I won't tell the pigeons.",
          "I would ABSOLUTELY have barked, and that's why you're in charge here.",
          "Shade privileges. Noted, logged, and I'm sitting extremely respectfully.",
        ],
      },
      {
        at: 6,
        lines: [
          "Barkly. Good. The square isn't right when you're late.",
          'I saved you the report: two pigeons, one crumb, zero dignity lost. Mine, anyway.',
          "Someone asked if we were friends. I said 'he's with me.' That is the statement.",
          'The noon crumb returned. I waited for you. I want that noted.',
          'You are the second-most sensible dog in this town. I am not taking questions.',
          "Sit. Watch the square with me. This is the good part of the day.",
        ],
        barklyLines: [
          "Admit it, Pepper — you missed me. Fine, don't admit it. The tail did.",
          'Zero dignity lost. Two pigeons THOROUGHLY briefed. We run a tight square.',
          "'He's with me.' Pepper, I'm getting that engraved somewhere.",
          "You WAITED on a noon crumb? For me? That's the biggest honour this town gives.",
          "Second-most sensible. From you that's a trophy. I accept on behalf of my whole species.",
          "Watching the square with you IS the good part of the day. Don't quote me to Biscuit.",
        ],
      },
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
    stages: [
      {
        // Official rival: the feud has continuity and both dogs are keeping
        // score out loud.
        at: 3,
        lines: [
          "Barkly. I counted your fetches yesterday. I've had better warm-ups.",
          'Still telling everyone about the hydrant? The BIG one? Anyone can mark a big one.',
          "I've started a list of your failures. I'm on volume two.",
          'The park has standards now, Barkly. I introduced them. This morning.',
          'My person bought me a NEW ball. It is better than every ball you have touched.',
          "You're still here? I assumed you'd retired. From everything.",
        ],
        barklyLines: [
          "You COUNTED my fetches, Duke? That's not rivalry, that's fan behaviour.",
          "Volume two? I'm flattered. Nobody writes that much about a dog they're beating.",
          "You introduced standards to the park. The park's standards immediately dropped. Coincidence?",
          'New ball, same Duke. It will end up under the same sofa as your dignity.',
          "Retired? Duke, I'm in my prime. You'd know — you keep the records.",
          "This feud is official now, and honestly? You've earned it. Don't smile. It's not a compliment.",
        ],
      },
      {
        // Nemesis: personal mythology. He does not greet a nemesis like a
        // stranger — that was the whole complaint.
        at: 6,
        lines: [
          'Barkly. My nemesis. I practised saying it in the water bowl.',
          'I dreamt about beating you at fetch. Even asleep you were annoying.',
          "This park isn't big enough for both of us. I've measured it.",
          "Don't bring up the duel. I wasn't ready. The wind was biased.",
          'One day, Barkly, one of us will win this thing forever. It will be me. Obviously.',
          "I told my person about you. She said 'aww'. She misunderstands our war.",
        ],
        barklyLines: [
          "Duke. Nemesis. Say it right — with RESPECT and mild fear, like in my head.",
          'You dream about me, Duke. I want that on the record. THE record. Ours.',
          "You MEASURED the park? This is why you're my nemesis. Nobody else commits like this.",
          "The wind was biased. Sure. Toward the dog who brought back the right ball. Me.",
          'Forever-win accepted. Terms to be barked. Bring your best eyebrow.',
          "'Aww' is the correct response, Duke. Our war IS adorable. And I'm winning it.",
        ],
      },
      {
        // Generational feud: the ladder's top rung deserves its own voice.
        at: 12,
        lines: [
          'Barkly. Chapter nine hundred of our feud opens NOW.',
          'My grandpuppies will be briefed about you. There are diagrams.',
          "We've been at this so long the squirrels take sides. Most picked you. Traitors.",
          'I no longer remember why we started. I remember every score though. All of them.',
        ],
        barklyLines: [
          'Chapter nine hundred, Duke. Neither of us has ever missed a chapter. That means something.',
          "Diagrams! Duke, our feud has DOCUMENTATION. We built something generational here.",
          'The squirrels picked the winning side. Smart squirrels. Cowardly, but smart.',
          "Nobody remembers how it started, everybody knows it'll never end. That's legacy, Duke.",
        ],
      },
    ],
    memories: [
      'Had a stare-down with Duke at the park. Barkly won (self-reported).',
      'Duke claimed every tree again. The feud continues.',
    ],
  },
};

/**
 * The name to PRINT for a bond key.
 *
 * Bonds are keyed by whatever wrote them, and not every writer used the
 * display name — a seeded save keys them by id, so the Pack Book was headed
 * "duke: generational feud" and the story arc was "The duke Situation" on a
 * screen whose whole job is to feel authored. Resolve through the roster when
 * the key names a dog we know; otherwise capitalise, because an unknown dog
 * still deserves a capital letter.
 */
export function displayName(key: string): string {
  const wanted = key.trim();
  if (!wanted) return wanted;
  const hit = (Object.keys(NPCS) as NpcId[]).find(
    (id) => id === wanted.toLowerCase() || NPCS[id].name.toLowerCase() === wanted.toLowerCase(),
  );
  if (hit) return NPCS[hit].name;
  return wanted[0].toUpperCase() + wanted.slice(1);
}
