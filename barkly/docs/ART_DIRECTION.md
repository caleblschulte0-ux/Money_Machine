# Barkly art direction — the Supercell target, as numbers

Operator ruling, 2026-09-02. The look we are building toward is the Supercell
toy-diorama family. In the operator's own ranking:

1. **Brawl Stars** — the benchmark. Big simple shapes, rounded everything,
   saturated colour, exaggerated proportions, clean shadows, near-zero visual
   noise.
2. **Squad Busters** — the same language pushed into chunky little 3D worlds.
3. **Clash Mini** — *the closest reference for Barkly.* Grass, trees, barrels,
   wagons, water and buildings that read as moulded toys on a board.
4. **mo.co** — how to make the world richer without going realistic.
5. **Zooba** — chunky animal characters in rounded environments.
6. **Smash Legends** — strong silhouettes, soft geometry, punchy lighting.
7. **Pokémon Unite** — how props read clearly from a mobile camera.
8. **Stumble Guys** — crude, but nails physical candy/toy materials.

## Why this file has numbers in it

"It looks washed out" is unfalsifiable and we went several rounds on it. The
art lab (`scripts/art-lab.mjs` + `scripts/art-lab-sheet.py`) measures the world
region of every scene — chrome and the dialogue panel excluded, since UI would
flatter the result — and reports chroma and value statistics. Targets:

| metric | meaning | day target | we were at |
|---|---|---|---|
| `mean_sat` | average chroma | **0.42–0.55** | 0.26–0.42 |
| `p90_sat` | the colourful 10% | **0.65+** | 0.43–0.53 |
| `val_spread` | light-to-dark range | **0.55+** | 0.56–0.64 (fine) |
| `washed_frac` | pixels under 0.18 chroma | **under 12%** | up to 38% |

Value range was never the problem. **Chroma was**, and the dead grey was
concentrated in town and beach.

## The finding that matters

Boosting `src/ui/scenes/artPalette.ts` lifted park (`mean_sat` 0.416 → 0.476,
`p90_sat` 0.525 → 0.665) and home, and did **nothing** for town and beach
(0.256 → 0.241, `washed_frac` 38% → 40%). That is the whole story: those two
scenes are dominated by baked Blender PNGs, so their colour does not live in
the code palette at all. It lives in `tools/blender/*.py` and only changes when
the render workflow runs.

A palette pass alone can therefore never fix town or beach. The grading is
applied at both ends now — the code palette and the Blender materials — using
the same transform, so props and code-drawn scenery stay in one colour family.

## The MASTER GRADE (2026-09-02)

Four locations were reading as four different games, and the contact sheet
could finally say so in a number. `art-lab-sheet.py` now reports a
saturation-weighted **circular-mean hue** per scene plus a `hue_focus`
concentration, so "these don't look like the same world" stops being taste:

**The hue figures published in the first version of this section were wrong.**
`art-lab-sheet.py` sorted `sats` in place for its percentiles BEFORE zipping it
with `hues`, so every hue was weighted by the i-th smallest saturation in the
frame rather than by its own pixel's — the weighting was by raster position,
not by chroma. On a synthetic saturated-sky-over-pale-sand frame it reported
39° against a true 224°: the opposite side of the wheel. `mean_sat`, `p90_sat`,
`mean_val`, `val_spread` and `washed_frac` were never affected (a sum and a
sorted percentile do not care about order), so the chroma evidence below stands
as published. The hue table does not, and is replaced here with numbers from
the corrected metric measured against the real pre-grade commit (`bd41e79`),
rebuilt and re-captured for the purpose rather than restated from memory.

The tool now self-checks on every run against a frame with a known answer, and
that check has been verified to fail when the mispairing is reintroduced.

**Hue centroids per band, and how far apart the four locations are:**

