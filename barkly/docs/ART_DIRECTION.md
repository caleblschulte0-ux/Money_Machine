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
| home | 0.419 / 2.7% | 0.434 / 1.6% | 0.460 / 1.3% | 0.383 / 17.5% |
| park | 0.500 / 0.7% | 0.501 / 0.9% | 0.511 / 0.4% | 0.518 / 3.3% |
| town | **0.330 / 9.9%** | **0.345 / 5.9%** | **0.345 / 12.4%** | 0.431 / 11.7% |
| beach | 0.421 / 4.9% | 0.428 / 5.1% | 0.446 / 3.4% | 0.406 / 10.6% |

(One run of the shipping build, not sixteen numbers assembled from four runs.
Two things are worth knowing about reading this table: run-to-run spread on an
unchanged scene is about +/-0.012 chroma and +/-0.7 points of `washed_frac`,
because the scenes animate and the capture lands wherever it lands -- so
anything inside that is noise, not a result. And the dusk lights and the
rebuilt ground shadow, both landed after the numbers above were first taken,
moved nothing outside it.)

Town rises at all three lit bands and its colourless share falls at every one
of the four. The two that get slightly worse are night scenes with a warm light
source in them — home 15.7% → 17.4%, town 11.0% → 11.7% — and that is the
documented cost of a REAL falloff: three hard-edged discs touched fewer pixels
than a gradient does, and every extra pixel of gold over blue mixes toward
neutral. The trade is deliberate and it is the same one this file already
accepts for Home: the frames read as lamps now instead of as ringed toggles,
and the fix for a muddy night scene is still more light in the pools, never
less colour in the wash.

### The night wash, re-measured 2026-09-04

Home-night was the worst cell in the table above by some way, at 0.383 / 17.5%,
in the room a player spends most of their time in. Three changes, all in the
same commit family:

- The night FLOOR was the day floor darkened — warm browns at hue 24-31 — and
  warm brown under a strong blue wash mixes toward grey. It is the bottom half
  of the frame. Moved into the violet family the night wall already uses, at
  the same saturation. `woodNight` followed, for coherence rather than for a
  number: on its own it measured inside the noise band.
- Barkly and the other dogs were not graded with the room at all. The scene
  takes the wash; the sprites are rendered ABOVE it and got none of it, so
  after dark he stood daylight-bright in a midnight room. `BarklyRoom` now lays
  a light version of the same wash over the dogs, above the props and below the
  kit and every piece of chrome, so nothing a child has to read is dimmed.

Measured on the shipping `build:pages` build with the same harness
(`art-lab.mjs --bands night` + `art-lab-sheet.py`):

| scene | before | after |
|---|---|---|
| home-night | 0.383 / 17.5% | **0.447 / 11.4%** |
| park-night | 0.518 / 3.3% | 0.539 / 5.4% |
| town-night | 0.431 / 11.7% | 0.450 / 11.3% |
| beach-night | 0.406 / 10.6% | 0.446 / 6.2% |

Home clears the under-12% target. Chroma is up in all four and the colourless
share falls in three; park rises 2.1 points, which is outside the noise band
and is the cost of laying a wash over sprites in the one scene that was already
the cleanest. Kept, because the alternative is a dog who is not standing in the
room he is standing in.

An earlier report of this work said home-night was 13.4% and short of target.
That number came from an ad-hoc crop taken mid-change, not from this harness;
the harness says 11.4%. The instrument in the repo is the one that counts, and
`art-lab-sheet.py` could not run at all until the same commit — it validated
its INPUT directory carefully and then died with a raw FileNotFoundError
writing to an output directory it never created, after doing all the measuring
and before printing any of it.

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

## Lights that were off, and one that was five edges

Two follow-ons from the shared `RadialGlow`, both found by asking where else
the same sentence had been written.

**The street lights came on at 21:00, not at dusk.** `TownNightLights` was
gated on `night`, so the 17:00-21:00 band -- a fifth of every day, and the one
whose sky most obviously reads as evening -- had a row of dead posts under an
orange sunset. They are lit at `intensity` 0.55 now, and so is Home's floor
lamp at 0.5.

But **only the bulbs -- not the halo, not the pools on the ground** -- and each
step of that was measured rather than argued. Lighting the pavement too took
town-evening from 12.2% to **15.0%** colourless; dropping the pools but keeping
the bloom still left it at **14.8%**; the lit pane alone lands at **12.5%**,
which is the baseline back inside noise. Gold spread across a still-bright
peach pavement flattens it exactly the way gold over the blue night wash does.
It is the same lesson as the lit shop windows, one step further -- after dark a
lamp must land on something or it floats, but at dusk the sky is still lighting
the town and all the lamps have to say is that they are ON.

Which exposed a third thing. With the bloom off, the "bulb" was visibly NOT in
the lantern: it was a rounded rect at the sprite's horizontal centre, and the
lit pane on this prop sits at **0.374 / 0.192** of the PNG and is 0.452 x 0.173
of it. Measured off the asset (the glass material is the only warm opaque
region in it) rather than eyeballed, and mirrored for the flipped right-hand
lamp. At night the bloom had been hiding the error for as long as it existed.

