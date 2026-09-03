/**
 * Barkly's stash, DRAWN.
 *
 * The 24 treasures in `world/stash.ts` are the collectible spine of the game
 * and the funniest writing in it — "a rock that looks like a duck", "a very
 * old sandwich (do not ask)", "one crab claw (the crab was fine)". Until now
 * the only place a player could see what Barkly owns was a bulleted list of
 * those strings inside the SETTINGS sheet, which is where an app puts its
 * cache size. A collection you cannot look at is not a collection.
 *
 * So every treasure is a real drawing, in the world's palette, in the same
 * material language as `ItemIcon` (base + shade + one highlight). Three pairs
 * share a drawing because the objects genuinely are the same object:
 *   - `duck_rock` and `pebble` are both stones (the duck one gets the bill);
 *   - `good_stick` and `driftwood` are both sticks (driftwood goes pale).
 * Nothing else is grouped. `caps` and `button` briefly did and it looked like
 * a rendering bug on the shelf, where they sit two tiles apart. If a treasure ever has no drawing it falls back to
 * a wrapped lump rather than an emoji or a blank — see `TREASURE_ART`.
 */

import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { BALL, BRASS, ITEM, LEAF, TREASURE as T } from './scenes/artPalette';


const V = '0 0 30 30';

/* ---------------------------------------------------------------- park ---- */

const Sock = () => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Path d="M11 5 h7 v12 q0 4 4 5 l3 1 q2 1 1 3 -1 2 -3 2 h-8 q-6 0 -6 -6 V5 Z" fill={T.clothShade} />
    <Path d="M11 5 h5 v12 q0 4 4 5 l3 1 q2 1 1 3 -1 1 -2 1 -6 -1 -8 -4 -3 -4 -3 -9 Z" fill={T.cloth} />
    <Rect x={10.4} y={4} width={8.2} height={3.4} rx={1.2} fill={T.clothCuff} />
  </Svg>
);

const HalfBall = () => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Path d="M4 18 a11 11 0 0 1 22 0 Z" fill={BALL.body} />
    <Path d="M4 18 a11 11 0 0 1 6.5 -10 q3 5 3 10 Z" fill={BALL.gloss} opacity={0.32} />
    <Path d="M4 18 h22 v2.4 q-11 3 -22 0 Z" fill={BALL.edge} />
    <Path d="M9 18 q6 -4 12 0" stroke={BALL.seam} strokeWidth={1.4} fill="none" />
  </Svg>
);

const Stone = ({ duck = false }: { duck?: boolean }) => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Path d="M5 20 q-1 -8 7 -10 q9 -2 12 5 q2 6 -5 8 q-11 3 -14 -3 Z" fill={T.stone} />
    <Path d="M7 15 q3 -5 9 -5 q5 0 7 3 -8 -1 -16 2 Z" fill={T.stoneLight} />
    <Path d="M5 20 q6 4 14 1 q5 -2 5 -5 1 6 -6 8 -11 3 -13 -4 Z" fill={T.stoneShade} />
    {duck && (
      <G>
        <Circle cx={20.6} cy={11.6} r={1} fill={T.ink} />
        <Path d="M23.4 12.4 h4 q1 0 1 1 0 1 -1 1 h-4 Z" fill={T.bill} />
      </G>
    )}
  </Svg>
);

const Stick = ({ pale = false }: { pale?: boolean }) => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Path
      d="M4 22 q6 -6 10 -8 q4 -2 12 -8"
      stroke={pale ? T.boneShade : ITEM.stick}
      strokeWidth={4.2}
      strokeLinecap="round"
      fill="none"
    />
    <Path
      d="M5 21 q6 -6 10 -8 q4 -2 11 -7"
      stroke={pale ? T.paper : ITEM.stickLight}
      strokeWidth={1.6}
      strokeLinecap="round"
      fill="none"
    />
    <Path d="M13 14 l-4 -4" stroke={pale ? T.boneShade : ITEM.stick} strokeWidth={2.6} strokeLinecap="round" />
  </Svg>
);

const Bone = () => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Path d="M8 12 h14 v6 H8 Z" fill={T.bone} />
    <Circle cx={7.5} cy={11.5} r={4} fill={T.bone} />
    <Circle cx={7.5} cy={18.5} r={4} fill={T.bone} />
    <Circle cx={22.5} cy={11.5} r={4} fill={T.bone} />
    <Circle cx={22.5} cy={18.5} r={4} fill={T.bone} />
    <Path d="M8 17 h14 v1.6 H8 Z" fill={T.boneShade} opacity={0.7} />
    <Path d="M9 12.6 h11" stroke={T.shine} strokeWidth={1.2} strokeLinecap="round" opacity={0.85} />
  </Svg>
);

