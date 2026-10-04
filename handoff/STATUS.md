# Open Range demo films — status (2026-10-04)

One page. What exists, where it is, and what is still open. Written from the
repository itself (branch `claude/open-range-promo-video-4n7k7o`, 288 commits,
last change 2026-09-23) and the handoff record; nothing here is a claim a
render was not checked against.

## Where things live, once

- **Source for every film** is on this branch under `ori_promo/`. Each film is
  a spec (the edit), a render (the picture) and an assemble (sound and master).
- **Masters are never in git.** They are 20–170 MB; the storage rule keeps
  anything over 256 KB out. A master exists on the machine that rendered it
  and goes to Caleb directly, or into the `ORI_AI_HANDOFF` Google Drive folder
  (shortspipeline@gmail.com Drive). One exception slipped through and should
  not be repeated: `ori_promo/deliverables/ORI_promo_v1_master_1080p.mp4`
  (65 MB) was committed 2026-09-22.
- **Contact sheets are in git**, in `handoff_media/`, named by round:
  `r<NN>__claude__<film>__contact.jpg`. Each is a timestamped frame grid and
  is the reviewable form of the film. Public raw URL:
  `https://raw.githubusercontent.com/caleblschulte0-ux/Money_Machine/claude/open-range-promo-video-4n7k7o/handoff_media/<name>`
- **Review record** is the Drive mailbox, by round (`r00` … `r267` as of the
  last commit). Only round r68's text files are mirrored in `handoff/rounds/`.

## The five-film slate (the brief of 2026-08-26)

Five demo commercials, one lead capability each, signed off at **r75
(2026-08-27)** against the r74 masters. Source: `ori_promo/demos/film1..5`.
Sheets: `handoff_media/r74__claude__demoN_*__contact.jpg`.

| # | Film | Runs | State | Master | Sheet |
|---|---|---|---|---|---|
| 1 | THROUGH THE GLASS | 32.0 s | **locked** | rendered r74, delivered to Caleb; not in git | `r74__claude__demo1_through_the_glass__contact.jpg` |
| 2 | WHAT STOOD HERE | 32.5 s | passes on execution, claim framing, end card and concept; **held on the asset rule only** | rendered r74; not in git | `r74__claude__demo2_what_stood_here__contact.jpg` |
| 3 | THEN AND NOW | 32.0 s | **locked** | rendered r74; not in git | `r74__claude__demo3_then_and_now__contact.jpg` |
| 4 | DEEP TIME | 29.0 s | **locked** | rendered r74; not in git | `r74__claude__demo4_deep_time__contact.jpg` |
| 5 | THE TOUR | 33.5 s | **locked** | rendered r74; not in git | `r74__claude__demo5_the_tour__contact.jpg` |

A locked film is reopened only by an explicit brief from Caleb, never by a
good idea (`ori_promo/demos/README.md` says why: seven rounds were spent on
defects that shipped).

## What came after the slate, in the same folder

The mailbox kept going after r75, under Caleb's own briefs, and each of these
is a separate style with its own source directory. None of them is one of the
five.

| Style | Dir | Runs | Last round / date | Sheet |
|---|---|---|---|---|
| Demo v2 (approved master, 89.4 s, no AI imagery) | `ori_promo/` (`DEMO_V2_RELEASE_NOTES.txt`) | 89.4 s | r06 | `demo_v2_r05__contact` |
| Pitch trailer v3–v11 | `ori_promo/trailer/` | 53.2 s (v5) | r16, 2026-08-25 | per-version notes `TRAILER_V*_NOTES.txt` |
| "What this place was" (v32) | `ori_promo/one/` | 55.6 s | r167, 2026-09-10 | `r76__claude__what_this_place_was__contact.jpg` and later |
| Explainers e1–e5 | `ori_promo/explain1..5/` | — | 2026-09-08 (handheld clips stabilised) | not committed |
| v34 "The Field Guide" | `ori_promo/field/` | 70.0 s | r247 QA fix, 2026-09-13 | r-series sheets |
| v35 "The Walkthrough" | `ori_promo/walk/` | 72.0 s | r247, 2026-09-13 | r-series sheets |
| v36 "How the System Works" | `ori_promo/map/` | 74.0 s | r247, 2026-09-13 | r-series sheets |
| v37 "The World / The Layer" | `ori_promo/layer/` | 74.0 s | r263 master, 2026-09-13 | `r263__claude__world_layer_r263_master__contact.jpg` |
| **ORI promo v1** (the current flagship: 52.1 s, 16:9 letterbox, plus a 9:16 social cut from the same timeline, Caleb's own ElevenLabs narration) | `ori_promo/promo/` | 52.1 s | r267, 2026-09-23 | `r267` sheet (54.6 s cut) |

The promo v1 is the live piece of work: 42 of the last 60 commits are to it,
the real narration (13 line files in `ori_promo/vo/real/`) is in, and the
last change was the mammoth beat on 2026-09-23. Its master is the one file
that is in git (above).

## Still open

1. **Demo 2 (WHAT STOOD HERE) is held on an operator action nobody else can
   take.** Round r00 prohibits newly generated AI imagery; Caleb lifted that
   verbally on 2026-08-26, and a relayed report is not a Drive record. Either
   closes it: an operator-authored amendment in `ORI_AI_HANDOFF` approving
   Demo 2's provisional reconstruction assets, or link-sharing that folder so
   the approved replacement assets (`r60__chatgpt__ar__A1..A5.png`) can be
   fetched.
2. **`ORI_AI_HANDOFF` is not link-shared.** A plain fetch returns a sign-in
   page; `share_file` errors on the "anyone" grant. One setting ("Anyone with
   the link — Viewer") unblocks every later session that needs ChatGPT's
   images.
3. **The promo v1 has no sign-off on record.** The last round is r267 (a
   contact sheet for the 54.6 s cut); no review verdict for it is mirrored
   here. Whether it is finished is Caleb's call, and that call is the next
   thing this project needs.
4. **A 65 MB master is in git** and should be moved to Drive and removed from
   the branch history only if Caleb wants the branch rewritten; otherwise it
   simply must not be repeated.
5. **The five delivered masters live only off-repo.** If they are not in the
   Drive mailbox, the place to look is the machine that rendered r74; the
   source here can re-render any of them (`cd ori_promo/demos/filmN &&
   python3 renderN.py && python3 assembleN.py`, from a directory holding
   `raw/IMG_*.MOV` per `ori_promo/manifest.txt`).
