/**
 * Barkly's stash — the treasures he digs up at the park. Persistent,
 * deletable (privacy rule: everything about a profile can be wiped), shown
 * in Settings, and fed to the dialogue prompt so he can brag about it.
 */

import { KeyValueStore, profileKey } from '../storage/types';

/** Where a thing can be found. A beach shell is not buried in the park. */
export type DigSite = 'park' | 'beach';

export interface Treasure {
  id: string;
  name: string;
  icon: string; // emoji, for the stash list UI
  /** Which site turns this up. Missing means the park, which came first. */
  where?: DigSite;
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

  /**
   * The beach pool. Unlocking a new place has to give you something you
   * cannot get anywhere else, or the unlock is just a different background —
   * which is the fastest way to make progression feel like nothing.
   */
  { id: 'shell', name: 'a spiral shell (the good kind)', icon: '🐚', where: 'beach' },
  { id: 'sea_glass', name: 'a piece of sea glass, green', icon: '🟢', where: 'beach' },
  { id: 'driftwood', name: 'driftwood shaped like a smaller stick', icon: '🪵', where: 'beach' },
  { id: 'crab_claw', name: 'one crab claw (the crab was fine)', icon: '🦀', where: 'beach' },
  { id: 'bottle', name: 'a bottle with a note nobody can read', icon: '🍾', where: 'beach' },
  { id: 'starfish', name: 'a starfish (put back, then re-found)', icon: '⭐', where: 'beach' },
  { id: 'flip_flop', name: 'exactly one flip-flop', icon: '🩴', where: 'beach' },
  { id: 'kelp', name: 'a length of extremely rude seaweed', icon: '🌿', where: 'beach' },
  { id: 'shark_tooth', name: 'a shark tooth, allegedly', icon: '🦈', where: 'beach' },
  { id: 'pebble', name: 'a perfectly flat skipping stone', icon: '⚪', where: 'beach' },
];

export function treasuresAt(where: DigSite): Treasure[] {
  return TREASURES.filter((t) => (t.where ?? 'park') === where);
}

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

  /**
   * Dig something up at a site: prefers a treasure he doesn't own yet, and
   * never turns up a seashell in a park hole.
   */
  async dig(where: DigSite = 'park'): Promise<Treasure> {
    const site = treasuresAt(where);
    const unowned = site.filter((t) => !this.ids.includes(t.id));
    const pool = unowned.length > 0 ? unowned : site;
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
