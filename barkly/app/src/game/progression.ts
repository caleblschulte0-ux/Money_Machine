/**
 * The reason to come back tomorrow.
 *
 * Barkly's conversation is the product; this is the spine that gives it a
 * shape. Coins, levels and a store, sized to a kid's app and deliberately
 * NOT a grind:
 *
 * - You earn by CARING FOR HIM, never by watching or waiting. Feeding a
 *   hungry dog pays; feeding a full one does not, because farming a button is
 *   not a relationship.
 * - Everything is earnable. The store is stocked with things you buy with
 *   coins you got by playing. Nothing here reads a wallet.
 * - Levels unlock PLACES and THINGS, not stat boosts. "The town is open now"
 *   is a reason to open the app; "+3% affection gain" is a spreadsheet.
 *
 * Pure and platform-agnostic: no storage, no React, clock passed in. The hook
 * owns persistence.
 *
 * DEV MODE. Every gate below takes an optional `dev` flag that opens it. It
 * exists because the person building this should never be locked out of the
 * thing he built waiting to grind past his own level curve. It is a bypass on
 * the GATES only — it never fabricates progress behind your back, and the
 * wallet it returns is the real one, so turning it off leaves you exactly
 * where you were.
 */

export interface Wallet {
  coins: number;
  /** Total XP ever earned; the level is derived from it. */
  xp: number;
  /** Item ids bought, so a purchase is permanent. */
  owned: string[];
  /** Which item is currently worn / placed, per slot. */
  equipped: Record<string, string>;
  /** UTC day key of the last daily bonus, so it pays once. */
  lastDailyBonus?: string;
  /** Consumables he has in the cupboard: item id -> count. */
  pantry: Record<string, number>;
}

export function freshWallet(): Wallet {
  return { coins: 40, xp: 0, owned: [], equipped: {}, pantry: {} };
}

// ------------------------------------------------------------------ levels

/**
 * Level thresholds. Early levels come fast — the first unlock has to land in
 * the first session or there is nothing to come back for — then stretch.
 */
export const LEVEL_XP = [0, 40, 110, 220, 380, 600, 900, 1300, 1800, 2500, 3400];

export function levelFor(xp: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_XP.length; i++) {
    if (xp >= LEVEL_XP[i]) level = i + 1;
  }
  return level;
}

/** Progress through the current level, 0..1, for the ring in the header. */
export function levelProgress(xp: number): { level: number; into: number; need: number; frac: number } {
  const level = levelFor(xp);
  const floor = LEVEL_XP[level - 1] ?? 0;
  const ceiling = LEVEL_XP[level] ?? floor + 1200; // past the table, a flat climb
  const into = xp - floor;
  const need = ceiling - floor;
  return { level, into, need, frac: Math.max(0, Math.min(1, into / need)) };
}

// ------------------------------------------------------------------ earning

export type EarnKind =
  | 'talk' // a real exchange with him
  | 'feed' // feeding him when he is actually hungry
  | 'play'
  | 'fetch' // completing a round of fetch
  | 'dig' // turning up a treasure
  | 'friend' // time with another dog
  | 'daily'; // first visit of the day

interface Reward {
  coins: number;
  xp: number;
}

const REWARDS: Record<EarnKind, Reward> = {
  talk: { coins: 2, xp: 6 },
  feed: { coins: 3, xp: 8 },
  play: { coins: 3, xp: 8 },
  fetch: { coins: 6, xp: 14 },
  dig: { coins: 10, xp: 20 },
  friend: { coins: 4, xp: 10 },
  daily: { coins: 25, xp: 30 },
};

export interface EarnResult {
  wallet: Wallet;
  gained: Reward;
  /** Set when this earn crossed a level boundary — worth a celebration. */
  leveledTo?: number;
}

/**
 * Credit an action. `useful` is how the anti-farming rule is expressed: the
 * caller says whether the action actually did something for him (he was
 * hungry, he was bored), and a useless repeat earns nothing.
 */
export function earn(wallet: Wallet, kind: EarnKind, useful = true): EarnResult {
  if (!useful) return { wallet, gained: { coins: 0, xp: 0 } };
  const gained = REWARDS[kind];
  const before = levelFor(wallet.xp);
  const next: Wallet = {
    ...wallet,
    coins: wallet.coins + gained.coins,
    xp: wallet.xp + gained.xp,
  };
  const after = levelFor(next.xp);
  return { wallet: next, gained, leveledTo: after > before ? after : undefined };
}

