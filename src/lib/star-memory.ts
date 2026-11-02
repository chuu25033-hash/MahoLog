// 魔導の軌跡（詠唱履歴の星図）用の夜ごとの詠唱履歴。月ごとに、1日から7夜ずつ4つの星座と、29日以降の月末の数夜を描く。
// サンプル（mockObservedNights）は日付から決定的に生成するので、同じ日に何度開いても同じ星図になる。
import { startOfJstDay, startOfJstMonth } from "./date";
import { CATALYSTS, LORES, SKINS, findItem, type CatalystItem, type Item } from "./items";
import type { ChantRecord } from "./user-store";

const DAY = 24 * 60 * 60 * 1000;
const JST_OFFSET = 9 * 60 * 60 * 1000;

/** 1つの星座になる夜の数 */
export const WEEK_NIGHTS = 7;
/** 7夜そろう星座の数（1〜28日）。29日以降は月末の小さな星座になる */
export const FULL_WEEKS = 4;

export type ChantSession = { subjectId: string; minutes: number };

export type ObservedNight = {
  /** その日の 0 時（JST） */
  date: Date;
  /** その月の何番目の星座か（0〜3 は7夜ずつ、4 は29日以降の月末の夜） */
  week: number;
  /** 星座の中で何夜目か（0 始まり） */
  nightIndex: number;
  /** まだ来ていない日 */
  future: boolean;
  /** 今日（まだ詠唱していなくても、休息の夜とは言わない） */
  today: boolean;
  sessions: ChantSession[];
  minutes: number;
  mp: number;
  /** その日に使った触媒（獲得MPの補正） */
  catalyst: CatalystItem | null;
  drops: Item[];
};

// 決定的な疑似乱数
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/** 数学に偏った、少し特化型の詠唱傾向 */
const SUBJECT_WEIGHTS: [string, number][] = [
  ["s2", 4],
  ["s3", 3],
  ["s1", 2],
  ["s4", 2],
  ["s5", 1],
];

function pickSubject(r: number) {
  const total = SUBJECT_WEIGHTS.reduce((acc, [, w]) => acc + w, 0);
  let cursor = r * total;
  for (const [id, w] of SUBJECT_WEIGHTS) {
    cursor -= w;
    if (cursor < 0) return id;
  }
  return SUBJECT_WEIGHTS[0][0];
}

function pickDrop(seed: number): Item | null {
  if (rand(seed) > 0.4) return null;
  const roll = rand(seed + 1);
  const pool: Item[] = roll < 0.06 ? SKINS.slice(0, 3) : roll < 0.32 ? LORES.slice(0, 11) : CATALYSTS;
  return pool[Math.floor(rand(seed + 2) * pool.length)];
}

/** 月の初め（JST）を delta か月ずらす */
export function addMonths(month: Date, delta: number) {
  const jst = new Date(month.getTime() + JST_OFFSET);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth() + delta, 1) - JST_OFFSET);
}

/** その月（1日 0 時・JST）の夜の数 */
export function daysInMonth(month: Date) {
  return Math.round((addMonths(month, 1).getTime() - month.getTime()) / DAY);
}

/** その月の星座ごとの夜の数（31日の月は [7, 7, 7, 7, 3]、28日の月は [7, 7, 7, 7]） */
export function weekSizes(month: Date) {
  const rest = daysInMonth(month) - FULL_WEEKS * WEEK_NIGHTS;
  const sizes = Array.from({ length: FULL_WEEKS }, () => WEEK_NIGHTS);
  return rest > 0 ? [...sizes, rest] : sizes;
}

type NightBase = Pick<ObservedNight, "date" | "week" | "nightIndex" | "future" | "today">;

/** その月の夜を1日から順に並べる */
function monthDays(month: Date, now: Date): NightBase[] {
  const today = startOfJstDay(now).getTime();
  return Array.from({ length: daysInMonth(month) }, (_, i) => {
    const date = new Date(month.getTime() + i * DAY);
    return {
      date,
      week: Math.floor(i / WEEK_NIGHTS),
      nightIndex: i % WEEK_NIGHTS,
      future: date.getTime() > today,
      today: date.getTime() === today,
    };
  });
}

function mockNight(base: NightBase, rest: boolean): ObservedNight {
  const empty = { ...base, sessions: [], minutes: 0, mp: 0, catalyst: null, drops: [] };
  if (base.future || rest) return empty;

  const seed = Math.floor((base.date.getTime() + JST_OFFSET) / DAY);
  const count = 1 + Math.floor(rand(seed) * 3);
  const sessions = Array.from({ length: count }, (_, i) => ({
    subjectId: pickSubject(rand(seed * 7 + i)),
    minutes: 15 + Math.round(rand(seed * 13 + i) * 19) * 5,
  }));
  const minutes = sessions.reduce((acc, s) => acc + s.minutes, 0);
  const catalyst = rand(seed * 3) < 0.25 ? CATALYSTS[Math.floor(rand(seed * 5) * CATALYSTS.length)] : null;
  const drops = sessions.map((_, i) => pickDrop(seed * 17 + i * 3)).filter((d): d is Item => d !== null);

  return { ...empty, sessions, minutes, mp: Math.round(minutes * (catalyst?.multiplier ?? 1)), catalyst, drops };
}

/** 先月と今月（今日まで）の詠唱履歴のサンプル。先月の10日だけ休息日にして、途切れた星座も見せる */
export function mockObservedNights(now = new Date()): ObservedNight[] {
  const thisMonth = startOfJstMonth(now);
  return [addMonths(thisMonth, -1), thisMonth].flatMap((month, m) =>
    monthDays(month, now)
      .filter((n) => !n.future)
      .map((n) => mockNight(n, m === 0 && n.week === 1 && n.nightIndex === 2)),
  );
}

/** 詠唱履歴のうち最も古い月（履歴がなければ今月）。魔導の軌跡はここまで遡れる */
export function firstChantMonth(history: ChantRecord[], now = new Date()): Date {
  const oldest = history.reduce((min, r) => Math.min(min, new Date(r.date).getTime()), now.getTime());
  return startOfJstMonth(new Date(oldest));
}

/** 保存した詠唱履歴を、その月（1日 0 時・JST）の夜ごとにまとめる */
export function observedNightsFrom(history: ChantRecord[], month: Date, now = new Date()): ObservedNight[] {
  const byDay = new Map<number, ChantRecord[]>();
  for (const r of history) {
    const day = startOfJstDay(new Date(r.date)).getTime();
    byDay.set(day, [...(byDay.get(day) ?? []), r]);
  }

  return monthDays(month, now).map((base) => {
    const records = byDay.get(base.date.getTime()) ?? [];
    const catalyst = records.map((r) => findItem(r.catalystId)).find((item) => item?.kind === "catalyst");
    return {
      ...base,
      sessions: records.map((r) => ({ subjectId: r.subjectId, minutes: r.minutes })),
      minutes: records.reduce((acc, r) => acc + r.minutes, 0),
      mp: records.reduce((acc, r) => acc + r.mp, 0),
      catalyst: catalyst?.kind === "catalyst" ? catalyst : null,
      drops: records
        .flatMap((r) => r.dropIds ?? (r.dropId ? [r.dropId] : []))
        .map((id) => findItem(id))
        .filter((d): d is Item => d !== undefined),
    };
  });
}
