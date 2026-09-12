/**
 * Every purchasable thing, DRAWN.
 *
 * The shop and the food picker used the `icon` emoji on each item: 🔴 for the
 * red collar, ⚽ for the squeaky ball, 🧀 for the cheese. Emoji are rendered by
 * the operating system in its own art style, at its own colour saturation,
 * with its own idea of gloss — so a photoreal football sat two rows under a
 * hand-modelled dog, and the four collars were the flat primary discs from a
 * colour picker. It is the single loudest "nobody drew this" signal in the
 * app, and it appears on the screen where the player is deciding to spend.
 *
 * These are the same objects, drawn in the world's palette. The collar is a
 * real collar — leather band, brass buckle, hanging tag — tinted per item, so
 * the swatch shows the THING you are buying rather than the colour it happens
 * to be.
 *
 * Deliberately not tokenised: these are art, like the scenes and the mascot.
 * The palette lives in scenes/artPalette.
 *
 * SECOND PASS. Drawing them by hand fixed the emoji, but it left the app
 * saying the same object two different ways: the dock under Barkly shows a
 * rendered 3D care tray, and the sheet that opens off it drew the biscuit as
 * a flat white bone. The nine purchasable things are now the SAME modular
 * Blender pack the world props come from -- same camera, same light rig, same
 * palette -- so a biscuit in the shop is the biscuit in his bowl. The three
 * that have no render yet (bed, rug, window) keep their drawing, and the
 * drawings ALL stay: they are the fallback if an image fails to load, and the
 * only art at sizes where a photo of a 3D object turns to mush.
 */

import React from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { BALL, BRASS, DIORAMA, ITEM } from './scenes/artPalette';

/**
 * The rendered pack, keyed by item id. Anything absent here falls through to
 * the drawing below -- that is the contract, so adding a render is one line
 * and removing one cannot leave a hole.
 */
const RENDERED: Record<string, { source: number; aspect: number }> = {
  treat_biscuit: { source: require('../../assets/world/item/treat_biscuit.png'), aspect: 224 / 156 },
  treat_cheese: { source: require('../../assets/world/item/treat_cheese.png'), aspect: 224 / 218 },
  treat_steak: { source: require('../../assets/world/item/treat_steak.png'), aspect: 224 / 157 },
  toy_ball: { source: require('../../assets/world/item/toy_ball.png'), aspect: 224 / 210 },
  toy_rope: { source: require('../../assets/world/item/toy_rope.png'), aspect: 224 / 90 },
  collar_red: { source: require('../../assets/world/item/collar_red.png'), aspect: 224 / 144 },
  collar_blue: { source: require('../../assets/world/item/collar_blue.png'), aspect: 224 / 144 },
  collar_green: { source: require('../../assets/world/item/collar_green.png'), aspect: 224 / 144 },
  collar_gold: { source: require('../../assets/world/item/collar_gold.png'), aspect: 224 / 144 },
  kit_bowl: { source: require('../../assets/world/item/kit_bowl.png'), aspect: 224 / 130 },
  kit_stick: { source: require('../../assets/world/item/kit_stick.png'), aspect: 224 / 103 },
  home_bed: { source: require('../../assets/world/home/props/bed.png'), aspect: 546 / 193 },
};

/** Slightly darker sibling of a hex, for the shaded side of a shape. */
function shade(hex: string, amount = 0.78): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * amount));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function Collar({ tint }: { tint: string }) {
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      {/* the band, curving as a worn collar does rather than lying flat */}
      <Path d="M3 11 q12 6 24 0 v6 q-12 6 -24 0 Z" fill={tint} />
      <Path d="M3 11 q12 6 24 0 v2 q-12 6 -24 0 Z" fill={shade(tint, 1.18)} />
      <Path d="M3 15 q12 6 24 0 v2 q-12 6 -24 0 Z" fill={shade(tint)} />
      {/* buckle */}
      <Rect x={11.5} y={12} width={7} height={6.4} rx={1.4} fill={BRASS.dark} />
      <Rect x={12.6} y={13} width={4.8} height={4.4} rx={1} fill={BRASS.light} />
      {/* the tag he is never without */}
      <Path d="M15 18.6 v1.6" stroke={BRASS.dark} strokeWidth={1.2} />
      <Circle cx={15} cy={22.6} r={3.1} fill={BRASS.polished} />
      <Circle cx={15} cy={22.6} r={2.1} fill={BRASS.warm} />
    </Svg>
  );
}

