import type { Profile, StudyLog, Subject } from "./types";

// Supabase 未設定時に表示するサンプルデータ
export const demoProfile: Profile = {
  id: "demo",
  username: "見習いのルナ",
  avatar_url: "wizard-1",
  total_study_time: 1530,
  current_level: 17,
};

export const demoSubjects: Subject[] = [
  { id: "s1", name: "国語", color: "#f472b6", is_active: true, sort_order: 1 },
  { id: "s2", name: "数学", color: "#60a5fa", is_active: true, sort_order: 2 },
  { id: "s3", name: "英語", color: "#34d399", is_active: true, sort_order: 3 },
  { id: "s4", name: "理科", color: "#fbbf24", is_active: true, sort_order: 4 },
  { id: "s5", name: "社会", color: "#c084fc", is_active: true, sort_order: 5 },
];

const plan: [string, number, number][] = [
  // [subjectId, 何日前, 分]
  ["s2", 0, 50], ["s3", 0, 25], ["s2", 1, 90], ["s1", 2, 30], ["s2", 2, 60],
  ["s3", 3, 45], ["s4", 4, 25], ["s2", 5, 120], ["s5", 6, 30], ["s2", 9, 60],
  ["s1", 12, 50], ["s3", 15, 90], ["s4", 18, 60], ["s2", 22, 75], ["s5", 26, 40],
];

export function demoLogs(now = new Date()): StudyLog[] {
  return plan.map(([subject_id, daysAgo, duration_minutes], i) => ({
    id: `l${i}`,
    subject_id,
    duration_minutes,
    mode: i % 2 === 0 ? "pomodoro" : "stopwatch",
    created_at: new Date(now.getTime() - daysAgo * 86_400_000 - i * 60_000).toISOString(),
  }));
}
