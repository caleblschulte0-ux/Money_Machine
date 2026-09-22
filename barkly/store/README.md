# App Store listing — Barkly

Everything App Store Connect asks for that is text, in one place, so the
listing is reviewed in a pull request like code. Nothing here is a legal or
compliance claim; `docs/APP_STORE_RELEASE.md` lists what is still human-gated.

| Field | File | Limit |
|---|---|---|
| Name | `name.txt` | 30 |
| Subtitle | `subtitle.txt` | 30 |
| Promotional text | `promotional.txt` | 170 |
| Description | `description.txt` | 4000 |
| Keywords | `keywords.txt` | 100, comma-separated |
| What's new (1.0) | `whats-new.txt` | 4000 |
| App Review notes | `review-notes.md` | — |
| Privacy nutrition labels (draft) | `privacy-labels.md` | — |
| Age rating answers (draft) | `age-rating.md` | — |
| URLs | `urls.txt` | — |

Screenshots: `npm run store:screenshots` in `barkly/app` (with the playtest
build served on :8099) renders six 6.7" (1290×2796) and six 6.1" (1179×2556)
frames into `store/screenshots/`, pinned to 2pm so the world is in daylight.
That folder is gitignored — twelve frames are ~23MB. Upload them from there. They
are the app's real screens at exact pixel sizes, not device captures; replace
them with TestFlight captures once a physical pass exists.
