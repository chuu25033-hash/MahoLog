import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { PageLoading } from "@/components/page-loading";
import { ZenithView } from "@/components/zenith/zenith-view";
import { getZenithData } from "@/lib/data";

async function ZenithContent() {
  const { totalMp, isDemo } = await getZenithData();
  return <ZenithView totalMp={totalMp} isDemo={isDemo} />;
}

export default function ZenithPage() {
  return (
    <AppShell>
      <Suspense fallback={<PageLoading />}>
        <ZenithContent />
      </Suspense>
    </AppShell>
  );
}
