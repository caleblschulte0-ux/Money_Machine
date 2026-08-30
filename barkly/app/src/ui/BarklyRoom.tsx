/**
 * Barkly's world: home, park, town — plus the Pack Book that makes the
 * relationship itself a first-class part of the product.
 */

import React, { useEffect, useRef, useState } from 'react';
import { color, elevation, radius, space, type } from './theme';
import { LinearGradient } from 'expo-linear-gradient';
import { BALL, BRASS, DIORAMA, GROUND, LEAF } from './scenes/artPalette';
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useBarkly } from '../hooks/useBarkly';
import { playLabelFor, playRoutineFor } from '../game/play';
import AdventureSheet from './AdventureSheet';
import BarklyPhotoView from './BarklyPhotoView';
import EncounterSheet from './EncounterSheet';
import Onboarding from './Onboarding';
import PackBookSheet from './PackBookSheet';
import StoreSheet, { CoinPill } from './StoreSheet';
import FoodSheet from './FoodSheet';
import ContestSheet from './ContestSheet';
import { AREA_UNLOCKS, levelProgress } from '../game/progression';
import BarklyView from './BarklyView';
import DialoguePanel from './DialoguePanel';
import SettingsSheet from './SettingsSheet';
import { Ball, DigMound, FoodBowl, WetSandMound } from './StageProps';
import BarklyKit, { KitAction } from './BarklyKit';
import PlaytestSheet from './PlaytestSheet';
import { playtestAllowed } from '../dev/playtest';
import { useAttention } from './useAttention';
import { feel, setFeelMuted } from './feel';
import {
  BeachScene,
  DogBedBack,
  DogBedFront,
  HomeScene,
  NightOverlay,
  ParkScene,
  TownScene,
} from './scenes/Scenes';
import { BarklyState } from '../barkly/types';
import { LOCATION_ORDER, LOCATIONS, LocationId } from '../world/locations';
import {
  chromeBottom,
  contentFrameWidth,
  CONTROLS_HEIGHT,
  DIALOGUE_GAP,
  DIALOGUE_HEIGHT,
  RESTING_DIALOGUE_HEIGHT,
  PLACES_HEIGHT,
  STATUS_HEIGHT,
  NOTICE_MAX_HEIGHT,
  NOTICE_PRIORITY,
  contentBottom,
  contentTop,
  interactionRailWidth,
  isLandscapeMode,
  layoutMode,
  navRailWidth,
  noticeTop,
  NoticeKind,
  SPEECH_MAX_LINES,
  SPRITE_FOOT,
  stageHeight,
  stageWidth,
  TAP_MIN,
  spriteScale as scaleForScreen,
} from './layout';
import { NPCS, NpcId } from '../world/npcs';
import { bondFor } from '../barkly/character';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Renderer = process.env.EXPO_PUBLIC_BARKLY_RENDERER === 'vector' ? BarklyView : BarklyPhotoView;

const NPC_ART: Record<NpcId, ReturnType<typeof require>> = {
  biscuit: require('../../assets/barkly/renders/npcs/biscuit_front.png'),
  pepper: require('../../assets/barkly/renders/npcs/pepper_front.png'),
  duke: require('../../assets/barkly/renders/npcs/duke_front.png'),
};

/**
 * Where the other dogs stand — and how far BACK they stand.
 *
 * They used to be drawn at roughly 45% of Barkly's height with their feet
 * barely above his, which is not a dog in the middle distance: it is a small
 * dog standing next to him. The scene read as three cut-outs pasted on a
 * green rectangle, because the only depth cue in it was overlap.
 *
 * Two cues, applied together, are what make it a space: things further away
 * are SMALLER and their feet are HIGHER up the ground plane. `bottom` is that
 * second cue, so it scales with the sprite — moving the horizon must not
 * leave a dog hovering.
 */
/**
 * Where each dog stands, and how big.
 *
 * The sizes were 82-88 against Barkly's ~244 and everyone read them as
 * stickers pinned to the screen edges. Bigger alone would have broken the
 * perspective — a distant dog cannot grow — so they moved NEARER as they
 * grew: larger AND lower on screen together, which is what walking a few
 * steps toward the camera actually looks like. They now overlap Barkly's
 * silhouette slightly at the edges, which is depth, not a collision: they
 * draw behind him.
 */
const NPC_SPOTS: Partial<Record<NpcId, { left?: number; right?: number; bottom: number; size: number }>> = {
  biscuit: { left: 10, bottom: 76, size: 80 },
  duke: { right: 3, bottom: 70, size: 90 },
  pepper: { right: 8, bottom: 72, size: 86 },
};

const STATE_LABEL: Partial<Record<BarklyState, string>> = {
  listening: 'listening',
  thinking: 'thinking',
  annoyed: 'hmph.',
  sleepy: 'napping',
  hungry: 'hungry',
  eating: 'nom nom',
  playing: 'zoomies',
};

const ACCENT = BRASS.light;

function AnimatedBubble({ children, changeKey }: { children: React.ReactNode; changeKey: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.spring(v, { toValue: 1, friction: 7, tension: 120, useNativeDriver: true }).start();
  }, [changeKey, v]);
  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          opacity: v,
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function HeartBurst({ burst }: { burst: number }) {
  const [hearts, setHearts] = useState<{ id: number; x: number; v: Animated.Value }[]>([]);
  const nextId = useRef(0);
  useEffect(() => {
    if (burst === 0) return;
    const created = Array.from({ length: 3 }, (_, i) => ({
      id: nextId.current++,
      x: -34 + Math.random() * 68,
      v: new Animated.Value(0),
    }));
    setHearts((h) => [...h, ...created]);
    created.forEach((heart, i) => {
      Animated.timing(heart.v, {
        toValue: 1,
        duration: 850 + i * 140,
        delay: i * 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => setHearts((h) => h.filter((x) => x.id !== heart.id)));
    });
  }, [burst]);

  return (
    <View style={styles.heartLayer} pointerEvents="none">
      {hearts.map((h) => (
        <Animated.Text
          key={h.id}
          style={[
            styles.heart,
            {
              transform: [
                { translateX: h.x },
                { translateY: h.v.interpolate({ inputRange: [0, 1], outputRange: [0, -92] }) },
                { scale: h.v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.5, 1.1, 0.9] }) },
              ],
              opacity: h.v.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 0.9, 0] }),
            },
          ]}
        >
          ♥
        </Animated.Text>
      ))}
    </View>
  );
}

