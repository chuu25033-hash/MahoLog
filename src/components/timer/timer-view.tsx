"use client";

import type { ComponentProps } from "react";
import { PageLoading } from "@/components/page-loading";
import { timerSummary } from "@/lib/aggregate";
import { localStudyLogs, useStoredUserData } from "@/lib/user-store";
import { TimerPanel } from "./timer-panel";

/** 詠唱画面。デモモードでは端末に保存した観測データから始める */
export function TimerView(props: ComponentProps<typeof TimerPanel>) {
  const stored = useStoredUserData();
  if (!props.isDemo) return <TimerPanel {...props} />;
  if (!stored) return <PageLoading />;
  // TimerPanel は初期値だけを使い、以降の更新は自身の状態で持つ
  const { weekTotals, todayMinutes } = timerSummary(props.subjects, localStudyLogs(stored));
  return (
    <TimerPanel
      {...props}
      initialTotalMp={stored.userProfile.totalMp}
      initialWeekTotals={weekTotals}
      todayMinutes={todayMinutes}
    />
  );
}
