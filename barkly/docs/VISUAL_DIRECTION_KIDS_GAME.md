# Barkly visual direction — polished bright kids game, not HTML AI slop

## The problem

Barkly can be technically clean and still look cheap if the composition is made of cream cards, rounded rectangles, generic pills, flat SVG geometry and evenly spaced interface rows. That is the visual fingerprint of a generated React app. The target is not “clean SaaS with a mascot.” The target is a premium kids game built around a collectible toy dog.

## North star

**The dog and his world are the interface. Chrome should feel like molded toy parts, stickers, scraps, shelves and physical objects from the same universe.**

A screenshot should read as a game before anyone sees Barkly speak.

## Cosmetic rules

1. **Bright does not mean random rainbow.** Use a small candy family deliberately: sky blue for primary action, yellow for rewards/notes, violet for Pack/relationship things, mint for positive/owned states, coral for food/drama. Barkly's tan/brown coat remains the visual anchor.
2. **No large dead white cards unless the object is literally paper.** A speech surface should be a toy console. A shop should be a shelf. A plan can be paper. A memory can be a scrapbook card.
3. **Every important tap target has physical depth.** Highlight + body + darker lower edge + contact shadow. Flat fill + radius is not enough.
4. **Avoid generic equal-width segmented controls.** Location navigation should feel like four destination tokens/signs, not browser tabs.
5. **World labels are not app labels.** NPC names, dig prompts and object hints should feel painted/stamped into the scene.
6. **Use asymmetry and authored composition.** Perfectly centered stacks of rectangles look generated. Tilt notes, offset props, overlap foreground objects, let visual weight differ.
7. **Scene art must converge on Barkly's material language.** The long-term target is molded/clay/vinyl diorama art, not increasingly elaborate flat vector backgrounds.
8. **No emoji as production art.** Draw icons/props in the Barkly universe.
9. **Animation is cosmetic too.** Buttons depress. Panels settle. Stickers pop. Rewards bounce. Objects squash slightly. NPCs breathe. The screen should never feel like static HTML.
10. **Children should know what is fun to touch without reading.** Shape, color, motion and Barkly's attention should do the teaching.

## Main-screen target

The main room should have:
- a much less UI-like location selector; each destination has its own color/material and illustrated cue;
- a coin/level pod that looks like a toy HUD, not a white pill;
- a Pack Book control that looks like a small physical book;
- a Plan control that looks like a taped note;
- dialogue as a molded character console with speaker-specific color;
- talk as the loudest candy control on screen;
- typing secondary but still playful;
- no generic white control dock behind Barkly's in-world bowl/toy/bed.

`src/ui/ToyHud.tsx` supplied the first four bullets and is now WIRED (2026-09-03). It sat imported by nothing for five days while this line asked for it, which is its own lesson: a drop-in prototype nobody drops in is a second implementation of the tab bar that a reader cannot tell apart from the live one. It is split into `ToyChromeRow` and `DestinationTray` because BarklyRoom does not stack them -- portrait puts the chrome above the destinations, landscape puts the chrome across the top and the destinations in the nav rail -- and the old segmented tabs, their 23 styles and the old lock glyph are deleted.

### ToyHud acceptance

- HOME = coral physical destination tile with a house glyph.
- PARK = mint tile with a tree glyph.
- TOWN = violet tile with a storefront glyph.
- BEACH = sky-blue tile with a wave/sun glyph.
- Locked places keep their identity and add a small physical lock badge rather than turning into grey text.
- Pack control visibly looks like a tiny violet book with a spine/pages.
- Plan visibly looks like a taped yellow note, turning mint when complete.
- Settings is a toy control, not a white circle.
- Coin/level pod is bright yellow and molded.
- No destination label truncates on the standard five viewport tests.
- Main-stage vertical budget must not shrink enough to crop Barkly or his foreground objects.

## Scene target

### Home
Warm toy-diorama living room. Chunky furniture. Strong window light. Personal clutter and story souvenirs. Favorite treasure must physically appear.

