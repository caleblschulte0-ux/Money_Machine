import React from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ItemIcon, { BowlIcon, ItemStand } from './ItemIcon';
import { color, elevation, glyph, radius, space, type } from './theme';
import { TAP_MIN } from './layout';
import { STORE, Wallet } from '../game/progression';
import { useAmbientLoop, useReduceMotion } from './motion';
import { SheetScrim, useSheetBounds } from './sheetStage';

interface Props {
  visible: boolean;
  onClose: () => void;
  wallet: Wallet;
  hungry: boolean;
  onFeed: (itemId?: string) => void;
  onOpenShop: () => void;
}

function treatSurface(index: number): string {
  if (index % 3 === 0) return color.coral;
  if (index % 3 === 1) return color.lemon;
  return color.violet;
}

/**
 * The pale glass the treat stands on. The accent stays on the rail down the
 * left edge and on the border; it came off the ground under the object once
 * the treats became renders, which measured as low as 1.38:1 on full lemon.
 */
function treatPane(index: number): string {
  if (index % 3 === 0) return color.coralPane;
  if (index % 3 === 1) return color.lemonPane;
  return color.violetPane;
}

/**
 * The food is ALIVE in the tray before you pick it.
 *
 * Every row of this sheet was a still icon in a coloured well, which reads as a
 * spreadsheet of things you own rather than as dinner. The bob is small on
 * purpose -- three pixels and a couple of degrees -- and each row is offset so
 * they never swing in unison, which is what makes a row of moving things look
 * mechanical.
 *
 * The loop comes from ui/motion so this honours the device's reduce-motion
 * setting through the same code the world does, rather than a second copy of it
 * that someone forgets to keep in step. The SETTING is read once by the sheet
 * and passed down -- read per icon it would register one accessibility listener
 * per row, which is four subscriptions to answer the same question.
 */
