#!/usr/bin/env python3
"""Generate tiny Barkly UI/game-feel SFX using Python's standard library only.

These are production-study sounds, not locked final audio. The point is to have
free, reproducible audio prototypes for timing/juice while art direction moves.
"""
from __future__ import annotations

import argparse
import math
import random
import struct
import wave
from pathlib import Path

RATE = 44_100
random.seed(1337)


def env(t: float, duration: float, attack=0.01, release=0.12) -> float:
    if t < attack:
        return t / max(attack, 1e-6)
    if t > duration - release:
        return max(0.0, (duration - t) / max(release, 1e-6))
    return 1.0


def tone(t: float, hz: float, phase=0.0) -> float:
    return math.sin(2 * math.pi * hz * t + phase)


def write_wav(path: Path, duration: float, fn) -> None:
    frames = []
    for i in range(int(RATE * duration)):
        t = i / RATE
        s = max(-1.0, min(1.0, fn(t, duration)))
        frames.append(struct.pack('<h', int(s * 32767)))
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(b''.join(frames))


def button_pop(t, d):
    pitch = 230 * (1.0 - 0.25 * t / d)
    click = tone(t, 1500) * math.exp(-t * 48)
    body = tone(t, pitch) * env(t, d, 0.004, 0.07)
    return (body * 0.55 + click * 0.22) * 0.72


def toy_thud(t, d):
    pitch = 145 - 85 * (t / d)
    body = tone(t, pitch) * math.exp(-t * 11)
    noise = (random.random() * 2 - 1) * math.exp(-t * 36)
    return body * 0.5 + noise * 0.08


def coin_chime(t, d):
    notes = [(880, 0.0), (1320, 0.055), (1760, 0.11)]
    s = 0.0
    for hz, start in notes:
        if t >= start:
            local = t - start
            s += tone(local, hz) * math.exp(-local * 8.5)
            s += tone(local, hz * 2.01) * math.exp(-local * 15) * 0.18
    return s * 0.28


def reward_bloom(t, d):
    base = 523.25
    notes = [(base, 0.0), (base * 1.25, 0.07), (base * 1.5, 0.14), (base * 2.0, 0.23)]
    s = 0.0
    for hz, start in notes:
        if t >= start:
            local = t - start
            s += tone(local, hz) * math.exp(-local * 5.5)
            s += tone(local, hz * 2) * math.exp(-local * 10) * 0.12
    shimmer = (random.random() * 2 - 1) * math.exp(-max(0, t - 0.2) * 8) if t > 0.2 else 0
    return s * 0.19 + shimmer * 0.025


def soft_whoosh(t, d):
    center = math.sin(math.pi * min(1, t / d))
    noise = random.random() * 2 - 1
    wobble = tone(t, 180 + 120 * t / d) * 0.16
    return (noise * 0.13 + wobble) * center * env(t, d, 0.04, 0.08)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('out', nargs='?', default='art-review/sfx-lab')
    args = p.parse_args()
    out = Path(args.out)
    sounds = [
        ('button-pop.wav', 0.15, button_pop),
        ('toy-thud.wav', 0.24, toy_thud),
        ('coin-chime.wav', 0.48, coin_chime),
        ('reward-bloom.wav', 0.82, reward_bloom),
        ('soft-whoosh.wav', 0.36, soft_whoosh),
    ]
    for name, duration, fn in sounds:
        write_wav(out / name, duration, fn)
    (out / 'README.txt').write_text(
        'Barkly procedural SFX studies\n\n'
        'These are free/reproducible timing and feel prototypes, not final locked sound design.\n'
        'button-pop: compact Talk/Type and HUD press\n'
        'toy-thud: care object landing / tactile prop response\n'
        'coin-chime: currency pickup\n'
        'reward-bloom: unlock/reward ceremony\n'
        'soft-whoosh: panel/scene transition layer\n',
        encoding='utf-8',
    )
    print(f'generated {len(sounds)} free SFX studies in {out}')


if __name__ == '__main__':
    main()
