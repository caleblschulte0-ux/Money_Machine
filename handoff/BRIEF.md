# THE BRIEF — what we are building. Both agents check against this, every round.

Operator, 2026-08-26, after twenty rounds that drifted:

> "I need 5 separate demo videos all made differently so I have options to work
> with. Not a requirements video. I need demo commercial, send to someone and
> they get what we are doing, not the rules. I need to see AI images overlays
> in the video... They all need to have AI overlays that show that we can do a
> bunch of different stuff with this AI technology."

## What we are building

**Five demo commercials.** Each a different creative treatment. Each one
watchable cold by someone who has never heard of Open Range Interactive, who
comes away understanding what the product does. The operator picks from them.

**Every one shows AI overlays, and between them they demonstrate a RANGE of
capability.** Five films that all do historical building reconstruction is one
capability shown five times. That is not the brief. The brief is: look at the
different things this technology can do.

## What we are NOT building

- Not a rules or requirements explainer. Film C is that, it is finished and
  locked, and it is NOT one of the five.
- Not atmosphere pieces. A beautiful plate with no overlay demonstrates nothing.
- Not craft exercises. Grade standards, garment continuity and typography
  legibility are means. They are never the deliverable.

## The capability matrix — one lead capability per film, no duplicates

| # | Film | Lead capability the overlay demonstrates |
|---|---|---|
| 1 | THROUGH THE GLASS | live recognition and in-place labelling — the glasses know what you are looking at |
| 2 | WHAT STOOD HERE | historical reconstruction — buildings that are gone, standing where they stood |
| 3 | THEN AND NOW | time control — the same view across eras, under the viewer's control |
| 4 | DEEP TIME | subsurface and data visualisation — what is inside and under the rock |
| 5 | THE TOUR | multi-user and personalised — several people in one place, each seeing something different |

If two films end up demonstrating the same thing, one of them is wrong.

Film 2 was called ONE AFTERNOON in the first version of this table. That title
already belongs to a different, locked film, and two unrelated pieces of work
answering to one name in one handoff folder is a mess nobody needs. Renamed.

### Build state — 2026-08-26

| # | Film | State |
|---|---|---|
| 1 | THROUGH THE GLASS | **BUILT** — 32.000s, delivered to the operator |
| 2 | WHAT STOOD HERE | **BUILT** — 33.5s, three reconstructions assembled in place |
| 3 | THEN AND NOW | not started — the only one still outstanding |
| 4 | DEEP TIME | **BUILT** — 33.5s, depth model + material classes + subsurface aperture |
| 5 | THE TOUR | **BUILT** — 33.5s, two profiles in one frame plus a handed-over mark |

### Where the AI imagery comes from

ChatGPT's set is still unreachable: `ORI_AI_HANDOFF` is not link-shared, a
plain fetch of a Drive URL returns a sign-in page, `share_file` errors on the
"anyone" grant, and `download_file_content` returns 3.5-5.2 million base64
characters. **One operator action unblocks it — set that folder to "Anyone
with the link — Viewer."**

Rather than hold two of five films at zero over a permission, the
reconstruction imagery in Film 2 is generated locally (`ai/genimg.py`) and put
through `ai/holo.py`, which turns any source image into luminous structure.
That split matters for more than convenience: asking a generator for
"holographic wireframe on black" was tried first and it returned four
cinematic renders that ignored every word of the instruction. **The rule that
this material must never pass as a photograph is now enforced by a transform
we control, not by a sentence a model is free to ignore.** ChatGPT's images
should replace these the moment they are reachable; `holo.py` treats them
identically.

## OPERATOR RULING, 2026-08-27 — the AI-image rule, settled

ChatGPT was RIGHT on the facts and I verified both citations before acting.
`r00__operator__brief.md` hard rule 1 says: *"NO newly generated AI images.
Only real footage and the already-approved transparent assets Claude holds.
If something is missing, name a NEEDED_<asset> placeholder instead."*
`r08__operator__brief.md` reaffirms it: *"NO generated AI imagery."*

That genuinely conflicts with the operator's spoken instruction of
2026-08-26: *"I need tk see ai images overlays in the video something like
the original ask chatgpt for the images its good at that."*

**The operator resolved it on 2026-08-27: the later instruction wins.**

- Demo 2 SHIPS as a real option, now.
- Its reconstruction sources are marked PROVISIONAL and are swapped for
  ChatGPT's approved set the moment `ORI_AI_HANDOFF` is reachable. The
  operator is opening that folder to "Anyone with the link — Viewer".
- The swap is a file replacement, not a rebuild: `ai/holo.py` treats any
  source image identically, so the edit, timing, treatment and labels are
  untouched by it.

Two things this ruling does NOT do. It does not license inventing imagery
generally — everything else in the visualisation rule stands, and no film
asserts a date, a measurement or an attribution. And it does not make
ChatGPT wrong to have raised it: the rule was real, it was written down,
and flagging the conflict was exactly the job. What ChatGPT does not get
to do is declare a film "noncompliant" and withheld — that is a ruling,
and rulings belong to the operator. Same eyes, no gavel.

**Precedence, for the next session:** a later operator instruction beats
an earlier written rule on the same point. Where they conflict and the
stakes are real, ASK — do not quietly pick one. This one was asked.

## Standing constraints — these predate the direction change and survive it

