"use client";

import { useSyncExternalStore } from "react";

// 一度きりの演出・案内を済ませたかどうかの印。この端末の localStorage にだけ覚える

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function read(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    // 保存領域が使えない端末では、毎回の案内で縛らない
    return true;
  }
}

/** 印を付ける（false で外す） */
export function setLocalFlag(key: string, value = true) {
  try {
    if (value) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    // 保存できなくても先へ進める
  }
  listeners.forEach((fn) => fn());
}

/**
 * 印が付いているか。サーバーと読み込み直後（ハイドレーション中）はまだ分からないので null を返す。
 * 分からない間に何を描くかは呼ぶ側で決める（プロローグの幕など）
 */
export function useLocalFlagOrUnknown(key: string) {
  return useSyncExternalStore<boolean | null>(
    subscribe,
    () => read(key),
    () => null,
  );
}

/** 印が付いているか。サーバーでは付いている扱いにして、いつもの画面を描く */
export function useLocalFlag(key: string) {
  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => true,
  );
}
