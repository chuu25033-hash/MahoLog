"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const COVER_EVENT = "maholog:veil-cover";
/** 暗闇へ沈むまでの時間（ms）。呼び出し側はこの後に遷移する */
export const VEIL_COVER_MS = 700;

/** dark: 暗闇へ沈む / light: 星の光に満たされる */
export type VeilTone = "dark" | "light";

const TONE_BACKGROUND: Record<VeilTone, string> = {
  dark: "radial-gradient(circle at 50% 50%, #0b1226 0%, #060914 55%, #020308 100%)",
  light: "radial-gradient(circle at 50% 50%, #fffaf0 0%, #f6e9bd 30%, #b89a52 70%, #2a2414 100%)",
};

/** 画面全体をヴェールで覆う。覆ったまま遷移すると、遷移先でヴェールが晴れて浮かび上がる */
export function coverScreen(tone: VeilTone = "dark") {
  window.dispatchEvent(new CustomEvent<VeilTone>(COVER_EVENT, { detail: tone }));
}

/**
 * ルートレイアウトに常駐する暗転用ヴェール。レイアウトは遷移をまたいで保持されるため、
 * 覆った時点のパスから離れると自動でフェードアウトし、新しい画面がうっすら現れる。
 */
export function TransitionVeil() {
  const pathname = usePathname();
  const [coveredAt, setCoveredAt] = useState<string | null>(null);
  const [tone, setTone] = useState<VeilTone>("dark");

  useEffect(() => {
    const onCover = (e: Event) => {
      setTone((e as CustomEvent<VeilTone>).detail ?? "dark");
      setCoveredAt(window.location.pathname);
    };
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
          : `pointer-events-none opacity-0 ease-out ${tone === "light" ? "duration-[2200ms]" : "duration-[1600ms]"}`
      }`}
      style={{ background: TONE_BACKGROUND[tone] }}
    />
  );
}
