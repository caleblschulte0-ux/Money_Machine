# Notes for App Review

**What the app is.** A virtual dog with a memory. The child talks to him
(hold the TALK button, or type), teaches him cue words, feeds and plays with
him, and takes him to a park, a town and a beach where other dogs live.

**No sign-in.** There are no accounts. Nothing to enter to review the app.

**Microphone.** Used only while TALK is held. Speech is transcribed ON THE
DEVICE (Apple's speech recognition); the audio is never uploaded. If the
reviewer denies the permission, the app falls back to a text box and is fully
usable.

**Network.** The transcribed text and the facts Barkly has learned are sent
to our own HTTPS proxy, which forwards them to the dialogue model. The app
contains no model API key. If the proxy is unreachable, an offline scripted
Barkly answers instead — the app is never dead.

**Purchases.** None. The in-game "coins" and "store" are earned by playing
and cannot be bought.

**Parental controls.** Settings → For parents. Deleting Barkly's memory and
opening any web link are behind a two-digit arithmetic gate.

**Fastest way to see the point.** Onboarding asks for a name and a secret
word. Say the secret word afterwards: he performs it. Tap Park, tap DIG, then
type "what did we do today?" — he tells you.
