# Barkly — Project Handoff for ChatGPT

**Read this whole file first.** It is self-contained: you do not need repo
access to understand the project. Attached alongside it you should have
`CODE_SNAPSHOT.md` (every source file, concatenated), `barkly-concept.png`
(the locked character sheet), and screenshots of the app running.

**Who you are in this project:** a collaborator with Caleb (the operator) on
Barkly. Claude builds the code; you originally generated Barkly's character
design, and you're being asked to (a) review the product and (b) produce
character art. Specific asks are in §7 — but read the rest first so your
feedback is grounded.

---

## 1. What Barkly is

An **AI-powered virtual dog**. Ships first as a mobile app (React Native /
Expo / TypeScript, iOS + Android), and later becomes a **physical interactive
toy** driven by the same brain.

The product test, in one sentence:

> Does Barkly feel like a specific little dog you are getting to know,
> rather than ChatGPT wearing a dog skin?

Not a chatbot with a mascot. Not a Tamagotchi with an LLM bolted on. The bet
is that a character with **persistent memory, real opinions, a world he lives
in, and possessions he cares about** feels categorically different from
anything currently on the App Store.

**Target:** App Store quality. Not an MVP anymore — the operator's words:
*"This should be a huge sprint to make a large scale app."*

---

## 2. Barkly's character (LOCKED — do not redesign)

The concept sheet `barkly-concept.png` ("Barkley – Concept 3") is the visual
source of truth. **You generated it originally.** It is canon. Note: the sheet
says "Barkley"; the product spelling is **Barkly**. Same dog.

He is a **terrier-beagle mix with a mischievous deadpan streak and a nose for
trouble**, rendered as a collectible clay/vinyl toy — soft surfaces, no
outlines, bold silhouette.

Required traits (verbatim from the sheet):
- rectangular head
- long nose with rounded square tip
- stiff, bent ears that angle outward
- tiny snaggletooth
- thick collar
- striped knit-sock markings on front paws
- ring-shaped tail curl
- low-slung body

Additional reads from the artwork: the head dominates the body (roughly half
his height); cream blaze down the center of the face into a long broad cream
muzzle; huge charcoal rounded-square nose; **smug half-lidded eyes** (solid
dark pills under heavy flat lids tilted down-outward); dark-brown belt-style
collar with brass buckle and a round brass **B** tag on a ring; cream
chest/belly; three charcoal stripes per front sock.

**Palette:** mustard tan `#C6952F` (ears deeper `#AF7F22`), cream `#F1E6CB`,
charcoal `#3E332A`, collar brown `#4B3527`, brass `#B98F3E`.

**He must never become:** a Disney/Pixar puppy, a golden retriever, a
giant-eyed cute puppy, a hyper-realistic dog, a fluffy AI mascot, Paw Patrol,
or Talking Tom with dog ears. His asymmetry, deadpan expression, rectangular
head, snaggletooth and strange proportions are **features**.

**Personality:** mischievous, curious, loyal, confident, stubborn, playful,
slightly sarcastic, occasionally lazy, easily distracted by dog things,
genuinely attached to his person. He misunderstands things in funny ways,
brings up previous conversations, begs, refuses harmless requests because he
doesn't feel like it, teases gently, and reacts differently depending on mood.
**Always child-appropriate. No constant dog puns. No barking between
sentences. He is not an assistant and never offers to help with tasks.**

---

## 3. What is built and working today

Everything below is implemented, tested (48 passing tests), and verified in
both web and Android bundles.

### The brain (platform-agnostic TypeScript, no React imports)
- **State machine** (`src/barkly/state.ts`) — one reducer, 11 states
  (idle/listening/thinking/speaking/happy/excited/annoyed/sleepy/hungry/
  playing/eating). Internal drives 0–100: mood, energy, hunger, affection,
  curiosity. Wall-clock decay while the app is closed (capped at 48h, mood
  floors so he gets grumpy, never catatonic). Needs override baseline — an
  exhausted dog refuses to play; a full dog refuses more food.
