# AI_HANDOFF — Claude ↔ ChatGPT loop (no API keys)

Two agents collaborate through a shared Google Drive folder. Nobody talks
directly; the folder is the conversation. This directory holds the Claude-side
tooling and the kickoff prompts.

**Mailbox:** Google Drive folder `ORI_AI_HANDOFF`
https://drive.google.com/drive/folders/1O99zu9rl6vMZMbPFxHlUph4EadjIJiRH
(in the shorts-pipeline Drive, shortspipeline@gmail.com)

**Protocol:** `PROTOCOL.md` in that folder is the single source of truth.
Short version: numbered rounds, strict `r<NN>__<agent>__<desc>.<ext>` file
names, every turn ends with a `r<NN>__<agent>__DONE.txt`, the folder is
append-only, and no one reviews an MP4 raw — every video ships with a
timestamped contact sheet and a timeline text file.

**Binary transport (learned the hard way):** Claude's Drive connector can
only push text — inline base64 costs ~1 token/char, so images/video can't
go through it. Claude's media therefore rides THIS public repo: contact
sheets go in `handoff_media/` on the working branch, and the Drive round
carries a `__media_links.txt` with the raw.githubusercontent.com URL for
ChatGPT to fetch. MP4s never transfer at all — Claude hands them to the
operator in chat; the sheet + timeline pair is the video for review
purposes. ChatGPT's own images upload to Drive directly (its connector
can), so its side is unchanged.

## Files here

- `make_contact_sheet.py` — turn any MP4 into `<name>__contact.png`
  (timestamped frame grid) plus a `<name>__timeline.txt` stub to fill in.
  Needs only ffmpeg/ffprobe. Run:
  `python handoff/make_contact_sheet.py path/to/video.mp4`
- **Film-finishing modules**, copied here as the durable record of what
  produced each delivered master. They are read-only evidence, not a library
  the pipeline imports; the Shorts-pipeline repo is never modified.
  - `shotnorm.py` — the shot-level technical normalization stage (black point,
    white point, white balance; the median is deliberately NOT matched).
  - `native_check.py` — refuses any source that would be upscaled into the
    delivery frame. 9 of the 34 clips are rotated portrait and fail it.
  - `highkey.py` — restores Film B's own high-key curve after normalization.
  - `watercalm.py`, `terrainmask.py`, `peoplecheck.py` — Film D's water,
    landform-material and figure-audit passes.
  - `garmentguard.py` + `apply_guard.py` — Film B's r52 chroma-continuity
    guard and the render driver. The guard runs AFTER the finish; the
    docstrings carry the measurement that settled that order.
  - `garmentmask.py`, `seedsB.py`, `apply_cont.py` — r54's tracked garment
    mask, its per-shot seeds, and the pass that applies the bounded Lab
    continuity offset. The mask is the conjunction of a flow-tracked gate,
    the dark-and-chromatic class, and a per-shot Lab-neighbourhood test;
    the docstring records the two simpler approaches that failed first and
    the measurements that killed them.
  - `controlsB.py`, `tableB.py`, `contsim.py` — the control sets that prove
    the pass touched nothing it was not allowed to, the source/guard/
    continuity table, and the simulator that chooses a target on eight
    frames instead of on a 35-minute render.
  - `proofB.py` — the same-pixel proof. Samples are frozen PIXEL SETS taken
    from the untouched plate, not rectangles, because the subject is ~80px
    wide in some shots and any usable rectangle catches shirt print and skin.
  - `continuity_preview.py` — measures the trade between source fidelity and
    wardrobe continuity without rendering anything.
- `PROMPT_CHATGPT.md` — paste into a new ChatGPT conversation to enroll it.
- `PROMPT_CLAUDE.md` — paste into a new Claude Code session to enroll it.

## How the operator runs the loop

1. Write the project brief into the Drive folder as
   `r00__operator__brief.md` (or ask Claude to write it from dictation).
2. Paste `PROMPT_CHATGPT.md` into ChatGPT, `PROMPT_CLAUDE.md` into Claude.
3. When one side says its round is DONE, tell the other side:
   "Your turn — check the ORI_AI_HANDOFF folder." That's the whole relay.
4. Optional automation: give ChatGPT a scheduled task and Claude a Routine
   that each check the folder for a new DONE file on a schedule; then no
   relaying is needed at all.

## Standing requirement: Drive is authoritative, email is the bell

Operator ruling 2026-08-24, recorded in PROTOCOL.md rules 0, 10 and 11.

- **Google Drive is the sole authoritative source** for creative work and
  handoff content. Email, chat, and commit messages never carry unique
  content. (Binary carve-out unchanged: contact-sheet JPEGs ride
  `handoff_media/` here, and the authoritative links live in Drive.)
- **Every Claude round ends the same way**, success or failure: upload all
  round files, upload `r<NN>__claude__DONE.txt` LAST, and only after that
  upload succeeds send an email to openrangeinteractive@gmail.com with the
  subject exactly `AI_HANDOFF_READY` and the fixed one-line body. Sending
  before the DONE lands would wake ChatGPT into an incomplete handoff.
- **A failed round still gets a DONE file and a bell** — `STATUS: ERROR`
  plus the failed step, the exact error, what did complete, and what
  ChatGPT should do next. Silence is the only unacceptable outcome.
- Gmail send is verified per round; three failed attempts means the DONE
  file still stands and the operator gets told in chat so they can wake
  ChatGPT by hand.

## Mailbox moved — 2026-08-24

The handoff mailbox now lives in the **shorts-pipeline Drive**
(shortspipeline@gmail.com) as `ORI_AI_HANDOFF`:
https://drive.google.com/drive/folders/1O99zu9rl6vMZMbPFxHlUph4EadjIJiRH

It is a **sibling** of `shorts-pipeline-drops`
(id 1WRCkr9dfGa042LYb_vitXVfv9Q43poA5), never inside it. That drops folder
is live production storage for the daily media exchange — the pipeline
verifies every file in it against checkpoints, so one stray file can fail a
run. Nothing in this ORI project reads from or writes to it. Same Drive
account, separate space, no overlap. PROTOCOL.md rule -1 states this to
both agents.

The original folder on the openrangeinteractive Drive is retired; its live
content (protocol, r00 brief and reference, Claude's completed r01) was
re-created in the new folder.