export function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** The first open of a calendar day pays a bonus. Once. */
export function claimDaily(wallet: Wallet, now: number): EarnResult & { claimed: boolean } {
  const today = dayKey(now);
  if (wallet.lastDailyBonus === today) {
    return { wallet, gained: { coins: 0, xp: 0 }, claimed: false };
  }
  const result = earn({ ...wallet, lastDailyBonus: today }, 'daily');
  return { ...result, claimed: true };
}

// ------------------------------------------------------------------- store

export type ItemSlot = 'collar' | 'treat' | 'home' | 'toy';

export interface StoreItem {
  id: string;
  name: string;
  /** One line in Barkly's world, not marketing copy. */
  blurb: string;
  slot: ItemSlot;
  price: number;
  /** Minimum level before it appears at all. */
  level: number;
  /** Consumables are used up; everything else is owned forever. */
  consumable?: boolean;
  /** Worn items carry a colour the renderer can tint with. */
  color?: string;
  icon: string;
}

export const STORE: StoreItem[] = [
  // --- collars: the visible flex, and the cheapest thing to want ---
  { id: 'collar_red', name: 'Red collar', blurb: 'Loud. He likes loud.', slot: 'collar', price: 60, level: 1, color: '#B3402E', icon: '🔴' },
  { id: 'collar_blue', name: 'Blue collar', blurb: 'Calmer. He is not calmer.', slot: 'collar', price: 60, level: 1, color: '#3E6E9C', icon: '🔵' },
  { id: 'collar_green', name: 'Green collar', blurb: 'The colour of grass, which he approves of.', slot: 'collar', price: 90, level: 3, color: '#4E7A46', icon: '🟢' },
  { id: 'collar_gold', name: 'Gold collar', blurb: 'Absurd. He is thrilled.', slot: 'collar', price: 400, level: 6, color: '#C9A227', icon: '🟡' },

  // --- food: consumable, and the thing he will nag you about ---
  { id: 'treat_biscuit', name: 'Biscuits', blurb: 'Fine. Ordinary. He will eat nine.', slot: 'treat', price: 20, level: 1, consumable: true, icon: '🦴' },
  { id: 'treat_cheese', name: 'Cheese', blurb: 'The good stuff. He knows the difference.', slot: 'treat', price: 55, level: 2, consumable: true, icon: '🧀' },
  { id: 'treat_steak', name: 'Steak', blurb: 'A birthday-level event.', slot: 'treat', price: 150, level: 5, consumable: true, icon: '🥩' },

  // --- toys ---
  { id: 'toy_ball', name: 'Squeaky ball', blurb: 'Squeaks. That is the entire feature.', slot: 'toy', price: 70, level: 2, icon: '⚽' },
  { id: 'toy_rope', name: 'Rope', blurb: 'For arguments he intends to win.', slot: 'toy', price: 110, level: 4, icon: '🪢' },

  // --- home upgrades: the big-ticket goal ---
  { id: 'home_bed', name: 'Proper bed', blurb: 'Deeper. Softer. He will not shut up about it.', slot: 'home', price: 220, level: 3, icon: '🛏️' },
  { id: 'home_rug', name: 'Nice rug', blurb: 'Ties the room together, apparently.', slot: 'home', price: 300, level: 5, icon: '🟫' },
  { id: 'home_window', name: 'Bigger window', blurb: 'More birds to be furious about.', slot: 'home', price: 500, level: 7, icon: '🪟' },
];

/** What is on the shelves at this level — locked items are shown, not hidden. */
export function storeFor(level: number, dev = false): { item: StoreItem; locked: boolean }[] {
  return STORE.map((item) => ({ item, locked: !dev && item.level > level }));
}

export type BuyFailure = 'unknown_item' | 'locked' | 'too_expensive' | 'already_owned';

export interface BuyResult {
  wallet: Wallet;
  ok: boolean;
  reason?: BuyFailure;
  /** What Barkly says about it — success or refusal, always in his voice. */
  line: string;
}

