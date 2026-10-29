import { AppShell } from "@/components/app-shell";
import { StarMemoryView } from "@/components/history/star-memory-view";

export default function HistoryPage() {
  return (
    <AppShell>
      <StarMemoryView />
    </AppShell>
  );
}