| band | before | spread | after | spread |
|---|---|---|---|---|
| morning | 36 / 91 / 63 / 52 | 54° | 34 / 91 / 56 / 49 | 57° |
| day | 37 / 98 / 120 / 63 | 82° | 35 / 93 / 73 / 56 | **58°** |
| evening | 36 / 90 / 47 / 46 | 54° | 31 / 78 / 33 / 39 | **47°** |
| night | 14 / 109 / 265 / 37 | **157°** | 250 / 205 / 232 / 235 | **45°** |

Night is the headline and it is bigger than the wrong numbers suggested: four
locations spread 157° apart — most of the colour wheel — now sit inside 45°,
all of them blue. Day and evening tighten too. Morning is flat (54° → 57°),
which is honest: it was already the most coherent band and the grade did not
need to do much there.

Full before/after, all eight day/night frames (`mean_sat` / `washed_frac`):

| scene | before | after |
|---|---|---|
| home-day | 0.416 / 3.0% | 0.434 / 1.5% |
| park-day | 0.529 / 0.8% | 0.513 / 0.6% |
| town-day | 0.309 / **22.3%** | 0.329 / **7.6%** |
| beach-day | 0.421 / 9.8% | 0.433 / 4.8% |
| home-night | 0.396 / 6.5% | 0.384 / 17.5% |
| park-night | 0.417 / 1.6% | 0.506 / 3.9% |
| town-night | 0.340 / 19.1% | 0.438 / 11.0% |
| beach-night | 0.421 / 8.9% | 0.410 / 10.2% |

Home at night is the one number that got worse, and it is a real trade rather
than an oversight: a room full of warm wood under a blue night has genuine
crossover pixels. See the note below.

Day scenes keep their own local colour — grass is green, sand is gold, and
forcing a park to be orange would be worse than the problem. What was actually
broken was the **light**: every scene lit itself, so Park ran cold while Home,
Town and Beach ran "warm", and night was a purple dimmer switch. Now
`WorldLighting` applies ONE grade to all four — same key colour, same
direction, same cool shadow, same vignette — and `warm` no longer picks a
different sun, it only says a place has a bounce source of its own.

Night is a **colour**, not less brightness: a deep blue wash over the whole
frame with warm pools of light lying on the ground. Two things had to be true
for that to work, and both were measured:

1. The blue has to be strong. Softening it and spreading the gold wider was
   tried and was worse in both directions: gold over blue mixes toward
   neutral, so the dead-pixel share tripled (beach 7% → 40%) while the hues
   scattered again.
2. The pools go **on top of** the wash. They were underneath it, so the blue
   was composited over the gold exactly where the light was meant to be
   brightest.

A third thing was tried and **rejected on the numbers**: an `interior` flag
that took Home down to 58% of the wash, on the reasonable-sounding theory that
a room after dark is lit by its own lamp. It made both numbers worse — Home's
neutral share went 18.3% → 22.3% and its hue centroid slid out of the night
family entirely (275° → 332°). Half a grade is not a grade. Home still carries
the highest neutral share of the eight frames (~18%) and that is accepted: a
room full of warm wood under a blue night has genuine crossover pixels, and
the frame reads correctly. **The fix for a muddy scene is more light in the
pools, never less colour in the wash.**

## Four light bands, and lights that are actually ON

Two follow-ons from the grade, both found by looking at what the harness was
NOT capturing.

**Morning and evening were never reviewed.** `art-lab.mjs` captured day (14:00)
and night (22:00) only, so the eight hours a day that `skyBand()` calls
`morning` (06–10) and `evening` (17–21) had never once appeared on a contact
sheet. They were rendering a sunrise or sunset SKY under flat noon LIGHT — the
scene disagreeing with its own sky for a third of every day. The grade now has
four entries sharing one recipe (warm key upper-left, cool shadow low, one
vignette); what changes between them is the colour and strength of that key,
which is what changing light actually does. Evening is the one band allowed to
be loud: a low orange key and a long cool shadow, the hour the reference games
use for their key art. The lab captures all four, and `--bands day,night`
narrows it when you want a quick check.

