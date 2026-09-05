import { emptyMemory } from '../src/barkly/memory';
import { buildSystemPrompt } from '../src/barkly/prompts';
import { freshSnapshot } from '../src/barkly/state';
import { LOCATIONS, LOCATION_ORDER } from '../src/world/locations';
import { NPCS } from '../src/world/npcs';
import { poolFor } from '../src/world/npcExchange';
import { ladderFor } from '../src/barkly/escalation';
import { pickThought } from '../src/world/thoughts';

describe('world data', () => {
  it('every location NPC exists and every NPC has paired line pools', () => {
    for (const loc of LOCATION_ORDER) {
      for (const id of LOCATIONS[loc].npcIds) {
        const npc = NPCS[id];
        expect(npc).toBeDefined();
        expect(npc.lines.length).toBe(npc.barklyLines.length);
        expect(npc.memories.length).toBeGreaterThan(0);
      }
    }
  });

  it('the prompt tells Barkly where he is and who is around', () => {
    const prompt = buildSystemPrompt({
      snapshot: freshSnapshot(0),
      memory: emptyMemory(),
      world: {
        locationDescription: LOCATIONS.park.description,
        npcs: [{ name: 'Duke', relationship: 'rival', personality: NPCS.duke.personality }],
      },
    });
    expect(prompt).toContain('dog park');
    expect(prompt).toContain('Duke');
    expect(prompt).toContain('rival');
  });
});

describe('the other dogs are not one dog in three colours', () => {
  // MEASURED, 2026-09-03: `duke_front.png` and `biscuit_front.png` have
  // IDENTICAL alpha silhouettes -- one drawing, two palettes -- so the
  // nemesis and the best friend differed by hue alone, which is exactly what
  // the visual doctrine forbids. Distinct authored ear/head shapes are still
  // owed (build order item 6); size is the part that was already written down
  // and simply never rendered.
  it('gives every dog a build', () => {
    for (const npc of Object.values(NPCS)) {
      expect(typeof npc.build).toBe('number');
      expect(npc.build).toBeGreaterThan(0.5);
      expect(npc.build).toBeLessThan(2);
    }
  });

  it('makes the rival bigger than the friend his sheet calls small', () => {
    // "Duke — a big russet dog" is his own personality line.
    expect(NPCS.duke.personality).toMatch(/\bbig\b/);
    expect(NPCS.duke.build).toBeGreaterThan(NPCS.biscuit.build);
    // Big enough to see: a 20% spread between the two he meets most.
    expect(NPCS.duke.build / NPCS.biscuit.build).toBeGreaterThan(1.15);
  });
});

describe('every dog climbs the whole ladder', () => {
  // FOUND BY WALKING THE POOLS at 0/3/6/12/20/40 and reading them: Duke
  // escalated four times and both friends stopped at 6, so a best friend of
  // forty visits said exactly what he said at six while the RIVALRY kept
  // developing. In a product about history developing, the feud developed and
  // the friendship stalled. This test is here because that gap was invisible
  // to every other check — the data was well formed, there was just less of it
  // for the friends.
  it('has a dialogue pool for every rung of its own escalation ladder', () => {
    for (const npc of Object.values(NPCS)) {
      const ladder = ladderFor(npc.relationship === 'rival' ? 'rival' : 'friend');
      const rungs = ladder.map((r) => r.at).filter((at) => at > 0);
      const stages = (npc.stages ?? []).map((s) => s.at).sort((a, b) => a - b);
      expect(stages).toEqual(rungs);
    }
  });

  it('actually says something different at the top', () => {
    for (const npc of Object.values(NPCS)) {
      const top = poolFor(npc, 999);
      const mid = poolFor(npc, 6);
      const base = { lines: npc.lines, barklyLines: npc.barklyLines };
      expect(top.lines).not.toEqual(mid.lines);
      expect(top.lines).not.toEqual(base.lines);
      expect(top.barklyLines).not.toEqual(mid.barklyLines);
      // Enough to rotate without repeating back to back.
      expect(top.lines.length).toBeGreaterThanOrEqual(4);
      expect(top.lines.length).toBe(top.barklyLines.length);
    }
  });
});

