import React, { useEffect, useRef } from 'react';
import { Animated, ColorValue, Easing, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { useReduceMotion } from '../motion';
import { radius } from '../theme';
import { BRASS, DIORAMA, ITEM } from './artPalette';

/**
 * The room shade's transparent end: its own colour, at zero.
 *
 * NOT `CLEAR`, and not transparent black. A gradient stop is interpolated in
 * RGB, so a warm wall crossing to #00000000 dips through mud at the halfway
 * point. Fading to the shade's own colour at zero alpha keeps the hue constant
 * across the whole run and moves only the amount.
 *
 * Built with `alpha()` rather than written out: this was 'rgba(36,62,81,0)',
 * which is exactly `DIORAMA.roomShade` and is a second copy of it the moment
 * anyone edits the palette.
 */
const ROOM_SHADE_CLEAR = alpha(DIORAMA.roomShade, 0);

/**
 * How deep the far side of the room goes, per time of day.
 *
 * The STRENGTH is a layer opacity rather than an alpha baked into the gradient
 * stop, so `DIORAMA.roomShade` stays the one place the colour is written and
 * this is the one place its amount is. Two dials, each in one file.
 *
 * Morning is the strongest because a low sun through a window throws the
 * hardest light and therefore the deepest room behind it -- the same reason
 * the outdoor scenes went to a 26-degree sun in this pass. Midday is the
 * flattest hour indoors for exactly the reason it was outdoors.
 */
const ROOM_SHADE_STRENGTH: Partial<Record<SkyBand, number>> = {
  morning: 0.40,
  day: 0.34,
  evening: 0.44,
};
import { skyBand, SkyBand } from './CandyScenesV2';
import { alpha, crescentPath, RadialGlow, SCENE_CAMERA, WorldLayer, WorldLighting, WorldMotion, WorldObject, WorldScene, worldScale } from './WorldScene';
import { BiographyProp } from '../../world/biography';

const CHAIR = require('../../../assets/world/home/props/chair.png');
const LAMP = require('../../../assets/world/home/props/lamp.png');
const BED = require('../../../assets/world/home/props/bed.png');
const RUG = require('../../../assets/world/home/props/rug.png');
const SHELF = require('../../../assets/world/home/props/shelf.png');
const WINDOW_FRAME = require('../../../assets/world/home/architecture/window_frame.png');
const SKIRTING = require('../../../assets/world/home/props/skirting.png');
const NEAR_FLOOR = require('../../../assets/world/home/props/near_floor.png');
/** The near-ground band's own aspect. __tests__/scene_surfaces.test.ts holds it. */
/*
 * THE FURNITURE'S SHAPE, FROM THE FILES ON DISK.
 *
 * Same defect the outdoor props had, and worse here because the ratios were
 * written as literals in the middle of a layout: the chair was drawn at
 * 398/374, the lamp at exactly 2, the bed at 254/512 and the shelf at
 * 481/298, none of which were what the renders measured. The bed was being
 * stretched 40% taller than it is. Only a WIDTH is chosen now.
 *
 * `npm run check:aspects` restates these from the real PNGs -- it resolves a
 * lock by the require path in this file, which is what lets LAMP_ASPECT
 * and the town's LAMP_ASPECT both exist.
 */
const WINDOW_FRAME_ASPECT = 461 / 500;
const CHAIR_ASPECT = 341 / 343;
const LAMP_ASPECT = 238 / 509;
const BED_ASPECT = 534 / 181;
const SHELF_ASPECT = 286 / 433;

const NEAR_FLOOR_ASPECT = 640 / 47;
const PANELLING = require('../../../assets/world/home/props/panelling.png');
const VISTA = require('../../../assets/world/home/props/vista.png');
/** The trimmed renders' own aspects. __tests__/scene_surfaces.test.ts holds them. */
const SKIRTING_ASPECT = 633 / 36;
const PANELLING_ASPECT = 636 / 120;
const VISTA_ASPECT = 640 / 259;
/**
 * Window sun/moon geometry, as FRACTIONS of the aperture.
 *
 * These were 14 and 16 -- pixels, in a pane whose width is derived from the
 * screen. On a phone the aperture comes out around 85pt wide, so a "14px"
 * radius drew a 28pt disc across a third of the view: the sun in the window was
 * bigger, relative to its sky, than the sun over the park. Everything in here
 * is a fraction now, for the same reason the room around it is.
 */
const SKY_BODY_R_FRAC = 0.115;
const SKY_BODY_INSET_FRAC = 0.13;

const SKY: Record<SkyBand, readonly [ColorValue, ColorValue]> = {
  morning: [DIORAMA.skyMorningA, DIORAMA.skyMorningB],
  day: [DIORAMA.skyDayA, DIORAMA.skyDayB],
  evening: [DIORAMA.skyEveningA, DIORAMA.skyEveningB],
  night: [DIORAMA.skyNightA, DIORAMA.skyNightB],
};

/**
 * A real rendered frame around a live, code-owned view.
 *
 * The timber, bevels and sill come from Blender, while the sky and hills remain
 * React Native layers behind the transparent panes. Home therefore gets real
 * material depth without becoming one baked background image.
 */
function RenderedWindow({
  band,
  upgraded,
  top,
  left,
  scale,
}: {
  band: SkyBand;
  upgraded: boolean;
  top: number;
  left: number;
  scale: number;
}) {
  const night = band === 'night';
  const width = (upgraded ? 224 : 208) * scale;
  const height = width * (760 / 720);
  const apertureW = width * 0.61;
  const apertureH = height * 0.53;
  const bodyR = apertureH * SKY_BODY_R_FRAC;
  const bodyX = apertureW * (1 - SKY_BODY_INSET_FRAC) - bodyR;
  const bodyY = apertureH * SKY_BODY_INSET_FRAC + bodyR;
  // Where the land starts, as a fraction of the pane. Three bands sit below it.
  const horizon = apertureH * 0.62;

  return (
    /*
      ONE PROP, several images.

      `scripts/blocking.mjs` refuses a prop that stands wholly inside another
      at the same distance -- correctly, because that is clutter rather than
      depth. A window and the view through its glass are the exception: the
      vista IS inside the frame, on purpose, and the gate flagged it the
      moment the vista stopped being SVG and became a render.

      The fix is not an exemption by name. `world-composite` tells the gate
      that everything under here is one object, so it measures the union once
      instead of treating a window's own parts as rivals. Any future composite
      -- a shopfront with a sign, a screen with a picture on it -- says the
      same thing and gets the same treatment.
    */
    <View testID="world-composite" style={[styles.windowWrap, { top, left, width, height }]}>
      <View
        style={[
          styles.windowCastShadow,
          {
            left: 16 * scale,
            top: 20 * scale,
            width: width * 0.83,
            height: height * 0.74,
            opacity: night ? 0.34 : 0.22,
          },
        ]}
      />
      <View
        style={[
          styles.skyAperture,
          {
            left: width * 0.19,
            top: height * 0.22,
            width: width * 0.61,
            height: height * 0.53,
          },
        ]}
      >
        <LinearGradient colors={SKY[band]} style={styles.fill} />
        {/*
          The same body as the sky outside, at window scale. It was the last
          flat-filled disc left in the app after the outdoor sun and moon became
          real lights, which read as the window showing a different weather
          system from the one the tab bar switches to.
        */}
        <RadialGlow
          cx={bodyX}
          cy={bodyY}
          r={bodyR * 3.2}
          color={night ? DIORAMA.goldGlow : DIORAMA.butter}
          stops={night ? [0.30, 0.15, 0.05] : [0.46, 0.23, 0.08]}
        />
        <Svg width={apertureW} height={apertureH} style={styles.fill}>
          {night ? (
            <Path
              d={crescentPath(bodyX, bodyY, bodyR, bodyR * 0.92, bodyR * 0.6, -5)}
              fill={DIORAMA.goldLight}
              opacity={0.96}
            />
          ) : (
            <>
              <Circle cx={bodyX} cy={bodyY} r={bodyR} fill={DIORAMA.lemon} />
              <Circle cx={bodyX - bodyR * 0.22} cy={bodyY - bodyR * 0.24} r={bodyR * 0.52} fill={DIORAMA.butter} opacity={0.7} />
            </>
          )}
        </Svg>
        {/*
          THE VIEW IS A RENDER.

          This was the worst object in the game and it sat inside one of the
          best: the frame below is a full Blender render -- mitred timber, a
          bevelled sill, a real cast shadow -- and behind its glass were three
          flat SVG bands with four ellipses on them for trees. A child's
          drawing taped inside a photograph, and the one place in Home a new
          player looks first, because onboarding happens in this room.

          `tools/blender/world_prop_pack.py:home_vista` builds three ridges
          that differ in height AND colour, with the far one hazed toward the
          sky's blue, plus two trees at a size that survives a 127pt pane.
          Anchored to the same `horizon` fraction the bands used, so the sun
          above it does not move.
        */}
        <Image
          source={VISTA}
          resizeMode="contain"
          style={{
            position: 'absolute',
            left: 0,
            width: apertureW,
            // WIDTH AND ASPECT, never a typed height. A first pass stretched
            // the render to the leftover pane below the old SVG horizon, and
            // the aperture is nearly square while the vista is 2.43:1 -- so it
            // came out squashed flat, the two trees smeared into the ridge and
            // every lump the hills had went with them. The same defect the dig
            // mound shipped with, reintroduced from the opposite direction.
            height: apertureW / VISTA_ASPECT,
            // Six percent of it hangs below the aperture, which is clipped
            // (`skyAperture` sets overflow hidden). That buries the dark
            // underside of the nearest hills, which otherwise draws a hard
            // black line along the bottom of the glass.
            top: apertureH - (apertureW / VISTA_ASPECT) * 0.94,
            // Night keeps most of it. At 0.55 under a 0.42 blue wash the three
            // ridges dissolved and the pane went back to being a flat dark
            // rectangle with two smudges in it -- the defect this render was
            // built to remove, reappearing for half of every day. Captured at
            // 23h to check, because 14h is not the only hour the game runs.
            opacity: night ? 0.78 : 1,
          }}
        />
        {night && <View style={[styles.fill, { backgroundColor: DIORAMA.skyNightA, opacity: 0.30 }]} />}
        {!night && <View style={styles.windowGlint} />}
      </View>
      <Image source={WINDOW_FRAME} resizeMode="contain" style={[styles.windowImage, { width, height }]} />
      {upgraded && <View style={[styles.windowUpgradeSpark, { width: width * 0.46 }]} />}
    </View>
  );
}

/**
 * ONE horizontal break on this wall, not three.
 *
 * There used to be a chair rail (a 12px wood bar with an 18px shadow under it)
 * about 140px above the floor, AND a skirting board 27px above the floor, AND
 * the floor's own near/far band below that. Three dark stripes stacked in the
 * bottom third of the room: the wall read as a barcode, and at a glance you
 * could not tell which line was the actual floor — which is how an earlier
 * session came to believe the furniture was hanging below it.
 *
 * A wall meets a floor once. What is left is the skirting, plus a soft
 * ambient-occlusion falloff down the wall into it. That falloff is a gradient,
 * not an edge, so it adds depth without adding a line.
 */
function WallMillwork({ floorTop, night, zIndex }: { floorTop: number; night: boolean; zIndex: number }) {
  return (
    <LinearGradient
      colors={
        night
          ? ['rgba(24,32,74,0)', 'rgba(16,22,58,0.34)']
          : ['rgba(197,139,78,0)', 'rgba(140,86,42,0.22)']
      }
      style={[styles.wainscot, { zIndex, top: floorTop - 178, height: 178 }]}
    />
  );
}

function Rug({ groundY, night, scale }: { groundY: number; night: boolean; scale: number }) {
  const width = 228 * scale;
  return (
    <Image
      source={RUG}
      resizeMode="contain"
      style={[
        styles.rug,
        {
          top: groundY - 62,
          width,
          height: 92 * scale,
          marginLeft: -width / 2,
          opacity: night ? 0.72 : 1,
        },
      ]}
    />
  );
}

/**
 * Home's production renderer.
 *
 * The room shell stays deterministic React Native. High-value objects and
 * architecture are transparent renders from a shared Blender camera/light rig.
 * Every object remains individually placeable, replaceable and upgradeable.
 */
/**
 * The room as a biography.
 *
 * `world/biography.ts` decides WHAT earned a place in the room -- a favorite
 * treasure, a friend's photo, a dossier on the rival, a token for a ritual you
 * two invented. This decides how those read as objects. Nothing here invents
 * history: every prop is a receipt for something the player actually did, and
 * an empty history renders an empty room rather than starter decoration.
 *
 * Same material recipe as every other object on this shelf -- contact shadow,
 * dark lower edge, saturated body, one controlled highlight -- so a keepsake
 * belongs to the same toy set as the lamp and the couch.
 */
function BiographyObject({ visual, night }: { visual: BiographyProp['visual']; night: boolean }) {
  const dim = night ? 0.72 : 1;
  if (visual === 'polaroid' || visual === 'scribbled-photo') {
    const rival = visual === 'scribbled-photo';
    return (
      <Svg width={44} height={50} viewBox="0 0 44 50">
        {/* Hung on a wall: a soft offset drop, never a ground pool. The pool
            is what made the shelf look like it was floating over the floor. */}
        <Path d="M6 5h38v38H6Z" fill={DIORAMA.shadow} opacity={0.15} />
        <Path d="M3 4h38v38H3Z" fill={ITEM.leather} opacity={0.5 * dim} />
        <Path d="M3 2h38v38H3Z" fill={DIORAMA.paleCream} opacity={dim} />
        <Path d="M3 2h38v5H3Z" fill={DIORAMA.white} opacity={0.5 * dim} />
        <Path d="M7 6h30v23H7Z" fill={rival ? DIORAMA.coralDeep : DIORAMA.aquaDeep} opacity={dim} />
        <Path d="M7 6h30v9H7Z" fill={rival ? DIORAMA.coral : DIORAMA.aqua} opacity={0.7 * dim} />
        <Circle cx={22} cy={18} r={7} fill={rival ? DIORAMA.coralLight : DIORAMA.butterDeep} opacity={dim} />
        <Circle cx={19.4} cy={16} r={1.7} fill={ITEM.leather} opacity={dim} />
        <Circle cx={24.6} cy={16} r={1.7} fill={ITEM.leather} opacity={dim} />
        <Path d="M13 11q2.4-4 5 0M27 11q2.4-4 5 0" stroke={ITEM.leather} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.8 * dim} />
        {/*
            The rival's photo is SCRIBBLED ON, not crossed out. A full X corner
            to corner over a small framed picture is the broken-image glyph --
            at 44pt on a wall it read as a missing asset rather than as an
            opinion. A scrawl over the face is unmistakably somebody's doing.
          */}
        {rival && (
          <Path
            d="M11 21q5-7 9-2t9-5"
            stroke={ITEM.leather}
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
            opacity={0.7 * dim}
          />
        )}
        {rival && (
          <Path
            d="M12 15q6 5 11 1t8 3"
            stroke={ITEM.leather}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
            opacity={0.55 * dim}
          />
        )}
        <Path d="M6 4 L14 4" stroke={DIORAMA.white} strokeWidth={2.4} opacity={0.8} strokeLinecap="round" />
      </Svg>
    );
  }
  if (visual === 'handmade-award') {
    return (
      <Svg width={38} height={46} viewBox="0 0 38 46">
        <Ellipse cx={19} cy={43} rx={13} ry={2.8} fill={DIORAMA.shadow} opacity={0.16} />
        <Ellipse cx={19} cy={42} rx={8} ry={1.6} fill={DIORAMA.shadow} opacity={0.3} />
        <Path d="M13 22h12l4 19-10-5.5-10 5.5Z" fill={DIORAMA.coralDeep} opacity={dim} />
        <Path d="M13 22h12l2 10-8-3-8 3Z" fill={DIORAMA.coral} opacity={dim} />
        <Circle cx={19} cy={17} r={14} fill={BRASS.dark} opacity={dim} />
        <Circle cx={19} cy={15.4} r={12.4} fill={BRASS.mid} opacity={dim} />
        <Circle cx={19} cy={14.6} r={9.6} fill={BRASS.polished} opacity={dim} />
        <Circle cx={19} cy={15} r={5.4} fill={BRASS.dark} opacity={0.3 * dim} />
        <Path d="M10 8q9-6 18-1.5" stroke={DIORAMA.white} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.6 * dim} />
        <Circle cx={13.5} cy={9} r={2.4} fill={DIORAMA.white} opacity={0.5 * dim} />
      </Svg>
    );
  }
  if (visual === 'souvenir-card') {
    return (
      <Svg width={40} height={44} viewBox="0 0 40 44">
        <Ellipse cx={20} cy={41} rx={14} ry={2.8} fill={DIORAMA.shadow} opacity={0.16} />
        <Ellipse cx={20} cy={40} rx={9} ry={1.6} fill={DIORAMA.shadow} opacity={0.3} />
        <Path d="M4 6h32v33H4Z" fill={DIORAMA.violetNight} opacity={dim} />
        <Path d="M4 4h32v33H4Z" fill={DIORAMA.violetDeep} opacity={dim} />
        <Path d="M4 4h32v11H4Z" fill={DIORAMA.violet} opacity={dim} />
        <Path d="M20 10l3.2 6.6 7.2 1-5.2 5 1.2 7.2-6.4-3.4-6.4 3.4 1.2-7.2-5.2-5 7.2-1Z" fill={DIORAMA.lemon} opacity={dim} />
        <Path d="M20 10l3.2 6.6 7.2 1-5.2 5 1.2 7.2-6.4-3.4Z" fill={DIORAMA.butterDeep} opacity={0.55 * dim} />
        <Path d="M7 6 L18 6" stroke={DIORAMA.white} strokeWidth={2.6} opacity={0.4} strokeLinecap="round" />
      </Svg>
    );
  }
  return (
    <Svg width={46} height={38} viewBox="0 0 46 38">
      <Ellipse cx={23} cy={34} rx={16} ry={3} fill={DIORAMA.shadow} opacity={0.16} />
      <Ellipse cx={23} cy={33} rx={10} ry={1.8} fill={DIORAMA.shadow} opacity={0.3} />
      <Path d="M7 23q-4-8 2.5-10.5 5-2 7.5 2.5h12q2.5-4.5 7.5-2.5 6.5 2.5 2.5 10.5-2.5 6.5-11.5 6.5H18.5Q9.5 29.5 7 23Z" fill={ITEM.stick} opacity={dim} />
      <Path d="M7 20.5q-4-8 2.5-10.5 5-2 7.5 2.5h12q2.5-4.5 7.5-2.5 6.5 2.5 2.5 10.5-2.5 5.8-11.5 5.8H18.5Q9.5 26.3 7 20.5Z" fill={ITEM.stickLight} opacity={dim} />
      <Path d="M13 13.5q10-2.6 20 0" stroke={DIORAMA.white} strokeWidth={2.8} fill="none" strokeLinecap="round" opacity={0.36 * dim} />
      <Circle cx={12.5} cy={13} r={2.6} fill={DIORAMA.white} opacity={0.34 * dim} />
    </Svg>
  );
}

