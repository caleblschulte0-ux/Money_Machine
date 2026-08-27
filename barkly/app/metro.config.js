// Standard Expo Metro config.
//
// This file used to shim `node:*` imports to an empty module because
// @anthropic-ai/sdk dragged Node builtins into the bundle. The dialogue
// adapter is written against fetch now, that dependency is gone, and so is
// the shim — a workaround nothing needs is just a place for a future bug to
// hide.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
