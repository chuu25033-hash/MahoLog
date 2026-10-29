"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CelestialSphere } from "./celestial-sphere";

const DESTINATION = "/dashboard";
/** 光のフェードが満ちてから遷移するまでの時間 */
const LEAVE_MS = 1100;

/** ボタン周囲の星屑: [角度, 距離(px), 大きさ, 遅延] — 決定的な配置 */
const SPARKS = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2 + (i % 3) * 0.2;
  const dist = 70 + ((i * 37) % 60);
  return {
    x: Math.cos(angle) * dist * 1.6,
    y: Math.sin(angle) * dist * 0.7,
    size: i % 4 === 0 ? 3 : 2,
    delay: (i % 6) * 0.08,
  };
});

/** タイトル画面専用の明るめの星（背景の StarField に重ねる） */
const BRIGHT_STARS = Array.from({ length: 28 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin((i + n) * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  };
  return { left: r(1) * 100, top: r(2) * 100, size: 1.5 + r(3) * 1.5, dur: 3 + r(4) * 5, delay: -r(5) * 8 };
});

export function TitleScreen({ authEnabled }: { authEnabled: boolean }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    router.prefetch(DESTINATION);
  }, [router]);

  function start(href: string = DESTINATION) {
    if (leaving) return;
    setBurst((b) => b + 1);
    setLeaving(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => router.push(href), reduced ? 0 : LEAVE_MS);
  }

  return (
    <div className="relative flex h-dvh w-full items-center justify-center overflow-hidden">
      {/* 明るい星屑 */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {BRIGHT_STARS.map((s, i) => (
          <span
            key={i}
            className="star"
            style={
              {
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: s.size,
                height: s.size,
                "--dur": `${s.dur}s`,
                "--delay": `${s.delay}s`,
                "--max": 1,
                boxShadow: "0 0 6px 1px rgba(255,240,200,0.5)",
              } as CSSProperties
            }
          />
        ))}
      </div>

      {/* 天球儀 */}
      <CelestialSphere
        className={`pointer-events-none absolute inset-0 flex items-center justify-center p-[4vh] transition-all duration-[1400ms] ${leaving ? "scale-110 opacity-0" : "opacity-70"}`}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(closest-side,rgba(8,12,22,0.75),transparent)]" aria-hidden />

      <main
        className={`relative z-10 flex flex-col items-center px-6 text-center transition-all duration-1000 ${leaving ? "scale-[1.03] opacity-0 blur-[2px]" : ""}`}
      >
        <h1
          className="title-rise title-logo text-6xl font-semibold tracking-[0.35em] text-starlight-gradient short:text-5xl lg:text-7xl"
          style={{ "--rise-delay": "0.2s" } as CSSProperties}
        >
          <span className="-mr-[0.35em]">マホログ</span>
        </h1>
        <p
          className="title-rise mt-3 font-display text-[11px] tracking-[0.45em] text-starlight/70 short:mt-2 lg:text-xs"
          style={{ "--rise-delay": "0.6s" } as CSSProperties}
        >
          MAHOLOG — Arcane Observatory for Knowledge
        </p>

        <div
          className="title-rise my-8 flex items-center gap-3 text-starlight/40 short:my-4"
          style={{ "--rise-delay": "0.9s" } as CSSProperties}
          aria-hidden
        >
          <span className="h-px w-16 bg-gradient-to-r from-transparent to-starlight/50" />
          <span className="text-[10px]">✦</span>
          <span className="h-px w-16 bg-gradient-to-l from-transparent to-starlight/50" />
        </div>

        <p
          className="title-rise text-lg tracking-[0.3em] text-foreground/85 short:text-base"
          style={{ "--rise-delay": "1.1s" } as CSSProperties}
        >
          日々の学びは、夜空を彩る星となる。
        </p>
        <p
          className="title-rise mt-2 text-xs tracking-[0.25em] text-muted-foreground"
          style={{ "--rise-delay": "1.4s" } as CSSProperties}
        >
          積み重ねた時間を魔力に変えて、あなただけの星図を描こう
        </p>

        <div className="title-rise mt-10 short:mt-5" style={{ "--rise-delay": "1.8s" } as CSSProperties}>
          <button
            type="button"
            onClick={() => start()}
            disabled={leaving}
            className="start-plate group relative rounded-xl px-12 py-4 short:py-3"
          >
            {/* ホバーで広がる星屑 */}
            <span className="pointer-events-none absolute inset-0" aria-hidden>
              {SPARKS.map((s, i) => (
                <span
                  key={i}
                  className="start-spark"
                  style={
                    {
                      "--sx": `${s.x}px`,
                      "--sy": `${s.y}px`,
                      width: s.size,
                      height: s.size,
                      transitionDelay: `${s.delay}s`,
                    } as CSSProperties
                  }
                />
              ))}
            </span>
            {/* クリックで弾ける星屑 */}
            {burst > 0 && (
              <span key={burst} className="pointer-events-none absolute inset-0" aria-hidden>
                <span className="burst-ring" />
                {SPARKS.map((s, i) => (
                  <span
                    key={i}
                    className="start-burst"
                    style={{ "--sx": `${s.x * 2.4}px`, "--sy": `${s.y * 2.4}px`, animationDelay: `${s.delay / 2}s` } as CSSProperties}
                  />
                ))}
              </span>
            )}
            <span className="relative block text-base tracking-[0.4em] text-[#f6e9bd] short:text-sm">
              観測を開始する
            </span>
            <span className="relative mt-1 block font-display text-[10px] tracking-[0.5em] text-starlight/70">
              PRESS TO START
            </span>
          </button>
        </div>

        <div
          className="title-rise mt-6 text-[11px] tracking-[0.2em] text-muted-foreground short:mt-3"
          style={{ "--rise-delay": "2.2s" } as CSSProperties}
        >
          {authEnabled ? (
            <Link href="/login" className="transition-colors hover:text-starlight">
              ログイン / 新規登録
            </Link>
          ) : (
            <button type="button" onClick={() => start()} className="transition-colors hover:text-starlight">
              デモモードで観測する（サンプルデータ）
            </button>
          )}
        </div>
      </main>

      {/* 柔らかな光のフェードアウト */}
      <div
        className={`pointer-events-none absolute inset-0 z-20 transition-opacity duration-[1100ms] ease-in ${leaving ? "opacity-100" : "opacity-0"}`}
        style={{
          background:
            "radial-gradient(circle at 50% 62%, rgba(255,248,220,0.9) 0%, rgba(226,201,116,0.45) 30%, rgba(8,12,22,0.96) 75%)",
        }}
        aria-hidden
      />
    </div>
  );
}
