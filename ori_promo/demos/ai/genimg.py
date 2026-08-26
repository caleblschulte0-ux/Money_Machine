#!/usr/bin/env python3
"""Generate the CONTENT for the AR reconstruction plates in Demos 2 and 3.

FIRST ATTEMPT, AND WHY IT WAS THROWN OUT. The style string used to ask the
generator directly for "luminous cyan volumetric line reconstruction,
holographic wireframe, thin engineering linework, pure black background". It
ignored every word of it and returned moody cinematic renders: a night-lit
mill, a stone vault interior, a sci-fi light beam with an astronaut standing
in it, a modern tram. Not one was a wireframe, not one was on black, so none
could be composited and none of them met the rule that this material must be
obviously a visualisation.

So the division of labour changed, and it is better this way:

  the GENERATOR supplies CONTENT -- a clear, well lit, centred illustration of
  the right subject, and nothing about style;
  holo.py imposes the STYLE afterwards, in code.

The standing constraint on this project is that AR content is a VISUALISATION
and never evidence -- nothing may pass as a historical photograph, and no
date, caption or attribution may be asserted. Enforcing that with a transform
I control is strictly safer than enforcing it with a sentence a model is free
to ignore, which is exactly what it just did.

These are CANDIDATES. ChatGPT is better at this and its set should replace
them the moment ORI_AI_HANDOFF is reachable. Generating my own is not a
decision that ChatGPT's are unwanted -- it is refusing to let one Drive
permission hold two of five films at zero.
"""
import os
import subprocess
import sys
import time
import urllib.parse

STYLE = ("clean architectural illustration, whole subject centred and fully in "
         "frame, even daylight, plain uncluttered background, no text, no words, "
         "no lettering, no watermark, no border")

SHOTS = {
    # Subjects that are actually documented AT this site: the Queen Bee Mill
    # and its ruin, quartzite quarrying, the light rail that ran through the
    # park, the river over its rock shelf. No dates and no captions anywhere --
    # the film names materials and places, never a year.
    "A1": "a tall seven storey stone flour mill building beside a river, square "
          "windows in rows, pitched roof, three quarter front view, whole "
          "building in frame",
    # A2/A3/A5 first pass came back as an interior, a cliff-top fantasy
    # castle and a forest gorge. Rewritten to say OUTDOORS, say the shape, and
    # say the viewpoint.
    "A2": "an abandoned rectangular stone building standing outdoors in an open "
          "field, no roof, empty window openings, exterior three quarter view, "
          "whole building in frame, seen from outside",
    "A3": "an open air stone quarry with flat cut terraces and a tall wooden "
          "crane, rectangular cut blocks stacked on the ground, wide outdoor "
          "view under open sky",
    "A4": "a small early open sided electric streetcar on a single track, "
          "plain side view, whole vehicle in frame",
    "A5": "a wide shallow river spreading across a flat open rocky riverbed in "
          "low broad steps, seen from high above at an angle, open sky, no "
          "cliffs, no canyon, no forest",
    "A6": "a low stone dam with a long wooden flume channel carrying water to a "
          "mill wheel, side view",
    "A7": "a plain iron railing on a stone terrace overlooking a waterfall, "
          "empty, seen from behind the railing",
    "A8": "a straight-on cutaway section through the ground showing soil over "
          "broken rock over solid banded stone, diagram style",
    "A9": "a large wooden water wheel on the outside wall of a stone building, "
          "plain side view, whole wheel in frame",
    "A10": "a simple iron truss bridge crossing a river, plain side view, whole "
           "bridge in frame",
}

BASE = "https://image.pollinations.ai/prompt/"


def gen(key, prompt, seed, w=1280, h=768, out="gen"):
    dst = f"{out}/{key}_s{seed}.jpg"
    if os.path.exists(dst) and os.path.getsize(dst) > 20000:
        return dst, "cached"
    q = urllib.parse.quote(f"{prompt}, {STYLE}", safe="")
    url = f"{BASE}{q}?width={w}&height={h}&nologo=true&seed={seed}&model=flux"
    r = subprocess.run(["curl", "-sS", "--max-time", "150", "-o", dst,
                        "-w", "%{http_code}", url], capture_output=True, text=True)
    code = r.stdout.strip()[-3:]
    ok = code == "200" and os.path.exists(dst) and os.path.getsize(dst) > 20000
    if not ok and os.path.exists(dst):
        os.remove(dst)
    return (dst if ok else None), code


if __name__ == "__main__":
    os.makedirs("gen", exist_ok=True)
    log = open("genimg_progress.txt", "a", buffering=1)
    keys = sys.argv[1:] or list(SHOTS)
    for k in keys:
        for seed in (11, 27):
            p, code = gen(k, SHOTS[k], seed)
            line = f"{k} seed={seed} -> {p or 'FAILED'} ({code})"
            print(line, flush=True)
            log.write(line + "\n")
            time.sleep(1.5)
    log.write("DONE\n")
