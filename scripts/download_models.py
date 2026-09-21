#!/usr/bin/env python
"""Download model weights listed in models/registry.json into models/.

    python scripts/download_models.py            # every entry marked default
    python scripts/download_models.py --all      # everything in the registry
    python scripts/download_models.py KEY [KEY]  # specific entries
    python scripts/download_models.py --list     # show what exists and what is present

Weights are git-ignored; this script is the reproducible path from a fresh
clone to a working detector. It verifies sha256 when the registry has one,
extracts zip archives, and is safe to re-run (skips what is present).
"""

from __future__ import annotations

import argparse
import hashlib
import shutil
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from fishai.models_registry import REGISTRY_PATH, load_registry, local_path_for  # noqa: E402


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "FishAI-download/0.1"})
    with urllib.request.urlopen(req) as resp, open(dest, "wb") as out:  # noqa: S310 - registry URLs
        total = int(resp.headers.get("Content-Length") or 0)
        done = 0
        while True:
            chunk = resp.read(1 << 20)
            if not chunk:
                break
            out.write(chunk)
            done += len(chunk)
            if total:
                print(f"\r  {done / 1e6:7.1f} / {total / 1e6:.1f} MB", end="", flush=True)
        print()


def fetch(key: str, entry: dict, models_dir: Path, force: bool = False) -> Path:
    target = local_path_for(key, entry, models_dir)
    if target.exists() and not force:
        print(f"{key}: present at {target}")
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    print(f"{key}: downloading {entry['url']}")
    with tempfile.TemporaryDirectory() as tmp:
        tmp_file = Path(tmp) / "download"
        _download(entry["url"], tmp_file)
        if entry.get("sha256"):
            got = _sha256(tmp_file)
            if got != entry["sha256"]:
                raise SystemExit(f"{key}: sha256 mismatch (expected {entry['sha256']}, got {got})")
        if entry.get("archive") == "zip":
            member = entry["archive_member"]
            with zipfile.ZipFile(tmp_file) as zf:
                names = [n for n in zf.namelist() if n == member or n.endswith("/" + member)]
                if not names:
                    raise SystemExit(f"{key}: {member!r} not in archive ({zf.namelist()[:10]})")
                with zf.open(names[0]) as src, open(target, "wb") as dst:
                    shutil.copyfileobj(src, dst)
                # Keep the archive's metadata next to the weights when present.
                for extra in ("info.json", "LICENSE", "README.md"):
                    hits = [n for n in zf.namelist() if n.endswith(extra) and "__MACOSX" not in n]
                    if hits:
                        with zf.open(hits[0]) as src, open(target.parent / extra, "wb") as dst:
                            shutil.copyfileobj(src, dst)
        else:
            shutil.move(str(tmp_file), target)
    print(f"{key}: saved {target} ({target.stat().st_size / 1e6:.1f} MB)")
    print(f"  licence: code {entry.get('code_license')}; weights: {entry.get('weights_license')}")
    return target


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("keys", nargs="*")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--models-dir", default=str(REPO_ROOT / "models"))
    args = ap.parse_args(argv)
    registry = load_registry()
    models_dir = Path(args.models_dir)
    if args.list:
        for key, entry in registry.items():
            present = local_path_for(key, entry, models_dir).exists()
            flag = "default" if entry.get("default") else "       "
            print(f"[{'x' if present else ' '}] {key:26} {flag}  {entry['description']}")
        print(f"registry: {REGISTRY_PATH}")
        return 0
    keys = args.keys or ([k for k in registry] if args.all else [k for k, e in registry.items() if e.get("default")])
    unknown = [k for k in keys if k not in registry]
    if unknown:
        raise SystemExit(f"unknown model key(s): {', '.join(unknown)}; see --list")
    for k in keys:
        fetch(k, registry[k], models_dir, force=args.force)
    return 0


if __name__ == "__main__":
    sys.exit(main())