**The character shadow was five stacked ellipses**, written around the same
false premise in a fourth comment ("there is no radial gradient in React
Native"). Five layers is five edges under every dog in the game. Replacing
them was not a fresh guess at the profile: those five composite, so the darkest
point was never the 0.20 written on the contact core, it was
`1 - (0.95)(0.93)(0.90)(0.86)(0.80) = 0.45`, falling through 0.32 / 0.21 /
0.12 / 0.05 at the successive rims -- which sampled at `RadialGlow`'s stops is
0.45 / 0.30 / 0.13 to zero.

The first version of that swap **deleted every shadow in the game** and looked
completely reasonable in the diff. Giving the glow a negative `left` instead of
letting the wrapper centre it opts out of the `alignItems: center` the stacked
ellipses relied on, and the shadows silently vanished. It was caught by
sampling the ground under his paws against bare grass in a captured frame --
identical to within two values out of 255 -- which is the whole argument for
the contact sheet in one line: the code read correctly, the render did not.

## The lab had only ever photographed one save

`--preset` has been an argument since the lab existed and nothing ever passed
it. Worse, the "did the save load?" check asserted that EVERY location was
unlocked -- true only of `longterm` -- so any other preset was unreachable by
construction. Nine saves exist (`fresh`, `day3`, `established`, `longterm`,
`duke`, `biscuit`, `trickdog`, `goblin`, `rich`) and every contact sheet in
this file is of the level-8 furnished one. **The fresh start a new player
actually opens the app to had never once been reviewed.**

`longterm` still has to come back fully unlocked, because there a locked tab
really does mean the save did not load. Any other preset only has to have been
loaded, and a location it legitimately cannot reach is skipped and reported
rather than killing the run:

```bash
node scripts/art-lab.mjs --preset fresh --bands day
# captured home day / park day / town day
# skipped beach day — locked on the "fresh" save
```

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

## One shared camera, and the one prop that has to defy it

Every Blender rig in this app renders through the same camera —
`CAMERA_LOCATION = (3.0, -10.8, 4.5)`, checked by
`__tests__/scene_modularity.test.ts` in all three packs — because the first
pack let each prop pick its own angle and a room of them looked like a shelf
of product renders facing different vanishing points. That camera sits about
15.5° off-axis horizontally and about 20° above the horizon.

That off-axis yaw is what gives a bed or a chair its readable side plane, and
it is invisible on anything compact. On a **long** object it is a disaster,
and the reason is arithmetic rather than taste: a horizontal axis picks up
`sin(pitch)·sin(yaw)` of *vertical* screen travel per unit of length. At this
camera that is 0.093 per unit. Over the care tray's 5.6 units it is 0.52 —
more than the entire height of the tray itself.

So the tray's first render was a **diagonal plank**. Almost all of the 87px
alpha height of that image was tilt; the wood was about twelve. Stretched into
its 330×42 slot it became a stick with three bowls floating over it, and the
in-app capture is the only place that showed it — in isolation, on a
transparent canvas, it looked like a perfectly nice piece of wood.

The fix is in the builder, not the camera: rotate the model about Z by the
camera's own yaw so its long axis lands dead horizontal, and derive that angle
from `CAMERA_LOCATION` rather than typing 15.5 anywhere, so moving the camera
moves the tray with it. Nothing else in the pack changes.

Two smaller things that same prop taught, both worth knowing before adding
another wide one:

- **`cube()` takes HALF extents.** It scales a two-unit default cube. A pass
  that read the tuples as full sizes built the tray at double scale and sheared
  its ends off at the frame edge — and an alpha bbox reports that as a clean
  full-width render, so it has to be checked against the ortho box too.
- **Model at the aspect it is DISPLAYED at.** A tray that looks right on its
  own is 3.6:1; the slot is 7.86:1; `resizeMode="stretch"` does not care which
  one you liked. The render is measured against that number before it is
  promoted.

And the division that made it ship: **the render owns the wood, the app owns
anything that changes.** The three dishes stay live Views so they can still
brighten when Barkly wants that thing; a baked copy underneath them simply drew
everything twice. The app also keeps the dark border — wood on a wooden floor
has no edge of its own, and losing that silhouette was what made the first
in-app version read as a stain rather than an object.

## The pastel that survived the AgX fix

Dropping AgX was a real fix and the section above measures it honestly, right
down to the sentence admitting it "did not fix everything". This is the rest of
it, and it was never in the lighting at all.

**Blender's Base Color input is LINEAR. A hex colour off a palette is sRGB.**
All three rigs did this:

```python
return tuple(int(value[i:i + 2], 16) / 255 for i in (0, 2, 4))
```

which tells Blender that `#E14B45`'s 0.29 green *is* a linear 0.29. The render
then encodes back out through sRGB on the way to the PNG, and that lifts
mid-tones hard. Under a perfectly neutral unit light, with no rig, no shading,
and nothing else wrong:

| authored | comes back as |
|---|---|
| `#E14B45` coral | `#F1948E` |
| `#37B4CD` aqua | `#80DBE8` |
| `#8A3FD6` violet | `#C288EC` |

Three dusty pastels from three candy colours. The prediction checks out on the
shipped art: the coral storefront's dominant body pixel measured `#E08070`
against a predicted `#F1948E`, the gap being the light falloff. That is why
Town stayed the worst location on the contact sheet — 0.334 mean saturation
against a 0.42 floor — after the palette, the road, the compositing *and* the
view transform had all been fixed. Nothing downstream of an already-washed base
colour can put the chroma back.

Fixed in `_srgb_to_linear`, in all three packs, guarded by a test that also
refuses the raw division coming back. Measured over all twenty props:

| | before | after |
|---|---|---|
| mean saturation | 0.444 | **0.641** |
| mean colourless | 2.7% | **1.3%** |
| mean value | 0.683 | 0.617 |

The value drop is the honest half of the trade and it is not a loss: those
brighter numbers were the inflation, not the art. Every prop is darker and far
more colourful, which is the direction this document has asked for from the
top — Barkly is the most saturated thing on screen, and the world now rises to
meet him instead of sitting pastel underneath him.

**One consequence to watch for.** Materials authored *while* the bug was live
were picked to land correctly through it, so they are several stops too dark
once it is fixed. The care tray was written at `#6A2F0C`/`#4A1D06` and rendered
nearly black; it is `#C0762A`/`#9B531A` now — the colour it should actually be.
If a prop's material list looks like it is apologising for the lighting, check
the colour space before tuning anything.

---

## The sky, and the view through the window (2026-09-07)

Four scenes were photographed at 2pm on a 390x844 at 2x and read cold. The
surfaces below the horizon had all been rebuilt by then — park grass, town
pavement, home's wall, beach sand — so what was left standing out was
everything ABOVE it, plus the one place a scene is framed inside another.

### Three things were still drawn

**The clouds were `borderRadius` Views.** Five white pills per cloud, stacked
into a lumpy outline, with a long comment above them explaining how to arrange
pills so they stop reading as a UI panel. On the beach capture the near one
still read as a pale grey rounded slab tucked under the tab bar. The comment
was right about the symptom and wrong about the cause: the arrangement was
never the problem. A capsule has one silhouette and one flat fill, and the sky
is the largest single surface in an outdoor frame — the last one still drawn
that way while everything under the horizon was a render.

**The window in Home was the worst object in the game, and it sat inside one
of the best.** The frame is a full render: mitred timber, a bevelled sill, a
real cast shadow. Behind its glass were three flat SVG bands and four ellipses
for trees. A child's drawing taped inside a photograph — in the room where
onboarding happens, which is the first thing a new player looks at.

**The beach's shoreline was a squiggle.** Two SVG strokes, a 20-wide shade and
a 10-wide highlight, stretched anamorphically through a `preserveAspectRatio
="none"` viewBox, doing the whole job of "water arriving at a shore".

### What the fix needed that the props did not

Clouds and surf are the two things in this world with genuinely no hard edges,
and overlapping spheres cannot make them: every lobe keeps its own terminator,
so the interior fills with crescent seams and the eye counts eight balls. The
first cloud pass rendered a bunch of grapes.

`metablob()` fuses a set of ellipsoids into one metaball surface — lumpy on
the silhouette, smooth inside it. Blender's default field threshold of 0.6 does
NOT merge neighbouring lobes; at 0.6 the first attempt rendered seven separate
eggs in a row, which is a worse cloud than the pills it replaced. Threshold
0.25 with a wide influence radius is what makes one mass.

The surf then taught the opposite lesson. Evenly spaced lobes fuse into a rope
however much their heights vary, and the first pass was a fat white sausage —
a kerb, exactly what its own docstring said to avoid. Surf reads because it
BREAKS: the gaps between groups have to be wider than the field can bridge, and
two or three tall crests have to carry a line that is thin everywhere else.

### Two colour findings, both measured rather than judged

**A warm key eats low-chroma blue.** The vista's far ridge was authored
`#8FB6BE` and rendered a neutral grey — a heap of boulders behind the fields.
`#A3C4DA`, an honest distant-hill blue, rendered grey too. The pack's key is
`(1.0, 0.77, 0.58)` at 880W, and it neutralises anything that is not already
saturated. `#6FAEE0` is what brings the far band back to hue 200 at saturation
0.34, above the grass's 0.30 — which is the actual test, because distance reads
when the far band is MORE chromatic than the near one, not less. This is the
same effect this document already records for the violet storefront.

**Neutral white renders peach.** For the same reason, a `#FFFFFF` cloud comes
out cream. Fine on a wooden bench; wrong on the one object in a frame the eye
reads as "white". The clouds are authored `#E9F1FF` so the key brings them back
to a warm bias of +13 (r−b), against the old pills' +18, at a lit value of 210.

### The bug that had no symptom in the code

The clouds shipped for one build with their wrappers a correct 140x36 and 90x23
and the images inside them 536x137 and 361x93 — the PNG files' own pixel
dimensions. `styles.fill` is `position: absolute` with all four insets and no
width, which constrains a View and does NOT constrain an Image:
react-native-web renders one as a div carrying its intrinsic size, and that
wins. Four times too big, so the sky filled with cloud.

Nothing failed. The wrapper measured right, the asset was right, and the aspect
locks passed because the aspect WAS correct. What caught it was measuring the
sun: **6,927 lit pixels before, 160 after**. `scene_surfaces.test.ts` now
refuses any Image in a scene file whose own style carries no width.

The general rule, third time it has bitten this app: **size renders by width
and the file's own aspect.** The dig mound shipped 22% squashed off a typed
height; the vista shipped squashed the other way off `resizeMode="stretch"`
into a nearly square pane; the clouds shipped at intrinsic size off an inset
style. Same defect, three different disguises.

### A composite is one prop

Wiring the vista made `scripts/blocking.mjs` fail Home, and it was right about
the geometry: a 116x48 box sitting 100% inside a 190x200 box at the same
distance. That is the rule which catches genuine clutter — the beach shell that
landed wholly inside a dune — and it had never seen a window before, because
until now the thing behind the glass was SVG and the gate only measures images.

The rule is correct. Its model of a prop was not. A window is a frame *and*
what is behind its glass, and the parts of one object are not rivals to each
other. The collector now takes anything marked `world-composite` as a single
union box, so the rule keeps all its force between props — which is where the
clutter it exists to catch actually happens — and stops reading one prop's
parts as several props.

Fixed that way rather than by exempting the window by name: the next composite
(a shopfront with its sign, a screen with a picture on it) says the same thing
and gets the same treatment. Verified in both directions — the beach shell put
back at `fx 0.94` is still caught, and Home passes.

### The floor: a rendered course was built, and rejected

Home's floor was the last surface still drawn, and both things wrong with it
were parameters rather than technique. Measured on the shipped scene: six plank
lines 90pt apart on a 390pt screen — a four-board room — with four *horizontal*
rules crossing them, which is what turned the floor into a grid of squares.
Under that, a second `Rect` at 0.72 opacity stepped the tone across the middle
of the room along a hard edge: **a 117-unit row-to-row jump in a clear strip of
floor**, which is a step, not a floor.

The obvious move was the one town's pavement got — a rendered course, laid at
increasing width so the courses recede. It was built (`home_floorboards`) and
it took three passes, each of which read as brickwork:

| pass | per-board aspect | read |
|---|---|---|
| 8 segments/course, 0.44 deep | 2.3:1 | bricks |
| 3 segments/course, 0.44 deep | 4.8:1 | large blocks |
| 3 segments/course, 0.23 deep | 10.2:1 | *still* running bond |

The third pass had the proportions of a plank and still said wall, which is
when the actual problem became clear: **a cross-laid course of boards with
staggered butt joints IS running bond.** That is what running bond means. No
amount of proportion tuning gets a masonry pattern to read as timber, and the
reason a real floor does not look like that is that floorboards run the length
of the room — away from the viewer — where their joints are rare and their
seams converge.

Which is exactly what the drawn floor was already doing, with the wrong numbers.
So: fifteen plank lines instead of six, the horizontal rules deleted, the same
1.85 spread kept (boards widening toward the camera was the one thing the
original projection had exactly right), and the hard `Rect` replaced by a
gradient that starts transparent at the wall. The worst row-to-row jump in a
clear strip of floor is **11** now, against 117.

`home_floorboards` is deleted — builder, registration and asset. A prop that
does not fit is not a prop to keep in the pack because it cost three passes to
make; that is the sunk-cost version of the unwired-capability sin this document
already argues against. What is worth keeping is the finding, which is why it
is written down here.

---

## Depth: the scenes had none, and the code said so (2026-09-08)

"The backgrounds still need work — it's the art, the style." Measured before
touching anything, sampling value and saturation in three horizontal bands of
each scene at 2pm:

| park band | value | saturation |
|---|---|---|
| far (behind the horizon) | 0.454 | 0.397 |
| mid | 0.438 | 0.480 |
| near (foreground) | 0.447 | 0.404 |

**Identical at every depth.** A far-to-near value gap of +0.007. That is the
whole finding: a scene with no aerial perspective reads as a pile of objects
standing on a colour, not as a place, however good the objects are.

The code said so too. `atmosphericOpacity` was `0.93 + depth * 0.07` — a 7%
swing, deliberately clamped, because an earlier attempt faded distant props
toward the background and turned Town grey.

### Fading is the wrong operation

Distance does not make things transparent. It lays the **sky** over them, which
lifts value and pulls hue toward the sky while the object's own chroma survives
underneath. Fading toward a background is what makes things grey; tinting
toward the sky is what makes them distant.

So `WorldObject` draws a second copy of its art, tinted to the haze colour at
low opacity. It respects the prop's alpha, where a plain overlay View would
haze a rectangle. `(1 - depth)²`, because haze accumulates with distance and a
linear ramp veiled midground props that should be clear.

### Most of a scene is ground, and the ground wore nothing

Prop haze alone barely moved the measurement. Sampled down a clear column of
park grass: hue 89–100°, saturation 0.48–0.50, value 0.57 → 0.52 across the
**entire field**. One flat green from the horizon to the camera.

`GroundHaze` draws the two gradients every stylised background uses — sky lying
on the far ground, the near ground going richer and deeper — at the end of the
ground layer, so terrain and trail recede together while props keep their own
per-depth haze. Park's far-to-near value gap: **+0.007 → +0.096**. Town's
flipped sign, from −0.078 (far *darker* than near) to +0.082.

### Turning on a real effect exposed two authoring errors

**Town's storefronts were authored as distance.** Depth 0.32–0.38, harmless
while depth drove a 7% nudge, and at real strength it put 18% sky over the
three biggest, most saturated objects in the game. They are not distant — they
are the street the dog stands in; the rooftops behind them at 0.10 are the
distance here. Re-authored to ~0.55.

**And they were in the wrong layer.** `distant` sits at z 10, *below* the
ground plane at z 20, so the ground's own haze washed straight over them.
Invisible while the ground was a flat fill. Measured on the storefront band:

| | value | saturation |
|---|---|---|
| no haze | 0.444 | 0.459 |
| ground haze alone | 0.471 | 0.425 |
| ground + prop haze | 0.488 | 0.405 |

— closing on the 0.42 floor this document already records Town being fought
back from once. A building occludes the ground it stands on, so they belong in
`landmark` (z 30). With that and the depth fix: 0.460 / 0.433.

Moving them broke the shop sign, exactly as the note in `OutdoorRenderedScenes`
predicts: `baselineZ(...) + 1` only beats the shopfront while the two are
**siblings**, so "BARKLY'S" went behind the building again and vanished from
the capture. The sign moves with the shops.

### One scene needed less

The beach's ground is two surfaces, and the sea — the scene's colour anchor —
sits entirely inside the band where haze is strongest. At full strength the
water went 0.526 / 0.455 → 0.640 / 0.377: a pale grey-blue where there had been
teal, which is the flatness the beach was rebuilt to fix, arriving from the
other direction. Shortening the band does not help, because the sea *is* the
band. `GroundHaze` takes a `strength` multiplier and the beach passes 0.46.

### Nothing threw a shadow

After the haze the scenes had depth and still read as cutouts, and the reason
is visible the moment you crop the park's midground and look at the ground
instead of the props: every object had a dark pool directly underneath it and
**nothing threw a shadow in any direction**. On a sunny field, with a sun drawn
in the sky, the objects and the ground never agreed that there was a light.

One direction for the whole app, and it is not a preference. The prop pack's
key sits at `(-4.8, -5.0, 8.4)` — upper left and in front — so every render is
already lit from the upper left and the shadow it owes the ground runs down and
to the **right**. Getting that backwards would fight the shading baked into
every asset, so `scene_surfaces.test.ts` now reads the key's position out of
`world_prop_pack.py` and checks the sign of the offset against it.

Length scales with the prop's own height, because that is what a shadow does,
and it stays flat: the ground is seen at a shallow angle, so a shadow lying on
it projects to a fraction of its length. The pool and the core still sit on
top, doing the "this is TOUCHING" half of the job.

### And the field had no terrain in it

The last flatness is the one the haze cannot reach: within any horizontal slice
the ground is a single colour. Grass blades sit on it; nothing happens
*between* them. `GroundPatches` adds the large low-frequency shapes every
stylised background carries — cloud shadow, a dip that holds the damp, a place
the light lands — soft-edged, placed by fractions of the ground band so the
composition holds at any viewport, and drawn under everything, because they are
terrain rather than props and no gate should treat them as objects.

They grow toward the camera. A patch is a fixed size in the world, so the near
ones cover more of the frame; the first version kept them equal and flattened
the very thing it was added to fix. The first strength was also too polite —
a mean per-channel change of 5/255, which is not a shape, it is a rumour.

## The material language, and the pass that aimed it at the wrong material

*2026-09-08. Two rulings, in order, and the second corrects the first.*

**"adding shit on top of shit still makes it shit. There are fundamental
changes to the most basic level of art in our game that need to be fixed."**

Right, and not another prop. But the answer I reached for was wrong.

**"barkly ... still looks very clean and cartoon ... the background now give a
felt vibe which is not what barkly has going on and no[t] what I want for the
background."**

### The wrong diagnosis, and how it survived being measured

I cropped Barkly beside a prop and read him as a PLUSH TOY -- felt weave on the
fur, leather grain on the collar, pores in the nose -- against a world of
untextured plastic. Then I measured, and the measurement agreed: at native
resolution he carried twelve times the park hedge's fine detail. So a whole
pass went into giving every material mottle, roughness variation and tooth.

The number was real. The reading was not. **Barkly is clean and cartoon**: big
smooth forms, soft gradients, a little sheen, and at the pixel level a WHISPER
of grain, not a weave. Matching the world to a fabric that was never there put
the background in a different material language from the character -- the same
defect as before, pointing the other way. A measurement can confirm that two
things differ and tell you nothing about which one to move.

The strength it took to make texture visible is exactly the strength at which
it reads as felt. That is not a tuning window that was missed; there was no
window.

### What was actually missing: occlusion

**The prop pack had no ambient occlusion at all.** The scene pack has had it
since it was written; the pack that renders every single prop in the game did
not, and that one absent line sat unnoticed underneath the entire surface pass.

Every light in the prop rig is a large soft area light, so nothing in a prop
was ever darkened by its own neighbours. The five spheres of a hedge met with
no seam between them and read as one blurry green mass. A bench had no shadow
in its slat gaps. A shopfront had no depth in its awning recesses.

Look at Barkly and it is the most obvious thing about him: a **crisp dark seam
wherever two shapes meet** -- muzzle against cheek, brow over eye, ear against
head. That separation is what makes clean cartoon read as solid rather than as
flat shapes overlapping. It is not texture, it costs one line, and it is the
whole difference.

`gtao_distance` is 0.8 world units, and props are 1-4 units across, so it
reaches across the gap between neighbouring parts without dimming a whole face.

### Where the surfaces ended up

Kept, at a whisper: scales several times finer (16-34 cycles per world unit for
albedo, 120-220 for bump), mottle at 4-6% rather than 11-24%, bump at about a
tenth of the failed pass, and **roughness variation off entirely** -- patches of
differing roughness read as nap, which is the fibrous cue itself.

That leaves the grain very nearly unmeasurable, and the honest statement is
that the surface work was mostly a dead end. It stays because it is free after
quantisation and it helps large flat areas -- the scene ground especially,
which had been one mathematically flat plane -- not because it is doing real
work. The ground's own tooth was five times too strong for one pass, for the
same reason and with the same result.

### The gate that defended the wrong answer, deleted

`scripts/surface-check.py` refused a prop for carrying too LITTLE surface
texture. It was carefully built -- median rather than mean, so geometry edges
could not fake it, verified to fire in both directions -- and it encoded
precisely the hypothesis that turned out to be wrong. **A gate defending a
rejected direction is worse than no gate**, so it is gone rather than retuned.

`__tests__/render_shading.test.ts` holds the standard that replaced it: every
pack that renders enables occlusion, and no surface may exceed the strength
that reads as fabric. The ceilings sit above where the surfaces are now and
well below where the failed pass put them, so it fails on drift back toward
felt rather than on ordinary tuning. It asserts nothing about the PNGs, because
the lesson of the deleted gate is that measuring the art was never the problem.

### What survived the pass, and is worth keeping

- `scripts/promote-props.py` -- the manual copy from `art-review/` into
  `assets/` is now a script that refuses a render older than the builder that
  makes it. That gap cost two measurement passes in one day, both of which
  looked exactly like "nothing changed". It caught 45 untrimmed 640x640 props
  being shipped, and it owns the whole recipe: trim, size inventory art,
  quantise.
- Quantising to 256 colours **without dithering**, which took the world art to
  2.3MB -- smaller than the 3.6MB it was before any of this -- and the artifact
  from 21.4MB to 16.9MB.
- `PROP_ONLY` takes a comma list and errors when it matches nothing. It was a
  single prefix, and a list silently matched zero props, printed "rendered a
  subset" and exited 0.
- Two mechanics that are load-bearing whatever the surfaces are set to: object
  coordinates are world units in these packs (`transform_apply` bakes scale),
  and a noise Fac is fBm clustered around 0.5, so it must have its distribution
  spread before it drives anything or every authored amplitude is cut to a
  fifth on the way to the render.

---

## Appendix: the felt pass, as originally written (superseded above)

*2026-09-08. The operator, after several passes of adding props, composition
and depth: "adding shit on top of shit still makes it shit. There are
fundamental changes to the most basic level of art in our game that need to
be fixed."*

He was right, and the fix was not another prop.

### The diagnosis, as a number

Crop Barkly and any prop at the same scale and the difference is not style, it
is substance. He is a plush toy: felt weave on the fur, leather grain and
stitching on the collar, worn brass on the tag, pores in the nose. The world
is injection-moulded plastic: a flat white post, a flat coral roof, a flat
green hedge.

Measured at native resolution as mean absolute deviation from a 1px Gaussian
blur, over interior pixels only:

| | hp1 | hp2 | hp4 | hp8 |
|---|---|---|---|---|
| **Barkly** | 2.94 | 6.15 | 11.53 | 20.67 |
| park hedge | 0.25 | 0.98 | 2.66 | 6.29 |
| park tree | 0.20 | 0.82 | 2.34 | 5.84 |
| beach dune | 0.60 | 1.93 | 5.32 | 12.23 |

The hero carried **twelve times** the hedge's fine detail. Every prop in the
game takes its material from ONE function, `material()` in
`tools/blender/world_prop_pack.py`, and that function set a single flat base
colour and a single roughness. That is the most basic level of the art, and it
is one place.

### What it now does

Three fields, all driven by noise in object space, all preserving the authored
colour exactly:

- **MOTTLE** — the colour varies *around* the authored value by a MULTIPLIER,
  so the hue is mathematically untouched and the mean is preserved. The sRGB
  lesson this pipeline already carries is why that matters: a texture pass that
  shifts the palette is a palette change wearing a costume.
- **ROUGH** — roughness varies on the same field, which is most of what reads
  as material under a moving key light.
- **TOOTH** — a much finer field driving a bump. This is the one that does the
  work; it modulates the key light rather than the albedo, so it survives being
  lit and does not wash out in shadow.

Six surfaces (`matte`, `felt`, `wood`, `foliage`, `sand`, `stone`) plus
`smooth` for glass, water, cloud and contact shadows, which have no tooth by
design. `stretch` pulls the field along one axis, because wood is not
isotropic.

**Which surface a material gets is read off the name it already had.** There
are 146 `material()` calls and every one was already named for its substance —
"Bench honey wood", "Hedge green", "Paving slab", "Store glass". That naming
was a usable declaration, so a new material called "Fence post oak" gets wood
grain for free. An explicit `surface=` always wins over the guess.

### Three things that made the first attempt render nothing

Worth recording, because each one produced output that looked exactly like
success.

1. **The scales were finer than a pixel.** `cube()`/`sphere()` call
   `transform_apply(scale=True)`, so object texture coordinates are in world
   units — a scale of 190 means 190 cycles per unit, and a bench is 3.5 units
   across 440px. That is 0.7px per cycle. It averaged to flat grey. A texture
   finer than a pixel is not a subtle texture, it is no texture. The scales are
   now stated in cycles per world unit and checked against the render size.

2. **A noise Fac is not uniform.** `ShaderNodeTexNoise` outputs fBm, which
   clusters around 0.5 with a standard deviation near 0.1 — so a mix driven by
   it raw only travels about a fifth of the range you asked for. Every
   amplitude was being quietly cut to a fifth before it reached the render.
   A `MapRange` expanding 0.36–0.64 back to the full range is the node the
   whole pass turns on; without it the strongest setting moved a bench by five
   values out of 255.

3. **The measurement lied before the render did.** The first probe normalised
   every prop to 400px tall, which UPSCALED a 638×21 paving course nineteen
   times and reported its fine detail as exactly `0.00`. A measurement
   artefact, indistinguishable from a flat render, pointing at the wrong bug.
   Measure at native resolution: those are the pixels that ship.

### Calibrated against the hero, not upward

The first tuning that worked overshot: the hedge came back at 6.67 against
Barkly's 2.94, and a prop with more than twice the hero's detail does not read
as lush, it reads as noise. Amplitudes were cut so every prop lands in
1.6–3.2 with Barkly at the top of the range. **He stays the richest thing on
screen.** Means moved by at most 2.4/255, so the palette is intact.

The ground got the same treatment. It already varied in broad patches, but the
plane itself was mathematically flat, and it stayed flat while every prop
standing on it grew a surface — which is worse than both being smooth, because
it reads as models placed on a painted backdrop. Sand takes a finer, shallower
grain than a grass field.

### Two gates, because this was invisible

- `scripts/surface-check.py` (in `npm run check:ui`) measures every shipped
  prop and refuses one whose surface has gone flat. It checks that there IS a
  texture, never that it is good — good is a judgement and belongs to whoever
  is looking at the render.

  It measures the **median** deviation from a 1px blur, not the mean, and that
  is the whole design. The mean is dominated by GEOMETRY: a shopfront's window
  mullions are a handful of pixels with huge values, and they put the
  *untextured* store at 1.15 while the untextured hedge sat at 0.25 — so no
  mean threshold could separate "has a surface" from "has detailed geometry",
  and the first floor written here would have passed two of the props it
  existed to catch. Surface texture is the opposite shape: a small deviation
  at nearly every pixel. Measured across the props as they shipped before this
  pass, every untextured one scores exactly **0** and every textured one
  scores **1 or more**. The threshold is a genuine bimodal split, not a number
  tuned under today's worst prop.
- `scripts/promote-props.py` replaces the manual `cp` from `art-review/` into
  `assets/`, and refuses to promote a render older than the builder that makes
  it. That gap was not theoretical: a material change was measured against
  day-old assets twice in one session, and both times the answer looked like
  "nothing changed" — which is exactly what a real failure looks like.

`PROP_ONLY` also now takes a comma-separated list and **errors when it matches
nothing**. It was a single prefix; a list silently matched zero props, printed
"rendered a subset", and exited 0, which cost one of those measurement passes.

### Texture costs bytes, and one way of paying it back is a lie

The surface pass took the world art from 3.6MB to 5.6MB — real texture is real
entropy, and PNG cannot compress what is genuinely there. Quantising to a
256-colour palette gives about 70% of it back with no visible banding, checked
on the smoothest art in the game.

It must be done **without dithering**, and this is not a preference. Dithering
trades banding for pixel-scale noise, and pixel-scale noise is precisely the
signal the surface gate measures. Quantised *with* dithering, the OLD
untextured props measure exactly as textured as the new ones — median 1.0,
mean up to 1.59 against a genuinely textured tree's 1.61. The gate would have
gone on passing while the world went back to plastic. Quantised *without* it,
the flat props stay at exactly 0.0 and the split holds.

So the size win is taken in the one way that does not counterfeit the thing
being gated, and `promote-props.py` is the only place that knows the recipe —
trim, size inventory art, quantise — which is also what lets "has this been
promoted?" be answered by building the candidate and comparing bytes instead
of guessing what ImageMagick would have done.


## How to work on this art (2026-09-08, after a day of doing it wrong)

Six rules, each one paid for. The full account is
`docs/PROCESS_REVIEW_2026-09-08.md`; this is the short form, here because this
is the file somebody opens before touching the art.

**1. Look at the whole thing first.** Capture every scene, every screen, every
state, and look at them together before starting. In the session that produced
these rules the cold review was the twentieth commit, and everything that
landed came after it. It took half an hour. The nineteen commits before it cost
four times the code for a result the operator could not see.

**2. A measurement that two things DIFFER says nothing about which one to
move.** Barkly measured twelve times the fine detail of the park hedge. That
number was correct, and the conclusion drawn from it -- give the world more
texture -- was wrong; he was the one being misread. State which way the fix
goes before measuring, so the measurement can contradict you.

**3. Validate an instrument on a known answer before believing it.** Four
measurements in one session were artefacts: a normalisation that upscaled a
638x21 course nineteen times and reported 0.00 detail; a "sky" sample that was
mostly sea; a fur patch that drifted off the dog when the camera moved; two
passes read off stale renders. `scripts/visible-change.mjs` carries its own
calibration table for exactly this reason, and deliberately refuses to return a
verdict, because no single number separated the changes whose answers were
already known.

**4. Read the shipped path before claiming a gap.** The assets folder is not
the game. Two findings in the art review were false and both were a minute of
reading away: the NPCs are scaled at runtime by `build`/`stance`, and
`faceFrame()` already switched on state.

**5. Do not build a gate for an idea that has not survived the operator's
eye.** `surface-check.py` was careful, measured the median so geometry could
not fake it, fired correctly in both directions -- and encoded a hypothesis
that was wrong. It would have refused the correct art. It was deleted a day
after it was written.

**6. Do not send a before/after you cannot see yourself.** Run
`npm run check:visible before.png after.png`; it writes a crop of whatever
changed most, and the rule is that you look at that crop. If the difference is
not obvious there it is not obvious to anybody, and asking someone else to
adjudicate it spends their attention to tell you something you could have told
yourself.

**7. A failure that moves between runs is not in the diff.** The composition
harness failed one viewport per run, a different one each time, reporting the
entire interface off the frame and off the screen. Two runs were spent
suspecting the change that happened to be in flight. Nothing had moved: the
scenes bleed props past every edge on purpose and nothing clipped them, so the
scene box measured 476x876 inside a 390x844 frame -- and an oversized box is a
scrollable box even at `overflow: hidden`, which the browser scrolls to reveal
whatever just took focus. One click on Settings slid the app to (-82, -27),
the frame's overflow to the pixel. When a gate's verdict changes without the
code changing, find what SLID before reading the diff again -- and when you
find it, make the gate say the true thing next time rather than the symptom.


## The palette is the art direction (2026-09-09)

`tools/blender/palette.py` is the only place a colour comes from. Before it
existed the render packs named **255 distinct colours in 274 uses** -- almost
every colour in the game chosen once, by hand, at the moment somebody wrote
that prop and never seen beside the others. Saturation across the world ran
0.04 to 0.98 and value ran 0.18 to 1.00.

The reference is Barkly, because he is the thing that works: 95% of his
106,338 opaque pixels sit in a **15-degree hue band**, saturation median 0.42,
value from 0.14 to 0.92. One hue family, a wide value ramp, moderate chroma.

So the world is built the same way. A short list of FAMILIES, each one hue
plus two dials (`chroma`, `lift`); ONE ramp of five steps shared by all of
them; and one key and one ambient that every step is pushed toward, so a
surface in shadow takes the colour of the sky and a surface in light takes the
colour of the sun -- the same sky and the same sun, everywhere in the game.

Three things follow, and they are the rules:

1. **A new colour is a new FAMILY, argued for here, not a hex at a call site.**
   `__tests__/palette_source.test.ts` fails on a hex literal in a render pack.
2. **One light.** The packs used to carry three different suns and three
   different skies for art composited into the same frame. Scenes lit by
   different lights cannot look like one game whatever colour anything is
   painted, and that -- not texture, not composition -- was why the four
   places never matched.
3. **Legibility is measured, not assumed.** Putting the biscuit and the rope
   on `sand.lit` dropped them to 2.1:1 against the sheet panes;
   `item_renders.test.ts` caught it and both moved to `wood.base` at 3.2:1.

## Two things the palette could not fix (2026-09-09)

The palette pass made the four places share a colour and a light, and the
answer to "does it look like one game now?" was still no. Holding a Brawl
Stars screenshot next to ours, the note was:

> imagine you took a tree from the park or a gondola from the park or one of
> the storefronts, and you put it in one of those images, it would look
> significantly out of place. Right? Why?

Two answers, and neither of them is colour.

### 1. A dark contour on everything

Every form in the reference is separated from what is behind it by an ink
edge. Nothing in ours had one. That is most of why our props floated against
their backgrounds instead of sitting on them, and it is the single cheapest
thing on this list to fix, because it belongs at PROMOTION rather than in any
builder:

- `scripts/promote-props.py` grows the shipped PNG's alpha with a `MaxFilter`
  and floods `tone("ink", "deep")` underneath it. The width is **1.1% of the
  render, floor 3px** -- proportional, so a 2200px storefront and a 224px
  biscuit get an edge of the same visual weight rather than the same pixel
  count.
- Sky, shadow, haze, glow and surf are **exempt**. A hard edge on a soft field
  is a ring.
- The cast gets the same edge from the same helper, via
  `scripts/outline-cast.py` writing `assets/barkly/outlined/`.
  `assets/barkly/renders/` stays byte-identical, so the rig gate still
  reproduces `front.png` pixel-for-pixel and the character is untouched.
  Collars and the face are overlays: padded to match, never outlined, or they
  carry an edge through the body they sit on.

`npm run check:outlines` re-derives the outlined cast and fails on drift.

**The park needed a different answer.** It is the one location rendered as a
single composed PLATE, so it is opaque edge to edge and there is no alpha
silhouette to dilate -- which would have left the park as the only place in
the world without the line every other place has, which is exactly the "two
games" read this pass is about. Freestyle draws it from the geometry instead,
in the same ink, in `world_scene_pack.py:setup()`. Two things it needed:

- **The line thins with distance.** The scene runs eighty units deep, so one
  weight puts the same stroke on a bench four metres away and on a distant
  treeline; the first attempt rendered the horizon as a solid band of ink with
  green holes in it. A `DISTANCE_FROM_CAMERA` thickness modifier runs 2.4 down
  to 0.35 over 16..80 units.
- **Grass opts out.** A blade is thinner than the line, so an outline on a
  tuft fills it in solid -- every tuft along the path came out as a black
  clump. `no_ink()` links a form into a collection the lineset excludes.

### 2. Proportions that are honest instead of exaggerated

This is the bigger one and it is not a filter -- it is authoring.

Our forms measured correctly. A lamp post was a 0.10-radius cylinder three
units tall, which is what a lamp post is. A bench had three back slats and
three seat slats, evenly spaced. A tree trunk tapered gently into five
same-sized canopy balls, alternating light and dark. Every one of those is
wrong in the same direction: **the reference does not draw what a thing
measures, it draws what a thing reads as at thumbnail size.**

`tools/blender/proportion.py` is the one place that read lives, and both
packs import it -- `world_prop_pack.py` for town, beach and the items, and
`world_scene_pack.py` for the park, which is rendered as a single composed
plate and therefore has its own tree and its own bench. A park tree
proportioned differently from the modular tree is exactly the drift that makes
one game look like two.

| dial | value | what it says |
|---|---|---|
| `OVERHANG` | 2.2 | the mass on top is at least this much wider than its support |
| `TAPER` | 0.46 | a support narrows to under half its base radius |
| `FLARE` | 1.55 | and lands on a foot wider than the shaft, so it looks planted |
| `BITE` | 0.26 | parts sink into each other; a part that RESTS shows a seam |
| `STOUT` | 0.055 | nothing is a wire: the waist is at least this share of the height |

Measured before and after. `stout` is the narrowest slice through the middle
of the prop over its own height; `overhang` is how much wider the top of it is
than that slice. Both are read off the silhouette profile -- the union extent
of a horizontal slice -- not off individual parts, because the first version
of the metric reported a storefront's waist as 0.15, which was the doorknob.

| prop | stout | overhang |
|---|---|---|
| park/tree | 0.237 → **0.380** | 3.06 → 2.48 |
| park/bench | 1.273 → 1.436 | — |
| park/hedge | 2.713 → 1.796 | — |
| town/lamp | **0.054** → 0.133 | 4.99 → 2.78 |
| town/planter | 0.612 → 0.669 | — |
| town/fountain | 0.195 → **0.357** | 3.77 → 2.07 |
| town/store_aqua | 0.763 → 0.739 | — |
| beach/umbrella | **0.050** → 0.085 | 16.38 → 9.32 |
| beach/palm | 0.085 → **0.115** | 6.55 → 5.18 |
| beach/lifeguard | 0.557 → 0.567 | — |
| beach/castle | 0.279 → 0.361 | 2.54 → 2.01 |

The palm took three passes and is worth recording, because the first two were
the same mistake in different sizes. A leaning cylinder has a FLAT TOP, so a
trunk built as a stack of them shows a shelf everywhere the next segment
climbs on -- and alternating a light and a dark bark tone across those shelves
draws a ladder. Widening the segments made the ladder bigger. The fix was to
stop stacking: `metablob` fuses the segments into one bending surface (it is
the same helper that stopped the clouds reading as bunches of grapes), and the
rings that make it read as a palm are banded ON that surface, sized 0.07
PROUD of it -- sized to the blob radius they were swallowed whole, which is
worse than no rings, because a detail that is in the file and not in the
picture looks handled. The fronds were cubes rotated about Z, which turns a
frond in the GROUND plane: on a front-weighted camera that draws six spokes
lying flat, which is why the old palm read as a letter T. They rotate about Y
now, and each is two tapered cones so the outer half falls away from the
inner half.

**The overhang numbers going DOWN is the point.** They were high because the
support was a hairline, not because the top was generous: an umbrella whose
canopy is sixteen times its pole is not well proportioned, it is a cocktail
umbrella. The lamp post and the umbrella pole were both under the STOUT floor
outright -- 0.054 and 0.050 against 0.075 -- which is to say the two tallest
things in two of the four places were, measurably, wires.

`python3 scripts/proportion.py` reports every standing prop against the dials
and `--check` fails the build on drift. It reads a `form` block that each
builder records from its own geometry -- not from the shipped PNG, because the
contact shadow is real opaque geometry wider than most props that cast it, and
an alpha silhouette therefore says every object in the game is bottom-heavy.
Ground courses, horizon bands, clouds and inventory items are exempt and the
report prints the exemption list, so it stays a decision rather than a default.

### The bug this pass uncovered

Eleven standing props each had a hand-picked WIDTH and a hand-picked HEIGHT.
Nothing tied either to the render, so every one of them was being stretched by
whatever those two numbers happened to imply -- the lamp shipped at 0.285 and
was drawn at 0.356, a 25% horizontal squeeze, and the sandcastle was drawn 43%
too wide. Only the width is chosen now; the height comes from an `*_ASPECT`
lock that `npm run check:aspects` restates from the file on disk.

That gate also had a hole worth recording: it resolved a lock's asset by
BASENAME, and two files in this game are called `lamp.png` (town and home). It
found both, called the lock ambiguous, and skipped it -- so the one lock this
pass most needed to update was the one it left alone, on the run that existed
to catch exactly that. It resolves by require path now, and `DUNE_GRASS` and
the two mounds were renamed so that nothing is left unresolved at all.


### The room the player starts in was outside all of it

Found by sampling the leftmost opaque pixel of each shipped prop after the
contour pass. `rug.png` came back (13, 17, 35) -- the ink. `chair.png` came
back (169, 69, 77) -- its own upholstery. The chair, the lamp, the bed and the
shelf come from `home_prop_pack.py`, and whatever had been moving those four
into `assets/` was not `scripts/promote-props.py`, so they shipped with no
edge while the rug and the panelling standing beside them had one. A second
promotion path nobody remembered existed, in the one room every player opens
the game in.

There is one recipe now: `promote-props.py` reads BUILDERS from both packs,
`.github/workflows/barkly-world-prop-render.yml` renders both, and the home
builders log their geometry through the same `_record()`, so
`scripts/proportion.py` holds the furniture to the same dials. Which
immediately said what the sampling had implied: the floor lamp's stem measured
**0.058** of its own height -- the same wire the town lamp post was, in the
first thing the player ever sees. It is 0.116 now.

And the same aspect defect, worse: the chair's height was written `chairW *
(398 / 374)`, the lamp's `lampW * 2`, the bed's `bedW * (254 / 512)` -- ratios
typed into a layout, none of them what the render measured. The bed was being
drawn 40% taller than it is.


### ...and there was a second workflow doing it again

The home pass above put the furniture through `promote-props.py`. CI then ran
and produced two commits back to back:

```
181aa5a  Barkly art: render production Home asset pack
         chair.png  20381 -> 99247 bytes
64cd288  Barkly art: render modular 2.5D world pack
         chair.png  99247 -> 20381 bytes
```

`barkly-home-prop-render.yml` was a second copy of the shipping recipe living
in `.github/workflows/`: four hand-listed props, an inline `convert -trim`, and
`cp` straight into `assets/`. No quantise, no contour. Both workflows fire on a
`claude/barkly-*` push, so they took turns overwriting the same four files, and
which art shipped depended on which job finished last. That is the same defect
the repo already had a test for -- and the test read only the one workflow file
it knew the name of, which is why it could sit there for months.

It is deleted. Its two packs (`home_prop_pack.py` and `home_architecture.py`,
which now has a one-entry BUILDERS table so nothing about it is hand-listed)
render from the one workflow and promote through the one script; the window
frame picks up the quantise and the contour on the way. The guard now reads
the workflow DIRECTORY: any workflow that touches `art-review/` must promote
with the script and must not copy or resize art itself.


## The seven items, and a colour bug that survived four passes (2026-09-10)

The care tray is on every screen and the items are 48-64pt in it. After the
world got its contour and its proportions, four of the seven did not read:

| item | was | now |
|---|---|---|
| treat_cheese | a flat triangular sign, 0.34 deep on a 0.52 radius, three dots painted on the front | a solid wedge turned off axis, holes BORED into the face |
| treat_steak | a red oval with a **teal blob** on it | red mass, cream fat rim, lighter cut face, a bone |
| toy_rope | a smooth bar with dark beads along the top: a caterpillar | two strands wound around each other |
| kit_stick | 0.10 to 0.062 over one length: a smooth brown tube | a two-stage branch with bark rings and two twigs |

The steak is the one worth remembering. Its docstring recorded four failed
passes -- pale end caps read as a wrapped sweet, fat along the top read as a
bun, a bone out the side read as a drumstick, a centred sear read as a yolk --
and every one of them re-cut the GEOMETRY. The actual defect was one line:

```python
sear = material("Steak sear", tone("sea", "base"), roughness=0.60)
```

The **sea** family. A cyan patch in the middle of the meat, at 48px. Four
passes reshaped a steak around a mis-typed material, because the note above the
line described the shape it wanted and said nothing about the colour. Nothing
on a steak is cool. It is one step up the same `berry` ramp now -- the cut face
catching the key, which is what the shape note wanted all along.

The rope is the other lesson, and it is a proportion one. Four passes drew a
BAR and then tried to make the bar say "rope" by adding something to its ends:
a torus (a doughnut), beads on a rod (a caterpillar), cones fanned around the
ends (a morningstar), cones opening outward (a dumbbell). What says rope is the
TWIST, and a twist is not a detail you add to a cylinder -- it is what the
object is made of. There is no cylinder in it now: two helical strands of
overlapping beads in two tones, winding in opposite phase. The crossing pattern
is legible at 48px in a way nothing painted on a smooth rod ever was.


## The interface was drawn in a different language from the world

Everything in the world now carries an ink contour and molded proportions. The
interface carried neither: six sheets, six hand-written container styles, flat
white with a hairline shadow, over a rendered scene. Held side by side that is
the same complaint the props got -- a thing from one picture dropped into
another -- and it is the last big one.

`molded()` in `src/ui/theme.ts` is the shared surface, and `contour` is the
renders' own ink as an exact RGB (`#0D1123`, `tone("ink", "deep")`) rather than
a second opinion about "dark". All six sheets take their container from it and
none of them restates a corner radius or a border any more.

**It is one constant.** `SURFACE_EDGE = 0` and every sheet goes back to what it
was, with no other edit. That was verified rather than asserted: built both
ways and sampled the sheet's left edge on a 390x844 shot at deviceScaleFactor
2 -- `(13, 17, 35)` for four device pixels with the edge on, `(255, 250, 242)`
with it off. A test holds both halves, because an escape hatch nobody has
tested is not an escape hatch.

What was deliberately NOT given the edge: the scrapbook cards inside the Pack
Book (dashed borders and highlighter marks are their own motif, and it is a
good one), the store's item cards (they already carry a 2px border in their
category colour, which is doing the same job in a louder voice), and the panes
items are displayed against -- those are solved for contrast against the item
renders and an edge on them would be a ring around a piece of glass.


