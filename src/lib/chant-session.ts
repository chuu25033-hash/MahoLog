"use client";

import { useSyncExternalStore } from "react";
import type { StudyMode } from "./types";

// 進行中の詠唱を端末に書き留めておく。画面を閉じたり、スマホが裏で画面を破棄したりしても、
// 詠唱の間を開き直せば続きから呼び戻せる。経過は開始時刻との差で測るので、閉じていた間も時は流れる
const STORAGE_KEY = "maholog_chant_session";

/** idle: 開始前 / focus: 勉強中 / breakReady: 休憩待機 / break: 休憩中 */
export type ChantPhase = "idle" | "focus" | "breakReady" | "break";

export type ClockSnapshot = { accMs: number; startedAt: number | null };

export type ChantSession = {
  phase: Exclude<ChantPhase, "idle">;
  mode: StudyMode;
  focusMin: number;
  breakMin: number;
  subjectId: string;
  subSubject: string | null;
  clock: ClockSnapshot;
  /** 無窮の詠唱で、最後に継続を確かめた時点（ms） */
  confirmBaseMs: number;
};

export function loadChantSession(): ChantSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as ChantSession;
    const valid =
      ["focus", "breakReady", "break"].includes(s.phase) &&
      (s.mode === "pomodoro" || s.mode === "stopwatch") &&
      typeof s.clock?.accMs === "number";
    return valid ? s : null;
  } catch {
    return null;
  }
}

/** null で消す（詠唱を終えた・始める前） */
export function saveChantSession(session: ChantSession | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 保存できない端末では、呼び戻せないだけで詠唱は続けられる
  }
  listeners.forEach((fn) => fn());
}

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // 別のタブで詠唱が始まった・終わったときも追う
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && onChange();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

let cachedRaw: string | null = null;
let cached: ChantSession | null = null;

function snapshot() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {}
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = loadChantSession();
  }
  return cached;
}

/** 進行中の詠唱（書庫などから、詠唱の間へ戻る導線を出すのに使う）。サーバーでは無い扱い */
export function useChantSession() {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

/** 書き留めた時計の、いまの経過時間（ms） */
export function sessionElapsedMs({ clock }: ChantSession, now = Date.now()) {
  return clock.accMs + (clock.startedAt !== null ? Math.max(0, now - clock.startedAt) : 0);
}
