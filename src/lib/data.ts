import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { dashboardSummary, timerSummary } from "./aggregate";
import { startOfJstMonth, startOfJstWeek } from "./date";
import { demoLogs, demoProfile, demoSubjects } from "./demo";
import { isSupabaseConfigured } from "./supabase/config";
import { createClient } from "./supabase/server";
import type { Profile, StudyLog, Subject } from "./types";

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

export async function getDashboardData() {
  await connection(); // 現在時刻で集計するため常にリクエスト時に描画
  const now = new Date();
  const week = startOfJstWeek(now);
  const month = startOfJstMonth(now);
  const { profile, subjects, logs } = await loadUserData(week < month ? week : month);

  return { ...dashboardSummary(profile, subjects, logs, now), subjects, isDemo: !isSupabaseConfigured };
}

export async function getSettingsData() {
  await connection();
  const { subjects } = await loadUserData(new Date());

  return { subjects: subjects.filter((s) => s.is_active), isDemo: !isSupabaseConfigured };
}

/** 星天の塔: 累積MP（周天の制覇・儀式の判定に使う）だけを読む */
export async function getZenithData() {
  await connection();
  const { profile } = await loadUserData(new Date());

  return { totalMp: profile.total_study_time, isDemo: !isSupabaseConfigured };
}

export async function getTimerData() {
  await connection();
  const now = new Date();
  const { profile, subjects, logs } = await loadUserData(startOfJstWeek(now));

  return { profile, ...timerSummary(subjects, logs, now), isDemo: !isSupabaseConfigured };
}
