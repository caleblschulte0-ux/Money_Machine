/**
 * Barkly's world: home, park, town — plus the Pack Book that makes the
 * relationship itself a first-class part of the product.
 */

import React, { useEffect, useRef, useState } from 'react';
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
import { AREA_UNLOCKS, levelProgress } from '../game/progression';
import BarklyView from './BarklyView';
import SettingsSheet from './SettingsSheet';
import { Ball, FoodBowl } from './StageProps';
import { DogBedBack, DogBedFront, HomeScene, NightOverlay, ParkScene, TownScene } from './scenes/Scenes';
import { BarklyState } from '../barkly/types';
import { LOCATION_ORDER, LOCATIONS, LocationId } from '../world/locations';
import { NPCS, NpcId } from '../world/npcs';

const Renderer = process.env.EXPO_PUBLIC_BARKLY_RENDERER === 'vector' ? BarklyView : BarklyPhotoView;

const NPC_ART: Record<NpcId, ReturnType<typeof require>> = {
  biscuit: require('../../assets/barkly/renders/npcs/biscuit_front.png'),
  pepper: require('../../assets/barkly/renders/npcs/pepper_front.png'),
  duke: require('../../assets/barkly/renders/npcs/duke_front.png'),
};

const NPC_SPOTS: Partial<Record<NpcId, { left?: number; right?: number; bottom: number; size: number }>> = {
  biscuit: { left: 6, bottom: 96, size: 108 },
  duke: { right: 2, bottom: 118, size: 124 },
  pepper: { right: 8, bottom: 100, size: 114 },
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

const INK = '#3E3428';
const INK_SOFT = '#8A7A5F';
const CARD = '#FFFDF7';
const ACCENT = '#D99A2B';

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

function NpcDog({ id, onPress, bubble }: { id: NpcId; onPress: () => void; bubble: string | null }) {
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
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.014] });
  return (
    <View style={[styles.npc, { left: spot.left, right: spot.right, bottom: spot.bottom }]}>
      {bubble && (
        <View style={styles.npcBubble}>
          <Text style={styles.npcBubbleText} numberOfLines={3}>{bubble}</Text>
        </View>
      )}
      <Pressable onPress={onPress} hitSlop={8}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Image source={NPC_ART[id]} style={{ width: spot.size, height: spot.size * 1.25 }} resizeMode="contain" />
        </Animated.View>
      </Pressable>
      <Text style={styles.npcName}>{NPCS[id].name}</Text>
    </View>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M3 7.5h3.2L10.5 4v12L6.2 12.5H3z" fill={muted ? '#9A8C76' : INK_SOFT} />
      {!muted && (
        <>
          <Path d="M13 7.2a4 4 0 0 1 0 5.6" stroke={INK_SOFT} strokeWidth={1.6} strokeLinecap="round" fill="none" />
          <Path d="M15.4 5.2a7 7 0 0 1 0 9.6" stroke={INK_SOFT} strokeWidth={1.6} strokeLinecap="round" fill="none" />
        </>
      )}
      {muted && <Path d="M13 6.5l5 7M18 6.5l-5 7" stroke="#B3402E" strokeWidth={1.8} strokeLinecap="round" />}
    </Svg>
  );
}

