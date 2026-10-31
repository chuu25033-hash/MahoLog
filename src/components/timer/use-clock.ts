"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClockSnapshot } from "@/lib/chant-session";
import type { RestEndNotice } from "@/lib/combo";
import { soundManager } from "@/lib/sound/sound-manager";

/**
 * 経過時間を Date.now() の差分で計算する時計。
 * setInterval の回数で数えないので、バックグラウンドタブで間引かれてもズレない。
 * initial を渡すと、書き留めておいた時計の続きから始める
 */
export function useClock(initial?: ClockSnapshot) {
  const [state, setState] = useState<ClockSnapshot>(initial ?? { accMs: 0, startedAt: null });
  const [now, setNow] = useState(() => (initial?.startedAt != null ? Date.now() : 0));

  useEffect(() => {
    if (state.startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [state.startedAt]);

  const running = state.startedAt !== null;
  const elapsedMs = state.accMs + (running ? Math.max(0, now - state.startedAt!) : 0);

  const start = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setState((s) => (s.startedAt !== null ? s : { accMs: s.accMs, startedAt: t }));
  }, []);

  /** 過ぎた時刻 t から動いていたことにして始める（裏に回っていた間に詠唱が満了し、静息がそこから始まっていた場合など） */
  const startAt = useCallback((t: number) => {
    setNow(Date.now());
    setState({ accMs: 0, startedAt: Math.min(t, Date.now()) });
  }, []);

  const pause = useCallback(() => {
    setState((s) =>
      s.startedAt === null ? s : { accMs: s.accMs + (Date.now() - s.startedAt), startedAt: null },
    );
  }, []);

  /** 停止して経過時間を ms に設定する */
  const reset = useCallback((accMs = 0) => setState({ accMs, startedAt: null }), []);

  /** 現在の正確な経過時間（イベントハンドラ・タイマーコールバック用） */
  const read = useCallback(
    () => state.accMs + (state.startedAt !== null ? Date.now() - state.startedAt : 0),
    [state],
  );

  return { elapsedMs, running, snapshot: state, start, startAt, pause, reset, read };
}

/** 終了通知（魔力集束のチャイム + 振動）。設定で完了の報せを切っていれば鳴らさない */
export function notifyFinish(chime = true) {
  if (!chime) return;
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {}
  soundManager.playSe("chantComplete");
}

/** 端末の通知を出してよいか、詠唱を始めるとき（ユーザーの操作の中）に一度だけ尋ねる */
export function requestRestNoticePermission() {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
  } catch {}
}

/**
 * 静息が明けたことを端末の通知で報せる。詠唱の間を見ていないとき（裏に回っているとき）だけ出す。
 * ページが生きている間に限る（iOS で画面を閉じている間は届かず、戻ったときにチャイムと一言で報せる）
 */
export function showRestEndNotification(notice: RestEndNotice | null, chime = true) {
  if (!notice || !chime) return;
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted" || !document.hidden) return;
    new Notification(notice.title, { body: notice.body, tag: "maholog-rest-end", icon: "/icon.svg" });
  } catch {
    // Android の Chrome などページから直接通知を出せない環境では、戻ったときの報せだけにする
  }
}
