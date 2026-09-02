#!/usr/bin/env python3
"""ORI — "WHAT THIS PLACE WAS": end card, concat, sound, master.

Adapted from film1/assemble1.py, which is the version that had the
end-card disclosure plate and the release fix. The only real change is
marks(): this film has no ANCHORS table, so the confirmation ticks key
off FIGURES instead -- the thing that arrives is a figure.
"""
import os, sys, subprocess, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
from spec_one import BEATS, W, H, FPS, TOTAL

OUT = "out1"; RAWD = "../raw"; SR = 48000
FDIR = "../fonts/inter/extras/ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
INK = (250, 250, 248); DIM = (198, 201, 203); CYAN = (120, 226, 238)


def inter(sz, w="SemiBold"): return ImageFont.truetype(f"{FDIR}/Inter-{w}.ttf", sz)
def mono(sz):                return ImageFont.truetype(MONO, sz)


def track(d, xy, text, font, fill, sp, anchor="ls"):
    w = sum(d.textlength(c, font=font) for c in text) + sp*max(0, len(text)-1)
    x, y = xy
    if anchor[0] == "m": x -= w/2
    for ch in text:
        d.text((x+2, y+2), ch, font=font, fill=(5, 8, 10, int(fill[3]*0.6)), anchor="ls")
        d.text((x, y), ch, font=font, fill=fill, anchor="ls")
        x += d.textlength(ch, font=font) + sp


