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
python -m pytest         # 112 tests; ML tests skip when torch/weights are absent
```

## The rail (Raspberry Pi edge agent)

On the Pi: `bash edge/pi/install.sh`, then edit the pins and camera
settings in `/etc/systemd/system/fishai-edge.service` (see
`edge/pi/README.md`) and `sudo systemctl restart fishai-edge`. Check
`http://<pi>:8000/status` and `/snapshot.jpg`.

On the PC, `configs/local.yaml`:

```yaml
camera: {id: cam1, view: side}
live:
  edge_url: http://<pi>:8000
sensors:
  - {name: rail, kind: edge, url: http://<pi>:8000}
control:
  backend: edge
  edge_url: http://<pi>:8000
```

Then `fishai watch --source http://<pi>:8000/stream.mjpg --config
configs/local.yaml`, or register it with `install_tasks.ps1 -Source
"http://<pi>:8000/stream.mjpg"`. A second camera is a second edge agent (or
any URL) run under a second config with `camera.id: cam2`.

## Running unattended (Windows)

```powershell
.\scripts\install_tasks.ps1 -Source 0               # camera index or RTSP URL
.\scripts\install_tasks.ps1 -IngestFolder D:\tank    # or: drain a folder instead of a camera
.\scripts\install_tasks.ps1 -Uninstall
```

Registers "FishAI Watch" (at logon, restarts on exit) and "FishAI Daily"
(07:00 by default, `-DailyAt 06:30`). `fishai status` shows the watcher's
live line from `runs/live/status.json`; `fishai feed`, `fishai clip` and
`fishai stop` talk to it through `runs/live/requests/`.

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