const Frisbee = () => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Ellipse cx={15} cy={17.4} rx={11.5} ry={5} fill={T.discShade} />
    <Ellipse cx={15} cy={15} rx={11.5} ry={5} fill={T.disc} />
    <Ellipse cx={15} cy={15} rx={6.6} ry={2.6} fill={T.discShade} opacity={0.55} />
    <Path d="M6 13 q5 -3 12 -2" stroke={T.shine} strokeWidth={1.4} strokeLinecap="round" fill="none" opacity={0.7} />
  </Svg>
);

const Discs = () => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Circle cx={10} cy={19} r={6} fill={BRASS.shade} />
    <Circle cx={10} cy={18} r={6} fill={BRASS.mid} />
    <Circle cx={10} cy={18} r={3.2} fill={BRASS.light} />
    <Circle cx={20} cy={13} r={5.4} fill={T.crabShade} />
    <Circle cx={20} cy={12} r={5.4} fill={T.crab} />
    <Circle cx={20} cy={12} r={2.8} fill={T.shell} />
    <Circle cx={18.6} cy={10.6} r={1} fill={T.shine} opacity={0.8} />
  </Svg>
);

/** One button, four holes — a bottle-cap pile and a button are not twins. */
const Button = () => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Circle cx={15} cy={16.4} r={9.6} fill={T.discShade} />
    <Circle cx={15} cy={15} r={9.6} fill={T.disc} />
    <Circle cx={15} cy={15} r={7} fill={T.seaGlass} opacity={0.35} />
    <Circle cx={12.4} cy={12.6} r={1.5} fill={T.discShade} />
    <Circle cx={17.6} cy={12.6} r={1.5} fill={T.discShade} />
    <Circle cx={12.4} cy={17.6} r={1.5} fill={T.discShade} />
    <Circle cx={17.6} cy={17.6} r={1.5} fill={T.discShade} />
    <Path d="M9 11 q3 -3 7 -3" stroke={T.shine} strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.75} />
  </Svg>
);

const Acorn = () => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Path d="M9 14 q6 12 12 0 q-6 -3 -12 0 Z" fill={T.leatherShade} />
    <Path d="M9.6 14 q5.6 10 10.8 0 q-5.4 -2.6 -10.8 0 Z" fill={T.leather} />
    <Path d="M7.6 10 q7.4 -4 14.8 0 q1 4 -7.4 4 -8.4 0 -7.4 -4 Z" fill={LEAF.dark} />
    <Path d="M9 9.4 q6 -2.6 12 0" stroke={LEAF.mid} strokeWidth={1.4} strokeLinecap="round" fill="none" />
    <Path d="M15 7.4 v-3" stroke={LEAF.dark} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

const Glove = () => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Path d="M9 26 v-9 q0 -3 3 -3 h9 q3 0 3 3 v9 Z" fill={T.clothShade} />
    <Path d="M9 26 v-9 q0 -3 3 -3 h5 v12 Z" fill={T.cloth} />
    <Path d="M12 14 v-6 q0 -1.6 1.6 -1.6 1.6 0 1.6 1.6 v6" fill={T.cloth} />
    <Path d="M16.4 14 v-8 q0 -1.6 1.6 -1.6 1.6 0 1.6 1.6 v8" fill={T.clothShade} />
    <Path d="M20.8 14 v-6 q0 -1.6 1.6 -1.6 1.6 0 1.6 1.6 v6" fill={T.clothShade} />
    <Path d="M9 12 q-3 1 -3 4 0 3 3 3" fill={T.cloth} />
    <Rect x={8.4} y={23} width={16.2} height={3} rx={1.2} fill={T.clothCuff} />
  </Svg>
);

const Sandwich = () => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Path d="M4 20 L15 6 L26 20 Z" fill={T.breadShade} />
    <Path d="M6 18.6 L15 7.4 L24 18.6 Z" fill={T.bread} />
    <Path d="M7.6 16.6 q7.4 3 14.8 0 -1 2 -7.4 2 -6.4 0 -7.4 -2 Z" fill={T.filling} />
    <Path d="M4 20 h22 v2.2 q-11 2 -22 0 Z" fill={T.breadShade} />
    <Circle cx={11} cy={12} r={0.9} fill={LEAF.grey} opacity={0.9} />
    <Circle cx={17.4} cy={13.6} r={1.1} fill={LEAF.grey} opacity={0.9} />
  </Svg>
);