/**
 * Slots are semantic, not pixel positions, so the same history composes on any
 * screen: shelf keepsakes ride the shelf, photos hang on the wall beside it,
 * and the floor keepsake sits by the bed.
 */
function HomeBiography({
  props: bioProps,
  chromeBottom,
  floorTop,
  shelfRight,
  shelfW,
  stripCenter,
  night,
  scale,
}: {
  props: BiographyProp[];
  chromeBottom: number;
  floorTop: number;
  shelfRight: number;
  shelfW: number;
  /** x of the open wall between the window and the shelf: the picture wall. */
  stripCenter: number;
  night: boolean;
  scale: number;
}) {
  if (bioProps.length === 0) return null;
  // Objects sit ON things. The shelf art has two visible boards; these ride
  // them instead of hovering over the front of the unit, the wall pieces hang
  // on wall rather than floating in the middle of it, and the floor keepsake
  // rests on the floor line. All offsets are fractions of the shelf's own
  // width, so the arrangement survives every screen size.
  const slotStyle = (slot: BiographyProp['slot']) => {
    switch (slot) {
      case 'shelf-left':
        return { right: shelfRight + shelfW * 0.58, top: chromeBottom + 100 * scale };
      case 'shelf-right':
        return { right: shelfRight + shelfW * 0.16, top: chromeBottom + 100 * scale };
      // Pictures hang on the open wall BETWEEN the window and the shelf,
      // stacked, rather than being anchored off the shelf -- which is how the
      // photo ended up on top of the window when the wall was recomposed.
      //
      // Every drop below is scaled. They were raw pixels while the art they
      // position is scaled by `transform`, so on a small phone the two frames
      // shrank and the gap between them did not: two little pictures with a
      // hand's width of bare wall between them.
      case 'wall-left':
        return { left: stripCenter - 17 * scale, top: chromeBottom + 74 * scale };
      case 'wall-right':
        return { left: stripCenter - 17 * scale, top: chromeBottom + 150 * scale };
      default:
        return { right: shelfRight + 6, top: floorTop - 4 };
    }
  };
  return (
    <>
      {bioProps.map((prop) => (
        <View
          key={prop.id}
          style={[styles.bioProp, slotStyle(prop.slot), { transform: [{ scale }] }]}
          pointerEvents="none"
          accessible
          accessibilityRole="image"
          accessibilityLabel={`${prop.title}. ${prop.caption}`}
          testID={`biography-${prop.id}`}
        >
          <BiographyObject visual={prop.visual} night={night} />
        </View>
      ))}
    </>
  );
}

