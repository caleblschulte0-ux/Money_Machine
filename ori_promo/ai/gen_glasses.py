#!/usr/bin/env python3
"""Generate AR-glasses PRODUCT hero shots.

OPERATOR, v22: "I did not see any three d renderings of the glasses or any
cool glasses hero shots." Two earlier attempts (ai/product/glasses_flat.png,
glasses_flat3.png) were sent and rejected ("the glasses you sent me also
suck"), and three further attempts generated unwanted human faces despite
an explicit no-person prompt. This is a third attempt with much more
specific product-photography language (studio lighting, macro lens,
material callouts) and MORE candidates per prompt, so there is something
usable to actually cut into the film this time rather than another round
of routing the request elsewhere and shipping nothing.

No claim is made about these being real product photography -- they are
generated concept renders and go into the film labelled VISUALISATION,
same as every other generated image here.
"""
import os
import sys
import time
import urllib.parse
import urllib.request

OUT = os.path.dirname(os.path.abspath(__file__)) + "/product"

PROMPTS = {
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


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, p in PROMPTS.items():
        for seed in (5, 21, 44):
            dst = f"{OUT}/{name}_s{seed}.png"
            if os.path.exists(dst):
                print(name, seed, "exists"); continue
            url = ("https://image.pollinations.ai/prompt/" + urllib.parse.quote(p)
                   + f"?width=1920&height=1080&nologo=true&model=flux&seed={seed}")
            ok = False
            for attempt in range(3):
                try:
                    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                    data = urllib.request.urlopen(req, timeout=240).read()
                    if len(data) > 50000:
                        open(dst, "wb").write(data)
                        print(name, seed, "ok", len(data), flush=True)
                        ok = True
                        break
                    print(name, seed, "too small", len(data), flush=True)
                except Exception as e:
                    print(name, seed, "err", e, flush=True)
                time.sleep(4)
            if not ok:
                print(name, seed, "GAVE UP", flush=True)


if __name__ == "__main__":
    main()
