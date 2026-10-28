"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, Home, LogOut, Settings, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "ホーム", icon: Home, ready: true },
  { href: "/timer", label: "詠唱", icon: Sparkles, ready: true },
  { href: "/history", label: "履歴", icon: CalendarDays, ready: false },
  { href: "/ranking", label: "ランキング", icon: Trophy, ready: false },
  { href: "/settings", label: "設定", icon: Settings, ready: false },
] as const;

export function NavRail({ signOutAction }: { signOutAction?: () => Promise<void> }) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-16 shrink-0 flex-col items-center gap-1 border-r border-border bg-card/60 py-3 backdrop-blur lg:w-20">
      <Link href="/" className="mb-2 flex flex-col items-center text-primary" aria-label="マホログ ホーム">
        <BookOpen className="size-7" />
        <span className="text-[10px] font-extrabold tracking-wider">マホログ</span>
      </Link>

      {ITEMS.map(({ href, label, icon: Icon, ready }) => {
        const active = pathname === href;
        const className = cn(
          "flex w-14 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] transition-colors lg:w-16 lg:text-xs",
          active ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          !ready && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground",
        );
        return ready ? (
          <Link key={href} href={href} className={className} aria-current={active ? "page" : undefined}>
            <Icon className="size-5" />
            {label}
          </Link>
        ) : (
          <span key={href} className={className} title="準備中">
            <Icon className="size-5" />
            {label}
          </span>
        );
      })}

      {signOutAction && (
        <form action={signOutAction} className="mt-auto">
          <button
            type="submit"
            className="flex w-14 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          >
            <LogOut className="size-5" />
            ログアウト
          </button>
        </form>
      )}
    </nav>
  );
}
