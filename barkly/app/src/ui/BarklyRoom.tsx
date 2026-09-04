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
import { RadialGlow } from './scenes/WorldScene';
import { useBarkly } from '../hooks/useBarkly';
import { playLabelFor, playRoutineFor } from '../game/play';
import AdventureSheet from './AdventureSheet';
import BarklyPhotoView from './BarklyPhotoView';
import EncounterSheet, { momentFromEncounter, momentFromIncident } from './EncounterSheet';
import Onboarding from './Onboarding';
import PackBookSheet from './PackBookSheet';
import StoreSheet from './StoreSheet';
import { DestinationTray, ToyChromeRow } from './ToyHud';
import FoodSheet from './FoodSheet';
import ContestSheet from './ContestSheet';
import { levelProgress } from '../game/progression';
import BarklyView from './BarklyView';
import DialoguePanel from './DialoguePanel';
import SettingsSheet from './SettingsSheet';
import { Ball, DigMound, FoodBowl, WetSandMound } from './StageProps';
import BarklyKit, { KitAction } from './BarklyKit';
import PlaytestSheet from './PlaytestSheet';
import { playtestAllowed } from '../dev/playtest';
import { useAttention } from './useAttention';
import { rivalInSight } from './attention';
import { feel, setFeelMuted } from './feel';
import {
  BeachScene,
  DogBedBack,
  DogBedFront,
  HomeScene,
  NightOverlay,
  ParkScene,
  skyBand,
  TownScene,
} from './scenes/Scenes';
import { BarklyState } from '../barkly/types';
import { LOCATIONS, LocationId } from '../world/locations';
import {
  CARE_DOCK_CLEARANCE,
  CARE_DOCK_HEIGHT,
  INTERACTION_GUTTER,
  STATE_CHIP_GAP,
  chromeBottom,
  contentFrameWidth,
  CONTROLS_HEIGHT,
  DIALOGUE_GAP,
  DIALOGUE_HEIGHT,
  IDLE_CONVERSATION_HEIGHT,
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
  SPRITE_HEIGHT,
  stageHeight,
  stageWidth,
  TAP_MIN,
  spriteScale as scaleForScreen,
} from './layout';
import { NPCS, NpcId } from '../world/npcs';
import { NPC_ART } from './npcArt';
import { bondFor } from '../barkly/character';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Renderer = process.env.EXPO_PUBLIC_BARKLY_RENDERER === 'vector' ? BarklyView : BarklyPhotoView;

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
/*
 * The other dogs stand on the same ground Barkly does. Pulling the camera back
 * raised his feet, and these bottoms did not follow: the dogs ended up 40px
 * below his ground line, standing in the care dock, with their nameplates
 * printing over the bowl and the bed. Lifted onto his plane -- close to the
 * dock but clear of it, which the overlap harness checks on every viewport.
 */
