import React from 'react';
import { ColorValue, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { radius } from '../theme';
import { BRASS, DIORAMA, ITEM } from './artPalette';
import { skyBand, SkyBand } from './CandyScenesV2';
import { WorldLayer, WorldLighting, WorldMotion, WorldObject, WorldScene, worldScale } from './WorldScene';
import { BiographyProp } from '../../world/biography';

const CHAIR = require('../../../assets/world/home/props/chair.png');
const LAMP = require('../../../assets/world/home/props/lamp.png');
const BED = require('../../../assets/world/home/props/bed.png');
const RUG = require('../../../assets/world/home/props/rug.png');
const SHELF = require('../../../assets/world/home/props/shelf.png');
const WINDOW_FRAME = require('../../../assets/world/home/architecture/window_frame.png');

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

  return (
    <View style={[styles.windowWrap, { top, left, width, height }]}>
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
        <View
          style={[
            styles.sunMoon,
            {
              backgroundColor: night ? DIORAMA.goldLight : DIORAMA.lemon,
              opacity: night ? 0.82 : 1,
            },
          ]}
        />
        <View style={[styles.hillBack, { backgroundColor: night ? DIORAMA.hillNight : DIORAMA.parkHillDayLight }]} />
        <View style={[styles.hillFront, { backgroundColor: night ? DIORAMA.parkHillNight : DIORAMA.parkHillDay }]} />
        {!night && <View style={styles.windowGlint} />}
      </View>
      <Image source={WINDOW_FRAME} resizeMode="contain" style={[styles.windowImage, { width, height }]} />
      {upgraded && <View style={[styles.windowUpgradeSpark, { width: width * 0.46 }]} />}
    </View>
  );
}

function PictureMedallion({ top: _top, night: _night }: { top: number; night: boolean }) {
  return null;
}