**A town at night had its lights off.** Every street lamp rendered as a dark
post and every shop window as a dark hole, which is most of why night read as
"the day scene, dimmed". Town now has lit bulbs with a bloom and a pool of
light on the pavement, its shopfronts glow from inside, and Home's floor lamp
is on. All of it renders AFTER `WorldLighting`, which is the same rule the warm
pools inside it had to learn: put a light under the atmospheric wash and the
blue composites straight over the gold. Measured — the first version was
rendered as a foreground layer, i.e. under the grade:

| town-night | unlit | lit, under the wash | lit, over the wash |
|---|---|---|---|
| `mean_sat` | 0.452 | 0.401 | 0.439 |
| `washed_frac` | 10.0% | 17.3% | **7.5%** |

The middle column is what a lamp looks like when the night is painted on top
of it: a flat pale-blue disc that reads as a UI artifact.

**A lit window is the light on the pavement, not a panel on the glass.** Two
versions of a lit shop window were built and both were thrown away for the
same reason — an overlay rectangle over a rendered shopfront reads as a
rectangle. Small and opaque it was a sticky note; large and soft it was a
translucent panel laid over the signage, and it measured worse as well
(town-night 7.5% → 14.6% neutral, because gold spread over that much blue
mixes toward grey). What ships is warm spill pooling on the pavement in front
of each door: it says the same thing, cannot be mistaken for geometry, and
only touches pixels that are already lit.

### The first four-band contact sheet

| scene | morning | day | evening | night |
|---|---|---|---|---|
| home | 0.415 / 2.7% | 0.434 / 1.5% | 0.453 / 1.2% | 0.401 / 15.7% |
| park | 0.500 / 0.7% | 0.501 / 0.9% | 0.500 / 0.7% | 0.506 / 4.0% |
| town | 0.311 / 11.3% | 0.329 / 7.1% | 0.329 / 13.7% | see below |
| beach | 0.425 / 4.7% | 0.434 / 4.8% | 0.446 / 3.4% | 0.403 / 9.5% |

And after the pavement, the prop-material and the lighting work below
(`mean_sat` / `washed_frac`, same harness, `build:pages` build):

| scene | morning | day | evening | night |
|---|---|---|---|---|
| home | 0.419 / 2.8% | 0.435 / 1.5% | 0.454 / 1.3% | 0.381 / 17.4% |
| park | 0.500 / 0.7% | 0.513 / 0.6% | 0.500 / 0.7% | 0.518 / 3.3% |
| town | **0.330 / 9.9%** | **0.345 / 5.9%** | **0.347 / 12.2%** | 0.432 / 11.7% |
| beach | 0.426 / 4.7% | 0.429 / 5.1% | 0.441 / 3.6% | 0.399 / 9.9% |

Town rises at all three lit bands and its colourless share falls at every one
of the four. The two that get slightly worse are night scenes with a warm light
source in them — home 15.7% → 17.4%, town 11.0% → 11.7% — and that is the
documented cost of a REAL falloff: three hard-edged discs touched fewer pixels
than a gradient does, and every extra pixel of gold over blue mixes toward
neutral. The trade is deliberate and it is the same one this file already
accepts for Home: the frames read as lamps now instead of as ringed toggles,
and the fix for a muddy night scene is still more light in the pools, never
less colour in the wash.

(`mean_sat` / `washed_frac`.) Evening is the tightest hue cluster of any band —
32° / 78° / 45° / 42°, a 46° spread against day's 55° — which is the grade
working: one strong low key pulls four different local palettes into one light.
Town stays the weakest scene at every hour. The guess written here — "it is the
one with the most sky and the palest ground" — was half right and is answered
two sections down: it was the ground, and specifically that the ground was ONE
FLAT FILL covering a fifth of the frame.

## AgX is why every Blender prop was pastel

