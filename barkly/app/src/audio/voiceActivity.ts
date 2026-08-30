export interface VoiceActivityState {
  speaking: boolean;
  line: string | null;
  token: number;
}

type Listener = (state: VoiceActivityState) => void;

let state: VoiceActivityState = { speaking: false, line: null, token: 0 };
const listeners = new Set<Listener>();

function publish(next: VoiceActivityState) {
  state = next;
  for (const listener of listeners) listener(state);
}

export function getVoiceActivity(): VoiceActivityState {
  return state;
}

export function subscribeVoiceActivity(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function beginVoiceActivity(line: string): number {
  const token = state.token + 1;
  publish({ speaking: true, line, token });
  return token;
}

export function endVoiceActivity(token: number): void {
  if (state.token !== token) return;
  publish({ speaking: false, line: state.line, token });
}

export function clearVoiceActivity(): void {
  publish({ speaking: false, line: null, token: state.token + 1 });
}
