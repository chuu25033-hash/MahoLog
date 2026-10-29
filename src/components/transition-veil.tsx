"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const COVER_EVENT = "maholog:veil-cover";
/** 暗闇へ沈むまでの時間（ms）。呼び出し側はこの後に遷移する */
export const VEIL_COVER_MS = 700;

/** 画面全体を暗闇で覆う。覆ったまま遷移すると、遷移先で暗闇から浮かび上がる */
export function coverScreen() {
  window.dispatchEvent(new Event(COVER_EVENT));
}

/**
 * ルートレイアウトに常駐する暗転用ヴェール。レイアウトは遷移をまたいで保持されるため、
 * 覆った時点のパスから離れると自動でフェードアウトし、新しい画面がうっすら現れる。
 */
export function TransitionVeil() {
  const pathname = usePathname();
  const [coveredAt, setCoveredAt] = useState<string | null>(null);

  useEffect(() => {
    const onCover = () => setCoveredAt(window.location.pathname);
    window.addEventListener(COVER_EVENT, onCover);
    return () => window.removeEventListener(COVER_EVENT, onCover);
  }, []);

  const covered = coveredAt !== null && coveredAt === pathname;
  const revealing = coveredAt !== null && !covered;

  return (
    <div
      aria-hidden
      onTransitionEnd={() => revealing && setCoveredAt(null)}
      className={`fixed inset-0 z-[90] transition-opacity motion-reduce:duration-0 ${
        covered
          ? "pointer-events-auto opacity-100 duration-700 ease-in"
          : "pointer-events-none opacity-0 duration-[1600ms] ease-out"
      }`}
      style={{ background: "radial-gradient(circle at 50% 50%, #0b1226 0%, #060914 55%, #020308 100%)" }}
    />
  );
}
