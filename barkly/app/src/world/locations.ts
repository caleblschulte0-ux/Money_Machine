/**
 * The places Barkly can be. Each location names the NPCs found there and a
 * description line the dialogue prompt uses so Barkly knows where he is.
 */

import { NpcId } from './npcs';

export type LocationId = 'home' | 'park' | 'town';

export interface Location {
  id: LocationId;
  name: string;
  /** Fed into the dialogue prompt as game state. */
  description: string;
  npcIds: NpcId[];
}

export const LOCATIONS: Record<LocationId, Location> = {
  home: {
    id: 'home',
    name: 'Home',
    description: 'in your cozy room at home, with your bed and your window',
    npcIds: [],
  },
  park: {
    id: 'park',
    name: 'Park',
    description: 'at the dog park — grass, trees, the good fence, and other dogs around',
    npcIds: ['biscuit', 'duke'],
  },
  town: {
    id: 'town',
    name: 'Town',
    description: 'in the town square, near the bakery and the shops',
    npcIds: ['pepper'],
  },
};

export const LOCATION_ORDER: LocationId[] = ['home', 'park', 'town'];