const Feather = () => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Path d="M23 5 q-14 4 -17 18 q12 -1 17 -18 Z" fill={T.discShade} opacity={0.55} />
    <Path d="M23 5 q-12 5 -15 16 q11 -2 15 -16 Z" fill={T.disc} />
    <Path d="M23 5 L6 23" stroke={T.paper} strokeWidth={1.5} strokeLinecap="round" />
    <Path d="M18 9 l-6 5 M20 12 l-7 6" stroke={T.paper} strokeWidth={0.9} opacity={0.65} />
  </Svg>
);

const RubberDuck = () => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Ellipse cx={14} cy={20} rx={9.5} ry={5.6} fill={T.rubberShade} />
    <Ellipse cx={14} cy={19} rx={9.5} ry={5.6} fill={T.rubber} />
    <Circle cx={19.5} cy={11.5} r={5.4} fill={T.rubber} />
    <Circle cx={17.8} cy={10.4} r={1.1} fill={T.ink} />
    <Path d="M24 11.4 h4.2 q0.8 0 0.8 1 0 1 -0.8 1 H24 Z" fill={T.bill} />
    <Path d="M7 17.6 q5 -3 9 -1" stroke={T.shine} strokeWidth={1.3} strokeLinecap="round" fill="none" opacity={0.7} />
  </Svg>
);

const MapScrap = () => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Path d="M5 7 l7 2 l6 -2 l7 2 v14 l-7 -2 l-6 2 l-7 -2 Z" fill={T.paperShade} />
    <Path d="M6 8 l6 1.8 l6 -1.8 l6 1.8 v11.6 l-6 -1.8 l-6 1.8 l-6 -1.8 Z" fill={T.paper} />
    <Path d="M12 9.8 v11.6 M18 8 v11.6" stroke={T.paperShade} strokeWidth={0.9} />
    <Path d="M8 16 q4 -4 8 -1 q3 2 6 -1" stroke={T.ink} strokeWidth={1} strokeDasharray="2 1.6" fill="none" />
    <Path d="M20.4 12.6 l2.4 2.4 M22.8 12.6 l-2.4 2.4" stroke={T.crabShade} strokeWidth={1.6} strokeLinecap="round" />
  </Svg>
);

/* --------------------------------------------------------------- beach ---- */

const Shell = () => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Path d="M15 4 q11 4 9 14 -2 8 -9 8 -7 0 -9 -8 -2 -10 9 -14 Z" fill={T.shellShade} />
    <Path d="M15 5.6 q9 4 7.6 12.4 -1.6 6.6 -7.6 6.6 -6 0 -7.6 -6.6 Q6 9.6 15 5.6 Z" fill={T.shell} />
    <Path d="M15 6 v18 M10 8 q-1 9 2 15 M20 8 q1 9 -2 15" stroke={T.shellShade} strokeWidth={1.1} fill="none" />
  </Svg>
);

const SeaGlass = () => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Path d="M7 19 q-2 -8 6 -10 q9 -2 11 4 q2 7 -7 8 q-8 1 -10 -2 Z" fill={T.seaGlassShade} />
    <Path d="M8 18 q-1.6 -6.6 5.4 -8.4 q7.6 -1.8 9.4 3.4 q1.6 5.6 -6 6.6 -6.8 0.8 -8.8 -1.6 Z" fill={T.seaGlass} />
    <Path d="M11 13 q3 -2 7 -1.6" stroke={T.shine} strokeWidth={1.4} strokeLinecap="round" fill="none" opacity={0.75} />
  </Svg>
);

const CrabClaw = () => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Path d="M4 24 q4 -4 8 -6" stroke={T.crabShade} strokeWidth={3.6} strokeLinecap="round" fill="none" />
    <Path d="M12 18 q6 -6 12 -4 q3 1 2 4 -1 3 -6 3 -5 0 -8 -3 Z" fill={T.crab} />
    <Path d="M12 18 q5 -2 11 -1 q2 0 2 1 -1 2 -5 2 -5 0 -8 -2 Z" fill={T.crabShade} />
    <Path d="M14 15.6 q6 -5 11 -2" stroke={T.shell} strokeWidth={1.3} strokeLinecap="round" fill="none" />
  </Svg>
);

const Bottle = () => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Path d="M12 10 h6 v3 q4 2 4 6 v7 q0 2 -2 2 h-10 q-2 0 -2 -2 v-7 q0 -4 4 -6 Z" fill={T.seaGlassShade} />
    <Path d="M12 10 h3 v3 q-3 2 -3 6 v9 h-2 q-2 0 -2 -2 v-7 q0 -4 4 -6 Z" fill={T.seaGlass} />
    <Rect x={11.6} y={5.4} width={6.8} height={5} rx={1.4} fill={T.leather} />
    <Path d="M13 19 h5 v6 h-5 Z" fill={T.paper} />
    <Path d="M14 21 h3 M14 23 h3" stroke={T.ink} strokeWidth={0.9} strokeLinecap="round" />
  </Svg>
);

