/*
 * IS THIS CHANGE VISIBLE, OR AM I ABOUT TO WASTE SOMEBODY'S ATTENTION?
 *
 * Twice in one session the operator was sent a before/after and answered "I
 * can't really even tell the difference". Both times hours had gone into the
 * change. This exists so that question gets answered before he has to answer
 * it.
 *
 * IT DOES NOT RETURN A VERDICT, and the reason is the point. Calibrated
 * against four changes whose answer was already known:
 *
 *   change                          pixels moved   mean   range   hue
 *   timid camera (he could NOT see)     31.8%       0.3     1.3    0.5
 *   bold camera + near plane (he did)      -        2.5    13.3    1.1
 *   scene lighting, beach at 23:00         -        0.1     0.9    0.1
 *   sky fix, park at 08:00                 -        0.4     5.3    4.2
 *
 * No single number separates those. The timid camera moved a THIRD of the
 * frame and was invisible, because a geometric shift moves every pixel while
 * leaving the impression identical. The lighting change reads as almost
 * nothing whole-frame and is obvious on screen, because it lands entirely on
 * the one thing you are looking at. A tool that scored either of those with a
 * confident number would be exactly the kind of instrument that produced four
 * wrong measurements in the session that prompted this file.
 *
 * So it reports, splits the frame into regions, and WRITES A CROP OF THE MOST
 * CHANGED AREA as before|after. The output is not a score. The output is a
 * picture, and the rule it enforces is: look at that picture, and if the
 * difference is not obvious in it, do not send it to anyone.
 *
 *   node scripts/visible-change.mjs before.png after.png
 */
import { existsSync } from 'fs';
import { execFileSync } from 'child_process';

const [before, after, out = '/tmp/visible-change.png'] = process.argv.slice(2);
if (!before || !after) {
  console.error('usage: node scripts/visible-change.mjs <before.png> <after.png>');
  process.exit(2);
}
for (const f of [before, after]) {
  if (!existsSync(f)) {
    console.error(`no such capture: ${f}`);
    process.exit(2);
  }
}

/*
 * The measurement runs in Python because Pillow is already the image tool in
 * this repo and hand-rolling PNG decode in Node is how the item test ended up
 * with its own inflate loop. One decoder, and it is not this file's job.
 */
const script = `
import sys
from PIL import Image
a = Image.open(sys.argv[1]).convert('RGB')
b = Image.open(sys.argv[2]).convert('RGB')
if a.size != b.size:
    b = b.resize(a.size)
w, h = a.size
pa, pb = a.load(), b.load()

# Roughly perceptual: weight the channels the way luminance does, and count a
# pixel as changed only past a just-noticeable step. Below about 3 of 255 on a
# phone screen in daylight, nobody is seeing it.
JND = 3.0
bands = [[0, 0] for _ in range(3)]
changed = 0
total = 0
strength = 0.0
for y in range(0, h, 2):
    band = min(2, (y * 3) // h)
    for x in range(0, w, 2):
        r1, g1, b1 = pa[x, y]
        r2, g2, b2 = pb[x, y]
        d = (0.2126 * abs(r1 - r2) + 0.7152 * abs(g1 - g2) + 0.0722 * abs(b1 - b2))
        total += 1
        bands[band][1] += 1
        if d >= JND:
            changed += 1
            strength += d
            bands[band][0] += 1
pct = changed / max(1, total) * 100
print(f"CHANGED   {pct:.1f}% of the frame moved past a just-noticeable step")
print(f"STRENGTH  {strength / max(1, changed):.1f} of 255 where it changed")
names = ['top', 'middle', 'bottom']
worst = (0.0, 0)
for i, (c, t) in enumerate(bands):
    share = c / max(1, t) * 100
    print(f"  {names[i]:7s} {share:5.1f}%")
    if share > worst[0]:
        worst = (share, i)

# The crop: the third that moved most, before beside after, at 1:1. Whether
# the change is worth anyone's time is decided by looking at this, not by the
# numbers above -- a third of the frame moved on a change nobody could see.
band_h = h // 3
top = worst[1] * band_h
crop_a = a.crop((0, top, w, top + band_h))
crop_b = b.crop((0, top, w, top + band_h))
sheet = Image.new('RGB', (w * 2 + 8, band_h), (20, 22, 26))
sheet.paste(crop_a, (0, 0))
sheet.paste(crop_b, (w + 8, 0))
out_path = sys.argv[3] if len(sys.argv) > 3 else '/tmp/visible-change.png'
sheet.save(out_path)
print()
print(f"LOOK AT   {out_path}   ({names[worst[1]]} third, before | after)")
print("If the difference is not obvious in that image, it is not obvious to")
print("anyone else either. Do not send it as a before/after.")
`;

process.stdout.write(execFileSync('python3', ['-c', script, before, after, out], { encoding: 'utf8' }));