export function buy(wallet: Wallet, itemId: string, dev = false): BuyResult {
  const item = STORE.find((i) => i.id === itemId);
  if (!item) return { wallet, ok: false, reason: 'unknown_item', line: "That isn't a thing." };

  const level = levelFor(wallet.xp);
  if (!dev && item.level > level) {
    return {
      wallet,
      ok: false,
      reason: 'locked',
      line: `Not yet. That's a level ${item.level} thing and we are level ${level}.`,
    };
  }
  if (!item.consumable && wallet.owned.includes(item.id)) {
    return { wallet, ok: false, reason: 'already_owned', line: 'We already have that one.' };
  }
  if (!dev && wallet.coins < item.price) {
    return {
      wallet,
      ok: false,
      reason: 'too_expensive',
      line: `${item.price} coins. We have ${wallet.coins}. Do some maths.`,
    };
  }

  // In dev mode the item is free rather than pushing the wallet negative.
  const next: Wallet = { ...wallet, coins: Math.max(0, wallet.coins - (dev ? 0 : item.price)) };
  if (item.consumable) {
    next.pantry = { ...wallet.pantry, [item.id]: (wallet.pantry[item.id] ?? 0) + 1 };
  } else {
    next.owned = [...wallet.owned, item.id];
    // Buying something wearable puts it on immediately. Nobody buys a collar
    // to leave it in a drawer.
    next.equipped = { ...wallet.equipped, [item.slot]: item.id };
  }
  return { wallet: next, ok: true, line: buyLine(item) };
}

function buyLine(item: StoreItem): string {
  switch (item.slot) {
    case 'collar':
      return `${item.name}. Put it on me. Now. Immediately.`;
    case 'treat':
      return `${item.name}. Correct decision. Possibly your first.`;
    case 'toy':
      return `Mine. That's mine now. Don't touch it.`;
    case 'home':
      return `Oh, we're doing UPGRADES. About time.`;
  }
}

export function equip(wallet: Wallet, itemId: string): Wallet {
  const item = STORE.find((i) => i.id === itemId);
  if (!item || item.consumable || !wallet.owned.includes(itemId)) return wallet;
  return { ...wallet, equipped: { ...wallet.equipped, [item.slot]: itemId } };
}

export function equippedItem(wallet: Wallet, slot: ItemSlot): StoreItem | undefined {
  const id = wallet.equipped[slot];
  return id ? STORE.find((i) => i.id === id) : undefined;
}

/** Eat one from the cupboard. Returns null when there is none. */
export function consume(wallet: Wallet, itemId: string): Wallet | null {
  const have = wallet.pantry[itemId] ?? 0;
  if (have <= 0) return null;
  const pantry = { ...wallet.pantry, [itemId]: have - 1 };
  if (pantry[itemId] === 0) delete pantry[itemId];
  return { ...wallet, pantry };
}

// ---------------------------------------------------------------- unlocks

export interface Unlock {
  id: string;
  level: number;
  /** What Barkly says the moment it opens. */
  line: string;
}

/** Places, not percentages. A new place is a reason to open the app. */
export const AREA_UNLOCKS: Record<string, Unlock> = {
  home: { id: 'home', level: 1, line: 'Home. Obviously.' },
  park: { id: 'park', level: 2, line: "The park's open to us now. There are BIRDS there." },
  town: { id: 'town', level: 4, line: "Town. Loads of people. Loads of them have food." },
};

export function areaUnlocked(area: string, xp: number, dev = false): boolean {
  if (dev) return true;
  const unlock = AREA_UNLOCKS[area];
  return !unlock || levelFor(xp) >= unlock.level;
}

// ------------------------------------------------------------------- dev

/** Top up coins. A grant, not a cheat — it says so on the tin. */
export function grantCoins(wallet: Wallet, coins: number): Wallet {
  return { ...wallet, coins: Math.max(0, wallet.coins + coins) };
}

/** Jump to the start of a level, so a gated feature can actually be seen. */
export function grantLevel(wallet: Wallet, level: number): Wallet {
  const target = Math.max(1, Math.min(level, LEVEL_XP.length));
  return { ...wallet, xp: Math.max(wallet.xp, LEVEL_XP[target - 1] ?? 0) };
}

/** Hand over one of everything, for looking at the art. */
export function grantEverything(wallet: Wallet): Wallet {
  const owned = STORE.filter((i) => !i.consumable).map((i) => i.id);
  const pantry = { ...wallet.pantry };
  for (const item of STORE.filter((i) => i.consumable)) {
    pantry[item.id] = Math.max(pantry[item.id] ?? 0, 5);
  }
  return { ...wallet, owned: Array.from(new Set([...wallet.owned, ...owned])), pantry };
}

/** Everything that just became available crossing into this level. */
export function unlockedAt(level: number): Unlock[] {
  const areas = Object.values(AREA_UNLOCKS).filter((u) => u.level === level);
  const items = STORE.filter((i) => i.level === level).map(
    (i): Unlock => ({ id: i.id, level, line: `${i.name} is in the shop now.` }),
  );
  return [...areas, ...items];
}
