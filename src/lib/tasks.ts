// 試練: 日課の儀式（毎日 0 時に巡り直す）と週間の大誓約（毎週月曜 0 時に巡り直す）。
// 進捗は詠唱履歴から測り直し、受取状況とあわせて保存データの tasks に持つ
import { jstDateKey, startOfJstDay, startOfJstWeek } from "./date";
import { CATALYSTS, type CatalystItem } from "./items";
import type { ChantRecord } from "./user-store";

export type TaskScope = "daily" | "weekly";

export type TaskReward = { kind: "mp"; mp: number } | { kind: "catalyst"; rare: boolean };

export type TaskState = { progress: number; maxProgress: number; isClaimed: boolean };

export type TaskBoard = {
  /** この進捗が属する期間（日課は当日、大誓約は週初めの月曜。JST, YYYY-MM-DD） */
  periodKey: string;
  items: Record<string, TaskState>;
};

export type TaskDef = {
  id: string;
  scope: TaskScope;
  title: string;
  description: string;
  unit: string;
  reward: TaskReward;
};

/** 回数・科目を数える試練で1回と数える詠唱の長さ（日数は1日の合計で見る）。短い詠唱を細切れにして数を稼げないよう、最短の詠唱時間に揃える */
export const COUNTED_CHANT_MIN_MINUTES = 15;

export const TASKS: TaskDef[] = [
  { id: "d-visit", scope: "daily", title: "毎日の訪れ", description: "星天の導きを受け取り、今宵の探求を始める", unit: "回", reward: { kind: "mp", mp: 20 } },
  { id: "d-focus", scope: "daily", title: "秘術の集束", description: "合計25分以上の詠唱を完了する", unit: "分", reward: { kind: "mp", mp: 50 } },
  {
    id: "d-domain",
    scope: "daily",
    title: "領域の探求",
    description: `主軸科目で${COUNTED_CHANT_MIN_MINUTES}分以上の詠唱を2回行う（未設定なら詠唱に使う科目のいずれか）`,
    unit: "回",
    reward: { kind: "catalyst", rare: false },
  },
  { id: "w-total", scope: "weekly", title: "週間の積鑽", description: "週間合計120分以上の詠唱を達成する", unit: "分", reward: { kind: "mp", mp: 200 } },
  {
    id: "w-all",
    scope: "weekly",
    title: "全領域の調律",
    description: `詠唱に使う全科目（魔法陣の全領域）で、それぞれ${COUNTED_CHANT_MIN_MINUTES}分以上の詠唱を行う`,
    unit: "領域",
    reward: { kind: "catalyst", rare: true },
  },
  { id: "w-days", scope: "weekly", title: "継続の印", description: `週のうち4日以上、1日合計${COUNTED_CHANT_MIN_MINUTES}分以上の詠唱を行う`, unit: "日", reward: { kind: "mp", mp: 150 } },
];

export type TaskContext = {
  history: ChantRecord[];
  /** 詠唱に使う科目 ID */
  activeSubjectIds: string[];
  /** 主軸科目 ID */
  mainSubjectId: string | null;
  /** 本日の星天の導きを受け取ったか */
  guidanceClaimed: boolean;
  now: Date;
};

function periodStart(scope: TaskScope, now: Date) {
  return scope === "daily" ? startOfJstDay(now) : startOfJstWeek(now);
}

export function periodKey(scope: TaskScope, now: Date) {
  return jstDateKey(periodStart(scope, now));
}

/** 試練の現在の進捗 */
export function measureTask(def: TaskDef, { history, activeSubjectIds, mainSubjectId, guidanceClaimed, now }: TaskContext) {
  const since = periodStart(def.scope, now).getTime();
  const records = history.filter((r) => new Date(r.date).getTime() >= since);
  const minutes = records.reduce((acc, r) => acc + r.minutes, 0);
  const countedChants = records.filter((r) => r.minutes >= COUNTED_CHANT_MIN_MINUTES);
  const [progress, maxProgress] = (() => {
    switch (def.id) {
      case "d-visit":
        return [guidanceClaimed ? 1 : 0, 1];
      case "d-focus":
        return [minutes, 25];
      case "d-domain": {
        const main = mainSubjectId && activeSubjectIds.includes(mainSubjectId) ? mainSubjectId : null;
        return [countedChants.filter((r) => (main ? r.subjectId === main : activeSubjectIds.includes(r.subjectId))).length, 2];
      }
      case "w-total":
        return [minutes, 120];
      case "w-all":
        return [new Set(countedChants.map((r) => r.subjectId).filter((id) => activeSubjectIds.includes(id))).size, activeSubjectIds.length];
      case "w-days": {
        // 1日の合計で見る。10分を2回でも、その日に学んだことに変わりはない
        const perDay = new Map<string, number>();
        for (const r of records) {
          const day = jstDateKey(new Date(r.date));
          perDay.set(day, (perDay.get(day) ?? 0) + r.minutes);
        }
        return [[...perDay.values()].filter((m) => m >= COUNTED_CHANT_MIN_MINUTES).length, 4];
      }
      default:
        return [0, 1];
    }
  })();
  return { progress: Math.min(progress, maxProgress), maxProgress };
}

/** 触媒の報酬: 通常は宝箱と同じ重みで抽選、稀少なら最も稀な触媒 */
export function drawCatalyst(rare: boolean, random: () => number = Math.random): CatalystItem {
  if (rare) return CATALYSTS.reduce((a, b) => (b.weight < a.weight ? b : a));
  const total = CATALYSTS.reduce((acc, c) => acc + c.weight, 0);
  let roll = random() * total;
  for (const c of CATALYSTS) {
    roll -= c.weight;
    if (roll < 0) return c;
  }
  return CATALYSTS[0];
}
