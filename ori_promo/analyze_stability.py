"""Motion analysis of every clip: decode at 6fps/160px gray, mean abs
frame diff per 2s window -> the stillest usable windows per clip."""
import subprocess, numpy as np, json, glob, os

W2, H2 = 160, 90
results = {}
for f in sorted(glob.glob("raw/IMG_*.MOV")):
    name = os.path.basename(f)[:-4]
    p = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", f, "-vf", f"fps=6,scale={W2}:{H2}",
         "-f", "rawvideo", "-pix_fmt", "gray", "-"],
        capture_output=True)
    buf = np.frombuffer(p.stdout, np.uint8)
    n = len(buf) // (W2 * H2)
    if n < 13:
        continue
    fr = buf[:n * W2 * H2].reshape(n, H2, W2).astype(np.float32)
    diffs = np.abs(fr[1:] - fr[:-1]).mean(axis=(1, 2))  # per 1/6s step
    # 2s windows (12 steps), stride 0.5s
    wins = []
    for i in range(0, len(diffs) - 12, 3):
        wins.append((round(i / 6.0, 1), float(diffs[i:i + 12].mean())))
    wins.sort(key=lambda x: x[1])
    results[name] = {"dur": round(n / 6.0, 1), "stillest": wins[:4],
                     "median_motion": float(np.median(diffs))}
json.dump(results, open("work/stability.json", "w"), indent=1)
for name, r in sorted(results.items(), key=lambda kv: kv[1]["stillest"][0][1]):
    s = ", ".join(f"{t}s:{m:.2f}" for t, m in r["stillest"][:3])
    print(f"{name} dur={r['dur']:5.1f} med={r['median_motion']:5.2f} best[{s}]")
