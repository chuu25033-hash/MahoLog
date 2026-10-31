"use client";

import { useEffect, useRef, useState } from "react";

/**
 * idle: 点灯を保っていない / active: 画面の消灯を止めている /
 * unsupported: ブラウザが Wake Lock API に対応していない / denied: 省電力モードなどで断られた
 */
export type WakeLockStatus = "idle" | "active" | "unsupported" | "denied";

const supported = () => typeof navigator !== "undefined" && "wakeLock" in navigator;

/**
 * active の間だけ、画面の自動消灯（スリープ）を止める（Screen Wake Lock API）。
 * - active が false になったら解き、端末の標準のスリープ設定に戻す
 * - 別のタブ・アプリへ移るとブラウザが自動で解くので、戻ってきたら取り直す
 * - 対応していない・断られたときも例外で落とさず、状態で知らせる
 */
export function useWakeLock(active: boolean): WakeLockStatus {
  const [status, setStatus] = useState<WakeLockStatus>("idle");
  const sentinel = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) return;
    if (!supported()) {
      // 描画の後に知らせる（effect の中で同期的に state を変えない）
      const id = setTimeout(() => setStatus("unsupported"), 0);
      return () => clearTimeout(id);
    }
    let cancelled = false;

    const acquire = async () => {
      // 画面が見えていないときは取れない（戻ったときに取り直す）。すでに持っていれば何もしない
      if (cancelled || document.visibilityState !== "visible" || (sentinel.current && !sentinel.current.released)) return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void lock.release().catch(() => undefined);
          return;
        }
        sentinel.current = lock;
        setStatus("active");
        // タブを移った・端末が省電力に入ったなどで解かれたら、戻ったときに取り直せるよう印を外す
        lock.addEventListener("release", () => {
          if (sentinel.current === lock) sentinel.current = null;
          if (!cancelled) setStatus("idle");
        });
      } catch {
        // 省電力モード・権限ポリシーなどで断られた。計測そのものは続ける
        if (!cancelled) setStatus("denied");
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      const lock = sentinel.current;
      sentinel.current = null;
      if (lock && !lock.released) void lock.release().catch(() => undefined);
      setStatus("idle");
    };
  }, [active]);

  return status;
}

/** 点灯を保てなかったときに添える、控えめな案内（保てているとき・保つ必要がないときは null） */
export function wakeLockNotice(status: WakeLockStatus): string | null {
  return status === "unsupported" || status === "denied" ? "※端末の設定により、詠唱中に画面が消えることがあります" : null;
}
