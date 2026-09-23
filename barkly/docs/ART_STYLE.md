# The Barkly art style — six decisions, read off the canon

Operator, 2026-09-13:

> *"The issue is not the color palette... my bigger thing is, like, the whole
> art style itself. Right. Like, you know how Mario looks different from GTA?
> GTA looks good, but doesn't look like fully realistic, but it looks really,
> really good for its art style."*

He is right and this file exists because of it. Everything this project had
done to the look until now was **grading**: chroma, value, hue, sun elevation,
contour width, band count. Grading is what you do once you have a style. Mario
does not differ from GTA by palette — they differ in form language, surface,
edge, light model and level of abstraction, and Barkly had never committed to
any of those. It had defaults.

> ## THE FINDING THAT OUTRANKS THIS WHOLE FILE — 2026-09-13
>
> Everything below is correct and none of it was enough. After roughly fifteen
> style variants in one session the operator's verdict was *"none of those are
> fucking hitting... Fundamentally."* He was right, and the reason is not in
> this file. It is in `assets/barkly/README.md`, where it has been all along:
>
> > *"The original sheet came out of ChatGPT's image generation — the fastest
> > quality upgrade is more renders in the identical style."*
>
> **Barkly was made by an image model. The world is a Python script stacking
> Blender primitives.** Two production pipelines, and the one asset in this
> project anybody likes is the one asset that did not come out of the second
> one. That is not a style bug and no parameter closes it: a script makes five
> decisions about a shape, and a designed object carries thousands.
>
> So the six decisions below stop being parameters and become a BRIEF —
> `scripts/prop-briefs.py` — for the pipeline that can actually execute them.
> The per-prop character list is the part that matters and is unchanged.
>
> The app needs no changes for this. `assets/world/manifest.json` already
> states the contract: *"modular transparent props; app owns scene
> composition"* — a file, a displayWidth, an anchor. A transparent PNG is a
> transparent PNG whatever made it. `scripts/ingest-art.py` cuts out, trims
> and files generated art against that manifest, and refuses any name the app
> has never heard of.
>
> **What this needs from a human:** the image model. Open
> **`barkly/art/BRIEFS.md`** and work top to bottom in ChatGPT with the
> concept sheet attached. It is ordered by what is on screen: the three scene
> plates first (with park, town and beach plated, they ARE the world -- the app
> draws nothing else there but park's near grass), then Home's furniture, then
> the overlays, clouds and store items, and the fallback-only props last.
> Every one of the 54 pieces has a character list. `ingest-art.py` files the
> results, fits scenes to their anchors (horizon 32%, the dog's spot 72%), and
> REFUSES a scene whose sky did not key out.
>
> 2026-09-22: generating through an Apify image actor from here (~$0.04 an
> image, reference-image capable) was offered and declined by the operator.
> No paid generation runs without his say-so.
>
> The Blender pipeline stays for now and nothing is deleted — it is what the
> game currently ships, and it should be retired prop by prop as replacements
> land, never in one swing.

## Where these come from

Not from taste. From `assets/barkly/concept/barkly-concept.png` — the approved,
locked concept sheet, which is the one piece of art in this project that
works. Barkly is a **flocked vinyl designer toy**. Every rule below is measured
off him, and **every one of them was the opposite of what the world was built
with.** That is the whole reason he has never looked like he lives in his own
game, and no palette pass could have reached it.

| | the canon (Barkly) | what the world did |
|---|---|---|
| **FORM** | rounded rectangular masses | lathed/revolved organic blobs |
| **SURFACE** | matte flocked velvet, fine nap | smooth plastic with a clearcoat |
| **SHADING** | continuous — 49/64 value bins | banded to 3 steps — 12/64 bins |
| **EDGE** | none at all | a Freestyle contour on everything |
| **LIGHT** | broad studio softbox | a 1.1° sun, raking |
| **DETAIL** | a few applied parts | sculpted noise on every surface |

**FORM is the one nobody named, and it is the biggest.** Barkly's head is a
rounded box. His muzzle is a rounded slab, his legs rounded rectangular
columns, his body a rounded box. There is not one revolved surface on him.
`forms.py` built the world out of lathes — profiles spun around an axis — which
is the other family of shapes entirely. A revolved canopy next to a boxed dog
reads as two toys off two different shelves whatever colour either one is.

## The rule that outranks all six

Operator, on seeing the first toy tree beside the flat outlined one it was
meant to replace:

> *"I like the one on the left more than the one on the right. Not because I
> like the realism of either one. It's because the one on the left has
> character and personality. The one on the right doesn't."*

He did not like the left one's vibe either. He preferred it anyway, and he was
right to.

The sheet answers this more directly than anything else on it. Down its left
edge is a **bullet list of eight named oddities** — rectangular head; long nose
with a rounded square tip; stiff bent ears that angle outward; tiny
snaggletooth; striped knit-sock paws; thick collar; ring-shaped tail curl;
low-slung body. **That list is the personality.** Take those eight away and
what remains is a well-rendered dog shape nobody would put on a shelf.

The first toy tree had *zero* such decisions. It was three boxes — correctly
flocked, correctly lit, measuring within a few percent of the canon on every
axis below — and dead, because every one of those axes describes a MATERIAL
and none of them is character.

**So no prop gets built without its own list first.** Three to five specific,
slightly odd, exaggerated decisions, written down before any geometry. The
park tree's list, as built:

- Fat flared foot, like it is gripping the ground
- Leans, and the canopy leans back to catch itself
- Canopy overhangs the trunk on one side like a hat brim
- Three lobes at three heights — a scalloped top, never a dome
- One snapped-off branch stub, high on the lean side

Two corollaries, both learned by getting them wrong first:

**Character lives inside a readable silhouette, not instead of one.** The first
pass at that list let the overhang run until the tree measured 1.04 wide over
tall. The flat tree is 0.83 and Barkly is 0.79 — both taller than wide, both
widest about a quarter of the way down. A square canopy reads as a smear
however much intent is authored into it.

**One colour per organ. The masses make the outline; the light makes the
shading.** Painting the three canopy lobes three greens — to satisfy the
charcoal/cream rule below — made them read as a pile of pillows. Those three
swatches belong to the OBJECT (charcoal trunk, green canopy), not to each mass
of one organ. Painted the same, the lobes fuse into a single bold shape with a
scalloped edge, which is exactly what the flat tree does and why its
silhouette lands instantly.

## The two rules a renderer cannot give you

These took longest to find because neither looks like a rule about style.

**Every object carries a CHARCOAL note.** 18% of Barkly sits below value 0.25
and almost none of it is shadow — it is his nose, his collar and his eyes,
which are charcoal *parts*. Three separate attempts to get the world's darks
out of lighting failed the same way (0.0%, 10.1%, 0.0% dark across three cuts
of the same prop): a soft light cannot make a deep shadow, by definition. A
prop gets its dark end the way the character does — something on it is
actually charcoal.

**Every object carries a CREAM note.** The same rule at the other end. 26% of
Barkly is above value 0.80 and that is not a highlight either — it is his
chest, muzzle and paws. The sheet's palette panel names exactly three swatches
and the character wears all three at once. Two tones of one hue is what every
prop in this repo was, and it is why they photographed flat next to him no
matter how they were lit.

## What "done" measures as

Against Barkly's own render, for any prop:

| | Barkly | the first cut | the tree as built |
|---|---|---|---|
| flocking (high-freq amplitude) | 2.85 | 1.00 | 2.59 |
| value spread | 0.264 | 0.082 | 0.228 |
| below value 0.25 | 18.0% | 0.0% | 15.0% |
| above value 0.80 | 25.7% | 0.0% | 24.2% |

Saturation is deliberately NOT on that list as a match target: the field is
quieter than the character on purpose (`scripts/art-hierarchy.py`). Everything
else about a prop should measure like the dog, because it is supposed to have
come out of the same factory.

## How to build in it

`tools/blender/toybox.py` — `rounded()` for mass, `flock()` for surface,
`studio()` for light. `tools/blender/style_probe_toybox.py` renders the worked
example.

The standing process rule from `ART_NEGATIVE_SPACE.md` still holds and was
followed here: **one prop, finished, judged — before any of it is rolled out.**
The tree was chosen because eleven of them are in the park plate, so a style
that does not hold on a tree does not hold.

## The sculpted construction (2026-09-23) — the world is procedural

Operator: *"This all needs to be procedurally generated."* Every procedural
pass before this one SNAPPED primitives together — lathes, spheres, bevelled
cubes — and however it was lit, a pile of primitives reads as a pile of parts.
A vinyl toy is sculpted: one mass whose forms melt into each other.

- `tools/sculpt/sdf.py` — signed-distance primitives (ellipsoid, capsule,
  rounded box/cylinder, cone, torus), smooth union / subtract, a low-frequency
  domain warp for the hand in the clay, marching cubes, coloured binary PLY.
- `tools/sculpt/kit.py` — every park object as a seeded field: six trees,
  three bushes, two hedges, the bench, the bandstand (its scalloped eave is a
  blend, which primitives cannot make), four flower beds, three tufts. Painted
  by which way each part faces, the way a factory airbrushes a toy, with warm
  undersides. `python3 tools/sculpt/kit.py` sculpts it (~100 s, gitignored).
- `tools/blender/world_scene_pack.py` — `SCENE_STYLE` says which scenes are
  sculpted. A sculpted scene keeps the same composition, asks the kit what each
  object IS, renders it in the canon's flocked material, and drops the cel
  bands and the ink. It sculpts the kit itself when the kit's source hash is
  stale, and fails loud without numpy + scikit-image rather than quietly
  rendering the old style. **Going back is one word** in that table, or
  `SCENE_STYLE=primitive` for a single run.

Rules learned building the park, each one measured:

- **Paint the object's colour, let the light make the highlight.** Painting
  the palette's `lit` step on a lit sculpt counted the highlight twice: mint
  canopy, sat 0.20 / val 0.80.
- **Tune in the scene, not the studio.** The warm sun adds ~0.2 saturation the
  studio preview never shows; with a studio-tuned boost the plate's foliage
  measured sat 0.65 (lime). The kit ships in the scene. `SUN_EXPOSURE` is one
  exposure for the whole kit, not a per-object fudge.
- **The ground is the shelf.** A quieter lawn (`_quiet`, 0.68 of the palette's
  chroma, soft grain) is what lets the character be the loud object.

The park, primitive vs sculpted, on `art-hierarchy.py` (quantised as shipped):

| | peak band (≤45%) | chroma gap (≥+0.18) | darks (≥1%) | warm shadow (≥40%) |
|---|---|---|---|---|
| primitive (shipped) | 61.9% | +0.138 | 4.6% | 73.1% |
| sculpted | 45.0% | +0.136 | 6.4% | 27.9% |

The warm-shadow drop is honest and explained: the primitive plate's warm darks
were its INK LINES (hue 34, the ink colour), not its shadows. Without ink, the
darkest 15% is lawn in cast shadow, green at hue ~85. Passing that floor means
a warm-shadow treatment of the lawn, which is the next decision, not a number
to chase by putting the line back.

## What is blocked, with numbers

`scripts/art-hierarchy.py` measures whether Barkly still reads against his
world. On the plates CI renders today (2026-09-22) it fails: park 61.9% of the
frame in one saturation band, town 59.3%, beach 51.7% against a 45% floor;
his chroma gap against the ground +0.14 and +0.12 on park and town against
+0.18. The floors stay where the concept sheet puts them. The plates miss them
because the Blender pipeline cannot make a quiet field under a loud object,
and the fix is the image-model pipeline above. Until those plates land the
script reports and is deliberately not a CI gate — `npm run art:hierarchy`.

## What is NOT decided yet

- Town, beach and Home are still primitive. The park is the first sculpted
  scene; the rest convert the same way, one at a time, each judged on its own.
- The lawn's shadows (see the warm-shadow row above).
- The UI. It is still drawn in its own language.
