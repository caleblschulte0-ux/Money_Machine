#!/usr/bin/env python3
"""Regression tests for shotnorm. Each one pins a property that a plausible
"simplification" would silently break -- every one of these was a real bug
during the build, not a hypothetical."""
import numpy as np, sys
import shotnorm as SN

FAIL = []
def check(name, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + (f"   {detail}" if detail else ""))
    if not cond: FAIL.append(name)

def synth(black, white, cast=(0,0,0), seed=0, size=256):
    """A plate with a known black point, white point and per-channel cast."""
    rng = np.random.default_rng(seed)
    g = rng.random((size, size)).astype(np.float32)
    g = np.sort(g.ravel()).reshape(size, size)      # smooth ramp, stable percentiles
    im = np.stack([black + g*(white-black)]*3, -1).astype(np.float32)
    for c in range(3): im[..., c] += cast[c]
    return np.clip(im, 0, 1)

# 1. a hazy plate and a clean plate must converge on black and white
hazy  = synth(0.16, 0.95, seed=1)
clean = synth(0.02, 0.93, seed=2)
st = [SN.measure(hazy), SN.measure(clean)]
tgt, ps = SN.plan(st)
a, b = SN.apply(hazy, ps[0]), SN.apply(clean, ps[1])
ma, mb = SN.measure(a), SN.measure(b)
check("hazy and clean plates converge on a common black",
      abs(ma["lum_black"] - mb["lum_black"]) < 0.02,
      f"{ma['lum_black']:.4f} vs {mb['lum_black']:.4f} (was {st[0]['lum_black']:.4f} vs {st[1]['lum_black']:.4f})")
check("...and on a common white",
      abs(ma["lum_white"] - mb["lum_white"]) < 0.03,
      f"{ma['lum_white']:.4f} vs {mb['lum_white']:.4f}")

# 2. normalization must be able to do NOTHING to an in-range plate
one = synth(0.05, 0.94, seed=3)
st1 = [SN.measure(one)]
t1, p1 = SN.plan(st1)
o1 = SN.apply(one, p1[0])
check("a single in-range plate is left essentially alone",
      float(np.abs(o1 - one).mean()) < 0.02,
      f"mean abs delta {float(np.abs(o1-one).mean()):.4f}")

# 3. the median must NOT be matched -- composition survives.
#    NOTE: "dark" here must mean dark CONTENT, not underexposure. The first
#    version of this test scaled the whole plate by 0.55, black point included,
#    which is an underexposed shot -- and exposure matching is exactly what
#    r39 asked the stage to DO. The real property is that a shot which is dark
#    because of its subject, while sharing the same black and white points,
#    stays dark. (Falls: black 0.087 white 0.950 median 0.383, against river
#    black 0.030 white 0.932 median 0.679.)
def content_dark(black, white, med_frac, seed):
    """Same black and white points, but most of the frame sits low."""
    rng = np.random.default_rng(seed)
    g = np.sort(rng.random(256*256).astype(np.float32)) ** (1.0/med_frac)
    g = g.reshape(256, 256)
    return np.clip(np.stack([black + g*(white-black)]*3, -1), 0, 1)
dark  = content_dark(0.03, 0.93, 0.45, 4)     # median low, endpoints normal
bright= content_dark(0.03, 0.93, 2.20, 5)     # median high, same endpoints
st2 = [SN.measure(dark), SN.measure(bright)]
t2, p2 = SN.plan(st2)
od, ob = SN.apply(dark, p2[0]), SN.apply(bright, p2[1])
gap_before = abs(st2[0]["lum_med"] - st2[1]["lum_med"])
gap_after  = abs(SN.measure(od)["lum_med"] - SN.measure(ob)["lum_med"])
check("a dark shot stays darker than a bright one (median NOT matched)",
      gap_after > gap_before * 0.5,
      f"median gap {gap_before:.3f} -> {gap_after:.3f}")

# 4. the soft floor must not crush shadows to a flat black
crushy = synth(0.20, 0.95, seed=6)
stc = [SN.measure(crushy)]
tc, pc = SN.plan(stc)
oc = SN.apply(crushy, pc[0])
crushed = float((oc.max(2) <= 0.004).mean())
check("veil removal does not crush shadows onto a flat black",
      crushed < 0.01, f"{crushed*100:.3f}% of frame at floor")

# 5. highlight hue must survive a large veil subtraction.
#    NOTE: the cast must NOT be uniform over the plate. The first version put
#    it on every pixel including the blacks, so the per-channel black
#    subtraction removed exactly that cast by design -- the test was asking the
#    stage not to do its job. Real veiling glare leaves the blacks near-neutral
#    while compressing the ratios of bright pixels, so build that: neutral
#    blacks, blue-biased highlights, big neutral veil.
def sky_plate(black, white, seed):
    rng = np.random.default_rng(seed)
    g = np.sort(rng.random(256*256).astype(np.float32)).reshape(256, 256)
    im = np.stack([black + g*(white-black)]*3, -1).astype(np.float32)
    hi = np.clip((g - 0.55) / 0.45, 0, 1)          # only the bright end
    im[..., 0] += 0.10 * hi                         # B up
    im[..., 2] -= 0.06 * hi                         # R down
    return np.clip(im, 0, 1)
sky = sky_plate(0.16, 0.90, 7)   # neutral blacks, blue-biased highlights
sts = [SN.measure(sky)]
ts, psy = SN.plan(sts)
osky = SN.apply(sky, psy[0])
def hi_ratio(im):
    l = 0.114*im[...,0] + 0.587*im[...,1] + 0.299*im[...,2]
    m = l > np.percentile(l, 90)
    px = im[m]
    return float(px[:,0].mean() - px[:,2].mean())      # B minus R
before, after = hi_ratio(sky), hi_ratio(osky)
check("highlight B-R ratio survives veil removal (sky keeps its blue)",
      after > before * 0.6,
      f"B-R {before:+.4f} -> {after:+.4f}")

# 6. delivered region, not whole plate
tall = np.zeros((1920, 1080, 3), np.float32); tall[:400] = 0.95   # bright top band
reg = SN.deliver_region(tall)
check("deliver_region crops a portrait plate to the delivery aspect",
      abs(reg.shape[1]/reg.shape[0] - 16/9) < 0.01,
      f"{reg.shape[1]}x{reg.shape[0]}")
check("...and excludes content outside the delivered band",
      float(reg.mean()) < float(tall.mean()),
      f"region mean {float(reg.mean()):.4f} vs plate {float(tall.mean()):.4f}")

print()
if FAIL:
    print(f"{len(FAIL)} FAILED: " + ", ".join(FAIL)); sys.exit(1)
print("all shotnorm properties hold")
