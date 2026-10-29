import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { DashboardView } from "@/components/dashboard-view";
import { PageLoading } from "@/components/page-loading";
import { getDashboardData } from "@/lib/data";

async function HomeContent() {
  const { subjects, isDemo, ...summary } = await getDashboardData();
  return <DashboardView summary={summary} subjects={subjects} isDemo={isDemo} />;
}

export default function HomePage() {
  return (
    <AppShell>
      <Suspense fallback={<PageLoading />}>
        <HomeContent />
      </Suspense>
    </AppShell>
  );
}
