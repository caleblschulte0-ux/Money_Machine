import asyncio, edge_tts, subprocess, json

LINES = [
    ("vo1", "Some of the best stories in America are standing right in front of you."),
    ("vo2", "But today, they live on plaques and little signs. And most people walk right past."),
    ("vo3", "Open Range Interactive is building A R glasses made for travel."),
    ("vo4", "Put them on, and the place starts talking. The mill from 1881. The river at full flood. The history, pinned to the exact spot where it happened."),
    ("vo5", "No tour group. No phone in your face. You just look."),
    ("vo6", "Open Range Interactive. See the story where you stand."),
]

async def main():
    durs = {}
    for name, text in LINES:
        tts = edge_tts.Communicate(text, "en-US-AndrewNeural", rate="+4%")
        await tts.save(f"work/{name}.mp3")
        d = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f"work/{name}.mp3"],capture_output=True,text=True).stdout.strip()
        durs[name] = float(d)
        print(name, d)
    json.dump(durs, open("work/vo_durs.json","w"))

asyncio.run(main())
