"use client";

import { setLocalFlag, useLocalFlag } from "./local-flag";

/** プロローグ（創世の記録）を最後まで見届けたかどうか */
const STORAGE_KEY = "maholog_prologue_completed";

/** 見届けた印を残す */
export function markPrologueCompleted() {
  setLocalFlag(STORAGE_KEY);
}

/** プロローグを見届けたか */
export function usePrologueCompleted() {
  return useLocalFlag(STORAGE_KEY);
}
