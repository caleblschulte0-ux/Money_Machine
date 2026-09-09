# Barkly — art review, 2026-09-08

Written cold, from captures, without reference to what any recent session has
been working on. Where a claim can be measured it is measured, and where it is
taste it says so.

## What was looked at

Sixteen scene captures — home, park, town, beach at 08:00, 14:00, 19:00 and
23:00, all at 390x844 — plus the store, the food sheet, the toy sheet, the
Pack Book, the Plan sheet and Settings, plus every shipped item render and
every NPC render at 1:1.

## What is working

Worth stating plainly, because the rest of this is problems.

- **The hero model is genuinely good.** Silhouette reads instantly at any size,
  the proportions are appealing, the collar and tag give him a specific
  identity rather than a generic one. He survives being shrunk to 3% of the
  frame and still reads as *that* dog.
- **The item renders are mostly excellent.** The ball, the collars, the bowl
  and the rope have clean silhouettes, believable material and a consistent
  light. They would not look out of place in a shipped commercial game.
- **The 19:00 grade is the best-looking state in the product.** Warm pinks in
  the sky, long light, saturated ground. Whatever it is doing, the other three
  times of day should learn from it.
- **The sheets are competently designed as interface.** Clear hierarchy,
  readable, well-organised, decent copy. The problem with them is not craft.

## Findings, worst first

### 1. The character is not lit by the world he is standing in

This is the biggest single defect in the art and it is measurable. Sampling the
same patch of tan fur across the day:

| scene | 08:00 | 14:00 | 19:00 | 23:00 | he varies | the world varies |
|---|---|---|---|---|---|---|
| home | 151.1 | 150.7 | 150.7 | 130.9 | 20.2 | 78.5 |
| park | 129.8 | 129.8 | 129.8 | 121.7 | 8.1 | 40.3 |
| town | 138.9 | 145.0 | 145.0 | 124.5 | 20.5 | 68.1 |
| beach | 163.4 | 141.6 | 141.3 | 119.0 | 44.4 | 100.7 |

From morning through evening he is **the same pixels** — in the park, 129.8 at
all three, with saturation flat at 0.47. The world moves 40 to 100 units of
luma around him and he does not move. At 23:00 he takes a blanket dim along
with everything else, which is a master grade, not lighting: at home it drops
his saturation from 0.47 to 0.21 while the scene only falls to 0.32, so night
greys him out harder than it greys the room.

The consequence is the thing that makes the whole picture read as a sticker on
a backdrop. He is not in the scene; he is in front of it. No amount of
background work fixes this, and it is why background work has kept
under-delivering.

### 2. The supporting cast are palette swaps of the hero

> **Corrected 2026-09-08, after reading the code instead of the assets folder.**
> The paragraph below originally also claimed they are drawn at one size and
> wear Barkly's collar exactly. Both were wrong: `build` and `stance` per NPC
> have been in `world/npcs.ts` for some time (Biscuit 0.94 and stocky, Duke
> 1.14 and taller), and zoomed in, the buckle metal and muzzle markings differ
> per dog. I judged from the render folder rather than from the shipped
> composite. The claim that survives is below, and it is now measured.

Biscuit, Duke and Pepper are one model recoloured. `npc-distinct.py` now
reports the like-for-like number: comparing the SAME pose between dogs,
**Biscuit and Duke differ by 0.0%** — pixel-identical silhouettes — in both the
front and three-quarter renders, and Pepper's front differs by 4.7%. Duke is
written as a rival and Biscuit as a friend and they are physically the same
dog.

They also share one expression each, which is the part no runtime scale can
disguise.

For a product whose entire premise is a specific dog with a specific
personality, a cast where everyone is the protagonist recoloured is a
structural problem, not a polish one. It also wastes the strongest asset in the
game: the rig is good enough to carry real variation.

### 3. There are two visual languages, and they do not meet

The world is 3D, warm, chunky, soft-shadowed, material. The sheets — Pack Book,
Plan, Store, Settings — are flat 2D cards with 1px borders, small dense body
text, highlighter accents and a different accent colour each (purple, coral,
yellow, near-black). They are good interface and they belong to a different
product.

They also **cover the dog completely**. Open the food sheet or the Plan and the
character is gone; you are reading a well-formatted document. In a game about
a relationship with an animal, the animal leaves the screen for most
interactions.

> **Half of this is built, 2026-09-09.** The covering half. Sheets no longer
> state their own height -- `src/ui/sheetStage.tsx` owns one contract and all
> seven of them ask it: a sheet may take the screen MINUS a window the world
> keeps (a third, floored at 216pt so a small phone still gets a dog-sized
> band), and never less than 62% of that, because the room now pans UP behind
> an open sheet and the panel is what covers the risen ground. The flat 50%
> scrim is a gradient that is clear over the window. The chrome -- coin row,
> destination tray, care dock -- fades out while a sheet is up, because none
> of it is usable behind a modal and it was drawing the place names across his
> ears.
>
> Measured by `scripts/sheet-window.mjs` on three phone sizes, four sheets
> each: **78-100% of him stays clear of the panel**, on every one. It was 0%.
> The park with the food sheet open is now a better composition than the park
> without it -- him centred, Biscuit and Duke flanking, the whole diorama
> above the tray.
>
> The other half -- the two visual languages, the flat cards against the
> rendered world, four different accent systems -- is NOT built. That is a
> redesign of the sheets themselves and it is still open.