function Biscuit() {
  // One clean bone. The first version was a rotated bone with a second bar
  // under it and at 30px the pair read as debris rather than a biscuit.
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      <Path
        d="M8 15 h14"
        stroke={ITEM.biscuit}
        strokeWidth={6}
        strokeLinecap="butt"
      />
      <Circle cx={7.6} cy={12.2} r={3.6} fill={ITEM.biscuit} />
      <Circle cx={7.6} cy={17.8} r={3.6} fill={ITEM.biscuit} />
      <Circle cx={22.4} cy={12.2} r={3.6} fill={ITEM.biscuit} />
      <Circle cx={22.4} cy={17.8} r={3.6} fill={ITEM.biscuit} />
      <Path d="M11 18.4 h8" stroke={ITEM.biscuitEdge} strokeWidth={1.4} strokeLinecap="round" opacity={0.6} />
    </Svg>
  );
}

function Cheese() {
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      <Path d="M4 20 L24 8 L26 20 Z" fill={ITEM.cheese} />
      <Path d="M4 20 L26 20 L26 23 L4 23 Z" fill={ITEM.cheeseEdge} />
      <Circle cx={16} cy={16} r={2.1} fill={ITEM.cheeseHole} />
      <Circle cx={21} cy={14} r={1.4} fill={ITEM.cheeseHole} />
      <Circle cx={11} cy={18} r={1.2} fill={ITEM.cheeseHole} />
    </Svg>
  );
}

function Steak() {
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      <Path d="M6 15 q1 -8 10 -8 q10 0 10 8 q0 8 -10 8 q-9 0 -10 -8 Z" fill={ITEM.steak} stroke={ITEM.steakEdge} strokeWidth={1.2} />
      <Path d="M8 12 q3 -4 8 -4" stroke={ITEM.steakFat} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Path d="M24 13 q3 2 2 5 q-1 3 -4 3" stroke={ITEM.steakFat} strokeWidth={2.8} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function SqueakyBall() {
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      <Circle cx={15} cy={16} r={11} fill={BALL.body} />
      <Path d="M4 14 C11 9 19 9 26 14" stroke={BALL.seam} strokeWidth={2.2} fill="none" />
      <Circle cx={10.5} cy={11} r={3} fill={BALL.gloss} opacity={0.34} />
    </Svg>
  );
}

function Rope() {
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      <Path d="M6 15 q5 -5 10 0 q5 5 9 0" stroke={ITEM.rope} strokeWidth={7} strokeLinecap="round" fill="none" />
      <Path d="M6 15 q5 -5 10 0 q5 5 9 0" stroke={ITEM.ropeShade} strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.6} />
      <Path d="M4 15 l -2 -4 M4 15 l -2 4 M26 15 l 2 -4 M26 15 l 2 4" stroke={ITEM.ropeShade} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function Bed() {
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      <Ellipse cx={15} cy={18} rx={12} ry={6} fill={ITEM.bedRim} />
      <Ellipse cx={15} cy={16.6} rx={10.4} ry={4.8} fill={ITEM.bed} />
      <Ellipse cx={15} cy={18} rx={8.4} ry={3.4} fill={ITEM.bedCushion} />
      <Path d="M3 18 a12 6 0 0 0 24 0 a12 7 0 0 1 -24 0 Z" fill={ITEM.bedRim} />
    </Svg>
  );
}

function Rug() {
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      <Ellipse cx={15} cy={16} rx={13} ry={7} fill={ITEM.rugEdge} />
      <Ellipse cx={15} cy={16} rx={11} ry={5.6} fill={ITEM.rug} />
      <Ellipse cx={15} cy={16} rx={8} ry={3.8} fill={ITEM.rugInner} />
      <Ellipse cx={15} cy={16} rx={4.6} ry={2} fill={ITEM.rug} />
    </Svg>
  );
}

