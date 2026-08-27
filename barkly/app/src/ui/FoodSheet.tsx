import React from 'react';
import { color } from './theme';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { STORE, Wallet } from '../game/progression';

interface Props {
  visible: boolean;
  onClose: () => void;
  wallet: Wallet;
  hungry: boolean;
  onFeed: (itemId?: string) => void;
  /** Take them to the shop. An empty cupboard should be a door, not a notice. */
  onOpenShop: () => void;
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
            <View>
              <Text style={styles.eyebrow}>THE FOOD SITUATION</Text>
              <Text style={styles.title}>{hungry ? 'Barkly is accepting proposals.' : 'He is not exactly starving.'}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close food">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.meal}
            onPress={() => choose()}
            accessibilityRole="button"
            accessibilityLabel="Regular dinner"
            accessibilityHint="Feed him his ordinary food."
          >
            <View style={styles.iconBubble}><Text style={styles.icon}>🥣</Text></View>
            <View style={styles.copy}>
              <Text style={styles.name}>Regular dinner</Text>
              <Text style={styles.detail}>Reliable. Nutritionally uninteresting. Gets the job done.</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>

          <Text style={styles.section}>From the cupboard</Text>
          {treats.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Cupboard's empty.</Text>
              <Text style={styles.emptyText}>
                The shop has biscuits, cheese and eventually a completely unreasonable steak.
              </Text>
              <Pressable
                style={styles.emptyCta}
                onPress={() => {
                  onClose();
                  onOpenShop();
                }}
                accessibilityRole="button"
                accessibilityLabel="Go to the shop"
                accessibilityHint="Buy treats for him."
              >
                <Text style={styles.emptyCtaText}>go to the shop</Text>
              </Pressable>
            </View>
          ) : (
            treats.map(({ item, count }) => (
              <Pressable
                key={item.id}
                style={styles.treat}
                onPress={() => choose(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${count} left`}
                accessibilityHint="Give him this instead of dinner."
              >
                <View style={styles.iconBubble}><Text style={styles.icon}>{item.icon}</Text></View>
                <View style={styles.copy}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.detail}>{item.blurb}</Text>
                </View>
                <View style={styles.countPill}><Text style={styles.count}>×{count}</Text></View>
              </Pressable>
            ))
          )}

          <Text style={styles.footer}>Special food is a possession you actually use. Barkly will remember the good stuff.</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(29,24,18,0.48)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: color.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: color.gold },
  title: { marginTop: 4, maxWidth: 300, fontSize: 24, lineHeight: 27, fontWeight: '900', color: color.ink, letterSpacing: -0.5 },
  close: { fontSize: 18, color: color.inkSoft, padding: 4 },
  section: { marginTop: 18, marginBottom: 7, fontSize: 12, fontWeight: '900', letterSpacing: 1.2, color: color.inkSoft, textTransform: 'uppercase' },
  meal: { marginTop: 16, minHeight: 76, borderRadius: 18, padding: 12, backgroundColor: color.fill, flexDirection: 'row', alignItems: 'center' },
  treat: { minHeight: 76, borderRadius: 18, padding: 12, marginBottom: 8, backgroundColor: color.card, borderWidth: 1, borderColor: color.line, flexDirection: 'row', alignItems: 'center' },
  iconBubble: { width: 46, height: 46, borderRadius: 22, backgroundColor: color.well, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 26 },
  copy: { flex: 1, marginLeft: 12 },
  name: { fontSize: 15, fontWeight: '800', color: color.ink },
  detail: { marginTop: 3, fontSize: 12, lineHeight: 17, color: color.inkSoft },
  arrow: { fontSize: 26, color: color.inkFaint, marginLeft: 8 },
  countPill: { minWidth: 36, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: color.fill, alignItems: 'center' },
  count: { fontSize: 12, fontWeight: '900', color: color.goldInk },
  empty: { borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.line, padding: 15 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: color.ink },
  emptyText: { marginTop: 4, fontSize: 12, lineHeight: 18, color: color.inkSoft },
  emptyCta: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: color.ink,
  },
  emptyCtaText: { color: color.paper, fontSize: 13, fontWeight: '800' },
  footer: { marginTop: 15, fontSize: 12, lineHeight: 17, textAlign: 'center', color: color.inkFaint },
});
