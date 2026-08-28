# Playing Barkly without installing anything

The point of this file: someone who is not Caleb should be able to open a URL,
play Barkly at any stage of his life, and say whether the game is any good.

## The URL

    https://caleblschulte0-ux.github.io/Money_Machine/           the player experience
    https://caleblschulte0-ux.github.io/Money_Machine/playtest/  the same game, plus save slots

Both are published by `.github/workflows/barkly-pages.yml` from
`claude/barkley-mvp-mobile-qbegtj`, and update on every push that touches
`barkly/app/`.

**One-time setup, and it needs a repo admin**: Settings → Pages → Source:
"GitHub Actions". A workflow cannot turn Pages on for its own repository, so
until that is set the build runs, passes, and fails at the deploy step.

## Save slots

The `PLAYTEST` pill in the row of location tabs opens them. It is also the badge
— a dev build should say so, and a tester needs a way in, and there is no reason
for those to be two different things.

| Slot | What it is for |
|---|---|
| Fresh Barkly | Onboarding done, knows your name, nothing else |
| Day 3 | A few conversations, one purchase, the start of an opinion |
| Established Barkly | A few weeks. Everything unlocked, a room, opinions about everyone |
| Long-Term Barkly | Three to six months. Pack Book, rituals, a saga with history |
| Duke Nemesis | The rivalry at full volume, at the park, with an ACTIVE grievance |
| Biscuit Best Friend | The friendship gone all the way, and the events that need it |
| Trick Dog | Several learned cues including the full `showtime` routine |
| Treasure Goblin | A hoard, a favourite, enough finds to exercise the story systems |
| Rich Barkly | Coins to burn, most of the shop owned. For testing purchases |

Loading a slot **writes a real save and restarts the app**. There is no "preset
mode" at runtime: every system reads a slot exactly the way it reads any other
Barkly, because as far as the app is concerned this dog really did live that
life. That is also why there is nothing to keep in sync.

Your own save is copied aside the first time a slot is loaded, and **Restore my
own save** puts it back. The backup is taken once — later loads do not overwrite
it with the preset you happened to be on.

## What the presets know that you might not

- **A grievance expires after five days, an obsession after three**
  (`character.expireCharacter`). Dating them to when the feud started reads
  right and is wrong: hydration throws them away and the slot loads a Barkly who
  has already got over it. The long history lives in social bonds and memories,
  which do not expire; the current beef is fresh.
- **Onboarding is a bare string**, `'done'`, not JSON. A preset that wrote
  `{"step":"done"}` sent every loaded save back to the welcome screen.
- **Times are relative to load.** A save is the same age every time it is
  loaded, so "we did that yesterday" never becomes "we did that eight months
  ago".

Both of the first two shipped, and both were caught by
`scripts/playtest-acceptance.mjs` rather than by reading the code.

## The gate

Nothing above exists in a normal build. Two locks, and the build-time one comes
first:

    EXPO_PUBLIC_BARKLY_DEV=1             existing dev mode; everything on
    EXPO_PUBLIC_BARKLY_PLAYTEST=1        honour ?playtest=1 in the URL
    EXPO_PUBLIC_BARKLY_PLAYTEST=always   this IS the playtest build

A production build sets neither, and `?playtest=1` on it does nothing — there is
no code path from the query string to the menu. `npm run check:gate` proves that
in a browser rather than by grepping a bundle, because both builds contain the
menu's code and only the gate differs.

Dev mode is deliberately NOT the gate: it unlocks every area and shop item
regardless of level, which would make the slots lie. "Established Barkly can
reach the beach" has to mean he earned it.

## Running it locally

    npm run build:pages      # both builds into dist/
    npm run check:gate       # the player build cannot reach the playtester
    python3 -m http.server 8099 --directory dist &
    npm run check:playtest   # play the build: 29 checks

## What does not work in the browser

- **The microphone.** `expo-speech-recognition` is a native module. The web
  build detects this and shows the text input instead; the brain path is
  identical, it is just typed.
- **The live brain.** No proxy is reachable from a static page, so replies come
  from the offline scripted engine. It is in character and it is shallower than
  the real thing.
- **Live voice synthesis.** Same reason. His fixed lines are real recordings
  bundled in the page and play normally; anything composed from your own words
  falls back to the browser's narrator. See `docs/ARCHITECTURE.md`.
- **Haptics.** No taptic engine in a browser. Calls are no-ops.

Everything else — the rig, the world, progression, the store, encounters,
contests, the Pack Book, the Plan, treasures, learned routines — is the real
thing.

## Mouse

There is nothing to fix and that is a finding, not an omission: the app has no
`PanResponder`, no gesture handler, and no long-press anywhere. Every control is
a `Pressable` with `onPress`, which is a click on the web. The acceptance
walkthrough drives the whole game with clicks only.
