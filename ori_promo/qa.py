#!/usr/bin/env python3
"""Delivery QA for a finished master. Refuses to call something done on the
strength of it having been produced.

Checks the things that have actually gone wrong on this project:
  duration against the spec's stated total
  container: resolution, fps, audio sample rate (loudnorm runs at 192k
    internally and hands that rate downstream -- this is how Film A ended up
    with 96 kHz AAC)
  loudness and true peak, re-measured on the finished file
  blackdetect / freezedetect / silencedetect over the whole thing
"""
import json
import os
import re
import subprocess
import sys


def end_card_start(dur, default=None, style=None):
    """Where the deliberate held end-card frame begins, read from the
    RIGHT spec rather than guessed as a fixed offset from the total
    duration.

    v31 grew `end` from 3.5s to 4.5s (spec_one.py's BEATS) and that alone
    flipped this check from PASS to a false FAIL: freezedetect's onset
    inside a still hold depends on how long the moving grain takes to drop
    below its noise floor, not on the hold's length, so a longer hold can
    report an EARLIER freeze_start timestamp while remaining exactly as
    intentional. The old check excused anything in the last 3.0s
    (`dur - 3.0`) -- tuned against whatever `end` was worth when that
    number was written, silently wrong the moment `end` grew past 3.0s.
    Reading the beat's real start removes the guess.

    HARDCODED TO one/spec_one.py UNTIL THIS FIX: qa.py became the shared
    QA gate for every sibling pipeline this project grows (explain1,
    explain2, ...), each with its own spec and its own `end` beat start,
    but this function always read v32c's spec_one.py regardless of which
    video was actually being checked. explain1 (end at 63.0s) happened to
    pass anyway -- v32c's own end (37.1s) is an earlier, harmless excuse
    window for a video with real motion the whole way through. explain2
    (end at 35.5s, freeze genuinely detected at 36.77s -- INSIDE its own
    deliberate hold) did not: 36.77 < 37.1, so v32c's excuse window ended
    a fraction of a second too early to cover it, and this reported a
    false FAIL on a clean video. Fixed by searching every sibling spec_*.py
    next to this script for the one whose own TOTAL matches the probed
    file's duration, and reading THAT spec's `end` beat -- works for any
    future explain3/4/5 without touching this file again.

    STILL WRONG FOR THE ENTIRE CURRENT FIVE-STYLE SLATE UNTIL THIS SECOND
    FIX: that BEATS-scanning approach silently matched NOTHING for
    field/walk/map/layer (v34-v37) and fell through to the same naive
    `dur - 3.0` guess this function exists to replace -- three different
    ways, each swallowed by the bare `except Exception` below. field's and
    walk's BEATS entries are 4-tuples (name, start, dur, note), not the
    6-tuple `one`/explain1-5 shape this loop unpacks, so every iteration
    raised ValueError. map's and layer's specs don't have BEATS at all --
    they moved to a SECTIONS list -- so this raised AttributeError before
    even reaching the loop. And even where unpacking would have survived,
    none of field/walk/map/layer name their last beat/section "end" (it's
    "close"), so the name check would never have matched anyway. Checked
    directly: `end_card_start(70.0, default=X)` returned X (unmatched) for
    field, same for walk (72.0), same for map/layer (74.0) -- confirmed
    with a real qa.py import, not just read from the source. The actual
    gap this produced: field's true hold starts at 66.0 vs. the guessed
    67.0 (1.0s of a deliberate freeze would fail); map's and layer's true
    hold starts at 70.5 vs. the guessed 71.0 (0.5s). walk's happened to
    match by coincidence (its end_dur is exactly the guessed 3.0).

    Fixed the same way as before, one level up: rather than teach this
    function a third beat/section shape (guaranteed to need a fourth
    the next time a style's close-section layout differs), each spec now
    exports its own END_CARD_START -- the one number only that spec's
    render code actually knows (how much of its close beat/section is
    real motion vs. held frame is a render-side fact, not reliably
    derivable from section boundaries alone). This function reads that
    directly when present, and only falls back to the old BEATS-scanning
    path for specs that don't have it yet (one, explain1-5) -- preserving
    their already-correct behavior without touching them.

    Also closes a related latent bug: map's and layer's TOTAL are both
    74.0 exactly, so matching a spec by TOTAL alone is ambiguous between
    them. It happened not to matter for the BEATS-scanning path (neither
    ever matched, so neither was ever silently substituted for the
    other) but WOULD have mattered the moment either gained working
    BEATS/SECTIONS support without this fix. Now collects every spec
    whose TOTAL matches and requires their END_CARD_START values to
    agree (they do: both 70.5) rather than silently returning whichever
    directory happened to sort first.
    """
    specs = _find_specs(dur, style=style)
    if not specs:
        return default
    found = []
    for label, m in specs:
        if hasattr(m, "END_CARD_START"):
            found.append((label, float(m.END_CARD_START)))
            continue
        for name_, _clip, _tin, start, _dur, _note in getattr(m, "BEATS", []):
            if name_ == "end":
                found.append((label, float(start)))
    if not found:
        return default
    distinct = {round(v, 3) for _, v in found}
    if len(distinct) > 1:
        raise SystemExit(
            f"end_card_start: ambiguous specs for duration {dur}: {found} "
            "-- pass an explicit style to main()/the CLI instead of guessing by duration")
    return found[0][1]


