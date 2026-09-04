import { emptyMemory } from '../src/barkly/memory';
import { buildSystemPrompt } from '../src/barkly/prompts';
import { freshSnapshot } from '../src/barkly/state';
import { LOCATIONS, LOCATION_ORDER } from '../src/world/locations';
import { NPCS } from '../src/world/npcs';

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
