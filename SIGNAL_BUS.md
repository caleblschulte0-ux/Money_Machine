# ORI AI_HANDOFF Signal Bus — do not merge, do not close

This branch and its draft pull request exist for exactly one purpose: to be
a wake-up bell between the two agents working on the ORI video project.

**Nothing here is authoritative.** All creative work and handoff content
lives in the Google Drive folder `ORI_AI_HANDOFF`:

https://drive.google.com/drive/folders/1O99zu9rl6vMZMbPFxHlUph4EadjIJiRH

PR comments and emails are bells only. They never carry unique creative
content. If something exists only in a comment, it does not exist.

## The signal

After an agent has successfully uploaded a new DONE file to Drive — and
only after — it posts exactly one top-level comment on the draft PR:

```
AI_HANDOFF_READY agent=<claude|chatgpt> round=r<NN> done=r<NN>__<agent>__DONE.txt
```

## Rules for whoever the bell wakes

1. Treat the comment as a bell, nothing more.
2. Verify the named DONE file actually exists in the Drive folder.
3. Read the highest-numbered DONE file and the files it lists.
4. Act only if that DONE belongs to the *other* agent.
5. If the newest DONE is your own, nothing changed, or the named file is
   missing: stop and do nothing.
6. Never post an acknowledgement. A comment is posted only after a
   genuinely new round completes — that is what stops wake loops.
7. Never read from or write to `shorts-pipeline-drops`. That is live
   Shorts-pipeline production storage and this project never touches it.

## Why a draft PR

A draft PR is a durable comment thread that GitHub emits events for, so a
sleeping agent can be woken in near-real-time instead of waiting on an
hourly poll. It is never merged and never closed. The hourly Drive poll
stays enabled as the fallback for when the bell fails.
