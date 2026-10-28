import { signOut } from "@/app/actions/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { NavRail } from "./nav-rail";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh w-full">
      <NavRail signOutAction={isSupabaseConfigured ? signOut : undefined} />
      <main className="relative min-w-0 flex-1 overflow-y-auto">
        {!isSupabaseConfigured && (
          <div className="border-b border-starlight/15 bg-starlight/[0.06] px-4 py-1 text-center text-[11px] tracking-wider text-starlight/80">
            デモモード: Supabase 未接続のためサンプルデータを表示しています（.env.local を設定すると本番データに切り替わります）
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
