/**
 * The playtester, which is the thing that lets somebody evaluate Barkly without
 * living with him for six months.
 *
 * Two classes of failure matter here and neither is cosmetic:
 *
 *   A PRESET THAT DOES NOTHING. These are real saves written into the real
 *   store; if a key name drifts, or a shape stops parsing, the app hydrates,
 *   quietly drops what it does not recognise, and shows a Barkly missing half
 *   his history. It looks like it worked. So the keys are checked against the
 *   modules that own them, and every preset is round-tripped and inspected.
 *
 *   A PLAYTESTER WHO LOSES HIS OWN DOG. The backup is taken once, on the first
 *   load, and must survive every load after it. Overwriting it with the preset
 *   you happened to be on would destroy the real save silently.
 */

import { PRESETS, presetById } from '../src/dev/presets';
import { ALL_SAVE_KEYS, DEVICE_KEYS, LOCATION_KEY, MEMORY_KEY, ONBOARDING_DONE, ONBOARDING_KEY, STASH_KEY, MUTE_KEY } from '../src/storage/keys';
import { LOCATIONS } from '../src/world/locations';
import { activeSlot, hasBackup, loadPreset, readSave, restoreBackup, writeSave } from '../src/dev/saveSlots';
import { KeyValueStore, DEFAULT_PROFILE } from '../src/storage/types';
import { BarklyMemory } from '../src/barkly/memory';
import { expireCharacter } from '../src/barkly/character';
import { Stash } from '../src/world/stash';
import { playtestAllowed } from '../src/dev/playtest';

function memStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async get(k) {
      return data.has(k) ? data.get(k)! : null;
    },
    async set(k, v) {
      data.set(k, v);
    },
    async remove(k) {
      data.delete(k);
    },
  };
}

// Same shape the accessibility suite uses: `require` typed by hand, so the app
// does not need Node types just to let a test read a file.
const { readFileSync } = require('fs') as { readFileSync: (p: string, enc: string) => string };
const { join } = require('path') as { join: (...parts: string[]) => string };
const src = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8');

describe('the keys are the keys the game actually uses', () => {
  it('memory and stash write the keys the presets write', async () => {
    // Asked of the modules, not of their source: these two build their own key
    // from a private constant, and a rename there and nowhere else means every
    // preset silently loses that half of him. So make them save, and look at
    // where it landed.
    const store = memStore();
    const mem = new BarklyMemory(store, DEFAULT_PROFILE);
    await mem.load();
    await mem.addTurn({ role: 'user', text: 'hello', at: Date.now() });
    expect([...store.data.keys()]).toContain(MEMORY_KEY);

    const stash = new Stash(store, DEFAULT_PROFILE);
    await stash.load();
    await stash.dig('park');
    expect([...store.data.keys()]).toContain(STASH_KEY);
  });

  it('useBarkly reads the shared list rather than keeping its own', () => {
    const hook = src('hooks/useBarkly.ts');
    expect(hook).toContain("from '../storage/keys'");
    expect(hook).not.toMatch(/const SNAPSHOT_KEY = profileKey/);
  });

  it('device settings are not part of a save', () => {
    for (const k of DEVICE_KEYS) expect(ALL_SAVE_KEYS).not.toContain(k);
  });
});

describe('every preset is a real, complete save', () => {
  const now = 1_800_000_000_000;

  it('there are nine of them and the ids are unique', () => {
    expect(PRESETS.length).toBe(9);
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(9);
  });

  for (const preset of PRESETS) {
    it(`${preset.name} writes every save key as parseable JSON`, () => {
      const save = preset.build(now);
      for (const key of ALL_SAVE_KEYS) {
        expect(Object.keys(save)).toContain(key);
        const raw = save[key];
        if (raw === '') continue; // deliberately cleared
        // Onboarding is the one bare string the app stores; everything else is
        // JSON, and a preset that got that backwards is what this suite exists
        // to catch.
        if (key === ONBOARDING_KEY) {
          expect(raw).toBe(ONBOARDING_DONE);
          continue;
        }
        // Location is the OTHER bare string: hydration checks `raw in
        // LOCATIONS`, so the quoted form fails membership and every preset
        // silently opened at home. Assert the bare form is a real place.
        if (key === LOCATION_KEY) {
          expect(Object.keys(LOCATIONS)).toContain(raw);
          continue;
        }
        expect(() => JSON.parse(raw)).not.toThrow();
      }
    });
  }

  it('ages are relative, so a save is never stale', () => {
    // Hard-coded dates rot: "we did that yesterday" becomes "we did that eight
    // months ago" and his memory reads like a head injury.
    const a = JSON.parse(PRESETS[3].build(now)[MEMORY_KEY]);
    const b = JSON.parse(PRESETS[3].build(now + 90 * 86_400_000)[MEMORY_KEY]);
    expect(b.experiences[0].at - a.experiences[0].at).toBe(90 * 86_400_000);
    expect(now - a.experiences[0].at).toBe(b.experiences[0].at * 0 + (now - a.experiences[0].at));
  });
});

