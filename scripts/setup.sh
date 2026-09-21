#!/usr/bin/env bash
# Linux/macOS twin of setup.ps1 (for CI, servers and non-Windows development).
#   ./scripts/setup.sh [--no-ml] [--no-models]
set -euo pipefail
cd "$(dirname "$0")/.."
NO_ML=0; NO_MODELS=0
for a in "$@"; do case "$a" in --no-ml) NO_ML=1;; --no-models) NO_MODELS=1;; esac; done
PY=${PYTHON:-python3}
[ -d .venv ] || "$PY" -m venv .venv
. .venv/bin/activate
pip install --upgrade pip wheel >/dev/null
pip install -r requirements-dev.txt
if [ "$NO_ML" = 0 ]; then pip install -r requirements-ml.txt; fi
pip install -e . >/dev/null
if [ "$NO_ML" = 0 ] && [ "$NO_MODELS" = 0 ]; then python scripts/download_models.py; fi
mkdir -p runs
python -m pytest -q
python -m fishai doctor --offline
