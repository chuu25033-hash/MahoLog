import { signOut } from "@/app/actions/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { NavRail } from "./nav-rail";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh w-full">
      <NavRail signOutAction={isSupabaseConfigured ? signOut : undefined} />
      <main className="relative min-w-0 flex-1 overflow-y-auto">
        {!isSupabaseConfigured && (
          <div className="bg-primary/15 px-4 py-1 text-center text-xs text-primary">
            デモモード: Supabase 未接続のためサンプルデータを表示しています（.env.local を設定すると本番データに切り替わります）
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
