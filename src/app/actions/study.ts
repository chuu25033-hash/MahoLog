"use server";

import { revalidatePath } from "next/cache";
import { DAILY_LIMIT_MINUTES } from "@/lib/game";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { StudyMode } from "@/lib/types";

export type SaveStudyLogResult =
  | { ok: true; savedMinutes: number; beforeMp: number; afterMp: number }
  | { ok: false; error: string };

export async function saveStudyLog(input: {
  subjectId: string;
  minutes: number;
  mode: StudyMode;
  /** デモモード用: 現在の累積MP */
  demoTotalMp?: number;
}): Promise<SaveStudyLogResult> {
  const minutes = Math.floor(input.minutes);
  if (!Number.isFinite(minutes) || minutes < 1) {
    return { ok: false, error: "1分未満の記録は保存されません" };
  }
  if (input.mode !== "pomodoro" && input.mode !== "stopwatch") {
    return { ok: false, error: "不正なモードです" };
  }
  const requested = Math.min(minutes, DAILY_LIMIT_MINUTES);

  if (!isSupabaseConfigured) {
    const before = input.demoTotalMp ?? 0;
    return { ok: true, savedMinutes: requested, beforeMp: before, afterMp: before + requested };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return { ok: false, error: "ログインが必要です" };

  const before = await supabase
    .from("profiles")
    .select("total_study_time")
    .eq("id", userId)
    .single();
  if (before.error) return { ok: false, error: before.error.message };

  // 1日12時間の上限は DB トリガーで切り詰められる（超過時は行が返らない）
  const inserted = await supabase
    .from("study_logs")
    .insert({ user_id: userId, subject_id: input.subjectId, duration_minutes: requested, mode: input.mode })
    .select("duration_minutes")
    .maybeSingle();
  if (inserted.error) return { ok: false, error: inserted.error.message };

  const savedMinutes = inserted.data?.duration_minutes ?? 0;
  if (savedMinutes === 0) {
    return { ok: false, error: "本日の記録上限（12時間）に達しています" };
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    savedMinutes,
    beforeMp: before.data.total_study_time,
    afterMp: before.data.total_study_time + savedMinutes,
  };
}
