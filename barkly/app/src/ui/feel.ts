/**
 * What the app feels like in your hand.
 *
 * Barkly had no haptics at all — not a dependency, not a call. Everything he
 * does arrived as pixels and, sometimes, sound. That is most of the gap
 * between "an app about a dog" and "a dog in your phone": a real toy pushes
 * back, and the cheapest possible version of pushing back is a 10ms tap in the
 * taptic engine at the moment something physical happens.
 *
 * Deliberately a small vocabulary. Five feelings, each tied to a KIND of
 * event, so the whole app cannot drift into buzzing at everything:
 *
 *   touch     you made contact with something in the world — a pet, a prod
 *   act       something happened because you did it — a throw, a dig, a bite
 *   arrive    something good landed — a treasure, a level, a purchase
 *   refuse    he will not, or cannot, do that
 *   thump     his tail, his paws — the body sounds, felt rather than heard
 *
 * Never for chrome. Opening a sheet is not a physical event and a phone that
 * ticks every time you press a button stops meaning anything.
 *
 * Every call is fire-and-forget and swallows its own failure: the web build
 * has no taptic engine, some Android devices have vibration switched off, and
 * a missing rumble must never be able to interrupt a conversation.
 */

import * as Haptics from 'expo-haptics';

export type Feel = 'touch' | 'act' | 'arrive' | 'refuse' | 'thump';

/**
 * True once the user has asked for silence. Muting the dog mutes his body too
 * — a "silent" toy that still buzzes in your pocket has not been silenced.
 */
let muted = false;
export function setFeelMuted(next: boolean): void {
  muted = next;
}

export function feel(kind: Feel): void {
  if (muted) return;
  try {
    switch (kind) {
      case 'touch':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'thump':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
        break;
      case 'act':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'arrive':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'refuse':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
    }
  } catch {
    // No taptic engine, or vibration is off. Not a failure worth reporting.
  }
}
