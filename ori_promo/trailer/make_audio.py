#!/usr/bin/env python3
"""Audio for the ORI trailer: rewritten VO, real location ambience
lifted from the iPhone clips, synthesized foley (wind, fire, rumble,
UI tones) and a restrained score that builds by act."""
import asyncio
import subprocess
import json
import numpy as np
import wave
import os

SR = 44100
A = "trailer/audio"
os.makedirs(A, exist_ok=True)

VO_LINES = [
    ("v01", "Some of the best stories in America are standing right in front of you."),
    ("v02", "Falls Park. Sioux Falls, South Dakota. Ten thousand years of history — and almost none of it visible."),
    ("v03", "So we built glasses that can see it. Self-contained, all-day A R. No phone. No cables. Nothing added to the park."),
    ("v04", "Step into a viewing zone, and the place responds."),
    ("v05", "The Dakota knew these falls for generations."),
    ("v06", "Settlers raised a city around them in a single decade."),
    ("v07", "And twelve thousand years ago, this was the edge of the ice."),
    ("v08", "Everyone in your group sees the same moment, anchored to the same ground."),
    ("v09", "Falls Park is our beta. Any park, historic district, or heritage site can work the same way."),
    ("v10", "Open Range Interactive. The past, anchored to place."),
]


def gen_vo():
    import edge_tts

    async def run():
        durs = {}
        for name, text in VO_LINES:
            c = edge_tts.Communicate(text, "en-US-AndrewNeural", rate="+2%")
            await c.save(f"{A}/{name}.mp3")
            d = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                 "-of", "csv=p=0", f"{A}/{name}.mp3"],
                capture_output=True, text=True).stdout.strip()
            durs[name] = float(d)
            print(name, d)
        json.dump(durs, open(f"{A}/vo_durs.json", "w"))
    asyncio.run(run())


def extract_ambience():
    """Real location sound from the clips."""
    # falls roar (close): 6682
    subprocess.run(["ffmpeg", "-v", "error", "-ss", "14", "-t", "20",
                    "-i", "raw/IMG_6682.MOV", "-vn", "-ac", "1", "-ar", str(SR),
                    "-af", "highpass=f=60,lowpass=f=9000,loudnorm=I=-30",
                    f"{A}/amb_falls.wav", "-y"])
    # park ambience (distant falls + air): 6805
    subprocess.run(["ffmpeg", "-v", "error", "-ss", "20", "-t", "24",
                    "-i", "raw/IMG_6805.MOV", "-vn", "-ac", "1", "-ar", str(SR),
                    "-af", "highpass=f=80,lowpass=f=8000,loudnorm=I=-33",
                    f"{A}/amb_park.wav", "-y"])
    print("ambience extracted")


