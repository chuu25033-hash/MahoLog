"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArcaneLogo } from "@/components/arcane-icons";
import { GoogleSignInButton } from "@/components/observer/google-sign-in";
import { RestoreDialog } from "@/components/observer/observer-id";
import { useObserver } from "@/lib/cloud-sync";
import { VEIL_COVER_MS, coverScreen } from "@/components/transition-veil";
import { pendingGuidance } from "@/lib/celestial-guidance";
import { soundManager } from "@/lib/sound/sound-manager";
import { isCloudSyncEnabled } from "@/lib/supabase/config";
import { CelestialSphere } from "./celestial-sphere";

const DESTINATION = "/dashboard";
/** その日初めての詠唱では、星天の導きを挟んでから魔術書庫へ向かう */
const GUIDANCE = "/guidance";
/** ホバー中の集光ループ 1 周の長さ（s）。粒子ごとの開始をこの範囲に散らす */
const GATHER_S = 3.2;

/** ボタン周囲の星屑: [角度, 距離(px), 大きさ, 遅延] — 決定的な配置 */
const SPARKS = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2 + (i % 3) * 0.2;
  const dist = 70 + ((i * 37) % 60);
  return {
    x: Math.cos(angle) * dist * 1.6,
    y: Math.sin(angle) * dist * 0.7,
    size: i % 4 === 0 ? 3 : 2,
    delay: (i % 6) * 0.04,
    gather: (((i * 7) % 18) / 18) * GATHER_S,
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
  const [restoreOpen, setRestoreOpen] = useState(false);
  const observer = useObserver();

  useEffect(() => {
    router.prefetch(DESTINATION);
    router.prefetch(GUIDANCE);
  }, [router]);

  function start() {
    if (leaving) return;
    setBurst((b) => b + 1);
    setLeaving(true);
    soundManager.playSe("begin");
    // 探求の始まりとともに、タイトルの曲を静かに消していく
    soundManager.setAmbience(null);
    coverScreen();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const href = pendingGuidance() ? GUIDANCE : DESTINATION;
    window.setTimeout(() => router.push(href), reduced ? 0 : VEIL_COVER_MS);
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
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
        className={`pointer-events-none absolute inset-0 flex items-center justify-center p-[4dvh] transition-all duration-700 ease-in ${leaving ? "scale-105 opacity-0" : "opacity-60"}`}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(closest-side,rgba(8,12,22,0.8)_35%,rgba(8,12,22,0.35)_70%,transparent)]" aria-hidden />

      <main
        className={`relative z-10 flex flex-col items-center px-6 text-center transition-all duration-700 ease-in ${leaving ? "scale-[0.98] opacity-0 blur-[2px]" : ""}`}
      >
        <p
          className="title-rise flex items-center gap-3 whitespace-nowrap text-xs tracking-[0.6em] text-starlight/75 short:text-[11px] lg:text-sm"
          style={{ "--rise-delay": "0.2s" } as CSSProperties}
        >
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-starlight/60" aria-hidden />
          <span className="-mr-[0.6em]">魔導録</span>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-starlight/60" aria-hidden />
        </p>
        <h1
          className="title-rise title-logo mt-4 whitespace-nowrap font-display text-[clamp(3rem,13dvh,6.5rem)] font-medium leading-none tracking-[0.18em] text-starlight-gradient short:mt-2 portrait:text-[clamp(2.25rem,13vw,4.5rem)]"
          style={{ "--rise-delay": "0.45s" } as CSSProperties}
          aria-label="マホログ MAHOLOG"
        >
          <span className="-mr-[0.18em]">MAHOLOG</span>
        </h1>
        <p
          className="title-rise mt-4 whitespace-nowrap font-display text-[10px] tracking-[0.5em] text-starlight/55 short:mt-2 portrait:tracking-[0.3em] portrait:whitespace-normal lg:text-[11px]"
          style={{ "--rise-delay": "0.8s" } as CSSProperties}
        >
          <span className="-mr-[0.5em]">Arcane Observatory for Knowledge</span>
        </p>

        <div
          className="title-rise my-7 flex items-center gap-3 text-starlight/40 short:my-4"
          style={{ "--rise-delay": "0.9s" } as CSSProperties}
          aria-hidden
        >
          <span className="h-px w-16 bg-gradient-to-r from-transparent to-starlight/50" />
          <ArcaneLogo className="size-6 text-starlight/80 drop-shadow-[0_0_6px_rgba(226,201,116,0.5)]" />
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
          孤独な世界の奥地に眠る秘術を解き明かし、己の実力を高める旅へ
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
                      "--spark-delay": `${s.gather}s`,
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
              詠唱を始める
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
          ) : isCloudSyncEnabled ? (
            observer?.account ? (
              <p>ログイン中 · {observer.account.email ?? "Google アカウント"}</p>
            ) : (
              // Google でログインすれば、別の端末で始めた旅もそのまま続けられる。観測者IDでの復元も残しておく
              <div className="flex flex-col items-center gap-3">
                <GoogleSignInButton next="/" className="w-60" />
                <button type="button" onClick={() => setRestoreOpen(true)} className="transition-colors hover:text-starlight">
                  観測者IDで世界線を復元する
                </button>
              </div>
            )
          ) : null}
        </div>
        {restoreOpen && <RestoreDialog onClose={() => setRestoreOpen(false)} onRestored={() => window.location.assign(DESTINATION)} />}
      </main>

    </div>
  );
}
