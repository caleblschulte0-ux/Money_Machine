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
- `DialogueProvider` — implemented by `anthropicDialogue` (a small `fetch`
  client, not the vendor SDK: it needs response headers, its own timeout, and
  a bundle that does not drag Node builtins into React Native) and
  `scriptedDialogue` (offline, in-character, zero-credential fallback so the
  app always runs). The app is handed neither directly — `registry.ts` wraps
  them in `resilientDialogue`, which is the real model with the offline dog
  standing behind it. See "Talking to the model" below.
- `TextToSpeechProvider` — implemented by `expoSpeechTts` (on-device, free,
  works everywhere). It is the FALLBACK link, not what the UI calls: Barkly's
  own voice is `barklyVoiceTts`, synthesized through the proxy, and both sit
  behind the voice engine described under "How Barkly speaks".

`app/src/providers/registry.ts` selects providers from environment/config.
Swapping a vendor = writing one adapter + one registry line.

### Secrets

Production secrets never ship in the mobile binary. The Anthropic adapter's
direct-from-device mode is **development only** (`EXPO_PUBLIC_*` env vars are
bundled into the app and are not secret). For production the adapter's
`baseURL` points at **`../server`**, a zero-dependency Node proxy that holds
the real key. `.env.example` documents every variable.

## Talking to the model

The path from a child's sentence to Barkly's answer crosses a trust boundary,
and both sides of it assume the other can be tampered with.

**The proxy (`server/`)** re-decides everything the app could have lied about.
It does not forward the request body — it REBUILDS it from the fields it
recognises, so a `tools` array or a 64k `max_tokens` from a modified build
never reaches Anthropic on our key. It enforces a model allowlist, a token
bucket per install, and daily token/dollar caps. Its logs are content-free by
construction: the logger takes an event name plus scalars, and a string field
is written only if its NAME is on an allowlist — `speech` is not, so it is
dropped rather than truncated. Production refuses to boot without a key, an
app token and an explicit CORS allowlist. `server/README.md` is the operator
guide; `server/test/` runs on `node --test` with a fake clock and fake fetch.

**The app** never lets a backend failure become a dead pet. Every failure is a
`DialogueError` carrying `barklyLine` — what the dog says about it, in his
voice, with no status code in it. `resilientDialogue` then splits failures in
two: a recoverable blip ("say that again?") is raised so the child retries,
while a terminal one (budget gone, provider down, bad credentials) is answered
by the scripted Barkly for that turn. Repeated terminal failures open a
circuit breaker so the next turns skip the doomed call instead of making a
child wait out the timeout again; it closes on its own. Settings always says
which brain answered — a degraded Barkly is visible, never silent.

## How Barkly moves — the rig

`app/src/ui/BarklyRig.tsx` draws his front pose as a PUPPET: head, both ears
and body as separate layers that move independently. Before it, every physical
thing he did was a transform on the whole dog — a head tilt rotated his legs, an
ear flick was a full-body wobble, and looking at something was impossible, so
the interface had to TELL you he was hungry with a badge.

The layers are cut from the approved render by `app/scripts/build-rig.py`, which
**refuses to write anything unless stacking them back up reproduces
`renders/front.png` pixel for pixel.** That is what makes this a rig and not a
redesign, and it is a real gate: at rest he is the same drawing, and the build
fails the moment he stops being.

Three things in there are load-bearing and were each found the hard way:

- **The ears are CHILDREN of the head.** A head cock carries them; only their
  own extra swing is theirs. Parented in world space instead, a head turn slides
  his skull out from under them and tears a seam across the top — which looks
  perfectly fine standing still.
- **One scale transform for the whole rig, anchored top-left.** Scaling each
  layer's box separately makes every part round its own fractional size, and the
  background shows through the cracks as hairline seams along his jaw and ears.
- **Layers overlap only where both are solid, and the render tops out at alpha
  254.** Testing for a literal 255 made that overlap 31 pixels instead of
  thousands, so the layers butted edge-to-edge and seamed as soon as the browser
  scaled them. The 1:1 check passed the whole time — an exact tiling is exact.

His face variants (blink, half-lid, wide, smile, squint, jaw-open) are cut the
same way, so he still blinks and emotes; he just does it on a head that can also
turn. His PUPILS are their own layers, with the sockets behind them rebuilt from
the sclera, so he can glance. Only the FRONT pose is rigged — three-quarter,
side-lie and the closeup are still whole images, and `BarklyPhotoView` keeps
using them.

### How the motion is built, and what made it look goofy

Three rules, each of which replaced something that read as wrong on screen:

