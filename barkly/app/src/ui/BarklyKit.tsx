import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { color, elevation, radius, space, type } from './theme';
import { CARE_DOCK_HEIGHT, INTERACTION_GUTTER, TAP_MIN } from './layout';
import { BRASS, DIORAMA } from './scenes/artPalette';

const CARE_TRAY = require('../../assets/world/home/props/care_tray.png');

/**
 * HIS THINGS, RENDERED.
 *
 * Everything on this tray was a flat SVG standing on a Blender render of a
 * wooden tray, under a Blender render of a dog: a bowl drawn as two stacked
 * ellipses, and a "stick" that was three brown strokes on brown wood measuring
 * 1.02:1 against it. The bowl, the stick, the ball, the rope and the bed are
 * the same objects the shop sells and the room contains, from the same pack.
 *
 * Waves stay drawn. They are the one slot that is not an OBJECT -- at the beach
 * the play control is "go and charge the sea" -- and there is nothing to model.
 */
const KIT_ART: Record<string, { source: number; width: number; aspect: number }> = {
  bowl: { source: require('../../assets/world/item/kit_bowl.png'), width: 74, aspect: 224 / 126 },
  stick: { source: require('../../assets/world/item/kit_stick.png'), width: 80, aspect: 224 / 97 },
  ball: { source: require('../../assets/world/item/toy_ball.png'), width: 54, aspect: 224 / 209 },
  rope: { source: require('../../assets/world/item/toy_rope.png'), width: 80, aspect: 224 / 84 },
  bed: { source: require('../../assets/world/home/props/bed.png'), width: 86, aspect: 534 / 181 },
};

/**
 * Width, and the render's OWN aspect -- never a typed height.
 *
 * These started as hand-typed width/height pairs and one of them was already
 * wrong: the dig site was drawn at 118x47 while its render is 529x165, so it
 * shipped squashed by 22%. Nothing caught it, because a typed height is not
 * checkable against anything. Derived heights are, and
 * __tests__/scene_surfaces.test.ts holds every aspect below against the file.
 */
function KitArt({ id }: { id: keyof typeof KIT_ART }) {
  const art = KIT_ART[id];
  return (
    <Image
      source={art.source}
      style={{ width: art.width, height: art.width / art.aspect }}
      resizeMode="contain"
    />
  );
}

/** He is in it. The drawn bed carried this; the render cannot, so it rides on top. */
function Zzz() {
  return (
    <Svg width={22} height={18} viewBox="0 0 22 18" style={{ position: 'absolute', right: 2, top: -2 }}>
      <Path d="M3 5h7l-7 8h7" stroke={DIORAMA.paleCream} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M13 2h5l-5 6h5" stroke={DIORAMA.paleCream} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
    </Svg>
  );
}

export type KitAction = 'feed' | 'play' | 'sleep';

type Props = {
  toyId: string | null;
  playLabel: string;
  asleep: boolean;
  wants: KitAction | null;
  disabled: boolean;
  onPress(action: KitAction): void;
};

function useNudge(active: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      Animated.timing(v, { toValue: 0, duration: 160, useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 620, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 620, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, v]);
  return v.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
}



/**
 * A RIM, SO THE OBJECT EXISTS AGAINST THE SHELF.
 *
 * The dock is `DIORAMA.woodMid` (#78411F) and the kit's two long thin toys are
 * brown: measured, `ITEM.stick` against that dock is a contrast ratio of
 * **1.02** -- the same colour, to within rounding. So the play control, on a
 * fresh save where no toy is owned yet and the stick is what a new player
 * gets, was an object-shaped hole in a plank. Measured off a real screenshot
 * the play slot read 3.95 against 10.83 for feed and 11.94 for sleep beside
 * it: a third of the contrast, on the middle of the three primary controls.
 *
 * The bowl and the bed do not need this -- they are large, saturated and
 * light. A rope and a stick are thin strokes in the wood's own hue, so they
 * get the light the wood cannot give them: one cream stroke, widest, drawn
 * first, which is 6.67 against the dock and holds whatever the toy is.
 *
 * Re-measured on the rebuilt artifact from the same screenshot: the play
 * slot went 3.95 -> 16.4, with feed at 11.2 and sleep at 11.5 beside it.
 */
