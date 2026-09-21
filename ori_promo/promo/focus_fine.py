import sys, cv2, numpy as np
p, t0, t1 = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
cap = cv2.VideoCapture(p); fps = cap.get(cv2.CAP_PROP_FPS)
cap.set(cv2.CAP_PROP_POS_FRAMES, int(t0 * fps))
rows = []
i = int(t0 * fps)
prev = None
while i < t1 * fps:
    ok, f = cap.read()
    if not ok: break
    g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
    # focus on the centre 60% (subject + falls), full res
    h, w = g.shape; c = g[int(h*.2):int(h*.8), int(w*.2):int(w*.8)]
    fv = cv2.Laplacian(c, cv2.CV_64F).var()
    d = 0 if prev is None else float(np.abs(cv2.resize(g,(480,270)).astype(np.float32) - prev).mean())
    prev = cv2.resize(g,(480,270)).astype(np.float32)
    rows.append((i / fps, fv, d)); i += 1
a = np.array(rows)
# print per 0.5s: mean focus, min focus, mean frame diff (motion)
for s in np.arange(t0, t1, 0.5):
    m = (a[:,0] >= s) & (a[:,0] < s + 0.5)
    if m.any(): print(f"{s:5.1f}  focus mean={a[m,1].mean():7.0f} min={a[m,1].min():7.0f}  motion={a[m,2].mean():.2f}")