/**
 * DUST IN THE WINDOW LIGHT — the only thing moving in this room.
 *
 * Measured 2026-09-03: over four seconds, Park changed 3.8-5.8% of its
 * pixels, Town 2.6-5.5%, Beach 2.2-6.4% — trees, planters, palms and the
 * umbrella all sway. Home changed 0.00%, with a peak per-pixel delta of 2,
 * which is noise. It was a photograph. And Home is where onboarding happens
 * and where a player spends most of their time, so the one room that had to
 * feel lived-in was the one room that was completely still.
 *
 * Dust rather than more furniture, deliberately: the visual doctrine says add
 * ambient BEHAVIOUR, not more props. Motes drift up through the light from
 * the window on long staggered loops, so the air in the room moves without
 * anything in it changing. They need light to be visible at all, so they thin
 * out after dark rather than pretending to glow in the dark.
 */
/**
 * The light in the room BREATHES.
 *
 * Dust alone moved 0.02% of the room's pixels -- real, but 150x less than the
 * trees at the park, because six specks are simply not many pixels. Cloud
 * shadow is the opposite trade: one very slow change across a large area,
 * which is what actually reads across a room as "outside is doing something".
 * Long and shallow on purpose; a fast or deep pulse reads as a screen fault.
 */
function useSlowBreath(period: number, still = false): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) {
      v.stopAnimation();
      v.setValue(0.4);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, period, still]);
  return v;
}

