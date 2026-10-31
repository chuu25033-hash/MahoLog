"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** 入力中の欄があるか（キーボードが出ている間は、ずらしたままにしておく） */
function isEditing() {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable);
}

/**
 * 画面全体を上端に留める。体（body）は画面の高さで固定してスクロールさせないが、
 * iPhone は入力欄に触れるとキーボードのぶん画面ごと押し上げ、閉じても戻さないことがある。
 * そのままだと上の方が枠の外に残り、スクロールでも戻せないため、入力を終えたときと画面を移ったときに上端へ戻す
 */
export function ViewportAnchor() {
  const pathname = usePathname();

  useEffect(() => {
    let timer: number | undefined;
    const settle = () => {
      window.clearTimeout(timer);
      // キーボードが閉じきってから（フォーカスが次の欄へ移っただけなら何もしない）
      timer = window.setTimeout(() => {
        if (!isEditing() && (window.scrollY !== 0 || window.scrollX !== 0)) window.scrollTo(0, 0);
      }, 100);
    };
    document.addEventListener("focusout", settle);
    window.visualViewport?.addEventListener("resize", settle);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("focusout", settle);
      window.visualViewport?.removeEventListener("resize", settle);
    };
  }, []);

  // 入力したまま画面を移ったとき（世界線の復元など）
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement && isEditing()) document.activeElement.blur();
    if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
