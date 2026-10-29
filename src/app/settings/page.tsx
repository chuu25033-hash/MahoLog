import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { AppShell } from "@/components/app-shell";
import { PageLoading } from "@/components/page-loading";
import { SettingsView } from "@/components/settings-view";
import { getSettingsData } from "@/lib/data";

async function SettingsContent() {
  const { subjects, isDemo } = await getSettingsData();
  return <SettingsView subjects={subjects} isDemo={isDemo} signOutAction={isDemo ? undefined : signOut} />;
}

export default function SettingsPage() {
  return (
    <AppShell>
      <Suspense fallback={<PageLoading />}>
        <SettingsContent />
      </Suspense>
    </AppShell>
  );
}