function WallMillwork({ floorTop, night }: { floorTop: number; night: boolean }) {
  const rail = night ? DIORAMA.woodNight : DIORAMA.woodMid;
  return (
    <>
      <LinearGradient
        colors={night ? ['rgba(46,38,51,0.42)', 'rgba(35,30,44,0.16)'] : ['rgba(255,241,208,0.18)', 'rgba(197,139,78,0.12)']}
        style={[styles.wainscot, { top: floorTop - 132, height: 105 }]}
      />
      <View style={[styles.wainscotRailShadow, { top: floorTop - 137 }]} />
      <View style={[styles.wainscotRail, { top: floorTop - 142, backgroundColor: rail }]} />
      {[82, 205, 328].map((left) => (
        <View
          key={left}
          style={[
            styles.panelStile,
            {
              left,
              top: floorTop - 129,
              height: 94,
              backgroundColor: rail,
              opacity: night ? 0.32 : 0.26,
            },
          ]}
        />
      ))}
      <View style={[styles.panelBaseGlow, { top: floorTop - 34, opacity: night ? 0.04 : 0.18 }]} />
    </>
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
        {rival && <Path d="M8 27 36 8M8 9 36 28" stroke={ITEM.leather} strokeWidth={2.2} opacity={0.62 * dim} strokeLinecap="round" />}
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
        return { right: shelfRight + shelfW * 0.58, top: chromeBottom + 100 };
      case 'shelf-right':
        return { right: shelfRight + shelfW * 0.16, top: chromeBottom + 100 };
      // Pictures hang on the open wall BETWEEN the window and the shelf,
      // stacked, rather than being anchored off the shelf -- which is how the
      // photo ended up on top of the window when the wall was recomposed.
      case 'wall-left':
        return { left: stripCenter - 17 * scale, top: chromeBottom + 74 };
      case 'wall-right':
        return { left: stripCenter - 17 * scale, top: chromeBottom + 150 };
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

  const chairW = 146 * propScale;
  const chairH = chairW * (398 / 374);
  const lampW = 76 * propScale;
  const lampH = lampW * 2;
  /*
   * The wall is COMPOSED, not edge-pinned. The window used to hang 5px off the
   * left of the screen and the shelf sat 7px from the right, which read as two
   * clipped objects with a hole between them -- the single biggest reason the
   * room looked like a layout instead of a place. Both now keep a real margin
   * and grow to close the gap, and the margin is a fraction of the screen so a
   * tablet gets a wider room rather than the same phone furniture marooned in
   * empty wall.
   */
  const wallInset = Math.max(12, width * 0.045);

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

  const shelfNaturalW = 138 * propScale;
  const shelfNaturalH = shelfNaturalW * (481 / 298);
  const shelfFit = shelfNaturalH > wallBand ? wallBand / shelfNaturalH : 1;
  const shelfW = shelfNaturalW * shelfFit;
  const shelfH = shelfNaturalH * shelfFit;

  const windowNaturalScale = propScale * 0.86;
  const windowNaturalW = (has('home_window') ? 224 : 208) * windowNaturalScale;
  const windowNaturalH = windowNaturalW * (760 / 720);
  const windowScale =
    windowNaturalH > wallBand ? windowNaturalScale * (wallBand / windowNaturalH) : windowNaturalScale;
  const windowW = (has('home_window') ? 224 : 208) * windowScale;
  const bedW = (has('home_bed') ? 144 : 126) * propScale;
  const bedH = bedW * (254 / 512);

  return (
    <WorldScene motion={asleep ? 'sleep' : motion} testID="world-scene-home">
      <WorldLayer name="sky">
        <LinearGradient colors={wall} style={[styles.fill, { bottom: undefined, height: floorTop }]} />
      </WorldLayer>

      <WorldLayer name="ground"><Svg width="100%" height="100%" viewBox="0 0 420 760" preserveAspectRatio="none" style={styles.fill}>
        <Rect x={0} y={floorTop} width={420} height={760 - floorTop} fill={floorFar} />
        <Rect x={0} y={floorTop + 78} width={420} height={682 - floorTop} fill={floorNear} opacity={0.72} />
        {[34, 106, 178, 250, 322, 394].map((x) => (
          <Path
            key={x}
            d={`M${x} ${floorTop}L${210 + (x - 210) * 1.85} 760`}
            stroke={floorLine}
            strokeWidth={2}
            opacity={night ? 0.15 : 0.22}
          />
        ))}
        {[floorTop + 44, floorTop + 99, floorTop + 166, floorTop + 244].map((y) => (
          <Path key={y} d={`M0 ${y}H420`} stroke={floorLine} strokeWidth={2} opacity={night ? 0.12 : 0.18} />
        ))}
      </Svg>

        {has('home_rug') && <Rug groundY={groundY} night={night} scale={propScale} />}
      </WorldLayer>

      <WorldLayer name="distant">
        <LinearGradient
          colors={night ? ['rgba(16,18,35,0.18)', 'rgba(16,18,35,0)'] : ['rgba(255,218,132,0.30)', 'rgba(255,218,132,0)']}
          start={{ x: 0, y: 0.18 }}
          end={{ x: 0.74, y: 0.76 }}
          style={[styles.lightPool, { top: chromeBottom + 18, height: Math.max(270, groundY - chromeBottom + 28) }]}
        />
        <View style={[styles.ceilingTrim, { top: chromeBottom + 20, backgroundColor: night ? DIORAMA.woodNight : DIORAMA.woodSoft, opacity: night ? 0.34 : 0.26 }]} />
        <WallMillwork floorTop={floorTop} night={night} />
        <View style={[styles.baseboard, { top: floorTop - 27, backgroundColor: night ? DIORAMA.woodNight : DIORAMA.woodDeep }]} />
        <View style={[styles.baseboardGlint, { top: floorTop - 24, opacity: night ? 0.04 : 0.22 }]} />
      </WorldLayer>

      <WorldLayer name="landmark">
        <RenderedWindow band={night ? 'night' : band} upgraded={has('home_window')} top={wallTop + 10} left={wallInset} scale={windowScale} />
        <PictureMedallion top={chromeBottom + 94} night={night} />
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
        <WorldObject source={LAMP} left={wallInset * 0.5} top={floorTop - lampH + 11} width={lampW} height={lampH} night={night} depth={0.66} contactShadow />
        <WorldObject source={CHAIR} left={wallInset} top={floorTop - chairH + 58} width={chairW} height={chairH} night={night} depth={0.74} contactShadow />
        <WorldObject source={BED} right={wallInset} top={floorTop + 12} width={bedW} height={bedH} night={night} depth={0.76} contactShadow baseInset={0.16} />
      </WorldLayer>

      <WorldLighting ground={groundY} night={night} warm />
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
  baseboard: { position: 'absolute', left: 0, right: 0, height: 17, opacity: 0.72 },
  baseboardGlint: { position: 'absolute', left: 0, right: 0, height: 5, backgroundColor: DIORAMA.white },
  wainscot: { position: 'absolute', left: 0, right: 0 },
  wainscotRailShadow: {
    position: 'absolute', left: 0, right: 0, height: 18,
    backgroundColor: DIORAMA.shadow, opacity: 0.11,
  },
  wainscotRail: {
    position: 'absolute', left: 0, right: 0, height: 12,
    borderRadius: radius.sm,
  },
  panelStile: {
    position: 'absolute', width: 5,
    borderRadius: radius.xs,
  },
  panelBaseGlow: {
    position: 'absolute', left: 0, right: 0, height: 6,
    backgroundColor: DIORAMA.white,
  },
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
  sunMoon: { position: 'absolute', right: 18, top: 16, width: 28, height: 28, borderRadius: radius.md },
  hillBack: {
    position: 'absolute', left: -24, right: 32, bottom: -30, height: 82,
    borderRadius: radius.pill, transform: [{ rotate: '-6deg' }],
  },
  hillFront: {
    position: 'absolute', left: 34, right: -26, bottom: -36, height: 88,
    borderRadius: radius.pill, transform: [{ rotate: '8deg' }],
  },
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