export default function BarklyRoom() {
  const barkly = useBarkly();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [packOpen, setPackOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [heartBurst, setHeartBurst] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [digging, setDigging] = useState(false);
  const [variant, setVariant] = useState<'runRight' | 'carryLeft' | null>(null);

  const { snapshot, actions, lastExchange, partialTranscript, error, busy, sttAvailable, location } = barkly;
  const listening = snapshot.state === 'listening';
  const asleep = snapshot.state === 'sleepy';
  const stateLabel = STATE_LABEL[snapshot.state];
  const hour = new Date().getHours();
  const npcsHere = LOCATIONS[location].npcIds;
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
  const runFetch = () => {
    if (fetching || busy || digging) return;
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
        barkly.play();
        setFetching(false);
      });
    });
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
    if (digging || fetching || busy) return;
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

  const bubbleText = listening && partialTranscript ? `“${partialTranscript}”` : lastExchange?.barklyText;
  const playLabel = location === 'park' ? (fetching ? 'fetching…' : 'fetch') : 'play';

  if (barkly.onboarding === undefined) return <View style={styles.room} />;
  if (barkly.onboarding.step !== 'done') {
    return <Onboarding state={barkly.onboarding} micAvailable={sttAvailable} onAdvance={barkly.advanceOnboarding} Renderer={Renderer} />;
  }

  return (
    <View style={styles.room}>
      <Animated.View style={[styles.sceneLayer, { opacity: sceneFade }]}>
        {location === 'home' && <HomeScene hour={hour} />}
        {location === 'park' && <ParkScene hour={hour} />}
        {location === 'town' && <TownScene hour={hour} />}
      </Animated.View>
      {asleep && <NightOverlay />}

      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={styles.wordmarkChip}>
            <Text style={styles.wordmark}>Barkly</Text>
          </View>
          <Pressable
            style={styles.walletTap}
            onPress={() => setStoreOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Shop. ${barkly.wallet.coins} coins, level ${barkly.level}.`}
          >
            <CoinPill coins={barkly.wallet.coins} level={barkly.level} frac={levelProgress(barkly.wallet.xp).frac} />
          </Pressable>
          <View style={styles.headerButtons}>
            <Pressable
              style={styles.packButton}
              hitSlop={8}
              onPress={() => setPackOpen(true)}
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
            <Pressable style={styles.gear} hitSlop={10} onPress={() => setSettingsOpen(true)} accessibilityRole="button" accessibilityLabel="Settings">
              <View style={styles.gearDot} />
              <View style={styles.gearDot} />
              <View style={styles.gearDot} />
            </Pressable>
          </View>
        </View>

        {barkly.reward && (
          <View style={styles.reward} pointerEvents="none" accessibilityLiveRegion="polite">
            <Text style={styles.rewardText}>
              +{barkly.reward.coins}c  +{barkly.reward.xp} xp
              {barkly.reward.note ? `  ·  ${barkly.reward.note}` : ''}
            </Text>
          </View>
        )}

        {barkly.degraded && (
          <Pressable style={styles.degraded} onPress={barkly.dismissDegraded} accessibilityRole="button" accessibilityLabel={`${barkly.degraded}. Tap to dismiss.`}>
            <View style={styles.degradedDot} />
            <Text style={styles.degradedText}>{barkly.degraded}</Text>
          </Pressable>
        )}

        <View style={styles.tabs}>
          {LOCATION_ORDER.map((loc: LocationId) => {
            const locked = !barkly.isUnlocked(loc);
            return (
              <Pressable
                key={loc}
                style={[styles.tab, location === loc && styles.tabActive, locked && styles.tabLocked]}
                disabled={busy || fetching || locked}
                onPress={() => barkly.goTo(loc)}
                accessibilityRole="tab"
                accessibilityState={{ selected: location === loc, disabled: locked }}
                accessibilityLabel={locked ? `${LOCATIONS[loc].name}, locked until level ${AREA_UNLOCKS[loc]?.level}` : LOCATIONS[loc].name}
              >
                <Text style={[styles.tabText, location === loc && styles.tabTextActive]}>{LOCATIONS[loc].name.toLowerCase()}</Text>
                {locked && <Text style={styles.tabLock}>Lv {AREA_UNLOCKS[loc]?.level}</Text>}
              </Pressable>
            );
          })}
        </View>

        {barkly.adventure && (
          <Pressable
            style={[styles.planPill, planComplete && styles.planPillDone]}
            onPress={() => setPlanOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Barkly's plan. ${planDone} of ${planTotal} complete.`}
          >
            <Text style={[styles.planLabel, planComplete && styles.planLabelDone]}>PLAN</Text>
            <View style={[styles.planDot, planComplete && styles.planDotDone]} />
            <Text style={[styles.planProgress, planComplete && styles.planProgressDone]}>{planDone}/{planTotal}</Text>
            <Text style={[styles.planTease, planComplete && styles.planTeaseDone]} numberOfLines={1}>
              {planComplete ? 'disturbingly productive' : barkly.adventure.goals.find((goal) => !goal.done)?.label ?? 'see the plan'}
            </Text>
            <Text style={[styles.planArrow, planComplete && styles.planProgressDone]}>›</Text>
          </Pressable>
        )}

        <View style={styles.bubbleZone}>
          {bubbleText ? (
            <AnimatedBubble changeKey={bubbleText}>
              {lastExchange && !listening && lastExchange.userText !== '' && (
                <Text style={styles.bubbleYou} numberOfLines={1}>you said “{lastExchange.userText}”</Text>
              )}
              <Text style={styles.bubbleText} numberOfLines={4}>{bubbleText}</Text>
              <View style={styles.bubbleTail} />
            </AnimatedBubble>
          ) : (
            <Text style={[styles.hint, asleep && styles.hintNight]}>
              {asleep ? 'shh — he’s sleeping' : sttAvailable ? 'hold talk and say hi' : 'type something and say hi'}
            </Text>
          )}
          {error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
        </View>

        <View style={styles.stageArea}>
          {!asleep && <View style={styles.shadow} />}
          {asleep && location === 'home' && <DogBedBack />}
          {npcsHere.map((id) => (
            <NpcDog key={id} id={id} bubble={barkly.npcBubble?.id === id ? barkly.npcBubble.line : null} onPress={() => barkly.npcTalk(id)} />
          ))}
          <Animated.View
            style={{
              transform: [
                { translateX: Animated.add(chaseX, walkX) },
                { translateY: hopY },
                { rotate: digRotate.interpolate({ inputRange: [-1, 1], outputRange: ['-7deg', '7deg'] }) },
              ],
            }}
          >
            <Pressable onPress={pet} disabled={busy}>
              <Renderer state={snapshot.state} actions={actions} variant={variant} collarColor={barkly.collarColor} />
            </Pressable>
          </Animated.View>
          {asleep && location === 'home' && <DogBedFront />}
          {fetching && variant !== 'carryLeft' && (
            <Animated.View style={[styles.fetchBall, { transform: [{ translateX: ballX }, { translateY: ballY }] }]} pointerEvents="none">
              <Svg width={30} height={30} viewBox="0 0 30 30">
                <Circle cx={15} cy={15} r={13} fill="#B3402E" />
                <Path d="M3 13 C11 9 19 9 27 13" stroke="#8E2F20" strokeWidth={2.5} fill="none" />
                <Circle cx={10} cy={9} r={3.5} fill="#FFFFFF" opacity={0.35} />
              </Svg>
            </Animated.View>
          )}
          {location === 'park' && !asleep && (
            <Pressable style={styles.digSpot} onPress={runDig} disabled={digging || fetching || busy} hitSlop={8}>
              <Svg width={86} height={44} viewBox="0 0 86 44">
                <Path d="M6 38 Q43 2 80 38 Z" fill="#8A6B3A" />
                <Path d="M18 38 Q43 14 68 38 Z" fill="#75592F" />
                <Circle cx={43} cy={34} r={7} fill="#5C4426" />
              </Svg>
              <Text style={styles.digHint}>{digging ? '…' : 'dig?'}</Text>
            </Pressable>
          )}
          {barkly.thought && !bubbleText && (
            <View style={styles.thought} pointerEvents="none">
              <Text style={styles.thoughtText}>{barkly.thought}</Text>
              <View style={styles.thoughtDot1} />
              <View style={styles.thoughtDot2} />
            </View>
          )}
          {snapshot.state === 'eating' && <FoodBowl />}
          {snapshot.state === 'playing' && !fetching && <Ball />}
          <HeartBurst burst={heartBurst} />
          {stateLabel && (
            <View style={styles.chip}>
              {(listening || snapshot.state === 'thinking') && <View style={styles.chipDot} />}
              <Text style={styles.chipText}>{stateLabel}</Text>
            </View>
          )}
        </View>

        <View style={styles.controls}>
          {sttAvailable ? (
            <Pressable
              style={({ pressed }) => [styles.talk, listening && styles.talkActive, (busy || pressed) && styles.pressed, busy && styles.disabled]}
              disabled={busy}
              onPressIn={barkly.startTalk}
              onPressOut={barkly.stopTalk}
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
                placeholderTextColor={INK_SOFT}
                editable={!busy}
                onSubmitEditing={sendTyped}
                returnKeyType="send"
              />
              <Pressable style={({ pressed }) => [styles.send, pressed && styles.pressed, (busy || !typed.trim()) && styles.disabled]} disabled={busy || !typed.trim()} onPress={sendTyped}>
                <Text style={styles.sendText}>talk</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.actionsRow}>
            <ActionButton label={playLabel} onPress={location === 'park' ? runFetch : barkly.play} disabled={busy || fetching} />
            <ActionButton label="feed" onPress={barkly.feed} disabled={busy || fetching} />
            <ActionButton label={asleep ? 'wake' : 'sleep'} onPress={barkly.sleepToggle} disabled={busy || fetching} />
          </View>
        </View>
      </KeyboardAvoidingView>

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
        onSetDevMode={barkly.setDevMode}
        onGrantCoins={barkly.devGrantCoins}
        onGrantLevel={barkly.devGrantLevel}
        onGrantEverything={barkly.devGrantEverything}
        onForgetEverything={barkly.forgetEverything}
      />
    </View>
  );
}

function ActionButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (v: number) => Animated.spring(scale, { toValue: v, friction: 5, tension: 300, useNativeDriver: true }).start();
  return (
    <Pressable style={styles.actionWrap} onPressIn={() => springTo(0.94)} onPressOut={() => springTo(1)} onPress={onPress} disabled={disabled}>
      <Animated.View style={[styles.action, disabled && styles.disabled, { transform: [{ scale }] }]}>
        <Text style={styles.actionText}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const shadowCard = Platform.select({
  web: { boxShadow: '0 10px 24px rgba(74, 59, 42, 0.12)' } as object,
  default: {
    shadowColor: '#4A3B2A',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
});

const styles = StyleSheet.create({
  room: { flex: 1, backgroundColor: '#F7F1E2' },
  sceneLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  content: { flex: 1, paddingTop: 54, paddingBottom: 26, paddingHorizontal: 22 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmarkChip: {
    backgroundColor: 'rgba(255,253,247,0.85)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    ...(shadowCard as object),
  },
  wordmark: { fontSize: 20, fontWeight: '800', color: INK, letterSpacing: 0.3 },
  gear: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
    ...(shadowCard as object),
  },
  gearDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: INK_SOFT },
  headerButtons: { flexDirection: 'row', gap: 7 },
  walletTap: { flex: 1, marginHorizontal: 8 },
  packButton: {
    minWidth: 43,
    height: 38,
    borderRadius: 13,
    paddingHorizontal: 7,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    ...(shadowCard as object),
  },
  packLabel: { fontSize: 7, lineHeight: 8, fontWeight: '900', letterSpacing: 1.1, color: '#E2C471' },
  packLevel: { marginTop: 1, fontSize: 15, lineHeight: 16, fontWeight: '900', color: '#FFF9EC' },
  tabLocked: { opacity: 0.5 },
  tabLock: { fontSize: 10, fontWeight: '800', color: '#9A8F7A', marginTop: 1 },
  reward: { alignSelf: 'center', marginTop: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F5E6BE' },
  rewardText: { fontSize: 13, fontWeight: '800', color: '#6B5310' },
  degraded: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', marginTop: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F0E4CC' },
  degradedDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#B98F3E' },
  degradedText: { fontSize: 12, color: INK_SOFT, flexShrink: 1 },
  gearMuted: { backgroundColor: '#E6DCC8' },

  tabs: { flexDirection: 'row', alignSelf: 'center', marginTop: 10, backgroundColor: 'rgba(255,253,247,0.85)', borderRadius: 999, padding: 4, gap: 4, ...(shadowCard as object) },
  tab: { paddingVertical: 7, paddingHorizontal: 18, borderRadius: 999 },
  tabActive: { backgroundColor: INK },
  tabText: { fontSize: 13, fontWeight: '800', color: INK_SOFT, letterSpacing: 0.4 },
  tabTextActive: { color: '#FBF6EA' },

  planPill: {
    alignSelf: 'center',
    maxWidth: '94%',
    marginTop: 7,
    minHeight: 30,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,253,247,0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    ...(shadowCard as object),
  },
  planPillDone: { backgroundColor: 'rgba(232,238,217,0.96)' },
  planLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.1, color: '#8B6817' },
  planLabelDone: { color: '#5E6F40' },
  planDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#D1A63B', marginHorizontal: 7 },
  planDotDone: { backgroundColor: '#70834D' },
  planProgress: { fontSize: 12, fontWeight: '900', color: INK },
  planProgressDone: { color: '#53623A' },
  planTease: { flexShrink: 1, maxWidth: 190, marginLeft: 8, fontSize: 11.5, color: INK_SOFT },
  planTeaseDone: { color: '#71805C' },
  planArrow: { marginLeft: 7, fontSize: 18, lineHeight: 18, color: '#A08759' },

  bubbleZone: { minHeight: 92, justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 },
  hint: { fontSize: 15, color: INK_SOFT, marginBottom: 14 },
  hintNight: { color: '#E8DFC8' },
  bubble: { maxWidth: '92%', backgroundColor: CARD, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 18, ...(shadowCard as object) },
  bubbleYou: { fontSize: 12, color: INK_SOFT, marginBottom: 5 },
  bubbleText: { fontSize: 17, fontWeight: '600', color: INK, lineHeight: 24 },
  bubbleTail: { position: 'absolute', bottom: -7, left: '48%', width: 16, height: 16, backgroundColor: CARD, borderRadius: 3, transform: [{ rotate: '45deg' }] },
  error: { marginTop: 8, fontSize: 13, color: '#B3402E', textAlign: 'center' },

  stageArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 22 },
  shadow: { position: 'absolute', bottom: 18, width: 230, height: 30, borderRadius: 115, backgroundColor: '#4A3B2A', opacity: 0.15 },
  heartLayer: { position: 'absolute', bottom: 190, alignSelf: 'center' },
  heart: { position: 'absolute', fontSize: 24, color: '#D46A5A' },
  fetchBall: { position: 'absolute', bottom: 40, alignSelf: 'center', zIndex: 7 },
  npc: { position: 'absolute', alignItems: 'center', zIndex: 3 },
  digSpot: { position: 'absolute', left: 18, bottom: 26, alignItems: 'center', zIndex: 2 },
  digHint: { marginTop: 2, fontSize: 11, fontWeight: '800', color: INK_SOFT, backgroundColor: 'rgba(255,253,247,0.8)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  thought: { position: 'absolute', top: 0, alignSelf: 'center', maxWidth: 250, backgroundColor: 'rgba(255,253,247,0.92)', borderRadius: 18, paddingVertical: 9, paddingHorizontal: 14, ...(shadowCard as object) },
  thoughtText: { fontSize: 13, fontStyle: 'italic', color: INK_SOFT, lineHeight: 18 },
  thoughtDot1: { position: 'absolute', bottom: -8, left: '46%', width: 9, height: 9, borderRadius: 5, backgroundColor: 'rgba(255,253,247,0.92)' },
  thoughtDot2: { position: 'absolute', bottom: -15, left: '52%', width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,253,247,0.85)' },
  npcName: { marginTop: -4, fontSize: 11, fontWeight: '800', color: INK_SOFT, backgroundColor: 'rgba(255,253,247,0.8)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  npcBubble: { maxWidth: 170, backgroundColor: CARD, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 6, ...(shadowCard as object) },
  npcBubbleText: { fontSize: 12.5, fontWeight: '600', color: INK, lineHeight: 17 },

  chip: { position: 'absolute', bottom: 8, zIndex: 3, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: CARD, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13, ...(shadowCard as object) },
  chipDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: ACCENT },
  chipText: { fontSize: 13, fontWeight: '700', color: INK_SOFT },

  controls: { gap: 10 },
  talk: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: INK, borderRadius: 999, paddingVertical: 18, ...(shadowCard as object) },
  talkActive: { backgroundColor: '#B3402E' },
  micDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: ACCENT },
  micDotLive: { backgroundColor: '#FFD9CF' },
  talkText: { color: '#FBF6EA', fontWeight: '800', fontSize: 16, letterSpacing: 0.4 },

  typeRow: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, backgroundColor: CARD, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 15, fontSize: 15, color: INK, ...(shadowCard as object) },
  send: { backgroundColor: INK, borderRadius: 999, paddingHorizontal: 24, justifyContent: 'center', ...(shadowCard as object) },
  sendText: { color: '#FBF6EA', fontWeight: '800', fontSize: 15, letterSpacing: 0.4 },

  actionsRow: { flexDirection: 'row', gap: 10 },
  actionWrap: { flex: 1 },
  action: { backgroundColor: CARD, borderRadius: 999, paddingVertical: 14, alignItems: 'center', ...(shadowCard as object) },
  pressed: { transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
  actionText: { fontWeight: '800', color: INK, fontSize: 15, letterSpacing: 0.4 },
});