function DustMotes({ left, top, width, height, night, still }: {
  left: number; top: number; width: number; height: number; night: boolean; still: boolean;
}) {
  // Fixed, not random: a room that re-shuffles its dust on every re-render is
  // a room that flickers.
  const MOTES = [
    { x: 0.10, y: 0.86, r: 2.6, dur: 11000, delay: 0, drift: 9 },
    { x: 0.27, y: 0.97, r: 2.0, dur: 13500, delay: 1800, drift: -7 },
    { x: 0.44, y: 0.80, r: 3.0, dur: 9800, delay: 3200, drift: 11 },
    { x: 0.60, y: 0.99, r: 2.1, dur: 12600, delay: 900, drift: -5 },
    { x: 0.76, y: 0.88, r: 2.5, dur: 10600, delay: 4300, drift: 8 },
    { x: 0.91, y: 0.76, r: 1.8, dur: 14200, delay: 2600, drift: -9 },
  ];
  return (
    <>
      {MOTES.map((m) => (
        <Mote
          still={still}
          key={`${m.x}-${m.y}`}
          left={left + width * m.x}
          top={top + height * m.y}
          radius={m.r}
          rise={height * 0.62}
          drift={m.drift}
          duration={m.dur}
          delay={m.delay}
          night={night}
        />
      ))}
    </>
  );
}

function Mote({ left, top, radius, rise, drift, duration, delay, night, still }: {
  left: number; top: number; radius: number; rise: number; drift: number;
  duration: number; delay: number; night: boolean; still: boolean;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, duration, delay]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left,
        top,
        width: radius * 2,
        height: radius * 2,
        borderRadius: radius,
        backgroundColor: DIORAMA.white,
        /*
         * Tuned by MEASUREMENT, not by taste. The first pass used 0.30 alpha
         * on 1.2-2.2px dots, which rendered a peak per-pixel delta of 18
         * against ~500 for the swaying trees outdoors: present in the DOM,
         * invisible to a person, and still scoring 0.00% on the motion check.
         * Subtle is the goal; below the threshold of sight is a bug.
         */
        opacity: t.interpolate({
          inputRange: [0, 0.15, 0.5, 0.85, 1],
          outputRange: [0, night ? 0.20 : 0.62, night ? 0.26 : 0.78, night ? 0.16 : 0.50, 0],
        }),
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -rise] }) },
          { translateX: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, drift, 0] }) },
        ],
      }}
    />
  );
}

/**
 * The lamp is ON after dark.
 *
 * Home at night rendered a grey lampshade in a blue room -- the same defect
 * Town had with its unlit street lamps, and the reason "night" read as the day
 * scene dimmed rather than as evening. A lamp is a light SOURCE: a warm shade,
 * a halo, and a pool of it on the floor underneath.
 *
 * The halo is a real radial falloff (shared `RadialGlow`). It used to be a
 * VERTICAL linear gradient inside a circular box, which is a band of light
 * with two straight edges wearing a round mask -- readable as a glow only
 * because it was faint. The shade band and the floor pool stay linear: both
 * are wide, flat ellipses where the falloff genuinely is one-dimensional.
 */
