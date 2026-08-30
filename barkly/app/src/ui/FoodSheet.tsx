import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
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
          <LinearGradient colors={[color.coral, color.lemon]} style={styles.hero} pointerEvents="none" />
          <View style={styles.heroGloss} pointerEvents="none" />

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <View style={styles.kicker}><Text style={styles.eyebrow}>FOOD SITUATION</Text></View>
              <Text style={styles.title}>{hungry ? 'Barkly is taking offers.' : 'He claims he can wait.'}</Text>
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
            <View style={styles.mealGloss} pointerEvents="none" />
            <View style={styles.iconBubbleMeal}><BowlIcon /></View>
            <View style={styles.copy}>
              <Text style={styles.name}>Regular dinner</Text>
              <Text style={styles.detail}>Reliable. Nutritionally uninteresting. Apparently acceptable.</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>

          <View style={styles.sectionPod}><Text style={styles.section}>THE GOOD STUFF</Text></View>

          {treats.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Cupboard's empty.</Text>
              <Text style={styles.emptyText}>Biscuits, cheese and eventually an unreasonable steak live in the shop.</Text>
              <Pressable
                style={({ pressed }) => [styles.emptyCta, pressed && styles.pressed]}
                onPress={() => {
                  onClose();
                  onOpenShop();
                }}
                accessibilityRole="button"
                accessibilityLabel="Go to the shop"
                accessibilityHint="Buy treats for him."
              >
                <View style={styles.ctaGloss} pointerEvents="none" />
                <Text style={styles.emptyCtaText}>GET SNACKS</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.treatGrid}>
              {treats.map(({ item, count }, index) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.treat, { backgroundColor: treatSurface(index) }, pressed && styles.pressed]}
                  onPress={() => choose(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${count} left`}
                  accessibilityHint="Give him this instead of dinner."
                >
                  <View style={styles.treatGloss} pointerEvents="none" />
                  <View style={styles.iconBubble}><ItemIcon id={item.id} tint={item.color} /></View>
                  <View style={styles.copy}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.detail}>{item.blurb}</Text>
                  </View>
                  <View style={styles.countPill}><Text style={styles.count}>×{count}</Text></View>
                </Pressable>
              ))}
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
    padding: space.xl,
    paddingBottom: space.xxl,
    overflow: 'hidden',
    ...elevation.sheet,
  },
  hero: { position: 'absolute', left: 0, right: 0, top: 0, height: 126, opacity: 0.85 },
  heroGloss: { position: 'absolute', left: space.xl, right: space.xl, top: space.sm, height: space.md, borderRadius: radius.pill, backgroundColor: color.glossSoft },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  headerCopy: { flex: 1 },
  kicker: { alignSelf: 'flex-start', backgroundColor: color.ink, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: space.xs },
  eyebrow: { ...type.micro, color: color.inkOn },
  title: { marginTop: space.sm, maxWidth: 300, ...type.display, color: color.ink },
  closeButton: { width: TAP_MIN, height: TAP_MIN, borderRadius: radius.pill, backgroundColor: color.card, alignItems: 'center', justifyContent: 'center', ...elevation.low },
  close: { fontSize: glyph.close, lineHeight: TAP_MIN, width: TAP_MIN, height: TAP_MIN, textAlign: 'center', color: color.inkSoft },
  meal: { marginTop: space.xl, minHeight: 82, borderRadius: radius.lg, padding: space.md, backgroundColor: color.pop, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderWidth: 2, borderColor: color.popDeep, ...elevation.toy },
  mealGloss: { position: 'absolute', left: space.md, right: space.md, top: space.xs, height: space.sm, borderRadius: radius.pill, backgroundColor: color.gloss },
  sectionPod: { alignSelf: 'flex-start', marginTop: space.xl, marginBottom: space.sm, backgroundColor: color.violet, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.sm, ...elevation.low },
  section: { ...type.micro, color: color.ink },
  treatGrid: { gap: space.sm },
  treat: { minHeight: 78, borderRadius: radius.lg, padding: space.md, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderWidth: 2, borderColor: color.inkMid, ...elevation.card },
  treatGloss: { position: 'absolute', left: space.md, right: space.md, top: space.xs, height: space.sm, borderRadius: radius.pill, backgroundColor: color.glossSoft },
  iconBubbleMeal: { width: 50, height: 50, borderRadius: radius.lg, backgroundColor: color.card, alignItems: 'center', justifyContent: 'center', ...elevation.low },
  iconBubble: { width: 50, height: 50, borderRadius: radius.lg, backgroundColor: color.card, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, marginLeft: space.md },
  name: { ...type.strong, fontWeight: '900', color: color.ink },
  detail: { marginTop: space.xs, ...type.caption, color: color.inkMid },
  arrow: { fontSize: glyph.arrow, color: color.ink, marginLeft: space.sm },
  countPill: { minWidth: 36, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: space.sm, backgroundColor: color.card, alignItems: 'center', ...elevation.low },
  count: { ...type.caption, fontWeight: '900', color: color.ink },
  empty: { borderRadius: radius.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: color.violetDeep, backgroundColor: color.fill, padding: space.lg },
  emptyTitle: { ...type.strong, color: color.ink },
  emptyText: { marginTop: space.xs, ...type.small, color: color.inkSoft },
  emptyCta: { alignSelf: 'flex-start', marginTop: space.md, paddingHorizontal: space.lg, minHeight: TAP_MIN, borderRadius: radius.pill, backgroundColor: color.violet, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...elevation.card },
  ctaGloss: { position: 'absolute', left: space.sm, right: space.sm, top: space.xs, height: space.sm, borderRadius: radius.pill, backgroundColor: color.gloss },
  emptyCtaText: { ...type.caption, fontWeight: '900', color: color.ink },
  pressed: { transform: [{ scale: 0.985 }] },
});
