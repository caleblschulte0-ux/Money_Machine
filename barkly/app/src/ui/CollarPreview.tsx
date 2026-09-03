/**
 * Barkly, wearing the collar you are looking at.
 *
 * The shop drew four collars as four flat swatches on four identical lavender
 * tiles — the same shape, the same background, differing only in hue, which is
 * precisely the "colour is the only thing separating two states" case the
 * visual doctrine rejects. It is also the screen where a player decides to
 * spend, so it is the worst place in the app to be vague about what you get.
 *
 * `VISUAL_DIRECTION_KIDS_GAME.md` item 4 asks for mini Barkly previews wearing
 * the object rather than an icon row. The pieces for it were already here: the
 * approved front render, and one aligned overlay per collar (the same
 * `renders/collars/front_*.png` the live renderer composites onto him). This
 * shows his head and neck through a window with that overlay on top, so each
 * card is HIM in that collar rather than a picture of a collar.
 *
 * Front pose only, and that is not a limitation to fix here: the overlays are
 * derived against the front frame's collar pixels and the three-quarter poses
 * would each need their own derivation (see BarklyPhotoView.FRONT_POSES).
 */

import React from 'react';
import { Image, View } from 'react-native';

const FRONT = require('../../assets/barkly/renders/front.png');

const COLLAR: Record<string, ReturnType<typeof require>> = {
  collar_red: require('../../assets/barkly/renders/collars/front_red.png'),
  collar_blue: require('../../assets/barkly/renders/collars/front_blue.png'),
  collar_green: require('../../assets/barkly/renders/collars/front_green.png'),
  collar_gold: require('../../assets/barkly/renders/collars/front_gold.png'),
};

export function hasCollarPreview(id: string): boolean {
  return id in COLLAR;
}

/*
 * The render is 416x520 and the collar's own pixels occupy y 293-371, measured
 * from the overlay's alpha bounds rather than guessed.
 *
 * A SQUARE window centred so the collar lands in the lower middle, with his
 * chin and muzzle above it. The first cut started at y=52 to get his whole
 * head in, and because the card's window is square it then cropped at y=320 --
 * clipping off all but the top 27px of the collar. The card was selling a
 * collar and showing a face.
 */
const RENDER_W = 416;
const RENDER_H = 520;

/**
 * Two windows onto the same render.
 *
 * `collar` sits low, so a shop CARD sells the collar. `face` sits higher and
 * includes his eyes, because the shop HEADER is answering a different
 * question -- "what does he look like right now" -- and a header cropped like
 * a card is just a fifth collar swatch rather than the dog wearing one.
 */
const CROPS = {
  collar: { x: 74, y: 132, w: 268, h: 268 },
  face: { x: 74, y: 84, w: 268, h: 268 },
} as const;

export type Framing = keyof typeof CROPS;

/**
 * `id` may be null: that is him in his own canon brown collar, which is what
 * the shop header shows before a player has bought anything.
 */
export default function CollarPreview({
  id,
  size,
  framing = 'collar',
}: { id: string | null; size: number; framing?: Framing }) {
  const art = id ? COLLAR[id] : undefined;
  const CROP = CROPS[framing];
  // Fit the window's WIDTH; the height follows, and overflow is clipped.
  const scale = size / CROP.w;
  const frame = {
    position: 'absolute' as const,
    width: RENDER_W * scale,
    height: RENDER_H * scale,
    left: -CROP.x * scale,
    top: -CROP.y * scale,
  };
  return (
    <View
      style={{ width: size, height: Math.min(size, CROP.h * scale), overflow: 'hidden' }}
      pointerEvents="none"
    >
      <Image source={FRONT} style={frame} resizeMode="contain" />
      {art ? <Image source={art} style={frame} resizeMode="contain" /> : null}
    </View>
  );
}
