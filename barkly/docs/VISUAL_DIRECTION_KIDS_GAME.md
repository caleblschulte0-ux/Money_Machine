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
4. **Avoid generic equal-width segmented controls.** Location navigation should eventually feel like four destination tokens/signs, not browser tabs.
5. **World labels are not app labels.** NPC names, dig prompts and object hints should feel painted/stamped into the scene.
6. **Use asymmetry and authored composition.** Perfectly centered stacks of rectangles look generated. Tilt notes, offset props, overlap foreground objects, let visual weight differ.
7. **Scene art must converge on Barkly's material language.** The long-term target is molded/clay/vinyl diorama art, not increasingly elaborate flat vector backgrounds.
8. **No emoji as production art.** Draw icons/props in the Barkly universe.
9. **Animation is cosmetic too.** Buttons depress. Panels settle. Stickers pop. Rewards bounce. Objects squash slightly. NPCs breathe. The screen should never feel like static HTML.
10. **Children should know what is fun to touch without reading.** Shape, color, motion and Barkly's attention should do the teaching.

## Main-screen target

The main room should eventually have:
- a much less UI-like location selector; each destination has its own color/material and tiny illustrated cue;
- coin/level pod that looks like a toy HUD, not a white pill;
- Pack Book control that looks like a small physical book/tab;
- Plan control that looks like a taped/stuck note;
- dialogue as a molded character console with speaker-specific color;
- talk as the loudest candy control on screen;
- typing secondary but still playful;
- no generic white control dock behind Barkly's in-world bowl/toy/bed.

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
- Pack Book already moved from analytics toward scrapbook language and should continue getting more visual assets/portraits.

## Next cosmetic implementation order

1. Main location navigation — replace pill tabs with four authored destination controls.
2. Pack button — make it visibly a tiny book/object.
3. Plan chip — make it visibly a pinned note object in the main scene chrome.
4. Typing field — stop looking like a web input; make it a toy-console speech slot.
5. Pack Book — add actual portrait/treasure/rival visual modules and stronger color blocks.
6. Store items — eventually show mini Barkly previews wearing/using the selected object, not just an icon row.
7. Food — animate bowl/food preview before choosing.
8. Unique NPC silhouettes/assets.
9. Replace major code-drawn scene furniture with authored diorama assets.
10. Add SFX and micro-motion to every high-frequency surface.

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
