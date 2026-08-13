import urllib.parse, urllib.request, sys, time

PROMPTS = {
 "settlers": "1870s American frontier settlers arriving with covered wagons and horses beside a wide waterfall cascading over pink quartzite rock ledges, tallgrass prairie riverbank, people in period clothing, warm golden hour light, mist from the falls, photorealistic cinematic historical photograph",
 "iceage": "Ice age glacial landscape, a massive waterfall frozen solid into blue cascading ice over pink quartzite rock, snow drifts, two woolly mammoths walking in the snowy foreground, pale low winter sun, dramatic sky, photorealistic cinematic, highly detailed",
}

for name, p in PROMPTS.items():
    url = ("https://image.pollinations.ai/prompt/" + urllib.parse.quote(p)
           + "?width=1920&height=1080&nologo=true&model=flux&seed=7")
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            data = urllib.request.urlopen(req, timeout=180).read()
            if len(data) > 50000:
                open(f"ai/{name}.png", "wb").write(data)
                print(name, "ok", len(data))
                break
            print(name, "too small", len(data))
        except Exception as e:
            print(name, "err", e)
        time.sleep(5)
