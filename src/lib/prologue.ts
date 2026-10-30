"use client";

import { useSyncExternalStore } from "react";

/** プロローグ（創世の記録）を最後まで見届けたかどうか。この端末にだけ覚える */
const STORAGE_KEY = "maholog_prologue_completed";

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function readCompleted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // 保存領域が使えない端末では、毎回の再生で縛らない
    return true;
  }
}

/** 見届けた印を残す */
export function markPrologueCompleted() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // 保存できなくても先へ進める
  }
  listeners.forEach((fn) => fn());
}

/** プロローグを見届けたか。サーバーでは見届けた扱いにして、いつもの画面を描く */
export function usePrologueCompleted() {
  return useSyncExternalStore(subscribe, readCompleted, () => true);
}
