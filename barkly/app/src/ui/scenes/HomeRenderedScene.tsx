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
      <Svg width={34} height={38} viewBox="0 0 34 38">
        <Ellipse cx={17} cy={35} rx={13} ry={2.6} fill={DIORAMA.shadow} opacity={0.18} />
        <Path d="M2 2h30v30H2Z" fill={DIORAMA.shadow} opacity={0.22} />
        <Path d="M2 1h30v29H2Z" fill={DIORAMA.white} opacity={dim} />
        <Path d="M5 4h24v18H5Z" fill={rival ? DIORAMA.coral : DIORAMA.aquaLight} opacity={dim} />
        <Circle cx={17} cy={13} r={5.4} fill={rival ? DIORAMA.coralDeep : DIORAMA.butterDeep} opacity={dim} />
        <Path d="M12 9q1.6-3 3.4 0M19 9q1.6-3 3.4 0" stroke={ITEM.leather} strokeWidth={1.7} fill="none" strokeLinecap="round" opacity={dim} />
        {rival && <Path d="M6 20 27 6M6 7 27 20" stroke={ITEM.leather} strokeWidth={1.6} opacity={0.6 * dim} strokeLinecap="round" />}
        <Path d="M5 4h24v3H5Z" fill={DIORAMA.white} opacity={0.3} />
      </Svg>
    );
  }
  if (visual === 'handmade-award') {
    return (
      <Svg width={30} height={36} viewBox="0 0 30 36">
        <Ellipse cx={15} cy={33} rx={11} ry={2.4} fill={DIORAMA.shadow} opacity={0.18} />
        <Path d="M11 18h8l3 14-7-4-7 4Z" fill={DIORAMA.coralDeep} opacity={dim} />
        <Circle cx={15} cy={13} r={11} fill={BRASS.edge} opacity={dim} />
        <Circle cx={15} cy={11.6} r={9.4} fill={BRASS.polished} opacity={dim} />
        <Circle cx={15} cy={11.6} r={5.6} fill={BRASS.dark} opacity={0.34 * dim} />
        <Path d="M8 7q6-4 13-1" stroke={DIORAMA.white} strokeWidth={2.4} fill="none" strokeLinecap="round" opacity={0.5 * dim} />
      </Svg>
    );
  }
  if (visual === 'souvenir-card') {
    return (
      <Svg width={32} height={34} viewBox="0 0 32 34">
        <Ellipse cx={16} cy={31} rx={12} ry={2.4} fill={DIORAMA.shadow} opacity={0.18} />
        <Path d="M3 4h26v26H3Z" fill={DIORAMA.violetDeep} opacity={dim} />
        <Path d="M3 3h26v25H3Z" fill={DIORAMA.violet} opacity={dim} />
        <Path d="M16 8l2.6 5.4 5.8.8-4.2 4 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.2-4 5.8-.8Z" fill={DIORAMA.lemon} opacity={dim} />
        <Path d="M5 5h22v3H5Z" fill={DIORAMA.white} opacity={0.26} />
      </Svg>
    );
  }
  return (
    <Svg width={36} height={30} viewBox="0 0 36 30">
      <Ellipse cx={18} cy={27} rx={13} ry={2.6} fill={DIORAMA.shadow} opacity={0.2} />
      <Path d="M5 17q-3-6 2-8 4-1.6 6 2h10q2-3.6 6-2 5 2 2 8-2 5-9 5H14q-7 0-9-5Z" fill={ITEM.stick} opacity={dim} />
      <Path d="M5 15q-3-6 2-8 4-1.6 6 2h10q2-3.6 6-2 5 2 2 8-2 4.4-9 4.4H14Q7 19.4 5 15Z" fill={ITEM.stickLight} opacity={dim} />
      <Path d="M10 10q7-2 15 0" stroke={DIORAMA.white} strokeWidth={2.2} fill="none" strokeLinecap="round" opacity={0.34 * dim} />
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
  const shelfW = 138 * propScale;
  const shelfH = shelfW * (481 / 298);
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
        <RenderedWindow band={night ? 'night' : band} upgraded={has('home_window')} top={chromeBottom + 62} left={wallInset} scale={propScale * 0.86} />
        <PictureMedallion top={chromeBottom + 94} night={night} />
        <WorldObject source={SHELF} right={wallInset} top={chromeBottom + 52} width={shelfW} height={shelfH} night={night} depth={0.42} contactShadow />
        <HomeBiography
          props={biography}
          chromeBottom={chromeBottom}
          floorTop={floorTop}
          shelfRight={wallInset}
          shelfW={shelfW}
          stripCenter={wallInset + (width - 2 * wallInset - shelfW - (has('home_window') ? 224 : 208) * propScale * 0.86) / 2 + (has('home_window') ? 224 : 208) * propScale * 0.86}
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
        <WorldObject source={LAMP} left={wallInset * 0.5} top={floorTop - lampH + 11} width={lampW} height={lampH} night={night} depth={0.66} contactShadow />
        <WorldObject source={CHAIR} left={wallInset} top={floorTop - chairH + 36} width={chairW} height={chairH} night={night} depth={0.74} contactShadow />
        <WorldObject source={BED} right={wallInset} top={floorTop + 12} width={bedW} height={bedH} night={night} depth={0.76} contactShadow />
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
  baseboard: { position: 'absolute', left: 0, right: 0, height: 28 },
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