function HomeLampGlow({
  left,
  top,
  width,
  height,
  floorTop,
  intensity = 1,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  floorTop: number;
  /** 1 after dark; lower at dusk, when the window is still doing the lighting. */
  intensity?: number;
}) {
  // Centred on the shade, which sits in the top sixth of the lamp sprite.
  const cx = left + width / 2;
  const cy = top + height * 0.16;
  const r = width * 0.95;
  return (
    <View style={[styles.fill, { opacity: intensity }]} pointerEvents="none">
      <RadialGlow cx={cx} cy={cy} r={r} color={DIORAMA.butterDeep} stops={[0.40, 0.20, 0.07]} />
      <LinearGradient
        colors={['rgba(255,242,190,0)', 'rgba(255,240,178,0.72)', 'rgba(255,224,140,0)']}
        locations={[0, 0.5, 1]}
        style={[styles.lampHalo, { left: cx - width * 0.42, top: cy - height * 0.11, width: width * 0.84, height: height * 0.22, borderRadius: width * 0.3 }]}
      />
      {/* The light lands on the floor. Without this the lamp glows at nothing. */}
      <LinearGradient
        colors={['rgba(255,214,102,0)', 'rgba(255,214,102,0.30)', 'rgba(255,214,102,0)']}
        locations={[0, 0.5, 1]}
        style={[styles.lampFloorPool, { left: cx - width * 1.7, top: floorTop - width * 0.42, width: width * 3.4, height: width * 1.0, borderRadius: width * 1.7 }]}
      />
    </View>
  );
}

