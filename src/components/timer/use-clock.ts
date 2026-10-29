"use client";

import { useCallback, useEffect, useState } from "react";
import { soundManager } from "@/lib/sound/sound-manager";

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

/** 終了通知（魔力集束のチャイム + 振動）。設定で完了の報せを切っていれば鳴らさない */
export function notifyFinish(chime = true) {
  if (!chime) return;
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {}
  soundManager.playSe("chantComplete");
}