- **A look is mostly EYES.** A front-view head cannot be turned by sliding it
  sideways — 13px of translation made his skull visibly come unscrewed and swim
  over his collar. The pupils carry a look, fast and small; the neck leans a few
  degrees after them; his shoulders pick up a fifth of that, later still.
  Nothing translates. The head's hinge is inside the collar, so a lean already
  swings the top of his skull through an arc — and that arc is attached to a
  neck.
- **Body language is punctuation, not a pose.** `HEAD_TILT` used to be a
  boolean: the brain put it on a reply and he held nine degrees of lean for the
  whole six-second line. Measured, his nose sat 11.7px off centre for eight
  straight frames. Gestures now peak, decay to a trace, and release — a cock, a
  perk, a flick.
- **Ears are still, then twitch.** They ran on a permanent sine loop with the
  two sides on different spring tensions, so they never lined up and flapped
  like windsocks. One ear, occasionally, quickly.

The whole-body versions of all this came OFF at the same time: the old talk-bob,
sway and `lookShift` were the same motion done twice, fighting the rig instead of
adding to it. A jump is still a jump, so the bounce stayed.

### Beats — the part that uses it

`Beat` is a one-shot physical reaction with a timestamp (not a flag, so petting
him three times is three reactions). Pet leans him in with his eyes half closing;
refuse is a short flinch; arrive sweeps his eyes across a new place; delight
snaps his ears up. The rig could do all of this from the day it landed and almost
nothing asked it to — the only thing that ever moved him on purpose was a line of
dialogue. A dog that does not react to being touched is the least alive thing in
an app about a dog.

## What Barkly is looking at

`app/src/ui/attention.ts` is the dictionary between the world and his neck, and
it is why there is no "hungry" badge. He glances at his bowl, then back at you,
then at the bowl — and the looking-BACK is the half that carries the meaning:
checking the bowl is information, checking you is a question.

Priority order is deliberate: **someone speaking outranks his own appetite**, because
a character who does not turn when addressed reads as furniture. The decision is
pure and tested (`__tests__/attention.test.ts`); only the alternation clock lives
in `useAttention.ts`. Directions, never coordinates — he knows the bowl is down
and to his left, which is all a look needs to read.

## How Barkly speaks

`app/src/audio/voiceEngine.ts` is the ONE place the app makes a sound. That is
not tidiness: two places starting audio is how you get two Barklys talking
over each other, and a mouth flapping to a line that already finished.

The chain is **banked voice → proxy voice → device voice → silent-but-timed**.

**Banked** is ~304 of his fixed lines, pre-recorded in the real voice and
shipped inside the app (`app/assets/voice/`, wired by `app/src/audio/
voiceBank.ts`). It exists because everything below it needs something he does
not always have: the proxy needs a machine running it, and a published web
artifact cannot reach one, so before the bank every demo anyone ever opened
was the phone's screen-reader narrator wearing a dog costume. Greetings, feed
and play reactions, idle thoughts, mishaps, the things he says to the other
dogs and his level-ups are all in there — which is the whole first minute of
the app and, measured in a real browser, **88% of a real session**.

**The first meeting speaks.** It did not, at all, until 2026-09-04: ten
recorded onboarding lines sat in the bank and nothing in the onboarding path
ever called the voice engine, so a new player's introduction to a talking dog
was silent. `useBarkly.sayLine` is the voice without the room's speaking
lifecycle (the beat's caption is drawn by `ui/Onboarding`, and the room is not
mounted), and `ui/Onboarding` calls it on every step CHANGE — not on mount,
because a browser will not start audio before a gesture, so the opening line
stays text-only and every beat after it is voiced by the press that reached
it. `voice-check` measures the meeting separately and its bar there is ZERO
narrated and at least four lines heard, because every line in the meeting is
fixed and a walker that outruns the audio proves nothing.

That number was 71%, and before 2026-09-04 the check that produced it was
lying: `voice-check` typed five messages and measured three, because the
composer closes after every send and its `type()` only looked for a visible
input — so it reported "3/3 lines (100%)" while an entire brain file was
missing from the allowlist below. It opens the composer now and fails under a
60% floor. One clip playing is not a voice; a share is.

**82% is close to the ceiling and the remaining 18% is structural.** The
composer echoes the word you typed back at you, by design — that is what makes
a reply feel heard — and the bank matches WHOLE recordings, so "I could tell
you what skateboard is" can never be recorded for anybody. Measured on the
session `voice-check` drives: 14 of 16, with both narrated lines that shape.
Raising the share further means either a reachable synthesizer or writing fewer
lines that quote the player, and the second one costs more than it buys.

