#!/usr/bin/env python3
"""Write offline.json: every file the tour needs, with a version that changes
whenever any of them does. sw.js caches exactly this list on first load, so
the tour plays with no signal at the park.

    python3 ori_tour/tools/build_offline.py

Re-run after changing any app file or content package (the test suite checks
the list is complete and current).
"""
import hashlib
import json
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
INCLUDE_DIRS = ["dist", "css", "assets", "content", "vendor"]
INCLUDE_FILES = ["index.html", "ar.html", "manifest.webmanifest"]
SKIP_EXT = {".py", ".md", ".LICENSE"}


def files():
    out = list(INCLUDE_FILES)
    for d in INCLUDE_DIRS:
        for base, _, names in os.walk(os.path.join(ROOT, d)):
            for n in names:
                if os.path.splitext(n)[1] in SKIP_EXT or n.startswith("."):
                    continue
                out.append(os.path.relpath(os.path.join(base, n), ROOT).replace(os.sep, "/"))
    return sorted(set(out))


def build():
    fs = files()
    h = hashlib.sha256()
    for f in fs:
        h.update(f.encode())
        h.update(open(os.path.join(ROOT, f), "rb").read())
    return {"version": h.hexdigest()[:12], "files": ["./"] + fs}


if __name__ == "__main__":
    out = build()
    with open(os.path.join(ROOT, "offline.json"), "w") as f:
        json.dump(out, f, indent=1)
        f.write("\n")
    print(f"offline.json: {len(out['files'])} files, version {out['version']}")