def _write(name, x, gain=1.0):
    x = np.clip(x * gain, -1, 1)
    with wave.open(f"{A}/{name}.wav", "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


def smooth_noise(n, cutoff=400):
    x = np.random.default_rng(7).standard_normal(n)
    k = np.ones(cutoff) / cutoff
    return np.convolve(x, k, mode="same")


def foley():
    t10 = np.arange(SR * 10) / SR
    # arctic wind: band-limited noise with slow gusts
    n = np.random.default_rng(3).standard_normal(len(t10))
    k = np.ones(30) / 30
    wind = np.convolve(n, k, mode="same")
    gust = 0.5 + 0.5 * np.clip(np.sin(2 * np.pi * 0.07 * t10) +
                               0.5 * np.sin(2 * np.pi * 0.19 * t10 + 1), -1, 1)
    _write("wind", wind * gust, 0.5)

    # fire crackle: sparse pops over ember hiss
    rng = np.random.default_rng(11)
    fire = np.convolve(rng.standard_normal(len(t10)),
                       np.ones(90) / 90, mode="same") * 0.25
    for _ in range(260):
        i = rng.integers(0, len(t10) - 900)
        env = np.exp(-np.linspace(0, 9, 900))
        fire[i:i + 900] += rng.standard_normal(900) * env * rng.uniform(0.2, 0.9)
    _write("fire", fire, 0.5)

    # mammoth presence: low swell + sub steps
    t6 = np.arange(SR * 6) / SR
    rumble = np.sin(2 * np.pi * 34 * t6) * np.exp(-((t6 - 2.2) / 1.6) ** 2)
    rumble += np.sin(2 * np.pi * 46 * t6) * np.exp(-((t6 - 2.4) / 1.4) ** 2) * 0.5
    for st in (3.4, 4.3, 5.1):
        i = int(st * SR)
        env = np.exp(-np.linspace(0, 14, 4000))
        rumble[i:i + 4000] += np.sin(2 * np.pi * 52 * np.arange(4000) / SR) * env * 0.7
    _write("rumble", rumble, 0.55)

    # UI: tiny two-note activation (soft sine, fast decay)
    tick = np.zeros(SR)
    for st, f0 in [(0.0, 660), (0.09, 880)]:
        i = int(st * SR)
        seg = np.sin(2 * np.pi * f0 * np.arange(5000) / SR)
        seg *= np.exp(-np.linspace(0, 8, 5000))
        tick[i:i + 5000] += seg * 0.5
    _write("tick", tick, 0.5)

    # materialize shimmer: filtered noise swell, very soft
    t2 = np.arange(int(SR * 1.6)) / SR
    sh = np.convolve(np.random.default_rng(5).standard_normal(len(t2)),
                     np.ones(12) / 12, mode="same")
    sh *= np.sin(np.pi * t2 / 1.6) ** 2
    _write("shimmer", sh, 0.22)
    print("foley done")


def score(total=84.0):
    """Restrained build: felt-piano figure over an air pad; a low pulse
    joins mid-film; resolves to a single held note under the end card."""
    n = int(SR * total)
    t = np.arange(n) / SR
    out = np.zeros(n)
    rng = np.random.default_rng(2)

    def env_ar(ns, a, r):
        e = np.ones(ns)
        an, rn = min(int(a * SR), ns // 2), min(int(r * SR), ns // 2)
        if an:
            e[:an] = np.linspace(0, 1, an) ** 1.5
        if rn:
            e[-rn:] *= np.linspace(1, 0, rn) ** 1.2
        return e

    def pluck(freq, start, dur=3.2, amp=0.06):
        ns = int(dur * SR)
        i = int(start * SR)
        if i + ns > n:
            ns = n - i
        tt = np.arange(ns) / SR
        s = np.zeros(ns)
        for h, a in [(1, 1.0), (2, 0.35), (3, 0.12), (4, 0.05)]:
            s += a * np.sin(2 * np.pi * freq * h * tt + rng.uniform(0, 6))
        s *= np.exp(-tt * 1.4) * amp
        out[i:i + ns] += s

    # D minor world. Sparse piano figure, one phrase every ~8s.
    D3, F3, A3, C4, D4, E4, F4, A4 = (146.83, 174.61, 220.0, 261.63,
                                      293.66, 329.63, 349.23, 440.0)
    phrases = [
        (2.0, [(0, D4), (1.4, A3), (2.6, F4)]),
        (10.0, [(0, D4), (1.4, C4), (2.8, A3)]),
        (18.0, [(0, F4), (1.2, E4), (2.4, D4), (4.0, A3)]),
        (27.0, [(0, D4), (1.6, F4), (3.0, A4)]),
        (35.0, [(0, C4), (1.4, D4), (2.8, F4)]),
        (43.0, [(0, A3), (1.2, D4), (2.6, E4), (4.2, F4)]),
        (52.0, [(0, D4), (1.5, A4), (3.2, F4)]),
        (60.0, [(0, F4), (1.4, E4), (2.9, D4)]),
        (67.0, [(0, A4), (2.0, F4), (4.0, D4)]),
        (75.0, [(0, D4)]),
    ]
    for st, notes in phrases:
        for off, f in notes:
            pluck(f, st + off)

    # air pad: detuned D drone, swells from act 2
    pad = np.zeros(n)
    for f0, det in [(D3, -0.3), (D3, 0.3), (A3, 0.2), (F3, -0.2)]:
        pad += np.sin(2 * np.pi * (f0 + det) * t + rng.uniform(0, 6))
    pad *= 0.018
    pad_gain = np.interp(t, [0, 12, 20, 48, 62, 72, 78, total],
                         [0.15, 0.3, 0.75, 1.0, 1.0, 0.65, 0.35, 0.2])
    out += pad * pad_gain

    # low pulse joins during the time-layer act
    pulse = np.zeros(n)
    for beat in np.arange(24, 62, 1.71):
        i = int(beat * SR)
        ns = min(int(0.5 * SR), n - i)
        tt = np.arange(ns) / SR
        pulse[i:i + ns] += np.sin(2 * np.pi * (D3 / 2) * tt) * \
            np.exp(-tt * 6) * 0.11
    out += pulse

    # gentle glue + fades
    out *= env_ar(n, 1.5, 4.0)
    out /= max(abs(out).max(), 1e-6) * 1.2
    _write("score", out, 0.9)
    print("score done")


if __name__ == "__main__":
    gen_vo()
    extract_ambience()
    foley()
    score()
