#!/usr/bin/env python3
"""DEMO 3 — end card, concat, sound, master.

The sound follows the SEAM, because the seam is the film. A tone whose pitch
rides the seam's position, so when the viewer drags it back in b2 the pitch
falls with it -- that is the one cue that says CONTROL rather than playback,
and it is the whole reason this demo is not Demo 2 with a wipe on it.
"""
import os, sys, subprocess, json, re, wave
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from spec3 import BEATS, LABELS, PAST, SEAM, seam_x, W, H, FPS, TOTAL

OUT = "out3"; RAWD = "../raw"; SR = 48000
FDIR = "../fonts/inter/extras/ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
INK = (250, 250, 248); DIM = (198, 201, 203); CYAN = (120, 226, 238)
AMBER = (250, 206, 128)


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
    last = subprocess.run(["ffmpeg","-v","error","-sseof","-0.1","-i",f"{OUT}/b4_t.mp4",
        "-frames:v","1","-f","rawvideo","-pix_fmt","bgr24","-"], capture_output=True).stdout
    base = np.frombuffer(last[:W*H*3], np.uint8).reshape(H, W, 3).astype(np.float32)
    n = int(round(d_sec*FPS))
    enc = subprocess.Popen(["ffmpeg","-y","-loglevel","error","-f","rawvideo",
        "-pix_fmt","bgr24","-s",f"{W}x{H}","-r",str(FPS),"-i","-","-an",
        "-c:v","libx264","-preset","slow","-crf","13","-pix_fmt","yuv420p",
        f"{OUT}/end_t.mp4"], stdin=subprocess.PIPE)
    for i in range(n):
        t = i/FPS
        f = base * (1.0 - 0.55*min(1.0, t/0.5))
        img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        a = int(252*min(1.0, max(0.0, (t-0.15)/0.45)))
        if a > 0:
            track(d, (W//2, 520), "OPEN RANGE INTERACTIVE", inter(58), INK+(a,), 11.0, "ms")
            track(d, (W//2, 584), "FALLS PARK, SIOUX FALLS", mono(28), DIM+(int(a*0.85),), 6.0, "ms")
        a2 = int(240*min(1.0, max(0.0, (t-0.9)/0.45)))
        if a2 > 0:
            track(d, (W//2, 672), "VISUAL INTENTION ONLY", mono(26), AMBER+(a2,), 6.0, "ms")
        ov = np.array(img).astype(np.float32); al = ov[..., 3:4]/255.0
        f = f*(1-al) + ov[..., :3][..., ::-1]*al
        enc.stdin.write(np.clip(f, 0, 255).astype(np.uint8).tobytes())
    enc.stdin.close(); enc.wait()


def bed():
    ins, filt, labs = [], [], []
    k = 0
    for b, clip, tin, st, d, note in BEATS:
        src, s_in = (clip, tin) if clip else ("6805", 60.0)
        ins += ["-ss", f"{s_in}", "-t", f"{d:.2f}", "-i", f"{RAWD}/IMG_{src}.MOV"]
        filt.append(f"[{k}:a]atrim=0:{d:.2f},asetpts=N/SR/TB,"
                    f"afade=in:st=0:d=0.2,afade=out:st={d-0.2:.2f}:d=0.2[s{k}]")
        labs.append(f"[s{k}]"); k += 1
    f = (";".join(filt) + ";" + "".join(labs) + f"concat=n={k}:v=0:a=1,"
         "highpass=f=80,lowpass=f=6500,afftdn=nr=11:nf=-36,"
         "acompressor=threshold=0.06:ratio=3:attack=30:release=500,"
         f"volume=0.72,afade=in:st=0:d=0.8,afade=out:st={TOTAL-1.6:.2f}:d=1.6[out]")
    subprocess.run(["ffmpeg","-v","error","-y"]+ins+["-filter_complex", f,
        "-map","[out]","-ac","2","-ar",str(SR), f"{OUT}/_bed.wav"], check=True)


def _tone(n, f0, f1, amp, sharp):
    t = np.arange(n)/SR
    fr = f0 + (f1-f0)*np.exp(-t*9.0)
    return (amp*np.exp(-t*sharp)*np.sin(2*np.pi*np.cumsum(fr)/SR)).astype(np.float32)


def _glide(n, f0, f1, amp):
    """The sweep's travelling tone: it rises as the plane goes away from you,
    and it is shaped so it never becomes a whine."""
    t = np.arange(n)/SR
    u = t/max(1e-6, t[-1])
    fr = f0 + (f1-f0)*u
    env = np.sin(np.pi*np.clip(u, 0, 1))**0.7
    s = np.sin(2*np.pi*np.cumsum(fr)/SR) * 0.72 + np.sin(4*np.pi*np.cumsum(fr)/SR) * 0.28
    return (amp*env*s).astype(np.float32)


def _seam_tone(beat, dur, amp=0.10):
    """A tone whose pitch tracks the seam. Sampled from the same seam_x() the
    picture uses, so sound and image cannot drift apart -- and when the seam is
    dragged BACKWARD in b2 the pitch falls, which is the audible difference
    between driving something and watching it play."""
    n = int(dur*SR)
    t = np.arange(n)/SR
    xs = np.array([seam_x(beat, float(tt)) for tt in t], np.float32)
    xs = np.clip(xs, 0.0, 1.0)
    fr = 120.0 + 240.0*(1.0 - xs)          # far past -> higher
    # only sound while it is actually moving; a static seam is silent
    mv = np.abs(np.gradient(xs))*SR
    env = np.clip(mv/0.55, 0, 1)
    env = np.convolve(env, np.ones(int(0.06*SR))/int(0.06*SR), mode="same")
    sig = np.sin(2*np.pi*np.cumsum(fr)/SR)*0.7 + np.sin(4*np.pi*np.cumsum(fr)/SR)*0.3
    return (amp*env*sig).astype(np.float32)


def marks():
    n = int(TOTAL*SR)+SR
    a = np.zeros(n, np.float32)
    def put(at, sig):
        i = max(0, int(at*SR)); a[i:i+len(sig)] += sig[:max(0, n-i)]
    for b, clip, tin, st, d, note in BEATS:
        if b in SEAM:
            put(st, _seam_tone(b, d))
        if b in LABELS:
            put(st + LABELS[b][3], _tone(int(0.30*SR), 250, 150, 0.13, 8.0))
    a = a[:int(TOTAL*SR)]
    with wave.open(f"{OUT}/_marks.wav","wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(np.stack([a,a],1),-1,1)*32767).astype(np.int16).tobytes())


def master(dst):
    with open("concat3.txt","w") as fh:
        for b, clip, tin, st, d, note in BEATS:
            fh.write(f"file '{os.path.abspath(OUT)}/{b}_t.mp4'\n")
    subprocess.run(["ffmpeg","-v","error","-y","-f","concat","-safe","0","-i","concat3.txt",
        "-r",str(FPS),"-fps_mode","cfr","-c:v","libx264","-crf","14",
        "-pix_fmt","yuv420p",f"{OUT}/_picture.mp4"], check=True)
    mix = ("[1:a][2:a]amix=inputs=2:normalize=0,"
           "alimiter=limit=0.80:attack=4:release=90:level=disabled")
    p = subprocess.run(["ffmpeg","-hide_banner","-nostats","-i",f"{OUT}/_picture.mp4",
        "-i",f"{OUT}/_bed.wav","-i",f"{OUT}/_marks.wav","-filter_complex",
        mix+",loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[a]",
        "-map","[a]","-f","null","-"], capture_output=True, text=True)
    m = re.findall(r"\{[^{}]*input_i[^{}]*\}", p.stderr, re.S)
    if not m: sys.exit(p.stderr[-2000:])
    j = json.loads(m[-1]); print("  measured", j["input_i"], j["input_tp"])
    # aresample=48000 AND -ar 48000: loudnorm runs at 192k internally and hands
    # that rate downstream, which is how Film A ended up with 96 kHz AAC.
    subprocess.run(["ffmpeg","-v","error","-y","-i",f"{OUT}/_picture.mp4",
        "-i",f"{OUT}/_bed.wav","-i",f"{OUT}/_marks.wav","-filter_complex",
        mix+(f",loudnorm=I=-16:TP=-1.5:LRA=11:linear=true:measured_I={j['input_i']}:"
             f"measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
             f"measured_thresh={j['input_thresh']},aresample={SR}[a]"),
        "-map","0:v","-map","[a]","-c:v","copy","-c:a","aac","-b:a","192k",
        "-ar",str(SR),"-movflags","+faststart", dst], check=True)


if __name__ == "__main__":
    end_card([b for b in BEATS if b[1] is None][0][4]); print("  end card")
    bed(); marks(); print("  sound")
    master("../out/ORI_DEMO_3_Then_And_Now_master.mp4"); print("  mastered")
