"use client";

import type { ComponentProps } from "react";
import { PageLoading } from "@/components/page-loading";
import { timerSummary } from "@/lib/aggregate";
import { localStudyLogs, useStoredUserData } from "@/lib/user-store";
import { TimerPanel } from "./timer-panel";

/** 詠唱画面。設定（詠唱時間・主軸科目）は端末に保存したものを使い、デモモードでは観測データもそこから始める */
export function TimerView(props: ComponentProps<typeof TimerPanel>) {
  const stored = useStoredUserData();
  if (!stored) return <PageLoading />;
  const { defaultFocusMinutes, mainSubjectId } = stored.settings;
  const settings = { initialFocusMin: defaultFocusMinutes, initialSubjectId: mainSubjectId };
  if (!props.isDemo) return <TimerPanel {...props} {...settings} />;
  // TimerPanel は初期値だけを使い、以降の更新は自身の状態で持つ
  const { weekTotals, todayMinutes } = timerSummary(props.subjects, localStudyLogs(stored));
  return (
    <TimerPanel
      {...props}
      {...settings}
      initialTotalMp={stored.userProfile.totalMp}
      initialWeekTotals={weekTotals}
      todayMinutes={todayMinutes}
    />
  );
}
