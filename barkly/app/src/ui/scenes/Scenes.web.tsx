// Web must render the exact same authored world as native.
//
// This file used to carry a second, older implementation of every scene.
// Metro prefers `.web.tsx`, so the phone screenshot workflow was reviewing
// that stale renderer while native builds used CandyScenesV2 through
// `Scenes.tsx`. Keeping this as a facade makes the review pixels authoritative
// and prevents the two worlds from drifting apart again.

export const HOME_SCENE_PURCHASES = ['home_bed', 'home_rug', 'home_window'] as const;

export {
  BeachScene,
  HomeScene,
  NightOverlay,
  ParkScene,
  TownScene,
  skyBand,
} from './CandyScenesV2';

export { DogBedBack, DogBedFront, RoomBed } from './PolishedScenes';
