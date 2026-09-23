# The detector lab: building our own fish detector

Everything needed to go from "Fishial's detector" to "ours", in the repo,
runnable on a laptop. Code in `fishai/lab/`, commands under `fishai lab`.

```
fishai lab camera                       what the rail camera sees in a given tank
fishai lab assets                       cut real fish + fish-free backgrounds out of licensed clips
fishai lab synth --name synth_v1 --n 4000 --holdout 6966 9384
                                        render labelled training frames from the rail camera
fishai lab silver CLIPS --out DIR       real frames auto-labelled by the bootstrap (evaluation only)
fishai lab train DATASETS --out models/ours_v1/detector.pt --eval silver=DIR
                                        train OUR detector (torchvision, no Ultralytics)
fishai lab eval DATASET --detectors yolo:fishial_detector_v26 torchvision:models/ours_v1/detector.pt
                                        score any detectors on any labelled set
```

Then run it: `-o detection.backend=torchvision -o detection.torchvision.model=models/ours_v1/detector.pt`.

## 1. The camera model (`lab/camera.py`)

The rail camera looks horizontally through flat glass. Refraction narrows
the Camera Module 3 Wide from 102 x 67 degrees in air to **71.3 x 48.9
underwater**. The model projects any point in the tank to a pixel, so a
rendered fish is exactly as big as it will be on the product. It also
answers mounting questions before anything is built:

```
fishai lab camera --tank-length 60 --water-depth 35 --camera-depth 17.5
```

Finding worth knowing for the hardware: in a 60 cm tank with 35 cm of
water and the camera at mid-depth, the surface and the substrate only come
into view 38 cm from the glass, so **only the far 36% of the tank is seen
top to bottom**. A fish near the glass and near the surface is outside the
frame. This is physics, not software: a wider vertical lens, a second
camera, or accepting it.

## 2. Assets (`lab/sprites.py`, `lab/plates.py`)

- **Real fish cut-outs**: the bootstrap detector finds confident fish,
  GrabCut separates each from the water, and a cut-out is kept only if it
  looks like a fish and was not cut off by the video frame. First harvest:
  274 cut-outs, 177 usable after the truncation filter, sampled evenly per
  source clip so one clip cannot dominate.
- **Real backgrounds**: the temporal median of a clip removes swimming
  fish; any fish that sat still is found by the bootstrap and painted out.
- **Procedural fish**: unlimited, perfectly masked, and the only practical
  source of labelled look-alikes (same species, different individuals) for
  identity work.

Cut-outs and backgrounds are derived from licensed clips and are git-ignored.

## 3. The renderer (`lab/render.py`)

Fish are placed in a randomised 3D tank (45 to 120 cm long, 25 to 50 cm of
water, camera at 35 to 65% of the depth) and drawn far to near through the
camera model, with water attenuation and blur growing with distance, plants
in front, bubbles, caustics, glass reflections, flat-port distortion,
exposure and colour-balance changes, sensor noise, JPEG, and infrared night
footage. A per-pixel owner map makes every label the **visible** part of
its fish and records how much was hidden (occlusion) and how much was
outside the frame (truncation). Continuous clips keep each fish's identity:
ground truth for tracking and re-identification. About 13 frames per
second on a laptop CPU.

## 4. Training (`lab/trainer.py`)

torchvision Faster R-CNN with a MobileNetV3 FPN backbone: BSD-3 code, no
Ultralytics, trains on a CPU. The checkpoint carries its own training
record (data, config, start weights, validation scores).

Licence honesty: starting from torchvision's COCO weights means starting
from an ImageNet-initialised backbone, and ImageNet's terms are
research-only. That is standard practice and a grey area for a commercial
product; `--no-pretrained` removes it at the cost of data and time. The
production candidate is RF-DETR (Apache-2.0 code and DINOv2 backbone),
which reads the same datasets; it needs a GPU to be practical.

## 5. Evaluation (`lab/evaluate.py`)

Precision, recall and F1 at IoU 0.5, plus recall by fish size, by day and
night, and on synthetic sets by real cut-outs versus procedural fish.

Three kinds of test set, never confused:

| Set | Labels | What a score means |
|---|---|---|
| synthetic val | exact | how well the camera's view is learned; optimistic about reality |
| silver (real clips, bootstrap labels) | Fishial's boxes | agreement with Fishial on real footage, not truth |
| gold (real clips, human-reviewed) | truth | the real answer; needs the review step |

