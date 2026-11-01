"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIsAdmin } from "@/lib/admin";
import { useObserver } from "@/lib/cloud-sync";
import { MusicPlayer } from "./music-player";

/** 管理者だけが開ける曲の試聴・書き出し。それ以外の観測者は書庫へ戻す */
export function AdminMusic() {
  const observer = useObserver();
  const admin = useIsAdmin();
  const router = useRouter();

  useEffect(() => {
    if (observer && !admin) router.replace("/dashboard");
  }, [observer, admin, router]);

  if (!admin) return null;
  return (
    <div className="relative h-full">
      <Link
        href="/settings"
        className="absolute top-4 left-4 z-10 rounded-full border border-white/15 px-3 py-1 text-xs tracking-wider text-muted-foreground hover:text-starlight"
      >
        設定へ戻る
      </Link>
      <MusicPlayer />
    </div>
  );
}
