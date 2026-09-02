# Barkly art direction — the Supercell target, as numbers

Operator ruling, 2026-09-02. The look we are building toward is the Supercell
toy-diorama family. In the operator's own ranking:

1. **Brawl Stars** — the benchmark. Big simple shapes, rounded everything,
   saturated colour, exaggerated proportions, clean shadows, near-zero visual
   noise.
2. **Squad Busters** — the same language pushed into chunky little 3D worlds.
3. **Clash Mini** — *the closest reference for Barkly.* Grass, trees, barrels,
   wagons, water and buildings that read as moulded toys on a board.
4. **mo.co** — how to make the world richer without going realistic.
5. **Zooba** — chunky animal characters in rounded environments.
6. **Smash Legends** — strong silhouettes, soft geometry, punchy lighting.
7. **Pokémon Unite** — how props read clearly from a mobile camera.
8. **Stumble Guys** — crude, but nails physical candy/toy materials.

## Why this file has numbers in it

"It looks washed out" is unfalsifiable and we went several rounds on it. The
art lab (`scripts/art-lab.mjs` + `scripts/art-lab-sheet.py`) measures the world
region of every scene — chrome and the dialogue panel excluded, since UI would
flatter the result — and reports chroma and value statistics. Targets:

| metric | meaning | day target | we were at |
|---|---|---|---|
| `mean_sat` | average chroma | **0.42–0.55** | 0.26–0.42 |
| `p90_sat` | the colourful 10% | **0.65+** | 0.43–0.53 |
| `val_spread` | light-to-dark range | **0.55+** | 0.56–0.64 (fine) |
| `washed_frac` | pixels under 0.18 chroma | **under 12%** | up to 38% |

Value range was never the problem. **Chroma was**, and the dead grey was
concentrated in town and beach.

## The finding that matters

Boosting `src/ui/scenes/artPalette.ts` lifted park (`mean_sat` 0.416 → 0.476,
`p90_sat` 0.525 → 0.665) and home, and did **nothing** for town and beach
(0.256 → 0.241, `washed_frac` 38% → 40%). That is the whole story: those two
scenes are dominated by baked Blender PNGs, so their colour does not live in
the code palette at all. It lives in `tools/blender/*.py` and only changes when
the render workflow runs.

A palette pass alone can therefore never fix town or beach. The grading is
applied at both ends now — the code palette and the Blender materials — using
the same transform, so props and code-drawn scenery stay in one colour family.

## Rules

- **Never judge the art from one screenshot.** Cross-scene problems — a washed
  palette, chrome that only reads wrong beside another location — are invisible
  one frame at a time. Run the contact sheet.
- **Never judge motion from a still.** Idle drift, ear flicks and gesture decay
  had never once been reviewed before the motion strip existed.
- Saturated does not mean noisy. Brawl Stars is loud and *clean*: few shapes,
  big reads, no texture competing with the character.
- Barkly is the most saturated thing on screen and stays that way. The world
  rises to meet him; he does not come down to it.

```bash
npm run build:web && node scripts/build-artifact.mjs --out dist/playtest/index.html
node scripts/art-lab.mjs --html dist/playtest/index.html --out art-lab
python3 scripts/art-lab-sheet.py art-lab/frames art-lab
```