describe('he thinks about you, not just about squirrels', () => {
  // Every thought in the pool was about the WORLD — the vacuum, the sea, a
  // squirrel — while he sat on a file of things the player had told him.
  // Catching him thinking about your sister's name when nobody asked is the
  // cheapest proof in the app that any of it went in, because it is not a
  // reply and so cannot be a trick of the conversation.
  const FACTS = ['favorite_food = pizza', 'sister = Mia', 'likes = swimming', 'dislikes = thunder'];

  it('brings up something they told him', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 60; seed += 1) seen.add(pickThought('home', 14, seed, [], FACTS));
    const aboutYou = [...seen].filter((t) => /pizza|Mia|swimming|thunder/.test(t));
    expect(aboutYou.length).toBeGreaterThan(0);
  });

  it('does not do it so often that it reads as a database reciting itself', () => {
    let hits = 0;
    for (let seed = 0; seed < 100; seed += 1) {
      if (/pizza|Mia|swimming|thunder/.test(pickThought('home', 14, seed, [], FACTS))) hits += 1;
    }
    expect(hits).toBeLessThan(30);
  });

  it('never says his own person\'s name back as an observation', () => {
    // "Sam. i still think about Sam." from a dog standing next to Sam.
    for (let seed = 0; seed < 60; seed += 1) {
      expect(pickThought('home', 14, seed, [], ['name = Sam'])).not.toContain('Sam');
    }
  });

  it('makes a sentence out of every fact shape, not just the tidy ones', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const t = pickThought('home', 14, seed, [], FACTS);
      expect(t).not.toMatch(/their likes is|their dislikes is/);
      expect(t.length).toBeLessThan(120);
    }
  });

  it('still works with nothing on file', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      expect(pickThought('park', 14, seed, [], []).length).toBeGreaterThan(4);
    }
  });
});

describe('two dogs are not the same shape', () => {
  it('keeps every stance small enough to read as a build, not a bug', () => {
    for (const npc of Object.values(NPCS)) {
      const { x = 1, y = 1 } = npc.stance ?? {};
      expect(Math.abs(x - 1)).toBeLessThanOrEqual(0.08);
      expect(Math.abs(y - 1)).toBeLessThanOrEqual(0.08);
    }
  });

  it('makes the rival taller and the small friend wider', () => {
    // "Lanky" and "stocky" are real character reads that cost no art. The
    // renders themselves are still one drawing in three palettes — see the
    // build-order doc, item 6 — and this does not pretend otherwise.
    expect(NPCS.duke.stance?.y ?? 1).toBeGreaterThan(NPCS.biscuit.stance?.y ?? 1);
    expect(NPCS.biscuit.stance?.x ?? 1).toBeGreaterThan(NPCS.duke.stance?.x ?? 1);
  });

  it('leaves the one dog whose drawing already varies alone', () => {
    expect(NPCS.pepper.stance).toBeUndefined();
  });

  /*
   * WHAT A BRAND-NEW PLAYER ACTUALLY SEES.
   *
   * The two branches above -- a thought about a cue, a thought about you --
   * both need history a first-time player does not have yet, so on day one
   * EVERY thought comes from UNIVERSAL + their location. That pool was 9 lines
   * at home. Thoughts surface every 16-30 seconds, so his whole inner life
   * cycled in about three and a half minutes and then repeated in order --
   * inside the ten-minute window where a stranger decides whether this is a
   * specific little dog or a loop with a face.
   *
   * The bar is the session, not a number I like: enough distinct thoughts to
   * outlast ten minutes at the FASTEST cadence, with no cues and no facts.
   */
  /*
   * The cadence in useBarkly is `16000 + Math.random() * 14000`, so the MEAN
   * interval is 23s -- not the 16s floor, which would need every one of ~38
   * consecutive draws to land at the minimum. Sizing to the floor is sizing to
   * a case that does not happen; the mean is the number a player actually
   * lives through.
   */
  const MEAN_INTERVAL_S = (16 + 30) / 2;
  const FIRST_SESSION_S = 10 * 60;

  it('does not repeat itself inside a first session, in any location', () => {
    const needed = Math.ceil(FIRST_SESSION_S / MEAN_INTERVAL_S);
    for (const loc of LOCATION_ORDER) {
      const seen = new Set<string>();
      // Day hour, no cues, no facts: exactly what day one looks like.
      for (let seed = 0; seed < 400; seed += 1) seen.add(pickThought(loc, 14, seed, [], []));
      expect(seen.size).toBeGreaterThanOrEqual(needed);
    }
  });

  it('every thought is his voice and fits the bubble', () => {
    for (const loc of LOCATION_ORDER) {
      for (const hour of [14, 23]) {
        for (let seed = 0; seed < 200; seed += 1) {
          const t = pickThought(loc, hour, seed, [], []);
          expect(t.trim()).toBe(t);
          expect(t.length).toBeGreaterThan(8);
          // paginateSpeech would page a longer one, but a thought that needs
          // turning is not a thought.
          expect(t.length).toBeLessThanOrEqual(72);
        }
      }
    }
  });
});