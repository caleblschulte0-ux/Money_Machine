# Barkly character assets

Canon reference: [`../../../docs/CHARACTER.md`](../../../docs/CHARACTER.md) — the design is **locked**.

## Current files

| Path | What | Status |
|---|---|---|
| `concept/barkly-concept.png` | The approved concept sheet ("Barkley – Concept 3") — visual source of truth. | **Committed.** |
| `renders/front.png` | Front view, cut from the sheet (background removed). Default pose in-app. | **Committed.** |
| `renders/side.png` | Side view — used for sleeping. | **Committed.** |
| `renders/three_quarter.png` | 3/4 view — used for playing/excited. | **Committed.** |
| `renders/face.png` | Expression closeup — used for thinking/annoyed zoom beats. | **Committed.** |

| `renders/front_mouth_open.png` | Front view with painted open mouth — alternated with `front.png` for jaw-flap while speaking. | **Committed** (derived from front.png). |
| `renders/front_blink.png` | Front view with painted closed eyes — used for blinks. | **Committed** (derived from front.png). |

The app's default renderer (`src/ui/BarklyPhotoView.tsx`) shows these real
renders with whole-image motion (breathe, bounce, tilt, talk-bob, sway),
plus real jaw-flap and blinking via the derived frames above.

> Generation attempt log: the Shorts-pipeline `GEMINI_API_KEY` is free-tier —
> `gemini-2.5-flash-image` has zero free quota and the free 2.0 image models
> are retired (404s), so CI generation produced nothing. The per-state set
> below still needs ChatGPT (request relayed to the Open Range session) or a
> billed image API key.
`src/ui/BarklyView.tsx` is a hand-drawn vector fallback
(`EXPO_PUBLIC_BARKLY_RENDERER=vector`).

## Wanted next: per-state renders (paste this to the image model that made the sheet)

The original sheet came out of ChatGPT's image generation — the fastest
quality upgrade is more renders in the identical style. Paste the brief below
along with `concept/barkly-concept.png` as the reference image, generate each
pose, and drop the results into `renders/states/<name>.png` (transparent or
plain light background; the app pipeline strips backgrounds).

> Using the attached "Barkley – Concept 3" sheet as the exact character
> reference — same clay/vinyl toy render style, same proportions, materials,
> lighting, and palette (mustard tan / cream / charcoal), same thick collar
> with brass buckle and round brass "B" tag, same striped knit-sock front
> paws, snaggletooth, ring tail curl — render the SAME character, front view,
> full body, centered on a plain light background, one image per pose:
>
> 1. `listening.png` — ears perked up and forward, head tilted slightly, eyes a little wider
> 2. `speaking_open.png` — mouth open mid-bark/talk, tongue slightly visible
> 3. `speaking_closed.png` — same stance, mouth closed (for jaw-flap alternation)
> 4. `happy.png` — subtle smile, tail curl raised, relaxed ears
> 5. `excited.png` — mid-hop, ears up, mouth open happy
> 6. `annoyed.png` — deeper eyelids, flat stare, slight head turn
> 7. `sleepy.png` — lying down curled, eyes closed
> 8. `eating.png` — head lowered over a small charcoal food bowl
> 9. `playing.png` — play-bow, front down, rump up, tail curl high
>
> Do not restyle the character. No new markings, no extra props beyond the
> bowl, no background scenery.

When those land, extend `POSE_SIZE`/`poseFor` in `BarklyPhotoView.tsx` —
ten-minute change, the contract already supports it.

## Production path

Long-term the character should be a **Rive** rig (state-machine inputs map
1:1 onto `BarklyState` + `BodyAction` — see `src/animation/renderer.ts`), so
the jaw, ears, eyelids, and tail animate as parts instead of pose swaps.
Live2D/Spine/3D remain viable behind the same contract.
