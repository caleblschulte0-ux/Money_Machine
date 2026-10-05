// Plays a stop's narration: the package's pre-generated audio file when it has
// one (captions follow the audio from its cue file, and it works with no
// signal once cached), otherwise the browser's own voice, sentence by sentence
// so captions follow. With no voice at all it still runs the captions on a
// reading-pace timer.

export class Narrator {
  constructor(onCaption, onEnd) {
    this.onCaption = onCaption;
    this.onEnd = onEnd;
    this.token = 0;
    this.muted = false;
    this.audio = null;
  }

  // Call from a tap: iOS only lets speech start after a user gesture.
  unlock() {
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      speechSynthesis.speak(u);
    }
  }

  stop() {
    this.token++;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    if (this.audio) { this.audio.pause(); this.audio = null; }
    clearTimeout(this.timer);
    this.onCaption("");
  }

  play(narration) {
    this.stop();
    const token = this.token;
    const sentences = narration.text.match(/[^.!?]+[.!?]+["']?\s*/g) || [narration.text];
    const done = () => { if (token === this.token) { this.onCaption(""); this.onEnd(); } };

    if (narration.audio && !this.muted) {
      const audio = (this.audio = new Audio(narration.audio));
      audio.onended = done;
      this.onCaption(sentences[0].trim());
      this.cues(narration).then((cues) => {
        if (!cues || token !== this.token) return;
        audio.ontimeupdate = () => {
          const c = cues.find((x) => audio.currentTime >= x.start && audio.currentTime < x.end) || cues.findLast((x) => audio.currentTime >= x.start);
          if (c) this.onCaption(c.text);
        };
      });
      audio.play().catch(() => { if (token === this.token) { this.audio = null; this.captionsOnly(sentences, token, done); } });
      return;
    }
    const voice = "speechSynthesis" in window && !this.muted;
    let i = 0;
    const next = () => {
      if (token !== this.token) return;
      if (i >= sentences.length) return done();
      const line = sentences[i++].trim();
      this.onCaption(line);
      const words = line.split(/\s+/).length;
      if (!voice) { this.timer = setTimeout(next, 900 + words * 380); return; }
      const u = new SpeechSynthesisUtterance(line);
      u.rate = 0.95;
      const began = Date.now();
      const minMs = 600 + words * 300; // reading pace, so captions stay up if the voice is silent
      // Safety net: some browsers never fire onend.
      let moved = false;
      const advance = (wait) => { if (!moved) { moved = true; this.timer = setTimeout(next, wait); } };
      const guard = setTimeout(() => advance(0), 4000 + words * 600);
      u.onend = u.onerror = () => {
        clearTimeout(guard);
        advance(Math.max(0, minMs - (Date.now() - began)));
      };
      speechSynthesis.speak(u);
    };
    next();
  }

  async cues(narration) {
    if (!narration.cues) return null;
    this.cueCache = this.cueCache || {};
    if (!this.cueCache[narration.cues]) {
      this.cueCache[narration.cues] = fetch(narration.cues).then((r) => r.json()).catch(() => null);
    }
    return this.cueCache[narration.cues];
  }

  captionsOnly(sentences, token, done) {
    let i = 0;
    const next = () => {
      if (token !== this.token) return;
      if (i >= sentences.length) return done();
      const line = sentences[i++].trim();
      this.onCaption(line);
      this.timer = setTimeout(next, 900 + line.split(/\s+/).length * 380);
    };
    next();
  }
}
