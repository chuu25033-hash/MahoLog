import { signOut } from "@/app/actions/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DemoDataControls } from "./demo-data-controls";
import { NavRail } from "./nav-rail";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <NavRail signOutAction={isSupabaseConfigured ? signOut : undefined} />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {!isSupabaseConfigured && (
          <div className="shrink-0 border-b border-starlight/15 bg-starlight/[0.06] px-4 py-1 text-center text-[11px] tracking-wider text-starlight/80">
            デモモード: Supabase 未接続のため、観測データはこの端末に保存されます（.env.local を設定すると本番データに切り替わります）
            <DemoDataControls />
          </div>
        )}
        <div className="relative min-h-0 flex-1">{children}</div>
      </main>
    </div>
  );
}
