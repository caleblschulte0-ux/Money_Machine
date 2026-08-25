#!/usr/bin/env python3
"""Native delivery integrity: refuse to upscale a plate into the frame.

r39 passed criterion 1 -- "native delivery integrity" -- off the r38 contact
sheet. The contact sheet could not show what the arithmetic does: shot 0's
source (IMG_6686) is a 1920x1080 stream carrying rotation -90, so it DISPLAYS
as 1080x1920 portrait. The 16:9 band that a landscape delivery takes from it is
1080x608 real pixels, blown up to 1920x1080 -- a 1.78x upscale delivering 32%
of the pixel count. It passed a visual review because upscaled rock at contact
-sheet size still looks like rock.

A rotated portrait source is the trap here: every probe reports 1920x1080 and
looks fine until the rotation is applied. Check the DISPLAY geometry, and check
the band the delivery aspect actually takes from it.
"""
import subprocess, sys, json

def display_size(path):
    """Width/height AFTER rotation metadata is applied."""
    out = subprocess.run(["ffprobe","-v","error","-select_streams","v:0",
        "-show_entries","stream=width,height:stream_side_data=rotation",
        "-of","json",path], capture_output=True, text=True).stdout
    st = json.loads(out)["streams"][0]
    w, h = int(st["width"]), int(st["height"])
    rot = 0
    for sd in st.get("side_data_list", []):
        if "rotation" in sd:
            rot = int(float(sd["rotation"]))
    if abs(rot) % 180 == 90:
        w, h = h, w
    return w, h, rot

def check(path, out_w=1920, out_h=1080):
    w, h, rot = display_size(path)
    aspect = out_w / out_h
    if w / h < aspect:
        dw = w; dh = int(round(w / aspect))
    else:
        dh = h; dw = int(round(h * aspect))
    up = out_w / dw
    return {"path": path, "display": f"{w}x{h}", "rotation": rot,
            "delivered": f"{dw}x{dh}", "upscale": round(up, 3),
            "pixel_pct": round(100.0 * (dw*dh) / (out_w*out_h), 1),
            "ok": up <= 1.01}

if __name__ == "__main__":
    bad = 0
    for p in sys.argv[1:]:
        try:
            r = check(p)
        except Exception as e:
            print(f"{p}: unreadable ({e})"); continue
        flag = "" if r["ok"] else f"   <-- UPSCALE {r['upscale']}x, {r['pixel_pct']}% of frame pixels"
        rot = f" rot={r['rotation']}" if r["rotation"] else ""
        print(f"{p.split('/')[-1]:16s} display {r['display']:>9s}{rot:8s} "
              f"delivered {r['delivered']:>9s}{flag}")
        bad += 0 if r["ok"] else 1
    print(f"\n{bad} source(s) would be upscaled into a 1920x1080 delivery.")
    sys.exit(1 if bad else 0)
