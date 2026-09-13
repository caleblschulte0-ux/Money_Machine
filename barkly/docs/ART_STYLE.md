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

## What is NOT decided yet

- Whether the whole world converts. One prop is proof the style exists and
  reproduces; it is not proof it survives a hundred props or a full scene.
- The ground plane, the sky and the far treeline have no answer here at all.
  A flocked toy sits ON something, and what that something is in this style is
  an open question.
- The UI. It is still drawn in its own language.
