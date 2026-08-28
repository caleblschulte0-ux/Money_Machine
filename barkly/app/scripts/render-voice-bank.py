#!/usr/bin/env python3
"""Record Barkly's fixed lines once, so the app can speak without a server.

Reads `voice-bank/lines.json` (written by `scripts/voice-bank.mjs harvest`) and
writes one small mp3 per line into `assets/voice/`. Same voice, same warmth
pass, same everything as the live proxy — this literally imports
`barkly/server/tts/say.py` rather than reimplementing it, because a bank that
drifts from the live voice is worse than no bank: half his lines would be one
dog and half another.

    python3 scripts/render-voice-bank.py [--limit N] [--force]

RESUMABLE ON PURPOSE. It is 150-odd network round trips, and a run that dies at
line 130 must not throw away 130 recordings. A line whose mp3 already exists is
skipped, and since the filename is a hash of the line, rewording a line makes a
NEW filename — so an edit re-records exactly what changed and nothing else.

The output is 24 kHz mono mp3 at VBR quality 0.7. Not because it is nice, but
because it is small
and every browser and phone plays it without asking: this audio ships inside the
app bundle and inside a single-file web artifact with a hard 16 MB ceiling.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import sys
import time
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
SAY = APP.parent / "server" / "tts"
LINES = APP / "voice-bank" / "lines.json"
OUT = APP / "assets" / "voice"

# edge-tts speaks over TLS, and in some sandboxes the system trust store is not
# the one the network actually presents. certifi is what the library itself
# expects, so prefer it and let BARKLY_CA_BUNDLE override.
if "BARKLY_CA_BUNDLE" not in os.environ:
    try:
        import certifi

        os.environ["BARKLY_CA_BUNDLE"] = certifi.where()
    except Exception:  # noqa: BLE001
        pass

sys.path.insert(0, str(SAY))
import say  # noqa: E402  (path juggling above is the point)


def key_for(spoken: str) -> str:
    """Must match bankKey() in scripts/voice-bank.mjs, or nothing ever matches."""
    return hashlib.sha256(spoken.encode("utf-8")).hexdigest()[:16]


def to_mp3(wav_or_mp3: bytes) -> bytes | None:
    """Trim the dead air off both ends and encode small.

    edge-tts pads every clip with a beat of silence, which is fine over a
    network and is pure waste when 150 of them live in the binary. Trimming at
    a low threshold also tightens his delivery, which suits him.
    """
    try:
        import numpy as np
        import soundfile as sf
    except Exception as e:  # noqa: BLE001
        print(f"  ! cannot encode ({type(e).__name__}) - pip install soundfile numpy", file=sys.stderr)
        return None

    x, sr = sf.read(io.BytesIO(wav_or_mp3), dtype="float32")
    if x.ndim > 1:
        x = x.mean(axis=1)

    loud = np.abs(x) > 0.012
    if loud.any():
        first, last = int(np.argmax(loud)), int(len(loud) - np.argmax(loud[::-1]))
        pad = int(0.045 * sr)  # keep a breath, so he does not sound clipped off
        x = x[max(0, first - pad) : min(len(x), last + pad)]

    buf = io.BytesIO()
    # 0.7 is measured, not guessed: it takes a clip from 26 KB to 16 KB while
    # the two bands that decide whether he sounds friendly barely move (warmth
    # 0.421 -> 0.410, harshness 0.110 -> 0.115, 3.7% spectral error overall).
    # Above this the file keeps shrinking and the harsh band starts climbing,
    # which is the exact quality we spent three rounds getting out of him.
    sf.write(buf, x, sr, format="MP3", subtype="MPEG_LAYER_III", compression_level=0.7)
    return buf.getvalue()


def main() -> int:
    if not LINES.exists():
        print(f"no {LINES} - run `node scripts/voice-bank.mjs harvest` first", file=sys.stderr)
        return 2
    entries = json.loads(LINES.read_text())["entries"]
    OUT.mkdir(parents=True, exist_ok=True)

    force = "--force" in sys.argv
    limit = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])

    todo = [e for e in entries if force or not (OUT / f"{key_for(e['spoken'])}.mp3").exists()]
    if limit:
        todo = todo[:limit]
    print(f"{len(entries)} lines, {len(todo)} to record")

    done = failed = total = 0
    for i, e in enumerate(todo, 1):
        spoken = e["spoken"]
        key = key_for(spoken)
        if key != e["key"]:
            print(f"  ! key mismatch on {spoken[:40]!r} - the two hashers disagree", file=sys.stderr)
            return 3

        audio = None
        for attempt in range(3):
            audio = say.edge(spoken)
            if audio:
                break
            time.sleep(1.5 * (attempt + 1))
        if not audio:
            failed += 1
            print(f"  [{i}/{len(todo)}] FAILED {spoken[:56]}")
            continue

        mp3 = to_mp3(say.warmth(audio))
        if not mp3:
            return 4
        (OUT / f"{key}.mp3").write_bytes(mp3)
        done += 1
        total += len(mp3)
        print(f"  [{i}/{len(todo)}] {len(mp3) // 1024:>3} KB  {spoken[:56]}")

    print(f"\nrecorded {done}, failed {failed}, {total / 1024 / 1024:.2f} MB written")
    print("next: node scripts/voice-bank.mjs link")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
