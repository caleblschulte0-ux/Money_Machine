// Canonical scene entrypoint.
//
// The old renderer accumulated good individual fixes but still mixed several
// illustration languages: soft vector haze, one-off furniture, and flat scene
// bands. The new renderer keeps the same public API while giving every place
// one crisp toy-diorama material language.

/**
 * Store-to-room contract. Every purchasable home object listed here is drawn
 * by PolishedScenes.HomeScene when present in `upgrades`. Keeping the ids in
 * executable code lets the cheap static release check protect that promise
 * even though the implementation now lives behind this facade.
 */
export const HOME_SCENE_PURCHASES = ['home_bed', 'home_rug', 'home_window'] as const;

export * from './PolishedScenes';