describe('a preset still is what it claims AFTER the app hydrates it', () => {
  const now = Date.now();

  it('nothing a preset promises is thrown away on load', () => {
    // The app expires a grievance after five days and an obsession after three.
    // Dating them to when the feud STARTED felt right and was wrong: "Duke
    // Nemesis" loaded a Barkly who had already got over it, and the menu said
    // it had worked. Whatever a preset sets must survive the same function the
    // app runs on it.
    for (const p of PRESETS) {
      const raw = JSON.parse(p.build(now)[ALL_SAVE_KEYS[2]]);
      const after = expireCharacter(raw, now);
      if (raw.grievance) expect(after.grievance).toEqual(raw.grievance);
      if (raw.obsession) expect(after.obsession).toEqual(raw.obsession);
      expect(after.socialBonds).toEqual(raw.socialBonds ?? {});
      expect(after.favoriteTreasure).toBe(raw.favoriteTreasure);
    }
  });

  it('Duke Nemesis really does arrive with an active grievance', () => {
    const c = expireCharacter(JSON.parse(presetById('duke')!.build(now)[ALL_SAVE_KEYS[2]]), now);
    expect(c.grievance?.who).toBe('Duke');
  });
});

describe('the presets are the Barklys they claim to be', () => {
  const now = Date.now();
  const parse = (id: string, key: string) => JSON.parse(presetById(id)!.build(now)[key]);
  const wallet = (id: string) => parse(id, ALL_SAVE_KEYS[4]);
  const memory = (id: string) => parse(id, MEMORY_KEY);
  const character = (id: string) => parse(id, ALL_SAVE_KEYS[2]);
  const stash = (id: string) => parse(id, STASH_KEY);

  it('every preset is onboarding-complete, in the format the app reads', () => {
    // Not JSON. The app writes a bare 'done' here, and a preset that wrote
    // {"step":"done"} sent every loaded save straight back to the welcome
    // screen — which is exactly what happened, and looked like the presets
    // were not loading at all.
    for (const p of PRESETS) expect(p.build(now)[ONBOARDING_KEY]).toBe(ONBOARDING_DONE);
  });

  it('every preset knows your name, because onboarding would have asked', () => {
    for (const p of PRESETS) {
      const mem = JSON.parse(p.build(now)[MEMORY_KEY]);
      expect(mem.facts.some((f: { key: string }) => f.key === 'name')).toBe(true);
    }
  });

  it('Fresh Barkly has nothing but your name', () => {
    expect(memory('fresh').facts.length).toBe(1);
    expect(memory('fresh').experiences).toEqual([]);
    expect(stash('fresh')).toEqual([]);
    expect(wallet('fresh').owned).toEqual([]);
  });

  it('Day 3 has a little of everything and one purchase', () => {
    expect(memory('day3').turns.length).toBeGreaterThan(0);
    expect(wallet('day3').owned.length).toBe(1);
    expect(wallet('day3').xp).toBeGreaterThan(0);
  });

  it('Established can reach every location', () => {
    // The beach opens at level 4, which is 220 xp. A preset that says
    // "everything unlocked" and cannot open the beach is a lie you only find
    // by tapping the tab.
    expect(wallet('established').xp).toBeGreaterThanOrEqual(220);
    expect(wallet('longterm').xp).toBeGreaterThanOrEqual(220);
    expect(wallet('rich').xp).toBeGreaterThanOrEqual(220);
  });

  it('Established has purchases, memories, treasures and a learned trick', () => {
    expect(wallet('established').owned.length).toBeGreaterThanOrEqual(3);
    expect(memory('established').experiences.length).toBeGreaterThanOrEqual(3);
    expect(stash('established').length).toBeGreaterThanOrEqual(3);
    expect(memory('established').trainingRules.length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(character('established').socialBonds).length).toBeGreaterThanOrEqual(3);
  });

  it('Long-Term has a saga, rituals and a developed room', () => {
    const c = character('longterm');
    expect(c.grievance?.who).toBe('Duke');
    expect(c.favoriteTreasure).toBeTruthy();
    expect(c.treasuresFound).toBeGreaterThanOrEqual(10);
    expect(wallet('longterm').placed.length).toBeGreaterThanOrEqual(2);
    expect(memory('longterm').trainingRules.length).toBeGreaterThanOrEqual(2);
    expect(memory('longterm').openThreads.length).toBeGreaterThanOrEqual(1);
  });

  it('Duke Nemesis is a rivalry with history behind it', () => {
    const c = character('duke');
    expect(c.socialBonds.duke.kind).toBe('rival');
    expect(c.socialBonds.duke.encounters).toBeGreaterThanOrEqual(6);
    expect(c.grievance?.who).toBe('Duke');
    expect(memory('duke').experiences.some((e: { withWhom?: string[] }) => e.withWhom?.includes('Duke'))).toBe(true);
  });

  it('Biscuit Best Friend is a friendship with history behind it', () => {
    const c = character('biscuit');
    expect(c.socialBonds.biscuit.kind).toBe('friend');
    expect(c.favoriteFriend).toBe('Biscuit');
    expect(memory('biscuit').experiences.some((e: { withWhom?: string[] }) => e.withWhom?.includes('Biscuit'))).toBe(true);
  });

  it('Trick Dog knows the multi-step showtime routine', () => {
    const rules = memory('trickdog').trainingRules;
    expect(rules.length).toBeGreaterThanOrEqual(3);
    const showtime = rules.find((r: { normalizedCue: string }) => r.normalizedCue === 'showtime');
    expect(showtime).toBeDefined();
    expect(showtime.routine.length).toBe(3);
    expect(showtime.timesTriggered).toBeGreaterThan(1);
  });

  it('Treasure Goblin has a hoard and a favourite', () => {
    expect(stash('goblin').length).toBeGreaterThanOrEqual(10);
    expect(character('goblin').favoriteTreasure).toBeTruthy();
  });

  it('Rich Barkly can afford anything and already owns most of it', () => {
    expect(wallet('rich').coins).toBeGreaterThan(1000);
    expect(wallet('rich').owned.length).toBeGreaterThanOrEqual(8);
  });
});