/**
 * Ground contact.
 *
 * There was one shadow in the app: a single flat brown ellipse at 15% opacity,
 * the same on wood, on grass and on wet sand, with a hard edge and no
 * falloff — so on every surface it read as a grey slab and the dog read as
 * pasted onto the background rather than standing on it. And the NPCs had no
 * shadow at all, so they simply floated.
 *
 * Two ellipses (a soft wide one under a tighter core) in a colour drawn from
 * the ground he is actually on is the whole difference between "on the floor"
 * and "in front of a picture of a floor".
 */
const GROUND_SHADOW: Record<LocationId, string> = {
  home: GROUND.home,
  park: GROUND.park,
  town: GROUND.town,
  beach: GROUND.beach,
};

/**
 * The shadow he casts.
 *
 * Two flat stadiums stacked on each other, which is what this was, read as a
 * green pill lying on the grass — hard-edged, obviously a shape rather than an
 * absence of light. There is no radial gradient in React Native, so the
 * falloff is faked the way it is faked in sprite work: several ellipses,
 * each smaller and each slightly darker, so the edge dissolves over four steps
 * instead of one.
 */
const SHADOW_LAYERS = [
  { w: 1.12, h: 0.2, o: 0.05 },
  { w: 1.02, h: 0.175, o: 0.07 },
  { w: 0.8, h: 0.14, o: 0.1 },
  { w: 0.56, h: 0.1, o: 0.14 },
  /**
   * THE CONTACT CORE, and the reason the other dogs looked like they were
   * hovering.
   *
   * The four-step falloff above replaced two hard stadiums and was right about
   * the EDGE — but it dropped the darkest value from 0.17 to 0.10 and spread
   * it over a wide ellipse. On Barkly, 300px across, that still reads. On an
   * NPC at 80px it is a faint smudge, and a character whose shadow you cannot
   * see is a character standing in mid-air.
   *
   * A shadow does two jobs: it falls off softly at the rim AND it is dark
   * where the feet actually touch. Only the first was being done.
   */
  { w: 0.34, h: 0.062, o: 0.2 },
];

function GroundShadow({ location, width, style }: { location: LocationId; width: number; style?: object }) {
  const tint = GROUND_SHADOW[location];
  return (
    <View style={[{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }, style]} pointerEvents="none">
      {SHADOW_LAYERS.map((layer) => (
        <View
          key={layer.w}
          style={{
            position: 'absolute',
            width: width * layer.w,
            height: width * layer.h,
            borderRadius: width,
            backgroundColor: tint,
            opacity: layer.o,
          }}
        />
      ))}
    </View>
  );
}

