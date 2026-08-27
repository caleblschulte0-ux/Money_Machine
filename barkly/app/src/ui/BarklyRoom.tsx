/**
 * Barkly's world: home, park, town — plus the Pack Book that makes the
 * relationship itself a first-class part of the product.
 */

import React, { useEffect, useRef, useState } from 'react';
import { color, elevation, radius, space, type } from './theme';
import { LinearGradient } from 'expo-linear-gradient';
import { BALL, BRASS, DIRT, GROUND, LEAF, SAND } from './scenes/artPalette';
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
import Svg, { Circle, Path } from 'react-native-svg';
import { useBarkly } from '../hooks/useBarkly';
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
import { Ball, FoodBowl } from './StageProps';
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
  CHROME_BOTTOM,
  CONTROLS_HEIGHT,
  DIALOGUE_HEIGHT,
  PLACES_HEIGHT,
  STATUS_HEIGHT,
  NOTICE_MAX_HEIGHT,
  NOTICE_PRIORITY,
  CONTENT_TOP,
  NOTICE_TOP,
  NoticeKind,
  SPEECH_MAX_LINES,
  SPRITE_FOOT,
  stageHeight,
  spriteScale as scaleForScreen,
} from './layout';
import { NPCS, NpcId } from '../world/npcs';

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
const NPC_SPOTS: Partial<Record<NpcId, { left?: number; right?: number; bottom: number; size: number }>> = {
  biscuit: { left: 4, bottom: 136, size: 82 },
  duke: { right: 0, bottom: 152, size: 88 },
  pepper: { right: 6, bottom: 140, size: 84 },
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
  { w: 1.24, h: 0.215, o: 0.05 },
  { w: 1.02, h: 0.175, o: 0.06 },
  { w: 0.8, h: 0.14, o: 0.08 },
  { w: 0.56, h: 0.1, o: 0.1 },
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
}: {
  id: NpcId;
  onPress: () => void;
  location: LocationId;
  /** Same scale Barkly gets, so the three of them stay in proportion. */
  scale: number;
}) {
  const spot = NPC_SPOTS[id]!;
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
  const breathScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.014] });
  return (
    <View style={[styles.npc, { left: spot.left, right: spot.right, bottom: spot.bottom * scale }]}>
      <GroundShadow location={location} width={spot.size * 0.92 * scale} style={{ bottom: 16 * scale }} />
      <Pressable
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Talk to ${NPCS[id].name}`}
        accessibilityHint={NPCS[id].relationship === 'rival' ? 'Barkly has opinions about this one.' : 'One of the good ones.'}
      >
        <Animated.View style={{ transform: [{ scale: breathScale }] }}>
          <Image source={NPC_ART[id]} style={{ width: spot.size * scale, height: spot.size * 1.25 * scale }} resizeMode="contain" />
        </Animated.View>
      </Pressable>
      {/* On the GROUND, under his feet — not a sticker across his chest. A
          name tag pasted over the art is the single loudest "this is a web
          page" tell in the whole scene. */}
      <Text style={styles.npcName}>{NPCS[id].name.toUpperCase()}</Text>
    </View>
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
  const tugX = useRef(new Animated.Value(0)).current;
  const [digging, setDigging] = useState(false);
  const [variant, setVariant] = useState<'runRight' | 'carryLeft' | null>(null);

  const { snapshot, actions, lastExchange, partialTranscript, error, busy, locked, sttAvailable, location } = barkly;
  const listening = snapshot.state === 'listening';
  const asleep = snapshot.state === 'sleepy';
  const { height: screenH, width: screenW } = useWindowDimensions();
  /**
   * How big he is drawn. The stage is a fixed band between the chrome and the
   * dialogue panel, and he has to live inside it — cropping his paws to make
   * room for a text panel is the kind of thing that makes an app feel like a
   * web page. Capped at 1 so a tall phone gives him air, not a poster.
   */
  const spriteScale = scaleForScreen(screenH);
  /** How tall the world is: everything above the dialogue panel. */
  const sceneBand = screenH - DIALOGUE_HEIGHT - CONTROLS_HEIGHT + 8;
  /**
   * Where his feet meet the ground, measured from the top of the scene layer.
   * Interior scenes are built around this line rather than around percentages
   * of a rectangle — see Scenes.HomeScene.
   */
  const groundY = CONTENT_TOP + CHROME_BOTTOM + stageHeight(screenH) - SPRITE_FOOT;
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
  const runPlay = async () => {
    if (fetching || locked || digging) return;
    const routine = await barkly.play();
    if (routine === 'ball') {
      runChase(() => {});
    } else if (routine === 'tug') {
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
    }
  };

  const runFetch = () => {
    if (fetching || locked || digging) return;
    runChase(() => void barkly.play());
  };

  /**
   * The beach's own verb. Same chase animation, no ball: he runs at the water,
   * the water leaves, he claims victory. Beaches are for chasing something
   * that cannot be caught, which suits him.
   */
  const runWaves = () => {
    if (fetching || locked || digging) return;
    runChase(() => void barkly.chaseWaves());
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
    barkly.pet();
    if (snapshot.state !== 'sleepy') setHeartBurst((b) => b + 1);
  };

  const bubbleText = showcase
    ? 'The longest thing he can say, at three full lines, so the tallest bubble this app can produce is the one being measured right here.'
    : listening && partialTranscript
      ? `“${partialTranscript}”`
      : lastExchange?.barklyText;

  const playLabel =
    location === 'park'
      ? fetching
        ? 'fetching…'
        : 'fetch'
      : location === 'beach'
      ? fetching
        ? 'chasing…'
        : 'waves'
      : fetching || tugging
        ? 'playing…'
        : barkly.toy
          ? barkly.toy.name.toLowerCase().split(' ').slice(-1)[0] // "ball", "rope"
          : 'play';

  if (barkly.onboarding === undefined) return <View style={styles.room} />;
  if (barkly.onboarding.step !== 'done') {
    return <Onboarding state={barkly.onboarding} micAvailable={sttAvailable} onAdvance={barkly.advanceOnboarding} Renderer={Renderer} />;
  }

  return (
    <View style={styles.room}>
      {/*
        The world ends where the stage does.

        It used to be full-bleed behind everything, so once the stage became a
        fixed band the horizon and his feet stopped agreeing: he stood in front
        of the ground rather than on it, and the fence cut him at the knee.
        Bounding the scene to the same floor puts the two back in one space.
      */}
      <Animated.View
        style={[styles.sceneLayer, { opacity: sceneFade }]}
      >
        {location === 'home' && <HomeScene hour={hour} upgrades={barkly.placedHome} asleep={asleep} groundY={groundY} chromeBottom={CONTENT_TOP + CHROME_BOTTOM} />}
        {location === 'park' && <ParkScene hour={hour} bandHeight={sceneBand} />}
        {location === 'town' && <TownScene hour={hour} bandHeight={sceneBand} />}
        {location === 'beach' && <BeachScene hour={hour} bandHeight={sceneBand} />}
      </Animated.View>
      {asleep && <NightOverlay />}

      {/* A soft wash under the chrome. Pills floating directly on artwork is
          most of what reads as "a web page over a picture"; giving them
          something to sit on is most of what reads as an app. */}
      <LinearGradient
        colors={['rgba(255,249,236,0.55)', 'rgba(255,249,236,0.22)', 'rgba(255,249,236,0)']}
        style={styles.chromeScrim}
        pointerEvents="none"
      />

      {/*
        The horizon.

        The scene used to end at a hard horizontal line where the cream UI
        began — grass, then an edge, then a form. Nothing in the world has an
        edge like that, and it is the clearest "two things bolted together"
        tell in the whole composition. A short fade from the ground into the
        paper makes the panel read as part of the same picture.
      */}
      <LinearGradient
        colors={['rgba(255,249,236,0)', 'rgba(255,249,236,0.72)', 'rgba(255,249,236,1)']}
        locations={[0, 0.55, 1]}
        style={styles.horizon}
        pointerEvents="none"
      />

      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/*
          ONE status row.

          It used to open with a "Barkly" wordmark chip taking a third of the
          width — an app telling you its own name, every second, on the screen
          where the name is written on the dog's collar. Dropping it gives the
          coins and the level room to breathe at 360px instead of printing
          through each other.
        */}
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
            <Pressable
              style={[styles.gear, barkly.muted && styles.gearMuted]}
              hitSlop={10}
              onPress={barkly.toggleMuted}
              accessibilityRole="switch"
              accessibilityState={{ checked: barkly.muted }}
              accessibilityLabel={barkly.muted ? 'Unmute Barkly' : 'Mute Barkly'}
            >
              <SpeakerIcon muted={barkly.muted} />
            </Pressable>
            <Pressable style={styles.gear} hitSlop={10} onPress={() => openOnly(setSettingsOpen)} accessibilityRole="button" accessibilityLabel="Settings">
              <View style={styles.gearDot} />
              <View style={styles.gearDot} />
              <View style={styles.gearDot} />
            </Pressable>
          </View>
        </View>

        {/*
          Transient notices live in an OVERLAY, not in the layout flow.

          They used to be ordinary children between the header and the tabs,
          so every coin you earned pushed the tabs, the plan pill, the speech
          bubble and the whole stage down by ~34px and then snapped them back
          two seconds later. Since a reward fires on almost every action, the
          screen was jumping under your finger constantly — and a promotion
          banner (much taller) moved it further still. Absolute positioning is
          the whole fix: the notice appears over the scene and nothing else
          moves at all.
        */}
        {/*
          ONE notice at a time, in a strip of its own.

          These used to be three siblings stacking downward with a 6px gap, so
          earning coins during a rivalry promotion put two cards on screen and
          a backend warning made three — reaching down into his speech bubble.
          A notice is now chosen by priority (a real problem beats a story beat
          beats a coin receipt) and the strip's height is fixed, so everything
          below it can be positioned against a constant. See ui/layout.ts.
        */}
        {notice && (
          <View style={styles.noticeLayer} pointerEvents="box-none">
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
                  {shownPromo.kind === 'rival' ? 'RIVALRY ESCALATED' : 'FRIENDSHIP DEEPENED'}
                </Text>
                <Text style={styles.promoHeadline} numberOfLines={2}>{shownPromo.headline}</Text>
                <Text style={styles.promoStep}>
                  {shownPromo.fromLabel} → {shownPromo.toLabel}
                </Text>
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

        <View style={styles.places}>
          <View style={styles.tabs}>
          {LOCATION_ORDER.map((loc: LocationId) => {
            const areaLocked = !barkly.isUnlocked(loc);
            return (
              <Pressable
                key={loc}
                style={[styles.tab, location === loc && styles.tabActive, areaLocked && styles.tabLocked]}
                disabled={locked || fetching}
                onPress={() => barkly.goTo(loc)}
                accessibilityRole="tab"
                accessibilityState={{ selected: location === loc }}
                accessibilityLabel={areaLocked ? `${LOCATIONS[loc].name}, locked until level ${AREA_UNLOCKS[loc]?.level}. Tap and he will say so.` : LOCATIONS[loc].name}
              >
                {/* A locked place stays TAPPABLE and he answers — see
                    progression.lockedAreaLine. The level requirement used to
                    be a second line of text inside the tab, which made that
                    one tab taller than its neighbours and pushed the whole
                    row past the edge of a 360px screen. */}
                <Text style={[styles.tabText, location === loc && styles.tabTextActive]} numberOfLines={1}>
                  {areaLocked ? '\u{1F512} ' : ''}{LOCATIONS[loc].name.toLowerCase()}
                </Text>
              </Pressable>
            );
          })}
          </View>

          {/* The plan joins the places row as a compact chip. It had a whole
              row to itself for a progress fraction and a teaser sentence. */}
          {barkly.adventure && (
            <Pressable
              style={[styles.planChip, planComplete && styles.planChipDone]}
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

        <View style={[styles.stageArea, { height: stageHeight(screenH) }]}>
          {!asleep && <GroundShadow location={location} width={230 * spriteScale} style={{ bottom: 18 }} />}
          {asleep && location === 'home' && <DogBedBack upgraded={barkly.hasHome('home_bed')} />}
          {npcsHere.map((id) => (
            <NpcDog key={id} id={id} location={location} scale={spriteScale} onPress={() => barkly.npcTalk(id)} />
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
              <Renderer state={snapshot.state} actions={actions} variant={variant} collarId={barkly.collarId} scale={spriteScale} />
            </Pressable>
          </Animated.View>
          {/* After the dog, so the near rim overlaps his lower body. */}
          {asleep && location === 'home' && <DogBedFront upgraded={barkly.hasHome('home_bed')} />}
          {fetching && location !== 'beach' && variant !== 'carryLeft' && (
            <Animated.View style={[styles.fetchBall, { transform: [{ translateX: ballX }, { translateY: ballY }] }]} pointerEvents="none">
              <RubberBall size={30} />
            </Animated.View>
          )}
          {/* Somewhere to dig, at both sites that have anything buried. The
              beach turns up its OWN finds — a place that hands you the park's
              fourteen objects is a background, not a place. */}
          {(location === 'park' || location === 'beach') && !asleep && (
            <Pressable
              style={styles.digSpot}
              onPress={runDig}
              disabled={digging || fetching || locked}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={location === 'beach' ? 'Search the wet sand' : 'Dig here'}
            >
              {location === 'beach' ? (
                <Svg width={86} height={44} viewBox="0 0 86 44">
                  <Path d="M4 38 Q43 12 82 38 Z" fill={SAND.mound} />
                  <Path d="M18 38 Q43 22 68 38 Z" fill={SAND.shade} />
                  <Path d="M34 33 q5 -6 10 0 q5 -6 10 0" stroke={SAND.ripple} strokeWidth={2} fill="none" />
                </Svg>
              ) : (
                <Svg width={86} height={44} viewBox="0 0 86 44">
                  <Path d="M6 38 Q43 2 80 38 Z" fill={DIRT.mound} />
                  <Path d="M18 38 Q43 14 68 38 Z" fill={DIRT.shade} />
                  <Circle cx={43} cy={34} r={7} fill={DIRT.hole} />
                </Svg>
              )}
              <Text style={styles.digHint}>
                {digging ? '…' : location === 'beach' ? 'SIFT' : 'DIG'}
              </Text>
            </Pressable>
          )}
          {/* A bought toy is IN THE ROOM, not a line on a receipt. It sits
              off to the side when idle and vanishes while it is in play. */}
          {barkly.toy && !fetching && !asleep && (
            <View style={styles.toyProp} pointerEvents="none">
              {barkly.toy.id === 'toy_ball' ? (
                <RubberBall size={34} />
              ) : (
                <Svg width={58} height={26} viewBox="0 0 58 26">
                  <Path
                    d="M8 13 q 10 -8 20 0 q 10 8 22 0"
                    stroke={BRASS.mid}
                    strokeWidth={9}
                    strokeLinecap="round"
                    fill="none"
                  />
                  <Path d="M4 13 l -2 -6 M4 13 l -2 6 M54 13 l 2 -6 M54 13 l 2 6"
                    stroke={BRASS.pale} strokeWidth={3} strokeLinecap="round" />
                </Svg>
              )}
            </View>
          )}
          {snapshot.state === 'eating' && <FoodBowl />}
          {snapshot.state === 'playing' && !fetching && <Ball />}
          <HeartBurst burst={heartBurst} />
          {(stateLabel || showcase) && (
            <View style={styles.chip}>
              {(listening || snapshot.state === 'thinking') && <View style={styles.chipDot} />}
              <Text style={styles.chipText}>{stateLabel || 'listening'}</Text>
            </View>
          )}
        </View>

        {/*
          Everything anyone says, in one panel, below the stage.

          This is what makes "speech never covers his face" true by
          construction rather than by measurement: the stage ends where the
          panel begins, so nothing in one can land on anything in the other.
        */}
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
          {sttAvailable ? (
            <Pressable
              style={({ pressed }) => [styles.talk, listening && styles.talkActive, (locked || pressed) && styles.pressed, locked && styles.disabled]}
              disabled={locked}
              onPressIn={barkly.startTalk}
              onPressOut={barkly.stopTalk}
              accessibilityRole="button"
              accessibilityLabel={listening ? 'Listening. Release to send.' : 'Hold to talk to Barkly'}
              accessibilityState={{ disabled: locked, busy: listening }}
            >
              <View style={[styles.micDot, listening && styles.micDotLive]} />
              <Text style={styles.talkText}>{listening ? 'listening — release to send' : 'hold to talk'}</Text>
            </Pressable>
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
              <Pressable
                style={({ pressed }) => [styles.send, pressed && styles.pressed, (locked || !typed.trim()) && styles.sendIdle]}
                disabled={locked || !typed.trim()}
                onPress={sendTyped}
                accessibilityRole="button"
                accessibilityLabel="Talk to Barkly"
                accessibilityState={{ disabled: locked || !typed.trim() }}
              >
                <Text style={[styles.sendText, (locked || !typed.trim()) && styles.sendTextIdle]}>talk</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.actionsRow}>
            <ActionButton
              label={playLabel}
              testLabel="play-action"
              hint={
                location === 'park'
                  ? 'Throw the ball and let him chase it.'
                  : location === 'beach'
                    ? 'Send him at the sea. He will not win.'
                    : 'Play with whatever he is holding.'
              }
              onPress={location === 'park' ? runFetch : location === 'beach' ? runWaves : runPlay}
              disabled={locked || fetching || tugging}
            />
            <ActionButton
              label="feed"
              onPress={() => openOnly(setFoodOpen)}
              disabled={locked || fetching}
              hint="Give him something to eat."
            />
            <ActionButton
              label={asleep ? 'wake' : 'sleep'}
              hint={asleep ? 'Wake him up.' : 'Send him to bed.'}
              onPress={barkly.sleepToggle}
              disabled={locked || fetching}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      <ContestSheet
        visible={barkly.pendingContest !== null}
        rules={barkly.pendingContest}
        onDone={(result) => void barkly.finishContest(result)}
        onClose={() => void barkly.finishContest(null)}
      />
      <FoodSheet
        visible={foodOpen}
        onClose={() => setFoodOpen(false)}
        onOpenShop={() => openOnly(setStoreOpen)}
        wallet={barkly.wallet}
        hungry={snapshot.stats.hunger > 45}
        onFeed={(itemId) => void barkly.feed(itemId)}
      />
      <StoreSheet visible={storeOpen} onClose={() => setStoreOpen(false)} wallet={barkly.wallet} onBuy={barkly.buy} onEquip={barkly.equip} devMode={barkly.devMode} />
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
      />
    </View>
  );
}

/**
 * A primary action. It had no accessibility role and no label, so with
 * VoiceOver or TalkBack the three controls the whole app runs on announced
 * nothing and could not be found at all.
 */
/** Stand-in used only by the stress mode, so the tallest notice is measurable. */
const SHOWCASE_PROMOTION = {
  who: 'Duke',
  kind: 'rival' as const,
  headline: 'Duke is now an official rival',
  line: '',
  fromLabel: 'annoying dog',
  toLabel: 'official rival',
};

function ActionButton({
  label,
  onPress,
  disabled,
  hint,
  testLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  hint?: string;
  /** Stable handle for the overlap checker; the visible label changes by place. */
  testLabel?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (v: number) => Animated.spring(scale, { toValue: v, friction: 5, tension: 300, useNativeDriver: true }).start();
  return (
    <Pressable
      style={styles.actionWrap}
      onPressIn={() => springTo(0.94)}
      onPressOut={() => springTo(1)}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      testID={testLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <Animated.View style={[styles.action, disabled && styles.disabled, { transform: [{ scale }] }]}>
        <Text style={styles.actionText}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}


const styles = StyleSheet.create({
  room: { flex: 1, backgroundColor: color.well },
  /**
   * The scene runs the FULL height now and the horizon gradient fades it into
   * the paper. It used to stop at the top of the dialogue panel, which left a
   * ruler-straight edge across the screen — see Scenes.Apron. Scenes still
   * COMPOSE into `sceneBand`; only the ground continues past it.
   */
  sceneLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  chromeScrim: { position: 'absolute', left: 0, right: 0, top: 0, height: CHROME_BOTTOM + 92 },
  horizon: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // Starts above the dialogue panel and lands on the paper the controls sit
    // on, so the ground dissolves rather than stopping.
    height: DIALOGUE_HEIGHT + CONTROLS_HEIGHT + 56,
  },
  content: { flex: 1, paddingTop: CONTENT_TOP, paddingBottom: 26, paddingHorizontal: 22 },

  /* -------- chrome: one status row, one places row -------- */
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
    gap: space.sm,
    marginTop: space.sm,
  },
  planChip: {
    minWidth: 46,
    height: 32,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.low,
  },
  planChipDone: { backgroundColor: color.goodWell },
  planChipText: { ...type.caption, fontWeight: '900', color: color.inkSoft },
  planChipTextDone: { color: color.good },
  gear: {
    width: 38,
    height: 38,
    borderRadius: 18,
    backgroundColor: color.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
    ...elevation.card,
  },
  gearDot: { width: 4, height: 4, borderRadius: 8, backgroundColor: color.inkSoft },
  headerButtons: { flexDirection: 'row', gap: 7 },
  toyProp: { position: 'absolute', bottom: 16, right: 24 },
  walletTap: { flex: 1, marginHorizontal: 8 },
  packButton: {
    minWidth: 43,
    height: 38,
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
  /**
   * The notice overlay. Sits above the location tabs, out of the flow, so a
   * reward or a promotion banner never reflows the screen underneath it.
   */
  noticeLayer: {
    position: 'absolute',
    left: 22,
    right: 22,
    // A strip of its own between the chrome and his speech. Fixed height, so
    // the speech band below can be positioned against a constant.
    top: NOTICE_TOP,
    height: NOTICE_MAX_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 20,
  },
  reward: { alignSelf: 'center', marginTop: 0, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: color.goldWell },
  // The promotion banner. Never colour alone: the eyebrow and the
  // "from → to" line say what happened without relying on the tint.
  promo: {
    alignSelf: 'center',
    marginTop: 0,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    maxWidth: '92%',
  },
  promoRival: { backgroundColor: color.warmWell, borderColor: color.warmLine },
  promoFriend: { backgroundColor: color.goodWell, borderColor: color.goodLine },
  promoEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, color: color.inkSoft },
  promoHeadline: { marginTop: 3, fontSize: 15, fontWeight: '900', color: color.ink, textAlign: 'center' },
  promoStep: { marginTop: 2, fontSize: 12, color: color.inkSoft },
  rewardText: { fontSize: 13, fontWeight: '800', color: color.goldInk },
  degraded: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', marginTop: 0, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: color.fill },
  degradedDot: { width: 7, height: 7, borderRadius: 8, backgroundColor: BRASS.polished },
  degradedText: { fontSize: 12, color: color.inkSoft, flexShrink: 1 },
  gearMuted: { backgroundColor: color.fill },

  tabs: { flex: 1, flexDirection: 'row', marginTop: 10, backgroundColor: 'rgba(255,253,247,0.85)', borderRadius: 999, padding: 4, gap: 2, ...elevation.card },
  tab: { flex: 1, paddingVertical: 7, paddingHorizontal: 6, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: color.ink },
  tabText: { fontSize: 13, fontWeight: '800', color: color.inkSoft, letterSpacing: 0.2 },
  tabTextActive: { color: color.paper },

  /**
   * Anchored just over his head, inside the stage. `top: 0` plus flex-end
   * means a long line grows UPWARD from the anchor and simply stops at the top
   * of the stage instead of climbing into the location tabs.
   */
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

  stageArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 22 },
  heartLayer: { position: 'absolute', bottom: 190, alignSelf: 'center' },
  heart: { position: 'absolute', fontSize: 24, color: color.danger },
  fetchBall: { position: 'absolute', bottom: 40, alignSelf: 'center', zIndex: 7 },
  npc: { position: 'absolute', alignItems: 'center', zIndex: 3 },
  digSpot: { position: 'absolute', left: 18, bottom: 26, alignItems: 'center', zIndex: 2 },
  /**
   * Labels that live IN the world — a dog's name, "dig?" — share one
   * treatment: dark, translucent, small caps, sitting on the ground under the
   * thing they name. They used to be white pills, identical to the app's
   * chrome, which made them read as interface stickers pasted on the
   * illustration. Chrome is light on the world; the world labels itself dark.
   */
  digHint: { marginTop: 2, ...type.micro, color: color.inkOn, backgroundColor: 'rgba(62,52,40,0.42)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
  npcName: { marginTop: 3, ...type.micro, color: color.inkOn, backgroundColor: 'rgba(62,52,40,0.42)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },

  chip: { position: 'absolute', bottom: 8, zIndex: 3, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color.card, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13, ...elevation.card },
  chipDot: { width: 7, height: 7, borderRadius: 8, backgroundColor: ACCENT },
  chipText: { fontSize: 13, fontWeight: '700', color: color.inkSoft },

  controls: { gap: 9 },
  talk: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: color.ink, borderRadius: 999, paddingVertical: 18, ...elevation.card },
  talkActive: { backgroundColor: color.brand },
  micDot: { width: 9, height: 9, borderRadius: 8, backgroundColor: ACCENT },
  micDotLive: { backgroundColor: color.dangerWell },
  talkText: { color: color.paper, fontWeight: '800', fontSize: 15, letterSpacing: 0.4 },

  typeRow: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, backgroundColor: color.card, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 13, fontSize: 15, color: color.ink, ...elevation.low },
  send: { backgroundColor: color.ink, borderRadius: 999, paddingHorizontal: 24, justifyContent: 'center', ...elevation.card },
  sendText: { color: color.paper, fontWeight: '800', fontSize: 15, letterSpacing: 0.4 },
  /**
   * "Nothing typed yet" is a RESTING state, not a broken one. Fading the dark
   * fill to 45% produced a muddy grey slab sitting where the app's primary
   * action lives; a quiet fill with quiet text says the same thing and stops
   * the bottom of the screen looking switched off.
   */
  sendIdle: { backgroundColor: color.fill, ...elevation.flat },
  sendTextIdle: { color: color.inkFaint },

  actionsRow: { flexDirection: 'row', gap: 10 },
  actionWrap: { flex: 1 },
  action: {
    backgroundColor: color.card,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: color.line,
    ...elevation.low,
  },
  pressed: { transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
  actionText: { fontWeight: '800', color: color.inkMid, fontSize: 15, letterSpacing: 0.4 },
});