### The staleness check was asking the clock

`promote-props.py` refuses to ship a render made by a different version of the
builder that makes it. Until now it decided that by comparing modification
times, and that is wrong in both directions -- both of which were felt in one
session:

- `git rebase` rewrote `world_prop_pack.py` without changing a byte of it, and
  all 49 renders went stale. Fifteen minutes of re-rendering to produce
  identical files.
- And the other way, which is the dangerous one: `git stash pop` can restore an
  OLDER pack with a NEWER timestamp, and the check waves it straight through --
  shipping a world built by two versions of itself, which is the exact failure
  it exists to prevent.

Each pack now writes a sha256 of its own source into its render directory,
last, and only on a full pass (a `PROP_ONLY` run deliberately leaves the rest
of the pack behind, which is the half-rendered world the marker refuses).
Verified both ways: one added comment line marks all 49 stale, and `touch` on
all three packs marks none.

The refusal message changed with it. It used to hand back a `PROP_ONLY=` line
listing every stale prop, which cannot work -- a narrowed run does not stamp
the directory, so the next promote refuses again with the same wall of text. A
fix command that does not fix it is worse than no fix command.


## Ink INSIDE the silhouette (2026-09-10)

The operator, holding the before/after contact sheet:

> the two that stick out to me really well, especially the main one, is the
> fountain. The fountain and the lamppost are like, wow. That's what I'm going
> for. The rest of the images just don't hit the same way.

