// 累積MP（= 累計勉強分）からレベル・ステージを導出する。
// レベル式は supabase/migrations の public.calc_level と同一に保つこと。

export const DAILY_LIMIT_MINUTES = 12 * 60;

/** Lv.L に到達するのに必要な累積MP */
export function levelThreshold(level: number): number {
  if (level <= 1) return 0;
  if (level <= 10) return level * 60;
  if (level <= 30) return 600 + (level - 10) * 120;
  return 3000 + (level - 30) * 180;
}

export function calcLevel(totalMp: number): number {
  if (totalMp < 600) return Math.max(1, Math.floor(totalMp / 60));
  if (totalMp < 3000) return 10 + Math.floor((totalMp - 600) / 120);
  return 30 + Math.floor((totalMp - 3000) / 180);
}

export function levelProgress(totalMp: number) {
  const level = calcLevel(totalMp);
  const start = levelThreshold(level);
  const next = levelThreshold(level + 1);
  return {
    level,
    current: totalMp - start,
    required: next - start,
    remaining: next - totalMp,
    ratio: (totalMp - start) / (next - start),
  };
}

export type Stage = {
  id: number;
  name: string;
  /** 解放に必要な累計時間（時間） */
  requiredHours: number;
  description: string;
  /** 背景グラデーション（Tailwind クラス） */
  gradient: string;
};

export const STAGES: Stage[] = [
  { id: 1, name: "始まりの書斎", requiredHours: 0, description: "古びた魔導書が眠る、見習いの小部屋", gradient: "from-amber-900/60 via-stone-900 to-stone-950" },
  { id: 2, name: "樹海の図書室", requiredHours: 10, description: "苔むした書架が森に溶け込む秘密の図書室", gradient: "from-emerald-900/60 via-teal-950 to-slate-950" },
  { id: 3, name: "星空の観測塔", requiredHours: 30, description: "星の運行から魔力の流れを読み解く塔", gradient: "from-indigo-900/70 via-violet-950 to-slate-950" },
  { id: 4, name: "蒼氷の大回廊", requiredHours: 60, description: "凍てつく静寂が集中を研ぎ澄ます回廊", gradient: "from-sky-900/60 via-cyan-950 to-slate-950" },
  { id: 5, name: "紅蓮の魔導炉", requiredHours: 100, description: "膨大な魔力を練り上げる灼熱の炉", gradient: "from-rose-900/60 via-orange-950 to-stone-950" },
  { id: 6, name: "天空の大聖堂", requiredHours: 200, description: "大魔法使いだけが辿り着く雲上の聖域", gradient: "from-yellow-700/50 via-fuchsia-950 to-slate-950" },
];

export function stageProgress(totalMp: number) {
  const hours = totalMp / 60;
  let index = 0;
  STAGES.forEach((s, i) => {
    if (hours >= s.requiredHours) index = i;
  });
  const current = STAGES[index];
  const next = STAGES[index + 1] ?? null;
  if (!next) return { current, next, ratio: 1, remainingMinutes: 0 };

  const startMp = current.requiredHours * 60;
  const endMp = next.requiredHours * 60;
  return {
    current,
    next,
    ratio: (totalMp - startMp) / (endMp - startMp),
    remainingMinutes: endMp - totalMp,
  };
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}
