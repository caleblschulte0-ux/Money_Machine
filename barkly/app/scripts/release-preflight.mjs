#!/usr/bin/env node
/**
 * Barkly release preflight.
 *
 * This deliberately fails CLOSED. A development/demo build may run with no
 * credentials and lots of fallbacks; an App Store candidate must prove it is
 * configured as the production product before anyone archives it.
 *
 * Run from barkly/app with the same EXPO_PUBLIC_* environment that will be used
 * for the release build:
 *
 *   npm run release:check
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '..');
const config = JSON.parse(fs.readFileSync(path.join(appDir, 'app.json'), 'utf8')).expo ?? {};
const pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
const env = process.env;

const failures = [];
const warnings = [];
const fail = (message) => failures.push(message);
const warn = (message) => warnings.push(message);

if (config.name !== 'Barkly') fail('app.json expo.name must be Barkly.');
if (!/^\d+\.\d+\.\d+$/.test(String(config.version ?? ''))) {
  fail('app.json expo.version must be a semantic version such as 1.0.0.');
}
if (config.version !== pkg.version) {
  fail(`app.json version (${config.version ?? 'missing'}) must match package.json (${pkg.version ?? 'missing'}).`);
}

const ios = config.ios ?? {};
const android = config.android ?? {};
if (!ios.bundleIdentifier || /example|placeholder/i.test(ios.bundleIdentifier)) {
  fail('Set expo.ios.bundleIdentifier to the final App Store bundle identifier.');
}
if (!/^\d+$/.test(String(ios.buildNumber ?? ''))) {
  fail('Set expo.ios.buildNumber to a positive integer string.');
}
if (ios.supportsTablet !== false) {
  fail('Initial release must keep ios.supportsTablet=false until iPad layout/device QA is completed.');
}
if (!android.package || /example|placeholder/i.test(android.package)) {
  fail('Set expo.android.package to the final Play Store application id.');
}
if (!Number.isInteger(android.versionCode) || android.versionCode < 1) {
  fail('Set expo.android.versionCode to a positive integer.');
}

const backend = env.EXPO_PUBLIC_BARKLY_BACKEND_URL ?? '';
if (!backend) fail('EXPO_PUBLIC_BARKLY_BACKEND_URL is required for a release build.');
else if (!/^https:\/\//i.test(backend)) fail('Release backend URL must use HTTPS.');
else if (/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(backend)) fail('Release backend URL cannot point at localhost.');

const appToken = env.EXPO_PUBLIC_BARKLY_APP_TOKEN ?? '';
if (appToken.length < 16) {
  fail('EXPO_PUBLIC_BARKLY_APP_TOKEN is missing or implausibly short for the production proxy.');
}
if (env.EXPO_PUBLIC_ANTHROPIC_API_KEY) {
  fail('EXPO_PUBLIC_ANTHROPIC_API_KEY must be empty in release builds; secrets belong in the proxy.');
}
if (env.EXPO_PUBLIC_BARKLY_DEV === '1') {
  fail('EXPO_PUBLIC_BARKLY_DEV=1 exposes developer bypasses and must never ship.');
}
if (env.EXPO_PUBLIC_BARKLY_FORCE_KEYBOARD === '1') {
  fail('EXPO_PUBLIC_BARKLY_FORCE_KEYBOARD=1 is a demo setting and must never ship.');
}
if ((env.EXPO_PUBLIC_BARKLY_RENDERER ?? 'photo').toLowerCase() === 'vector') {
  fail('The vector placeholder renderer is not release art. Use photo/production renderer.');
}
if ((env.EXPO_PUBLIC_BARKLY_VOICE ?? '').toLowerCase() === 'off') {
  fail("Barkly's production voice is disabled. Remove EXPO_PUBLIC_BARKLY_VOICE=off.");
}

if (!config.ios?.infoPlist?.NSMicrophoneUsageDescription) {
  fail('Missing iOS microphone purpose string.');
}
if (!config.ios?.infoPlist?.NSSpeechRecognitionUsageDescription) {
  fail('Missing iOS speech-recognition purpose string.');
}
if (!config.icon) fail('Missing app icon.');

// These are operational rather than machine-verifiable from this repository.
warn('Verify the production proxy boots with its model, app token, budget caps and HTTPS origin allowlist.');
warn("Verify Barkly's production voice vendor/key/voice id are configured server-side.");
warn('Run physical iPhone microphone/audio/background/interruption testing and a TestFlight pass.');
warn('Complete App Store privacy/age-rating/legal review before submission.');

for (const message of warnings) console.log(`WARN  ${message}`);
if (failures.length > 0) {
  for (const message of failures) console.error(`FAIL  ${message}`);
  console.error(`\nRelease preflight failed with ${failures.length} blocking issue${failures.length === 1 ? '' : 's'}.`);
  process.exit(1);
}

console.log('\nPASS  Barkly release configuration cleared preflight.');
