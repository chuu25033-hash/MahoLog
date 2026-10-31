"use client";

import { useEffect, useState } from "react";
import { findTitle, type Title } from "@/lib/titles";
import type { ItemRarity } from "@/lib/items";
import { userActions, useStoredUserData } from "@/lib/user-store";
import { GRADE_TONE } from "./titles-dialog";

/** 解放の直後（詠唱の結果ダイアログが開く間）は少し待ってから告げる */
const DELAY_MS = 1200;
/** globals.css の .title-notice と同じ長さ */
const NOTICE_MS = 5600;

const GRADE_ORDER: ItemRarity[] = ["SS", "S", "A", "B", "C"];

/**
 * 称号を解放したとき、画面の上に静かに浮かべて告げる。
 * いくつも一度に解放したら、いちばん格の高いものを名に掲げて残りは数だけ添える。
 * 操作の邪魔をしないよう触れられず、告げた時点で告知済みにする
 */
export function TitleUnlockNotice() {
  const data = useStoredUserData();
  const pending = data?.titles.unseen.join(",") ?? "";
  const [shown, setShown] = useState<{ title: Title; others: number; key: number } | null>(null);

  useEffect(() => {
    if (!pending || shown) return;
    const ids = pending.split(",");
    const timer = window.setTimeout(() => {
      const titles = ids.map((id) => findTitle(id)).filter((t): t is Title => !!t);
      userActions.markTitlesSeen(ids);
      if (titles.length === 0) return;
      const [title] = [...titles].sort((a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade));
      setShown({ title, others: titles.length - 1, key: Date.now() });
    }, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pending, shown]);

  useEffect(() => {
    if (!shown) return;
    const timer = window.setTimeout(() => setShown(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [shown]);

  if (!shown) return null;
  const { title, others } = shown;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-[60] flex justify-center px-4" role="status" aria-live="polite">
      <div
        key={shown.key}
        className="title-notice flex flex-col items-center gap-0.5 rounded-2xl border border-starlight/25 bg-[#070b16]/80 px-6 py-2.5 text-center shadow-[0_0_24px_-8px_rgba(226,201,116,0.6)] backdrop-blur-xl"
      >
        <p className="flex flex-col items-center text-[10px] leading-tight tracking-[0.3em] whitespace-nowrap text-muted-foreground">
          称号を解放しました
          <span className="font-display text-[8px] tracking-[0.3em] text-starlight/60">TITLE UNLOCKED</span>
        </p>
        <p className="text-sm tracking-[0.15em] text-starlight text-glow-gold [word-break:auto-phrase]">【{title.name}】</p>
        <p className="text-[10px] tracking-wider text-muted-foreground [word-break:auto-phrase]">
          <span className={GRADE_TONE[title.grade]}>RARE {title.grade}</span>
          <span className="mx-1.5 opacity-40">·</span>
          {others > 0 ? `ほか ${others} の称号` : title.description}
        </p>
      </div>
    </div>
  );
}