function FloatingIcon({ index, still, children }: { index: number; still: boolean; children: React.ReactNode }) {
  const bob = useAmbientLoop(2200 + index * 180, index * 320, still);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        transform: [
          { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [2, -3] }) },
          { rotate: bob.interpolate({ inputRange: [0, 1], outputRange: ['-2.4deg', '2.4deg'] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

export default function FoodSheet({ visible, onClose, wallet, hungry, onFeed, onOpenShop }: Props) {
  const reduceMotion = useReduceMotion();
  const bounds = useSheetBounds();
  const treats = STORE.filter((item) => item.slot === 'treat')
    .map((item) => ({ item, count: wallet.pantry[item.id] ?? 0 }))
    .filter((row) => row.count > 0);

  const choose = (itemId?: string) => {
    onClose();
    onFeed(itemId);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        <SheetScrim />
        <Pressable style={[styles.sheet, bounds]} testID="sheet-panel" onPress={() => {}} accessible={false}>
          <View style={styles.hero} pointerEvents="none">
            <View style={styles.heroGloss} />
            <View style={styles.heroEdge} />
          </View>

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>BARKLY'S BOWL</Text>
              <Text style={styles.title}>{hungry ? 'Pick dinner.' : 'Snack negotiations.'}</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close food">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              style={({ pressed }) => [styles.meal, pressed && styles.pressed]}
              onPress={() => choose()}
              accessibilityRole="button"
              accessibilityLabel="Regular dinner"
              accessibilityHint="Feed him his ordinary food."
            >
              <View style={[styles.itemRail, { backgroundColor: color.pop }]} pointerEvents="none" />
              <View style={[styles.iconWell, { backgroundColor: color.popPane, borderColor: color.pop }]}>
                <View style={styles.iconStand} pointerEvents="none"><ItemStand width={34} /></View>
                <FloatingIcon index={0} still={reduceMotion}><BowlIcon /></FloatingIcon>
              </View>
              <View style={styles.copy}>
                <Text style={styles.name}>Regular dinner</Text>
                <Text style={styles.detail}>The dependable option. He will survive the indignity.</Text>
              </View>
              <View style={styles.feedPod}>
                <View style={styles.feedGloss} pointerEvents="none" />
                <Text style={styles.feedWord}>FEED</Text>
              </View>
            </Pressable>

            <View style={styles.sectionTab}><Text style={styles.section}>THE GOOD STUFF</Text></View>

            {treats.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyRail} pointerEvents="none" />
                <Text style={styles.emptyTitle}>Cupboard's empty.</Text>
                <Text style={styles.emptyText}>Biscuits, cheese and the unreasonable steak are over in Barkly's Stuff.</Text>
                <Pressable
                  style={({ pressed }) => [styles.emptyCta, pressed && styles.pressed]}
                  onPress={() => { onClose(); onOpenShop(); }}
                  accessibilityRole="button"
                  accessibilityLabel="Go to the shop"
                  accessibilityHint="Buy treats for him."
                >
                  <Text style={styles.emptyCtaText}>GET SNACKS</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.treatGrid}>
                {treats.map(({ item, count }, index) => {
                  const accent = treatSurface(index);
                  return (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [styles.treat, pressed && styles.pressed]}
                      onPress={() => choose(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.name}, ${count} left`}
                      accessibilityHint="Give him this instead of dinner."
                    >
                      <View style={[styles.itemRail, { backgroundColor: accent }]} pointerEvents="none" />
                      <View style={[styles.iconWell, { backgroundColor: treatPane(index), borderColor: accent }]}>
                        <View style={styles.iconStand} pointerEvents="none"><ItemStand width={34} /></View>
                        <FloatingIcon index={index + 1} still={reduceMotion}><ItemIcon id={item.id} tint={item.color} /></FloatingIcon>
                      </View>
                      <View style={styles.copy}>
                        <Text style={styles.name}>{item.name}</Text>
                        <Text style={styles.detail}>{item.blurb}</Text>
                      </View>
                      <View style={styles.countPod}><Text style={styles.count}>×{count}</Text></View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  // The tray scrolls; the header and the hero band do not, so 'Barkly's bowl'
  // stays put while four treats move under it.
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: space.xs },
  sheet: {
    backgroundColor: color.paper,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingBottom: space.xxl,
    overflow: 'hidden',
    ...elevation.sheet,
  },
  hero: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 116,
    backgroundColor: color.coral,
  },
  heroGloss: {
    position: 'absolute',
    left: space.xl,
    right: 92,
    top: space.sm,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: color.glossSoft,
  },
  heroEdge: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 7, backgroundColor: color.coralDeep },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md, paddingTop: space.lg, paddingBottom: space.lg },
  headerCopy: { flex: 1 },
  eyebrow: { ...type.micro, color: color.ink, opacity: 0.78 },
  title: { marginTop: space.xs, maxWidth: 300, ...type.display, color: color.ink },
  closeButton: { width: TAP_MIN, height: TAP_MIN, borderRadius: radius.pill, backgroundColor: color.card, alignItems: 'center', justifyContent: 'center', ...elevation.low },
  close: { fontSize: glyph.close, lineHeight: TAP_MIN, width: TAP_MIN, height: TAP_MIN, textAlign: 'center', color: color.inkSoft },

  meal: {
    minHeight: 84,
    borderRadius: radius.md,
    padding: space.md,
    backgroundColor: color.card,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: color.line,
    ...elevation.card,
  },
  sectionTab: { alignSelf: 'flex-start', marginTop: space.xl, marginBottom: space.sm, backgroundColor: color.violet, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.sm, ...elevation.low },
  section: { ...type.micro, color: color.ink },
  treatGrid: { gap: space.sm },
  treat: {
    minHeight: 80,
    borderRadius: radius.md,
    padding: space.md,
    backgroundColor: color.card,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: color.line,
    ...elevation.low,
  },
  itemRail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  iconWell: { width: 52, height: 52, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  /** The shadow the treat stands on, so it sits in the well rather than on it. */
  iconStand: { position: 'absolute', left: 0, right: 0, bottom: 6, alignItems: 'center' },
  copy: { flex: 1, marginLeft: space.md },
  name: { ...type.strong, fontWeight: '900', color: color.ink },
  detail: { marginTop: space.xs, ...type.caption, color: color.inkMid },
  /*
   * A CHEVRON IS A PROMISE OF ANOTHER SCREEN.
   *
   * This row does not navigate anywhere -- tapping it FEEDS HIM, immediately
   * and irreversibly, and then the sheet closes. A pale `›` in a circle is the
   * iOS list disclosure affordance and it was telling a child the opposite of
   * what the control does. It is also exactly the "large dead white card" and
   * the flat-fill-plus-radius that docs/VISUAL_DIRECTION_KIDS_GAME.md rules
   * out in the same breath.
   *
   * A word and a body with a lower edge instead: it says what happens, and it
   * has the highlight/body/darker-edge depth the same doc asks of every tap
   * target that matters.
   */
  feedPod: {
    minWidth: 62,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: color.pop,
    borderBottomWidth: 3,
    borderBottomColor: color.popDeep,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  feedGloss: { position: 'absolute', top: 3, left: 8, right: 8, height: 8, borderRadius: radius.pill, backgroundColor: color.paper, opacity: 0.4 },
  feedWord: { ...type.micro, fontWeight: '900', color: color.ink },
  countPod: { minWidth: 38, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: space.sm, backgroundColor: color.lemon, alignItems: 'center' },
  count: { ...type.caption, fontWeight: '900', color: color.ink },

  empty: { borderRadius: radius.md, borderWidth: 2, borderColor: color.line, backgroundColor: color.card, padding: space.lg, overflow: 'hidden', ...elevation.low },
  emptyRail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: color.violet },
  emptyTitle: { ...type.strong, color: color.ink },
  emptyText: { marginTop: space.xs, ...type.small, color: color.inkSoft },
  emptyCta: { alignSelf: 'flex-start', marginTop: space.md, paddingHorizontal: space.lg, minHeight: TAP_MIN, borderRadius: radius.md, backgroundColor: color.violet, alignItems: 'center', justifyContent: 'center', ...elevation.low },
  emptyCtaText: { ...type.caption, fontWeight: '900', color: color.ink },
  pressed: { transform: [{ scale: 0.985 }] },
});
