// 主科目（大カテゴリ）ごとの詳細科目。科目名で引くので、Supabase の科目も名前が同じなら同じ分類になる
import type { Subject } from "./types";

/** 詳細科目を自由記述する主科目 */
export const CUSTOM_SUBJECT_NAME = "カスタム";
export const CUSTOM_SUB_SUBJECT_MAX = 20;

const SUB_SUBJECTS: Record<string, readonly string[]> = {
  国語: ["現代文", "古文", "漢文", "国語全般"],
  数学: ["数学I・A", "数学II・B", "数学III・C", "高度数学"],
  英語: ["英語長文", "単語・文法", "英会話", "資格英語(TOEIC等)"],
  理科: ["物理", "化学", "生物", "地学", "科学全般"],
  社会: ["日本史", "世界史", "地理", "政経・倫理"],
  情報: ["情報", "プログラミング", "Web開発", "情報処理試験"],
};

export function isCustomSubject(subject: Pick<Subject, "name"> | undefined) {
  return subject?.name === CUSTOM_SUBJECT_NAME;
}

/** 主科目で選べる詳細科目（カスタム・未分類の科目は空） */
export function subSubjectsOf(subject: Pick<Subject, "name"> | undefined): readonly string[] {
  return (subject && SUB_SUBJECTS[subject.name]) ?? [];
}

/**
 * 保存された詳細科目を、その主科目で使える値に整える。
 * limit: 詳細科目だけを魔法陣の軸にした主科目で選べる詳細科目。渡されれば必ずその中から選ぶ
 */
export function resolveSubSubject(
  subject: Pick<Subject, "name"> | undefined,
  subSubject: string | null | undefined,
  limit?: readonly string[],
) {
  if (limit && limit.length > 0) return subSubject && limit.includes(subSubject) ? subSubject : limit[0];
  if (!subSubject) return null;
  if (isCustomSubject(subject)) return subSubject.trim().slice(0, CUSTOM_SUB_SUBJECT_MAX) || null;
  return subSubjectsOf(subject).includes(subSubject) ? subSubject : null;
}

/** 魔法陣（N角形）を組むのに必要な最小の軸の数 */
export const MIN_ACTIVE_SUBJECTS = 3;
/** 魔法陣の頂点の上限。これより多いと頂点の名前が重なって読めない */
export const MAX_ACTIVE_SUBJECTS = 12;
/**
 * 魔法陣の1軸。主科目まるごとか、主科目の中の詳細科目ひとつ。
 * 保存するときの鍵は、主科目なら科目 ID、詳細科目なら「科目 ID::詳細科目」
 */
export type RadarAxis<T extends Pick<Subject, "id" | "name"> = Subject> = {
  key: string;
  subjectId: string;
  subSubject: string | null;
  subject: T;
};

const AXIS_SEP = "::";

export function axisKey(subjectId: string, subSubject: string | null) {
  return subSubject ? `${subjectId}${AXIS_SEP}${subSubject}` : subjectId;
}

export function parseAxisKey(key: string): { subjectId: string; subSubject: string | null } {
  const at = key.indexOf(AXIS_SEP);
  return at < 0 ? { subjectId: key, subSubject: null } : { subjectId: key.slice(0, at), subSubject: key.slice(at + AXIS_SEP.length) };
}

/** 詳細科目を魔法陣の軸にできる主科目か（カスタムは自由記述なので軸にしない） */
export function canSplitSubject(subject: Pick<Subject, "name">) {
  return !isCustomSubject(subject) && subSubjectsOf(subject).length > 0;
}

/** 設定画面で選んだ魔法陣の軸を、科目の並び順にそろえて返す。未設定・足りない場合はすべての主科目を使う */
export function radarAxesOf<T extends Pick<Subject, "id" | "name">>(subjects: T[], activeKeys: string[] | null | undefined): RadarAxis<T>[] {
  const whole = subjects.map((s) => ({ key: s.id, subjectId: s.id, subSubject: null, subject: s }));
  if (!activeKeys) return whole;
  const axes = subjects.flatMap((s) => [
    ...(activeKeys.includes(s.id) ? [{ key: s.id, subjectId: s.id, subSubject: null, subject: s }] : []),
    ...(canSplitSubject(s) ? subSubjectsOf(s) : [])
      .filter((sub) => activeKeys.includes(axisKey(s.id, sub)))
      .map((sub) => ({ key: axisKey(s.id, sub), subjectId: s.id, subSubject: sub, subject: s })),
  ]);
  // 上限より前に保存した選択が多すぎても、科目の並びで先の12軸までにする
  return axes.length >= MIN_ACTIVE_SUBJECTS ? axes.slice(0, MAX_ACTIVE_SUBJECTS) : whole;
}

/** 設定画面で選んだ「詠唱に使う科目」（魔法陣の軸を持つ主科目）。未設定・足りない場合はすべての科目を使う */
export function activeSubjectsOf<T extends Pick<Subject, "id" | "name">>(subjects: T[], activeKeys: string[] | null | undefined): T[] {
  const ids = new Set(radarAxesOf(subjects, activeKeys).map((a) => a.subjectId));
  return subjects.filter((s) => ids.has(s.id));
}

/** 詳細科目だけを軸にした主科目ごとの、詠唱で選べる詳細科目（主科目まるごとを軸にした科目は含めない） */
export function subSubjectLimitsOf(axes: RadarAxis<Pick<Subject, "id" | "name">>[]): Record<string, string[]> {
  const limits: Record<string, string[]> = {};
  for (const a of axes) if (a.subSubject) (limits[a.subjectId] ??= []).push(a.subSubject);
  for (const a of axes) if (!a.subSubject) delete limits[a.subjectId];
  return limits;
}
