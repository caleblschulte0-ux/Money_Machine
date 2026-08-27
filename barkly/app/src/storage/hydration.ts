/**
 * The hydration gate — "never write before you have read".
 *
 * This exists because of a bug that quietly destroyed every player's progress
 * on every single launch, and it is worth writing down exactly how, because
 * the shape of it is easy to rebuild by accident.
 *
 * The hook held its durable state in `useState` and saved it with the obvious
 * effect:
 *
 *     const [wallet, setWallet] = useState(freshWallet);
 *     useEffect(() => { store.set(WALLET_KEY, JSON.stringify(wallet)); }, [wallet]);
 *
 * That effect runs after the FIRST render, with the DEFAULT value, and the
 * boot loader that reads storage is async — several awaits deep. So the order
 * on every launch was:
 *
 *   1. render with freshWallet() — 40 coins, nothing owned
 *   2. effect fires and OVERWRITES the saved wallet with that default
 *   3. boot finally reads the key and gets back the default it just wrote
 *
 * Your coins, your level, everything you had bought, your relationships with
 * every dog, and his stats: gone, every time, silently. It also re-granted the
 * daily bonus every launch, because `lastDailyBonus` had been wiped too, which
 * made coins infinite and the whole economy meaningless.
 *
 * The rule that prevents it is one sentence — a store that has not been read
 * yet must not be written — so it lives in one small object with tests rather
 * than as a `if (bootReady)` that someone forgets on the next key.
 *
 * Reads are always allowed; only writes are gated.
 */

import { KeyValueStore } from './types';

export class HydrationGate {
  private open = false;
  /** Counts writes refused while closed. Tests assert on it; so can a doctor. */
  private refused = 0;

  constructor(private store: KeyValueStore) {}

  get isOpen(): boolean {
    return this.open;
  }

  get refusedWrites(): number {
    return this.refused;
  }

  /**
   * Open the gate once the load pass is done — including when it FAILED.
   * A boot that throws must not leave the app unable to save anything ever
   * again; that would trade a wipe-on-launch bug for a never-save bug.
   */
  openAfterLoad(): void {
    this.open = true;
  }

  /** Reads are never gated: reading is how the gate gets opened. */
  read(key: string): Promise<string | null> {
    return this.store.get(key);
  }

  /**
   * Write, if we have read first. Returns whether it was accepted, so a caller
   * can tell "refused" from "failed". Never rejects: persistence is
   * best-effort everywhere else in this app and staying consistent with that
   * keeps callers from growing their own swallowed catch.
   */
  async write(key: string, value: string): Promise<boolean> {
    if (!this.open) {
      this.refused += 1;
      return false;
    }
    try {
      await this.store.set(key, value);
      return true;
    } catch {
      return false;
    }
  }

  /** Deleting is a deliberate act (the privacy wipe), so it is not gated. */
  async remove(key: string): Promise<void> {
    try {
      await this.store.remove(key);
    } catch {}
  }
}