def end_card(d_sec):
    """Held from b4's last frame, darkened, with the mark over it."""
    # DERIVED, NOT TYPED. This was hardcoded to b4_t.mp4, inherited from the
    # five-film assembler where b4 happened to be the last beat. Here the
    # last beat is b5, so the end card was holding the ICE beat's final
    # frame: the film ended frozen, with the mammoth still standing in it,
    # and the "return to now" beat never paid off on screen.
    # The render-time assertion could not catch this. It lives in the
    # RENDERER and correctly proves b5's last frame is clean; the bug was
    # in the ASSEMBLER, reading a different file entirely. An invariant
    # only covers the stage it runs in.
    _last_beat = [b[0] for b in BEATS if b[1] is not None][-1]
    last = subprocess.run(["ffmpeg","-v","error","-sseof","-0.1","-i",f"{OUT}/{_last_beat}_t.mp4",
        "-frames:v","1","-f","rawvideo","-pix_fmt","bgr24","-"], capture_output=True).stdout
    base = np.frombuffer(last[:W*H*3], np.uint8).reshape(H, W, 3).astype(np.float32)
    n = int(round(d_sec*FPS))
    enc = subprocess.Popen(["ffmpeg","-y","-loglevel","error","-f","rawvideo",
        "-pix_fmt","bgr24","-s",f"{W}x{H}","-r",str(FPS),"-i","-","-an",
        "-c:v","libx264","-preset","slow","-crf","13","-pix_fmt","yuv420p",
        f"{OUT}/end_t.mp4"], stdin=subprocess.PIPE)
    for i in range(n):
        t = i/FPS
        k = min(1.0, t/0.5)
        f = base * (1.0 - 0.55*k)
        img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        # r67: "the small secondary lines are faint... 'VISUAL INTENTION ONLY'
        # is responsible, though it should remain readable at delivery size."
        # Both secondary lines are bigger and brighter, and the honesty tag
        # gets a plate behind it -- a disclosure nobody can read is not one.
        a = int(252*min(1.0, max(0.0, (t-0.15)/0.45)))
        if a > 0:
            track(d, (W//2, 520), "OPEN RANGE INTERACTIVE", inter(64), INK+(a,), 11.0, "ms")
            track(d, (W//2, 596), "FALLS PARK, SIOUX FALLS", mono(34), INK+(int(a*0.92),), 6.0, "ms")
        # BETA FRAMING LINE. v18 wording corrected in v20. Operator, asked
        # directly about the product's current state: "Right now, Open
        # Range should be treated as a product concept and demonstration,
        # not a finished working hardware beta... 'Falls Park beta' = the
        # PROPOSED first real-world pilot... Neither should be presented
        # as something already deployed today." "IS THE FIRST BETA" read
        # as present-tense fact; PROPOSED makes it a stated intention,
        # matching what is actually true right now. Second line "CAN"
        # softened to "COULD" for the same reason -- a capability claimed
        # for a platform that has not shipped anywhere yet is a plan, not
        # a fact. It sits BELOW the disclosure, in a quieter weight,
        # because it is a positioning statement, not the thing being
        # disclosed.
        a1b = int(240*min(1.0, max(0.0, (t-0.65)/0.4)))
        if a1b > 0:
            s1b = "FALLS PARK IS THE PROPOSED FIRST BETA."
            f1b = mono(26)
            w1b = sum(d.textlength(c, font=f1b) for c in s1b) + 4.0*(len(s1b)-1)
            track(d, (W//2, 632), s1b, f1b, DIM+(a1b,), 4.0, "ms")
        a2 = int(248*min(1.0, max(0.0, (t-0.9)/0.45)))
        if a2 > 0:
            s2 = "VISUAL INTENTION ONLY"
            f2 = mono(32)
            w2 = sum(d.textlength(c, font=f2) for c in s2) + 6.0*(len(s2)-1)
            d.rectangle([W//2-w2/2-24, 652, W//2+w2/2+24, 700], fill=(6, 9, 12, int(150*a2/248)))
            track(d, (W//2, 686), s2, f2, CYAN+(a2,), 6.0, "ms")
        a2b = int(220*min(1.0, max(0.0, (t-1.5)/0.5)))
        if a2b > 0:
            s2b = "THE SAME PLATFORM COULD BRING REAL PLACES TO LIFE ANYWHERE."
            f2b = mono(22)
            w2b = sum(d.textlength(c, font=f2b) for c in s2b) + 3.0*(len(s2b)-1)
            track(d, (W//2, 730), s2b, f2b, DIM+(a2b,), 3.0, "ms")
        ov = np.array(img).astype(np.float32); al = ov[..., 3:4]/255.0
        f = f*(1-al) + ov[..., :3][..., ::-1]*al
        enc.stdin.write(np.clip(f, 0, 255).astype(np.uint8).tobytes())
    enc.stdin.close(); enc.wait()


# bed() IS GONE, not disabled. It pulled each plate's location audio and
# concatenated it under the film. Operator: "completely cut the sound out
# of the videos because there's a lot of me talking in the background
# because there wasn't meant to be sound in the videos." A commented-out
# mixer input is the kind of thing that gets switched back on by accident
# six versions later, so the function and its filter graph are deleted and
# the master no longer opens the source clips for audio at all.


def _tick(n, f0, f1, amp, sharp):
    t = np.arange(n)/SR
    fr = f0 + (f1-f0)*np.exp(-t*9.0)
    return (amp*np.exp(-t*sharp)*np.sin(2*np.pi*np.cumsum(fr)/SR)).astype(np.float32)


def marks():
    """One soft tick as each FIGURE locks. The sound is the confirmation.

    film1 keyed these off ANCHORS, which this film does not have -- the
    thing that arrives here is a figure, so the tick lands on the figure's
    appear time. Same two-part sound: a thin rising tick as the reticle
    starts to converge, then a low lock 0.55s later when it closes.
    """
    from spec_one import figures
    n = int(TOTAL*SR)+SR
    a = np.zeros(n, np.float32)
    def put(at, sig):
        i = int(at*SR)
        if i < n:
            a[i:i+len(sig)] += sig[:max(0, n-i)]
    for b, clip, tin, st, d, note in BEATS:
        for (_src, _foot, _h, t0, _build, _sd, _m, _off, _sh, _ct) in figures(b):
            put(st+t0-0.55, _tick(int(0.20*SR), 520, 380, 0.055, 17.0))
            put(st+t0,      _tick(int(0.34*SR), 250, 150, 0.20, 8.0))
    a = a[:int(TOTAL*SR)]
    import wave
    with wave.open(f"{OUT}/_marks.wav","wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(np.stack([a,a],1),-1,1)*32767).astype(np.int16).tobytes())


def master(dst):
    with open("concat_one.txt","w") as fh:
        for b, clip, tin, st, d, note in BEATS:
            fh.write(f"file '{os.path.abspath(OUT)}/{b}_t.mp4'\n")
    subprocess.run(["ffmpeg","-v","error","-y","-f","concat","-safe","0","-i","concat_one.txt",
        "-r",str(FPS),"-fps_mode","cfr","-c:v","libx264","-crf","14",
        "-pix_fmt","yuv420p",f"{OUT}/_picture.mp4"], check=True)
    # Three sources, none of them the location: confirmation ticks, score,
    # narration. Weights put the voice on top -- with the river gone there
    # is nothing to fight, so the score can sit well under it and the film
    # is quiet where nobody is speaking.
    mix = ("[1:a][2:a][3:a]amix=inputs=3:normalize=0:weights=0.85 0.70 1.0,"
           "alimiter=limit=0.80:attack=4:release=90:level=disabled")
    p = subprocess.run(["ffmpeg","-hide_banner","-nostats","-i",f"{OUT}/_picture.mp4",
        "-i",f"{OUT}/_marks.wav",
        "-i",f"{OUT}/_music.wav","-i",f"{OUT}/_vo.wav","-filter_complex",
        mix+",loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[a]",
        "-map","[a]","-f","null","-"], capture_output=True, text=True)
    m = re.findall(r"\{[^{}]*input_i[^{}]*\}", p.stderr, re.S)
    if not m: sys.exit(p.stderr[-2000:])
    j = json.loads(m[-1]); print("  measured", j["input_i"], j["input_tp"])
    subprocess.run(["ffmpeg","-v","error","-y","-i",f"{OUT}/_picture.mp4",
        "-i",f"{OUT}/_marks.wav",
        "-i",f"{OUT}/_music.wav","-i",f"{OUT}/_vo.wav","-filter_complex",
        mix+(f",loudnorm=I=-16:TP=-1.5:LRA=11:linear=true:measured_I={j['input_i']}:"
             f"measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
             f"measured_thresh={j['input_thresh']},aresample={SR}[a]"),
        "-map","0:v","-map","[a]","-c:v","copy","-c:a","aac","-b:a","192k",
        "-ar",str(SR),"-movflags","+faststart", dst], check=True)


if __name__ == "__main__":
    end_card([b for b in BEATS if b[1] is None][0][4]); print("  end card")
    marks()
    import score_one; score_one.main()
    import vo_one; vo_one.main()
    print("  sound")
    master("../out/ORI_What_This_Place_Was_master.mp4"); print("  mastered")
