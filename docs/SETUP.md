# Setup

## Windows (primary)

1. Install Python 3.10 or newer from python.org; tick "Add python.exe to PATH".
2. Install git.
3. Clone and run:

```powershell
git clone <repo> FishAI
cd FishAI
.\scripts\setup.ps1
```

The script creates `.venv`, installs `requirements-dev.txt` and
`requirements-ml.txt`, installs the package, downloads the default weights
(`fishial_detector_v26`, ~120 MB), runs the tests and `fishai doctor`.

Options: `-NoML` (no torch; motion detector only), `-NoModels`, `-Gpu`
(CUDA 12.4 torch wheels), `-Python "py -3.11"`.

4. Optional reasoner: install Ollama, then `ollama pull qwen2.5:7b`.
   `fishai doctor` will report it reachable. Without it, `fishai assess`
   uses the deterministic rules and says so.

## Linux / macOS

```bash
./scripts/setup.sh            # or --no-ml --no-models
. .venv/bin/activate
python -m fishai demo
```

## Verifying

```
fishai doctor            # each line is a real check, not an import
fishai demo              # writes runs/demo_tank.summary.json and .annotated.mp4
python -m pytest         # 83 tests; ML tests skip when torch/weights are absent
```

## Configuration

Copy `configs/default.yaml` to `configs/local.yaml` (git-ignored), change
what you need, and pass `--config configs/local.yaml`. Or override inline:

```
fishai process tank.mp4 -o detection.backend=yolo -o tracking.backend=bytetrack -o video.frame_stride=2
```

## Common problems

- **`weights for 'fishial_detector_v26' not downloaded`**: run
  `python scripts/download_models.py`.
- **`the yolo detector needs pip install -r requirements-ml.txt`**: the ML
  extras are missing; `setup.ps1` without `-NoML` installs them.
- **Slow on CPU**: use `-o video.frame_stride=3 -o video.max_side=640`, or a GPU.
- **`could not open video source`**: OpenCV could not read the file or
  camera index; check the path and that the codec is supported (mp4/h264 is).
