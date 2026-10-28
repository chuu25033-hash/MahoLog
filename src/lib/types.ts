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
  duration_minutes: number;
  mode: StudyMode;
  created_at: string;
};

/** レーダーチャート1軸分 */
export type SubjectTotal = {
  subjectId: string;
  name: string;
  color: string;
  minutes: number;
};
