#!/usr/bin/env python3
"""FILM C r56: sound.

r55: "sparse punctuation sound and an engineering/system rhythm rather than
trailer music", "-16 LUFS, 48 kHz, true peak no higher than -1 dBFS",
"Preserve designed silence between events, but include enough real location
texture that silence does not read as a broken track."

Two layers only:
  BED   the real location, from the same clips the picture uses, heavily
        low-passed and held low. It is what stops the designed silence from
        reading as a dead track, and it is honest -- it is the place.
  MARKS short synthetic punctuation on the beat boundaries. Not music. A
        low wooden tick per rule, a slightly heavier one for the gate, and a
        single low swell under the payoff.

48 kHz is set explicitly. loudnorm runs at 192 kHz internally and hands that
rate downstream, which is how v1 of every film in this project shipped 96 kHz
AAC without anyone noticing.
"""
import os, sys, subprocess, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from sourcesC import BEATS, TOTAL

SR = 48000
RAWD = "../raw"
OUT = "outC"


def bed():
    """Location texture from the picture's own sources, joined at the cuts."""
    ins, filt, labs = [], [], []
    for i, (beat, clip, tin, st, d, why) in enumerate(BEATS):
        ins += ["-ss", f"{tin}", "-t", f"{d:.2f}", "-i", f"{RAWD}/IMG_{clip}.MOV"]
        filt.append(f"[{i}:a]atrim=0:{d:.2f},asetpts=N/SR/TB,"
                    f"afade=in:st=0:d=0.25,afade=out:st={d-0.25:.2f}:d=0.25[s{i}]")
        labs.append(f"[s{i}]")
    f = (";".join(filt) + ";" + "".join(labs) +
         f"concat=n={len(BEATS)}:v=0:a=1,"
         "highpass=f=70,lowpass=f=2400,afftdn=nr=14:nf=-38,"
         "acompressor=threshold=0.05:ratio=4:attack=40:release=600,"
         f"volume=0.72,afade=in:st=0:d=1.2,afade=out:st={TOTAL-2.4:.2f}:d=2.4[out]")
    subprocess.run(["ffmpeg","-v","error","-y"] + ins +
                   ["-filter_complex", f, "-map","[out]","-ac","2","-ar",str(SR),
                    f"{OUT}/_bed.wav"], check=True)


def _tick(n, f0, f1, amp, sharp=6.0):
    t = np.arange(n)/SR
    env = np.exp(-t*sharp)
    fr = f0 + (f1-f0)*np.exp(-t*9.0)
    return (amp*env*np.sin(2*np.pi*np.cumsum(fr)/SR)).astype(np.float32)


def marks():
    """One mark per beat boundary. Sparse by design."""
    n = int(TOTAL*SR) + SR
    a = np.zeros(n, np.float32)
    def put(at, sig):
        i = int(at*SR)
        a[i:i+len(sig)] += sig[:max(0, n-i)]
    for beat, clip, tin, st, d, why in BEATS:
        if beat == "open":
            put(0.10, _tick(int(0.42*SR), 150, 78, 0.30, 7.0))
            put(0.95, _tick(int(0.24*SR), 300, 190, 0.10, 13.0))
        elif beat.startswith("r"):
            put(st,        _tick(int(0.36*SR), 128, 72, 0.24, 8.0))
            put(st + 0.72, _tick(int(0.18*SR), 320, 232, 0.075, 16.0))
            if beat == "r05":                      # the gate is heavier
                for i in range(4):
                    put(st + 2.1 + i*0.28, _tick(int(0.14*SR), 400, 300, 0.055, 20.0))
                put(st + 4.0, _tick(int(0.60*SR), 104, 58, 0.30, 5.0))
        elif beat == "sys":
            for i in range(6):
                put(st + 0.35 + i*0.20, _tick(int(0.16*SR), 350, 262, 0.06, 18.0))
            put(st + 2.1, _tick(int(0.90*SR), 116, 62, 0.34, 3.4))
            # one low swell under the payoff -- not a music cue, a single tone
            L = int(3.2*SR); t = np.arange(L)/SR
            env = np.minimum(t/1.1, 1.0) * np.exp(-np.maximum(0, t-1.4)*1.5)
            put(st + 2.0, (0.10*env*np.sin(2*np.pi*58*t)).astype(np.float32))
        elif beat == "end":
            put(st + 0.30, _tick(int(0.52*SR), 132, 74, 0.22, 6.0))
    a = a[:int(TOTAL*SR)]
    st = np.stack([a, a], 1)
    import wave
    with wave.open(f"{OUT}/_marks.wav", "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(st, -1, 1)*32767).astype(np.int16).tobytes())


def master(picture, dst):
    # The marks are short transients over a quiet bed, so the mix measures
    # loud in PEAK and quiet in INTEGRATED loudness. Left alone, loudnorm's
    # true-peak ceiling caps the gain long before -16 LUFS -- the first master
    # landed at -18.3. A limiter on the mix bus brings the transient peaks down
    # so the whole programme can sit where r55 asked, without compressing the
    # designed silence into mush.
    mix = ("[1:a][2:a]amix=inputs=2:normalize=0,"
           "alimiter=limit=0.72:attack=4:release=90:level=disabled")
    p = subprocess.run(["ffmpeg","-hide_banner","-nostats","-i",picture,
        "-i",f"{OUT}/_bed.wav","-i",f"{OUT}/_marks.wav","-filter_complex",
        mix + ",loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[a]",
        "-map","[a]","-f","null","-"], capture_output=True, text=True)
    m = re.findall(r"\{[^{}]*input_i[^{}]*\}", p.stderr, re.S)
    if not m: sys.exit(p.stderr[-2500:])
    d = json.loads(m[-1]); print("  measured", d["input_i"], d["input_tp"], d["input_lra"])
    subprocess.run(["ffmpeg","-v","error","-y","-i",picture,
        "-i",f"{OUT}/_bed.wav","-i",f"{OUT}/_marks.wav","-filter_complex",
        mix + (f",loudnorm=I=-16:TP=-1.5:LRA=11:linear=true:measured_I={d['input_i']}:"
               f"measured_TP={d['input_tp']}:measured_LRA={d['input_lra']}:"
               f"measured_thresh={d['input_thresh']},aresample={SR}[a]"),
        "-map","0:v","-map","[a]","-c:v","copy","-c:a","aac","-b:a","192k",
        "-ar",str(SR),"-movflags","+faststart", dst], check=True)


if __name__ == "__main__":
    bed(); print("  bed", flush=True)
    marks(); print("  marks", flush=True)
