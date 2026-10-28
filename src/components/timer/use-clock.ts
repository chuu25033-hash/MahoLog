"use client";

import { useCallback, useEffect, useState } from "react";

type ClockState = { accMs: number; startedAt: number | null };

/**
 * 経過時間を Date.now() の差分で計算する時計。
 * setInterval の回数で数えないので、バックグラウンドタブで間引かれてもズレない。
 */
export function useClock() {
  const [state, setState] = useState<ClockState>({ accMs: 0, startedAt: null });
  const [now, setNow] = useState(0);

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

  return { elapsedMs, running, start, pause, reset, read };
}

/** 終了通知（音 + 振動） */
export function notifyFinish() {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {}
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = [660, 880, 1320][i];
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.45);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}
