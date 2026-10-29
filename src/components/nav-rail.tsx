"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookMarked, BookOpen, CalendarDays, Home, LogOut, Settings, Sparkles, Swords, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "魔術書庫", icon: Home, ready: true },
  { href: "/timer", label: "詠唱", icon: Sparkles, ready: true },
  { href: "/collection", label: "図鑑", icon: BookMarked, ready: true },
  { href: "/trials", label: "星の試練", icon: Swords, ready: false },
  { href: "/history", label: "魔導の軌跡", icon: CalendarDays, ready: true },
  { href: "/ranking", label: "ランキング", icon: Trophy, ready: false },
  { href: "/settings", label: "設定", icon: Settings, ready: false },
] as const;

const itemBase =
  "relative flex w-14 flex-col items-center gap-1 rounded-xl py-2 text-[10px] tracking-wider whitespace-nowrap transition-all duration-300 lg:w-16 lg:text-[11px]";

export function NavRail({ signOutAction }: { signOutAction?: () => Promise<void> }) {
  const pathname = usePathname();

  return (
    <nav className="glass flex h-full w-16 shrink-0 flex-col items-center gap-1 rounded-none py-3 lg:w-20">
      <Link href="/dashboard" className="mb-3 flex flex-col items-center gap-0.5 text-starlight" aria-label="マホログ 魔術書庫">
        <BookOpen className="size-6" strokeWidth={1.25} />
        <span className="text-[10px] tracking-[0.2em] text-glow-gold">マホログ</span>
      </Link>

      {ITEMS.map(({ href, label, icon: Icon, ready }) => {
        const active = pathname === href;
        const className = cn(
          itemBase,
          active
            ? "bg-gradient-to-b from-starlight/12 to-aqua/5 text-starlight ring-1 ring-starlight/35 shadow-[0_0_14px_-4px_rgba(226,201,116,0.5)]"
            : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
          !ready && "cursor-not-allowed opacity-35 hover:bg-transparent hover:text-muted-foreground",
        );
        return ready ? (
          <Link key={href} href={href} className={className} aria-current={active ? "page" : undefined}>
            <Icon className="size-5" strokeWidth={1.25} />
            {label}
          </Link>
        ) : (
          <span key={href} className={className} title="準備中">
            <Icon className="size-5" strokeWidth={1.25} />
            {label}
          </span>
        );
      })}

      {signOutAction && (
        <form action={signOutAction} className="mt-auto">
          <button type="submit" className={cn(itemBase, "text-muted-foreground hover:text-foreground")}>
            <LogOut className="size-5" strokeWidth={1.25} />
            ログアウト
          </button>
        </form>
      )}
    </nav>
  );
}