def _find_specs(dur, style=None):
    """Returns [(label, imported module), ...] for every sibling spec_*.py
    whose own TOTAL matches `dur` (within 0.05s) -- or, if `style` names a
    directory next to this script directly, just that one spec, no
    duration guessing at all.

    r252: map/spec_map.py and layer/spec_layer.py share the exact same
    TOTAL (74.0) AND, as of this round, genuinely disagree on more than
    END_CARD_START -- layer's hook now holds an intentional mid-film
    freeze (see INTENTIONAL_FREEZE_WINDOWS) that map has no reason to
    share. Duration alone can no longer safely stand in for "which style
    is this actually," so any caller that already KNOWS the style (this
    file's own __main__ block, when given one) should pass it here
    rather than let two same-length specs get silently conflated."""
    here = os.path.dirname(os.path.abspath(__file__))
    out = []
    names = [style] if style else sorted(
        n for n in os.listdir(here) if os.path.isdir(os.path.join(here, n)))
    for name in names:
        d = os.path.join(here, name)
        if not os.path.isdir(d):
            raise SystemExit(f"_find_specs: no such style directory {d!r}")
        for fn in os.listdir(d):
            if not (fn.startswith("spec_") and fn.endswith(".py")):
                continue
            mod = fn[:-3]
            try:
                sys.path.insert(0, d)
                m = __import__(mod)
                if style is None and abs(float(m.TOTAL) - dur) > 0.05:
                    continue
                out.append((f"{name}/{fn}", m))
            except Exception:
                pass
            finally:
                if d in sys.path:
                    sys.path.remove(d)
                sys.modules.pop(mod, None)
    return out


def intentional_freeze_windows(dur, style=None):
    """[(start, end), ...] global timestamps of freezes that are part of
    the design, not a defect -- e.g. layer/spec_layer.py's hook hard-cut
    to a frozen direct-edit photo. Empty when the matched spec(s) don't
    declare any (every style except layer, currently). Same ambiguity
    guard as end_card_start(): if `style` isn't given and duration-
    matched specs disagree, raise rather than silently pick one."""
    specs = _find_specs(dur, style=style)
    if not specs:
        return []
    found = [(label, tuple(map(tuple, getattr(m, "INTENTIONAL_FREEZE_WINDOWS", []))))
             for label, m in specs]
    distinct = {v for _, v in found}
    if len(distinct) > 1:
        raise SystemExit(
            f"intentional_freeze_windows: ambiguous specs for duration {dur}: {found} "
            "-- pass an explicit style to main()/the CLI instead of guessing by duration")
    return list(distinct.pop()) if distinct else []


def probe(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format",
                        "-of", "json", p], capture_output=True, text=True)
    return json.loads(r.stdout)


def main(path, want_dur=None, style=None):
    j = probe(path)
    v = next(s for s in j["streams"] if s["codec_type"] == "video")
    a = next((s for s in j["streams"] if s["codec_type"] == "audio"), None)
    dur = float(j["format"]["duration"])
    print(f"{path}")
    print(f"  {v['width']}x{v['height']} {eval(v['r_frame_rate']):.3f} fps  "
          f"{dur:.3f}s  {int(j['format']['size'])/1e6:.1f} MB")
    if a:
        print(f"  audio {a['codec_name']} {a['sample_rate']} Hz {a['channels']} ch")
    bad = []
    if want_dur is not None and abs(dur - want_dur) > 0.05:
        bad.append(f"duration {dur:.3f} != {want_dur}")
    if a and int(a["sample_rate"]) != 48000:
        bad.append(f"sample rate {a['sample_rate']} (loudnorm leaked its internal rate)")

    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af",
                        "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
                        "-f", "null", "-"], capture_output=True, text=True)
    m = re.findall(r"\{[^{}]*input_i[^{}]*\}", r.stderr, re.S)
    if m:
        d = json.loads(m[-1])
        print(f"  loudness {d['input_i']} LUFS   true peak {d['input_tp']} dBFS")
        if float(d["input_i"]) > -14.0 or float(d["input_i"]) < -19.0:
            bad.append(f"loudness {d['input_i']} outside -19..-14")
        if float(d["input_tp"]) > -0.8:
            bad.append(f"true peak {d['input_tp']} too hot")

    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-vf",
                        "blackdetect=d=0.25:pic_th=0.98,"
                        "freezedetect=n=0.001:d=0.7", "-af", "silencedetect=n=-52dB:d=0.7",
                        "-f", "null", "-"], capture_output=True, text=True)
    # the held end card is a deliberate freeze; ignore anything inside it.
    # Read from the matching spec's actual end-card start where possible,
    # since a fixed "last N seconds" guess goes stale the moment that
    # beat's duration changes (see end_card_start's docstring).
    excuse_from = end_card_start(dur, default=dur - 3.0, style=style)
    freeze_windows = intentional_freeze_windows(dur, style=style)
    for tag in ("black_start", "freeze_start", "silence_start"):
        hits = re.findall(tag + r":\s*([0-9.]+)", r.stderr)
        hits = [h for h in hits if float(h) < excuse_from]
        if tag == "freeze_start":
            hits = [h for h in hits
                    if not any(w0 <= float(h) < w1 for w0, w1 in freeze_windows)]
        print(f"  {tag:14s} {len(hits)}  {hits[:4]}")
        if hits:
            bad.append(f"{tag} at {hits[:3]}")
    print("  VERDICT:", "PASS" if not bad else "FAIL -- " + "; ".join(bad))
    return 0 if not bad else 1


if __name__ == "__main__":
    # third arg: optional style directory name (e.g. "layer") to skip
    # duration-based spec guessing entirely -- see _find_specs's docstring
    # for why that guess can no longer be trusted alone once two specs
    # share a TOTAL and diverge on intentional freeze windows.
    want = float(sys.argv[2]) if len(sys.argv) > 2 else None
    style_arg = sys.argv[3] if len(sys.argv) > 3 else None
    sys.exit(main(sys.argv[1], want, style=style_arg))
