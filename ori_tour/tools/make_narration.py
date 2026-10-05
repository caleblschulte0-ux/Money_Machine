#!/usr/bin/env python3
"""Pre-generate each stop's narration audio and caption cues, so the tour
plays with no signal and sounds the same on every device.

Voice: Kokoro-82M (Apache-2.0), run locally through kokoro-onnx. No account,
no API, no per-use cost. This is the GENERATED voice the plan calls for until a
human narrator records; the package says so on every stop (narration.voice).

    pip install kokoro-onnx soundfile
    # model files (about 340 MB, not committed), from
    # https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
    #   kokoro-v1.0.onnx  voices-v1.0.bin   -> put them in $KOKORO_DIR
    KOKORO_DIR=/path/to/models python3 ori_tour/tools/make_narration.py [--tour falls-park] [--voice af_heart]

Writes content/<tour>/audio/<stop>.m4a and <stop>.cues.json, and records in
tour.json: audio, cues, duration_s, voice, and text_sha (the first 16 hex of
the sha256 of the narration text). The test suite fails if the text changes
without the audio being regenerated, so a visitor never hears old words under
new captions. Captions are timed per sentence from the synthesis itself.

Requires ffmpeg for the AAC encode (m4a plays on iPhone and Android).
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
GAP_S = 0.35  # pause between sentences
SPEED = 0.95


def sentences(text):
    return [s.strip() for s in re.findall(r"[^.!?]+[.!?]+[\"']?\s*", text) or [text] if s.strip()]


def text_sha(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tour", default="falls-park")
    ap.add_argument("--voice", default="af_heart")
    ap.add_argument("--force", action="store_true", help="regenerate even when the text is unchanged")
    args = ap.parse_args()

    import numpy as np
    import soundfile as sf
    from kokoro_onnx import Kokoro

    models = os.environ.get("KOKORO_DIR", ".")
    kokoro = Kokoro(os.path.join(models, "kokoro-v1.0.onnx"), os.path.join(models, "voices-v1.0.bin"))

    pkg = os.path.join(HERE, "..", "content", args.tour)
    path = os.path.join(pkg, "tour.json")
    tour = json.load(open(path))
    os.makedirs(os.path.join(pkg, "audio"), exist_ok=True)

    for stop in tour["stops"]:
        n = stop["narration"]
        sha = text_sha(n["text"])
        if n.get("text_sha") == sha and n.get("audio") and not args.force:
            print(f"{stop['id']}: unchanged")
            continue
        pieces, cues, t = [], [], 0.0
        sr = None
        for line in sentences(n["text"]):
            audio, sr = kokoro.create(line, voice=args.voice, speed=SPEED, lang="en-us")
            dur = len(audio) / sr
            cues.append({"start": round(t, 2), "end": round(t + dur, 2), "text": line})
            pieces += [audio, np.zeros(int(GAP_S * sr), dtype=audio.dtype)]
            t += dur + GAP_S
        wav = np.concatenate(pieces[:-1])
        rel = f"audio/{stop['id']}.m4a"
        with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
            sf.write(tmp.name, wav, sr)
            subprocess.run(
                ["ffmpeg", "-loglevel", "error", "-y", "-i", tmp.name, "-ac", "1", "-c:a", "aac", "-b:a", "64k",
                 "-movflags", "+faststart", os.path.join(pkg, rel)],
                check=True,
            )
        cues_rel = f"audio/{stop['id']}.cues.json"
        json.dump(cues, open(os.path.join(pkg, cues_rel), "w"), indent=1)
        n["audio"] = rel
        n["cues"] = cues_rel
        n["duration_s"] = round(len(wav) / sr, 2)
        n["voice"] = f"generated (Kokoro-82M, voice {args.voice}); placeholder until a human narrator records"
        n["text_sha"] = sha
        print(f"{stop['id']}: {n['duration_s']} s, {len(cues)} captions")

    with open(path, "w") as f:
        json.dump(tour, f, indent=2, ensure_ascii=False)
        f.write("\n")


if __name__ == "__main__":
    sys.exit(main())
