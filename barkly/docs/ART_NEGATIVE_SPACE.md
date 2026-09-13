# What Barkly is NOT — the spec by elimination

> *"I don't know what I want my fucking game to look like. I just know what
> I want it to don't look like."*

That is a workable position and it is the normal one. Most directors cannot
describe a target; they can only react to one. Knowing what you do not want
IS a specification, provided somebody writes it down instead of making you
say it a thirteenth time.

This file is that. Every line below is a verdict the operator actually gave,
in his words, with what it was aimed at and what it rules out. Nothing here
is inferred taste. When a future session wants to know whether a direction is
allowed, this is the referee — not anybody's judgment, which has been wrong
repeatedly.

---

## THE MISTAKE THAT MADE THIS NECESSARY

Twelve rejections in a row, and every option shown was bad *in the same way*:
all of it came out of one pipeline at one level of execution. So a "no"
never separated **direction** from **execution**. He was never once shown a
direction rendered well enough to judge on its merits, which means most of
those noes carry less information than they look like they do.

**Rule:** when offering a choice, the options must differ by more than the
thing being chosen can be confounded with. A style comparison where every
tile is equally unfinished is a test of the finish, not the style.

---

## RULED OUT, with the words that ruled it

| Verdict | Aimed at | What it rules out |
|---|---|---|
| "it's to big Nate" | a heavy black contour on everything | A thick, near-black outline. The line, if any, is fine and low-contrast. Measured: the version he rejected ran 4.5:1 against what it bordered. |
| "goofy and clunky... the forms are bare primitives" | scaled spheres and cones | Undesigned shapes. Silhouettes are authored or they are not shipped. |
| "the shading sucks" | flat ground, smeared shadows | A ground with no variation in it; cast shadows with no shape. |
| "watercolour all the way sucks" | volumetric haze | Atmospheric fog as a look. Measured 0.0% darks — no contrast at all. |
| "what is that fucking gazebo" | flat cel with no cast light | Switching the sun's shadows off. Flat fills with nothing modelling the form. |
| "why the fuck is that just getting raped by the sun" | an 8–12° raking key | Extreme low sun. Blows one side, crushes the rest. |
| "that hurts my eyes" (twice) | chroma, then edge density | A third of the frame above 0.60 saturation in one hue. A fifth of the frame within 6px of a near-black line. Both measured, both real, both separate. |
| "it still looks weird" | a 15.5° off-axis camera | A world drawn on a different axis from the character. Barkly is `front.png`; the world was turned 15.5°. |
| "still just looks super weak" | the whole thing | Standing pat. |

## ALLOWED, with the words that allowed it

| Verdict | What it permits |
|---|---|
| "I like the lines of 2 with the vibe of number 1" | A drawn line IS wanted — fine, not heavy. Over soft gradient shading and the lighter palette, not over banded fills and boosted chroma. |
| "I like 3 but it just looks so unrefined" | Banded fills over a lighter ramp were not rejected. The forms under them were. |
| "yes, sure, used to fix that" | The on-axis camera stays. |

## DERIVED — what is left standing

Not taste. What survives the eliminations above:

- **One axis.** World and character share a projection. Settled.
- **A line, but a quiet one.** Present, thin, low contrast against what it
  borders. Matched to the weight Barkly's own cast carries — measured at
  4.1px on a 390pt phone against his 4.2.
- **Mid value range.** Not muddy (>48% of frame under value 0.25 is out) and
  not blown (>2% clipped is out).
- **Restrained chroma.** No large area loud in a single hue.
- **Real cast shadows, moderate sun.** Between roughly 24° and 50°.
- **No atmosphere effects.** No fog, no haze, no bloom.
- **Authored silhouettes.** Every form's outline is drawn, not a side effect
  of scaling a primitive.

## SETTLED, 2026-09-13 — and it was written down all along

Two of the three below are now decided, and not by another style round. The
answer was on `assets/barkly/concept/barkly-concept.png`, the approved and
locked concept sheet, in words, at the bottom of the image:

> COLLECTIBLE TOY CHARACTER / BOLD SILHOUETTE, EASY TO RECOGNIZE /
> SATISFYING TO HOLD, SOLID + STURDY FEEL / MADE TO STAND OUT ON ANY SHELF

...over a palette of exactly three swatches: Mustard Tan, Cream, Charcoal.
Nobody in this arc had opened the file. Measured off it: mean saturation
0.165 with 73.7% of the image under 0.10, background value 0.98, shadows 98.4%
warm. Barkly himself measures 0.510 with 34% of him above 0.70.

**Barkly is a vinyl toy photographed on a neutral ground. The colour IS the
object; the environment is pale, warm and quiet.** We had built the opposite --
a world at 0.455 mean saturation, as loud as the character standing in it, so
he never separated from it. That single fact explains every rejection in the
list above, including the two that read as contradictory.

- ~~How saturated the world is in absolute terms~~ — **settled.** Not by an
  absolute number: by a HIERARCHY. The field is quiet, the character is loud,
  and the gap between them is the measurement
  (`scripts/art-hierarchy.py`, targets in `docs/ART_DIRECTION.md`).
- ~~Whether the world is 3D-rendered at all~~ — **settled, YES.** Two flat 2D
  samples were built and pitched; the operator's verdict was *"I think this is
  the wrong direction."* 3D stays.
- Banded fills or smooth gradient — **still open, and now narrower.** The
  shipping answer is banded forms on a continuous ground, and that is not a
  taste call: banding the ground removed every cast shadow in the park. Any
  future round has to keep the ground continuous or find another way to get
  its shadows back.

## THE ELIMINATIONS ABOVE STILL STAND

Nothing in the settled section overrules a rejection. The sheet says what the
world should be; the list above says what it must not be, and both had to be
true at once. What the sheet added was the reason they could all be true at
once -- they were all the same problem.

## THE STANDING PROCESS RULE

Before any further style round: pick ONE prop, finish it to shippable
quality, and judge that. A hundred props averaged toward a style is how this
repo spent a day discovering that global parameters cannot rescue individual
shapes. If a single bench cannot be made to look right, a hundred of them
will not average into a look.
