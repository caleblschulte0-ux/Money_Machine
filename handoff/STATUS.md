# Open Range demo film(s) — status, 2026-09-17

**One line:** the original "five demo commercials" brief was scrapped by the
operator on 2026-08-27. What exists now is one film, reworked through several
visual treatments, currently PAUSED on branch
`claude/open-range-promo-video-4n7k7o` waiting on the operator to pick a
visual direction from three pitches sent 2026-09-13 (r265) — no activity
since, and no commit message or DONE file records his answer.

## The brief changed twice — read this before the table below

1. **2026-08-26 — BRIEF.md**: five separate demo films, one AR capability
   each (glass recognition, historical reconstruction, time control, depth/
   subsurface, multi-user). Demos 1, 3, 4 and 5 were built and locked at r75
   (2026-08-27); Demo 2 was reworked once more after that.
2. **2026-08-27, same day — operator ruling, commit `7d2d968`**: *"the
   five-demo set is scrapped"* — his exact diagnosis was that the AI overlays
   read as a wireframe cyan dot, not a family. Replaced with **ONE film**
   (`ori_promo/one/`): real matted figures (a pioneer family, Dakota people,
   an ice-age mammoth) composited onto the real Falls Park rock the wearer is
   standing on, cut from one continuous plate.
3. **ONE film iterated to v33** (2026-09-09) and the operator watched it and
   rated it **3/10**, on the record: *"that video looks like shit."* His
   complaint: AI overlays still don't look real/premium, real footage looks
   amateurish, pacing is off.
4. **2026-09-10 — the five-style slate**: rather than one more patch on v33,
   the same underlying film was rebuilt as five different VISUAL
   TREATMENTS (not five capabilities) to find one that reads as premium:
   Field Guide (v34), The Walkthrough (v35), How the System Works (v36),
   and The World / The Layer (v37). Only v37 got sustained investment after
   its first build — v34/v35/v36 each got one ChatGPT-review revision pass
   and then a shared bugfix at r247, nothing since.
5. **v37 ("World Layer") absorbed almost all further work**, r185→r263
   (2026-09-10 to 2026-09-13, 27 commits touching `ori_promo/layer/`):
   AR-window rework, gaze alignment, a direct-edit hook fix, holographic
   vignette, zoom-framing lock. The most recent state is r263's
   "cut-locked hook zoom fix."
6. **2026-09-13, r265 — operator pauses it again**: *"pause full-video
   World Layer iteration, pitch genuinely different visual approaches to
   the AI overlay problem instead."* Three single-frame mockups went up —
   a HUD corner-card, a live/vision split-screen, and an existing-but-unused
   vector hologram technique (shown honestly, including its color/blowout
   problem). **Nothing has happened on this branch since** (today is
   2026-09-17 — four days idle, no reply recorded).

## Where things actually live

**No video master is committed to this repo, for any version, by design**
(`handoff/README.md`: "MP4s never transfer at all — Claude hands them to the
operator in chat"). So "built" below means the render succeeded and a
contact sheet was produced and committed; whether Caleb has actually opened
each one in chat is not something this repository can verify — only his own
quoted words in a commit message confirm he watched it.

| Treatment | State | Contact sheet (on this branch, `handoff_media/`) |
|---|---|---|
| Demos 1/3/4/5 (original 5-capability brief) | Locked at r75, then the whole approach was scrapped two commits later | `r74__claude__demo{1,3,4,5}_*__contact.jpg` |
| Demo 2 ("WHAT STOOD HERE") | Superseded by ONE film before it was ever locked | `r74__claude__demo2_what_stood_here__contact.jpg` |
| ONE film, v2–v32 | Superseded, operator never rated these directly | latest: `r124__claude__v32__contact.jpg` |
| ONE film, v33 (final of this line) | **Watched by the operator, rated 3/10** | `r167__claude__v33_product_boundaries_fix__contact.png` |
| v34 "The Field Guide" | Built once, one revision pass, then shelved for v37 | `r173__claude__v34_field_guide_pass2__contact.jpg` |
| v35 "The Walkthrough" | Built once, one revision pass, then shelved for v37 | `r177__claude__v35_walkthrough_pass2__contact.jpg` |
| v36 "How the System Works" | Built once, two revision passes, then shelved for v37 | `r183__claude__v36_system_map_pass3__contact.jpg` |
| v37 "The World / The Layer" | Most-iterated line; **paused mid-iteration** by the operator at r265, not locked, not rejected | `r263__claude__world_layer_r263_master__contact.jpg` |
| r265 pitch mockups (HUD card / split-screen / vector hologram) | Sent for a decision; **no answer on record** | `r265__claude__pitch_hud_card.jpg`, `r265__claude__pitch_split_screen.jpg`, `r265__claude__pitch_vector_hologram.jpg` |

`ori_promo/ORI_trailer.mp4` is a separate, older committed video (pre-dates
the handoff protocol above) and is not part of any of the lines above.

## What is still open

**The operator has to pick.** r265 put three different visual approaches to
the AI-overlay problem in front of him — a HUD card, a split-screen, and a
vector hologram — after v37's fourth-straight round of "does this look
premium yet" iteration. Nothing downstream can proceed honestly without that
pick: another round of polish on v37 without it repeats the same loop the
2026-08-27 and 2026-09-09 rulings both broke out of.

This charter's own step 2 ("look at the contact sheets and pick the film
worth finishing") is effectively the same decision the operator already owes
from r265 — there is no new choice to make beyond the one already pending.
