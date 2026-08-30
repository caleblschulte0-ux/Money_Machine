// Canonical scene entrypoint.
//
// The HUD/store are intentionally frozen. The world now gets its own renderer
// that applies the same visual discipline to scenery: crisp silhouette, dark
// moulded lower edge, controlled highlight, contact shadow and clear depth.

/**
 * Store-to-room contract. Every purchasable home object listed here must stay
 * represented by HomeScene when present in `upgrades`.
 */
export const HOME_SCENE_PURCHASES = ['home_bed', 'home_rug', 'home_window'] as const;

export {
  BeachScene,
  HomeScene,
  NightOverlay,
  ParkScene,
  TownScene,
  skyBand,
} from './CandyScenes';

// Sleeping-bed pieces already have the right silhouette/overlap contract and
// are kept stable while the scenery behind them changes.
export { DogBedBack, DogBedFront, RoomBed } from './PolishedScenes';
