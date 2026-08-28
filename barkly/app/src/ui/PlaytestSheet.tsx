/**
 * Playtester save slots.
 *
 * The problem this solves: most of what Barkly IS only exists after weeks. A
 * Pack Book with something in it. A rivalry with Duke that has a history. A
 * trick he learned from you. Somebody evaluating whether this game is any good
 * cannot see any of that on a dog they met four seconds ago, and waiting six
 * months to find out whether the six-month experience lands is not a plan.
 *
 * So this loads REAL saves — see dev/presets.ts. Nothing here is a mocked
 * screen or a relabelled UI: each slot is written into the store the game
 * hydrates from, and the app restarts so every system reads it the way it
 * reads any other save.
 *
 * It only exists in a build that opted in. See dev/playtest.ts for the gate.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { color, radius, space, type } from './theme';
import { TAP_MIN } from './layout';
import { PRESETS } from '../dev/presets';
import { ActiveSlot, activeSlot, canRestart, hasBackup, loadPreset, restart, restoreBackup } from '../dev/saveSlots';
import { asyncStorageStore } from '../storage/asyncStorageStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function PlaytestSheet({ visible, onClose }: Props) {
  const [active, setActive] = useState<ActiveSlot | null>(null);
  const [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setActive(await activeSlot(asyncStorageStore));
    setBackup(await hasBackup(asyncStorageStore));
  }, []);

  useEffect(() => {
    if (visible) void refresh();
  }, [visible, refresh]);

  /**
   * Load, then restart. Hydration runs once at launch, so writing the store
   * without restarting would leave the app showing the previous dog with the
   * new dog's save underneath it — which is worse than not loading at all,
   * because it looks like it worked.
   */
  const load = async (id: string) => {
    if (busy) return;
    setBusy(true);
    await loadPreset(asyncStorageStore, id);
    if (canRestart()) restart();
    else {
      await refresh();
      setBusy(false);
    }
  };

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    await restoreBackup(asyncStorageStore);
    if (canRestart()) restart();
    else {
      await refresh();
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Playtest save slots</Text>
              <Text style={styles.sub}>
                {active ? `Now playing: ${active.name}` : 'Now playing: your own save'}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Close playtest slots"
              testID="playtest-close"
            >
              <Text style={styles.closeText}>done</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.list}>
            {PRESETS.map((p) => {
              const on = active?.id === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => void load(p.id)}
                  disabled={busy}
                  style={[styles.slot, on && styles.slotOn]}
                  accessibilityRole="button"
                  accessibilityLabel={`Load ${p.name}`}
                  accessibilityHint={p.blurb}
                  accessibilityState={{ selected: on, disabled: busy }}
                  testID={`playtest-${p.id}`}
                >
                  <View style={styles.slotText}>
                    <Text style={styles.slotName}>
                      {p.name}
                      {on ? '  ·  active' : ''}
                    </Text>
                    <Text style={styles.slotBlurb}>{p.blurb}</Text>
                  </View>
                  <Text style={styles.load}>{on ? 'reload' : 'load'}</Text>
                </Pressable>
              );
            })}

            {backup && (
              <Pressable
                onPress={() => void restore()}
                disabled={busy}
                style={[styles.slot, styles.restore]}
                accessibilityRole="button"
                accessibilityLabel="Restore my own save"
                accessibilityHint="Puts back the Barkly that was here before any preset was loaded."
                testID="playtest-restore"
              >
                <View style={styles.slotText}>
                  <Text style={styles.slotName}>Restore my own save</Text>
                  <Text style={styles.slotBlurb}>
                    The Barkly that was here before the first preset. Kept whole, not overwritten.
                  </Text>
                </View>
                <Text style={styles.load}>restore</Text>
              </Pressable>
            )}

            <Text style={styles.foot}>
              Loading a slot writes a real save and restarts the app, so every system reads it the
              way it reads any other Barkly. Your own save is copied aside the first time.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(40,32,22,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: color.well, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '92%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 8,
  },
  title: { ...type.title, color: color.ink },
  sub: { ...type.small, color: color.inkSoft, marginTop: 2 },
  close: { minWidth: TAP_MIN, minHeight: TAP_MIN, alignItems: 'center', justifyContent: 'center' },
  closeText: { ...type.body, color: color.inkSoft, fontWeight: '700' },
  list: { paddingHorizontal: 18, paddingBottom: 28 },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TAP_MIN + 12,
    backgroundColor: color.card,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: space.sm,
  },
  slotOn: { backgroundColor: color.goldWell },
  restore: { marginTop: space.md },
  slotText: { flex: 1, paddingRight: 10 },
  slotName: { ...type.body, color: color.ink, fontWeight: '800' },
  slotBlurb: { ...type.small, color: color.inkSoft, marginTop: 2 },
  load: { ...type.small, color: color.goldInk, fontWeight: '800' },
  foot: { ...type.small, color: color.inkSoft, marginTop: space.sm, lineHeight: 18 },
});
