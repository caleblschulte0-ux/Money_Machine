# The five ORI demo commercials — source

This is the buildable source for the demo films. The renders themselves are
never committed (they are 70–170 MB masters); what lives here is everything
needed to make them again, plus the reasoning for why each thing is the way it
is. The container this was built in is ephemeral — this directory is the part
that survives.

Each film is three files and no more:

- `specN.py` — the **edit**: which plate, which in-point, how long, where every
  overlay is anchored, and a `timeline()` that refuses to import if the beats
  do not add up to the stated running time.
- `renderN.py` — the **picture**: footage gate, plate extraction, shot
  normalization across all plates, the AR compose, encode.
- `assembleN.py` — **end card, sound, master**: the location bed, the marks
  track, the mix, and a two-pass loudnorm to −16 LUFS / −1.5 dBTP.

Run order, from a directory holding `raw/IMG_*.MOV`:

```
cd filmN && python3 render4.py && python3 assemble4.py     # etc.
python3 rebeat.py b1 b2                                   # re-render named beats only
```

## The failure mode this project actually has

Three separate fixes landed in Demo 1 and never reached the other four. Each
one was found, understood, correctly implemented — and then applied to
exactly one of five films that share the architecture.

| fix | landed | propagated |
|---|---|---|
| end-card label release (r69) | Demo 1 | **r74**, after four films shipped with the wordmark burned through a label |
| disclosure plate behind VISUAL INTENTION ONLY (r67) | Demo 1 | **r74**, after the end-card fix removed the AR panels that had been masking it |
| `labelkit.block(dim=)` for a settled label (r67) | labelkit | **r74**, after three rounds of a reviewer calling Demo 5 "dense" |

Demo 1 is the film that gets iterated on first, so it is where fixes are
made — and where they stop. **When you fix something in one film, the next
move is to check the other four for the same thing, before anything else.**

Two of these also hid each other: the AR panels darkened the held end frame,
which made the missing disclosure plate invisible until the panels were
released. Expect a fix to uncover the next one rather than to finish the job.

And the reason all three survived review: a 4×4 contact sheet samples 16
frames across ~30s, so a 2.5s end card gets one tile at best. An external
reviewer caught the end-card bug on Demo 5 and, in the same document,
approved Demo 4 as-is while Demo 4 was broken. Sampled tiles cannot see this
class of defect. Check the invariant where the data is — `renderN.py` now
asserts the final composed frame IS the untouched plate — not in the MP4
afterwards.

## shared/

| file | what it is |
|---|---|
| `shotqc.py` | **the footage gate.** Measures the defect the operator named: a shot that starts clean and pans away at the tail. TAIL / DRIFT / JOLT. |
| `scanwin.py` | sweeps a clip for every clean 4s window under that gate |
| `gate_candidates.py` | gates a hand-picked list of (clip, in-point) pairs — much faster when you already know the shots you want |
| `regate.py` | re-measures published numbers against the **pre-fix** gate, kept verbatim as an oracle |
| `arlabel.py` | the AR grammar shared by every film: converging reticle, scan outline taken from the footage's own pixels, tracked anchor |
| `terrain.py` | depth shells, the range sweep, material classification |
| `deep.py` | the subsurface aperture and its material bands |
| `motionfield.py` | **retired, kept for the record.** It measured correctly and rendered badly; the docstring says why. |

## ai/

`genimg.py` fetches CONTENT — a clear illustration of a subject, and nothing
about style. `holo.py` imposes the STYLE, turning any source image into
luminous structure that cannot pass as a photograph.

That split is a safety property, not a convenience. Asking a generator
directly for "luminous cyan volumetric line reconstruction on pure black" was
tried first and it returned four cinematic renders that ignored every word.
The standing rule on this project is that AR content is a visualisation and
never evidence; enforcing it with a transform we control beats enforcing it
with a sentence a model is free to ignore.

## Two things that will bite the next person

**`cv2.phaseCorrelate` modifies its inputs in place.** It multiplies both
source arrays by the window. Any loop that uses each frame twice — once as
`b`, once as `a` — double-taperes every frame and under-reports motion. This
was live in `shotqc.py` and it manufactured one false JOLT flag on Film B
before it was caught. Pass copies. There is a comment at the call site.

**Normalize across all plates, always.** `rebeat.py` recomputes the full
normalization plan from all five plates even when re-rendering one beat.
Re-normalising a shot in isolation is how a film ends up with a cut that
flashes.

## What is deliberately absent

No `filmfinish` pass. Measured on a plate it cost contrast std 0.271 → 0.205
and highlights p99 0.916 → 0.771 — a film shoulder on a product demo, which
made the whole thing look hazy. The normalized plate is the deliverable
picture.

The brief these are built against is `handoff/BRIEF.md`.
