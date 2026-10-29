"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ItemArt } from "@/components/item-art";
import { VEIL_COVER_MS, coverScreen } from "@/components/transition-veil";
import { GUIDANCE_CYCLE, claimGuidance, pendingGuidance, type Guidance } from "@/lib/celestial-guidance";
import { RARITY_LABEL } from "@/lib/items";
import { mockActions } from "@/lib/mock-store";
import { StarChart } from "./star-chart";

const DESTINATION = "/dashboard";

// 画面を開いた時点の導きを保持する（受け取った後も演出が終わるまで同じ内容を表示し続ける）
let opened: Guidance | null | undefined;
const snapshot = () => (opened === undefined ? (opened = pendingGuidance()) : opened);
const noopSubscribe = () => () => {};

/** 中央の品へ集束する光の粒子: 決定的な配置 */
const PARTICLES = Array.from({ length: 22 }, (_, i) => {
  const angle = (i / 22) * Math.PI * 2;
  const dist = 90 + ((i * 41) % 70);
  return { px: Math.cos(angle) * dist, py: Math.sin(angle) * dist, dur: 2.4 + (i % 5) * 0.35, delay: -((i * 0.37) % 3) };
});

/** 品の周囲から立ち昇る星屑 */
const MOTES = Array.from({ length: 16 }, (_, i) => ({
  left: 30 + ((i * 53) % 40),
  size: i % 3 === 0 ? 3 : 2,
  dur: 3.2 + (i % 4) * 0.6,
  delay: -((i * 0.71) % 4),
  drift: ((i % 5) - 2) * 6,
}));

const BURST = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2;
  return { sx: Math.cos(angle) * 170, sy: Math.sin(angle) * 170 };
});

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

export function GuidanceScreen() {
  const router = useRouter();
  const guidance = useSyncExternalStore(noopSubscribe, snapshot, () => undefined);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    router.prefetch(DESTINATION);
    // 本日分を受け取り済みなら、そのまま観測所へ
    if (guidance === null) router.replace(DESTINATION);
  }, [guidance, router]);

  // 画面を離れたら次に開いたとき改めて判定する
  useEffect(
    () => () => {
      opened = undefined;
    },
    [],
  );

  function receive() {
    if (!guidance || claiming) return;
    claimGuidance(guidance);
    mockActions.addItem(guidance.reward);
    setClaiming(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // 品が光を放ってから、画面全体が星の光に満たされる
    window.setTimeout(
      () => {
        coverScreen("light");
        window.setTimeout(() => router.push(DESTINATION), VEIL_COVER_MS);
      },
      reduced ? 0 : 500,
    );
  }

  if (!guidance) return null;
  const { night, reward } = guidance;

  return (
    <div className="relative flex h-dvh w-full items-center justify-center gap-[4vw] overflow-hidden px-8">
      {/* 星図と授かり物 */}
      <div
        className={`guidance-chart relative size-[min(84vh,46vw)] shrink-0 transition-all duration-700 ease-in ${claiming ? "scale-105 opacity-0" : ""}`}
      >
        <StarChart night={night} className="absolute inset-0 size-full" />

        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {PARTICLES.map((p, i) => (
            <span
              key={i}
              className="particle"
              style={
                {
                  "--px": `${p.px}px`,
                  "--py": `${p.py}px`,
                  "--dur": `${p.dur}s`,
                  "--delay": `${p.delay}s`,
                  "--particle-color": reward.color,
                } as CSSProperties
              }
            />
          ))}
        </div>

        <div className="absolute inset-[31%]">
          <div className="pointer-events-none absolute -inset-[60%] overflow-hidden" aria-hidden>
            {MOTES.map((m, i) => (
              <span
                key={i}
                className="guidance-mote"
                style={
                  {
                    left: `${m.left}%`,
                    width: m.size,
                    height: m.size,
                    background: reward.color,
                    boxShadow: `0 0 6px 1px ${reward.color}`,
                    "--dur": `${m.dur}s`,
                    "--delay": `${m.delay}s`,
                    "--drift": `${m.drift}px`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <div className={`guidance-item size-full ${claiming ? "guidance-item-claim" : ""}`}>
            <ItemArt glyph={reward.glyph} rarity={reward.rarity} color={reward.color} seed={reward.id} className="size-full" />
          </div>
          {claiming && (
            <span className="pointer-events-none absolute inset-0" aria-hidden>
              <span className="burst-ring" />
              {BURST.map((b, i) => (
                <span key={i} className="start-burst" style={{ "--sx": `${b.sx}px`, "--sy": `${b.sy}px` } as CSSProperties} />
              ))}
            </span>
          )}
        </div>
      </div>

      {/* 導きの言葉 */}
      <main
        className={`relative z-10 flex min-w-0 max-w-md flex-col items-center text-center transition-all duration-700 ease-in ${claiming ? "opacity-0 blur-[2px]" : ""}`}
      >
        <p
          className="title-rise whitespace-nowrap font-display text-[10px] tracking-[0.5em] text-starlight/60"
          style={{ "--rise-delay": "0.2s" } as CSSProperties}
        >
          <span className="-mr-[0.5em]">
            NIGHT {ROMAN[night - 1]} / {ROMAN[GUIDANCE_CYCLE - 1]}
          </span>
        </p>
        <h1
          className="title-rise mt-3 whitespace-nowrap text-3xl tracking-[0.4em] text-starlight-gradient short:mt-1 short:text-2xl lg:text-4xl"
          style={{ "--rise-delay": "0.35s" } as CSSProperties}
        >
          <span className="-mr-[0.4em]">星天の導き</span>
        </h1>
        <p
          className="title-rise mt-2 whitespace-nowrap font-display text-[10px] tracking-[0.45em] text-starlight/70 lg:text-[11px]"
          style={{ "--rise-delay": "0.5s" } as CSSProperties}
        >
          <span className="-mr-[0.45em]">— CELESTIAL GUIDANCE —</span>
        </p>

        <p
          className="title-rise mt-5 text-sm leading-relaxed tracking-[0.2em] text-foreground/85 short:mt-3 short:text-xs"
          style={{ "--rise-delay": "0.8s" } as CSSProperties}
        >
          夜空の星々が、
          <br />
          あなたの新たな詠唱（学び）に導きを授けました。
        </p>

        <div
          className="title-rise mt-5 w-full rounded-xl border border-starlight/20 bg-white/[0.03] px-4 py-3 short:mt-3 short:py-2"
          style={{ "--rise-delay": "1.9s" } as CSSProperties}
        >
          <p className="text-[10px] tracking-[0.3em] text-muted-foreground">授かりし品 · {RARITY_LABEL[reward.rarity]}</p>
          <p className="mt-1 text-lg tracking-[0.3em] short:text-base" style={{ color: reward.color, textShadow: `0 0 12px ${reward.color}80` }}>
            {reward.name}
          </p>
          {reward.kind === "catalyst" && <p className="mt-0.5 text-[11px] tracking-wider text-muted-foreground">{reward.effect}</p>}
        </div>

        <div className="title-rise mt-6 short:mt-3" style={{ "--rise-delay": "2.3s" } as CSSProperties}>
          <button type="button" onClick={receive} disabled={claiming} className="start-plate relative rounded-xl px-10 py-3.5 short:py-2.5">
            <span className="relative block text-base tracking-[0.4em] text-[#f6e9bd] short:text-sm">導きを受け取る</span>
            <span className="relative mt-1 block font-display text-[10px] tracking-[0.45em] text-starlight/70">RECEIVE THE GUIDANCE</span>
          </button>
        </div>
      </main>
    </div>
  );
}
