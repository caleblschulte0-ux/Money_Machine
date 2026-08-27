/**
 * Barkly's stash — the treasures he digs up at the park. Persistent,
 * deletable (privacy rule: everything about a profile can be wiped), shown
 * in Settings, and fed to the dialogue prompt so he can brag about it.
 */

import { KeyValueStore, profileKey } from '../storage/types';

export interface Treasure {
  id: string;
  name: string;
  icon: string; // emoji, for the stash list UI
}

export const TREASURES: Treasure[] = [
  { id: 'sock', name: 'a sock (previously owned)', icon: '🧦' },
  { id: 'half_ball', name: 'half a tennis ball', icon: '🎾' },
  { id: 'duck_rock', name: 'a rock that looks like a duck', icon: '🪨' },
  { id: 'good_stick', name: 'the good stick', icon: '🪵' },
  { id: 'mystery_bone', name: 'a mysterious bone', icon: '🦴' },
  { id: 'frisbee', name: "someone's frisbee (finders keepers)", icon: '🥏' },
  { id: 'caps', name: 'a bottle cap collection (3 caps)', icon: '🔘' },
  { id: 'acorn', name: 'an acorn (suspicious)', icon: '🌰' },
  { id: 'glove', name: 'a glove that lost its person', icon: '🧤' },
  { id: 'sandwich', name: 'a very old sandwich (do not ask)', icon: '🥪' },
  { id: 'button', name: 'a shiny button', icon: '🪙' },
  { id: 'feather', name: 'a feather (bird tax)', icon: '🪶' },
  { id: 'tiny_duck', name: 'a tiny rubber duck', icon: '🦆' },
  { id: 'map', name: 'a map? or trash? unclear', icon: '🗺️' },
];

const STORE_KEY = 'stash-v1';

export class Stash {
  private ids: string[] = [];

  constructor(
    private store: KeyValueStore,
    private profile: string,
  ) {}

  private key(): string {
    return profileKey(this.profile, STORE_KEY);
  }

  async load(): Promise<Treasure[]> {
    try {
      const raw = await this.store.get(this.key());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) this.ids = parsed.filter((x) => typeof x === 'string');
      }
    } catch {
      this.ids = [];
    }
    return this.list();
  }

  list(): Treasure[] {
    return this.ids
      .map((id) => TREASURES.find((t) => t.id === id))
      .filter((t): t is Treasure => Boolean(t));
  }

  /** Dig something up: prefers a treasure he doesn't own yet. */
  async dig(): Promise<Treasure> {
    const unowned = TREASURES.filter((t) => !this.ids.includes(t.id));
    const pool = unowned.length > 0 ? unowned : TREASURES;
    const found = pool[Math.floor(Math.random() * pool.length)];
    if (!this.ids.includes(found.id)) {
      this.ids.push(found.id);
      await this.store.set(this.key(), JSON.stringify(this.ids));
    }
    return found;
  }

  async clear(): Promise<void> {
    this.ids = [];
    await this.store.remove(this.key());
  }
}
