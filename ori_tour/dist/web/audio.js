// AudioPort for browsers. Plays the package's pre-generated audio when it has
// one (captions follow its cue file; works with no signal once cached),
// otherwise the browser's own voice sentence by sentence, otherwise captions
// alone at reading pace. onEnd is called exactly once per play().
import { readingMs, sentences } from "../core/text.js";
export class WebAudio {
    muted = false;
    token = 0;
    audio = null;
    timer;
    cueCache = new Map();
    assets;
    onCaption = () => { };
    constructor(assets) {
        this.assets = assets;
    }
    /** iOS only lets speech start after a user gesture: call from a tap. */
    unlock() {
        if ("speechSynthesis" in window) {
            const u = new SpeechSynthesisUtterance(" ");
            u.volume = 0;
            speechSynthesis.speak(u);
        }
    }
    stop() {
        this.token++;
        if ("speechSynthesis" in window)
            speechSynthesis.cancel();
        if (this.audio) {
            this.audio.pause();
            this.audio = null;
        }
        clearTimeout(this.timer);
        this.onCaption("");
    }
    play(narration, onCaption, onEnd) {
        this.stop();
        this.onCaption = onCaption;
        const token = this.token;
        const lines = sentences(narration.text);
        let ended = false;
        const done = () => {
            if (token !== this.token || ended)
                return;
            ended = true;
            onCaption("");
            onEnd();
        };
        if (narration.audio && !this.muted) {
            const audio = new Audio(narration.audio);
            this.audio = audio;
            audio.onended = done;
            onCaption(lines[0] ?? "");
            void this.cues(narration).then((cues) => {
                if (!cues || token !== this.token)
                    return;
                audio.ontimeupdate = () => {
                    const now = audio.currentTime;
                    const c = cues.find((x) => now >= x.start && now < x.end) ?? cues.findLast((x) => now >= x.start);
                    if (c)
                        onCaption(c.text);
                };
            });
            audio.play().catch(() => {
                if (token !== this.token)
                    return;
                this.audio = null;
                this.captionsOnly(lines, token, onCaption, done);
            });
            return;
        }
        if (!("speechSynthesis" in window) || this.muted) {
            this.captionsOnly(lines, token, onCaption, done);
            return;
        }
        let i = 0;
        const next = () => {
            if (token !== this.token)
                return;
            const line = lines[i++];
            if (line === undefined)
                return done();
            onCaption(line);
            const words = line.split(/\s+/).length;
            const u = new SpeechSynthesisUtterance(line);
            u.rate = 0.95;
            const began = Date.now();
            const minMs = 600 + words * 300; // reading pace, so captions stay up if the voice is silent
            let moved = false;
            const advance = (wait) => {
                if (moved)
                    return;
                moved = true;
                this.timer = setTimeout(next, wait);
            };
            // Safety net: some browsers never fire onend.
            const guard = setTimeout(() => advance(0), 4000 + words * 600);
            u.onend = u.onerror = () => {
                clearTimeout(guard);
                advance(Math.max(0, minMs - (Date.now() - began)));
            };
            speechSynthesis.speak(u);
        };
        next();
    }
    cues(narration) {
        const path = narration.cues;
        if (!path)
            return Promise.resolve(null);
        let p = this.cueCache.get(path);
        if (!p) {
            p = this.assets
                .json(path)
                .then((x) => x)
                .catch(() => null);
            this.cueCache.set(path, p);
        }
        return p;
    }
    captionsOnly(lines, token, onCaption, done) {
        let i = 0;
        const next = () => {
            if (token !== this.token)
                return;
            const line = lines[i++];
            if (line === undefined)
                return done();
            onCaption(line);
            this.timer = setTimeout(next, readingMs(line));
        };
        next();
    }
}
