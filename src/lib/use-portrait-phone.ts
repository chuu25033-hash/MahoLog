"use client";

import { useSyncExternalStore } from "react";

/** スマホ・タブレットの縦持ち（globals.css の .rotate-hint と同じ条件） */
const QUERY = "(orientation: portrait) and (max-width: 1024px)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** 縦持ちの端末かどうか。サーバーでは横画面（PC）として描く */
export function usePortraitPhone() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