const RIM = { stroke: DIORAMA.paleCream, strokeLinecap: 'round' as const, fill: 'none' as const, opacity: 0.9 };



function Waves() {
  return <Svg width={82} height={52} viewBox="0 0 76 46">
    <Ellipse cx={38} cy={40} rx={28} ry={4} fill={DIORAMA.shadow} opacity={0.18} />
    <Path d="M4 29 Q17 14 30 28 T56 27 T74 27" strokeWidth={15} {...RIM} />
    <Path d="M4 29 Q17 14 30 28 T56 27 T74 27" stroke={DIORAMA.aquaDeep} strokeWidth={12} fill="none" strokeLinecap="round" />
    <Path d="M4 25 Q17 10 30 24 T56 23 T74 23" stroke={DIORAMA.aqua} strokeWidth={9} fill="none" strokeLinecap="round" />
    <Path d="M8 21 Q18 12 28 21" stroke={DIORAMA.white} strokeWidth={3.5} fill="none" strokeLinecap="round" opacity={0.7} />
  </Svg>;
}


function Slot({ action, label, hint, wanted, disabled, onPress, children }: {
  action: KitAction; label: string; hint: string; wanted: boolean; disabled: boolean;
  onPress(a: KitAction): void; children: React.ReactNode;
}) {
  const lift = useNudge(wanted && !disabled);
  const press = useRef(new Animated.Value(1)).current;
  return <Pressable
    onPressIn={() => Animated.spring(press, { toValue: 0.91, friction: 5, tension: 340, useNativeDriver: true }).start()}
    onPressOut={() => Animated.spring(press, { toValue: 1, friction: 5, tension: 320, useNativeDriver: true }).start()}
    onPress={() => onPress(action)} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
    accessibilityHint={hint} accessibilityState={{ disabled }} testID={`kit-${action}`}
    style={[styles.slot, disabled && styles.off]}>
    <View style={[styles.wellShadow, wanted && styles.wellShadowWanted]} pointerEvents="none" />
    <View style={[styles.well, wanted && styles.wellWanted]} pointerEvents="none"><View style={styles.wellGloss} /></View>
    <Animated.View style={[styles.art, { transform: [{ translateY: lift }, { scale: press }] }]}>{children}</Animated.View>
    {wanted && !disabled && <Text style={styles.label}>{label}</Text>}
  </Pressable>;
}

export default function BarklyKit({ toyId, playLabel, asleep, wants, disabled, onPress }: Props) {
  const { width, height } = useWindowDimensions();
  const dockBottom = width > height ? 0 : -2;
  const action = playLabel.toLowerCase();
  const visual = action.includes('tug') ? 'rope'
    : action.includes('fetch') || action.includes('throw') ? 'ball'
      : action.includes('wave') || action.includes('chasing') ? 'waves'
        : toyId === 'toy_rope' ? 'rope' : toyId === 'toy_ball' ? 'ball' : 'stick';
  const hint = visual === 'rope' ? 'His rope. Take one end — he will not let go.'
    : visual === 'ball' ? 'His ball. Throw it and he will bring it back. Probably.'
      : visual === 'waves' ? 'Tap to let him charge the waves.'
        : 'Whatever he can find. It is usually a stick.';

  return <View style={[styles.kit, { bottom: dockBottom }]}>
    {/*
      A RENDERED TRAY, not five stacked Views.

      Every piece of furniture around this thing is a Blender render -- his
      bed, the chair, the lamp, the shelf, the rug, and the window frame he
      stands in front of -- and the tray directly beneath him was a rounded
      rectangle with a gloss bar and two dots on it, on screen in all four
      locations at all times. That was the real material mismatch in the app.

      It is still a TRAY and not a control panel: the visual direction asks for
      his in-world bowl and bed rather than a dock, so the three items keep
      being drawn live on top of it and can still light up, count and animate.
      `resizeMode="stretch"` because a tray is a tray at any phone width; the
      wells are placed to sit under the three slots.

      Rendered by tools/blender/world_prop_pack.py like every other prop, so it
      shares the one camera and the one light rig and cannot drift from them.
    */}
    <View style={styles.dockShadow} pointerEvents="none" />
    <View style={styles.dock} pointerEvents="none">
      <Image source={CARE_TRAY} style={styles.dockWood} resizeMode="stretch" />
    </View>
    <Slot action="feed" label="food" hint="His bowl. Tap it to choose what he eats." wanted={wants === 'feed'} disabled={disabled} onPress={onPress}><KitArt id="bowl" /></Slot>
    <Slot action="play" label={playLabel} hint={hint} wanted={wants === 'play'} disabled={disabled} onPress={onPress}>
      {visual === 'waves' ? <Waves /> : <KitArt id={visual} />}
    </Slot>
    <Slot action="sleep" label={asleep ? 'wake' : 'bed'} hint={asleep ? 'Wake him up.' : 'His bed.'} wanted={wants === 'sleep'} disabled={disabled} onPress={onPress}><><KitArt id="bed" />{asleep && <Zzz />}</></Slot>
  </View>;
}