That is a precise note and it points at one thing. The lamp and the fountain
are **tiered** -- foot, shaft, collar, lantern, cap, finial; plinth, basin,
column, upper basin, finial -- and every tier meets the next at a hard
geometric break in a different material. That break reads as a dark line. The
tree, the hedge and the potted plant are smooth continuous masses: their lobes
melt into one blob, because the only ink they had was a dilation of their
own alpha, and **an alpha dilation can only ever see the outside of a thing.**

So the props draw their internal edges with Freestyle now, at render time --
the same mechanism the park plate already used, for the same reason. Silhouette
and border only; `select_crease` draws every bevel on every cube and turns a
prop into a pencil sketch, which was tried on the plate and reverted there too.

Two exclusions, both found by looking at the render:

- **Highlights.** The tree's `trunk_glint` is a bright patch laid on the bark
  to say the key hits it there. Inked, it became a crack running down the
  trunk. Anything named glint/gloss/sheen/highlight is kept out.
- **Anything thinner than the line.** A grass blade is a few pixels wide at
  render size; an edge on both sides of it fills it in solid, and
  `park/near_grass` came out as a row of black spikes. Blades, stems, buds and
  petals keep their ambient occlusion, which is the right amount of separation
  for something that small.

### One ink, and three places that draw it

Three steps put a dark edge on this art, for three good reasons, and they must
not each hold an opinion about what "dark" is:

| where | what it draws | why it has to be there |
|---|---|---|
| `scripts/promote-props.py` | the OUTER edge, off the shipped alpha | only that step knows the final pixel size |
| the prop packs | the INTERNAL edges, with Freestyle | only they know where one part stops |
| `world_scene_pack.py` | both | a plate is opaque; there is no alpha to dilate |

`tools/blender/ink.py` holds the colour, the width rule and the exemption list,
and all three import it. A test fails if any of them names an edge colour of
its own.

### And the paving course moved for the third time

`town/paving` went 638x21 -> 652x37 -> 654x43 as it gained first an outer
contour and then internal ink, and a course's height comes from that aspect,
so the deepest one keeps being pushed down into the band the NPC name plates
occupy: `dy` 56 -> 46 -> 42. The perspective spread is being squeezed a little
each time. If it has to move again the answer is to widen the band's own height
budget, not to flatten the courses further.
