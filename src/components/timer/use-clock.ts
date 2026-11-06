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

  // 表示する秒が変わる瞬間にだけ時刻を進める。細かく刻むと詠唱の間ごと何度も描き直され、
  // スマホでは探索の景色の少女の足取りなど、毎フレーム描く動きがかくつく。
  // 満了や放置確認は read() で正確な時刻を測るので、ここを間引いても遅れない
  useEffect(() => {
    const { accMs, startedAt } = state;
    if (startedAt === null) return;
    let id = 0;
    const schedule = () => {
      const elapsed = accMs + Date.now() - startedAt;
      // 秒の境目を確かに越えてから進める（少し早く起きて同じ秒を描き直さないように）
      id = window.setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, 1000 - (elapsed % 1000) + 10);
    };
    schedule();
    return () => clearTimeout(id);
  }, [state]);

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

/** 終わりを報せる振動。手に持っていなくても気づけるよう、長めに3度ふるわせる（振動に対応した Android の端末だけ） */
const FINISH_VIBRATION = [500, 200, 500, 200, 800];

/** 終了通知（魔力集束のチャイム + 振動）。設定で完了の報せを切っていれば鳴らさない */
export function notifyFinish(chime = true) {
  if (!chime) return;
  try {
    navigator.vibrate?.(FINISH_VIBRATION);
  } catch {}
  soundManager.playSe("chantComplete");
}

/** 端末の通知を出してよいか、詠唱を始めるとき（ユーザーの操作の中）に一度だけ尋ねる。通知を出す service worker もここで置く */
export function requestRestNoticePermission() {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
  } catch {}
  try {
    void navigator.serviceWorker?.register("/sw.js").catch(() => undefined);
  } catch {}
}

/**
 * 端末の通知を出す。詠唱の間を見ていないとき（裏に回っているとき）だけ出す。
 * Android の Chrome はページから直接通知を出せないので service worker から出し、通知と一緒に振動させる
 */
function showSystemNotification(title: string, body: string, tag: string) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted" || !document.hidden) return;
    const options = { body, tag, icon: "/icon.svg", vibrate: FINISH_VIBRATION, requireInteraction: false } as NotificationOptions;
    const direct = () => {
      try {
        new Notification(title, options);
      } catch {}
    };
    const sw = navigator.serviceWorker;
    if (!sw) return direct();
    void sw
      .getRegistration()
      .then((reg) => (reg ? reg.showNotification(title, options) : direct()))
      .catch(direct);
  } catch {}
}

/** 詠唱が満了したことを端末の通知で報せる */
export function showChantEndNotification(chime = true) {
  if (!chime) return;
  showSystemNotification("詠唱が満ちた", "魔力が星に刻まれた。戻って静息に入ろう", "maholog-chant-end");
}

/**
 * 静息が明けたことを端末の通知で報せる。詠唱の間を見ていないとき（裏に回っているとき）だけ出す。
 * ページが生きている間に限る（iOS で画面を閉じている間は届かず、戻ったときにチャイムと一言で報せる）
 */
export function showRestEndNotification(notice: RestEndNotice | null, chime = true) {
  if (!notice || !chime) return;
  showSystemNotification(notice.title, notice.body, "maholog-rest-end");
}
