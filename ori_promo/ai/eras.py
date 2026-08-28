#!/usr/bin/env python3
"""Era imagery for the single ORI film. PHOTOGRAPHIC, not diagrammatic.

The r75 films used holo.py to reduce every generated image to cyan linework.
The operator's verdict on that, 2026-08-27: "if you're gonna anchor something
well, you just made it a little fucking dot, not, like, make it a whole
family." He is right. A wireframe outline of a mill does not show anybody what
stood here. These prompts ask for real, lit, populated scenes.

TWO KINDS, because the operator asked for two different things.

  SUBJECT  -- people and animals on a plain background, to be MATTED OUT and
              composited onto the real quartzite in our own footage. This is
              "a family of pioneers sitting on the modern day rocks of Falls
              Park": they belong on the actual rock the camera saw.
  SCENE    -- a full replacement view of this place in another era, revealed
              behind the time seam. This is "how Falls Park used to look when
              the whole place was an ice age": the whole frame changes.

STANDING CONSTRAINT, UNCHANGED. This material is a VISUALISATION and never
evidence. It carries no date, no caption, no attribution, and the film says so
on screen. That is not bureaucratic caution -- this is going to VCs, and a
fabricated historical photograph is the one thing in a pitch that destroys
trust in everything beside it. Vivid and honest, not vivid and fake.

DEPICTION OF DAKOTA PEOPLE. Falls Park is in the traditional territory of the
Ochethi Sakowin. The prompts below ask for ordinary, dignified presence at the
river -- people standing, walking, looking at the falls. They deliberately do
NOT ask for ceremony, regalia as spectacle, conflict, or anything sacred, and
they name no band or nation, because the film cannot source those claims and
should not invent them. An interpretive centre would draw the line in the same
place.
"""
import os
import subprocess
import sys
import time
import urllib.parse

# Matches the plates: high summer, hard midday sun, pink Sioux quartzite.
LIGHT = ("bright midday summer sunlight, clear blue sky, hard directional "
         "light from the upper left, warm pink-red quartzite rock")

SUBJECT_STYLE = (
    "full colour photograph, sharp focus, natural skin tones, "
    "isolated on a plain flat white background, no shadow on the background, "
    "whole figures fully in frame including feet, no cropping, "
    "no text, no words, no watermark, no border")

SCENE_STYLE = (
    "wide cinematic landscape photograph, deep depth of field, natural light, "
    "photorealistic, no text, no words, no watermark, no border")

SHOTS = {
    # ---- SUBJECTS: matted and set on the real rock ----
    "fam": ("SUBJECT",
        "a frontier settler family of four in 1870s prairie clothing sitting "
        "and standing together on flat rock, father in a waistcoat and hat, "
        "mother in a long plain dress and bonnet, two children, calm and "
        "dignified, looking out to the right of frame, "
        + LIGHT),
    # A seated pair reads better on a low rock ledge than a standing row --
    # the operator asked for a family SITTING on the modern rocks.
    "fam2": ("SUBJECT",
        "a frontier settler mother in a long plain dress and bonnet sitting "
        "on flat rock beside her young son in braces and a cloth cap, both "
        "seated, resting, looking out to the right of frame, 1870s prairie "
        "clothing, calm and dignified, " + LIGHT),
    # First pass came back as three young women in white blouses and pink
    # skirts -- Central American dress, not northern plains, and a narrow
    # depiction. Rewritten to name the actual regional material culture
    # (tanned hide dress, quilled yoke, wool trade blanket, moccasins,
    # long braided hair) and to show a family group of mixed age rather
    # than a row of interchangeable figures. Still no ceremony, no regalia
    # as spectacle, no headdress, no weapons: an ordinary day at the river.
    "dak": ("SUBJECT",
        "a Dakota family of the northern Great Plains in the early "
        "nineteenth century standing on flat rock beside a river, a woman in "
        "a tanned deer hide dress with a beaded and quilled yoke, a man in "
        "hide leggings with a dark wool trade blanket over one shoulder, a "
        "child beside them, deerskin moccasins, long dark braided hair, no "
        "headdress, calm ordinary moment, dignified natural posture, looking "
        "out to the left of frame, " + LIGHT),
    "dak2": ("SUBJECT",
        "two Dakota women of the northern Great Plains in tanned deer hide "
        "dresses with beaded yokes and long braided hair kneeling and "
        "standing at the edge of a shallow rocky river, one filling a hide "
        "container with water, everyday work, dignified, no headdress, "
        + LIGHT),
    # THE ONE THAT WORKED was "dak": a standing group of mixed age, full
    # length, plain garments, everyone's feet visible. The operator picked
    # that frame out of the whole film and rejected the rest. "fam" failed
    # in the same film at a larger size -- a seated man whose lower body is
    # one shapeless mass of coat, next to two half-seated girls. So this is
    # the settler family rebuilt to dak's composition exactly: standing,
    # full length, feet down, nobody seated.
    "fam3": ("SUBJECT",
        "a frontier settler family of four standing together on flat rock "
        "beside a river in the 1870s, the father in a plain waistcoat, shirt "
        "sleeves and a wide brimmed hat, the mother in a long plain working "
        "dress and bonnet, two children standing beside them, all four "
        "standing upright and full length with their feet visible, calm and "
        "dignified, natural posture, looking out to the right of frame, "
        + LIGHT),
    "mam": ("SUBJECT",
        "a single woolly mammoth standing in deep snow, full body side view, "
        "long shaggy brown fur, curved tusks, overcast winter daylight"),

    # ---- SCENES: the whole frame becomes another era ----
    "ice": ("SCENE",
        "a wide frozen river gorge in the last ice age, a huge waterfall "
        "frozen into blue-white ice over broad ledges of pink-red quartzite "
        "rock, deep snow drifts, bare tundra, pale low winter sun, cold blue "
        "light, no people"),
    "mill": ("SCENE",
        "a tall seven storey stone flour mill beside a wide shallow waterfall "
        "on pink quartzite rock, nineteenth century industrial building with "
        "rows of square windows, water channel and stone dam, prairie beyond, "
        + LIGHT),
    "camp": ("SCENE",
        "a wide summer view of a shallow river falling over broad pink "
        "quartzite ledges onto open tallgrass prairie, a few conical hide "
        "lodges set back on the grass well away from the water, small distant "
        "figures, no modern buildings, " + LIGHT),
}