const NPC_SPOTS: Partial<Record<NpcId, { left?: number; right?: number; bottom: number; size: number }>> = {
  biscuit: { left: 10, bottom: 106, size: 80 },
  duke: { right: 3, bottom: 100, size: 90 },
  pepper: { right: 8, bottom: 102, size: 86 },
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

/**
 * Hearts come off the TOP OF HIS HEAD, wherever that is.
 *
 * This layer was pinned at bottom:190, which is roughly his head only at the
 * one sprite scale it was eyeballed at. He renders anywhere from 0.72 to 1.10,
 * so on a small phone the hearts came out of his back and on a tablet they
 * appeared in the air above him. `headY` is derived from the same numbers that
 * place him.
 */
function HeartBurst({ burst, headY }: { burst: number; headY: number }) {
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
    <View style={[styles.heartLayer, { bottom: headY }]} pointerEvents="none">
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
 * Two flat stadiums, then FIVE stacked ellipses "each smaller and each slightly
 * darker, so the edge dissolves over four steps instead of one" -- all of it
 * written around the belief that "there is no radial gradient in React Native".
 * There is: `react-native-svg` is a dependency of every scene in this app, and
 * `RadialGlow` in WorldScene now wraps it. Five steps is five edges; one
 * gradient is none.
 *
 * The profile below is not a fresh guess, it is the OLD stack solved. Those
 * five layers composite, so the darkest point was not the 0.20 written on the
 * contact core -- it was 1 - (0.95)(0.93)(0.90)(0.86)(0.80) = 0.45, falling
 * through 0.32 / 0.21 / 0.12 / 0.05 at the successive layer rims. Sampled at
 * the three stops `RadialGlow` takes, that is 0.45 / 0.30 / 0.13, to zero at
 * the rim. Same shadow, same weight where the feet touch, without the steps.
 */
const SHADOW_W = 1.12;
const SHADOW_H = 0.2;
const SHADOW_STOPS: [number, number, number] = [0.45, 0.3, 0.13];

function GroundShadow({ location, width, style }: { location: LocationId; width: number; style?: object }) {
  const tint = GROUND_SHADOW[location];
  const rx = (width * SHADOW_W) / 2;
  const ry = (width * SHADOW_H) / 2;
  return (
    <View style={[{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }, style]} pointerEvents="none">
      {/*
        A SIZED, absolutely-positioned box with no left/top, which is exactly
        how the five stacked ellipses were anchored: the wrapper is 0x0, so
        `alignItems`/`justifyContent` centre such a child on its origin.
        Positioning the glow itself at cx/cy 0 -- i.e. giving it a negative
        `left` -- looks equivalent and is not: it opts out of that centring and
        the shadow vanished from every frame. Caught in a captured frame by
        sampling the ground under his paws against bare grass two pixels apart,
        not by reading the diff.
      */}
      <View style={{ position: 'absolute', width: rx * 2, height: ry * 2 }}>
        <RadialGlow cx={rx} cy={ry} r={rx} ry={ry} color={tint} stops={SHADOW_STOPS} />
      </View>
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
  compactLabel = false,
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
  /** Short portrait phones put the name above the dog so the care dock cannot cover it. */
  compactLabel?: boolean;
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
  const build = NPCS[id].build;
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
      <GroundShadow location={location} width={spot.size * 0.92 * scale * build} style={{ bottom: 0 }} />
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
          {/*
            HOW BIG THIS DOG IS. Duke's own character sheet has called him "a
            big russet dog" from the day it was written, and all three NPCs
            were drawn at one size from one recoloured render -- measured,
            Duke's and Biscuit's silhouettes are identical pixel for pixel, so
            the nemesis and the best friend differed by hue alone. The height
            grows from the ground line, which is where the anchor already is,
            so a bigger dog stands taller rather than floating.
          */}
          <Image
            source={NPC_ART[id]}
            style={{ width: spot.size * scale * build, height: spot.size * 1.25 * scale * build }}
            resizeMode="contain"
          />
        </Animated.View>
      </Pressable>
      {/* Below the ground line, out of the flow, so it cannot move the anchor. */}
      <Text
        testID={`npc-name-${id}`}
        style={[styles.npcName, { bottom: compactLabel ? spot.size * 1.25 * scale * build + 4 : -4 * scale }]}
      >
        {NPCS[id].name.toUpperCase()}
      </Text>
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
  /** One surface, three player modes. Idle is only two compact buttons. */
  const [conversationMode, setConversationMode] = useState<'idle' | 'voice' | 'type'>('idle');
  const tugX = useRef(new Animated.Value(0)).current;
  const [digging, setDigging] = useState(false);
  const [variant, setVariant] = useState<'runRight' | 'carryLeft' | null>(null);
  const [arriving, setArriving] = useState(false);

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
  // One adaptive conversation surface. With nobody talking and no composer
  // open, only the two 44px Talk/Type buttons reserve space. A response or an
  // explicitly opened composer expands into that same slot.
  const responseVisible = Boolean(lastExchange?.barklyText || barkly.thought || barkly.npcBubble || barkly.showcase);
  const composerExpanded = conversationMode !== 'idle' || listening || snapshot.state === 'thinking';
  const dialogueExpanded = responseVisible && !composerExpanded;
  const conversationHeightPx = dialogueExpanded
    ? DIALOGUE_HEIGHT
    : composerExpanded
      ? CONTROLS_HEIGHT
      : IDLE_CONVERSATION_HEIGHT;
  /**
   * How big he is drawn. The stage is a fixed band between the chrome and the
   * dialogue panel, and he has to live inside it — cropping his paws to make
   * room for a text panel is the kind of thing that makes an app feel like a
   * web page. Capped at 1 so a tall phone gives him air, not a poster.
   */
  const spriteScale = scaleForScreen(screenH, stageW, layout, dialogueExpanded, composerExpanded);
  /** How tall the world is: everything above the one adaptive conversation slot. */
  const sceneBand = landscape ? screenH : screenH - conversationHeightPx - DIALOGUE_GAP * 2 + 8;
  /**
   * Where his feet meet the ground, measured from the top of the scene layer.
   * Interior scenes are built around this line rather than around percentages
   * of a rectangle — see Scenes.HomeScene.
   */
  const stageH = stageHeight(screenH, layout, dialogueExpanded, composerExpanded);
  const groundY = topPad + chromeBottomPx + stageH - SPRITE_FOOT;
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
  // The same band the scenes grade themselves from, so the dog and the room
  // can never disagree about what time it is.
  const night = skyBand(hour) === 'night' || asleep;
  const worldMotion = asleep
    ? 'sleep' as const
    : arriving
      ? 'arrive' as const
    : (fetching || tugging || digging || snapshot.state === 'eating' || snapshot.state === 'playing')
      ? 'active' as const
      : 'idle' as const;
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
    setArriving(true);
    sceneFade.setValue(0);
    walkX.setValue(-170);
    setVariant('runRight');
    const settleTimer = setTimeout(() => {
      setVariant(null);
      setArriving(false);
    }, 760);
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
    return () => clearTimeout(settleTimer);
  }, [location, sceneFade, walkX, hopY]);

  const chaseX = useRef(new Animated.Value(0)).current;
  const ballFlight = useRef(new Animated.Value(0)).current;
  /** Body lean and squash, used by the zoomies. -1 leans left, 1 leans right. */
  const zoomLean = useRef(new Animated.Value(0)).current;
  const zoomSquash = useRef(new Animated.Value(1)).current;
  /** Stepping over to the bowl, and the head-dips into it. */
  const eatX = useRef(new Animated.Value(0)).current;
  const eatDip = useRef(new Animated.Value(0)).current;

  /*
   * HE ACTUALLY EATS IT.
   *
   * The bowl arrives and empties itself on a timer -- 3 -> 2 -> 1 -> crumbs
   * over 4.2s (see StageProps.FoodBowl) -- while Barkly stood in the middle of
   * the room facing forward and did not move. The food disappeared NEAR him.
   * Nothing connected the dog to the meal, which is the whole of "he doesn't
   * really eat".
   *
   * So he goes over and takes three bites, and the bites are timed to the
   * exact moments the bowl loses a piece. The bowl is at 16.66% from the left
   * and he stands centred, hence the step left before the first dip and back
   * afterwards.
   */
  useEffect(() => {
    // Driven by the EATING STATE, not by the bowl being served. He is served
    // immediately and starts eating ~3.6s later, after his line; keying this
    // off `serving` animated him eating an untouched bowl and then standing
    // still through the actual meal.
    if (snapshot.state !== 'eating') return;
    const dip = (down: number, up: number) =>
      Animated.sequence([
        Animated.timing(eatDip, { toValue: 1, duration: down, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(eatDip, { toValue: 0.55, duration: up, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]);
    const anim = Animated.sequence([
      // Over to the bowl, head already lowering.
      Animated.parallel([
        Animated.timing(eatX, { toValue: -42, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(eatDip, { toValue: 0.55, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      // Three bites, on the beats the bowl actually loses food.
      Animated.delay(120),
      dip(170, 240),
      Animated.delay(350),
      dip(170, 240),
      Animated.delay(350),
      dip(190, 280),
      // Up, satisfied, back to the middle of his room.
      Animated.delay(180),
      Animated.parallel([
        Animated.timing(eatDip, { toValue: 0, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(eatX, { toValue: 0, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ]);
    anim.start();
    return () => {
      anim.stop();
      eatX.setValue(0);
      eatDip.setValue(0);
    };
  }, [snapshot.state, eatX, eatDip]);
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
   * ZOOMIES. What "he improvises" actually looks like.
   *
   * With no toy, at home -- which is EVERY new player's first press of the
   * play button -- `routine` is 'none', and this fell through to `runChase`.
   * So he threw nothing, sprinted after it, dipped to pick it up and carried
   * it home: a full fetch performed on an invisible ball, because the ball is
   * only rendered when the routine really is 'ball'. That is the single
   * weakest thing in the app and it is the first thing a stranger presses.
   *
   * Zoomies are not a fetch without a prop. They are a shape: a crouch, a
   * burst, a skid, a lap back the other way, a smaller second lap, and a
   * landing. Built from the values that already move him -- no new art -- so
   * the whole thing is choreography rather than assets.
   */
  const runZoomies = (onDone: () => void) => {
    setFetching(true);
    const lean = (to: number, duration: number) =>
      Animated.timing(zoomLean, { toValue: to, duration, easing: Easing.out(Easing.quad), useNativeDriver: true });
    const squash = (to: number, duration: number) =>
      Animated.timing(zoomSquash, { toValue: to, duration, easing: Easing.out(Easing.quad), useNativeDriver: true });
    const run = (to: number, duration: number) =>
      Animated.timing(chaseX, { toValue: to, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
    const hop = (height: number, up: number, down: number) =>
      Animated.sequence([
        Animated.timing(hopY, { toValue: -height, duration: up, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(hopY, { toValue: 0, duration: down, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]);

    // Anticipation: he compresses before he goes. Without this the burst
    // starts on frame one and reads as a teleport rather than a decision.
    setVariant('runRight');
    Animated.sequence([
      Animated.parallel([squash(0.9, 130), lean(0.5, 130)]),
      Animated.parallel([run(96, 400), squash(1, 180), lean(1, 160), hop(9, 150, 170)]),
      // The skid. He overshoots, plants, and turns.
      Animated.parallel([squash(0.92, 110), lean(0.2, 110)]),
    ]).start(() => {
      setVariant(null); // the default three-quarter pose faces left
      Animated.sequence([
        Animated.parallel([run(-78, 440), squash(1, 160), lean(-1, 180), hop(8, 150, 160)]),
        Animated.parallel([squash(0.93, 110), lean(-0.2, 110)]),
      ]).start(() => {
        setVariant('runRight');
        Animated.sequence([
          // A shorter second lap: the joke is that he cannot stop, and a
          // second lap the same size as the first reads as a loop, not a dog.
          Animated.parallel([run(34, 300), squash(1, 140), lean(0.8, 140)]),
          Animated.parallel([run(0, 300), lean(0, 220)]),
          Animated.parallel([hop(14, 150, 190), squash(0.88, 150)]),
          squash(1, 220),
        ]).start(() => {
          setVariant(null);
          zoomLean.setValue(0);
          zoomSquash.setValue(1);
          setFetching(false);
          onDone();
        });
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
  /*
   * The dog in this room he has actually fallen out with, if any.
   *
   * Gated on a real bond rather than on `relationship === 'rival'` alone, so
   * the very first time a player meets Duke he is still just a dog standing
   * there — the wariness is something the two of them EARNED, and it appears
   * the moment there is history to justify it.
   */
  const rivalPresent = rivalInSight(
    npcsHere.map((id) => ({ id, bond: bondFor(barkly.character, NPCS[id].name) })),
  );

  const look = useAttention({
    wants,
    eating: snapshot.state === 'eating',
    npcSpeaking: npcBubble ? npcBubble.id : null,
    speaking: snapshot.state === 'speaking',
    asleep,
    rivalPresent,
  });

  /**
   * PLAYTEST. The badge IS the button — a dev build needs to say so, and a
   * tester needs a way in, and those are the same one-line pill rather than a
   * banner plus a hidden gesture.
   */
  const playtest = playtestAllowed();
  const [playtestOpen, setPlaytestOpen] = useState(false);

  // While any sheet is open the world holds its tongue -- see
  // useBarkly.setWorldPaused. Sheets are the one time the player is reading,
  // not watching him.
  const sheetOpen =
    settingsOpen || storeOpen || foodOpen || packOpen || planOpen || playtestOpen;
  const { setWorldPaused } = barkly;
  useEffect(() => { setWorldPaused(sheetOpen); }, [sheetOpen, setWorldPaused]);

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
    // 'none' is the improvised routine -- zoomies, not a mimed fetch.
    if (routine === 'none') {
      runZoomies(() => void barkly.play());
      return;
    }
    runChase(() => void barkly.play());
  };

  const ballX = ballFlight.interpolate({ inputRange: [0, 1], outputRange: [0, 118] });
  const ballY = ballFlight.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -120, -8] });

  const openTyping = () => {
    if (!barkly.claimConversationTurn()) return;
    setConversationMode('type');
  };

  const startVoice = async () => {
    const started = await barkly.startTalk();
    setConversationMode(started ? 'voice' : 'idle');
  };

  const finishVoice = async () => {
    setConversationMode('idle');
    await barkly.stopTalk();
  };

  const switchVoiceToType = async () => {
    await barkly.cancelTalk();
    if (barkly.claimConversationTurn()) setConversationMode('type');
  };

  const sendTyped = async () => {
    const text = typed.trim();
    if (!text) return;
    setTyped('');
    setConversationMode('idle');
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
    : lastExchange?.barklyText;

  const routine = playRoutineFor(barkly.toy?.id, location);
  const playLabel = playLabelFor(routine, location, fetching || tugging);

  if (barkly.onboarding === undefined) return <View style={styles.room} />;
  if (barkly.onboarding.step !== 'done') {
    return (
      <Onboarding
        state={barkly.onboarding}
        micAvailable={sttAvailable}
        onAdvance={barkly.advanceOnboarding}
        Renderer={Renderer}
        say={barkly.sayLine}
      />
    );
  }

  return (
    <View style={styles.room}>
      <Animated.View
        style={[styles.sceneLayer, { opacity: sceneFade }]}
      >
        {location === 'home' && <HomeScene hour={hour} upgrades={barkly.placedHome} asleep={asleep} groundY={groundY} chromeBottom={topPad + chromeBottomPx} motion={worldMotion} biography={barkly.biography} />}
        {location === 'park' && <ParkScene hour={hour} bandHeight={sceneBand} groundY={groundY} chromeBottom={topPad + chromeBottomPx} motion={worldMotion} />}
        {location === 'town' && <TownScene hour={hour} bandHeight={sceneBand} groundY={groundY} chromeBottom={topPad + chromeBottomPx} motion={worldMotion} />}
        {location === 'beach' && <BeachScene hour={hour} bandHeight={sceneBand} groundY={groundY} chromeBottom={topPad + chromeBottomPx} motion={worldMotion} />}
      </Animated.View>
      {asleep && <NightOverlay />}

      <LinearGradient
        colors={['rgba(255,249,236,0.55)', 'rgba(255,249,236,0.22)', 'rgba(255,249,236,0)']}
        style={[styles.chromeScrim, { height: chromeBottomPx + 34 }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(255,249,236,0)', 'rgba(255,249,236,0.72)', 'rgba(255,249,236,1)']}
        locations={[0, 0.55, 1]}
        style={[styles.horizon, { height: landscape ? 76 : conversationHeightPx + 24 }]}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={[styles.content, { maxWidth: frameW, paddingHorizontal: landscape ? 12 : widePortrait ? 20 : 16 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ToyChromeRow
          coins={barkly.wallet.coins}
          level={barkly.level}
          levelFrac={levelProgress(barkly.wallet.xp).frac}
          onOpenShop={() => openOnly(setStoreOpen)}
          onOpenPack={() => openOnly(setPackOpen)}
          onOpenPlan={() => openOnly(setPlanOpen)}
          onOpenSettings={() => openOnly(setSettingsOpen)}
          packLevel={barkly.relationship.stage.level}
          packLabel={`${barkly.relationship.archetype}. ${barkly.relationship.stage.label}`}
          planDone={planDone}
          planTotal={planTotal}
          planComplete={planComplete}
          hasPlan={Boolean(barkly.adventure)}
        />

        {notice && (
          <View
            style={[
              styles.noticeLayer,
              { top: noticeTop(topPad, layout) },
              landscape ? { left: screenW - interactionW + INTERACTION_GUTTER, right: INTERACTION_GUTTER } : { left: 22, right: 22 },
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

        {/*
          The destinations are OBJECTS now, not a segmented control: a coloured
          tile per place with its own glyph, a lock badge instead of grey text,
          and a moulded tray behind them. This is what
          docs/VISUAL_DIRECTION_KIDS_GAME.md has had at the top of its build
          order since 2026-08-29; the tiles came from ToyHud.tsx, which had been
          sitting unwired the whole time.
        */}
        <View style={[styles.places, landscape && styles.placesLandscape, landscape && { width: navW }]}>
          <DestinationTray
            location={location}
            locked={locked || fetching}
            isUnlocked={barkly.isUnlocked}
            onLocation={(loc) => { react('arrive'); barkly.goTo(loc); }}
            vertical={landscape}
          />
        </View>

        <View
          style={[
            styles.stageArea,
            { height: stageH },
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
              compactLabel={landscape || screenH < 650}
              onPress={() => barkly.npcTalk(id)}
            />
          ))}
          <Animated.View
            style={{
              transform: [
                { translateX: Animated.add(Animated.add(Animated.add(chaseX, walkX), tugX), eatX) },
                { translateY: Animated.add(hopY, eatDip.interpolate({ inputRange: [0, 1], outputRange: [0, 26] })) },
                { rotate: digRotate.interpolate({ inputRange: [-1, 1], outputRange: ['-7deg', '7deg'] }) },
                // A running dog leans into the direction he is going, and
                // squashes when he lands. Both idle at 0/1, so nothing moves
                // unless the zoomies are actually running.
                { rotate: zoomLean.interpolate({ inputRange: [-1, 1], outputRange: ['6deg', '-6deg'] }) },
                // Tipping into the bowl, and the squash of a head going down.
                { rotate: eatDip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-7deg'] }) },
                { scaleY: Animated.multiply(zoomSquash, eatDip.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] })) },
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
              <Renderer state={snapshot.state} actions={actions} location={location} variant={variant} collarId={barkly.collarId} scale={spriteScale} look={look} beat={beat} />
            </Pressable>
          </Animated.View>
          {asleep && location === 'home' && <DogBedFront upgraded={barkly.hasHome('home_bed')} />}
          {fetching && routine === 'ball' && variant !== 'carryLeft' && (
            <Animated.View style={[styles.fetchBall, { transform: [{ translateX: ballX }, { translateY: ballY }] }]} pointerEvents="none">
              <RubberBall size={30} />
            </Animated.View>
          )}
          {(location === 'park' || location === 'beach') && !asleep && (
            /*
              The mound is placed as a FRACTION of the stage, not at bottom:252.
              A fixed offset only sits in the mid-ground on the phone it was
              eyeballed on: the stage can be as short as 212pt, where 252 puts
              the whole control above the top of its own container, and as tall
              as ~700 on a tablet, where it lands in the middle of the sky. 42%
              of the way up keeps it in the same band of the field on every
              device, and the clamp keeps its 68pt of art and label inside the
              stage at both extremes.
            */
            <Pressable
              style={[styles.digSpot, { bottom: Math.min(stageH - 108, Math.max(96, stageH * 0.42)) }]}
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
          {barkly.serving !== null && (
            <FoodBowl key={barkly.serving} food={barkly.serving} eating={snapshot.state === 'eating'} />
          )}
          {snapshot.state === 'playing' && !fetching && routine === 'ball' && <Ball />}

          {/*
            ONE LIGHT FOR THE ROOM AND EVERYONE STANDING IN IT.
            
            The scene is graded by `WorldLighting` -- at night it takes a deep
            blue wash, strong enough to own the frame. Barkly is rendered ABOVE
            the scene and got none of it, so after dark he stood in a midnight
            room lit like noon: a daylight-bright dog pasted onto a dark
            picture. The other dogs had the same problem. `NightOverlay` was
            already the right idea and was applied only while he was ASLEEP,
            and below him anyway.

            Deliberately much lighter than the scene's own wash (the scene goes
            to 0.50 alpha at the bottom; this is a fraction of that). He is the
            hero and must stay readable -- the job here is to seat him in the
            room, not to hide him. It sits above the dogs and the props and
            below the kit, the chip and every piece of chrome, so nothing a
            child has to read is dimmed by it.
          */}
          {night && <View pointerEvents="none" style={styles.stageNight} />}

          <HeartBurst burst={heartBurst} headY={CARE_DOCK_CLEARANCE + SPRITE_HEIGHT * spriteScale * 0.66} />
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
          testID="conversation-dock"
        >
          {dialogueExpanded ? (
            <DialoguePanel
              speaker={
                npcBubble
                  ? { name: NPCS[npcBubble.id].name, kind: 'npc' }
                  : bubbleText
                    ? { name: 'Barkly', kind: 'barkly' }
                    : null
              }
              line={npcBubble ? npcBubble.line : bubbleText ?? null}
              youSaid={!npcBubble && lastExchange && lastExchange.userText !== '' ? lastExchange.userText : null}
              thought={barkly.thought}
              hint=""
              asleep={asleep}
              // Exactly the buttons that are drawn. The microphone needs a dev
              // build, so on the web there is one, and the text used to be
              // narrowed for two regardless.
              actionSlots={sttAvailable ? 2 : 1}
              actions={
                <>
                  {sttAvailable && (
                    <Pressable
                      style={({ pressed }) => [styles.responseAction, pressed && styles.pressed, locked && styles.disabled]}
                      disabled={locked}
                      onPress={() => void startVoice()}
                      accessibilityRole="button"
                      accessibilityLabel="Talk to Barkly"
                    >
                      <View style={styles.micDot} />
                    </Pressable>
                  )}
                  <Pressable
                    style={({ pressed }) => [styles.responseAction, pressed && styles.pressed, locked && styles.disabled]}
                    disabled={locked}
                    onPress={openTyping}
                    accessibilityRole="button"
                    accessibilityLabel="Type to Barkly"
                  >
                    <KeyboardGlyph />
                  </Pressable>
                </>
              }
            />
          ) : snapshot.state === 'thinking' ? (
            <View style={styles.waitingDock}>
              <View style={styles.chipDot} />
              <Text style={styles.waitingText}>Barkly's thinking…</Text>
            </View>
          ) : conversationMode === 'type' ? (
            <View style={styles.controls}>
              <View style={styles.typeRow}>
                <TextInput
                  style={styles.input}
                  value={typed}
                  onChangeText={setTyped}
                  placeholder="say something to Barkly…"
                  placeholderTextColor={color.inkSoft}
                  editable={!locked}
                  autoFocus
                  onSubmitEditing={sendTyped}
                  returnKeyType="send"
                  accessibilityLabel="Say something to Barkly"
                  accessibilityHint="Type a message, then press send."
                />
                <Pressable
                  style={styles.swap}
                  onPress={() => { setTyped(''); setConversationMode('idle'); }}
                  accessibilityRole="button"
                  accessibilityLabel="Close typing"
                >
                  <Text style={styles.closeComposer}>×</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.send, pressed && styles.pressed, (locked || !typed.trim()) && styles.sendIdle]}
                  disabled={locked || !typed.trim()}
                  onPress={() => void sendTyped()}
                  accessibilityRole="button"
                  accessibilityLabel="Send to Barkly"
                  accessibilityState={{ disabled: locked || !typed.trim() }}
                >
                  {!(locked || !typed.trim()) && <View style={styles.gloss} pointerEvents="none" />}
                  <Text style={[styles.sendText, (locked || !typed.trim()) && styles.sendTextIdle]}>send</Text>
                </Pressable>
              </View>
            </View>
          ) : conversationMode === 'voice' || listening ? (
            <View style={styles.controls}>
              <View style={styles.typeRow}>
                <Pressable
                  style={({ pressed }) => [styles.talk, styles.talkActive, pressed && styles.pressed]}
                  onPress={() => void finishVoice()}
                  accessibilityRole="button"
                  accessibilityLabel="Listening. Tap to send."
                  accessibilityState={{ busy: true }}
                >
                  <View style={styles.gloss} pointerEvents="none" />
                  <View style={[styles.micDot, styles.micDotLive]} />
                  <Text style={styles.talkText}>{partialTranscript || 'listening — tap to send'}</Text>
                </Pressable>
                <Pressable
                  style={styles.swap}
                  onPress={() => void switchVoiceToType()}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel voice and type instead"
                >
                  <KeyboardGlyph />
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.compactControls}>
              {sttAvailable && (
                <Pressable
                  style={({ pressed }) => [styles.compactAction, pressed && styles.pressed, locked && styles.disabled]}
                  disabled={locked}
                  onPress={() => void startVoice()}
                  accessibilityRole="button"
                  accessibilityLabel="Talk to Barkly"
                >
                  <View style={styles.micDot} />
                  <Text style={styles.compactActionText}>talk</Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [styles.compactAction, pressed && styles.pressed, locked && styles.disabled]}
                disabled={locked}
                onPress={openTyping}
                accessibilityRole="button"
                accessibilityLabel="Type to Barkly"
              >
                <KeyboardGlyph />
                <Text style={styles.compactActionText}>type</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      <ContestSheet visible={barkly.pendingContest !== null} rules={barkly.pendingContest} onDone={(result) => void barkly.finishContest(result)} onClose={() => void barkly.finishContest(null)} />
      <FoodSheet visible={foodOpen} onClose={() => setFoodOpen(false)} onOpenShop={() => openOnly(setStoreOpen)} wallet={barkly.wallet} hungry={snapshot.stats.hunger > 45} onFeed={(itemId) => void barkly.feed(itemId)} />
      {playtest && <PlaytestSheet visible={playtestOpen} onClose={() => setPlaytestOpen(false)} />}
      <StoreSheet visible={storeOpen} onClose={() => setStoreOpen(false)} wallet={barkly.wallet} onBuy={(id) => { const r = barkly.buy(id); if (r?.ok) react('delight'); return r; }} onEquip={barkly.equip} devMode={barkly.devMode} />
      <PackBookSheet visible={packOpen} onClose={() => setPackOpen(false)} profile={barkly.relationship} stash={barkly.stashItems} />
      <AdventureSheet visible={planOpen} onClose={() => setPlanOpen(false)} adventure={barkly.adventure} />
      <EncounterSheet
        moment={barkly.activeEncounter ? momentFromEncounter(barkly.activeEncounter) : null}
        busy={busy}
        onClose={barkly.dismissEncounter}
        onChoose={(choiceId) => void barkly.resolveEncounter(choiceId)}
      />
      {/*
        The world starting something of its own gets the same presentation as
        an NPC encounter, because to a player it is the same beat: something
        happened and Barkly wants your call. Only the badge changes -- the
        place, not a dog, is what spoke up.
      */}
      <EncounterSheet
        moment={barkly.activeIncident ? momentFromIncident(barkly.activeIncident) : null}
        busy={busy}
        onClose={barkly.dismissIncident}
        onChoose={(choiceId) => void barkly.resolveIncident(choiceId)}
      />
      <SettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        memory={barkly.memorySnapshot()}
        stats={snapshot.stats}
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
  places: {
    height: PLACES_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  placesLandscape: {
    position: 'absolute',
    left: 0,
    top: STATUS_HEIGHT + 8,
    height: 248,
    marginTop: 0,
    zIndex: 30,
  },
  /** The moulded lower lip every candy control in the game already has. */
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
    paddingVertical: 5,
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
  stageArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: CARE_DOCK_CLEARANCE },
  heartLayer: { position: 'absolute', alignSelf: 'center' },
  heart: { position: 'absolute', fontSize: 24, color: color.danger },
  fetchBall: { position: 'absolute', bottom: 40, alignSelf: 'center', zIndex: 7 },
  npc: { position: 'absolute', alignItems: 'center', zIndex: 3 },
  // The dig mound is a CONTROL, not scenery: at left:-42 most of its tap
  // target sat off the screen. It still tucks behind the near dog, but it now
  // begins on screen.
  /*
   * On the mid-ground, clear of the near dog. At bottom:67 the mound and the
   * nearest NPC shared the bottom-left corner and DIG printed underneath
   * BISCUIT; the friend slot spans bottom 116-228, so the mound sits above
   * that band entirely. It also puts something in the empty middle of the
   * field, which was the largest dead area in any scene.
   */
  digSpot: { position: 'absolute', left: 10, alignItems: 'center', zIndex: 2 },
  digHint: { marginTop: -11, ...type.micro, color: DIORAMA.cream, backgroundColor: DIORAMA.woodDeep, borderWidth: 1, borderColor: DIORAMA.woodSoft, paddingHorizontal: 9, paddingVertical: 2, borderRadius: radius.sm, overflow: 'hidden' },
  npcName: { position: 'absolute', ...type.micro, color: DIORAMA.cream, backgroundColor: DIORAMA.woodDeep, borderWidth: 1, borderColor: DIORAMA.woodWarm, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.sm, overflow: 'hidden' },
  /*
   * The night wash that falls on the dogs. Same hue family as the scene's own
   * grade (WorldScene.GRADE.night) at a fraction of its strength.
   */
  stageNight: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(20,38,104,0.17)',
  },
  chip: { position: 'absolute', bottom: CARE_DOCK_HEIGHT + STATE_CHIP_GAP, zIndex: 9, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color.card, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13, ...elevation.card },
  chipDot: { width: 7, height: 7, borderRadius: 8, backgroundColor: ACCENT },
  chipText: { fontSize: 13, fontWeight: '700', color: color.inkSoft },
  interactionStack: { width: '100%', alignSelf: 'center', minHeight: TAP_MIN, paddingHorizontal: INTERACTION_GUTTER },
  interactionStackLandscape: { position: 'absolute', right: 0, top: STATUS_HEIGHT + 8, bottom: 0, justifyContent: 'flex-end', paddingBottom: 2 },
  controls: { gap: 3, minHeight: TAP_MIN, justifyContent: 'center' },
  compactControls: {
    minHeight: TAP_MIN,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  compactAction: {
    height: TAP_MIN,
    minWidth: 86,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: color.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...elevation.low,
  },
  compactActionText: { ...type.caption, fontWeight: '900', color: color.ink },
  responseAction: {
    width: TAP_MIN,
    height: TAP_MIN,
    borderRadius: radius.pill,
    backgroundColor: color.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.low,
  },
  waitingDock: {
    height: TAP_MIN,
    alignSelf: 'center',
    minWidth: 180,
    borderRadius: radius.pill,
    backgroundColor: color.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...elevation.low,
  },
  waitingText: { ...type.caption, fontWeight: '800', color: color.inkSoft },
  closeComposer: { fontSize: 24, lineHeight: 26, fontWeight: '700', color: color.inkSoft },
  talk: { flex: 1, minHeight: TAP_MIN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: color.pop, borderRadius: 999, paddingVertical: 12, overflow: 'hidden', ...elevation.card },
  talkActive: { backgroundColor: color.popDeep },
  micDot: { width: 9, height: 9, borderRadius: 8, backgroundColor: ACCENT },
  micDotLive: { backgroundColor: color.dangerWell },
  talkText: { color: color.ink, fontWeight: '800', fontSize: 15, letterSpacing: 0.4 },
  typeRow: { flexDirection: 'row', gap: 10 },
  swap: {
    width: TAP_MIN,
    minHeight: TAP_MIN,
    flexShrink: 0,
    borderRadius: radius.pill,
    backgroundColor: color.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.low,
  },
  /*
   * `minWidth: 0` is the whole bug fix. A `flex: 1` child of a row will not
   * shrink below its own content width without it, so the input held itself
   * open at the width of its placeholder and shoved the send button 54px past
   * the right edge of a 360px screen -- measured, not eyeballed. The same
   * missing rule that made the destination tray refuse to fill its row.
   *
   * The border is the other half: every other control in this app is a moulded
   * object with an edge, and this was the one floating white web pill left. A
   * recessed slot on `paper` with a real lip reads as something you speak into.
   */
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: TAP_MIN,
    backgroundColor: color.paper,
    borderWidth: 2,
    borderColor: color.line,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 15,
    color: color.ink,
    ...elevation.low,
  },
  send: { minHeight: TAP_MIN, flexShrink: 0, backgroundColor: color.pop, borderRadius: 999, paddingHorizontal: 24, justifyContent: 'center', overflow: 'hidden', ...elevation.card },
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
