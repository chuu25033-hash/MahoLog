"use client";

import type { ReactNode } from "react";
import { PROLOGUE_STORAGE_KEY, usePrologueCompleted } from "@/lib/prologue";
import { Prologue } from "./prologue";

const COVER_ID = "prologue-cover";

/**
 * HTML を読み込んでいる途中で、見届けた印があれば幕を外す。
 * サーバーは印を読めないので、幕を被せたまま描き、初めての人にタイトル画面が一瞬見えないようにする。
 * 保存領域が使えない端末はプロローグで縛らない（local-flag と同じ扱い）ので、幕も外す
 */
const REVEAL_SCRIPT = `{var c=document.getElementById("${COVER_ID}");try{if(localStorage.getItem("${PROLOGUE_STORAGE_KEY}")!=="1")c=null}catch(e){}if(c)c.style.display="none"}`;

/** 初めて訪れたときだけ、プロローグを見届けてから中身（タイトル画面）を開く */
export function PrologueGate({ children }: { children: ReactNode }) {
  const completed = usePrologueCompleted();
  if (completed === false) return <Prologue />;
  return (
    <>
      {children}
      {/* 印がまだ読めない間（サーバーの HTML とハイドレーション中）だけ、プロローグと同じ闇で覆っておく */}
      {completed === null && (
        <>
          <div id={COVER_ID} className="fixed inset-0 z-[95] bg-[#03050b]" aria-hidden suppressHydrationWarning />
          <script
            // クライアントで描くときは実行させず、開発時の警告も出さない
            type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: REVEAL_SCRIPT }}
          />
        </>
      )}
    </>
  );
}
