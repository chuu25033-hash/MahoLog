"use client";

import { useEffect, useState } from "react";
import type { ChantPhase } from "@/lib/chant-session";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  COMBO_DROP_FROM,
  COMBO_DROP_MAX,
  COMBO_GRACE_MINUTES,
  COMBO_MIN_MINUTES,
  COMBO_MP_FROM,
  COMBO_MP_MAX,
  COMBO_REST_DELAY_MAX_MINUTES,
  COMBO_TITLE_COUNT,
  comboDropBoost,
  comboMpMultiplier,
  comboView,
  isComboAlive,
  minutesLeft,
} from "@/lib/combo";
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
export function ComboIndicator({
  phase,
  restLeftMs,
  className,
}: {
  phase: ChantPhase;
  /** 静息の時計の残り（ms）。渡すと、静息の残りはこの時計で示す（一時停止の間も時計に合う） */
  restLeftMs?: number;
  className?: string;
}) {
  const { combo } = useUserData();
  const now = useNow();
  const view = comboView(combo, now);
  if (view.kind === "none") return null;
  // 静息の時計が動いている間は、その時計の残りをそのまま使う（時計と同じ瞬間に分が替わる）
  const resting = restLeftMs !== undefined ? restLeftMs > 0 : view.kind === "resting";
  const restLeft = restLeftMs ?? (view.kind === "resting" ? view.restLeftMs : 0);
  // 静息明けを上限より後ろへずらしたときは、その分だけ明けてからの猶予が短くなる
  const graceAfterRest = Math.min(COMBO_GRACE_MINUTES, minutesLeft(Math.max(0, view.graceLeftMs - restLeft)));

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
        {resting ? (
          <>
            次の詠唱まであと <span className="font-display text-foreground">{minutesLeft(restLeft)}</span>分
            <span className="text-muted-foreground/70">（明けてから{graceAfterRest}分のうちに始めれば続く）</span>
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

/** 同調の段ごとの効果を並べる段数（魔力・流れ星・称号のすべてが上限に届く段まで） */
const GUIDE_STEPS = Array.from({ length: COMBO_TITLE_COUNT }, (_, i) => i + 1);

const times = (x: number) => `×${Number(x.toFixed(2))}`;

/**
 * 「星脈との同調」の文言。触れると、続く条件・ほどける条件・段ごとの効果と上限を記した札が開く
 */
export function ComboGuide() {
  const [open, setOpen] = useState(false);
  const { combo } = useUserData();
  const maxMp = 1 + COMBO_MP_MAX;
  const maxDrop = 1 + COMBO_DROP_MAX;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="text-starlight/85 underline decoration-starlight/40 decoration-dotted underline-offset-4 transition-colors hover:text-starlight hover:decoration-starlight/70"
      >
        星脈との同調
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto scrollbar-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex flex-col leading-tight tracking-[0.2em] whitespace-nowrap">
              星脈との同調
              <span className="font-display text-[9px] tracking-[0.3em] text-starlight/60">RESONANCE</span>
            </DialogTitle>
            <DialogDescription className="[word-break:auto-phrase]">
              静息を挟みながら、{COMBO_MIN_MINUTES}分以上の詠唱を途切れずに紡ぐほど、星脈との同調が高まります。
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 text-[13px] leading-relaxed tracking-wider [word-break:auto-phrase]">
            <section className="flex flex-col gap-1">
              <h3 className="text-xs tracking-[0.25em] whitespace-nowrap text-starlight/85">高まる条件</h3>
              <ul className="flex list-disc flex-col gap-0.5 pl-5 text-foreground/85 marker:text-starlight/50">
                <li>{COMBO_MIN_MINUTES}分以上の詠唱を終えるたびに、同調が1つ高まる</li>
                <li>静息が明けてから{COMBO_GRACE_MINUTES}分のうちに次の詠唱を始めれば、同調が続く</li>
                <li>
                  静息に入るのが遅れたり一時停止したりして静息明けが後ろへずれるのは、合わせて{COMBO_REST_DELAY_MAX_MINUTES}分まで。越えた分は、明けてからの猶予が短くなる
                </li>
                <li>律動の詠唱・無窮の詠唱のどちらでも数える</li>
              </ul>
            </section>

            <section className="flex flex-col gap-1">
              <h3 className="text-xs tracking-[0.25em] whitespace-nowrap text-starlight/85">ほどける条件</h3>
              <ul className="flex list-disc flex-col gap-0.5 pl-5 text-foreground/85 marker:text-starlight/50">
                <li>{COMBO_MIN_MINUTES}分に届かずに詠唱を終えた</li>
                <li>静息が明けてから{COMBO_GRACE_MINUTES}分を過ぎて、次の詠唱を始めた</li>
              </ul>
            </section>

            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs tracking-[0.25em] whitespace-nowrap text-starlight/85">同調の効果</h3>
              <ul className="flex list-disc flex-col gap-0.5 pl-5 text-foreground/85 marker:text-starlight/50">
                <li>
                  <span className="text-foreground">魔力</span>: {COMBO_MP_FROM}連から、得る魔力が増える（最大 {times(maxMp)}）
                </li>
                <li>
                  <span className="text-foreground">流れ星</span>: {COMBO_DROP_FROM}連から、稀品以上が降りやすくなる（最大 {times(maxDrop)}）
                </li>
                <li>
                  <span className="text-foreground">称号</span>: {COMBO_TITLE_COUNT}連に届くと「星脈の調律師」を授かる
                </li>
              </ul>
              <table className="mt-1 w-full text-center text-xs tracking-wider">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] text-muted-foreground">
                    <th className="py-1 font-normal whitespace-nowrap">同調</th>
                    <th className="py-1 font-normal whitespace-nowrap">魔力</th>
                    <th className="py-1 font-normal whitespace-nowrap">稀品以上</th>
                  </tr>
                </thead>
                <tbody>
                  {GUIDE_STEPS.map((n) => {
                    const mp = comboMpMultiplier(n);
                    const drop = comboDropBoost(n);
                    const last = n === GUIDE_STEPS.length;
                    return (
                      <tr key={n} className="border-b border-white/[0.06] last:border-0">
                        <td className="py-1 whitespace-nowrap">
                          <span className="font-display text-starlight">{last ? `${n}+` : n}</span>連
                        </td>
                        <td className={cn("py-1 font-display", mp > 1 ? "text-aqua" : "text-muted-foreground/60")}>
                          {mp > 1 ? times(mp) : "—"}
                        </td>
                        <td className={cn("py-1 font-display", drop > 1 ? "text-aqua" : "text-muted-foreground/60")}>
                          {drop > 1 ? times(drop) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-[11px] text-muted-foreground">
                {COMBO_TITLE_COUNT}連で魔力・流れ星とも上限に届き、それより先は同じ効果が続きます。
              </p>
            </section>

            <p className="border-t border-white/10 pt-3 text-xs text-muted-foreground">
              いまの同調 <span className="font-display text-starlight">{isComboAlive(combo) ? combo.count : 0}</span>連 ／ これまでの最長{" "}
              <span className="font-display text-starlight">{combo.best}</span>連
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
