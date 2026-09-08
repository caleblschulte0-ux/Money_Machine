# What I got wrong today — a process review

Written at the operator's request, from this session's own git history and
captures. Evidence first.

## 1. I worked for a day before I looked

The cold art review (`ART_REVIEW_2026-09-08.md`) was the **twentieth** commit of
the session. Everything that has actually landed came after it: lighting the
character, lighting the cast, the resting face, the sky. It took about half an
hour to produce and it immediately found cheaper and larger wins than anything
in the nineteen commits before it.

The order was exactly backwards. I should have looked at the whole product
cold, from captures, before touching a single file.

## 2. Four times the code for the work that did not land

Insertions, by pass:

| pass | insertions | outcome |
|---|---|---|
| materials, occlusion, props, near-ground | ~1,589 | operator could not see it; the felt half was rejected outright |
| lighting, cast, resting face, sky | ~380 | visibly correct, measurably correct |

The work that landed cost a quarter of the work that did not. That is not bad
luck; it is what happens when the target is chosen by hunch rather than by
looking at the whole thing.

## 3. I confirm hunches instead of testing them

The felt pass is the cleanest example. I cropped Barkly beside a prop, read him
as "a plush toy", measured a real twelve-fold difference in fine detail, and
treated the measurement as confirmation. The number was true. The inference was
wrong: **a measurement that two things differ says nothing about which one to
move.** I moved the world toward him when he was the one being misread.

The operator corrected it in one sentence. I had spent most of a day on it.

## 4. My instruments produce artefacts and I act on them

At least four measurements this session were wrong in a way that pointed
somewhere real:

- Normalising every prop to 400px tall **upscaled a 638x21 paving course
  nineteen times** and reported its detail as exactly `0.00` — indistinguishable
  from a flat render.
- Measuring "the sky" on the beach sampled mostly **sea**, so a real change
  read as no change.
- A fixed rectangle sampling his fur **drifted off the dog** when the camera
  moved, and I reported the result anyway.
- Two whole measurement passes were read off **stale renders**, and both times
  the honest-looking answer was "nothing changed".

I now know the shape of this: I trust a number because it is a number. The fix
is to validate the instrument against a case with a known answer before
believing anything it says.

## 5. My own process damaged the work

Not thinking, not judgement — mechanics:

- `pgrep -fc blender` matched the shell running the wait loop, so every
  "wait for the render" loop waited on itself forever. An hour of apparent
  render time was a deadlock. The scene pack takes under a minute.
- `promote-props.py` staged every prop through one fixed path. Three promotes
  ran at once and **shipped a corrupt `castle.png`** that Pillow could not
  identify as an image, and a `headland.png` holding the dune grass.
- A regex replacement **broke `WorldScene.tsx`** by duplicating a block, and I
  ran three checks against the resulting stale build before noticing.
- `PROP_ONLY` with a comma list matched nothing, printed "rendered a subset"
  and exited 0 — so a measurement pass ran entirely on old pictures.

Each was found and fixed, and several are now guarded. But the time went
somewhere, and it went into repairing me.

## 6. I build gates that encode the hypothesis I am currently holding

`surface-check.py` was carefully made — median rather than mean so geometry
could not fake it, verified to fire in both directions — and it encoded the
felt theory. **It would have refused the correct art.** I deleted it a day
later.

A gate is supposed to be a neutral instrument. Writing one before the idea has
survived contact with the person judging the work turns it into a way of making
my own mistake permanent.

## 7. I claimed things about code I had not read

The art review said the cast are palette swaps drawn at one size and that he
wears one expression everywhere. Both were false, and both were checkable in
about a minute:

- `build` and `stance` per NPC have been in `world/npcs.ts` for some time.
- `faceFrame()` already switched on state.

I judged from the assets folder instead of from the shipped composite. The
review was right about the direction and wrong about the facts, which is the
worst combination: it reads as authoritative.

## 8. I asked the operator to adjudicate changes I could not see myself

Twice: "I can't really even tell the difference in those screenshots", and
before that "you're taking baby steps". If I cannot see the difference in my own
before/after, sending it spends someone else's attention to tell me something I
could have told myself.

## What changes

1. **Look first, and look again.** A cold pass over the whole product — every
   scene, every screen, every state — before starting, and after every few
   changes. It is thirty minutes and it beats a day of guessing.
2. **State the hypothesis and its falsifier before building.** "If this is
   right, X will be visibly different." If X turns out invisible, stop.
3. **Validate the instrument before trusting it.** Run any new measurement
   against a case whose answer is already known.
4. **Read the shipped path before claiming a gap exists.** The assets folder is
   not the game.
5. **No gate until the idea has survived the operator's eye.** Gates lock in
   whatever is true when they are written.
6. **Do not send a comparison I cannot see myself.** If it needs a caption
   explaining where to look, it is not a leap.