# THE GENERATOR IS NOT THE ONE THAT MADE THE LOCKED ASSETS ANY MORE.
# Measured 2026-08-28, and it is silent:
#   GET /models              -> ["sana"]           (flux is gone)
#   model=flux / sana / turbo / flux-realism, same prompt and seed
#                            -> BYTE-IDENTICAL output, md5 equal
# The `model=` parameter below is accepted and ignored. Every call since
# the swap has been served by sana while asking for flux and getting a 200,
# which is the worst shape of failure: no error, no warning, different
# pictures. dak_s17 / fam3_s3 / mam_s41 were generated when flux was real
# and CANNOT be reproduced or matched by this endpoint now.
# It also partly explains the two failed replacement passes recorded in
# one/spec_one.py. I put those down entirely to my prompts giving the model
# a scene; the prompts were a real fault, but I was also generating against
# a different model and could not see it.
# Image conditioning is gone too: model=kontext with an image= URL returns
# HTTP 500, so any two-stage "pose sheet then reference it" method is not
# executable here regardless of how it is prompted.
# CONSEQUENCE: replacement human figures have to come from somewhere else.
# ChatGPT generates images in this system already (docs/EXCHANGE_PIPELINE
# makes it the AI-image path); asking it for the finished PNGs is the
# supported route, not handing it a prompt for me to run.
BASE = "https://image.pollinations.ai/prompt/"


def gen(key, kind, prompt, seed, out="ai/era"):
    dst = f"{out}/{key}_s{seed}.jpg"
    if os.path.exists(dst) and os.path.getsize(dst) > 20000:
        return dst, "cached"
    style = SUBJECT_STYLE if kind == "SUBJECT" else SCENE_STYLE
    w, h = (1024, 1024) if kind == "SUBJECT" else (1280, 720)
    q = urllib.parse.quote(f"{prompt}, {style}", safe="")
    url = f"{BASE}{q}?width={w}&height={h}&nologo=true&seed={seed}&model=flux"
    r = subprocess.run(["curl", "-sS", "--max-time", "180", "-o", dst,
                        "-w", "%{http_code}", url], capture_output=True, text=True)
    code = r.stdout.strip()[-3:]
    ok = code == "200" and os.path.exists(dst) and os.path.getsize(dst) > 20000
    if not ok and os.path.exists(dst):
        os.remove(dst)
    return (dst if ok else None), code


if __name__ == "__main__":
    os.makedirs("ai/era", exist_ok=True)
    keys = sys.argv[1:] or list(SHOTS)
    for k in keys:
        kind, prompt = SHOTS[k]
        for seed in (3, 17, 41):
            p, code = gen(k, kind, prompt, seed)
            print(f"{k} {kind} seed={seed} -> {p or 'FAILED'} ({code})", flush=True)
            time.sleep(1.0)
    print("ERAS_DONE", flush=True)
