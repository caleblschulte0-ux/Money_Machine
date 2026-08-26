"""r54: per-shot garment seeds for Film B.

Every entry was placed by eye against a coordinate-gridded zoom of that shot's
plate and then checked by crop. `t` is seconds INTO THE SHOT.

  patch  a small region of CLEAN garment -- no print, no skin, no shorts.
         Its Lab centroid is what the mask's colour test is anchored on and
         what the shot's continuity offset is computed from.
  gate   a generous box around the whole garment. It is the spatial limit of
         the correction, tracked through the shot by optical flow.

b01 has NO entry: from 6.0-11.5s the visitor is a distant figure a few pixels
across on the path. There is no garment to correct, so b01 gets no offset.
That is the honest answer, not an omission.

For the eight shots that carry an r52 proof beat, `t` IS that proof frame --
the frame whose garment pixel set r53 accepted as visually verified.
"""
SEEDS = {
    "b00": dict(t=3.00, patch=(1550, 200, 150, 150), gate=(1000,   0, 920, 620)),
    "b01": None,
    "b02": dict(t=3.00, patch=( 845, 495,  30,  40), gate=( 820, 440, 110, 130)),
    "b03": dict(t=2.25, patch=( 640, 620,  50,  80), gate=( 600, 460, 140, 330)),
    "b04": dict(t=3.00, patch=( 545, 595,  60,  60), gate=( 470, 350, 190, 340)),
    "b05": dict(t=2.00, patch=(1378, 325,  78, 145), gate=(1350, 300, 130, 200)),
    "b06": dict(t=4.00, patch=(1436, 773,  64,  64), gate=(1370, 670, 280, 200)),
    "b07": dict(t=0.00, patch=( 775, 385,  95, 120), gate=( 740, 350, 165, 200)),
    "b08": dict(t=2.50, patch=(  30, 870, 340, 200), gate=(   0, 790, 480, 290)),
    "b09": dict(t=3.75, patch=( 765, 640,  60, 130), gate=( 520, 450, 380, 520)),
    "b10": dict(t=4.00, patch=(1150, 530, 200, 190), gate=(1080, 460, 360, 320)),
    "b11": dict(t=3.00, patch=(1390, 645,  56,  56), gate=(1300, 520, 460, 350)),
    "b12": dict(t=3.50, patch=(1670, 245, 200, 155), gate=(1610, 190, 310, 270)),
}