### 4. One face, everywhere

> **Corrected 2026-09-08.** This originally said he wears one expression
> everywhere, full stop. That was wrong and checkable in a minute:
> `faceFrame()` already switches on state — wide when listening, a smile when
> happy, a squint when annoyed, heavy lids when hungry. What follows is the
> claim that survives reading the code, and it is narrower and more useful.

Every one of those branches is an EVENT. Between events he fell through to one
fixed render, and between events is where a player spends nearly all of their
time — which is why sixteen scene captures and every screen in the product all
showed the same face. The most-seen frame in the app was the one thing that
never moved.

*(Fixed the same day: the resting face now reads his drives. See
`__tests__/resting_face.test.ts`.)*

### 5. The HUD is heavy, bright and never changes

The coin bar plus the four tab pills occupy roughly the top fifth of the
screen, in near-white, at full opacity, over every scene at every hour —
including 23:00, where four white pills sit on a dark blue room. The care tray
adds another heavy bar at the bottom. Between them the art gets the middle
band, which is also where the dog is.

Nothing about the chrome responds to the world behind it.

### 6. Narrow value range: no darks, no brights, so no focus

Fifth-to-ninety-fifth percentile luma inside the scene band:

| | 14:00 | 23:00 |
|---|---|---|
| home | 46–211 (165) | 33–160 (127) |
| park | 55–205 (150) | 53–168 (115) |
| town | 55–197 (141) | 36–152 (116) |
| beach | 79–205 (125) | 37–144 (107) |

Everything lives in the middle. The beach by day spans 125 of 255 — no true
dark anywhere in the frame, no true highlight. Pictures get their focus from
value contrast, and there is very little to spend.

Mean saturation is 0.42–0.46 by day and 0.30–0.35 at night, uniformly, which is
the same story in colour: nothing is allowed to be vivid, so nothing draws the
eye.

### 7. The four places are framed identically

Measured previously and still true: the character occupies a similar share of
the frame, dead centre, with his feet on the same line, in all four locations.
Recent work has begun to spread this (5.5 / 4.2 / 2.8 / 3.0 percent) but he is
still at x = 0.50 in every scene, and the mass of scenery is close to
symmetrical about him.

### 8. Item art is uneven

The ball, collars, bowl and rope are excellent. The cheese is a flat triangle
with three dots and reads as a 2D icon among 3D objects. The steak is
ambiguous — a red mass inside a pale ring. The stick is thin, dark and
disappears against the tray. Three weak items in a set of eleven is enough to
pull the whole tray down, because they sit side by side.

### 9. Night is a dim, not a light

Night desaturates and darkens uniformly rather than relighting. There are no
warm pools from windows or lamps doing real work, the sky and the ground fall
by the same amount, and the character falls with them. The measured
distinctness *between* places at 23:00 is not actually worse than by day — the
problem is not that night flattens the four locations, it is that night is
subtraction rather than a different lighting situation.

## What to build, in order

1. **Light the character from the scene.** A per-scene, per-hour tint and
   brightness applied to the hero and the NPCs, driven by the same band the
   sky uses. This is the highest-value change in the document and it is app
   code, not new art.
2. **Give the cast real bodies.** Different silhouettes, ears, sizes and
   expressions — and take Barkly's collar off them. The rig supports it.
3. **Resting expression variation.** Let mood, time and recent events pick
   among the faces that already exist before authoring new ones.
4. **Bring the sheets into the world.** ~~Keep the dog on screen behind
   them~~ (done 2026-09-09 -- 78-100% of him stays clear, measured), use the
   rendered material language for their surfaces, and settle on one accent
   system.
5. **Widen the value range.** Deeper darks in shadow and true highlights where
   the key hits, per scene, so there is somewhere for the eye to go.
6. **Rebuild the three weak items** to the standard of the ball.
7. **Make night a lighting situation** — warm interior pools, cool exteriors,
   lit windows — rather than a global multiply.
8. ~~**Break the horizontal symmetry** of the scenes~~ — done 2026-09-09.
   `SCENE_CAMERA` gained a `shift` and each place composes around it: he
   measures 0.56 / 0.40 / 0.60 / 0.61 across home, park, town and beach,
   where he was 0.50 in all four. The dogs and the dig mound move to the
   side he leaves (`NPC_SPOTS` is keyed on the place now, and
   `npc_spots.test.ts` holds that rule in both directions). The beach was
   composed the other way first, with him on the left; `blocking.mjs`
   refused it, because the SIFT label landed on the sandcastle.

## Two claims in this document were wrong

Recorded here rather than quietly edited, because a review that reads as
authoritative and is wrong in places is worse than one that shows its
corrections. Both errors came from the same habit: **judging the assets folder
instead of the shipped composite**, and stating the result with more confidence
than the checking deserved. Both were a minute of reading away.

The direction of the review held up — lighting and cast were the right two
places to spend. The facts underneath two of its nine findings did not.

## What this review deliberately does not say

It does not rank surface texture, prop count or foreground layering, which is
where recent effort has gone. Those were real gaps and they are largely closed;
they are not what is holding the picture back now. The gap now is **lighting
and cast**, and both are cheaper than the work already done.
