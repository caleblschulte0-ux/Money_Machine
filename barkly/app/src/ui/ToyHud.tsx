import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { LocationId, LOCATION_ORDER, LOCATIONS } from '../world/locations';
import { AREA_UNLOCKS } from '../game/progression';
import { CoinPill } from './StoreSheet';
import { color, elevation, radius, space, type } from './theme';
import { TAP_MIN } from './layout';

/**
 * The main screen's chrome, as toy objects.
 *
 * This file shipped on 2026-08-29 as a "reviewable drop-in prototype" and then
 * sat imported by NOTHING for five days while `docs/VISUAL_DIRECTION_KIDS_GAME.md`
 * listed "wire ToyHud into BarklyRoom" as the next thing to build. A component
 * nothing renders is not a prototype, it is a second implementation of the tab
 * bar that a reader cannot tell apart from the live one -- which cost this
 * session ten minutes of chasing an accessible-name bug in the wrong file.
 *
 * It is now wired, and split in two because BarklyRoom does not stack these:
 * portrait puts the chrome row above the destinations, landscape puts the
 * chrome row across the top and the destinations in a vertical rail.
 */
export interface ChromeRowProps {
  coins: number;
  level: number;
  levelFrac: number;
  onOpenShop: () => void;
  onOpenPack: () => void;
  onOpenPlan: () => void;
  onOpenSettings: () => void;
  packLevel: number;
  packLabel: string;
  planDone: number;
  planTotal: number;
  planComplete: boolean;
  hasPlan: boolean;
}

export interface DestinationTrayProps {
  location: LocationId;
  locked?: boolean;
  isUnlocked: (loc: LocationId) => boolean;
  onLocation: (loc: LocationId) => void;
  /** Landscape stacks the same tiles into the nav rail. */
  vertical?: boolean;
}

function locationColors(loc: LocationId): { body: string; edge: string } {
  switch (loc) {
    case 'home':
      return { body: color.coral, edge: color.coralDeep };
    case 'park':
      return { body: color.mint, edge: color.mintDeep };
    case 'town':
      return { body: color.violet, edge: color.violetDeep };
    case 'beach':
      return { body: color.pop, edge: color.popDeep };
  }
}

function DestinationGlyph({ loc }: { loc: LocationId }) {
  if (loc === 'home') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Path d="M3 11.5 12 4l9 7.5" fill="none" stroke={color.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M6.5 10.5v9h11v-9" fill={color.card} stroke={color.ink} strokeWidth={2} strokeLinejoin="round" />
        <Rect x={10} y={14} width={4} height={5.5} rx={1} fill={color.coralDeep} />
      </Svg>
    );
  }
  if (loc === 'park') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Rect x={10.4} y={12} width={3.2} height={8} rx={1.2} fill={color.inkMid} />
        <Circle cx={12} cy={9} r={6.3} fill={color.card} stroke={color.ink} strokeWidth={2} />
        <Circle cx={8.6} cy={10.6} r={3.1} fill={color.mintDeep} />
        <Circle cx={15.4} cy={10.2} r={3.2} fill={color.mintDeep} />
      </Svg>
    );
  }
  if (loc === 'town') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Rect x={4} y={8} width={16} height={12} rx={2} fill={color.card} stroke={color.ink} strokeWidth={2} />
        <Path d="M4 8h16l-2-4H6z" fill={color.lemon} stroke={color.ink} strokeWidth={2} strokeLinejoin="round" />
        <Path d="M8 8v4M12 8v4M16 8v4" stroke={color.violetDeep} strokeWidth={2} />
        <Rect x={10} y={14} width={4} height={6} rx={1} fill={color.violetDeep} />
      </Svg>
    );
  }
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Circle cx={17} cy={6} r={3} fill={color.lemon} />
      <Path d="M2 14c3-3 5 3 8 0s5 3 8 0 4 1 4 1" fill="none" stroke={color.card} strokeWidth={3} strokeLinecap="round" />
      <Path d="M2 19c3-3 5 3 8 0s5 3 8 0 4 1 4 1" fill="none" stroke={color.ink} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function LockDot() {
  return (
    <View style={styles.lockDot}>
      <Svg width={12} height={12} viewBox="0 0 12 12">
        <Path d="M3.5 5V3.7a2.5 2.5 0 0 1 5 0V5" fill="none" stroke={color.inkOn} strokeWidth={1.5} />
        <Rect x={2} y={5} width={8} height={6} rx={2} fill={color.ink} />
      </Svg>
    </View>
  );
}

