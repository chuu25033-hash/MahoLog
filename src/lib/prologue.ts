"use client";

import { setLocalFlag, useLocalFlagOrUnknown } from "./local-flag";

/** プロローグ（創世の記録）を最後まで見届けたかどうか */
export const PROLOGUE_STORAGE_KEY = "maholog_prologue_completed";

/** 見届けた印を残す */
export function markPrologueCompleted() {
  setLocalFlag(PROLOGUE_STORAGE_KEY);
}

/** プロローグを見届けたか。サーバーと読み込み直後はまだ分からないので null */
export function usePrologueCompleted() {
  return useLocalFlagOrUnknown(PROLOGUE_STORAGE_KEY);
}
