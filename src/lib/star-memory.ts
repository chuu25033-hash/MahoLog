// 魔導の軌跡（詠唱履歴の星図）用の夜ごとの詠唱履歴。
// サンプル（mockObservedNights）は日付から決定的に生成するので、同じ日に何度開いても同じ星図になる。
import { startOfJstDay, startOfJstWeek } from "./date";
import { CATALYSTS, LORES, SKINS, findItem, type CatalystItem, type Item } from "./items";
import type { ChantRecord } from "./user-store";

const DAY = 24 * 60 * 60 * 1000;
const JST_OFFSET = 9 * 60 * 60 * 1000;

/** 星図に並べる週数（直近4週間 ≒ 1か月） */
export const MEMORY_WEEKS = 4;

export type ChantSession = { subjectId: string; minutes: number };

export type ObservedNight = {
  /** その日の 0 時（JST） */
  date: Date;
  /** 古い方から数えた週（0 始まり） */
  week: number;
  /** 月曜 0 〜 日曜 6 */
  weekday: number;
  /** まだ来ていない日 */
  future: boolean;
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

function night(date: Date, week: number, weekday: number, future: boolean, rest: boolean): ObservedNight {
  const empty = { date, week, weekday, future, sessions: [], minutes: 0, mp: 0, catalyst: null, drops: [] };
  if (future || rest) return empty;

  const seed = Math.floor((date.getTime() + JST_OFFSET) / DAY);
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

/** 直近 MEMORY_WEEKS 週分（今週の残りの日は未詠唱）の詠唱履歴 */
export function mockObservedNights(now = new Date()): ObservedNight[] {
  const today = startOfJstDay(now).getTime();
  const first = startOfJstWeek(now).getTime() - (MEMORY_WEEKS - 1) * 7 * DAY;

  return Array.from({ length: MEMORY_WEEKS * 7 }, (_, i) => {
    const date = new Date(first + i * DAY);
    const week = Math.floor(i / 7);
    // 最初の週の土曜だけ休息日にして、星座が途切れた週も見せる
    return night(date, week, i % 7, date.getTime() > today, week === 0 && i % 7 === 5);
  });
}

/** 保存した詠唱履歴を、直近 MEMORY_WEEKS 週分の夜ごとにまとめる */
export function observedNightsFrom(history: ChantRecord[], now = new Date()): ObservedNight[] {
  const today = startOfJstDay(now).getTime();
  const first = startOfJstWeek(now).getTime() - (MEMORY_WEEKS - 1) * 7 * DAY;
  const byDay = new Map<number, ChantRecord[]>();
  for (const r of history) {
    const day = startOfJstDay(new Date(r.date)).getTime();
    byDay.set(day, [...(byDay.get(day) ?? []), r]);
  }

  return Array.from({ length: MEMORY_WEEKS * 7 }, (_, i) => {
    const date = new Date(first + i * DAY);
    const records = byDay.get(date.getTime()) ?? [];
    const catalyst = records.map((r) => findItem(r.catalystId)).find((item) => item?.kind === "catalyst");
    return {
      date,
      week: Math.floor(i / 7),
      weekday: i % 7,
      future: date.getTime() > today,
      sessions: records.map((r) => ({ subjectId: r.subjectId, minutes: r.minutes })),
      minutes: records.reduce((acc, r) => acc + r.minutes, 0),
      mp: records.reduce((acc, r) => acc + r.mp, 0),
      catalyst: catalyst?.kind === "catalyst" ? catalyst : null,
      drops: records.map((r) => findItem(r.dropId)).filter((d): d is Item => d !== undefined),
    };
  });
}
