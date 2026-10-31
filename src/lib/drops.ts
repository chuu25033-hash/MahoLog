// 詠唱を終えたときに降る流れ星（ドロップ）の判定。
// 25分ごとに判定の枠が1つ増え（最大4枠）、長く続けた詠唱ほど稀な品が降りやすい。
// 短い詠唱を繰り返しても何も降らないので、一度に深く集中するほど報われる。
// 25分以上の詠唱の端数は「星の余韻」として次の詠唱へ持ち越し、45分・60分の区切りでも時間を無駄にしない。
// ただし確率・原石・確定枠は、その1回の詠唱時間だけで決める（余韻で上の区切りには届かない）。
import type { Area, Rarity } from "./areas";
import { dropPool, pickDropItem, type Item } from "./items";

/** レア度ごとの確率（%）。合計 100 */
export type RarityRates = Record<Rarity, number>;

/** 詠唱時間の区切りごとの流れ星 */
export type DropTier = {
  /** この区切りに届く詠唱時間（分） */
  minMinutes: number;
  /** 判定の枠の数（＝降る品の数。星の余韻でさらに増えることがある） */
  slots: number;
  /** 各枠のレア度の確率 */
  rates: RarityRates;
  /** 稀品（B）以上が確定する枠の数（枠の内数） */
  guaranteed: number;
  /** 添えられる星屑の原石の数 */
  ore: number;
};

/** 判定の枠が1つ増える詠唱時間（分） */
export const DROP_SLOT_MINUTES = 25;

/** 1回の詠唱で降る流れ星の上限 */
export const MAX_DROP_SLOTS = 4;

/** 100分以降は、どれだけ続けても最後の区切り（4枠）のまま */
export const DROP_TIERS: DropTier[] = [
  { minMinutes: 25, slots: 1, rates: { C: 85, B: 12, A: 2.9, S: 0.1 }, guaranteed: 0, ore: 0 },
  { minMinutes: 50, slots: 2, rates: { C: 70, B: 20, A: 9, S: 1 }, guaranteed: 0, ore: 0 },
  { minMinutes: 75, slots: 3, rates: { C: 55, B: 25, A: 15, S: 5 }, guaranteed: 0, ore: 1 },
  { minMinutes: 100, slots: 4, rates: { C: 40, B: 30, A: 20, S: 10 }, guaranteed: 1, ore: 3 },
];

/** 抽選で区間を割り当てる順（常品から至宝へ） */
const ROLL_ORDER: Rarity[] = ["C", "B", "A", "S"];

export type DropResult = {
  /** 届いた区切り（25分未満は null で、何も降らず余韻も変わらない） */
  tier: DropTier | null;
  /** 降った品（枠の順。確定枠は最後） */
  items: Item[];
  /** レア度ごとの数 */
  byRarity: RarityRates;
  /** 添えられた星屑の原石の数 */
  ore: number;
  /** 詠唱を終えた後の星の余韻（分、0〜24） */
  echo: number;
};

export type DropOptions = {
  /** 詠唱したエリア（どの品が降るかを決める） */
  area: Area;
  /** 周天（伝承の品が周回限定版に変わる） */
  cycle?: number;
  /** 秘宝の加護による、稀品以上の確率の倍率（1.4 = +40%） */
  boost?: number;
  /** これまでに持ち越した星の余韻（分） */
  echo?: number;
  random?: () => number;
};

/** 詠唱時間が届いた区切り。25分未満は null */
export function dropTierOf(minutes: number): DropTier | null {
  return DROP_TIERS.findLast((t) => minutes >= t.minMinutes) ?? null;
}

/** 加護を乗せた確率: 稀品（B）以上を boost 倍にし、その分だけ常品（C）を減らす。稀品以上で 100% を超えたら縮める */
export function boostedRates(rates: RarityRates, boost = 1): RarityRates {
  const upper = (["B", "A", "S"] as const).map((r) => rates[r] * boost);
  const sum = upper.reduce((acc, v) => acc + v, 0);
  const scale = sum > 100 ? 100 / sum : 1;
  const [B, A, S] = upper.map((v) => v * scale);
  return { C: Math.max(0, 100 - (B + A + S)), B, A, S };
}

/** 1枠のレア度を引く。品の無いレア度（星天の塔の稀品など）は除き、残りの確率で引き直す */
function rollRarity(rates: RarityRates, available: Rarity[], random: () => number): Rarity | null {
  const total = available.reduce((acc, r) => acc + rates[r], 0);
  if (total <= 0) return null;
  let x = random() * total;
  for (const r of available) {
    x -= rates[r];
    if (x < 0) return r;
  }
  return available[available.length - 1];
}

/**
 * 詠唱時間（分）から、降る流れ星を決める。
 * 1. 詠唱時間の区切り（25/50/75/100分）で確率・確定枠・原石の数を決める
 * 2. 詠唱時間に星の余韻を足し、25分ごとに1枠（最大4枠）。届かなかった端数は次の余韻になる
 * 3. 枠ごとにレア度を引く。確定枠は常品（C）を除いて引く
 * 4. そのレア度の品をエリアのプールから選ぶ
 */
export function calculateItemDrops(
  durationMinutes: number,
  { area, cycle = 1, boost = 1, echo = 0, random = Math.random }: DropOptions,
): DropResult {
  const byRarity: RarityRates = { C: 0, B: 0, A: 0, S: 0 };
  const carried = Math.min(DROP_SLOT_MINUTES - 1, Math.max(0, Math.floor(echo)));
  const tier = dropTierOf(durationMinutes);
  if (!tier) return { tier, items: [], byRarity, ore: 0, echo: carried };

  const counted = Math.floor(durationMinutes) + carried;
  const slots = Math.min(MAX_DROP_SLOTS, Math.floor(counted / DROP_SLOT_MINUTES));
  const nextEcho = Math.min(DROP_SLOT_MINUTES - 1, counted - slots * DROP_SLOT_MINUTES);

  const pool = dropPool(area, cycle);
  const rates = boostedRates(tier.rates, boost);
  const available = ROLL_ORDER.filter((r) => pool[r].length > 0);
  const upper = available.filter((r) => r !== "C");

  const items: Item[] = [];
  for (let i = 0; i < slots; i++) {
    const guaranteed = i >= slots - tier.guaranteed;
    const rarity = rollRarity(rates, guaranteed && upper.length > 0 ? upper : available, random);
    if (!rarity) continue;
    items.push(pickDropItem(pool, rarity, random));
    byRarity[rarity]++;
  }
  return { tier, items, byRarity, ore: tier.ore, echo: nextEcho };
}