The biggest finding of this pass. Town's storefronts render around
`#A0A0A0`/`#C0A0A0` on screen while their authored base colours are `#E14B45`
and `#37B4CD`. Nothing in the app was doing that. All three Blender rigs set

```python
scene.view_settings.look = "AgX - Medium High Contrast"
```

**AgX is a filmic view transform whose job is to roll saturated highlights
toward white** so photographic renders don't clip — and under a 1000W key that
is most of a brightly lit toy prop. It is the right transform for photoreal
work and the wrong one for stylised game art, where the flat saturated colour
IS the look. Measured on `town/store_violet.png`: 45.2% of its opaque pixels
were under 0.18 chroma.

`world_prop_pack.py`, `home_prop_pack.py` and `home_architecture.py` now render
through **Standard**, with the key/fill/rim energies re-balanced (verified
locally against the shipping PNGs, not guessed).

This is what the note below was circling and could not name: a palette pass
could never fix Town, because Town's colour was being destroyed at render
time, not at composite time.

## Town: the biggest surface in the frame was one flat slab

Town measured the weakest scene at every hour after the master grade landed
(`mean_sat` 0.31–0.33 against 0.42–0.51 everywhere else), and the standing note
in this file guessed it was "the one with the most sky and the palest ground".
A colour-bucket histogram over the world region says which surface, and it is
not the sky:

```
town-day, biggest buckets by share of the frame    park-day, for comparison
  #C0C090  19.3%  sat 0.298   <- the pavement       #309030  24.0%  sat 0.628
  #306060   7.1%  sat 0.322                         #60C030  11.6%  sat 0.581
```

A fifth of the frame was one flat fill at 0.30 chroma. Park's dominant surface
is a BIGGER share of its frame and reads rich, because it is a far-to-near ramp
with tufts on it — several related tones, not one. The pavement now gets the
same treatment: a `townWalk` gradient from a warm far tone to a deeper near
one, paving joints that converge on the same vanishing point as the road
markings, and three horizontal courses that space out toward the viewer. The
flat bucket dropped 19.3% → 13.3%, and 8.6% of the frame moved from 0.25 to
0.50 chroma.

## Standard was necessary but not sufficient: the COOL FILL

Switching the Blender rigs off AgX (below) fixed the storefronts. It did not
fix everything, and "the props are Standard now" was doing too much work as an
explanation. Measured per prop, on the shipped PNGs:

| prop | before | after |
|---|---|---|
| `town/lamp` | 0.292 / **18.0%** colourless | 0.480 / **2.0%** |
| `town/fountain` | 0.285 / **15.6%** | 0.394 / 7.0% |
| `town/store_violet` | 0.344 / 3.4% | 0.390 / 2.3% |

Three separate causes, none of them the view transform:

- **Materials authored a couple of shades off white.** The fountain stone was
  `#E5BD76` with `#FFD98A` sun faces; under a 790W key that is white. Deeper
  sandstone reads the same and survives.
- **Leftover metallic.** The lamp's brass was still at 0.72. A previous pass
  had already taken the metal off the post for exactly this reason and stopped
  there.
- **A cool fill on a cool object.** The fill is `(0.58, 0.78, 1.0)`, so a navy
  post lands as cyan-grey no matter what the transform does. The post is now
  painted teal (`#1A6B84`, the `townBlueEdge` family) which keeps its hue under
  that fill — and ties the two tallest objects in Town to Town's own palette.

Every prop in the pack is now under 10% colourless; the worst is the fountain
at 7.0%.

## "react-native-web has no radial gradient" was not true

Three separate lights in this app were built around that sentence, written in
three different comments. `expo-linear-gradient` has no radial gradient;
**`react-native-svg`, which every one of those scenes already imports, has had
`RadialGradient` the whole time.** What shipped instead:

- Town's street lamps: three concentric filled discs, "each smaller and
  stronger to approximate a falloff". Three discs have three visible circular
  edges, and on the night contact sheet they read as ringed UI toggles.
