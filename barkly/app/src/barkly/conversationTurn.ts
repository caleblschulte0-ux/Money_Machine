/** Turn arbitration shared by the UI and Barkly's autonomous speech. */
export const PLAYER_FLOOR_GRACE_MS = 30_000;

export function nextPlayerFloorUntil(now: number): number {
  return now + PLAYER_FLOOR_GRACE_MS;
}

export function autonomousSpeechAllowed(
  now: number,
  playerFloorUntil: number,
  conversationHeld: boolean,
): boolean {
  return !conversationHeld && now >= playerFloorUntil;
}