const styles = StyleSheet.create({
  kit: {
    position: 'absolute',
    left: INTERACTION_GUTTER,
    right: INTERACTION_GUTTER,
    height: CARE_DOCK_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: space.xs,
    zIndex: 8,
  },
  dockShadow: { position: 'absolute', left: 13, right: 13, bottom: -2, height: 20, borderRadius: radius.xl, backgroundColor: DIORAMA.shadow, opacity: 0.26 },
  // The render supplies the MATERIAL; this View supplies the SILHOUETTE. Wood
  // on a wooden floor has no edge of its own, and the first in-app pass of the
  // rendered tray lost the dark outline that made the flat one read as an
  // object sitting on the floor rather than a stain in it.
  dock: { position: 'absolute', left: 4, right: 4, bottom: 2, height: 42, borderRadius: radius.md, borderWidth: 2.5, borderColor: DIORAMA.woodDeep, backgroundColor: DIORAMA.woodMid, overflow: 'hidden', ...elevation.low },
  dockWood: { position: 'absolute', left: -2.5, right: -2.5, top: -2.5, bottom: -2.5 },
  slot: { minWidth: TAP_MIN + 26, minHeight: TAP_MIN + 10, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 },
  off: { opacity: 0.4 },
  /*
   * A MAT the object rests on, sized to the object -- not a dish it stands in.
   *
   * 29pt was too short once the items became renders: a brown stick lying on
   * brown planks measures 1.02:1 against them, and the drawn version only got
   * away with it by painting a cream outline around itself. Taking it to 52
   * over-corrected -- the tray is about 60pt tall on a phone, so the mats stood
   * PROUD of it, three white ovals floating over a wooden tray with the objects
   * huddled at the bottom of each. 34 covers what the art actually occupies.
   */
  wellShadow: { position: 'absolute', bottom: 4, width: 82, height: 34, borderRadius: radius.lg, backgroundColor: DIORAMA.shadow, opacity: 0.28 },
  wellShadowWanted: { opacity: 0.38 },
  well: { position: 'absolute', bottom: 8, width: 82, height: 34, borderRadius: radius.lg, backgroundColor: DIORAMA.cream, borderWidth: 2, borderColor: DIORAMA.woodDeep, overflow: 'hidden' },
  wellWanted: { backgroundColor: DIORAMA.goldGlowSoft, borderColor: BRASS.dark },
  wellGloss: { position: 'absolute', left: 10, right: 10, top: 4, height: 4, borderRadius: radius.pill, backgroundColor: DIORAMA.white, opacity: 0.64 },
  art: { alignItems: 'center', justifyContent: 'flex-end', height: 58, zIndex: 2 },
  label: { position: 'absolute', bottom: -2, ...type.micro, color: color.inkOn, backgroundColor: color.ink, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden', zIndex: 3 },
});