### Park
Saturated blue/green, chunky toy trees/fence, moving leaves, social chaos. Biscuit/Duke should dominate composition when present.

### Town
Colorful storefront blocks, bakery warmth, signs/awnings, pigeons/pedestrian silhouettes. More vertical city rhythm than Park.

### Beach
Turquoise sea, warm sand, big foam shapes, shells/gulls/seaweed. It should be the visually loudest location.

## UI surfaces already changed in ChatGPT sprint

- global palette moved away from cream-on-cream into peach/yellow/sky-blue candy surfaces;
- primary action moved to bright sky blue;
- elevation ramp made more molded/physical;
- DialoguePanel rebuilt as a colored toy-console surface;
- Shop rebuilt as a colorful toy shelf with category colors and molded item trays;
- Food picker rebuilt as a snack tray with large colorful physical choices;
- Barkly's Plan rebuilt as a colorful kid-made object instead of a white productivity note;
- Encounters rebuilt as bright physical choice moments over the still-visible world;
- Contests rebuilt as a colorful arcade-style dog duel HUD while preserving the tested timing mechanic;
- Pack Book already moved from analytics toward scrapbook language and should continue getting more portraits/object visuals;
- `ToyHud.tsx` supplies the main-screen structural replacement so cosmetics are not limited to sheets.

## Next cosmetic implementation order

1. ~~Wire/rework `ToyHud.tsx` into BarklyRoom and pass the five viewport/layout contracts.~~
   DONE 2026-09-03. Two things had to give: `PLACES_HEIGHT` grew from 48 to 58
   (the horizon in every scene is placed against `CHROME_BOTTOM`, so this is a
   world-layout constant, not decoration), and the first cut at 72 was caught
   by `hero_layout` -- an 844px phone's stage fell to 588 against that test's
   600 floor, which is the automated form of this file's own "must not shrink
   enough to crop Barkly". The tile shrank instead of the test. `BEACH` also
   truncated to `BEA...` until the tray was given `flex: 1`; 13 viewports and
   the a11y sweep pass on a freshly built artifact.
2. Pack Book — add actual portrait/treasure/rival visual modules and stronger color blocks.
3. Typing field — stop looking like a web input; make it a toy-console speech slot.
4. ~~Store items — eventually show mini Barkly previews wearing/using the
   selected object, not just an icon row.~~
   DONE 2026-09-03, for collars. `src/ui/CollarPreview.tsx` windows the
   approved front render with the same aligned `renders/collars/front_*.png`
   overlay the live renderer composites onto him, so each card is HIM in that
   collar. The shop header's ~230px of dead lavender became the same preview
   in whatever he is wearing right now (`framing="face"`, a higher window that
   includes his eyes — a header cropped like a card is just a fifth swatch).
   Front pose only: the overlays are derived against the front frame's collar
   pixels, so a three-quarter preview needs its own derivation first.
   PARTIAL, honestly: toys, food and treats still draw `ItemIcon`. A bag of
   biscuits is not more legible for having a dog behind it, so those are
   waiting on the item art itself rather than on this component.
5. Food — animate bowl/food preview before choosing.
6. Unique NPC silhouettes/assets.
7. Replace major code-drawn scene furniture with authored diorama assets.
8. Add SFX and micro-motion to every high-frequency surface.

## Rejection test

Reject a cosmetic implementation if any of these are true:
- it looks like a Tailwind/React component gallery;
- it is mostly beige/white rounded rectangles;
- the same UI could belong to a finance app if Barkly were removed;
- color is the only thing separating two states;
- the screen is technically tidy but has no visual focal point;
- a child has to read a label to know the fun thing to touch;
- the new art does not look like it comes from the same physical universe as Barkly.

## Screenshot test

At 390x844 and 430x932, take a screenshot with no dialog open and ask:

**Does this look like a polished kids game from five feet away?**

If the first read is “mobile app UI,” keep working.