function Window() {
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      <Rect x={5} y={5} width={20} height={19} rx={2.6} fill={ITEM.glassSill} />
      <Rect x={7.4} y={7.4} width={15.2} height={14.2} rx={1.4} fill={ITEM.glass} />
      <Rect x={14.2} y={7.4} width={1.6} height={14.2} fill={ITEM.glassSill} />
      <Rect x={7.4} y={13.6} width={15.2} height={1.6} fill={ITEM.glassSill} />
      <Rect x={3.6} y={23.4} width={22.8} height={2.6} rx={1.3} fill={ITEM.glassSill} />
    </Svg>
  );
}

/** The bowl, which is not bought — it is what "just feed him" uses. */
export function BowlIcon() {
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      <Ellipse cx={15} cy={13.6} rx={10.4} ry={3.4} fill={ITEM.biscuitEdge} />
      <Path d="M4.6 13.6 a10.4 3.4 0 0 0 20.8 0 l -2.6 8.2 a8 3 0 0 1 -15.6 0 Z" fill={BRASS.shade} />
      <Ellipse cx={15} cy={13.4} rx={8.2} ry={2.5} fill={ITEM.biscuit} />
    </Svg>
  );
}

const BY_ID: Record<string, React.ReactElement> = {
  treat_biscuit: <Biscuit />,
  treat_cheese: <Cheese />,
  treat_steak: <Steak />,
  toy_ball: <SqueakyBall />,
  toy_rope: <Rope />,
  home_bed: <Bed />,
  home_rug: <Rug />,
  home_window: <Window />,
};

/**
 * Draw an item. `tint` is only read for collars, which are one shape in four
 * colours rather than four different objects.
 *
 * `size` scales the drawing without touching it. Every icon here is authored
 * at 30x30, and the shop needs them big enough to be the thing you are looking
 * at rather than a bullet point beside a row of text -- re-authoring nine
 * SVGs at a second size to get that would be nine chances for the two to
 * drift.
 */
export default function ItemIcon({ id, tint, size = 30 }: { id: string; tint?: string; size?: number }) {
  const [renderFailed, setRenderFailed] = React.useState(false);
  const rendered = renderFailed ? undefined : RENDERED[id];
  if (rendered) {
    // Fit the render inside the caller's square without cropping it: a rope is
    // nearly three times as wide as it is tall, and letting it fill a square
    // box would either stretch it or chop the frayed ends off.
    const width = rendered.aspect >= 1 ? size : size * rendered.aspect;
    const height = rendered.aspect >= 1 ? size / rendered.aspect : size;
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Image
          source={rendered.source}
          style={{ width, height }}
          resizeMode="contain"
          onError={() => setRenderFailed(true)}
        />
      </View>
    );
  }
  const art = id.startsWith('collar_') ? <Collar tint={tint ?? ITEM.leather} /> : BY_ID[id] ?? <Rug />;
  if (size === 30) return art;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ transform: [{ scale: size / 30 }] }}>{art}</View>
    </View>
  );
}

/**
 * The soft shadow an item stands on.
 *
 * The first version was a flat rounded rectangle at 16% scrim. On the pale
 * panes the shop uses that is a crisp grey bar with hard ends -- it read as a
 * progress bar under the biscuit, not as a shadow. A shadow has no edge, so
 * this is a radial fade, which is the only way to get one without a blur.
 *
 * Sized by the caller, because it has to match the object standing on it.
 */
export function ItemStand({ width }: { width: number }) {
  const id = React.useId();
  const height = Math.max(5, width * 0.2);
  return (
    <Svg width={width} height={height}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={DIORAMA.shadow} stopOpacity={0.3} />
          <Stop offset="0.5" stopColor={DIORAMA.shadow} stopOpacity={0.15} />
          <Stop offset="1" stopColor={DIORAMA.shadow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill={`url(#${id})`} />
    </Svg>
  );
}
