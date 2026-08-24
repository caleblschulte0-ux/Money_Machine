# AI_HANDOFF — Claude ↔ ChatGPT loop (no API keys)

Two agents collaborate through a shared Google Drive folder. Nobody talks
directly; the folder is the conversation. This directory holds the Claude-side
tooling and the kickoff prompts.

**Mailbox:** Google Drive folder `AI_HANDOFF`
https://drive.google.com/drive/folders/1nWKY6JyBeS2rjJK25BzD3xZ_XdKfHj6-
(owned by openrangeinteractive@gmail.com, shared with caleblschulte0@gmail.com)

**Protocol:** `PROTOCOL.md` in that folder is the single source of truth.
Short version: numbered rounds, strict `r<NN>__<agent>__<desc>.<ext>` file
names, every turn ends with a `r<NN>__<agent>__DONE.txt`, the folder is
append-only, and no one reviews an MP4 raw — every video ships with a
timestamped contact sheet and a timeline text file.

## Files here

- `make_contact_sheet.py` — turn any MP4 into `<name>__contact.png`
  (timestamped frame grid) plus a `<name>__timeline.txt` stub to fill in.
  Needs only ffmpeg/ffprobe. Run:
  `python handoff/make_contact_sheet.py path/to/video.mp4`
- `PROMPT_CHATGPT.md` — paste into a new ChatGPT conversation to enroll it.
- `PROMPT_CLAUDE.md` — paste into a new Claude Code session to enroll it.

## How the operator runs the loop

1. Write the project brief into the Drive folder as
   `r00__operator__brief.md` (or ask Claude to write it from dictation).
2. Paste `PROMPT_CHATGPT.md` into ChatGPT, `PROMPT_CLAUDE.md` into Claude.
3. When one side says its round is DONE, tell the other side:
   "Your turn — check the AI_HANDOFF folder." That's the whole relay.
4. Optional automation: give ChatGPT a scheduled task and Claude a Routine
   that each check the folder for a new DONE file on a schedule; then no
   relaying is needed at all.
