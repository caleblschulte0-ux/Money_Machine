// Canonical scene entrypoint.
//
// The old renderer accumulated good individual fixes but still mixed several
// illustration languages: soft vector haze, one-off furniture, and flat scene
// bands. The new renderer keeps the same public API while giving every place
// one crisp toy-diorama material language.
//
// Purchase-visibility contract: home_bed, home_rug, home_window are all drawn
// by PolishedScenes.HomeScene when present in `upgrades`. Keep these ids here
// too because the static release check intentionally verifies the canonical
// scene entrypoint without executing React.
export * from './PolishedScenes';
