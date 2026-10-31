// 詠唱を終えたときの最終的な授かり物: 流れ星（lib/drops.ts）に、流星群の接近と星脈との同調（lib/combo.ts）を重ねる。
//
// 流星群の接近: 1回の詠唱が30分以上に届くと、長き詠唱で星脈がゆらぎ、流星群が近づく。
//   詠唱中は静かな兆しを見せるだけで、授かり物はリザルトでまとめて解き放つ。
//   星屑の原石を 2〜5 個（無作為）確定で添え、流れ星の1つを RARE A（秘宝）以上へ引き上げる。
// 同調: 魔力に倍率（2同調〜）、流れ星の稀品以上の確率に補正（3同調〜）を乗せる。
import type { Area, Rarity } from "./areas";
import { comboDropBoost, comboMpMultiplier, COMBO_TITLE_COUNT } from "./combo";
import { boostedRates, calculateItemDrops, type DropResult } from "./drops";
import { dropPool, pickDropItem, type Item } from "./items";

/** 流星群が近づく、1回の詠唱の長さ（分） */
export const METEOR_SHOWER_MINUTES = 30;
/** 流星群が添える星屑の原石の数 */
export const METEOR_ORE_MIN = 2;
export const METEOR_ORE_MAX = 5;

/** 流星群で引き上げる先の格（秘宝・至宝） */
const UPPER: Rarity[] = ["A", "S"];
const RANK: Record<Rarity, number> = { C: 0, B: 1, A: 2, S: 3 };

export type MeteorShower = {
  /** 流星群が添えた星屑の原石の数（流れ星の区切りの原石とは別） */
  ore: number;
  /** 秘宝以上へ引き上げた流れ星の位置（items の添字）。もとから秘宝以上だった、または引き上げ先が無いときは null */
  upgradedIndex: number | null;
  /** 引き上げる前の品 */
  replaced: Item | null;
};

export type FinalReward = {
  /** 流れ星（流星群の引き上げを済ませたもの） */
  fall: DropResult;
  /** 流星群の接近（30分未満は null） */
  meteor: MeteorShower | null;
  /** 星屑の原石の合計（流れ星の区切り + 流星群） */
  ore: number;
  /** 同調を乗せた獲得魔力 */
  mp: number;
  /** 同調による魔力の倍率 */
  comboMp: number;
  /** 同調による稀品以上の確率の倍率 */
  comboDrop: number;
  /** この詠唱を含めた同調数 */
  combo: number;
  /** 「星脈の調律師」に届く同調か */
  comboTitle: boolean;
};

export type RewardInput = {
  /** 1回の詠唱で実際に計った時間（分） */
  minutes: number;
  /** 同調以外の倍率（エリア・加護・触媒・周天の刻印）を乗せた魔力 */
  baseMp: number;
  /** この詠唱を含めた同調数（comboOnFinish の後の count） */
  combo: number;
  area: Area;
  cycle?: number;
  /** 秘宝の加護による、稀品以上の確率の倍率 */
  blessingDrop?: number;
  /** これまでに持ち越した星の余韻（分） */
  echo?: number;
  random?: () => number;
};

/** min〜max の整数を引く */
const randomInt = (min: number, max: number, random: () => number) => min + Math.floor(random() * (max - min + 1));

/**
 * 流星群で、流れ星の1つを秘宝以上へ引き上げる。いちばん格の低い品を選び、
 * その区切りの確率（加護込み）で秘宝・至宝のどちらかを引く。すでに秘宝以上なら引き上げない
 */
function upgradeOne(
  fall: DropResult,
  { area, cycle, boost, random }: { area: Area; cycle: number; boost: number; random: () => number },
): { fall: DropResult; upgradedIndex: number | null; replaced: Item | null } {
  const none = { fall, upgradedIndex: null, replaced: null };
  if (!fall.tier || fall.items.length === 0) return none;
  const index = fall.items.reduce((lowest, item, i) => (RANK[item.rarity as Rarity] < RANK[fall.items[lowest].rarity as Rarity] ? i : lowest), 0);
  const target = fall.items[index];
  if (RANK[target.rarity as Rarity] >= RANK.A) return none;

  const pool = dropPool(area, cycle);
  const available = UPPER.filter((r) => pool[r].length > 0);
  if (available.length === 0) return none;
  const rates = boostedRates(fall.tier.rates, boost);
  const total = available.reduce((acc, r) => acc + rates[r], 0);
  let x = random() * total;
  const rarity = available.find((r) => (x -= rates[r]) < 0) ?? available[available.length - 1];

  const item = pickDropItem(pool, rarity, random);
  const items = fall.items.map((it, i) => (i === index ? item : it));
  const byRarity = { ...fall.byRarity, [target.rarity]: fall.byRarity[target.rarity as Rarity] - 1, [rarity]: fall.byRarity[rarity] + 1 };
  return { fall: { ...fall, items, byRarity }, upgradedIndex: index, replaced: target };
}

/**
 * 詠唱の時間と同調数から、最終的な授かり物（流れ星・星屑の原石・魔力）を決める。
 * 1. 流れ星を引く（稀品以上の確率に 加護 × 同調 の補正）
 * 2. 30分以上なら流星群: 原石 2〜5 個を添え、流れ星の1つを秘宝以上へ
 * 3. 魔力に同調の倍率を乗せる
 */
export function calculateFinalReward({
  minutes,
  baseMp,
  combo,
  area,
  cycle = 1,
  blessingDrop = 1,
  echo = 0,
  random = Math.random,
}: RewardInput): FinalReward {
  const comboDrop = comboDropBoost(combo);
  const boost = blessingDrop * comboDrop;
  let fall = calculateItemDrops(minutes, { area, cycle, boost, echo, random });

  let meteor: MeteorShower | null = null;
  if (minutes >= METEOR_SHOWER_MINUTES) {
    const ore = randomInt(METEOR_ORE_MIN, METEOR_ORE_MAX, random);
    const upgraded = upgradeOne(fall, { area, cycle, boost, random });
    fall = upgraded.fall;
    meteor = { ore, upgradedIndex: upgraded.upgradedIndex, replaced: upgraded.replaced };
  }

  const comboMp = comboMpMultiplier(combo);
  return {
    fall,
    meteor,
    ore: fall.ore + (meteor?.ore ?? 0),
    mp: Math.round(baseMp * comboMp),
    comboMp,
    comboDrop,
    combo,
    comboTitle: combo >= COMBO_TITLE_COUNT,
  };
}
