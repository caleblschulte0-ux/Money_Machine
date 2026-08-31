// Canonical scene entrypoint.
//
// The HUD/store are intentionally frozen. The world renderer is isolated here
// so environment art can be rebuilt and screenshot-reviewed without touching
// any of the polished chrome above it.

/**
 * Store-to-room contract. Every purchasable home object listed here must stay
 * represented by HomeScene when present in `upgrades`.
 */
export const HOME_SCENE_PURCHASES = ['home_bed', 'home_rug', 'home_window'] as const;

// Home now uses the reviewed, design-system-backed hero scene while the rest of
// the retail-clarity world remains on the current production scene set.
export { HomeScene } from './HomeHeroScene';

export {
  BeachScene,
  NightOverlay,
  ParkScene,
  TownScene,
  skyBand,
} from './CandyScenesV2';

// Sleeping-bed pieces already have the right silhouette/overlap contract and
// are kept stable while the scenery behind them changes.
export { DogBedBack, DogBedFront, RoomBed } from './PolishedScenes';