A line with a substitution in the MIDDLE is the avoidable version of the same
thing, and it kept happening: the name beat read `${name}. Okay. ${name}. I'll
remember that`, and the trick payoff was written out a second time inside
`ui/Onboarding` where the harvester could not see it. A name at the FRONT is
free — `voiceEngine.speakable` splits it off — and a shared constant
(`onboarding.DELIGHT_BODY`, `training.PLAY_DEAD_LINE`) is what puts the fixed
half in front of the harvester at all.

**Where it kept biting: the lines that say the player's NAME.** Measured
2026-09-04, all twelve NAMED return greetings were missing from the bank while
all twelve anonymous ones were in it — so every returning player who had told
him their name (which is everyone, the onboarding asks) heard the screen reader
on the first line of every session, on the beat `greetings.ts` exists for. The
same shape was in the offline brain's "what's my name" answer and in two
initiative lines. All of them are `${name}. ${BODY}` now with BODY a plain
literal, which is the only shape that both records and plays back. If you write
a new line that greets him by name, that is the shape to write it in.

Which files it reads is an ALLOWLIST, and both halves of that are load-bearing.
A hand-picked list of seven files missed fixed lines living in files nobody
thought of, and he fell back to the narrator mid-conversation — and it happened
AGAIN on 2026-09-04, to the biggest one: `providers/dialogue/scripted.ts`, the
only brain a published web build has, was never on the list, so every fixed
answer it gives ("Barkly. It's on the tag. Keep up.") came out in the browser's
narrator. Fifty-one lines. A sweep of
everything recorded 114 journal entries out of `encounters.ts` alone — a voice
narrating a scrapbook nobody hears it narrate. The list now takes the brain and
the world whole, and scopes the mixed files to the property that is actually
spoken (`line`, `speech`, `barklyLines`).

When a line is not banked and there is no synthesizer left, the engine asks for
the nearest form he CAN say (`voiceEngine.speakable`). Today that is one rule:
a line with your NAME as its first sentence offers its body, which is recorded.
That is his greeting — before the rule it missed the bank every time and his
most characteristic line came out in the narrator. The caller shows what comes
back as the caption, so the screen and the audio stay the same sentence, and the
rule only bites when there is nothing better; with the proxy reachable he says
exactly what he was handed.

The bank is keyed on the line **after `dialect.ts` has run over it**, because
that is the text the voice engine is handed. Key it on the source spelling and
every lookup misses silently and you ship two megabytes nobody hears; there is
a test on exactly that. Rebuild it with `npm run voice:harvest && npm run
voice:record && npm run voice:link`, and see `app/scripts/voice-bank.mjs` for
the whole story.

What is deliberately NOT banked: anything he composes out of your own words,
your name, or the name of a treasure he just dug up. Those are infinite, so
they fall through to the proxy — or, in the artifact, to the device voice. The
demo is therefore mixed on purpose, and `npm run voice:check` prints the real
split rather than a number somebody hoped for.

**Proxy** voice is synthesized server-side (`server/lib/voice.mjs`) because the
vendor key is a real secret AND because *which* voice is Barkly is a product
decision — the app sends text and gets audio, and never names a voice, so a
modified build cannot make him someone else. Clips are cached by a hash of
(voice, text), so his repeated lines cost nothing and play instantly. Voice is
billed per character, so it carries its own daily caps, separate from the token
ones.

**How he talks** is a separate layer from what makes the sound.
`app/src/barkly/dialect.ts` runs over every line at the speaking funnel — the
written ones and the ones the brain composes at runtime alike — and puts them
in his mouth: he is from the Bronx. Whole-word rules only, capped at two strong
markers a line, and idempotent, which took two goes: a line that will not
settle collects another opener every time it is repeated, and has no stable key
in the bank. It is also deliberately BLIND to who you are — the name he is
addressing you by is split off before the accent is seeded, so his voice does
not change depending on whether a child is called Caleb or Mateo, and the
recording of the body matches for all of them.

Every failure in that chain ends in a quieter Barkly, never a frozen one. If
the vendor is down he uses the device voice; if that fails too he mimes for a
plausible number of milliseconds while the caption reads. `speaking` is
therefore a state the app cannot get stuck in.

**Mute** is a parent's control and it persists. A muted Barkly still takes the
right amount of TIME, because the mouth animation and the state machine are
driven by how long he spoke — quiet, not broken. Backgrounding the app stops
him mid-word; nobody wants a dog talking from a pocket.

**Identity** is `providers/device.ts`: a random per-install id, stored locally,
hashed again server-side before it touches a log, and replaced by "Forget
Everything" exactly as a reinstall would. It exists so one leaked build can be
throttled without throttling a whole shared network. It is not a user id and
cannot be joined to anything.

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
