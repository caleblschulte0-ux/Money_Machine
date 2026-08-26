#!/usr/bin/env python3
"""Make the two things a master needs before it goes to anyone: a send-sized
copy small enough to actually send, and a contact sheet so the cut can be
reviewed without moving 80 MB around."""
import subprocess, sys, os
import numpy as np, cv2

def send(master, dst, crf=22):
    subprocess.run(["ffmpeg","-v","error","-y","-i",master,"-c:v","libx264",
        "-preset","slow","-crf",str(crf),"-pix_fmt","yuv420p",
        "-c:a","aac","-b:a","160k","-ar","48000","-movflags","+faststart",dst], check=True)

def sheet(master, dst, cols=4, rows=4, w=560):
    r = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
        "-of","csv=p=0",master], capture_output=True, text=True)
    dur = float(r.stdout.strip())
    n = cols*rows
    tiles=[]
    for i in range(n):
        t = dur*(i+0.5)/n
        p = subprocess.run(["ffmpeg","-v","error","-ss",f"{t:.3f}","-i",master,
            "-frames:v","1","-f","rawvideo","-pix_fmt","bgr24","-"],capture_output=True).stdout
        if len(p) < 1920*1080*3: continue
        f = np.frombuffer(p[:1920*1080*3],np.uint8).reshape(1080,1920,3).copy()
        f = cv2.resize(f,(w,int(w*1080/1920)))
        cv2.rectangle(f,(0,f.shape[0]-30),(120,f.shape[0]),(0,0,0),-1)
        cv2.putText(f,f"{t:5.1f}s",(8,f.shape[0]-9),cv2.FONT_HERSHEY_SIMPLEX,0.6,(255,255,255),2)
        tiles.append(f)
    while len(tiles)%cols: tiles.append(np.zeros_like(tiles[0]))
    grid=np.vstack([np.hstack(tiles[i:i+cols]) for i in range(0,len(tiles),cols)])
    cv2.imwrite(dst,grid,[int(cv2.IMWRITE_JPEG_QUALITY),80])
    return dur, len(tiles)

if __name__ == "__main__":
    m = sys.argv[1]
    base = os.path.splitext(m)[0]
    s = base.replace("_master","") + "_send.mp4"
    send(m, s)
    d, n = sheet(m, base + "__contact.jpg")
    print(f"  send  {s}  {os.path.getsize(s)/1e6:.1f} MB")
    print(f"  sheet {base}__contact.jpg  ({n} frames over {d:.2f}s)")
