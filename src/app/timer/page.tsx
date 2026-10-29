import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { PageLoading } from "@/components/page-loading";
import { TimerView } from "@/components/timer/timer-view";
import { getTimerData } from "@/lib/data";

async function TimerContent() {
  const { profile, subjects, weekTotals, todayMinutes, isDemo } = await getTimerData();

  return (
    <TimerView
      subjects={subjects}
      initialTotalMp={profile.total_study_time}
      initialWeekTotals={weekTotals}
      todayMinutes={todayMinutes}
      isDemo={isDemo}
    />
  );
}

export default function TimerPage() {
  return (
    <AppShell>
      <Suspense fallback={<PageLoading />}>
        <TimerContent />
      </Suspense>
    </AppShell>
  );
}
