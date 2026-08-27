# Barkly — System Architecture

The MVP is an Expo (React Native + TypeScript) app in `../app`. Everything is
organized around one strategic split:

```
BARKLY'S BRAIN                          BARKLY'S BODY
(platform-agnostic TypeScript)           (today: screen; later: motors)

conversation ─ memory ─ personality      screen animation (mobile app)
emotion ─ decision making        ──────▶ physical servos/speaker (toy)
              emits BodyAction[]
```

The brain never imports React Native. It emits high-level `BodyAction`s
(`TAIL_WAG`, `HEAD_TILT`, `EAR_PERK`, `BLINK`, `MOUTH_MOVE`, `LOOK_LEFT`,
`LOOK_RIGHT`, `SIT`, `EXCITED`, `SLEEP`) and state changes. The mobile app
translates those into animation; a physical Barkly translates the exact same
commands into motors. This abstraction is deliberate and load-bearing — do not
let UI code reach into the brain, or personality leak into components.

## Layer map

```
Mobile UI                 app/src/ui/*             screens, controls
  ↓
Barkly Interaction Layer app/src/hooks/useBarkly.ts   glue: owns engine + state
  ↓
Speech-to-Text            app/src/providers/stt/*  SpeechToTextProvider
  ↓
Barkly AI / Dialogue     app/src/barkly/dialogue.ts + providers/dialogue/*
  ↓
Memory                    app/src/barkly/memory.ts + storage/*
  ↓
Text-to-Speech            app/src/providers/tts/*  TextToSpeechProvider
  ↓
Animation / Emotion       app/src/barkly/state.ts + src/animation/* + ui/BarklyView.tsx
```

## Provider adapters (no hardwiring to one vendor)

Interfaces in `app/src/providers/types.ts`:

- `SpeechToTextProvider` — implemented by `expoSpeechRecognitionStt` (on-device,
  no API key, requires a dev build). When unavailable (Expo Go), the UI falls
  back to typed input so the full loop is still exercisable.
- `DialogueProvider` — implemented by `anthropicDialogue` (official
  `@anthropic-ai/sdk`) and `scriptedDialogue` (offline, in-character,
  zero-credential fallback so the app always runs).
- `TextToSpeechProvider` — implemented by `expoSpeechTts` (on-device, free,
  works everywhere) and an `elevenLabsTts` stub for a real recorded-quality
  Barkly voice later.

`app/src/providers/registry.ts` selects providers from environment/config.
Swapping a vendor = writing one adapter + one registry line.

### Secrets

Production secrets never ship in the mobile binary. The Anthropic adapter's
direct-from-device mode is **development only** (`EXPO_PUBLIC_*` env vars are
bundled into the app and are not secret). For production the adapter's
`baseURL` points at **`../server`** — a zero-dependency Node proxy that holds
the real key, forwards only `POST /v1/messages`, and rate-limits per IP (its
README has run/deploy instructions). `.env.example` documents every variable.

## The Barkly state machine

`app/src/barkly/state.ts`. One reducer-style controller, no scattered booleans.

States: `idle · listening · thinking · speaking · happy · excited · annoyed ·
sleepy · hungry · playing · eating`.

Internal stats (0–100): `mood, energy, hunger, affection, curiosity`. They decay
slowly with wall-clock time (computed on load — no background timers), move with
interactions (feed/play/sleep/talk), and feed the prompt so Barkly's behavior
varies naturally. Deliberately not a full Tamagotchi simulation.

## Memory (three tiers)

`app/src/barkly/memory.ts`, persisted through the `KeyValueStore` abstraction
(`app/src/storage/`) — AsyncStorage today, a synced backend later without
touching memory logic.

1. **Session memory** — the current conversation, capped; older turns roll into
   a running summary rather than growing the prompt forever.
2. **User facts** — name, siblings, pets, favorites, hobbies, important people.
3. **Barkly memories** — experiences Barkly believes he shared with the user
   ("Caleb promised we'd play again tomorrow"), so he can call you out on them.

Extraction: the dialogue model returns structured JSON (speech + actions +
memory candidates) which the engine validates and merges. All memory is
deletable from Settings.

## Animation / asset swap path

`ui/BarklyView.tsx` is a **placeholder renderer**: Barkly drawn from plain RN
`View`s + the `Animated` API, following the locked design's blocky geometry.
It renders from exactly two inputs — `BarklyState` + active `BodyAction`s —
via the `BarklyRenderer` contract in `app/src/animation/renderer.ts`. Replacing
it with production art means implementing that same contract with:

- **Rive (recommended)** — state-machine-native, tiny runtime, inputs map 1:1
  onto `BarklyState`/`BodyAction`, strong Expo support. Best MVP-to-production
  path for a 2D toy-like character.
- Live2D / Spine / sprite sheets / 3D — all viable behind the same contract.

The conversation system never knows which renderer is mounted.

## Child safety / privacy posture (MVP)

- Microphone is captured **only** while the user explicitly holds TALK; STT is
  on-device; raw audio is never stored or uploaded by this app.
- Only derived text goes to the dialogue provider. Raw audio and derived
  text/memory are architecturally separate.
- No advertising, no trackers, no analytics SDKs, no behavioral profiling.
- All memory is user-deletable (Settings → "Forget everything").
- Storage is namespaced per profile (`barkly/profile/<id>/…`) so parental
  controls and per-child data handling can be added without a data migration.
- **This is engineering posture, not legal compliance.** Dedicated
  legal/compliance work (COPPA etc.) is required before any child-directed
  public release.
