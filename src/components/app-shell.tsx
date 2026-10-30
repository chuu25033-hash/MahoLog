import { isCloudSyncEnabled, isEmailAuthMode } from "@/lib/supabase/config";
import { WorldlinePulses } from "./worldline-pulses";

/** 各画面の枠。行き来は魔術書庫を拠点にし、他の画面は左上の「魔術書庫」から戻る */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {!isEmailAuthMode && !isCloudSyncEnabled && (
          <div className="shrink-0 border-b border-starlight/15 bg-starlight/[0.06] px-4 py-1 text-center text-[11px] tracking-wider text-starlight/80 short:py-0.5 short:text-[10px] max-sm:py-0.5 max-sm:text-[10px]">
            デモモード<span className="short:hidden max-sm:hidden">: Supabase 未接続のため、観測データはこの端末に保存されます（.env.local を設定すると本番データに切り替わります）</span>
          </div>
        )}
        <div className="relative min-h-0 flex-1">{children}</div>
      </main>
      <WorldlinePulses />
    </div>
  );
}
