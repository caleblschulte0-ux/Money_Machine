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

## First results (2026-09-23)

See the "Results" section appended by the first training run below.
