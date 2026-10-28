import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { startOfJstDay, startOfJstMonth, startOfJstWeek } from "./date";
import { demoLogs, demoProfile, demoSubjects } from "./demo";
import { isSupabaseConfigured } from "./supabase/config";
import { createClient } from "./supabase/server";
import type { Profile, StudyLog, Subject, SubjectTotal } from "./types";

async function loadUserData(since: Date): Promise<{
  profile: Profile;
  subjects: Subject[];
  logs: StudyLog[];
}> {
  if (!isSupabaseConfigured) {
    return {
      profile: demoProfile,
      subjects: demoSubjects,
      logs: demoLogs().filter((l) => new Date(l.created_at) >= since),
    };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) redirect("/login");

  const [profile, subjects, logs] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, avatar_url, total_study_time, current_level")
      .eq("id", userId)
      .single(),
    supabase
      .from("subjects")
      .select("id, name, color, is_active, sort_order")
      .eq("user_id", userId)
      .order("sort_order"),
    supabase
      .from("study_logs")
      .select("id, subject_id, duration_minutes, mode, created_at")
      .eq("user_id", userId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false }),
  ]);

  if (profile.error) throw profile.error;
  if (subjects.error) throw subjects.error;
  if (logs.error) throw logs.error;

  return { profile: profile.data, subjects: subjects.data, logs: logs.data as StudyLog[] };
}

function sumSince(logs: StudyLog[], since: Date) {
  return logs
    .filter((l) => new Date(l.created_at) >= since)
    .reduce((acc, l) => acc + l.duration_minutes, 0);
}

function totalsBySubject(subjects: Subject[], logs: StudyLog[], since: Date): SubjectTotal[] {
  return subjects.map((s) => ({
    subjectId: s.id,
    name: s.name,
    color: s.color,
    minutes: logs
      .filter((l) => l.subject_id === s.id && new Date(l.created_at) >= since)
      .reduce((acc, l) => acc + l.duration_minutes, 0),
  }));
}

export async function getDashboardData() {
  await connection(); // 現在時刻で集計するため常にリクエスト時に描画
  const now = new Date();
  const today = startOfJstDay(now);
  const week = startOfJstWeek(now);
  const month = startOfJstMonth(now);
  const since = week < month ? week : month;

  const { profile, subjects, logs } = await loadUserData(since);
  const active = subjects.filter((s) => s.is_active);

  return {
    profile,
    totals: {
      today: sumSince(logs, today),
      week: sumSince(logs, week),
      month: sumSince(logs, month),
    },
    radar: {
      week: totalsBySubject(active, logs, week),
      month: totalsBySubject(active, logs, month),
    },
    recentLogs: logs.slice(0, 5).map((l) => ({
      ...l,
      subject: subjects.find((s) => s.id === l.subject_id),
    })),
    isDemo: !isSupabaseConfigured,
  };
}

export async function getTimerData() {
  await connection();
  const now = new Date();
  const week = startOfJstWeek(now);
  const { profile, subjects, logs } = await loadUserData(week);
  const active = subjects.filter((s) => s.is_active);

  return {
    profile,
    subjects: active,
    weekTotals: totalsBySubject(active, logs, week),
    todayMinutes: sumSince(logs, startOfJstDay(now)),
    isDemo: !isSupabaseConfigured,
  };
}