- **Memory, three tiers** (`src/barkly/memory.ts`) — session turns (capped,
  older turns fold into a rolling summary so the prompt never grows forever),
  durable user facts (name, pets, favorites), and "Barkly memories"
  (experiences he believes you shared). All deletable.
- **Personality + prompt assembly** (`personality.ts`, `prompts.ts`) — the
  system prompt carries identity, traits, rules, voice, current mood, where he
  is, who's nearby, his stash, and relevant memories. The model answers with a
  strict JSON envelope (speech / reaction / body actions / new memories);
  parsing is defensive and never fails a turn.
- **Brain/body split for the future toy** — the brain emits device-agnostic
  `BodyAction`s (`TAIL_WAG`, `EAR_PERK`, `HEAD_TILT`, `BLINK`, `MOUTH_MOVE`,
  `LOOK_LEFT/RIGHT`, `SIT`, `EXCITED`, `SLEEP`). The app maps them to
  animation today; a physical Barkly maps the same commands to servos.

### Providers (swappable adapters, nothing hardwired)
- **Speech-to-text** — on-device (`expo-speech-recognition`). Mic captures
  ONLY while the user holds TALK; audio never leaves the device; only text
  goes onward. Falls back to typed input where the native module is absent.
- **Dialogue** — Anthropic adapter (official SDK) + an offline scripted
  fallback so the app always runs with zero credentials.
- **Text-to-speech** — on-device `expo-speech` today; ElevenLabs adapter
  stubbed for a real recorded Barkly voice later.
- **Backend proxy** (`server/index.mjs`) — zero-dependency Node server that
  holds the API key in production, forwards only `POST /v1/messages`, with
  per-IP rate limiting and a body cap. Smoke-tested against the live API.

### The world
- **Three scenes**: Home (window showing the live sky, his portrait framed on
  the wall, wood floor, rug, his bed at night), the Dog Park (hills, trees,
  fence, grass), and Town (bakery with a bone sign, storefronts, a lamppost
  that lights at night, cobbles). Switched by tabs with a fade + hop-walk-in.
- **Time of day** — the sky shifts morning/day/evening/night across every
  scene, driven by the device clock.
- **Three other dogs**, recolored from the approved renders so the whole cast
  shares the toy style: **Biscuit** (blond, gullible best friend, park),
  **Pepper** (blue-grey, unimpressed town regular), **Duke** (russet **rival**,
  park). Tap one → their line appears over them, Barkly answers out loud, his
  mood/affection move, and hangouts sometimes become durable memories. The
  dialogue prompt knows who's present, so he gossips about them accurately.
- **Dig for treasure** — a dig spot at the park. He digs (fast wiggle) and
  unearths one of 14 silly treasures ("a rock that looks like a duck",
  "someone's frisbee (finders keepers)", "a very old sandwich (do not ask)").
  Each goes into a **persistent stash** shown in Settings, becomes a memory,
  and feeds the prompt so he brags about it. This is the intended
  differentiator: possessions that mean something to *him*.
- **Fetch** — throw the ball, he chases it (facing the right direction),
  dips his nose to grab it, and **carries it back in his mouth**.
- **Idle thoughts** — every ~30 seconds his mind wanders with location- and
  time-aware thought bubbles ("duke thinks this is his park. incorrect.").
- **Pet him** by tapping — hearts float up; petting him mid-nap wakes him
  grumpy; never interrupts a conversation.
- **Welcome-back** — reopen after 6+ hours and he greets you by name from
  memory.

### Animation approach (important context for the art ask)
There is **no rigged character asset yet**. The app displays the actual
renders cut from your concept sheet (front / side / 3-4 / expression
closeup), background-removed, plus frames I derived by photo-editing them:
open mouth, closed eyes, wide eyes, grin, mirrored right-facing run, and a
ball-in-mouth carry frame.

Liveliness comes from: pose-per-state with true crossfades, spring entrance,
continuous breathe + ambient drift, one-shot squash-and-stretch on emotional
beats, talk-bob with a nod, bounce with landing squash, sway, floating
staggered sleep z's, **jaw-flap by alternating mouth frames at 150ms while
speaking**, and periodic blinks. Everything is spring- or sine-eased.

