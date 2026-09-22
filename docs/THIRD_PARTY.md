# Third-party components and licences

Code licences and model-weight licences are separate questions. A repo
under MIT does not make its published weights MIT unless it says so. This
table records what each publisher actually states; blanks are blanks.

| Component | Used for | Code licence | Weights licence | Notes |
|---|---|---|---|---|
| [ultralytics](https://github.com/ultralytics/ultralytics) | YOLO inference (`detection.backend: yolo`) | AGPL-3.0 (or commercial licence from Ultralytics) | AGPL-3.0 for their published checkpoints | **AGPL matters for a product.** Isolated behind `fishai/perception/detection/yolo.py`; the rest of FishAI never imports it. |
| [Fishial fish-identification](https://github.com/fishial/fish-identification) | default fish detector weights (`fishial_detector_v26`) | MIT | Not separately stated by the publisher. Trained with ultralytics. | Treat as bootstrap-only. Ask Fishial.ai for terms before commercial use, or replace with our own detector trained on our data. |
| [supervision](https://github.com/roboflow/supervision) | `Detections` container; ByteTrack fallback (<0.31) | MIT | n/a | ByteTrack class deprecated upstream since 0.28. |
| [trackers](https://github.com/roboflow/trackers) | ByteTrack (preferred provider) | Apache-2.0 | n/a | Pure tracking, no weights. |
| ByteTrack (algorithm) | tracking method | original repo MIT | n/a | Reimplemented by the packages above. |
| [PyTorch](https://pytorch.org) | ultralytics runtime | BSD-3 | n/a | CPU or CUDA build. |
| [OpenCV](https://opencv.org) (opencv-python-headless) | video I/O, background subtraction, drawing | Apache-2.0 | n/a | |
| [NumPy](https://numpy.org) | arrays | BSD-3 | n/a | |
| [PyYAML](https://pyyaml.org) | config | MIT | n/a | |
| [Ollama](https://ollama.com) | serves the local reasoner | MIT | n/a | Not a Python dependency; talks HTTP. |
| Qwen2.5 (default `qwen2.5:7b`) | reasoning model | n/a | Apache-2.0 (7B; check the tag you pull: 3B and 72B differ) | Any Ollama chat model works; the adapter is model-agnostic. |
| pytest, ruff, mypy | development only | MIT | n/a | |
| [torchvision](https://github.com/pytorch/vision) detection models | OUR detector (`fishai lab train`, `detection.backend: torchvision`) | BSD-3 | COCO-trained detection weights with ImageNet-initialised backbones: ImageNet terms are research-only; `--no-pretrained` avoids them | The no-Ultralytics path. RF-DETR (Apache-2.0, DINOv2 backbone) is the production candidate. |
| [picamera2](https://github.com/raspberrypi/picamera2) | edge agent camera capture (Pi only) | BSD-2 | n/a | apt package on Raspberry Pi OS |
| [gpiozero](https://github.com/gpiozero/gpiozero) | edge agent GPIO (button, float, feeder, home sensor) | BSD-3 | n/a | |
| [w1thermsensor](https://github.com/timofurrer/w1thermsensor) | DS18B20 temperature probe | MIT | n/a | |

## Candidates evaluated and not adopted (yet)

| Candidate | Why it is interesting | Why not now |
|---|---|---|
| Generic COCO YOLO weights | tiny, everywhere | COCO has **no fish class**; kept in the registry only as an adapter smoke test and fine-tuning start. |
| SAM / SAM2 (Apache-2.0) | model-assisted labelling and segmentation for our own dataset | Phase 1 needs no labels. Planned for the data strategy (auto-labelling with human review). |
| RF-DETR, D-FINE, YOLOX (Apache-2.0) | permissive detector families to escape AGPL | No fish-tuned weights published; the path is: collect our data with the Fishial bootstrap, then train one of these. |
| Fishial classification (DinoV2 + ViT, 866 species) | species labels feed identity and per-species baselines | Not needed for Phase 1; licence question is the same as the detector. |
| Deep re-id embeddings (OSNet etc.) | identity across long occlusions | Colour histograms first; measure before adding weights. |

## What this means for the product

1. The **only** AGPL component is the ultralytics adapter. Everything else
   in this repository can ship under a proprietary licence as long as that
   adapter is replaced or licensed commercially.
2. The **only** weights with unclear terms are Fishial's. They exist to
   bootstrap data collection. The data strategy (docs/DATA.md) is designed
   to replace them with weights trained on our own footage.
3. `models/registry.json` records the licence of every downloadable weight
   next to its URL and checksum. Adding weights without filling those
   fields should fail review.

Last checked 2026-09-21 against the publishers' README/LICENSE files.
Re-verify before a release.
