#!/usr/bin/env python3
"""Generate the glasses PRODUCT hero shot for the `hero` beat.

OPERATOR, v22 and again much later: "I did not see any three d renderings
of the glasses or any cool glasses hero shots." Two early attempts
(ai/product/glasses_flat.png, glasses_flat3.png) were sent and rejected
("the glasses you sent me also suck"). A third attempt, FAILED_PROMPTS
below, tried much more specific product-photography language across three
distinct styles and nine total generations -- and every single one came
back as a close-up portrait of a person wearing glasses, not the object.

THE BUG WAS IN THIS SCRIPT, NOT JUST THE PROMPTS. The original run
rejected every result with a `len(data) > 50000` check calibrated for a
1920x1080 image, and every response here came back at pollinations'
smaller default resolution (1024x576, ignoring the width/height query
params) -- so every attempt was silently thrown away as "too small" and
reported as a service failure, when they were valid, decodable images the
whole time. Nobody looked at one until the tenth round of asking. Fixed:
validate by actually opening the image and checking its real dimensions,
not by trusting a byte count.

THE FACE PROBLEM, ONCE ACTUALLY DIAGNOSED: pollinations' free flux
endpoint keys hard off the word "glasses" toward its portrait training
data, regardless of how explicitly the prompt says "no person, no face,
no hands" -- all three FAILED_PROMPTS styles hit this, at every seed
tried. The fix was not a better negative clause, it was a different
CAMERA ANGLE. FLATLAY_PROMPT below is a top-down product shot: there is
nowhere in that composition's own geometry for a face to fit. Four seeds
of it, four clean results, zero people. Seed 12 is the one committed to
ai/hero/glasses_hero_s12.png and read by ai/hero/build_hero_plate.py.

No claim is made about this being real product photography -- it is a
generated concept render and carries the VISUALISATION tag in-film, same
as every other generated image here. It is also deliberately UNBRANDED,
ordinary-looking eyewear, not a distinctive sci-fi design: Open Range
Interactive licenses software onto glasses it does not design (see
one/vo_one.py's `prod` line), so a striking hardware look would invent a
product this company does not have.
"""
import os
import time
import urllib.parse
import urllib.request

_HERE = os.path.dirname(os.path.abspath(__file__))
OUT_FAILED = _HERE + "/product"
OUT_HERO = _HERE + "/hero"

# ---- THREE STYLES, NINE GENERATIONS, ALL FAILED THE SAME WAY. Kept as the
# honest record, not deleted -- same discipline as every other retired
# attempt in this project (ai/gen_ai.py, ai/gen_ice.py). Every one of
# these, at every seed, returned a portrait of a person wearing glasses
# despite the explicit "no person, no hands, no face" clause in each.
FAILED_PROMPTS = {
    "hero_a": (
        "professional studio product photography of a single pair of sleek "
        "black smart glasses, matte titanium frame, small integrated camera "
        "lens on the right temple, floating in dark space, dramatic rim "
        "lighting, soft reflections, high detail, commercial tech product "
        "shot, no person, no hands, no face, no body, isolated object only, "
        "shallow depth of field, 85mm macro lens, dark charcoal gradient "
        "background"),
    "hero_b": (
        "close up studio photo of modern AR smart glasses on a dark glass "
        "surface, minimalist matte black frame, subtle blue accent light on "
        "the hinge, single small camera module on the temple arm, "
        "reflections on the surface below, moody dramatic lighting, "
        "high-end consumer electronics advertisement, no person, no hands, "
        "product only, empty background"),
    "hero_c": (
        "cinematic 3d render of futuristic augmented reality glasses, "
        "brushed metal and matte black frame, thin profile, small sensor "
        "on the temple, floating and slightly rotated in three quarter "
        "view, volumetric light rays, dark studio background, octane "
        "render, product visualization, no person, no hands, no face"),
}

# ---- THE WORKING PROMPT, v28. A flat lay / top-down angle: the camera
# looks straight down at a tabletop, which has no natural place for a
# face to occupy, unlike every FAILED_PROMPTS composition above (all
# roughly eye-level, exactly where the model's portrait bias could latch
# on). Seeds 3, 12, 19, 30 all came back clean; 12 is the one chosen for
# its lighting and the phone-corner context object.
FLATLAY_PROMPT = (
    "flat lay product photography from directly above, a single pair of "
    "modern sleek smart glasses with a slim black frame and a small camera "
    "sensor on the temple arm, resting alone on a dark matte charcoal "
    "surface, dramatic side rim lighting, soft shadow, top-down overhead "
    "angle, no case, no box, no person, no body, no hand, no face, no "
    "organism, empty minimal background, studio lighting, commercial "
    "catalog photo, object only, high detail")

HERO_SEEDS = (3, 12, 19, 30)
CHOSEN_SEED = 12


def _fetch(prompt, seed, width=1920, height=1080):
    url = ("https://image.pollinations.ai/prompt/" + urllib.parse.quote(prompt)
           + f"?width={width}&height={height}&nologo=true&model=flux&seed={seed}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=240).read()


def _valid_image(data, min_side=480):
    """Open it and check real dimensions -- NOT a raw byte-count guess.

    The byte-count heuristic this file used to use (>50000) was tuned for
    a 1920x1080 response and silently discarded nine perfectly valid,
    smaller (1024x576) images across two sessions, each one logged as
    "too small" and reported upstream as a service outage. It was not
    down; every response was a real, decodable JPEG the whole time.
    """
    try:
        from PIL import Image
        import io
        im = Image.open(io.BytesIO(data))
        im.verify()
        return min(im.size) >= min_side
    except Exception:
        return False


def _download(prompt, seed, dst, width=1920, height=1080):
    if os.path.exists(dst):
        print(os.path.basename(dst), "exists")
        return True
    for attempt in range(3):
        try:
            data = _fetch(prompt, seed, width, height)
            if _valid_image(data):
                open(dst, "wb").write(data)
                print(os.path.basename(dst), "ok", len(data), flush=True)
                return True
            print(os.path.basename(dst), "decoded but too small/invalid",
                  len(data), flush=True)
        except Exception as e:
            print(os.path.basename(dst), "err", e, flush=True)
        time.sleep(4)
    print(os.path.basename(dst), "GAVE UP", flush=True)
    return False


def gen_failed_record():
    """Reproduces the nine historical failures, for the record only --
    not part of the normal build path."""
    os.makedirs(OUT_FAILED, exist_ok=True)
    for name, p in FAILED_PROMPTS.items():
        for seed in (5, 21, 44):
            _download(p, seed, f"{OUT_FAILED}/{name}_s{seed}.png")


def gen_hero(seed=CHOSEN_SEED):
    """The actual build path: regenerate ai/hero/glasses_hero_s{seed}.png."""
    os.makedirs(OUT_HERO, exist_ok=True)
    dst = f"{OUT_HERO}/glasses_hero_s{seed}.png"
    _download(FLATLAY_PROMPT, seed, dst)
    return dst


def main():
    gen_hero(CHOSEN_SEED)


if __name__ == "__main__":
    main()
