import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import ItemIcon, { BowlIcon } from './ItemIcon';
import { color, elevation, glyph, radius, space, type } from './theme';
import { TAP_MIN } from './layout';
import { STORE, Wallet } from '../game/progression';

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

export default function FoodSheet({ visible, onClose, wallet, hungry, onFeed, onOpenShop }: Props) {
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
        <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
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

          <Pressable
            style={({ pressed }) => [styles.meal, pressed && styles.pressed]}
            onPress={() => choose()}
            accessibilityRole="button"
            accessibilityLabel="Regular dinner"
            accessibilityHint="Feed him his ordinary food."
          >
            <View style={[styles.itemRail, { backgroundColor: color.pop }]} pointerEvents="none" />
            <View style={[styles.iconWell, { backgroundColor: color.fill }]}>
              <View style={styles.iconGloss} pointerEvents="none" />
              <BowlIcon />
            </View>
            <View style={styles.copy}>
              <Text style={styles.name}>Regular dinner</Text>
              <Text style={styles.detail}>The dependable option. He will survive the indignity.</Text>
            </View>
            <View style={styles.goPod}><Text style={styles.go}>›</Text></View>
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
                    <View style={[styles.iconWell, { backgroundColor: accent }]}>
                      <View style={styles.iconGloss} pointerEvents="none" />
                      <ItemIcon id={item.id} tint={item.color} />
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
  iconWell: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  iconGloss: { position: 'absolute', left: 7, right: 7, top: 5, height: 7, borderRadius: radius.pill, backgroundColor: color.gloss, opacity: 0.65 },
  copy: { flex: 1, marginLeft: space.md },
  name: { ...type.strong, fontWeight: '900', color: color.ink },
  detail: { marginTop: space.xs, ...type.caption, color: color.inkMid },
  goPod: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: color.fill, alignItems: 'center', justifyContent: 'center' },
  go: { fontSize: glyph.arrow, lineHeight: 30, color: color.ink },
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
