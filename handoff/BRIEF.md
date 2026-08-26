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
| 2 | ONE AFTERNOON | historical reconstruction — buildings and people that are gone, standing where they stood |
| 3 | THEN AND NOW | time control — the same view across eras, under the viewer's control |
| 4 | DEEP TIME | subsurface and data visualisation — what is inside and under the rock |
| 5 | THE TOUR | multi-user and personalised — several people in one place, each seeing something different |

If two films end up demonstrating the same thing, one of them is wrong.

## Standing constraints — these predate the direction change and survive it

- AR content is a **VISUALISATION, never evidence**. Non-photoreal treatment,
  labelled as reconstruction. Nothing that would pass as a historical photograph.
  No asserted dates, captions or attributions presented as documented fact.
- **No invented business claims.** No raise amount, terms, traction, partnership,
  deployment claim, customer, or call to action.
- Shorts-pipeline tooling is **read-only**. Never modify that repo.
- Never touch `shorts-pipeline-drops`.

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
Film C flagged 6 of 9 segments — `r05` drifts **76%** of frame width, `sys`
74%, `r04` 57%. Film B flagged 4 of 13, including `b09` whose tail motion is
**15.5x** its middle. Both films are locked. Both have the defect.

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
