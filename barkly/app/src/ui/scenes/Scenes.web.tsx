// Web must render the exact same authored world as native.
//
// Metro prefers `.web.tsx`, so this facade has to mirror Scenes.tsx exactly.
// The screenshot workflow is a release-quality gate; it cannot review an older
// Home implementation while native ships a newer one.

export const HOME_SCENE_PURCHASES = ['home_bed', 'home_rug', 'home_window'] as const;

// Home uses code-owned architecture plus independently rendered 3D props on
// both native and web so review pixels are authoritative.
export { HomeScene } from './HomeRenderedScene';

export {
  BeachScene,
  ParkScene,
  TownScene,
} from './OutdoorRenderedScenes';

export { NightOverlay, skyBand } from './CandyScenesV2';

export { DogBedBack, DogBedFront, RoomBed } from './PolishedScenes';