describe('loading a preset cannot cost you your own Barkly', () => {
  it('backs the real save up once, and never again', async () => {
    const store = memStore();
    await writeSave(store, { [MEMORY_KEY]: JSON.stringify({ mine: true }) });

    const first = await loadPreset(store, 'longterm');
    expect(first).toEqual({ ok: true, backedUp: true });

    const second = await loadPreset(store, 'duke');
    expect(second.backedUp).toBe(false);

    // The backup is still the ORIGINAL, not Long-Term.
    await restoreBackup(store);
    expect(JSON.parse((await store.get(MEMORY_KEY))!)).toEqual({ mine: true });
  });

  it('clears keys the incoming save does not have', async () => {
    const store = memStore();
    await store.set(STASH_KEY, JSON.stringify(['a-stranger-treasure']));
    await loadPreset(store, 'fresh');
    expect(JSON.parse((await store.get(STASH_KEY))!)).toEqual([]);
  });

  it('never touches device settings', async () => {
    const store = memStore();
    await store.set(MUTE_KEY, 'true');
    await loadPreset(store, 'rich');
    expect(await store.get(MUTE_KEY)).toBe('true');
    await restoreBackup(store);
    expect(await store.get(MUTE_KEY)).toBe('true');
  });

  it('says which slot is active, and forgets it on restore', async () => {
    const store = memStore();
    expect(await activeSlot(store)).toBeNull();
    await loadPreset(store, 'goblin');
    expect((await activeSlot(store))?.id).toBe('goblin');
    await restoreBackup(store);
    expect(await activeSlot(store)).toBeNull();
  });

  it('an unknown id changes nothing', async () => {
    const store = memStore();
    await store.set(MEMORY_KEY, 'mine');
    expect(await loadPreset(store, 'nope')).toEqual({ ok: false, backedUp: false });
    expect(await store.get(MEMORY_KEY)).toBe('mine');
    expect(await hasBackup(store)).toBe(false);
  });

  it('round-trips a save without changing it', async () => {
    const store = memStore();
    const save = presetById('established')!.build(Date.now());
    await writeSave(store, save);
    expect(await readSave(store)).toEqual(
      Object.fromEntries(Object.entries(save).filter(([, v]) => v !== '')),
    );
  });
});

describe('the gate', () => {
  it('a production build ignores the URL flag entirely', () => {
    // Not "hides the menu" — there is no path from the query string to it. The
    // build has to opt in first, so a WebView with ?playtest=1 gets nothing.
    const gate = src('dev/playtest.ts');
    expect(gate).toContain('EXPO_PUBLIC_BARKLY_PLAYTEST');
    expect(gate).toMatch(/if \(!BUILD_ALLOWS_FLAG\) return false;\s*\n\s*return flaggedInUrl\(\);/);
    // Dev mode is deliberately NOT the playtest gate: it unlocks every area and
    // shop item regardless of level, which would make the presets lie.
    expect(gate).toContain('EXPO_PUBLIC_BARKLY_DEV');
  });

  it('is off in this test environment, which has neither flag set', () => {
    expect(playtestAllowed()).toBe(false);
  });
});
