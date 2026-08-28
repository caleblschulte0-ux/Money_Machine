/**
 * The shop.
 *
 * Locked items are SHOWN, greyed, with the level they need on them — the lock
 * is the goal, and hiding it means there is nothing to want. Every price is
 * payable with coins earned by looking after him; nothing here reads a card.
 *
 * Barkly reacts to every purchase and every refusal in his own voice (the
 * lines live with the store data), which is what stops this feeling like a
 * transaction screen bolted onto a pet.
 */

import React, { useEffect, useRef, useState } from 'react';
import ItemIcon from './ItemIcon';
import { color, radius } from './theme';
import { TAP_MIN } from './layout';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  /** Every gate open, and the shelf says so rather than pretending. */
  devMode?: boolean;
}

const SLOT_ORDER: ItemSlot[] = ['collar', 'treat', 'toy', 'home'];
const SLOT_LABEL: Record<ItemSlot, string> = {
  collar: 'Collars',
  treat: 'Food',
  toy: 'Toys',
  home: 'His place',
};

export function CoinPill({ coins, level, frac }: { coins: number; level: number; frac: number }) {
  return (
    <View style={styles.pill}>
      <View style={styles.coin}>
        <Text style={styles.coinMark}>c</Text>
      </View>
      <Text style={styles.coinCount}>{coins}</Text>
      <View style={styles.levelWrap}>
        <Text style={styles.levelText}>Lv {level}</Text>
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

  /**
   * Say something for a few seconds. The old flash was set and never cleared,
   * so "Proper bed is out." sat at the top of the shop for the rest of the
   * session, describing a tap you made ten purchases ago.
   */
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

  /**
   * What tapping a row does, and what it says afterwards.
   *
   * Every state used to end in "wear": the accessibility label offered to let
   * you WEAR A BED, and tapping the collar he already had on flashed
   * "Red collar on." at a dog wearing it — a dead tap with a confident
   * message. The verbs come from the slot now (SLOT_VERBS), and an item that
   * is on can be taken off.
   */
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
            {/*
        Tapping the dimmed area closes the sheet.

        Five bottom sheets shipped without it. The backdrop looks tappable,
        every other app on the phone behaves that way, and the only way out was
        a 15px ✕ in the corner — which is also the smallest tap target in the
        app. `accessible={false}` keeps it out of the screen-reader order; the
        ✕ is the labelled way out.
      */}
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Shop</Text>
            <CoinPill coins={wallet.coins} level={progress.level} frac={progress.frac} />
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          {devMode && (
            <Text style={styles.devBanner}>Dev mode: everything unlocked and free.</Text>
          )}

          {flash && (
            <Text style={styles.flash} accessibilityLiveRegion="polite">
              {flash}
            </Text>
          )}

          <ScrollView contentContainerStyle={styles.body}>
            {SLOT_ORDER.map((slot) => {
              const rows = shelf.filter((s) => s.item.slot === slot);
              if (rows.length === 0) return null;
              return (
                <View key={slot}>
                  <Text style={styles.section}>{SLOT_LABEL[slot]}</Text>
                  {rows.map(({ item, locked }) => {
                    const owned = wallet.owned.includes(item.id);
                    const held = wallet.pantry[item.id] ?? 0;
                    const worn = isPlaced(wallet, item.id);
                    const multi = isMultiSlot(item.slot);
                    const afford = wallet.coins >= item.price;
                    return (
                      <Pressable
                        key={item.id}
                        style={[styles.item, locked && styles.itemLocked, worn && styles.itemWorn]}
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
                        <View style={styles.icon}><ItemIcon id={item.id} tint={item.color} /></View>
                        <View style={styles.itemText}>
                          <Text style={styles.itemName}>
                            {item.name}
                            {held > 0 ? `  ×${held}` : ''}
                          </Text>
                          <Text style={styles.itemBlurb}>{item.blurb}</Text>
                        </View>
                        {/* Never colour alone: the state is always a word. */}
                        {locked ? (
                          <Text style={styles.lockTag}>Lv {item.level}</Text>
                        ) : worn ? (
                          <Text style={styles.wornTag}>{SLOT_VERBS[item.slot].onState}</Text>
                        ) : owned && !item.consumable ? (
                          <Text style={styles.ownedTag}>{SLOT_VERBS[item.slot].offState}</Text>
                        ) : (
                          <Text style={[styles.price, !afford && !devMode && styles.priceShort]}>
                            {devMode ? 'free' : `${item.price}c`}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}

            <Text style={styles.note}>
              His place holds everything at once — a bed AND a rug AND a window. Collars and toys
              are one at a time. Tap anything you already own to put it on or take it off again.
            </Text>
            <Text style={styles.note}>
              Coins come from looking after him — feeding him when he is hungry, playing when he has
              the energy, fetch, digging, and turning up each day. There is nothing to buy with real
              money.
            </Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(40,32,22,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: color.well, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '90%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  title: { fontSize: 24, fontWeight: '800', color: color.ink },
  /**
   * The way out of a sheet, at a real tap size.
   *
   * Seven sheets each declared this separately and every one of them measured
   * about 23x22 — a 15-18px glyph with 4px of padding. Six of the seven even
   * carried a comment saying the X was "the labelled way out", which was true
   * and beside the point: it was the smallest target in the app, on the
   * control a child needs when they are stuck. layout.TAP_MIN, like the rest.
   */
  close: { fontSize: 18, lineHeight: TAP_MIN, width: TAP_MIN, height: TAP_MIN, textAlign: 'center', color: color.inkSoft },
  flash: {
    marginHorizontal: 20,
    marginBottom: 6,
    fontSize: 13,
    color: color.inkMid,
    backgroundColor: color.fill,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  body: { paddingHorizontal: 20, paddingBottom: 34 },
  section: {
    marginTop: 16,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: color.inkSoft,
    textTransform: 'uppercase',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: color.card,
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemLocked: { opacity: 0.55 },
  itemWorn: { borderColor: color.gold },
  /**
   * A well behind each drawing. Every row now starts with the same 40px round
   * anchor, which is what makes a list of eleven different shapes scan as one
   * list rather than eleven loose objects at eleven apparent sizes.
   */
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: color.well,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '700', color: color.ink },
  itemBlurb: { fontSize: 13, color: color.inkSoft, marginTop: 2 },
  // goldInk, not color.gold. color.gold is `color.gold` — the disc and the XP bar — and
  // aliasing it to a local name is how it slipped past both the colour sweep
  // and the contrast test's source scan while measuring 2.38:1 on every price
  // in the shop. See __tests__/design_system.test.ts, which now bans the alias.
  price: { fontSize: 15, fontWeight: '800', color: color.goldInk },
  priceShort: { color: color.inkSoft },
  lockTag: { fontSize: 13, fontWeight: '700', color: color.inkSoft },
  ownedTag: { fontSize: 13, fontWeight: '700', color: color.good },
  wornTag: { fontSize: 13, fontWeight: '800', color: color.goldInk },
  devBanner: {
    marginHorizontal: 20,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '800',
    color: color.goldInk,
    backgroundColor: color.goldWell,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  note: { marginTop: 20, fontSize: 12, lineHeight: 18, color: color.inkSoft },

  pill: {
    flex: 1,
    // At 360px the wordmark and the three header buttons left this about 70px
    // wide, and the coin count printed straight through "Lv 1". The pill gets
    // a floor; the wordmark beside it is what gives way.
    minWidth: 124,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: color.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    // 44 tall, because in the room this pill IS the shop button. See
    // layout.TAP_MIN — hitSlop does not exist on React Native Web.
    minHeight: TAP_MIN,
  },
  coin: {
    width: 20,
    height: 20,
    borderRadius: 12,
    backgroundColor: color.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `ink`, not `goldInk`: the mark sits ON the gold disc, not on paper, and
  // goldInk against gold measures 2.74:1. It is the one place in the app where
  // the readable-gold token is the wrong gold.
  coinMark: { fontSize: 12, fontWeight: '900', color: color.ink },
  coinCount: { fontSize: 15, fontWeight: '800', color: color.ink, flexShrink: 0 },
  levelWrap: { flex: 1, minWidth: 40, alignItems: 'flex-end' },
  levelText: { fontSize: 12, fontWeight: '700', color: color.inkSoft },
  levelTrack: {
    width: '100%',
    height: 5,
    borderRadius: 8,
    backgroundColor: color.line,
    marginTop: 3,
    overflow: 'hidden',
  },
  levelFill: { height: 5, borderRadius: 8, backgroundColor: color.gold },
});
