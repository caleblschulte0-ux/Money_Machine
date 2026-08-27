/**
 * NPC exchanges. Three bugs lived in one index expression; these are the three
 * assertions that stop them coming back.
 */

import { freshExchangeMemory, pickExchange, pickFresh } from '../src/world/npcExchange';
import { NPCS } from '../src/world/npcs';

const rng = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('picking a fresh index', () => {
  it('never returns the last one used', () => {
    for (let last = 0; last < 6; last++) {
      for (const roll of [0, 0.2, 0.5, 0.8, 0.999]) {
        expect(pickFresh(6, last, () => roll)).not.toBe(last);
      }
    }
  });

  it('can reach every other index', () => {
    const seen = new Set<number>();
    for (const roll of [0, 0.25, 0.5, 0.75, 0.99]) seen.add(pickFresh(6, 2, () => roll));
    expect(seen.size).toBeGreaterThan(2);
    expect(seen.has(2)).toBe(false);
  });

  it('a pool of one has nothing to avoid and does not spin', () => {
    expect(pickFresh(1, 0, () => 0.5)).toBe(0);
    expect(pickFresh(0, undefined, () => 0.5)).toBe(0);
  });

  it('a roll of exactly 1 stays in range', () => {
    expect(pickFresh(4, undefined, () => 1)).toBeLessThan(4);
  });
});

describe('the exchange itself', () => {
  it('each dog remembers its OWN last line — no shared counter', () => {
    // The original bug: one counter for all three dogs, so greeting Duke
    // twice moved Biscuit's line along too.
    let mem = freshExchangeMemory();
    mem = pickExchange(NPCS.duke, mem, () => 0).memory;
    mem = pickExchange(NPCS.duke, mem, () => 0).memory;
    expect(mem.line.biscuit).toBeUndefined();
    expect(mem.line.duke).toBeDefined();
  });

  it('never repeats the same greeting twice running', () => {
    let mem = freshExchangeMemory();
    let last = '';
    for (let i = 0; i < 30; i++) {
      const ex = pickExchange(NPCS.biscuit, mem, rng([0.1, 0.9, 0.4, 0.7]));
      expect(ex.npcLine).not.toBe(last);
      last = ex.npcLine;
      mem = ex.memory;
    }
  });

  it('the reply is drawn independently, so a greeting is not one fixed script', () => {
    // Same greeting index, different reply — impossible under the old
    // `barklyLines[i]` pairing.
    const a = pickExchange(NPCS.duke, freshExchangeMemory(), rng([0, 0.9]));
    const b = pickExchange(NPCS.duke, freshExchangeMemory(), rng([0, 0.1]));
    expect(a.npcLine).toBe(b.npcLine);
    expect(a.barklyLine).not.toBe(b.barklyLine);
  });

  it('every dog has enough to say that a cycle is not obvious', () => {
    for (const npc of Object.values(NPCS)) {
      expect(npc.lines.length).toBeGreaterThanOrEqual(6);
      expect(npc.barklyLines.length).toBeGreaterThanOrEqual(6);
      expect(new Set(npc.lines).size).toBe(npc.lines.length);
      expect(new Set(npc.barklyLines).size).toBe(npc.barklyLines.length);
    }
  });
});