export function HomeScene({
  hour,
  upgrades = [],
  asleep = false,
  groundY,
  chromeBottom,
  motion = 'idle',
  biography = [],
}: {
  hour: number;
  upgrades?: string[];
  asleep?: boolean;
  groundY: number;
  chromeBottom: number;
  motion?: WorldMotion;
  /** Physical receipts for the life this player actually built. */
  biography?: BiographyProp[];
}) {
  const { width, height } = useWindowDimensions();
  // More screen reveals more room; the authored objects do not inflate forever.
  const propScale = worldScale(width, height);
  /*
   * 4.2s each way. The first pass used 9s, which is genuinely cloud speed and
   * genuinely invisible: over any four-second glance at the room the light had
   * barely moved, and the motion check could not tell it from a still image.
   * This is the same order as the 3.6s sway on the trees outdoors, so the room
   * now changes on the timescale a person actually looks at it for.
   */
  const still = useReduceMotion();
  const daylight = useSlowBreath(4200, still);
  const band = skyBand(hour);
  const night = band === 'night' || asleep;
  const has = (id: string) => upgrades.includes(id);
  // Measured, not guessed: at 360x568 the wall and floor together only get
  // 264px between the chrome and his feet, and the shelf alone wants 218 --
  // so on the shortest supported phone the furniture genuinely cannot be
  // full size. Raising this minimum to buy wall height moves the wall/floor
  // line UP once groundY-158 stops winning, which pushed the window off the
  // top entirely. Left where it was; the fit clamp below is what handles it.
  const floorTop = Math.max(chromeBottom + 190, groundY - 158);

  const wall: readonly [ColorValue, ColorValue] = night
    ? [DIORAMA.wallNightA, DIORAMA.wallNightB]
    : [DIORAMA.wallDayA, DIORAMA.wallDayB];
  const floorFar = night ? DIORAMA.floorNightFar : DIORAMA.floorDayFar;
  const floorNear = night ? DIORAMA.floorNightNear : DIORAMA.floorDayNear;
  const floorLine = night ? DIORAMA.floorNightEdge : DIORAMA.floorDayEdge;

  const chairW = 155 * propScale;
  const chairH = chairW / CHAIR_ASPECT;
  const lampW = 72 * propScale;
  const lampH = lampW / LAMP_ASPECT;
  /*
   * The wall is COMPOSED, not edge-pinned. The window used to hang 5px off the
   * left of the screen and the shelf sat 7px from the right, which read as two
   * clipped objects with a hole between them -- the single biggest reason the
   * room looked like a layout instead of a place. Both now keep a real margin
   * and grow to close the gap, and the margin is a fraction of the screen so a
   * tablet gets a wider room rather than the same phone furniture marooned in
   * empty wall.
   */
  /*
   * THE ROOM HAS AN AUTHORED WIDTH. It does not stretch to fill an iPad.
   *
   * Window and shelf both hang from `wallInset`, one screen-edge margin used
   * on both sides -- which is exactly the problem on a wide landscape canvas:
   * that margin only grows 4.5% of screen width, so on a 1024px iPad the two
   * pieces of furniture are still pinned near the true left/right edges and
   * the biography strip between them (two small photos, or NOTHING at all on
   * a young save -- an empty history renders an empty room on purpose, see
   * HomeBiography) is stretched across a widening void. Measured at 1024x768:
   * a bare beige wall roughly 900px wide with two postcard-sized photos
   * floating in it, found by a ChatGPT doctor pass and confirmed by capturing
   * the actual build rather than trusting the screenshot claim.
   *
   * Past ROOM_CAP, extra screen width stops feeding the gap between window
   * and shelf and becomes side margin instead -- the room stays the same
   * authored width, centered, and a wide screen reveals more plain wall
   * around it. This is the same "wider screens reveal more environment, they
   * do not stretch the composition" rule `worldScale` already documents for
   * Barkly himself; the wall furniture just never followed it.
   */
  const ROOM_CAP = 620;
  const wallInset =
    width <= ROOM_CAP ? Math.max(12, width * 0.045) : (width - ROOM_CAP) / 2 + ROOM_CAP * 0.045;
  /*
   * THE LAMP STANDS ON THE OTHER SIDE OF THE ROOM, BECAUSE BARKLY STANDS HERE.
   *
   * It used to sit at `wallInset + chairW * 0.84`, which was reasoned about
   * entirely against the COUCH -- see the note at its draw call, which is all
   * about clearing the couch back so the pole reads. Nobody measured it against
   * the biggest thing on the screen. Captured at 390x844: the lamp occupied
   * x 143..224 and Barkly x 131..257, so the lamp was entirely inside his
   * silhouette and its shade -- the one part of it that reads -- sat on his
   * skull. The room shipped with a lampshade growing out of the dog's head.
   *
   * Standing it right of centre fixes three things at once: it clears his face,
   * it shows the whole pole against wall and floor rather than against couch
   * upholstery, and it balances a composition that had the couch AND the lamp
   * both crowded into the left third with dead wall on the right.
   *
   * The clearance is not a hope -- `scripts/prop-clear-check.mjs` measures every
   * scene prop against his face column in the real build and fails on a cover-up.
   */
  const lampLeft = width - wallInset - lampW - chairW * 0.06;

  /*
   * FIT THE WALL FURNITURE TO THE WALL.
   *
   * The window and the shelf were sized from constants and placed at a fixed
   * offset from the top, with nothing relating either to floorTop. On a real
   * installed viewport that put their bottoms 70-100px BELOW the wall/floor
   * trim -- a window hanging under the floor line -- which is also why the
   * couch looked like it was colliding with the window rather than standing
   * in front of it. Nothing was overlapping that should not; the wall pieces
   * were simply too tall for the wall they hang on.
   *
   * The band between the chrome and the floor is the real constraint, so both
   * pieces are measured against it and shrink to fit when it is short. On a
   * tall screen nothing changes.
   */
  const wallTop = chromeBottom + 52;
  const wallBand = Math.max(120, floorTop - wallTop - 18);

  const shelfNaturalW = 135 * propScale;
  const shelfNaturalH = shelfNaturalW / SHELF_ASPECT;
  const shelfFit = shelfNaturalH > wallBand ? wallBand / shelfNaturalH : 1;
  const shelfW = shelfNaturalW * shelfFit;
  const shelfH = shelfNaturalH * shelfFit;

  const windowNaturalScale = propScale * 0.86;
  const windowNaturalW = (has('home_window') ? 224 : 208) * windowNaturalScale;
  const windowNaturalH = windowNaturalW / WINDOW_FRAME_ASPECT;
  const windowScale =
    windowNaturalH > wallBand ? windowNaturalScale * (wallBand / windowNaturalH) : windowNaturalScale;
  const windowW = (has('home_window') ? 224 : 208) * windowScale;
  const bedW = (has('home_bed') ? 144 : 126) * propScale;
  const bedH = bedW / BED_ASPECT;

  /*
   * Where the light comes from, as a fraction of the screen. The room's shade
   * (below the grade) starts here, and it is the window's own centre rather
   * than a constant so a narrow phone -- where `windowScale` shrinks the
   * window to fit the wall band -- moves the light source with it instead of
   * shading from where a window used to be.
   */
  const windowCenter = Math.min(0.9, Math.max(0.1, (wallInset + windowW / 2) / Math.max(1, width)));

  return (
    <WorldScene motion={asleep ? 'sleep' : motion} scene="home" testID="world-scene-home" zoom={SCENE_CAMERA.home.zoom}>
      <WorldLayer name="sky">
        <LinearGradient colors={wall} style={[styles.fill, { bottom: undefined, height: floorTop }]} />
      </WorldLayer>

      <WorldLayer name="ground">
      {/*
        THE FLOOR IS ONE THING, so it is one child of this layer.

        A `WorldObject` carries a baseline-derived zIndex, which is right for
        an object standing on the floor and wrong for the floor itself: the
        nearest course would have sorted in front of the rug and the couch. The
        boards are plain Images inside this wrapper instead, and the wrapper
        sits under everything else in the layer.
      */}
      <View style={[styles.fill, { zIndex: 0 }]}>
      <Svg width="100%" height="100%" viewBox="0 0 420 760" preserveAspectRatio="none" style={styles.fill}>
        <Rect x={0} y={floorTop} width={420} height={760 - floorTop} fill={floorFar} />
      </Svg>
      <Svg width="100%" height="100%" viewBox="0 0 420 760" preserveAspectRatio="none" style={styles.fill}>
        {/*
          STRONG WINDOW LIGHT -- the first line of this scene's own target in
          docs/VISUAL_DIRECTION_KIDS_GAME.md ("Warm toy-diorama living room.
          Chunky furniture. Strong window light."), and the room had none. The
          window was a picture on the wall; nothing it let in reached the floor.

          The shape is not invented, it is the floor's own perspective. The
          planks below run from `x` at the wall to `210 + (x - 210) * 1.85` at
          the bottom edge, so a window spanning the wall from x1 to x2 lays
          down exactly that trapezoid. Reusing the projection is what stops
          this reading as a pasted gradient: the light lies in the floor rather
          than on top of it.

          Day only, and gently. After dark the lamp is the source -- there is
          already a halo and a floor pool for it -- and a second sun coming
          through the window at midnight is the kind of detail that makes a
          room look wrong without anyone being able to say why.
        */}
        {!night && (() => {
          // The window is positioned in real pixels; this canvas is a fixed
          // 420-wide viewBox stretched to fit. Convert, or the light lands
          // somewhere the window is not.
          const toCanvas = (px: number) => (px / Math.max(1, width)) * 420;
          const x1 = toCanvas(wallInset);
          const x2 = toCanvas(wallInset + windowW);
          const far = (x: number) => 210 + (x - 210) * 1.85;
          return (
            <Path
              d={`M${x1} ${floorTop} L${x2} ${floorTop} L${far(x2)} 760 L${far(x1)} 760 Z`}
              fill={DIORAMA.goldGlowSoft}
              opacity={band === 'evening' ? 0.38 : band === 'morning' ? 0.30 : 0.26}
            />
          );
        })()}
        {/*
          BOARDS RUN AWAY FROM YOU, and there are more than four of them.

          The two things wrong with this floor were both parameters, not the
          technique. Measured on the shipped scene the six plank lines landed
          90pt apart on a 390pt screen -- a four-board room -- and a second set
          of four HORIZONTAL lines crossed them, which is what turned the
          floor into a grid of squares. Boards have butt joints, but not one
          every 60pt in a straight line across the room; that is masonry.

          Fifteen lines, no horizontals, and the same 1.85 spread that was
          already here -- boards get WIDER as they come toward the camera,
          which is the one thing the original projection had exactly right.

          Tried and rejected: a rendered `home_floorboards` course, laid the
          way town's paving courses recede. Three passes of it, and every one
          read as brickwork, because a cross-laid course of boards with
          staggered butt joints IS running bond. Proportion tuning cannot fix
          that -- 8 segments per course gave 2.3:1 bricks, 3 gave 10:1 planks,
          and the pattern still said wall. The prop is deleted rather than
          left in the pack unused.
        */}
        {Array.from({ length: 15 }, (_, i) => (i + 0.5) * (420 / 15)).map((x, i) => (
          <Path
            key={x}
            d={`M${x} ${floorTop}L${210 + (x - 210) * 1.85} 760`}
            stroke={floorLine}
            strokeWidth={2}
            // Barely uneven, so fifteen parallel lines do not read as a ruled
            // page. Real boards differ; these differ just enough to notice.
            opacity={(night ? 0.13 : 0.19) * (i % 3 === 1 ? 0.72 : 1)}
          />
        ))}
      </Svg>
      </View>

        {has('home_rug') && <Rug groundY={groundY} night={night} scale={propScale} />}
      </WorldLayer>

      {/*
        EVERYTHING IN THIS LAYER IS WALL, AND WALL HAS AN ORDER.

        It went from all-code-drawn to holding a rendered skirting board, and a
        WorldObject carries a baseline-derived zIndex while a plain View
        carries none -- so every one of these would have lost to it, and the
        wash, the ceiling trim and the falloff would have disappeared behind a
        strip of moulding. That is the same defect that put Town's shop sign
        behind its own shopfront, and layer_stacking caught this one before it
        ever rendered. Back to front: wash, ceiling trim, falloff, skirting.
      */}
      <WorldLayer name="distant">
        <Animated.View
          pointerEvents="none"
          style={[
            styles.lightPool,
            {
              zIndex: 1,
              top: chromeBottom + 18,
              height: Math.max(270, groundY - chromeBottom + 28),
              // Daylight only. After dark the light source is the lamp, and a
              // pulsing night wash would read as the screen flickering.
              opacity: night ? 1 : daylight.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
              // The pool SLIDES as well as dims. Opacity alone changed each
              // pixel by about 6/765 -- real, and below the threshold of
              // sight. Moving the gradient's soft edge a few pixels changes a
              // long boundary instead of a flat field, which is what the eye
              // actually picks up as light shifting in a room.
              transform: night
                ? []
                : [{ translateX: daylight.interpolate({ inputRange: [0, 1], outputRange: [-10, 8] }) }],
            },
          ]}
        >
          <LinearGradient
            colors={night ? ['rgba(16,18,35,0.18)', 'rgba(16,18,35,0)'] : ['rgba(255,218,132,0.30)', 'rgba(255,218,132,0)']}
            start={{ x: 0, y: 0.18 }}
            end={{ x: 0.74, y: 0.76 }}
            style={styles.fill}
          />
        </Animated.View>
        <View style={[styles.ceilingTrim, { zIndex: 2, top: chromeBottom + 20, backgroundColor: night ? DIORAMA.woodNight : DIORAMA.woodSoft, opacity: night ? 0.34 : 0.26 }]} />
        <WallMillwork floorTop={floorTop} night={night} zIndex={3} />
        {/*
          The one line where wall meets floor -- and it is a MOULDING now, not
          a 14pt bar of flat colour at two thirds opacity.

          The wall is the flattest surface in the game: measured off a clean
          column it varies by almost nothing, and it met the floor at a colour
          change. A skirting board is the cheapest fix available and the most
          load-bearing one, because it draws the corner: it gives the floor an
          edge to stop at and puts a lit horizontal line straight across the
          dead band. Rendered from the same pack as the tray in front of it,
          and in the same camera-facing frame, so it comes out level.
        */}
        {(() => {
          const run = width + 48;
          const skirtingH = run / SKIRTING_ASPECT;
          const panelH = run / PANELLING_ASPECT;
          return (
            <>
              {/*
                And PANELLING above it, standing on the skirting. The wall is
                the flattest surface in the game -- one vertical gradient --
                and a dado is the piece of architecture that breaks it: a rail
                for the horizontal line, stiles so the field is not one
                unbroken sheet behind every piece of furniture in the room.
              */}
              <WorldObject
                source={PANELLING}
                left={-24}
                top={floorTop - skirtingH - panelH}
                width={run}
                height={panelH}
                night={night}
                depth={0.26}
              />
              <WorldObject
                source={SKIRTING}
                left={-24}
                top={floorTop - skirtingH}
                width={run}
                height={skirtingH}
                night={night}
                depth={0.30}
              />
            </>
          );
        })()}
      </WorldLayer>

      <WorldLayer name="landmark">
        <RenderedWindow band={night ? 'night' : band} upgraded={has('home_window')} top={wallTop + 10} left={wallInset} scale={windowScale} />
        {/*
          No ground contact shadow: the shelf is MOUNTED ON THE WALL. Pooling
          one under it put a shadow on the floor beneath something that never
          touches the floor, which is worse than no shadow at all.
        */}
        <WorldObject source={SHELF} right={wallInset} top={wallTop} width={shelfW} height={shelfH} night={night} depth={0.42} />
        <HomeBiography
          props={biography}
          chromeBottom={chromeBottom}
          floorTop={floorTop}
          shelfRight={wallInset}
          shelfW={shelfW}
          stripCenter={wallInset + windowW + (width - 2 * wallInset - shelfW - windowW) / 2}
          night={night}
          scale={propScale}
        />
      </WorldLayer>

      <WorldLayer name="props">
        {/*
          Furniture keeps the same margin as the wall above it. The lamp used
          to sit at left:-3 -- sliced by the screen edge -- which is the floor
          reading of the same mistake the window made: objects shoved past the
          frame instead of composed inside it.
        */}
        {/*
          The couch sits ON the floor rather than climbing it. At -chairH+36 it
          rose 116px into the wall, in the same column as the window, so on a
          short phone -- where the whole wall band is 120px -- it covered the
          window completely. Dropping it reveals the window on every screen and
          reads better anyway: furniture against a wall, not embedded in it.
        */}
        {/*
          THE LAMP STANDS BESIDE THE COUCH, NOT BEHIND IT.
          At left:wallInset*0.5 its whole 76px width sat inside the couch's
          146px span, and the couch is drawn after it -- so every pixel of the
          pole was occluded and only the shade cleared the couch back. The room
          shipped with a cream cone hovering in mid-air. Standing it off the
          couch's right shoulder shows the pole, which is the only thing that
          says "floor lamp" rather than "sticker", and the shade still reads
          against the wall rather than against the couch.
        */}
        <WorldObject source={LAMP} left={lampLeft} top={floorTop - lampH + 11} width={lampW} height={lampH} night={night} depth={0.66} contactShadow />
        <WorldObject source={CHAIR} left={wallInset} top={floorTop - chairH + 58} width={chairW} height={chairH} night={night} depth={0.74} contactShadow />
        <WorldObject source={BED} right={wallInset} top={floorTop + 12} width={bedW} height={bedH} night={night} depth={0.76} contactShadow />
      </WorldLayer>

      {/*
        AFTER the furniture. The first attempt put the dust in the `distant`
        layer, where the couch and the lamp stand in front of it: of six motes
        exactly one was ever visible, and it was tucked under the window. Air
        is in front of the furniture, not behind it.
      */}
      <WorldLayer name="foreground">
        {/*
          THE NEAR PLANE. Home was the one room with nothing standing nearer
          than the dog: measured, its content ran from y 0.31 to 0.90 and the
          strip below his feet was bare floorboard. A chair arm cropped by the
          left edge is what a room looks like from inside it -- furniture
          continues past the frame, because you are in the room rather than
          looking at a photograph of one. Oversized and hung off both the
          bottom and the left, since a foreground earns its distance by being
          cropped.
        */}
        {/*
          THE FLOOR YOU ARE STANDING ON. The room's near floor was a smooth
          cream gradient -- the largest area in the scene and the emptiest.
          Real boards, wider than the frame so they crop on both sides.
        */}
        <WorldObject
          source={NEAR_FLOOR}
          left={-0.10 * width}
          top={groundY + 104}
          width={width * 1.2}
          height={(width * 1.2) / NEAR_FLOOR_ASPECT}
          night={night}
          depth={1}
        />
        <WorldObject
          source={CHAIR}
          left={-chairW * 0.62}
          top={groundY - chairW * 0.30}
          width={chairW * 1.7}
          height={chairW * 1.7 * (343 / 341)}
          night={night}
          depth={1}
        />
        <DustMotes
          left={wallInset}
          top={wallTop}
          width={Math.max(120, width - wallInset * 2)}
          height={Math.max(150, floorTop - wallTop)}
          night={night}
          still={still}
        />
      </WorldLayer>

      <WorldLighting ground={groundY} night={night} band={band} warm />
      {/*
        THE OTHER HALF OF THE WINDOW.

        This scene's stated target is "strong window light", and the room had
        the LIGHT half of that -- a gold trapezoid laid down the floor in the
        floor's own perspective -- with nothing on the other side of it. A
        window does both. What it faces is bright; the rest of the room falls
        away into the ambient, and that falloff is most of what makes a lit
        interior read as a room rather than as an evenly-printed backdrop.

        The measurement that made this a defect rather than a nicety: across
        the pass that lowered the world's sun, the park went from 10.8% of its
        pixels below value 0.25 to 16.0% and the town 7.5% -> 12.1%, while the
        park's PLATE went 4.9% -> 13.8%. Home went 7.6% -> 7.6%. Not "moved
        less" -- did not move at all. Every rendered prop in the room was
        relit and the ROOM was not, because the room is drawn here and nothing
        here knew there was a light in it.

        It still moves least of the four with this in (7.6% -> 8.0%), and that
        is the honest ceiling rather than a shortfall: a falloff is not a cast
        shadow, and a shell whose contents are unlockable cannot have one.

        Three things make this a light model and not a vignette:

          * It comes FROM THE WINDOW. The axis starts at the window's own
            centre, which is `wallInset + windowW / 2` -- the same number the
            floor's gold trapezoid is projected from -- so moving the window,
            or a phone narrow enough to shrink it, moves the shade with it.
          * It is the SKY's hue. `DIORAMA.roomShade` is hue 205, which is what
            `palette.light_rgb("fill")` gives the shadow side of every prop
            standing in this room. One sky, indoors and out.
          * It goes ON TOP OF THE GRADE, like the lamp below it, because a
            shadow crossing a room crosses the furniture in it. Under the
            props it would have been a stain on the wall behind them.

        Night is excluded on purpose. After dark the lamp is the source and it
        already casts its own halo and floor pool; a second falloff pointing at
        a window with nothing behind it would darken the side of the room the
        lamp is standing on.
      */}
      {!night && (
        <View style={[styles.fill, { zIndex: 61, opacity: ROOM_SHADE_STRENGTH[band] ?? 0.34 }]} pointerEvents="none">
          <LinearGradient
            colors={[ROOM_SHADE_CLEAR, ROOM_SHADE_CLEAR, DIORAMA.roomShade]}
            /*
             * Nothing until 38% of the way across, then all of the falloff in
             * the remaining 62%. A gradient that starts shading at the source
             * puts a veil over the lit half as well -- the same defect as the
             * horizon haze that began AT the horizon and drew a hard line
             * across the park. Light does not fall off where it lands.
             */
            locations={[0, 0.38, 1]}
            start={{ x: windowCenter, y: 0.08 }}
            end={{ x: 1.02, y: 0.96 }}
            style={styles.fill}
          />
        </View>
      )}
      {/*
        AFTER the grade. Under it, the blue night wash composited over the warm
        shade and the lamp read as a grey disc -- the same mistake the warm
        pools inside WorldLighting were making before they moved on top of it.
      */}
      {/*
        The lamp is on at DUSK as well, at 0.5. Gated on `night` alone, a room
        at 19:00 sat under an orange window with its own lamp off -- the indoor
        half of the same bug Town had outside, where the street lights only came
        on at 21:00.
      */}
      {(night || band === 'evening') && (
        <WorldLayer name="fx">
          <HomeLampGlow
            left={lampLeft}
            top={floorTop - lampH + 11}
            width={lampW}
            height={lampH}
            floorTop={floorTop}
            intensity={night ? 1 : 0.5}
          />
        </WorldLayer>
      )}
    </WorldScene>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  bioProp: { position: 'absolute' },
  lightPool: { position: 'absolute', left: 0, width: '74%' },
  ceilingTrim: {
    position: 'absolute', left: '5%', right: '5%', height: 6,
    borderBottomLeftRadius: radius.sm, borderBottomRightRadius: radius.sm,
  },
  /*
   * Trim, not a slab. At height 28 in solid woodDeep this drew an opaque black
   * bar edge to edge across the room, and with the ceiling line above it the
   * scene read as three stacked stripes rather than as a space.
   */
  wainscot: { position: 'absolute', left: 0, right: 0 },
  /*
   * Gradients, not filled shapes. The first cut of the lamp glow used solid
   * views behind a border radius, and at these sizes a solid view has a
   * plainly visible EDGE -- the shade highlight read as a pale square sitting
   * next to the lamp rather than as the lamp being lit.
   */
  lampHalo: { position: 'absolute' },
  lampFloorPool: { position: 'absolute' },
  windowWrap: { position: 'absolute' },
  windowCastShadow: {
    position: 'absolute',
    backgroundColor: DIORAMA.shadow,
    borderRadius: radius.lg,
    transform: [{ rotate: '1deg' }],
  },
  skyAperture: {
    position: 'absolute', overflow: 'hidden',
    borderRadius: radius.md,
    backgroundColor: DIORAMA.skyDayA,
  },
  windowImage: { position: 'absolute', left: 0, top: 0 },
  windowGlint: {
    position: 'absolute', left: 12, top: 15, width: '44%', height: 7,
    borderRadius: radius.pill, backgroundColor: DIORAMA.white, opacity: 0.2,
    transform: [{ rotate: '-9deg' }],
  },
  windowUpgradeSpark: {
    position: 'absolute', left: 29, bottom: 25, height: 5,
    borderRadius: radius.pill, backgroundColor: DIORAMA.goldLight, opacity: 0.72,
  },
  rug: {
    position: 'absolute', left: '50%',
  },
});