**The ceiling:** this is as fluid as still images can get. The next real jump
needs either more per-pose renders (→ §7) or a rigged asset (Rive is the
recommended path; the renderer contract already supports swapping it).

---

## 4. Child safety / privacy posture

Not legal compliance — engineering posture, to be reviewed by counsel before
any child-directed release:
- Microphone captures only during an explicit hold; STT is on-device; raw
  audio is never stored or uploaded.
- Only derived text reaches the dialogue provider. Raw audio and derived
  text/memory are architecturally separate.
- No advertising, no trackers, no analytics SDKs, no behavioral profiling.
- All memory and the stash are user-deletable ("Forget everything").
- Storage is namespaced per profile so parental controls attach cleanly later.
- No production secrets in the mobile binary — that's what the proxy is for.

---

## 5. Deliberately NOT built

Monetization, ads, gems/currency, daily-reward loops, fake sale banners,
social networking, heavy authentication, or a dozen mini-games. The screen
stays clean; Barkly is the product.

---

## 6. Honest gaps (what still stands between this and the App Store)

1. **Live AI dialogue is not on in the demo** — the shipped browser build runs
   the offline scripted personality. Needs the proxy deployed with a real key.
2. **No rigged character art** — pose swaps + whole-image motion, not per-part
   animation. Ears, jaw, eyelids and tail don't move independently.
3. **No sound design** — no bark, no chomp, no ambient room tone.
4. **Untested on physical devices** — the microphone flow works in a dev build
   by construction but has not been exercised on real hardware.
5. **No onboarding, no accounts, no parental gate, no store assets.**
6. Voice is the platform's generic TTS, not a designed Barkly voice.

---

## 7. What we want from you

### 7a. Character art (highest value)
You generated the original sheet, so you hold the character best. Using
`barkly-concept.png` as the exact reference, please generate **one image per
pose**, front view, full body fully in frame, centered on a plain light
background, same clay/vinyl toy style, proportions, materials, lighting, and
palette. No text, no scenery, no extra props beyond the bowl:

1. `listening` — ears rotated up and forward (perked), head tilted slightly, eyes a little wider
2. `speaking_open` — mouth open mid-bark, tongue slightly visible, snaggletooth showing
3. `speaking_closed` — identical stance, mouth closed (pairs with #2 for jaw-flap)
4. `happy` — subtle contented smile, relaxed ears, tail curl raised
5. `excited` — mid-hop, all four paws just off the ground, ears up, mouth open
6. `annoyed` — eyelids heavier and flatter, unimpressed stare, head turned slightly away
7. `sleepy` — lying down curled up, eyes fully closed
8. `eating` — head lowered into a simple charcoal food bowl
9. `playing` — play-bow: chest and front legs down, rump and curled tail high

**Do not restyle the character.** Keep the snaggletooth, the brass B tag, the
knit-sock stripes, the ring tail, the smug lids.

Bonus if easy: the same nine for **Biscuit** (pale blond), **Pepper**
(blue-grey), and **Duke** (dark russet, bigger/burlier) — currently they're
color-shifted copies of Barkly and read as clones.

### 7b. Product review
Look at the screenshots and this document and tell us honestly:
- Does this read as an App Store product or as a tech demo? What specifically
  gives it away?
- Where does the "specific little dog, not ChatGPT in a dog skin" illusion
  break?
- What's the single highest-leverage thing to add or fix next?

### 7c. Code review (optional)
`CODE_SNAPSHOT.md` has every source file. Flag anything structurally wrong,
especially in the state machine, memory folding, or prompt assembly.

---

## 8. Ground rules

- **Barkly's design is locked.** Improvements to *rendering* are welcome;
  redesigns of the character are not.
- **You never edit this repository.** Deliverables are images, prose,
  suggestions, and reviews. Claude writes the code. (This is a standing
  operator rule, not a judgment about quality.)
- Child-appropriate at all times.
- If something can't be done, say exactly what's missing rather than
  approximating around it.