The silver set is built from clips **held out** of asset harvesting, so it
is footage of tanks and fish the detector never saw.

## Results so far (2026-09-23)

Every model is judged on the same two sets: `synth_v1` validation (400
rendered frames, exact labels) and `silver_holdout` (60 real frames from
two clips that were held out of ALL asset harvesting and training: the
Denison barbs tank and the waiting-room tank; labels are Fishial's).

| model | trained on | synthetic F1 | synthetic recall | small-fish recall | night F1 | held-out real F1 | held-out real recall | held-out real precision |
|---|---|---|---|---|---|---|---|---|
| Fishial (bootstrap) | its own real photos | 0.48 | 0.32 | 0.04 | 0.34 | (is the label source) | | |
| **ours v1** | 3,600 synthetic frames, 3 epochs, 70 min CPU | **0.83** | 0.79 | 0.30 | 0.80 | **0.72** | **0.71** | 0.73 |
| ours v2 | v1 + decoy synthetic + real pseudo-labels x4 | 0.83 | 0.76 | 0.26 | 0.81 | 0.55 | 0.45 | 0.70 |
| ours v2b | v1 + decoy synthetic only (ablation) | 0.82 | 0.76 | 0.28 | 0.79 | 0.54 | 0.51 | 0.58 |
| ours v3 | v1 + fresh decoy-free synthetic, selected on real frames | 0.82 | 0.75 | n/a | n/a | 0.57 | 0.61 | 0.53 |

The v1 held-out numbers include the post-processing added in round 2 (NMS
0.4, no box over half the frame, no box wrapping two others); before it
they were F1 0.69, precision 0.67.

What the numbers say:

- **A detector trained only on synthetic footage from the rail's view
  already works on real tanks it never saw.** In the barbs tank it finds
  the same fish as Fishial with near-identical boxes
  (`bench/ours_v1_vs_fishial.jpg`, left column Fishial, right column ours).
- **Its real-world errors were specific**: boxes on the couch, the person
  and the room seen through the glass behind the waiting-room tank, and
  wrapper boxes around several fish. Nothing in the synthetic tanks looked
  like a room behind glass.
- **More synthetic training did not help on real footage.** v2, the
  decoy-only ablation v2b and the decoy-free v3 all improved or held on
  synthetic and all scored below v1 on the held-out tanks. Neither the
  pseudo-labels nor the decoys is the single cause: continued training on
  rendered footage fits the renderer, not fish.
- **The evaluation set is too small to rank close models.** On the 263 real
  frames from the non-held-out clips (which v1, v2b and v3 never trained
  on) the three score F1 0.49, 0.46 and 0.50: within noise of each other.
  On the 60 held-out frames they spread from 0.54 to 0.72. Part of v1's
  lead is a small test set. (v2 scores 0.88 there only because it trained
  on those very frames.)
- **Fishial's low synthetic recall mostly measures the renderer**: it finds
  54% of the cartoon fish but only 12% of pasted real fish, while handling
  real video well. Pasted fish do not yet look real enough to a detector
  trained on photographs. Better compositing (edge blending, lighting
  match, motion blur) is the next renderer improvement.
- **Small, distant fish are the weak spot for everyone** (0.30 at best).
  Training at a higher input resolution is the obvious lever and costs CPU
  time; a GPU removes the trade-off.

## What this means, and what to do next

Synthetic footage from the rail's view is enough to get a working detector
with no Ultralytics and no labelling: v1 finds the same fish as Fishial in
a real tank it never saw. It is not enough, alone, to beat Fishial on real
footage, and more of it stops helping quickly. Current default: **v1**
(`models/ours_v1/detector.pt`, not committed; reproduce with the commands
in this file).

The next gains come from real footage, in this order:

1. **A bigger, human-checked real test set.** A few hundred frames from
   several tanks with reviewed (gold) boxes, so models that differ by 0.05
   can be ranked honestly. Fish-store phone footage is the fastest source.
2. **Real training frames with reviewed labels**, mixed with synthetic. The
   pseudo-label shortcut taught missed fish as background; reviewed labels
   remove that.
3. **Select checkpoints on real frames**, never on synthetic (`--val` with a
   real set; the trainer supports it).
4. **Renderer realism** (edge blending, lighting match, motion blur) so
   pasted fish look real to a detector trained on photographs.
5. **Higher resolution and RF-DETR** once a GPU is available.
