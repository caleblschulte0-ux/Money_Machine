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

import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ItemSlot,
  levelProgress,
  StoreItem,
  storeFor,
  Wallet,
} from '../game/progression';

const INK = '#3E332A';
const INK_SOFT = '#7A6A55';
const CARD = '#FFFDF7';
const COIN = '#C9A227';

interface Props {
  visible: boolean;
  onClose: () => void;
  wallet: Wallet;
  onBuy: (itemId: string) => { ok: boolean; line: string };
  onEquip: (itemId: string) => void;
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

export default function StoreSheet({ visible, onClose, wallet, onBuy, onEquip }: Props) {
  const [flash, setFlash] = useState<string | null>(null);
  const progress = levelProgress(wallet.xp);
  const shelf = storeFor(progress.level);

  const press = (item: StoreItem, locked: boolean, owned: boolean) => {
    if (locked) {
      setFlash(`Level ${item.level} unlocks this one.`);
      return;
    }
    if (owned && !item.consumable) {
      onEquip(item.id);
      setFlash(`${item.name} on.`);
      return;
    }
    setFlash(onBuy(item.id).line);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Shop</Text>
            <CoinPill coins={wallet.coins} level={progress.level} frac={progress.frac} />
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

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
                    const worn = wallet.equipped[item.slot] === item.id;
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
                              ? `${item.name}, owned${worn ? ', currently worn' : ''}. Tap to wear.`
                              : `${item.name}, ${item.price} coins. ${afford ? '' : 'Not enough coins.'}`
                        }
                      >
                        <Text style={styles.icon}>{item.icon}</Text>
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
                          <Text style={styles.wornTag}>worn</Text>
                        ) : owned && !item.consumable ? (
                          <Text style={styles.ownedTag}>owned</Text>
                        ) : (
                          <Text style={[styles.price, !afford && styles.priceShort]}>{item.price}c</Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}

            <Text style={styles.note}>
              Coins come from looking after him — feeding him when he is hungry, playing when he has
              the energy, fetch, digging, and turning up each day. There is nothing to buy with real
              money.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(40,32,22,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#F6EEDC', borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '90%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  title: { fontSize: 22, fontWeight: '800', color: INK },
  close: { fontSize: 20, color: INK_SOFT, paddingHorizontal: 4 },
  flash: {
    marginHorizontal: 20,
    marginBottom: 6,
    fontSize: 14,
    color: '#5C4F3E',
    backgroundColor: '#EDE1C8',
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
    color: '#A8987C',
    textTransform: 'uppercase',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemLocked: { opacity: 0.55 },
  itemWorn: { borderColor: '#C9A227' },
  icon: { fontSize: 26 },
  itemText: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '700', color: INK },
  itemBlurb: { fontSize: 13, color: INK_SOFT, marginTop: 2 },
  price: { fontSize: 15, fontWeight: '800', color: COIN },
  priceShort: { color: '#B09A6A' },
  lockTag: { fontSize: 13, fontWeight: '700', color: INK_SOFT },
  ownedTag: { fontSize: 13, fontWeight: '700', color: '#4E7A46' },
  wornTag: { fontSize: 13, fontWeight: '800', color: '#8A6B1E' },
  note: { marginTop: 20, fontSize: 12, lineHeight: 18, color: '#9A8F7A' },

  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CARD,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  coin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinMark: { fontSize: 12, fontWeight: '900', color: '#6B5310' },
  coinCount: { fontSize: 16, fontWeight: '800', color: INK },
  levelWrap: { flex: 1, alignItems: 'flex-end' },
  levelText: { fontSize: 11, fontWeight: '700', color: INK_SOFT },
  levelTrack: {
    width: '100%',
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E4D8BE',
    marginTop: 3,
    overflow: 'hidden',
  },
  levelFill: { height: 5, borderRadius: 3, backgroundColor: COIN },
});
