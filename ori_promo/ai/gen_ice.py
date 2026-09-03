#!/usr/bin/env python3
"""Generate an ICE-AGE FALLS PARK plate.

OPERATOR, on v21: "you did not fix the ice age at all. It still looks like
shit."

He is right, and the reason is structural, not a tuning problem. The `ice`
beat has always been the SUMMER plate with a procedural cold grade on it
(desaturate, push blue, key snow onto flat lit surfaces, fog the distance).
That can make a summer photograph look cold. It cannot make it look like
an ice age, because the geometry underneath is still a mown lawn, a car
park, full deciduous canopy and a running river -- and the operator has
actually stood at Falls Park in winter, so he is comparing it against the
real thing.

So this generates a real plate instead of grading a fake one. The prompts
name the SPECIFIC features of this place (pink Sioux quartzite ledges, the
stepped falls, the river valley) so it reads as THIS place under ice
rather than as generic stock winter. It goes into the film labelled
VISUALISATION like every other generated image here -- never as
documentary footage of the park.
"""
import os
import sys
import time
import urllib.parse
import urllib.request

OUT = os.path.dirname(os.path.abspath(__file__)) + "/ice"

PROMPTS = {
    # the wide valley, which is the shot he is actually objecting to
    "iceage_wide": (
        "Pleistocene ice age river valley in winter, massive glacial ice sheet "
        "and deep snow covering stepped pink quartzite rock ledges, a wide "
        "frozen waterfall with hanging icicles and blue ice, bare frozen "
        "cottonwood trees, drifting snow, low pale winter sun, heavy overcast "
        "sky, no people, no buildings, no modern objects, photorealistic "
        "cinematic wide landscape photograph, muted cold palette"),
    "iceage_wide2": (
        "Frozen prehistoric river gorge under deep snow, pink and grey "
        "quartzite rock shelves layered under ice, partially frozen waterfall "
        "with thick blue ice formations, snow drifts, bare trees on the far "
        "bank, flat grey winter light, glacial haze in the distance, no "
        "people, no buildings, photorealistic cinematic landscape"),
    "iceage_wide3": (
        "Late Pleistocene landscape, a broad valley of snow-covered pink "
        "quartzite rock terraces beside a frozen river, ice-covered cascades, "
        "wind-scoured snow, distant glacier edge on the horizon, pale "
        "low-angle winter sunlight, overcast, no people, no modern structures, "
        "photorealistic cinematic wide shot, natural colour"),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, p in PROMPTS.items():
        for seed in (3, 11):
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
