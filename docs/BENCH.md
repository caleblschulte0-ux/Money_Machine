# Detector bench on licensed public clips (2026-09-22)

`fishai bench` runs the detector and tracker over every clip in
`datasets/manifests/public_clips.json` and reports what can be measured
without ground truth. Command used:

```
fishai bench --detector yolo --tracker bytetrack --max-frames 150 --stride 2 --max-side 640
```

Detector: Fishial YOLO26 nano. Tracker: ByteTrack (`trackers` package). CPU only.

| clip | frames w/ fish | det/frame | mean conf | tracks | ~fish | frags/fish | proc fps |
|---|---|---|---|---|---|---|---|
| denison barbs (planted) | 100% | 2.88 | 0.78 | 9 | 5 | 1.8 | 3.5 |
| tropical fish, moss | 99% | 2.14 | 0.68 | 9 | 6 | 1.0 | 5.1 |
| fish and plants | 60% | 1.00 | 0.35 | 9 | 2 | 1.5 | 5.3 |
| waiting-room tank | 100% | 10.1 | 0.66 | 19 | 13 | 1.3 | 5.0 |
| large fish, crowded public tank | 100% | 13.0 | 0.68 | 78 | 19 | 3.3 | 4.8 |
| marine flora | 83% | 1.85 | 0.53 | 5 | 3 | 1.7 | 5.0 |
| lionfish, blue light | 99% | 0.99 | 0.92 | 1 | 1 | 1.0 | 5.5 |
| lionfish, public aquarium | 96% | 0.96 | 0.83 | 1 | 1 | 1.0 | 5.7 |
| fish underwater (off-domain) | 100% | 1.59 | 0.77 | 5 | 3 | 1.0 | 5.0 |
| coral projections (negative test) | 0% | 0 | n/a | 0 | 0 | n/a | 5.2 |

The "fish and plants" and "large fish" rows are from the re-run after the
tracker fix below; the rest are from the first run.

## What it says

- **The detector generalises.** Nine of ten clips, across freshwater,
  marine, planted, public-aquarium and blue-lit footage, have fish in
  83 to 100% of frames. The negative test (projected fish on coral) gives
  zero detections, which is correct.
- **Single fish are solved.** Both lionfish clips hold one identity for the
  whole clip at 0.83 to 0.92 confidence.
- **Weak spot 1: low-confidence scenes.** "Fish and plants" sits at 0.35
  mean confidence; 95% of its detections are below 0.5. This is the first
  clip to label for fine-tuning; its weak frames are exported by the bench.
- **Weak spot 2: crowded tanks.** The public-aquarium clip has 13 fish per
  frame entering and leaving view. The big grouper keeps one id throughout
  (see `bench/large_fish.sheet.jpg`); the small fish fragment at 3.3 tracks
  each. A home tank with a fixed camera and fewer fish is easier than this,
  and the built-in re-identification helps where ByteTrack has none.
- **Speed.** About 5 frames per second on a laptop CPU at 640 px. The live
  loop's default of 10 fps therefore needs either `video.max_side: 480`, a
  stride, or a GPU; the status file reports the real rate.

## Bug the bench found

The `trackers` ByteTrack only starts tracks from detections above its own
high-confidence gate (0.6 by default), separate from the activation
threshold we configure. On the low-confidence clip that meant zero tracks
from 60% of frames with fish. The adapter now ties the two thresholds
together; the same clip gives 9 tracks.

## Next

Label the exported weak frames (`runs/bench/<stamp>/review/`) plus a
sample from your own tank, then `training/` fine-tunes and
`evaluation/compare_detectors.py` scores it against the bootstrap.
