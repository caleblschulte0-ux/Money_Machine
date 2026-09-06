#!/usr/bin/env python3
"""
Barkly's sound effects, synthesised.

WHY THESE ARE SYNTHESISED AND NOT RECORDED. The app had NO sound at all -- no
`assets/sfx`, no playback path, nothing. Every tap, meal, dig and level-up was
silent while the dog himself talked in a fully recorded voice, which is a
strange thing for a phone game aimed at children. A synthesised starter set
that ships today beats a library nobody has licensed yet, and it makes the
SYSTEM real so replacing the audio later is a file swap.

WHAT THAT MEANS FOR WHOEVER READS THIS. I cannot hear them. Every sound below
is built from a description of the physical event -- a soft mallet, a coin, a
paw in earth -- and verified numerically: duration, peak level, no clipping,
and a spectral centroid in the band the description implies. That is not the
same as knowing it sounds good. They are deliberately plain, short and quiet so
that being wrong is cheap, and every one is a single line in SOUNDS below.

Design rules, so a replacement stays in family:
  - nothing over 420ms; a UI sound you notice twice is a UI sound you hate
  - peak 0.5 or below, and lower for anything that fires often
  - every envelope ends in silence (no clicks at the tail)
  - 16 kHz mono; these are toys, not music
"""
import math, os, struct, wave
import numpy as np

SR = 16000
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sfx')

def env(n, attack=0.005, decay=0.12, power=2.0):
    """Percussive envelope: fast in, curved out, ending at exactly zero."""
    a = max(1, int(attack * SR))
    d = max(1, n - a)
    return np.concatenate([np.linspace(0, 1, a), np.linspace(1, 0, d) ** power])

def tone(freq, n, kind='sine'):
    t = np.arange(n) / SR
    if kind == 'tri':
        return 2 * np.abs(2 * ((t * freq) % 1) - 1) - 1
    return np.sin(2 * math.pi * freq * t)

def noise(n, seed=0):
    return np.random.default_rng(seed).uniform(-1, 1, n)

def lowpass(x, cutoff, poles=1):
    """
    One pole is 6dB/octave, which is not a filter so much as a suggestion.

    The numeric check caught this: `eat` and `dig` are described as dull and
    muffled and came out at 2436Hz and 3172Hz spectral centroid -- BRIGHTER
    than the coin, which is supposed to be the sparkly one. Cascading the pole
    gives a real slope, and the numbers then agree with the words.
    """
    a = math.exp(-2 * math.pi * cutoff / SR)
    y = np.asarray(x, dtype=float)
    for _ in range(poles):
        out = np.empty_like(y); prev = 0.0
        for i, v in enumerate(y):
            prev = (1 - a) * v + a * prev
            out[i] = prev
        y = out
    return y

def secs(s): return int(s * SR)

def norm(x, peak):
    m = np.max(np.abs(x)) or 1.0
    return x / m * peak

# ---------------------------------------------------------------- the sounds
def s_tap():
    """A fingertip on a moulded plastic toy: a short mid click, no ring."""
    n = secs(0.055)
    x = lowpass(noise(n, 1), 2600, poles=2) * env(n, 0.001, decay=0.05, power=3.0)
    x += 0.5 * tone(520, n) * env(n, 0.001, power=4.0)
    return norm(x, 0.28)

def s_pop():
    """A panel opening. A rising blip, like a cork out of a bottle."""
    n = secs(0.12)
    t = np.arange(n) / SR
    sweep = np.sin(2 * math.pi * (330 + 520 * t / (n / SR)) * t)
    return norm(sweep * env(n, 0.004, power=2.4), 0.34)

def s_close():
    """The same idea falling, so open and close are a pair."""
    n = secs(0.11)
    t = np.arange(n) / SR
    sweep = np.sin(2 * math.pi * (620 - 330 * t / (n / SR)) * t)
    return norm(sweep * env(n, 0.004, power=2.6), 0.30)

