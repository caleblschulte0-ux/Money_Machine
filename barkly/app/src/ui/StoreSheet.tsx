/**
 * Barkly's shop, styled like a toy shelf rather than a settings list.
 *
 * The economy stays simple. The cosmetic job of this screen is to make every
 * thing feel like a physical object Barkly could actually own: loud category
 * colors, molded item trays, visible equipped state and a chunky coin pod.
 */

import React, { useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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

/** One number, read by the sheet's own width and by the card grid inside it. */
const STORE_MAX_WIDTH = 700;

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
  const { width } = useWindowDimensions();
  /*
   * A SHOP IS A GRID OF THINGS, not a list of rows.
   *
   * This was a stack of full-width cards: 44px icon on the left, name and
   * blurb in the middle, a price chip on the right. That is the shape of a
   * settings screen, and it is the single most "this is a web page" surface in
   * the app -- on the screen where the player is deciding to spend. Every shop
   * in the reference games puts the OBJECT first: a chunky tile, the art big
   * in the middle of it, the price on a chip at the bottom.
   *
   * The column count comes from the viewport, and the card width is computed
   * from the real content width rather than a percentage, so the gaps stay
   * exact instead of drifting a pixel per card on every different phone.
   */
  const cols = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const contentW = Math.min(width, STORE_MAX_WIDTH) - space.xl * 2;
  const cardW = Math.floor((contentW - space.sm * (cols - 1)) / cols);
  /*
   * Big enough to be the thing you are looking at -- at 0.46 the drawing sat
   * in the middle of its window like a bullet point with room around it.
   *
   * The floor is bounded by the WINDOW, not asserted. A bare `Math.max(54, …)`
   * is a floor that can exceed the box it has to fit in: the window is
   * `(cardW - padding) / 1.16` tall, so below about a 217dp viewport the art
   * would be taller than its own frame and `overflow: 'hidden'` would crop the
   * top and bottom off it. No phone is that narrow today, which is exactly why
   * it would never have been noticed -- the fix is to let it shrink rather
   * than to trust that nothing ever gets small.
   */
  const windowW = cardW - space.sm * 2;
  const artSize = Math.max(
    24,
    Math.min(104, Math.round(cardW * 0.62), Math.floor(windowW / 1.16) - 6),
  );
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

                  <View style={styles.grid}>
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
                          styles.card,
                          { width: cardW, borderColor: worn ? color.ink : slotEdge(slot) },
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
                        <View style={[styles.cardEdge, { backgroundColor: slotEdge(slot) }]} pointerEvents="none" />
                        {/* The art sits in a lit window, the way a toy sits in its box. */}
                        <View style={[styles.cardWindow, { backgroundColor: slotColor(slot) }]}>
                          <View style={styles.cardGloss} pointerEvents="none" />
                          <ItemIcon id={item.id} tint={item.color} size={artSize} />
                          {held > 0 && (
                            <View style={styles.heldTag}><Text style={styles.heldText}>×{held}</Text></View>
                          )}
                        </View>
                        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.cardBlurb} numberOfLines={2}>{item.blurb}</Text>
                        {locked ? (
                          <View style={styles.cardChipQuiet}><Text style={styles.lockTag}>LV {item.level}</Text></View>
                        ) : worn ? (
                          <View style={styles.cardChipOn}><Text style={styles.stateLoudText}>{SLOT_VERBS[item.slot].onState.toUpperCase()}</Text></View>
                        ) : owned && !item.consumable ? (
                          <View style={styles.cardChipQuiet}><Text style={styles.ownedTag}>{SLOT_VERBS[item.slot].offState.toUpperCase()}</Text></View>
                        ) : (
                          <View style={[styles.cardChipPrice, !afford && !devMode && styles.pricePodShort]}>
                            <Text style={[styles.price, !afford && !devMode && styles.priceShort]}>{devMode ? 'FREE' : `${item.price}c`}</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                  </View>
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
    /*
     * The sheet is capped and centred because the GRID is capped: card widths
     * are computed from `Math.min(width, 700)`, and without the same cap here
     * the sheet stretched edge to edge on a tablet while its cards stayed 656
     * wide -- everything shoved into the left two thirds with a quarter of the
     * sheet empty beside it. Two places knowing the same number is the bug;
     * this is the other end of it.
     */
    width: '100%',
    maxWidth: STORE_MAX_WIDTH,
    alignSelf: 'center',
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
  itemPressed: { transform: [{ scale: 0.97 }] },
  itemLocked: { opacity: 0.62 },

  /*
   * The grid. Cards are chunky physical tiles in their category's colour, with
   * the same material recipe as every other control in the game: a moulded
   * lower lip, one gloss highlight, a dark hairline. The art sits in a lit
   * window rather than on the tile, the way a toy sits in its box.
   */
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  /*
   * The CATEGORY COLOUR IS BEHIND THE ART, not behind the words.
   *
   * The first cut painted the whole tile in its category colour, which looked
   * right and failed the contrast harness immediately: 12px body copy on the
   * coral tile measured 3.7:1 against a 4.5 requirement, and dark ink on the
   * violet only reaches about 3.9 -- there is no text colour that passes on a
   * saturated mid-tone at this size. Putting the colour in the window behind
   * the item keeps it as the largest area on the card (so the category still
   * reads across the grid) and leaves the copy on cream, where it clears
   * easily. This is also how the reference shops do it.
   */
  card: {
    borderRadius: radius.lg,
    borderWidth: 2,
    backgroundColor: color.card,
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
    paddingBottom: space.md,
    alignItems: 'center',
    overflow: 'hidden',
    ...elevation.card,
  },
  cardEdge: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 7 },
  cardGloss: { position: 'absolute', left: space.sm, right: space.sm, top: space.xs, height: space.sm, borderRadius: radius.pill, backgroundColor: color.gloss },
  cardWindow: {
    width: '100%',
    aspectRatio: 1.16,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
    overflow: 'hidden',
  },
  heldTag: { position: 'absolute', right: space.xs, bottom: space.xs, paddingHorizontal: space.sm, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: color.ink },
  heldText: { ...type.micro, color: color.paper },
  cardName: { ...type.strong, color: color.ink, textAlign: 'center' },
  cardBlurb: { ...type.caption, color: color.inkSoft, textAlign: 'center', marginTop: space.xxs, marginBottom: space.sm, minHeight: 28 },
  cardChipQuiet: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: color.fill },
  cardChipOn: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: color.ink },
  cardChipPrice: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: color.lemon, borderWidth: 1.5, borderColor: color.lemonDeep },
  stateLoudText: { ...type.micro, color: color.paper },
  pricePodShort: { backgroundColor: color.fill, borderColor: color.line },
  price: { ...type.strong, color: color.goldInk },
  priceShort: { color: color.inkSoft },
  lockTag: { ...type.caption, fontWeight: '900', color: color.inkMid },
  ownedTag: { ...type.micro, color: color.inkMid },
  note: { marginTop: space.lg, ...type.caption, color: color.inkSoft },

  /*
   * `flex: 1` with no ceiling. In the HUD that is fine -- the wallet wrapper
   * caps it at 250 -- but the shop header has no such wrapper, so on a wide
   * sheet the pill stretched to ~450px and the level bar inside it became a
   * thin rule running most of the header. A control should not change species
   * with the viewport.
   */
  pill: { flex: 1, minWidth: 124, maxWidth: 260, minHeight: TAP_MIN, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, borderRadius: radius.pill, overflow: 'visible', ...elevation.toy },
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
