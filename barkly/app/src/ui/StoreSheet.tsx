/**
 * Barkly's shop, styled like a toy shelf rather than a settings list.
 *
 * The economy stays simple. The cosmetic job of this screen is to make every
 * thing feel like a physical object Barkly could actually own: loud category
 * colors, molded item trays, visible equipped state and a chunky coin pod.
 */

import React, { useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ItemIcon from './ItemIcon';
import { color, elevation, radius, space, type } from './theme';
import { TAP_MIN } from './layout';
import {
  isMultiSlot,
  SLOT_VERBS,
  isPlaced,
  ItemSlot,
  levelProgress,
  StoreItem,
  storeFor,
  Wallet,
} from '../game/progression';

interface Props {
  visible: boolean;
  onClose: () => void;
  wallet: Wallet;
  onBuy: (itemId: string) => { ok: boolean; line: string };
  onEquip: (itemId: string) => void;
  devMode?: boolean;
}

const SLOT_ORDER: ItemSlot[] = ['collar', 'treat', 'toy', 'home'];
const SLOT_LABEL: Record<ItemSlot, string> = {
  collar: 'Collars',
  treat: 'Snacks',
  toy: 'Toys',
  home: 'His Place',
};

function slotColor(slot: ItemSlot): string {
  if (slot === 'collar') return color.violet;
  if (slot === 'treat') return color.coral;
  if (slot === 'toy') return color.pop;
  return color.mint;
}

function slotEdge(slot: ItemSlot): string {
  if (slot === 'collar') return color.violetDeep;
  if (slot === 'treat') return color.coralDeep;
  if (slot === 'toy') return color.popDeep;
  return color.mintDeep;
}

export function CoinPill({ coins, level, frac }: { coins: number; level: number; frac: number }) {
  return (
    <View style={styles.pill}>
      <LinearGradient
        colors={[color.lemon, color.goldWell]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pillFill}
        pointerEvents="none"
      />
      <View style={styles.pillGloss} pointerEvents="none" />
      <View style={styles.pillEdge} pointerEvents="none" />
      <View style={styles.coin}>
        <Text style={styles.coinMark}>c</Text>
      </View>
      <Text style={styles.coinCount}>{coins}</Text>
      <View style={styles.levelWrap}>
        <Text style={styles.levelText}>LV {level}</Text>
        <View style={styles.levelTrack}>
          <View style={[styles.levelFill, { width: `${Math.round(frac * 100)}%` }]} />
        </View>
      </View>
    </View>
  );
}

export default function StoreSheet({ visible, onClose, wallet, onBuy, onEquip, devMode }: Props) {
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = (line: string) => {
    setFlash(line);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 3400);
  };

  useEffect(() => {
    if (!visible) {
      setFlash(null);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    }
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, [visible]);

  const progress = levelProgress(wallet.xp);
  const shelf = storeFor(progress.level, devMode);

  const press = (item: StoreItem, locked: boolean, owned: boolean) => {
    if (locked) {
      say(`Level ${item.level} unlocks this one. You're level ${progress.level}.`);
      return;
    }
    if (owned && !item.consumable) {
      const wasOut = isPlaced(wallet, item.id);
      onEquip(item.id);
      const v = SLOT_VERBS[item.slot];
      say(wasOut ? `${item.name}: ${v.offState}.` : `${item.name}: ${v.onState}.`);
      return;
    }
    say(onBuy(item.id).line);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
          <LinearGradient
            colors={[color.violet, color.fill]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
            pointerEvents="none"
          />
          <View style={styles.heroGloss} pointerEvents="none" />

          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <Text style={styles.eyebrow}>BARKLY'S</Text>
              <Text style={styles.title}>STUFF</Text>
            </View>
            <CoinPill coins={wallet.coins} level={progress.level} frac={progress.frac} />
            <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          {devMode && <Text style={styles.devBanner}>DEV · EVERYTHING OPEN</Text>}
          {flash && <Text style={styles.flash} accessibilityLiveRegion="polite">{flash}</Text>}

          <ScrollView contentContainerStyle={styles.body}>
            {SLOT_ORDER.map((slot) => {
              const rows = shelf.filter((s) => s.item.slot === slot);
              if (rows.length === 0) return null;
              return (
                <View key={slot} style={styles.sectionWrap}>
                  <View style={[styles.sectionTab, { backgroundColor: slotColor(slot) }]}>
                    <Text style={styles.section}>{SLOT_LABEL[slot]}</Text>
                  </View>

                  {rows.map(({ item, locked }) => {
                    const owned = wallet.owned.includes(item.id);
                    const held = wallet.pantry[item.id] ?? 0;
                    const worn = isPlaced(wallet, item.id);
                    const afford = wallet.coins >= item.price;
                    void isMultiSlot(item.slot);
                    return (
                      <Pressable
                        key={item.id}
                        style={({ pressed }) => [
                          styles.item,
                          { borderColor: worn ? slotEdge(slot) : color.line },
                          locked && styles.itemLocked,
                          pressed && styles.itemPressed,
                        ]}
                        onPress={() => press(item, locked, owned)}
                        accessibilityRole="button"
                        accessibilityLabel={
                          locked
                            ? `${item.name}, locked until level ${item.level}`
                            : owned && !item.consumable
                              ? `${item.name}. ${worn ? SLOT_VERBS[item.slot].onState : SLOT_VERBS[item.slot].offState}. Tap to ${
                                  worn ? SLOT_VERBS[item.slot].off : SLOT_VERBS[item.slot].on
                                }.`
                              : `${item.name}, ${item.price} coins.${afford || devMode ? '' : ' Not enough coins.'}`
                        }
                        accessibilityState={{ disabled: locked }}
                      >
                        <View style={[styles.itemRail, { backgroundColor: slotColor(slot) }]} pointerEvents="none" />
                        <View style={[styles.icon, { backgroundColor: slotColor(slot) }]}>
                          <View style={styles.iconGloss} pointerEvents="none" />
                          <ItemIcon id={item.id} tint={item.color} />
                        </View>
                        <View style={styles.itemText}>
                          <Text style={styles.itemName}>
                            {item.name}{held > 0 ? `  ×${held}` : ''}
                          </Text>
                          <Text style={styles.itemBlurb}>{item.blurb}</Text>
                        </View>
                        {locked ? (
                          <View style={styles.stateQuiet}><Text style={styles.lockTag}>LV {item.level}</Text></View>
                        ) : worn ? (
                          <View style={[styles.stateLoud, { backgroundColor: slotColor(slot) }]}><Text style={styles.stateLoudText}>{SLOT_VERBS[item.slot].onState.toUpperCase()}</Text></View>
                        ) : owned && !item.consumable ? (
                          <View style={styles.stateQuiet}><Text style={styles.ownedTag}>{SLOT_VERBS[item.slot].offState.toUpperCase()}</Text></View>
                        ) : (
                          <View style={[styles.pricePod, !afford && !devMode && styles.pricePodShort]}>
                            <Text style={[styles.price, !afford && !devMode && styles.priceShort]}>{devMode ? 'FREE' : `${item.price}c`}</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}

            <Text style={styles.note}>Everything you buy should show up in Barkly's life. Home stuff stacks; collars and toys swap.</Text>
            <Text style={styles.note}>Coins come from doing things with him. No real-money store.</Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: color.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: color.paper,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
    overflow: 'hidden',
    ...elevation.sheet,
  },
  hero: { position: 'absolute', left: 0, right: 0, top: 0, height: 118 },
  heroGloss: { position: 'absolute', left: space.xl, right: space.xl, top: space.sm, height: space.md, borderRadius: radius.pill, backgroundColor: color.glossSoft },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.md },
  titleWrap: { minWidth: 76 },
  eyebrow: { ...type.micro, color: color.inkMid },
  title: { ...type.display, color: color.ink },
  closeButton: { width: TAP_MIN, height: TAP_MIN, borderRadius: radius.pill, backgroundColor: color.card, alignItems: 'center', justifyContent: 'center', ...elevation.low },
  close: { fontSize: 18, lineHeight: TAP_MIN, width: TAP_MIN, height: TAP_MIN, textAlign: 'center', color: color.inkSoft },
  flash: { marginHorizontal: space.xl, marginBottom: space.sm, ...type.small, fontWeight: '700', color: color.inkMid, backgroundColor: color.lemon, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm, overflow: 'hidden' },
  devBanner: { marginHorizontal: space.xl, marginBottom: space.sm, ...type.caption, fontWeight: '900', color: color.ink, backgroundColor: color.coral, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm, overflow: 'hidden' },
  body: { paddingHorizontal: space.xl, paddingBottom: 34, paddingTop: space.xs },
  sectionWrap: { marginTop: space.lg },
  sectionTab: { alignSelf: 'flex-start', paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, marginBottom: space.sm, ...elevation.low },
  section: { ...type.caption, fontWeight: '900', letterSpacing: 1.1, color: color.ink, textTransform: 'uppercase' },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: color.card, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, borderWidth: 2, overflow: 'hidden', ...elevation.low },
  itemPressed: { transform: [{ scale: 0.985 }] },
  itemLocked: { opacity: 0.55 },
  itemRail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: space.xs },
  icon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  iconGloss: { position: 'absolute', left: space.xs, right: space.xs, top: space.xs, height: space.sm, borderRadius: radius.pill, backgroundColor: color.gloss },
  itemText: { flex: 1 },
  itemName: { ...type.strong, color: color.ink },
  itemBlurb: { ...type.small, color: color.inkSoft, marginTop: space.xxs },
  stateQuiet: { paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: color.fill },
  stateLoud: { paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.pill },
  stateLoudText: { ...type.micro, color: color.ink },
  pricePod: { paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: color.lemon },
  pricePodShort: { backgroundColor: color.fill },
  price: { ...type.strong, color: color.goldInk },
  priceShort: { color: color.inkSoft },
  lockTag: { ...type.caption, fontWeight: '800', color: color.inkSoft },
  ownedTag: { ...type.micro, color: color.good },
  note: { marginTop: space.lg, ...type.caption, color: color.inkSoft },

  pill: { flex: 1, minWidth: 124, minHeight: TAP_MIN, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, borderRadius: radius.pill, overflow: 'visible', ...elevation.toy },
  pillFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: radius.pill },
  pillGloss: { position: 'absolute', left: space.sm, right: space.sm, top: space.xs, height: space.sm, borderRadius: radius.pill, backgroundColor: color.gloss },
  // The moulded lower lip sits INSIDE the pill. At bottom:-4 it hung below the
  // body, and in the header the tab bar sliced straight through it -- a thick
  // yellow band with a cut edge, which read as a rendering fault rather than
  // as depth. Flush with the bottom it matches the same lip on the Pack and
  // Settings buttons, so the whole chrome row is one material.
  pillEdge: { position: 'absolute', left: space.sm, right: space.sm, bottom: 0, height: 5, borderRadius: radius.pill, backgroundColor: color.lemonDeep },
  coin: { width: 26, height: 26, borderRadius: radius.pill, backgroundColor: color.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: color.goldInk },
  coinMark: { ...type.caption, fontWeight: '900', color: color.ink },
  coinCount: { ...type.strong, fontWeight: '900', color: color.ink, flexShrink: 0 },
  levelWrap: { flex: 1, minWidth: 40, alignItems: 'flex-end' },
  levelText: { ...type.caption, fontWeight: '900', color: color.inkSoft },
  levelTrack: { width: '100%', height: 5, borderRadius: radius.xs, backgroundColor: color.card, marginTop: space.xxs, overflow: 'hidden' },
  levelFill: { height: 5, borderRadius: radius.xs, backgroundColor: color.brand },
});
