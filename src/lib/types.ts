export type StudyMode = "pomodoro" | "stopwatch";

export type Profile = {
  id: string;
  username: string;
  avatar_url: string;
  total_study_time: number;
  current_level: number;
};

export type Subject = {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  sort_order: number;
};

export type StudyLog = {
  id: string;
  subject_id: string;
  /** 詳細科目（端末の詠唱履歴だけが持つ） */
  sub_subject?: string | null;
  duration_minutes: number;
  mode: StudyMode;
  created_at: string;
  /** 後から書き留めた記録 */
  manual?: boolean;
};

/** レーダーチャート1軸分 */
export type SubjectTotal = {
  /** 軸の鍵（主科目 ID か「科目 ID::詳細科目」） */
  key: string;
  subjectId: string;
  /** 詳細科目の軸なら、その詳細科目 */
  subSubject: string | null;
  name: string;
  color: string;
  minutes: number;
};
