import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { PageLoading } from "@/components/page-loading";
import { TimerPanel } from "@/components/timer/timer-panel";
import { getTimerData } from "@/lib/data";

async function TimerContent() {
  const { profile, subjects, weekTotals, todayMinutes } = await getTimerData();

  return (
    <TimerPanel
      subjects={subjects}
      initialTotalMp={profile.total_study_time}
      initialWeekTotals={weekTotals}
      todayMinutes={todayMinutes}
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
