// 周天（周回）と、STAGE 6 の先に続く無限の階層「星天の塔（Astra Zenith）」。
// 周天を進めると、エリアの解放は新しい周の累積MP（totalMp - 周の始まりの MP）で測り直す。
// 階級・探求度・図鑑・所持品は周をまたいで引き継ぐ。

/** STAGE 6 の最奥「星冠の祭壇」（6-3）に届く時間。ここに届けばその周天を制覇したことになる */
export const CLEAR_HOURS = 300;
export const CLEAR_MP = CLEAR_HOURS * 60;

/** UI の 1px ライン描画色（<html data-chapter> で globals.css の色を切り替える） */
export type ChapterTheme = "default" | "shadow" | "azure";

export type Chapter = {
  /** 何周目か（1 から） */
  cycle: number;
  name: string;
  /** 英字の副題 */
  label: string;
  theme: ChapterTheme;
  /** この章で授かる魔法陣スキン */
  skinId: string | null;
  /** 伝承の品の周回限定版（アナザー）の接尾辞 */
  loreVariant: "shadow" | "azure" | null;
};

const CHAPTERS: Chapter[] = [
  { cycle: 1, name: "黎明の章", label: "CHAPTER OF DAWN", theme: "default", skinId: null, loreVariant: null },
  { cycle: 2, name: "影の章", label: "CHAPTER OF SHADOW", theme: "shadow", skinId: "a-eclipse", loreVariant: "shadow" },
  { cycle: 3, name: "蒼炎の章", label: "CHAPTER OF AZURE FLAME", theme: "azure", skinId: "a-azureflame", loreVariant: "azure" },
];

/** 周天の章。4周目以降は蒼炎の章が続く */
export function chapterOf(cycle: number): Chapter {
  return CHAPTERS.find((c) => c.cycle === cycle) ?? { ...CHAPTERS[CHAPTERS.length - 1], cycle };
}

/** これまでに開いた UI の色調 */
export function unlockedThemes(cycle: number): ChapterTheme[] {
  return CHAPTERS.filter((c) => c.cycle <= cycle).map((c) => c.theme);
}

export const THEME_LABEL: Record<ChapterTheme, { name: string; description: string; swatch: string }> = {
  default: { name: "星金", description: "はじまりの金と水晶の光", swatch: "#e2c974" },
  shadow: { name: "漆黒", description: "影の章: 光を呑む黒曜と、銀の残光", swatch: "#b9b2d4" },
  azure: { name: "蒼炎", description: "蒼炎の章: 青白く燃える冷たい炎", swatch: "#6fb6ff" },
};

/** 周天の刻印: 周を重ねるごとに全属性の獲得MP +10%（永久） */
export const CYCLE_MARK_RATE = 0.1;

export function cycleMarkMultiplier(cycle: number) {
  return 1 + Math.max(0, cycle - 1) * CYCLE_MARK_RATE;
}

/** 漢数字の周天名（第二周天 など） */
export function cycleLabel(cycle: number) {
  const KANJI = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  return `第${KANJI[cycle] ?? cycle}周天`;
}

// ---- 星天の塔 ----

/** 塔で 10 時間詠唱するごとに 1 層昇る */
export const ZENITH_MINUTES_PER_FLOOR = 10 * 60;

/** 塔での累積詠唱時間（分）から到達階層を求める（1 層から） */
export function zenithFloor(minutes: number) {
  return 1 + Math.floor(minutes / ZENITH_MINUTES_PER_FLOOR);
}

export function zenithProgress(minutes: number) {
  const floor = zenithFloor(minutes);
  const current = minutes - (floor - 1) * ZENITH_MINUTES_PER_FLOOR;
  return { floor, ratio: current / ZENITH_MINUTES_PER_FLOOR, remainingMinutes: ZENITH_MINUTES_PER_FLOOR - current };
}

/** 節目の階層で授かるもの（アイテム ID。天界遺物・称号・『余白の原典』の断片は lib/items.ts に定義） */
export const ZENITH_MILESTONES: { floor: number; rewards: string[] }[] = [
  { floor: 10, rewards: ["t-wayfarer"] },
  { floor: 25, rewards: ["ss-zenith-lantern", "frag-7-1"] },
  { floor: 50, rewards: ["ss-zenith-spire", "t-observer", "frag-7-2"] },
  { floor: 75, rewards: ["frag-7-3"] },
  { floor: 100, rewards: ["ss-zenith-crown", "t-apex", "frag-7-4"] },
  { floor: 200, rewards: ["ss-zenith-halo", "t-boundless"] },
];

/** from 層より上、to 層までに越えた節目 */
export function milestonesBetween(from: number, to: number) {
  return ZENITH_MILESTONES.filter((m) => m.floor > from && m.floor <= to);
}

export function nextMilestone(floor: number) {
  return ZENITH_MILESTONES.find((m) => m.floor > floor) ?? null;
}
