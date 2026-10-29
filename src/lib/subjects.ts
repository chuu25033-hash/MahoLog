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

/** 保存された詳細科目を、その主科目で使える値に整える */
export function resolveSubSubject(subject: Pick<Subject, "name"> | undefined, subSubject: string | null | undefined) {
  if (!subSubject) return null;
  if (isCustomSubject(subject)) return subSubject.trim().slice(0, CUSTOM_SUB_SUBJECT_MAX) || null;
  return subSubjectsOf(subject).includes(subSubject) ? subSubject : null;
}