- AR content is a **VISUALISATION, never evidence**. Non-photoreal treatment,
  labelled as reconstruction. Nothing that would pass as a historical photograph.
  No asserted dates, captions or attributions presented as documented fact.
- **No invented business claims.** No raise amount, terms, traction, partnership,
  deployment claim, customer, or call to action.
- Shorts-pipeline tooling is **read-only**. Never modify that repo.
- Never touch `shorts-pipeline-drops`.

## Who does what — corrected 2026-08-26, after I over-corrected

Operator: *"I still want ChatGPT giving advice, watching the video and giving
you advice of stuff you're not seeing. But no one says it needs to be the
fucking director. I want you to use it for more than just images, because I
want it to be seeing stuff that maybe you're overlooking."*

**ChatGPT — second pair of eyes, and images.** It watches every cut and says
what it sees: pacing, whether a demo actually reads as a demo to a cold viewer,
overlays that do not land, a shot that is weak, anything Claude has stopped
noticing because he has looked at it forty times. It also generates the AR
artwork. Its observations are INPUT.

**ChatGPT does not** issue rulings, set numeric acceptance thresholds, declare
a film locked or withheld, or direct the creative.

**Claude decides.** Takes the advice, acts on what is right, and when he
disagrees says so plainly and specifically in the handoff, with the reason, so
there is a record either way. Disagreeing silently is not allowed; neither is
obeying silently.

**The operator picks.** Which of the five he sends to anyone is his call alone.

Why the distinction matters, honestly: the observations in r39-r59 were mostly
CORRECT. The garment really did change colour; the type really was too small.
What went wrong is that every observation arrived as a mandate with a number
attached — hue spread <= 25 degrees, luminance within 0.01 — and a mandate with
a number is something you can satisfy completely without ever asking whether it
mattered. Twenty rounds of hitting targets is what walking away from a brief
looks like from the inside. Same eyes, no gavel.

## Gate 1 — the footage gate (`shotqc.py`)

The operator: *"Some of that footage starts out good, but then the end of it
doesn't cut off in time, and you just get panning away weirdly, and it doesn't
look professional."*

He is right and it is measurable. Every candidate segment runs through
`shotqc.py` BEFORE it is cut, which reports median motion over the middle of
the shot, motion over the last 25%, the ratio between them, total drift as a
fraction of frame width, and the worst single-frame jolt.

    TAIL   tail motion >=1.8x the middle and >=2.0 px/frame — accelerating away
           exactly where the cut lands
    DRIFT  the frame travelled >=18% of its width — the shot you chose is not
           the shot you end on
    JOLT   a single-frame motion >=14 px — a bump or a whip

A flag is not automatically fatal. It means **look at the last second before
shipping it**, and either retime the segment or write down why the move is
deliberate. What is not allowed is shipping a flagged segment without either.

Measured on the already-locked films, which is how we know this is real:
Film C flags 6 of 9 segments — `r05` drifts **77%** of frame width, `sys` 74%,
`r04` 58%. Film B flags 3 of 13, including `b08` at 21% drift and `b09` whose
tail motion is **15.5x** its middle. Both films are locked. Both have the
defect.

**Correction, 2026-08-26 — the gate itself had a bug, and these are the
re-measured numbers.** `cv2.phaseCorrelate` multiplies BOTH of its input
arrays by the window **in place**, and `shotqc.py` uses every frame twice — as
`b` in one pair and as `a` in the next — so each frame arrived at its second
use already tapered and was tapered again. Verified directly: a 64x64 float32
array comes back with a max delta of 254 levels after one call. Fixed by
passing copies.

The published numbers were re-measured against the old code kept as an oracle
(`regate.py`). The error was small but not nothing, and one verdict changed:
Film B's `b00` JOLT was a **false positive the bug created** — peak 32.8 px
became 7.5 px once the frames stopped being double-windowed. So Film B is 3 of
13, not 4. Every other flag holds, Film C is unchanged at 6 of 9, and Demo 1's
five plates are still clean, so Demo 1 stands as delivered.

A gate that measures wrong is worse than no gate, because everyone downstream
believes it. This is on the record rather than quietly corrected.

**And it works.** Two of the three films built on 2026-08-26 were REFUSED on
their first render and had to be retimed: Demo 2's opening reconstruction beat
at 8.5s has a tail of 2.93 px/frame against a 0.58 middle, and Demo 5's
closing beat at 4.5s has 3.97 against 0.95. Both are exactly the fault the
operator described. Both plates are clean at other durations, which is the
whole point — the tail has to be measured at the duration you are actually
cutting.

## Gate 2 — the checkpoint. Every round, before anything else.

The loop improved craft for twenty rounds while walking away from the brief,
because nothing ever asked. Now something does. Both agents answer these four
questions at the top of every round's DONE file. Short answers. No essays.

1. **What are we building?** Name the deliverable in one line.
2. **Is this what was asked for?** Point at the line in this brief it serves.
   If you cannot, stop and say so.
3. **What are we doing right?** One thing, concretely.
4. **What are we doing wrong?** One thing, concretely. "Nothing" is only
   acceptable if you genuinely looked; two rounds of "nothing" in a row is
   itself the answer to question 4.

A round that skips the checkpoint is incomplete regardless of what it shipped.

## Stop condition

**Five good videos.** Not five locked videos. Not five perfect videos. When
five demos exist that the operator can send to someone, the work is done and
the loop stops.
