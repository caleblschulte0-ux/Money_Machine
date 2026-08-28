/**
 * NPC exchanges. Three bugs lived in one index expression; these are the three
 * assertions that stop them coming back.
 */

import { freshExchangeMemory, pickExchange, pickFresh, poolFor } from '../src/world/npcExchange';
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
    mem = pickExchange(NPCS.duke, mem, 0, () => 0).memory;
    mem = pickExchange(NPCS.duke, mem, 0, () => 0).memory;
    expect(mem.line.biscuit).toBeUndefined();
    expect(mem.line.duke).toBeDefined();
  });

  it('never repeats the same greeting twice running', () => {
    let mem = freshExchangeMemory();
    let last = '';
    for (let i = 0; i < 30; i++) {
      const ex = pickExchange(NPCS.biscuit, mem, 0, rng([0.1, 0.9, 0.4, 0.7]));
      expect(ex.npcLine).not.toBe(last);
      last = ex.npcLine;
      mem = ex.memory;
    }
  });

  it('the reply is drawn independently, so a greeting is not one fixed script', () => {
    // Same greeting index, different reply — impossible under the old
    // `barklyLines[i]` pairing.
    const a = pickExchange(NPCS.duke, freshExchangeMemory(), 0, rng([0, 0.9]));
    const b = pickExchange(NPCS.duke, freshExchangeMemory(), 0, rng([0, 0.1]));
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

describe('the relationship stage selects the pool', () => {
  // The operator's report, verbatim symptoms: "Biscuit Best Friend uses the
  // same introductory dialogue as early Biscuit" and "Duke Nemesis does not
  // immediately behave differently from ordinary Duke". Both were true
  // because pickExchange drew from ONE flat pool per dog regardless of the
  // bond. These tests drive the same encounter counts the presets carry
  // (biscuit: 34, duke: 18) and fail against any flat-pool regression.

  const allLines = (npcId: 'biscuit' | 'duke' | 'pepper', encounters: number) => {
    const seen = new Set<string>();
    let mem = freshExchangeMemory();
    for (let i = 0; i < 200; i++) {
      const ex = pickExchange(NPCS[npcId], mem, encounters, () => (i % 17) / 17);
      seen.add(ex.npcLine);
      seen.add(ex.barklyLine);
      mem = ex.memory;
    }
    return seen;
  };

  it('a best friend (34 hangouts) never gets an introductory line', () => {
    const bestFriend = allLines('biscuit', 34);
    for (const intro of NPCS.biscuit.lines) expect(bestFriend.has(intro)).toBe(false);
    for (const intro of NPCS.biscuit.barklyLines) expect(bestFriend.has(intro)).toBe(false);
  });

  it('a nemesis Duke (18 incidents) and a stranger Duke share no dialogue', () => {
    const stranger = allLines('duke', 0);
    const nemesis = allLines('duke', 18);
    for (const line of nemesis) expect(stranger.has(line)).toBe(false);
  });

  it('the pool climbs the ladder at the escalation thresholds', () => {
    // Below the first rung: base pool. At each rung: that rung's pool.
    expect(poolFor(NPCS.duke, 2).lines).toBe(NPCS.duke.lines);
    expect(poolFor(NPCS.duke, 3)).toBe(NPCS.duke.stages![0]);
    expect(poolFor(NPCS.duke, 6)).toBe(NPCS.duke.stages![1]);
    expect(poolFor(NPCS.duke, 12)).toBe(NPCS.duke.stages![2]);
    expect(poolFor(NPCS.duke, 40)).toBe(NPCS.duke.stages![2]);
  });

  it('Pepper is not a recoloured Biscuit — no stage line is shared', () => {
    const pepper = new Set(
      (NPCS.pepper.stages ?? []).flatMap((s) => [...s.lines, ...s.barklyLines]),
    );
    for (const s of NPCS.biscuit.stages ?? []) {
      for (const line of [...s.lines, ...s.barklyLines]) expect(pepper.has(line)).toBe(false);
    }
    expect(pepper.size).toBeGreaterThan(0);
  });

  it('every stage pool is big enough that a cycle is not obvious', () => {
    for (const npc of Object.values(NPCS)) {
      for (const stage of npc.stages ?? []) {
        expect(stage.lines.length).toBeGreaterThanOrEqual(4);
        expect(stage.barklyLines.length).toBeGreaterThanOrEqual(4);
        expect(new Set(stage.lines).size).toBe(stage.lines.length);
        expect(new Set(stage.barklyLines).size).toBe(stage.barklyLines.length);
      }
      // A dog without stages would silently regress to flat pools forever.
      expect((npc.stages ?? []).length).toBeGreaterThanOrEqual(2);
    }
  });
});
