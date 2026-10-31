"use client";

import { useEffect, useState } from "react";
import type { ChantPhase } from "@/lib/chant-session";
import { COMBO_GRACE_MINUTES, comboView, minutesLeft } from "@/lib/combo";
import { METEOR_SHOWER_MINUTES } from "@/lib/reward";
import { useUserData } from "@/lib/user-store";
import { cn } from "@/lib/utils";

/** 残り時間の表示を刻むための「いま」。分単位の表示なので、数秒おきで足りる */
function useNow(intervalMs = 5_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    // 裏から戻ったら、すぐに数え直す
    const onVisible = () => document.visibilityState === "visible" && setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
  return now;
}

/**
 * 星脈との同調（コンボ）の状態。
 * 静息中は「次の詠唱まであと◯分（同調維持中）」、静息が明けたら猶予の残りを、詠唱中は今の同調数を控えめに添える
 */
export function ComboIndicator({ phase, className }: { phase: ChantPhase; className?: string }) {
  const { combo } = useUserData();
  const now = useNow();
  const view = comboView(combo, now);
  if (view.kind === "none") return null;

  if (phase === "focus") {
    return (
      <p className={cn("text-[11px] tracking-[0.25em] whitespace-nowrap text-amethyst/80", className)}>
        同調 <span className="font-display text-starlight">{view.count}</span>連 を紡いでいる
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-0.5 text-center", className)} role="status">
      <p className="text-xs tracking-[0.25em] whitespace-nowrap text-amethyst">
        同調 <span className="font-display text-sm text-starlight text-glow-gold">{view.count}</span>連 維持中
      </p>
      <p className="text-[11px] tracking-wider text-muted-foreground [word-break:auto-phrase]">
        {view.kind === "resting" ? (
          <>
            次の詠唱まであと <span className="font-display text-foreground">{minutesLeft(view.restLeftMs)}</span>分
            <span className="text-muted-foreground/70">（明けてから{COMBO_GRACE_MINUTES}分のうちに始めれば続く）</span>
          </>
        ) : (
          <>
            静息が明けた。あと <span className="font-display text-foreground">{minutesLeft(view.graceLeftMs)}</span>分のうちに詠唱を始めれば同調が続く
          </>
        )}
      </p>
    </div>
  );
}

/** 30分を越えた詠唱にだけ灯る、流星群の接近の兆し。集中を妨げないよう、微かな明滅と一言だけ */
export function MeteorSign({ elapsedMs, className }: { elapsedMs: number; className?: string }) {
  if (elapsedMs < METEOR_SHOWER_MINUTES * 60_000) return null;
  return (
    <p className={cn("flex items-center gap-1.5 text-[11px] tracking-[0.3em] whitespace-nowrap text-starlight/70", className)} aria-live="polite">
      <span className="relative flex size-2.5 items-center justify-center" aria-hidden>
        <span className="absolute size-full animate-ping rounded-full bg-starlight/30 [animation-duration:3s]" />
        <span className="size-1 rounded-full bg-starlight/80" />
      </span>
      <span className="glimmer">流星群の接近を観測中…</span>
    </p>
  );
}