function PackBook({ level, label }: { level: number; label: string }) {
  return (
    <View style={styles.bookWrap}>
      <View style={styles.bookBack} />
      <View style={styles.book}>
        <View style={styles.bookSpine} />
        <Text style={styles.bookWord}>PACK</Text>
        <Text style={styles.bookLevel}>{level}</Text>
      </View>
      <Text style={styles.srLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function PlanNote({ done, total, complete }: { done: number; total: number; complete: boolean }) {
  return (
    <View style={[styles.planNote, complete && styles.planDone]}>
      <View style={styles.planTape} />
      <View style={styles.planFold} />
      <Text style={styles.planMini}>PLAN</Text>
      <Text style={styles.planCount}>{done}/{total}</Text>
    </View>
  );
}

export function ToyChromeRow({
  coins,
  level,
  levelFrac,
  onOpenShop,
  onOpenPack,
  onOpenPlan,
  onOpenSettings,
  packLevel,
  packLabel,
  planDone,
  planTotal,
  planComplete,
  hasPlan,
}: ChromeRowProps) {
  return (
    <View style={styles.topRow}>
      <Pressable
        style={({ pressed }) => [styles.wallet, pressed && styles.pressed]}
        onPress={onOpenShop}
        accessibilityRole="button"
        accessibilityLabel={`Shop. ${coins} coins, level ${level}.`}
      >
        <CoinPill coins={coins} level={level} frac={levelFrac} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.bookButton, pressed && styles.pressed]}
        onPress={onOpenPack}
        accessibilityRole="button"
        accessibilityLabel={`Pack Book. ${packLabel}.`}
      >
        <PackBook level={packLevel} label={packLabel} />
      </Pressable>

      {hasPlan && (
        <Pressable
          style={({ pressed }) => [styles.planButton, pressed && styles.pressed]}
          onPress={onOpenPlan}
          accessibilityRole="button"
          accessibilityLabel={`Barkly's plan. ${planDone} of ${planTotal} complete.`}
        >
          <PlanNote done={planDone} total={planTotal} complete={planComplete} />
        </Pressable>
      )}

      <Pressable
        style={({ pressed }) => [styles.settings, pressed && styles.pressed]}
        onPress={onOpenSettings}
        accessibilityRole="button"
        accessibilityLabel="Settings"
      >
        <View style={styles.settingsGloss} pointerEvents="none" />
        <View style={styles.gearDot} />
        <View style={styles.gearDot} />
        <View style={styles.gearDot} />
      </Pressable>
    </View>
  );
}

export function DestinationTray({ location, locked, isUnlocked, onLocation, vertical }: DestinationTrayProps) {
  return (
    <View style={[styles.destinationTray, vertical && styles.destinationTrayVertical]}>
      {!vertical && <View style={styles.trayGloss} pointerEvents="none" />}
      {LOCATION_ORDER.map((loc) => {
        const open = isUnlocked(loc);
        const selected = loc === location;
        const paint = locationColors(loc);
        return (
          <Pressable
            key={loc}
            disabled={Boolean(locked)}
            onPress={() => onLocation(loc)}
            style={({ pressed }) => [
              styles.destination,
              { backgroundColor: selected ? paint.body : color.card, borderColor: selected ? paint.edge : color.line },
              selected && !vertical && styles.destinationSelected,
              pressed && styles.pressed,
              locked && styles.disabled,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            /*
             * The unlocked name is BARE -- "Park", not "Park, open" -- because
             * the art lab drives the whole contact sheet with
             * getByRole('tab', { name: /^park$/i }). Decorating it here silently
             * turns a 16-frame capture into "no tab for beach".
             */
            accessibilityLabel={open ? LOCATIONS[loc].name : `${LOCATIONS[loc].name}, locked until level ${AREA_UNLOCKS[loc]?.level}. Tap and he will say so.`}
          >
            <View style={[styles.glyphPod, { backgroundColor: selected ? color.card : paint.body }]}>
              <DestinationGlyph loc={loc} />
            </View>
            <Text style={styles.destinationLabel} numberOfLines={1}>{LOCATIONS[loc].name.toUpperCase()}</Text>
            {!open && <LockDot />}
            {selected && !vertical && <View style={[styles.destinationEdge, { backgroundColor: paint.edge }]} pointerEvents="none" />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { minHeight: TAP_MIN, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  wallet: { flex: 1 },
  pressed: { transform: [{ scale: 0.975 }] },
  disabled: { opacity: 0.55 },

  bookButton: { width: 58, height: 50, alignItems: 'center', justifyContent: 'center' },
  bookWrap: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  bookBack: { position: 'absolute', width: 38, height: 36, borderRadius: radius.sm, backgroundColor: color.card, transform: [{ rotate: '5deg' }], ...elevation.low },
  book: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: color.violet, borderWidth: 2, borderColor: color.violetDeep, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...elevation.card },
  bookSpine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: space.sm, backgroundColor: color.violetDeep },
  bookWord: { ...type.micro, color: color.ink },
  bookLevel: { ...type.strong, color: color.ink, lineHeight: 18 },
  srLabel: { position: 'absolute', width: 1, height: 1, opacity: 0 },

  planButton: { width: 54, height: 50, alignItems: 'center', justifyContent: 'center' },
  planNote: { width: 42, height: 40, borderRadius: radius.xs, backgroundColor: color.lemon, borderWidth: 2, borderColor: color.lemonDeep, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }], ...elevation.card },
  planDone: { backgroundColor: color.mint, borderColor: color.mintDeep },
  planTape: { position: 'absolute', top: -4, width: 22, height: space.sm, borderRadius: radius.xs, backgroundColor: color.violet, transform: [{ rotate: '4deg' }] },
  planFold: { position: 'absolute', right: 0, top: 0, width: space.md, height: space.md, borderBottomLeftRadius: radius.xs, backgroundColor: color.card, opacity: 0.8 },
  planMini: { ...type.micro, color: color.inkSoft },
  planCount: { ...type.strong, color: color.ink, lineHeight: 18 },

  settings: { width: TAP_MIN, height: TAP_MIN, borderRadius: radius.lg, backgroundColor: color.pop, borderWidth: 2, borderColor: color.popDeep, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, overflow: 'hidden', ...elevation.card },
  settingsGloss: { position: 'absolute', left: space.xs, right: space.xs, top: space.xs, height: space.sm, borderRadius: radius.pill, backgroundColor: color.gloss },
  gearDot: { width: space.xs, height: space.xs, borderRadius: radius.pill, backgroundColor: color.ink },

  destinationTrayVertical: { flexDirection: 'column', flex: 1 },
  /*
   * `flex: 1` because the tray is a ROW OF FOUR and must own the whole row.
   * Without it the tray shrank to its content, the tiles shared ~143px, and
   * BEACH rendered as "BEA..." -- which the visual doc's own acceptance list
   * forbids in as many words ("no destination label truncates").
   */
  destinationTray: { flex: 1, flexDirection: 'row', gap: space.xs, padding: space.xs, borderRadius: radius.lg, backgroundColor: color.fill, borderWidth: 2, borderColor: color.line, overflow: 'visible', ...elevation.toy },
  trayGloss: { position: 'absolute', left: space.md, right: space.md, top: space.xs, height: space.xs, borderRadius: radius.pill, backgroundColor: color.glossSoft },
  destination: { flex: 1, minWidth: 0, minHeight: TAP_MIN, borderRadius: radius.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xxs, paddingVertical: space.xxs, overflow: 'visible' },
  destinationSelected: { transform: [{ translateY: -2 }] },
  glyphPod: { width: 26, height: 26, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginBottom: space.xxs },
  destinationLabel: { ...type.micro, color: color.ink, letterSpacing: 0.6 },
  destinationEdge: { position: 'absolute', left: space.xs, right: space.xs, bottom: -5, height: space.sm, borderBottomLeftRadius: radius.sm, borderBottomRightRadius: radius.sm },
  lockDot: { position: 'absolute', right: -2, top: -4, width: 18, height: 18, borderRadius: radius.pill, backgroundColor: color.inkMid, alignItems: 'center', justifyContent: 'center', ...elevation.low },
});
