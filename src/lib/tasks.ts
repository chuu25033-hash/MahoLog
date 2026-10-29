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

export const TASKS: TaskDef[] = [
  { id: "d-visit", scope: "daily", title: "毎日の訪れ", description: "マホログを訪れる", unit: "回", reward: { kind: "mp", mp: 20 } },
  { id: "d-focus", scope: "daily", title: "秘術の集束", description: "合計25分以上の詠唱を完了する", unit: "分", reward: { kind: "mp", mp: 50 } },
  {
    id: "d-domain",
    scope: "daily",
    title: "領域の探求",
    description: "主軸科目で2回以上詠唱する（未設定なら詠唱に使う科目のいずれか）",
    unit: "回",
    reward: { kind: "catalyst", rare: false },
  },
  { id: "w-total", scope: "weekly", title: "週間の積鑽", description: "週間合計120分以上の詠唱を達成する", unit: "分", reward: { kind: "mp", mp: 200 } },
  {
    id: "w-all",
    scope: "weekly",
    title: "全領域の調律",
    description: "詠唱に使う全科目（魔法陣の全領域）で各1回以上詠唱する",
    unit: "領域",
    reward: { kind: "catalyst", rare: true },
  },
  { id: "w-days", scope: "weekly", title: "継続の印", description: "週のうち4日以上詠唱を行う", unit: "日", reward: { kind: "mp", mp: 150 } },
];

export type TaskContext = {
  history: ChantRecord[];
  /** 詠唱に使う科目 ID */
  activeSubjectIds: string[];
  /** 主軸科目 ID */
  mainSubjectId: string | null;
  now: Date;
};

function periodStart(scope: TaskScope, now: Date) {
  return scope === "daily" ? startOfJstDay(now) : startOfJstWeek(now);
}

export function periodKey(scope: TaskScope, now: Date) {
  return jstDateKey(periodStart(scope, now));
}

/** 試練の現在の進捗 */
export function measureTask(def: TaskDef, { history, activeSubjectIds, mainSubjectId, now }: TaskContext) {
  const since = periodStart(def.scope, now).getTime();
  const records = history.filter((r) => new Date(r.date).getTime() >= since);
  const minutes = records.reduce((acc, r) => acc + r.minutes, 0);
  const [progress, maxProgress] = (() => {
    switch (def.id) {
      case "d-visit":
        return [1, 1];
      case "d-focus":
        return [minutes, 25];
      case "d-domain": {
        const main = mainSubjectId && activeSubjectIds.includes(mainSubjectId) ? mainSubjectId : null;
        return [records.filter((r) => (main ? r.subjectId === main : activeSubjectIds.includes(r.subjectId))).length, 2];
      }
      case "w-total":
        return [minutes, 120];
      case "w-all":
        return [new Set(records.map((r) => r.subjectId).filter((id) => activeSubjectIds.includes(id))).size, activeSubjectIds.length];
      case "w-days":
        return [new Set(records.map((r) => jstDateKey(new Date(r.date)))).size, 4];
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