function NpcDog({
  id,
  onPress,
  location,
  scale,
  talking,
  bond,
}: {
  id: NpcId;
  onPress: () => void;
  location: LocationId;
  /** Same scale Barkly gets, so the three of them stay in proportion. */
  scale: number;
  /** This dog currently has the floor — their bubble is up. */
  talking: boolean;
  /** The live relationship, so the HISTORY is visible in how they stand. */
  bond?: { kind: 'friend' | 'rival'; encounters: number };
}) {
  const spot = NPC_SPOTS[id]!;
  const fromLeft = spot.left !== undefined;

  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  /**
   * The RELATIONSHIP, standing there. The Pack Book says Biscuit is his best
   * friend and Duke is his nemesis, and until now both stood in exactly the
   * same polite spot — the history was documentation, not behaviour. Now a
   * friend drifts toward him as the bond deepens (capped well short of his
   * face), and a rival leans IN with a squarer stance the worse it gets.
   * Loading Biscuit Best Friend and Duke Nemesis should look different from
   * across the room, before anyone taps anything.
   */
  const closeness = Math.min((bond?.encounters ?? 0) / 30, 1);
  const towardCentre = fromLeft ? 1 : -1;
  const standIn = bond?.kind === 'friend' ? 26 * closeness : 10 * closeness;
  const squareUp = bond?.kind === 'rival' ? 4 * closeness : 0;

  /**
   * Taking the floor is a STEP FORWARD, not a bubble appearing over a distant
   * sticker. When their line is up they come toward the conversation — in and
   * slightly down (nearer the camera) and a touch larger — and step back when
   * it ends. Barkly's attention system already turns him to face them, so the
   * two of them now visibly square up for the exchange.
   */
  const floor = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(floor, { toValue: talking ? 1 : 0, tension: 40, friction: 11, useNativeDriver: true }).start();
  }, [talking, floor]);

  // A dog that never shifts its weight is a lawn ornament. Occasionally, on
  // its own clock (deliberately unsynchronised with the other dogs), a small
  // settle: a dip and a lean, then back.
  const fidget = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        Animated.sequence([
          Animated.timing(fidget, { toValue: 1, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(fidget, { toValue: 0, duration: 460, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]).start();
        schedule();
      }, 5200 + Math.random() * 6800);
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [fidget]);

  const breathScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.014] });
  return (
    /*
     * The container's bottom edge IS the ground line under this dog.
     *
     * It used to also contain the name, as the last child in a column — so the
     * container bottom was the bottom of the NAME CHIP, roughly twenty pixels
     * below his paws, and the shadow (positioned against that bottom) drew
     * itself under the label instead of under the dog. He stood on nothing.
     * The name is out of the flow now, hanging below the line, so the anchor
     * means what its name says.
     */
    <Animated.View
      style={[
        styles.npc,
        { left: spot.left, right: spot.right, bottom: spot.bottom * scale },
        {
          transform: [
            { translateX: (standIn + squareUp) * towardCentre * scale },
            { translateX: floor.interpolate({ inputRange: [0, 1], outputRange: [0, 30 * towardCentre * scale] }) },
            { translateY: floor.interpolate({ inputRange: [0, 1], outputRange: [0, 14 * scale] }) },
            { scale: floor.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
          ],
        },
      ]}
    >
      <GroundShadow location={location} width={spot.size * 0.92 * scale} style={{ bottom: 0 }} />
      <Pressable
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Talk to ${NPCS[id].name}`}
        accessibilityHint={NPCS[id].relationship === 'rival' ? 'Barkly has opinions about this one.' : 'One of the good ones.'}
      >
        <Animated.View
          style={{
            transform: [
              { scale: breathScale },
              { translateY: fidget.interpolate({ inputRange: [0, 1], outputRange: [0, 2.5] }) },
              { rotate: fidget.interpolate({ inputRange: [0, 1], outputRange: ['0deg', fromLeft ? '-1.6deg' : '1.6deg'] }) },
            ],
          }}
        >
          <Image source={NPC_ART[id]} style={{ width: spot.size * scale, height: spot.size * 1.25 * scale }} resizeMode="contain" />
        </Animated.View>
      </Pressable>
      {/* Below the ground line, out of the flow, so it cannot move the anchor. */}
      <Text style={[styles.npcName, { bottom: -19 * scale }]}>{NPCS[id].name.toUpperCase()}</Text>
    </Animated.View>
  );
}

/**
 * His ball, in one place.
 *
 * It was written out twice — once for the ball in flight during fetch, once
 * for the toy sitting in the room — and a palette pass turned BOTH copies into
 * the literal strings `fill="color.brand"`, which SVG cannot parse, so the
 * ball rendered as a black disc. Two copies is how one edit misses one of
 * them; now there is one copy, and its colours are art, not tokens.
 */
/**
 * The padlock on a place he cannot go yet.
 *
 * It was the 🔒 EMOJI, added in the same pass that took emoji out of the shop
 * for rendering in the operating system's art style rather than the app's.
 * Six pixels of drawn shackle is not a hard thing to do and it stops one glyph
 * on the screen being someone else's drawing.
 */
/** The "type instead" affordance. Drawn, like everything else in here. */
function KeyboardGlyph() {
  return (
    <Svg width={22} height={16} viewBox="0 0 22 16">
      <Rect x={0.9} y={0.9} width={20.2} height={14.2} rx={3} stroke={color.inkMid} strokeWidth={1.6} fill="none" />
      {[4, 8, 12, 16].map((x) => (
        <Rect key={x} x={x - 0.9} y={4} width={2.6} height={2.4} rx={0.8} fill={color.inkMid} />
      ))}
      <Rect x={3.1} y={9} width={2.6} height={2.4} rx={0.8} fill={color.inkMid} />
      <Rect x={7.1} y={9} width={7.8} height={2.4} rx={1.2} fill={color.inkMid} />
      <Rect x={16.3} y={9} width={2.6} height={2.4} rx={0.8} fill={color.inkMid} />
    </Svg>
  );
}

function LockGlyph() {
  return (
    <Svg width={11} height={12} viewBox="0 0 11 12" style={{ marginRight: 4 }}>
      <Path d="M3 5 V3.4 a2.5 2.5 0 0 1 5 0 V5" stroke={color.inkFaint} strokeWidth={1.4} fill="none" />
      <Rect x={1.4} y={5} width={8.2} height={6.2} rx={1.6} fill={color.inkFaint} />
    </Svg>
  );
}

function RubberBall({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 30 30">
      <Circle cx={15} cy={15} r={13} fill={BALL.body} />
      <Path d="M3 13 C11 9 19 9 27 13" stroke={BALL.seam} strokeWidth={2.5} fill="none" />
      <Circle cx={10} cy={9} r={3.5} fill={BALL.gloss} opacity={0.35} />
    </Svg>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M3 7.5h3.2L10.5 4v12L6.2 12.5H3z" fill={muted ? color.inkFaint : color.inkSoft} />
      {!muted && (
        <>
          <Path d="M13 7.2a4 4 0 0 1 0 5.6" stroke={color.inkSoft} strokeWidth={1.6} strokeLinecap="round" fill="none" />
          <Path d="M15.4 5.2a7 7 0 0 1 0 9.6" stroke={color.inkSoft} strokeWidth={1.6} strokeLinecap="round" fill="none" />
        </>
      )}
      {muted && <Path d="M13 6.5l5 7M18 6.5l-5 7" stroke={color.brand} strokeWidth={1.8} strokeLinecap="round" />}
    </Svg>
  );
}

export default function BarklyRoom() {
  const barkly = useBarkly();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [foodOpen, setFoodOpen] = useState(false);

  /**
   * Open one sheet, closing the rest.
   *
   * Nothing stopped two from being up at once — the shop over the settings
   * sheet, an encounter behind the food picker — and the one underneath still
   * caught taps through the backdrop. One at a time, always.
   */
  const openOnly = (open: (v: boolean) => void) => {
    setStoreOpen(false);
    setSettingsOpen(false);
    setPackOpen(false);
    setPlanOpen(false);
    setFoodOpen(false);
    open(true);
  };
  const [packOpen, setPackOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [heartBurst, setHeartBurst] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [tugging, setTugging] = useState(false);
  /** The keyboard is a choice, not a fallback — see the input block below. */
  const [typing, setTyping] = useState(false);
  const tugX = useRef(new Animated.Value(0)).current;
  const [digging, setDigging] = useState(false);
  const [variant, setVariant] = useState<'runRight' | 'carryLeft' | null>(null);

  const { snapshot, actions, lastExchange, partialTranscript, error, busy, locked, sttAvailable, location } = barkly;
  const listening = snapshot.state === 'listening';
  const asleep = snapshot.state === 'sleepy';
  const { height: screenH, width: screenW } = useWindowDimensions();
  const layout = layoutMode(screenW, screenH);
  const landscape = isLandscapeMode(layout);
  const widePortrait = layout === 'widePortrait';
  const frameW = contentFrameWidth(screenW, layout);
  const stageW = stageWidth(screenW, layout);
  const navW = navRailWidth(layout);
  const interactionW = interactionRailWidth(layout);
  const chromeBottomPx = chromeBottom(layout);
  /**
   * The real hardware insets, floored by the layout constants. On the web
   * these report zero and the floors carry it; on a notched phone the
   * hardware wins. Everything below that used to build on the CONTENT_TOP
   * constant builds on this instead, so nothing assumes a particular device.
   */
  const insets = useSafeAreaInsets();
  const topPad = contentTop(insets.top);
  const bottomPad = contentBottom(insets.bottom);
  // The idle prompt should not permanently consume a full speech-card slot.
  // Reclaim that room for the world until Barkly/NPC dialogue actually exists.
  const dialogueExpanded = Boolean(
    partialTranscript || lastExchange?.barklyText || barkly.thought || barkly.npcBubble || barkly.showcase
  );
  const dialogueHeightPx = dialogueExpanded ? DIALOGUE_HEIGHT : RESTING_DIALOGUE_HEIGHT;
  /**
   * How big he is drawn. The stage is a fixed band between the chrome and the
   * dialogue panel, and he has to live inside it — cropping his paws to make
   * room for a text panel is the kind of thing that makes an app feel like a
   * web page. Capped at 1 so a tall phone gives him air, not a poster.
   */
  const spriteScale = scaleForScreen(screenH, stageW, layout, dialogueExpanded);
  /** How tall the world is: everything above the dialogue panel. */
  const sceneBand = landscape ? screenH : screenH - dialogueHeightPx - DIALOGUE_GAP * 2 - CONTROLS_HEIGHT + 8;
  /**
   * Where his feet meet the ground, measured from the top of the scene layer.
   * Interior scenes are built around this line rather than around percentages
   * of a rectangle — see Scenes.HomeScene.
   */
  const groundY = topPad + chromeBottomPx + stageHeight(screenH, layout, dialogueExpanded) - SPRITE_FOOT;
  const stateLabel = STATE_LABEL[snapshot.state];

  /**
   * Stress mode: every overlay on screen at once.
   *
   * This is the brief made runnable — "pretend that everything that could ever
   * pop up on the screen popped up at once". Turned on from Settings (dev
   * tools), it forces a notice, a speech bubble, a thought, an NPC bubble, the
   * state chip and an error to render together so the spacing can be checked
   * against something real instead of imagined. scripts/overlap-check.mjs
   * measures the boxes in a browser and fails on any collision.
   */
  const showcase = barkly.showcase;

  // Muting the dog mutes his BODY too: a toy you have silenced should not
  // still buzz in your pocket. See ui/feel.
  useEffect(() => setFeelMuted(barkly.muted), [barkly.muted]);

  const shownPromo = barkly.promotion ?? SHOWCASE_PROMOTION;

  // Exactly one notice, highest priority first.
  const notice: NoticeKind | null = showcase
    ? 'promotion'
    : (NOTICE_PRIORITY.find((kind) =>
        kind === 'error'
          ? Boolean(error)
          : kind === 'degraded'
            ? Boolean(barkly.degraded)
            : kind === 'promotion'
              ? Boolean(barkly.promotion)
              : Boolean(barkly.reward),
      ) ?? null);
  const hour = new Date().getHours();
  const npcsHere = LOCATIONS[location].npcIds;
  const npcBubble =
    showcase && npcsHere.length > 0
      ? { id: npcsHere[0], line: 'Barkly!! I found a stick. It might be THE stick.' }
      : barkly.npcBubble;
  const planDone = barkly.adventure?.goals.filter((goal) => goal.done).length ?? 0;
  const planTotal = barkly.adventure?.goals.length ?? 0;
  const planComplete = Boolean(barkly.adventure?.completedAt);

  const sceneFade = useRef(new Animated.Value(1)).current;
  const walkX = useRef(new Animated.Value(0)).current;
  const hopY = useRef(new Animated.Value(0)).current;
  const prevLocation = useRef(location);
  useEffect(() => {
    if (prevLocation.current === location) return;
    prevLocation.current = location;
    sceneFade.setValue(0);
    walkX.setValue(-170);
    setVariant('runRight');
    setTimeout(() => setVariant(null), 760);
    Animated.parallel([
      Animated.timing(sceneFade, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(walkX, { toValue: 0, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.sequence(
        Array.from({ length: 4 }, () =>
          Animated.sequence([
            Animated.timing(hopY, { toValue: -12, duration: 88, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(hopY, { toValue: 0, duration: 88, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          ]),
        ),
      ),
    ]).start();
  }, [location, sceneFade, walkX, hopY]);

  const chaseX = useRef(new Animated.Value(0)).current;
  const ballFlight = useRef(new Animated.Value(0)).current;
  /** Throw, chase, grab, carry back. Used by fetch AND by ball play. */
  const runChase = (onDone: () => void) => {
    setFetching(true);
    ballFlight.setValue(0);
    Animated.timing(ballFlight, { toValue: 1, duration: 620, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    setTimeout(() => setVariant('runRight'), 380);
    Animated.sequence([
      Animated.delay(560),
      Animated.timing(chaseX, { toValue: 88, duration: 480, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(hopY, { toValue: 12, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(hopY, { toValue: 0, duration: 150, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => {
      setVariant('carryLeft');
      Animated.timing(chaseX, { toValue: 0, duration: 560, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start(() => {
        setVariant(null);
        setFetching(false);
        onDone();
      });
    });
  };

  /**
   * The play button. It used to speak one line wherever you stood, which felt
   * like a button that did nothing. Now it runs the routine for the toy he is
   * actually holding: a ball gets thrown and chased, a rope gets a tug, and
   * with nothing he improvises. Fetch at the park is the same chase.
   */
  const runTug = () => {
    setTugging(true);
      Animated.sequence([
        ...Array.from({ length: 5 }, (_, i) =>
          Animated.timing(tugX, {
            toValue: i % 2 === 0 ? -14 : 12,
            duration: 150,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ),
        Animated.spring(tugX, { toValue: 0, friction: 5, useNativeDriver: true }),
    ]).start(() => setTugging(false));
  };

  /**
   * One entry point for the play button, so the animation and the line can
   * never disagree about what he is doing. The animation is chosen from the
   * SAME `routine` the label was rendered from.
   */
  /**
   * What he would like, if anything. Drives the small lift on the matching
   * object — the one thing the button row did better than a bare world, which
   * is telling a child where to tap next.
   */
  const wants: KitAction | null =
    asleep
      ? null
      : snapshot.stats.hunger > 68
        ? 'feed'
        : snapshot.stats.energy < 22
          ? 'sleep'
          : snapshot.stats.mood < 42
            ? 'play'
            : null;

  /**
   * WHERE HE IS LOOKING — and the reason there is no "hungry" badge.
   */
  const look = useAttention({
    wants,
    eating: snapshot.state === 'eating',
    npcSpeaking: npcBubble ? npcBubble.id : null,
    speaking: snapshot.state === 'speaking',
    asleep,
  });

  /**
   * PLAYTEST. The badge IS the button — a dev build needs to say so, and a
   * tester needs a way in, and those are the same one-line pill rather than a
   * banner plus a hidden gesture.
   */
  const playtest = playtestAllowed();
  const [playtestOpen, setPlaytestOpen] = useState(false);

  const [beat, setBeat] = useState<{ kind: 'pet' | 'refuse' | 'arrive' | 'delight'; at: number } | null>(null);
  const react = (kind: 'pet' | 'refuse' | 'arrive' | 'delight') => setBeat({ kind, at: Date.now() });

  const onKit = (action: KitAction) => {
    if (action === 'feed') {
      feel('touch');
      openOnly(setFoodOpen);
      return;
    }
    if (action === 'sleep') {
      feel(asleep ? 'touch' : 'act');
      void barkly.sleepToggle();
      return;
    }
    runPlay();
  };

  const runPlay = () => {
    if (fetching || tugging || locked || digging) {
      react('refuse');
      return;
    }
    if (routine === 'waves') {
      runChase(() => void barkly.chaseWaves());
      return;
    }
    if (routine === 'tug') {
      feel('act');
      runTug();
      void barkly.play();
      return;
    }
    feel('act');
    runChase(() => void barkly.play());
  };

  const ballX = ballFlight.interpolate({ inputRange: [0, 1], outputRange: [0, 118] });
  const ballY = ballFlight.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -120, -8] });

  const sendTyped = async () => {
    const text = typed;
    setTyped('');
    await barkly.submitText(text);
  };

  const digRotate = useRef(new Animated.Value(0)).current;
  const runDig = () => {
    if (digging || fetching || locked) return;
    feel('act');
    setDigging(true);
    Animated.loop(
      Animated.sequence([
        Animated.timing(digRotate, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(digRotate, { toValue: -1, duration: 90, useNativeDriver: true }),
      ]),
      { iterations: 8 },
    ).start(async () => {
      digRotate.setValue(0);
      await barkly.dig();
      setDigging(false);
    });
  };

  const pet = () => {
    feel('touch');
    react('pet');
    barkly.pet();
    if (snapshot.state !== 'sleepy') setHeartBurst((b) => b + 1);
  };

  const bubbleText = showcase
    ? 'The longest thing he can say, at three full lines, so the tallest bubble this app can produce is the one being measured right here.'
    : listening && partialTranscript
      ? `“${partialTranscript}”`
      : lastExchange?.barklyText;

  const routine = playRoutineFor(barkly.toy?.id, location);
  const playLabel = playLabelFor(routine, location, fetching || tugging);

  if (barkly.onboarding === undefined) return <View style={styles.room} />;
  if (barkly.onboarding.step !== 'done') {
    return <Onboarding state={barkly.onboarding} micAvailable={sttAvailable} onAdvance={barkly.advanceOnboarding} Renderer={Renderer} />;
  }

  return (
    <View style={styles.room}>
      <Animated.View
        style={[styles.sceneLayer, { opacity: sceneFade }]}
      >
        {location === 'home' && <HomeScene hour={hour} upgrades={barkly.placedHome} asleep={asleep} groundY={groundY} chromeBottom={topPad + chromeBottomPx} />}
        {location === 'park' && <ParkScene hour={hour} bandHeight={sceneBand} groundY={groundY} />}
        {location === 'town' && <TownScene hour={hour} bandHeight={sceneBand} groundY={groundY} />}
        {location === 'beach' && <BeachScene hour={hour} bandHeight={sceneBand} groundY={groundY} />}
      </Animated.View>
      {asleep && <NightOverlay />}

      <LinearGradient
        colors={['rgba(255,249,236,0.55)', 'rgba(255,249,236,0.22)', 'rgba(255,249,236,0)']}
        style={[styles.chromeScrim, { height: chromeBottomPx + 78 }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(255,249,236,0)', 'rgba(255,249,236,0.72)', 'rgba(255,249,236,1)']}
        locations={[0, 0.55, 1]}
        style={[styles.horizon, { height: landscape ? 76 : dialogueHeightPx + CONTROLS_HEIGHT + 24 }]}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={[styles.content, { maxWidth: frameW, paddingHorizontal: landscape ? 12 : widePortrait ? 20 : 16 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.walletTap}
            onPress={() => openOnly(setStoreOpen)}
            accessibilityRole="button"
            accessibilityLabel={`Shop. ${barkly.wallet.coins} coins, level ${barkly.level}.`}
          >
            <CoinPill coins={barkly.wallet.coins} level={barkly.level} frac={levelProgress(barkly.wallet.xp).frac} />
          </Pressable>
          <View style={styles.headerButtons}>
            <Pressable
              style={styles.packButton}
              hitSlop={8}
              onPress={() => openOnly(setPackOpen)}
              accessibilityRole="button"
              accessibilityLabel={`Pack Book. ${barkly.relationship.archetype}. ${barkly.relationship.stage.label}.`}
            >
              <Text style={styles.packLabel}>PACK</Text>
              <Text style={styles.packLevel}>{barkly.relationship.stage.level}</Text>
            </Pressable>
            <Pressable style={styles.gear} hitSlop={10} onPress={() => openOnly(setSettingsOpen)} accessibilityRole="button" accessibilityLabel="Settings">
              <View style={styles.gearDot} />
              <View style={styles.gearDot} />
              <View style={styles.gearDot} />
            </Pressable>
          </View>
        </View>

        {notice && (
          <View
            style={[
              styles.noticeLayer,
              { top: noticeTop(topPad, layout) },
              landscape ? { left: navW + 12, right: interactionW + 12 } : { left: 22, right: 22 },
            ]}
            pointerEvents="box-none"
          >
            {notice === 'error' && (
              <View style={styles.errorNotice} pointerEvents="none" accessibilityLiveRegion="polite">
                <Text style={styles.errorText} numberOfLines={3}>
                  {error ?? 'Something went wrong and this is what it says.'}
                </Text>
              </View>
            )}
            {notice === 'degraded' && barkly.degraded && (
              <Pressable
                style={styles.degraded}
                onPress={barkly.dismissDegraded}
                accessibilityRole="button"
                accessibilityLabel={`${barkly.degraded}. Tap to dismiss.`}
              >
                <View style={styles.degradedDot} />
                <Text style={styles.degradedText} numberOfLines={2}>{barkly.degraded}</Text>
              </Pressable>
            )}
            {notice === 'promotion' && (barkly.promotion ?? SHOWCASE_PROMOTION) && (
              <View
                style={[styles.promo, shownPromo.kind === 'rival' ? styles.promoRival : styles.promoFriend]}
                pointerEvents="none"
                accessibilityLiveRegion="polite"
                accessibilityLabel={`${shownPromo.headline}. From ${shownPromo.fromLabel} to ${shownPromo.toLabel}.`}
              >
                <Text style={styles.promoEyebrow}>
                  {shownPromo.kind === 'rival' ? 'RIVALRY' : 'FRIENDSHIP'}
                </Text>
                <Text style={styles.promoHeadline} numberOfLines={1}>{shownPromo.headline}</Text>
              </View>
            )}
            {notice === 'reward' && barkly.reward && (
              <View style={styles.reward} pointerEvents="none" accessibilityLiveRegion="polite">
                <Text style={styles.rewardText} numberOfLines={1}>
                  +{barkly.reward.coins}c  +{barkly.reward.xp} xp
                  {barkly.reward.note ? `  ·  ${barkly.reward.note}` : ''}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={[styles.places, landscape && styles.placesLandscape, landscape && { width: navW }]}>
          <View style={[styles.tabs, landscape && styles.tabsLandscape]}>
          {LOCATION_ORDER.map((loc: LocationId) => {
            const areaLocked = !barkly.isUnlocked(loc);
            return (
              <Pressable
                key={loc}
                style={[styles.tab, landscape && styles.tabLandscape, location === loc && styles.tabActive, areaLocked && styles.tabLocked]}
                disabled={locked || fetching}
                onPress={() => { react('arrive'); barkly.goTo(loc); }}
                accessibilityRole="tab"
                accessibilityState={{ selected: location === loc }}
                accessibilityLabel={areaLocked ? `${LOCATIONS[loc].name}, locked until level ${AREA_UNLOCKS[loc]?.level}. Tap and he will say so.` : LOCATIONS[loc].name}
              >
                {areaLocked && <LockGlyph />}
                <Text style={[styles.tabText, location === loc && styles.tabTextActive]} numberOfLines={1}>
                  {LOCATIONS[loc].name.toLowerCase()}
                </Text>
              </Pressable>
            );
          })}
          {barkly.adventure && (
            <Pressable
              style={[styles.planChip, planComplete && styles.planChipDone, landscape && styles.planChipLandscape]}
              onPress={() => openOnly(setPlanOpen)}
              accessibilityRole="button"
              accessibilityLabel={`Barkly's plan. ${planDone} of ${planTotal} complete. ${
                planComplete ? 'All done.' : barkly.adventure.goals.find((g) => !g.done)?.label ?? ''
              }`}
            >
              <Text style={[styles.planChipText, planComplete && styles.planChipTextDone]}>
                {planDone}/{planTotal}
              </Text>
            </Pressable>
          )}
          </View>
        </View>

        <View
          style={[
            styles.stageArea,
            { height: stageHeight(screenH, layout, dialogueExpanded) },
            landscape
              ? { marginLeft: navW + 8, marginRight: interactionW + 8 }
              : { width: '100%', maxWidth: stageW, alignSelf: 'center' },
          ]}
        >
          {!asleep && <GroundShadow location={location} width={196 * spriteScale} style={{ bottom: 20 }} />}
          {asleep && location === 'home' && <DogBedBack upgraded={barkly.hasHome('home_bed')} />}
          {npcsHere.map((id) => (
            <NpcDog
              key={id}
              id={id}
              location={location}
              scale={spriteScale}
              talking={npcBubble?.id === id}
              bond={bondFor(barkly.character, NPCS[id].name)}
              onPress={() => barkly.npcTalk(id)}
            />
          ))}
          <Animated.View
            style={{
              transform: [
                { translateX: Animated.add(Animated.add(chaseX, walkX), tugX) },
                { translateY: hopY },
                { rotate: digRotate.interpolate({ inputRange: [-1, 1], outputRange: ['-7deg', '7deg'] }) },
              ],
            }}
          >
            <Pressable
              onPress={pet}
              disabled={locked}
              accessibilityRole="button"
              accessibilityLabel={`Barkly. ${stateLabel || snapshot.state}.`}
              testID="barkly-sprite"
              accessibilityHint="Tap to pet him."
            >
              <Renderer state={snapshot.state} actions={actions} variant={variant} collarId={barkly.collarId} scale={spriteScale} look={look} beat={beat} />
            </Pressable>
          </Animated.View>
          {asleep && location === 'home' && <DogBedFront upgraded={barkly.hasHome('home_bed')} />}
          {fetching && routine === 'ball' && variant !== 'carryLeft' && (
            <Animated.View style={[styles.fetchBall, { transform: [{ translateX: ballX }, { translateY: ballY }] }]} pointerEvents="none">
              <RubberBall size={30} />
            </Animated.View>
          )}
          {(location === 'park' || location === 'beach') && !asleep && (
            <Pressable
              style={styles.digSpot}
              onPress={runDig}
              disabled={digging || fetching || locked}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={location === 'beach' ? 'Search the wet sand' : 'Dig here'}
            >
              {location === 'beach'
                ? <WetSandMound active={digging} />
                : <DigMound active={digging} />}
              <Text style={styles.digHint}>
                {digging ? '…' : location === 'beach' ? 'SIFT' : 'DIG'}
              </Text>
            </Pressable>
          )}
          {barkly.serving !== null && <FoodBowl key={barkly.serving} food={barkly.serving} />}
          {snapshot.state === 'playing' && !fetching && routine === 'ball' && <Ball />}
          <HeartBurst burst={heartBurst} />
          <BarklyKit
            toyId={barkly.toy?.id ?? null}
            playLabel={playLabel}
            asleep={asleep}
            wants={wants}
            disabled={locked || fetching || tugging || digging}
            onPress={onKit}
          />

          {(stateLabel || showcase) && (
            <View style={styles.chip}>
              {(listening || snapshot.state === 'thinking') && <View style={styles.chipDot} />}
              <Text style={styles.chipText}>{stateLabel || 'listening'}</Text>
            </View>
          )}
        </View>

        <View
          style={[
            styles.interactionStack,
            landscape && styles.interactionStackLandscape,
            landscape ? { width: interactionW } : { maxWidth: stageW },
          ]}
        >
        <DialoguePanel
          speaker={
            npcBubble
              ? { name: NPCS[npcBubble.id].name, kind: 'npc' }
              : bubbleText
                ? { name: 'Barkly', kind: 'barkly' }
                : null
          }
          line={npcBubble ? npcBubble.line : bubbleText ?? null}
          youSaid={!npcBubble && lastExchange && !listening && lastExchange.userText !== '' ? lastExchange.userText : null}
          thought={barkly.thought}
          hint={sttAvailable ? 'hold talk and say hi' : 'type something and say hi'}
          asleep={asleep}
        />

        <View style={styles.controls}>
          {sttAvailable && !typing ? (
            <View style={styles.typeRow}>
              <Pressable
                style={({ pressed }) => [styles.talk, listening && styles.talkActive, (locked || pressed) && styles.pressed, locked && styles.disabled]}
                disabled={locked}
                onPressIn={barkly.startTalk}
                onPressOut={barkly.stopTalk}
                accessibilityRole="button"
                accessibilityLabel={listening ? 'Listening. Release to send.' : 'Hold to talk to Barkly'}
                accessibilityState={{ disabled: locked, busy: listening }}
              >
                <View style={styles.gloss} pointerEvents="none" />
                <View style={[styles.micDot, listening && styles.micDotLive]} />
                <Text style={styles.talkText}>{listening ? 'listening — release to send' : 'hold to talk'}</Text>
              </Pressable>
              <Pressable
                style={styles.swap}
                onPress={() => setTyping(true)}
                accessibilityRole="button"
                accessibilityLabel="Type to Barkly instead"
              >
                <KeyboardGlyph />
              </Pressable>
            </View>
          ) : (
            <View style={styles.typeRow}>
              <TextInput
                style={styles.input}
                value={typed}
                onChangeText={setTyped}
                placeholder="say something to Barkly…"
                placeholderTextColor={color.inkSoft}
                editable={!locked}
                onSubmitEditing={sendTyped}
                returnKeyType="send"
                accessibilityLabel="Say something to Barkly"
                accessibilityHint="Type a message, then press talk."
              />
              {sttAvailable && (
                <Pressable
                  style={styles.swap}
                  onPress={() => setTyping(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Talk to Barkly out loud instead"
                >
                  <View style={styles.micDot} />
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [styles.send, pressed && styles.pressed, (locked || !typed.trim()) && styles.sendIdle]}
                disabled={locked || !typed.trim()}
                onPress={sendTyped}
                accessibilityRole="button"
                accessibilityLabel="Talk to Barkly"
                accessibilityState={{ disabled: locked || !typed.trim() }}
              >
                {!(locked || !typed.trim()) && <View style={styles.gloss} pointerEvents="none" />}
                <Text style={[styles.sendText, (locked || !typed.trim()) && styles.sendTextIdle]}>talk</Text>
              </Pressable>
            </View>
          )}
        </View>
        </View>
      </KeyboardAvoidingView>

      <ContestSheet visible={barkly.pendingContest !== null} rules={barkly.pendingContest} onDone={(result) => void barkly.finishContest(result)} onClose={() => void barkly.finishContest(null)} />
      <FoodSheet visible={foodOpen} onClose={() => setFoodOpen(false)} onOpenShop={() => openOnly(setStoreOpen)} wallet={barkly.wallet} hungry={snapshot.stats.hunger > 45} onFeed={(itemId) => void barkly.feed(itemId)} />
      {playtest && <PlaytestSheet visible={playtestOpen} onClose={() => setPlaytestOpen(false)} />}
      <StoreSheet visible={storeOpen} onClose={() => setStoreOpen(false)} wallet={barkly.wallet} onBuy={(id) => { const r = barkly.buy(id); if (r?.ok) react('delight'); return r; }} onEquip={barkly.equip} devMode={barkly.devMode} />
      <PackBookSheet visible={packOpen} onClose={() => setPackOpen(false)} profile={barkly.relationship} />
      <AdventureSheet visible={planOpen} onClose={() => setPlanOpen(false)} adventure={barkly.adventure} />
      <EncounterSheet
        encounter={barkly.activeEncounter}
        busy={busy}
        onClose={barkly.dismissEncounter}
        onChoose={(choiceId) => void barkly.resolveEncounter(choiceId)}
      />
      <SettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        memory={barkly.memorySnapshot()}
        stats={snapshot.stats}
        stash={barkly.stashItems}
        dialogueProviderName={barkly.dialogueProviderName}
        brain={{
          using: barkly.dialogueStatus().using,
          breakerOpen: barkly.dialogueStatus().breakerOpen,
          lastFailure: barkly.dialogueStatus().lastFailure?.barklyLine,
        }}
        modelConfigured={barkly.modelConfigured}
        voice={{ route: barkly.voiceRoute, muted: barkly.muted }}
        onToggleMuted={barkly.toggleMuted}
        sttAvailable={sttAvailable}
        onForgetFact={barkly.forgetFact}
        devMode={barkly.devMode}
        showcase={barkly.showcase}
        onSetShowcase={barkly.setShowcase}
        voices={barkly.voices}
        voiceShape={barkly.voiceShape}
        onSetVoiceShape={barkly.setVoiceShape}
        onPreviewVoice={barkly.previewVoice}
        onSetDevMode={barkly.setDevMode}
        onGrantCoins={barkly.devGrantCoins}
        onGrantLevel={barkly.devGrantLevel}
        onGrantEverything={barkly.devGrantEverything}
        onForgetEverything={barkly.forgetEverything}
        onOpenPlaytest={playtest ? () => { setSettingsOpen(false); setPlaytestOpen(true); } : undefined}
      />
    </View>
  );
}

const SHOWCASE_PROMOTION = {
  who: 'Duke',
  kind: 'rival' as const,
  headline: 'Duke is now an official rival',
  line: '',
  fromLabel: 'annoying dog',
  toLabel: 'official rival',
};

const styles = StyleSheet.create({
  room: { flex: 1, backgroundColor: color.well },
  sceneLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  chromeScrim: { position: 'absolute', left: 0, right: 0, top: 0 },
  horizon: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: DIALOGUE_HEIGHT + CONTROLS_HEIGHT + 48,
  },
  content: { flex: 1, width: '100%', alignSelf: 'center', paddingHorizontal: 16 },
  header: {
    height: STATUS_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  places: {
    height: PLACES_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  placesLandscape: {
    position: 'absolute',
    left: 0,
    top: STATUS_HEIGHT + 8,
    height: 248,
    marginTop: 0,
    zIndex: 30,
  },
  planChip: {
    minWidth: TAP_MIN,
    height: TAP_MIN,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: color.goldWell,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.flat,
  },
  planChipLandscape: { width: '100%', height: TAP_MIN, marginTop: 2 },
  planChipDone: { backgroundColor: color.goodWell },
  planChipText: { ...type.caption, fontWeight: '900', color: color.inkSoft },
  planChipTextDone: { color: color.good },
  gear: {
    width: TAP_MIN,
    height: TAP_MIN,
    borderRadius: radius.pill,
    backgroundColor: color.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
    ...elevation.card,
  },
  gearDot: { width: 4, height: 4, borderRadius: 8, backgroundColor: color.inkSoft },
  headerButtons: { flexDirection: 'row', gap: 6 },
  walletTap: { flex: 1 },
  packButton: {
    minWidth: 46,
    height: TAP_MIN,
    borderRadius: 12,
    paddingHorizontal: 7,
    backgroundColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.card,
  },
  packLabel: { fontSize: 10, lineHeight: 8, fontWeight: '900', letterSpacing: 1.1, color: color.goldSoft },
  packLevel: { marginTop: 1, fontSize: 15, lineHeight: 16, fontWeight: '900', color: color.paper },
  tabLocked: { opacity: 0.5 },
  noticeLayer: {
    position: 'absolute',
    height: NOTICE_MAX_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 20,
  },
  reward: { alignSelf: 'center', marginTop: 0, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: color.goldWell },
  promo: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    maxWidth: '100%',
  },
  promoRival: { backgroundColor: color.warmWell, borderColor: color.warmLine },
  promoFriend: { backgroundColor: color.goodWell, borderColor: color.goodLine },
  promoEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: color.inkSoft },
  promoHeadline: { fontSize: 13, fontWeight: '900', color: color.ink, flexShrink: 1 },
  rewardText: { fontSize: 13, fontWeight: '800', color: color.goldInk },
  degraded: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', marginTop: 0, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: color.fill },
  degradedDot: { width: 7, height: 7, borderRadius: 8, backgroundColor: BRASS.polished },
  degradedText: { fontSize: 12, color: color.inkSoft, flexShrink: 1 },
  tabs: { flex: 1, height: TAP_MIN, flexDirection: 'row', backgroundColor: 'rgba(255,253,247,0.90)', borderRadius: 999, padding: 3, gap: 2, ...elevation.card },
  tabsLandscape: { flex: 0, width: '100%', height: 248, flexDirection: 'column', padding: 4, gap: 4 },
  tabLandscape: { flexGrow: 0, flexShrink: 0, width: '100%', height: TAP_MIN },
  tab: { flexGrow: 1, flexShrink: 1, flexDirection: 'row', minHeight: TAP_MIN, paddingHorizontal: 6, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: color.pop },
  tabText: { fontSize: 13, fontWeight: '800', color: color.inkSoft, letterSpacing: 0.2 },
  tabTextActive: { color: color.ink },
  bubble: { maxWidth: '92%', backgroundColor: color.card, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 18, ...elevation.card },
  errorNotice: {
    alignSelf: 'center',
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: color.dangerWell,
    borderWidth: 1,
    borderColor: color.dangerLine,
  },
  errorText: { fontSize: 13, lineHeight: 17, color: color.danger, textAlign: 'center' },
  // Keep Barkly's feet out of the foreground care dock without throwing away
  // the reclaimed world space below him.
  stageArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 48 },
  heartLayer: { position: 'absolute', bottom: 190, alignSelf: 'center' },
  heart: { position: 'absolute', fontSize: 24, color: color.danger },
  fetchBall: { position: 'absolute', bottom: 40, alignSelf: 'center', zIndex: 7 },
  npc: { position: 'absolute', alignItems: 'center', zIndex: 3 },
  digSpot: { position: 'absolute', left: -42, bottom: 67, alignItems: 'center', zIndex: 2 },
  digHint: { marginTop: -11, ...type.micro, color: DIORAMA.cream, backgroundColor: DIORAMA.woodDeep, borderWidth: 1, borderColor: DIORAMA.woodSoft, paddingHorizontal: 9, paddingVertical: 2, borderRadius: radius.sm, overflow: 'hidden' },
  npcName: { position: 'absolute', ...type.micro, color: DIORAMA.cream, backgroundColor: DIORAMA.woodDeep, borderWidth: 1, borderColor: DIORAMA.woodWarm, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.sm, overflow: 'hidden' },
  chip: { position: 'absolute', bottom: 72, zIndex: 9, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color.card, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13, ...elevation.card },
  chipDot: { width: 7, height: 7, borderRadius: 8, backgroundColor: ACCENT },
  chipText: { fontSize: 13, fontWeight: '700', color: color.inkSoft },
  interactionStack: { width: '100%', alignSelf: 'center' },
  interactionStackLandscape: { position: 'absolute', right: 0, top: STATUS_HEIGHT + 8, bottom: 0, justifyContent: 'flex-end', paddingBottom: 2 },
  controls: { gap: 3 },
  talk: { flex: 1, minHeight: TAP_MIN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: color.pop, borderRadius: 999, paddingVertical: 12, overflow: 'hidden', ...elevation.card },
  talkActive: { backgroundColor: color.popDeep },
  micDot: { width: 9, height: 9, borderRadius: 8, backgroundColor: ACCENT },
  micDotLive: { backgroundColor: color.dangerWell },
  talkText: { color: color.ink, fontWeight: '800', fontSize: 15, letterSpacing: 0.4 },
  typeRow: { flexDirection: 'row', gap: 10 },
  swap: {
    width: TAP_MIN,
    minHeight: TAP_MIN,
    borderRadius: radius.pill,
    backgroundColor: color.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.low,
  },
  input: { flex: 1, minHeight: TAP_MIN, backgroundColor: color.card, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 13, fontSize: 15, color: color.ink, ...elevation.low },
  send: { minHeight: TAP_MIN, backgroundColor: color.pop, borderRadius: 999, paddingHorizontal: 24, justifyContent: 'center', overflow: 'hidden', ...elevation.card },
  sendText: { color: color.ink, fontWeight: '800', fontSize: 15, letterSpacing: 0.4 },
  sendIdle: { backgroundColor: color.fill, ...elevation.flat },
  sendTextIdle: { color: color.inkSoft },
  gloss: {
    position: 'absolute',
    top: 4,
    left: 14,
    right: 14,
    height: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  pressed: { transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
});
