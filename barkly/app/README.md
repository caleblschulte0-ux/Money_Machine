# Barkly — mobile app (MVP)

React Native + Expo + TypeScript. One screen: Barkly in his room. Hold TALK,
speak, and Barkly listens, thinks, answers aloud in character, reacts visibly,
and remembers you next time. FEED / PLAY / SLEEP affect his real internal state.

Character design and personality are **locked** — see
[`../docs/CHARACTER.md`](../docs/CHARACTER.md). Architecture (brain/body split,
provider adapters, memory tiers, safety posture) — see
[`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

## Setup

```bash
cd barkly/app
npm install
cp .env.example .env        # then fill in what you have (see below)
```

## Running

Two modes, depending on what you need:

### 1. Quickest: Expo Go (no native build)

```bash
npm start                   # scan the QR with the Expo Go app
```

Everything works **except the microphone** (the on-device speech-recognition
native module can't run inside Expo Go). The app detects this and shows a text
input instead — the identical brain path (dialogue → memory → TTS → animation),
just typed. Barkly still talks out loud.

### 2. Full experience: dev build (microphone + voice)

```bash
npx expo run:ios            # or: npx expo run:android
```

This compiles a development app with `expo-speech-recognition` linked. Hold
TALK, speak, release — speech is recognized **on-device** (no audio ever leaves
the phone; only the text transcript goes to the dialogue provider).

## Credentials

| Variable (in `.env`) | Needed for | Without it |
|---|---|---|
| `EXPO_PUBLIC_ANTHROPIC_API_KEY` | Real Barkly intelligence (Claude), **dev only** | Offline scripted dialogue — shallow but in character, whole loop still works |
| `EXPO_PUBLIC_BARKLY_BACKEND_URL` | Production path via a backend proxy (next sprint) | — |
| `EXPO_PUBLIC_BARKLY_MODEL` | Override the model (default `claude-opus-5`) | — |

Speech-to-text and text-to-speech need **no credentials** (both on-device).

### His voice

Most of what you hear is a **recording**, not synthesis. His fixed lines —
greetings, feed and play reactions, idle thoughts, mishaps, what he says to the
other dogs, level-ups — are pre-rendered in his real voice and bundled in
`assets/voice/`, so they sound like him with no server, no network and no key.
Lines he composes out of your own words are synthesized through the proxy, or
fall back to the phone's narrator when there is no proxy to reach.

```bash
npm run voice:check     # what is banked and what is not, by category
npm run voice:harvest   # re-read his fixed lines out of the source
npm run voice:record    # re-record the ones that changed (needs network)
npm run voice:link      # regenerate src/audio/voiceBank.ts
```

> `EXPO_PUBLIC_*` values are bundled into the binary — never treat them as
> secret, never ship a build with a real key. Production dialogue traffic goes
> through the backend proxy.

## Scripts

```bash
npm test            # jest — brain logic (state machine, memory, prompts, dialogue)
npm run typecheck   # tsc --noEmit
npm run check:ui    # build the web artifact, then check layout + accessibility
npm run voice:check # how much of him is pre-recorded
```

## Code map

```
src/barkly/     the BRAIN (pure TS, no RN): personality, prompts, state machine,
                 memory (3 tiers), dialogue engine, BodyAction model
src/providers/   adapters: stt/ (expo-speech-recognition), dialogue/ (anthropic,
                 scripted fallback), tts/ (expo-speech, elevenlabs stub), registry
src/storage/     KeyValueStore abstraction (AsyncStorage impl + in-memory)
src/animation/   BarklyRenderProps — the renderer contract (Rive-ready)
src/hooks/       useBarkly — the interaction layer gluing all of the above
src/ui/          BarklyRoom (screen), BarklyView (placeholder art), settings
assets/barkly/  character asset slots — see its README (concept sheet goes here)
__tests__/       brain tests
```