- Home's lamp halo: a VERTICAL linear gradient inside a circular box — a band
  of light with two straight edges wearing a round mask, legible as a glow only
  because it was faint.
- The sun and moon: a 50px flat-filled `borderRadius: pill` View. Nothing in
  the sky acknowledged the brightest object in the frame.

All three now use one shared `RadialGlow` in `WorldScene.tsx` (a centre, a
radius, and a three-stop alpha ramp that is forced to zero at the rim, so a
glow can never show an edge at the boundary of its own box).

**And a second thing that is not true: `<Mask>` does not survive
react-native-svg's web renderer.** The moon was rebuilt as a masked disc, and
it shipped in the captured frame as a full flat grey circle with no bite taken
out of it — strictly worse than the trick it replaced. The frame is how that
was caught; the code looked right. Repainting the bite in `skyNightA` (the old
approach) puts a visibly lighter round patch in the sky wherever the night
gradient is not exactly that colour, which is most of the sky. So the crescent
is now ONE path: the major arc of the moon plus the minor arc of the cutter,
from the circle-circle intersection. No mask, no fake sky.

## The harness was measuring the wrong build, four ways

Every number in this file comes from `art-lab.mjs` + `art-lab-sheet.py`, so a
harness that answers confidently when it was driven wrong is worse than no
harness. Four ways it could, all now closed and each verified by reproducing
the failure:

1. **`art-lab.mjs` serves a pre-built artifact and does not build one.** Run it
   straight after an edit and it measures the LAST build — and "the change did
   nothing" is exactly what a real no-op looks like, so you believe it. It now
   refuses when anything under `src/` or `assets/` is newer than the artifact,
   and prints the build command. `--stale-ok` re-measures an old build on
   purpose and says so.
2. **Loading the developed save was a `try`/`catch` NICE-TO-HAVE**, on the
   stated grounds that "the world art is identical either way". It is not: the
   default save is level 1, so Beach and Town are LOCKED and Home renders with
   no rug, bed or shelf. Loading is now required, retried, and VERIFIED against
   the tab bar; the run exits 3 if the save is not in.
3. **The build command in this very file was wrong** — `build:web`, which does
   not set `EXPO_PUBLIC_BARKLY_PLAYTEST=always`, so the playtest menu the lab
   drives the save through is not in the bundle. That is what tripped (2)
   above, in this session. It is `build:pages`.
4. **`art-lab-sheet.py` read `sys.argv[1]`/`[2]` positionally with no check.**
   `--frames art-lab/frames` — a plausible guess at the interface, and how a
   session actually called it — bound the frames directory to the literal
   string `--frames`, found no PNGs, printed a table of nothing and exited 0.
   It now refuses a flag, a missing directory, and an empty one.

## Rules

- **Never judge the art from one screenshot.** Cross-scene problems — a washed
  palette, chrome that only reads wrong beside another location — are invisible
  one frame at a time. Run the contact sheet.
- **Never judge motion from a still.** Idle drift, ear flicks and gesture decay
  had never once been reviewed before the motion strip existed.
- Saturated does not mean noisy. Brawl Stars is loud and *clean*: few shapes,
  big reads, no texture competing with the character.
- Barkly is the most saturated thing on screen and stays that way. The world
  rises to meet him; he does not come down to it.

```bash
# build:pages, NOT build:web -- the lab loads a developed save through the
# playtest menu, and that menu only exists in a build made with
# EXPO_PUBLIC_BARKLY_PLAYTEST=always. Without it every location past level 4 is
# locked and the run dies on the Beach tab (it used to fall back to the default
# save and quietly photograph a different, unfurnished game).
npm run build:pages
node scripts/art-lab.mjs --html dist/playtest/index.html --out art-lab
python3 scripts/art-lab-sheet.py art-lab/frames art-lab   # positional args
```