def s_coin():
    """Two bright partials a fifth apart -- the shape every coin sound uses."""
    n = secs(0.20)
    x = tone(1245, n, 'tri') * env(n, 0.002, power=2.0)
    x += 0.7 * tone(1867, n, 'tri') * env(n, 0.002, power=3.0)
    return norm(x, 0.30)

def s_levelup():
    """Three ascending notes, a major triad. Longest sound in the set."""
    out = np.zeros(secs(0.42))
    for i, f in enumerate([523.25, 659.25, 783.99]):
        n = secs(0.20)
        seg = tone(f, n, 'tri') * env(n, 0.004, power=2.2)
        start = secs(0.09 * i)
        out[start:start + n] += seg * 0.8
    return norm(out, 0.42)

def s_eat():
    """Two soft muffled bites. Low, dull, no sparkle -- a mouth, not a machine."""
    out = np.zeros(secs(0.30))
    for i, start in enumerate([0.0, 0.15]):
        n = secs(0.11)
        seg = lowpass(noise(n, 10 + i), 700, poles=4) * env(n, 0.002, power=2.6)
        seg += 0.4 * tone(180 - 20 * i, n) * env(n, 0.002, power=3.0)
        s0 = secs(start)
        out[s0:s0 + n] += seg
    return norm(out, 0.30)

def s_dig():
    """A paw in loose earth: broadband, dull, two scoops."""
    out = np.zeros(secs(0.34))
    for i, start in enumerate([0.0, 0.17]):
        n = secs(0.15)
        seg = lowpass(noise(n, 20 + i), 1100, poles=3) * env(n, 0.006, power=1.8)
        s0 = secs(start)
        out[s0:s0 + n] += seg
    return norm(out, 0.26)

def s_arrive():
    """Walking into a new place. A soft filtered whoosh, no pitch."""
    n = secs(0.34)
    x = lowpass(noise(n, 30), 900, poles=3)
    shape = np.sin(np.linspace(0, math.pi, n)) ** 1.6
    return norm(x * shape, 0.22)

def s_nope():
    """A refusal. Low, short, and not a buzzer -- he is unimpressed, not wrong."""
    n = secs(0.16)
    t = np.arange(n) / SR
    x = np.sin(2 * math.pi * (200 - 60 * t / (n / SR)) * t)
    return norm(x * env(n, 0.004, power=2.0), 0.26)

SOUNDS = {
    'tap': s_tap, 'pop': s_pop, 'close': s_close, 'coin': s_coin,
    'levelup': s_levelup, 'eat': s_eat, 'dig': s_dig, 'arrive': s_arrive,
    'nope': s_nope,
}

def write(name, x):
    x = np.clip(x, -1, 1)
    pcm = (x * 32767).astype('<i2')
    path = os.path.join(OUT, f'{name}.wav')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return path, len(pcm)

def centroid(x):
    """Spectral centroid in Hz -- the 'brightness' number I check against intent."""
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    freqs = np.fft.rfftfreq(len(x), 1 / SR)
    return float((spec * freqs).sum() / max(spec.sum(), 1e-9))

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    total = 0
    print(f"{'sound':9} {'ms':>5} {'peak':>6} {'centroid':>9} {'KB':>6}")
    for name, fn in SOUNDS.items():
        x = fn()
        path, n = write(name, x)
        kb = os.path.getsize(path) / 1024
        total += kb
        print(f"{name:9} {n / SR * 1000:5.0f} {np.max(np.abs(x)):6.3f} {centroid(x):8.0f}Hz {kb:6.1f}")
        assert n / SR <= 0.42, f'{name} too long'
        assert np.max(np.abs(x)) <= 0.5, f'{name} too loud'
        assert abs(x[-1]) < 1e-6, f'{name} does not end in silence'
    print(f"{'':9} {'':5} {'':6} {'':9} {total:6.1f} KB total")
