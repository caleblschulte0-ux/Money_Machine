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