const Starfish = () => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Path d="M15 3 l3.6 8.4 L28 12.6 l-6.8 6.2 L23 28 L15 23.2 L7 28 l1.8 -9.2 L2 12.6 l9.4 -1.2 Z" fill={T.shellShade} />
    <Path d="M15 5.6 l3 7 l7.6 1 -5.6 5.2 1.6 7.4 L15 22.4 l-6.6 3.8 1.6 -7.4 -5.6 -5.2 7.6 -1 Z" fill={T.crab} />
    <Circle cx={15} cy={14.6} r={1.2} fill={T.shell} />
    <Circle cx={12} cy={17} r={0.9} fill={T.shell} />
    <Circle cx={18} cy={17} r={0.9} fill={T.shell} />
  </Svg>
);

const FlipFlop = () => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Path d="M15 3 q7 0 7 8 v11 q0 6 -7 6 -7 0 -7 -6 V11 q0 -8 7 -8 Z" fill={T.rubberShade} />
    <Path d="M15 4.4 q5.6 0 5.6 6.6 v11 q0 4.6 -5.6 4.6 -5.6 0 -5.6 -4.6 V11 q0 -6.6 5.6 -6.6 Z" fill={T.rubber} />
    <Path d="M15 12 L10 7 M15 12 l5 -5" stroke={T.crab} strokeWidth={2.4} strokeLinecap="round" />
    <Circle cx={15} cy={12.4} r={1.6} fill={T.crabShade} />
  </Svg>
);

const Kelp = () => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Path d="M9 27 q3 -8 1 -13 -2 -5 3 -8" stroke={T.kelp} strokeWidth={3} strokeLinecap="round" fill="none" />
    <Path d="M20 27 q-2 -9 1 -14" stroke={T.kelpLight} strokeWidth={2.4} strokeLinecap="round" fill="none" />
    <Ellipse cx={7.4} cy={16} rx={3} ry={1.8} fill={T.kelp} transform="rotate(-24 7.4 16)" />
    <Ellipse cx={13.4} cy={10.4} rx={3} ry={1.8} fill={T.kelpLight} transform="rotate(22 13.4 10.4)" />
    <Ellipse cx={23.4} cy={17} rx={2.8} ry={1.7} fill={T.kelp} transform="rotate(28 23.4 17)" />
  </Svg>
);

const SharkTooth = () => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Path d="M6 6 h18 q-2 12 -9 20 -7 -8 -9 -20 Z" fill={T.boneShade} />
    <Path d="M7.6 7.4 h12 q-1.6 10 -6 17.2 -4.4 -7.2 -6 -17.2 Z" fill={T.bone} />
    <Path d="M6 6 h18 v2.4 H6 Z" fill={T.stoneShade} opacity={0.5} />
  </Svg>
);

/** Anything without a drawing: a lump in a rag, which is honest about it. */
const Unknown = () => (
  <Svg width="100%" height="100%" viewBox={V}>
    <Path d="M6 22 q0 -9 9 -9 9 0 9 9 z" fill={T.clothShade} />
    <Path d="M7.6 22 q0 -7.4 7.4 -7.4 v7.4 z" fill={T.cloth} />
    <Path d="M15 13 q-3 -4 0 -6 q3 2 0 6 Z" fill={T.clothCuff} />
  </Svg>
);

const TREASURE_ART: Record<string, React.ReactElement> = {
  // park
  sock: <Sock />,
  half_ball: <HalfBall />,
  duck_rock: <Stone duck />,
  good_stick: <Stick />,
  mystery_bone: <Bone />,
  frisbee: <Frisbee />,
  caps: <Discs />,
  acorn: <Acorn />,
  glove: <Glove />,
  sandwich: <Sandwich />,
  button: <Button />,
  feather: <Feather />,
  tiny_duck: <RubberDuck />,
  map: <MapScrap />,
  // beach
  shell: <Shell />,
  sea_glass: <SeaGlass />,
  driftwood: <Stick pale />,
  crab_claw: <CrabClaw />,
  bottle: <Bottle />,
  starfish: <Starfish />,
  flip_flop: <FlipFlop />,
  kelp: <Kelp />,
  shark_tooth: <SharkTooth />,
  pebble: <Stone />,
};

export function hasTreasureArt(id: string): boolean {
  return id in TREASURE_ART;
}

export default function TreasureIcon({ id, size = 30 }: { id: string; size?: number }) {
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {TREASURE_ART[id] ?? <Unknown />}
    </View>
  );
}

