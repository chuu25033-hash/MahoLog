"use client";

import type { ComponentProps } from "react";
import { PageLoading } from "@/components/page-loading";
import { timerSummary } from "@/lib/aggregate";
import { activeSubjectsOf } from "@/lib/subjects";
import { localStudyLogs, useStoredUserData } from "@/lib/user-store";
import { TimerPanel } from "./timer-panel";

/**
 * 詠唱画面。設定（詠唱に使う科目・詠唱時間・主軸科目）は端末に保存したものを使い、
 * デモモードでは観測データもそこから始める
 */
export function TimerView(props: ComponentProps<typeof TimerPanel>) {
  const stored = useStoredUserData();
  if (!stored) return <PageLoading />;
  const subjects = activeSubjectsOf(props.subjects, stored.userProfile.activeSubjects);
  const settings = {
    initialFocusMin: stored.settings.defaultFocusMinutes,
    initialSubjectId: stored.userProfile.subject,
    initialSubSubject: stored.userProfile.subSubject,
  };
  if (!props.isDemo) {
    const weekTotals = props.initialWeekTotals.filter((t) => subjects.some((s) => s.id === t.subjectId));
    return <TimerPanel {...props} {...settings} subjects={subjects} initialWeekTotals={weekTotals} />;
  }
  // TimerPanel は初期値だけを使い、以降の更新は自身の状態で持つ
  const { weekTotals, todayMinutes } = timerSummary(subjects, localStudyLogs(stored));
  return (
    <TimerPanel
      {...props}
      {...settings}
      subjects={subjects}
      initialTotalMp={stored.userProfile.totalMp}
      initialWeekTotals={weekTotals}
      todayMinutes={todayMinutes}
    />
  );
}
