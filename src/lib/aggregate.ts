// 詠唱記録の集計（サーバー・クライアント共通）
import { startOfJstDay, startOfJstMonth, startOfJstWeek } from "./date";
import { radarAxesOf, type RadarAxis } from "./subjects";
import type { Profile, StudyLog, Subject, SubjectTotal } from "./types";

export function sumSince(logs: StudyLog[], since: Date) {
  return logs
    .filter((l) => new Date(l.created_at) >= since)
    .reduce((acc, l) => acc + l.duration_minutes, 0);
}

export function totalsBySubject(subjects: Subject[], logs: StudyLog[], since: Date): SubjectTotal[] {
  return totalsByAxis(radarAxesOf(subjects, null), logs, since);
}

/** 魔法陣の軸ごとの合計。詳細科目の軸は、その詳細科目で刻んだ詠唱だけを数える */
export function totalsByAxis(axes: RadarAxis[], logs: StudyLog[], since: Date): SubjectTotal[] {
  return axes.map((a) => ({
    key: a.key,
    subjectId: a.subjectId,
    subSubject: a.subSubject,
    name: a.subSubject ?? a.subject.name,
    color: a.subject.color,
    minutes: logs
      .filter((l) => l.subject_id === a.subjectId && (!a.subSubject || l.sub_subject === a.subSubject) && new Date(l.created_at) >= since)
      .reduce((acc, l) => acc + l.duration_minutes, 0),
  }));
}

/** ホーム（魔術書庫）の集計 */
export function dashboardSummary(profile: Profile, subjects: Subject[], logs: StudyLog[], now = new Date()) {
  const active = subjects.filter((s) => s.is_active);
  const week = startOfJstWeek(now);
  const month = startOfJstMonth(now);
  const recent = [...logs].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);

  return {
    profile,
    totals: {
      today: sumSince(logs, startOfJstDay(now)),
      week: sumSince(logs, week),
      month: sumSince(logs, month),
    },
    radar: {
      week: totalsBySubject(active, logs, week),
      month: totalsBySubject(active, logs, month),
    },
    recentLogs: recent.map((l) => ({ ...l, subject: subjects.find((s) => s.id === l.subject_id) })),
  };
}

export type DashboardSummary = ReturnType<typeof dashboardSummary>;

/** 詠唱画面の集計 */
export function timerSummary(subjects: Subject[], logs: StudyLog[], now = new Date()) {
  const active = subjects.filter((s) => s.is_active);
  return {
    subjects: active,
    weekTotals: totalsBySubject(active, logs, startOfJstWeek(now)),
    todayMinutes: sumSince(logs, startOfJstDay(now)),
  };
}
