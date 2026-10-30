"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ArcaneLogo, RankSigil } from "@/components/arcane-icons";
import { ItemArt } from "@/components/item-art";
import { MagicCircle } from "@/components/magic-circle";
import { CORE_LAYER, FAR_LAYER, LINES, MID_LAYER } from "@/components/prologue/prologue";
import { CATALYSTS, LORES, RELICS, type Item } from "@/lib/items";
import { synthAmbience, synthSe } from "@/lib/sound/synth";

// SNS（縦長 9:16）に載せる予告編。アプリの魔法陣・遺物・階級の印をそのまま使って描く。
// 時刻 t（ms）だけで画面が決まるように組み、撮影ツール（video/capture.mjs）が1コマずつ時刻を進めて撮る。
// ページ上の CSS アニメーションも同じ時刻へ合わせる。data-t0 を持つ場面の中のアニメーションは、その時刻から始まる

// ---- 構成（ms） ----
// つかみ: 詠唱中の魔法陣 → 世界: プロローグの陣とコンセプト、遺物が下から上へ淡く流れる
// → 授かる: 流れ星と遺物 → 積み重ね: 一夜ずつの星座と階級の印 → 孤独: 星脈に灯す光 → 終幕: ロゴと入口の案内
// 最後は冒頭の魔法陣へ戻し、繰り返し再生でも切れ目なくつながるようにする
const HOOK = { out: [4200, 5800] } as const;
const SIGIL = { t0: 4300, in: [4300, 6000], out: [30800, 32200] } as const;
const WORLD_LINES: { parts: ReactNode[]; at: readonly [number, number, number, number] }[] = [
  { parts: LINES[0], at: [6200, 7500, 11400, 12500] },
  { parts: LINES[1], at: [12700, 14000, 18000, 19100] },
  { parts: ["学んだ時間は、魔力となり、", "古の秘術を少しずつ解き明かしていく。"], at: [19300, 20600, 24600, 25700] },
  { parts: ["誰とも競わない。", "ただ己の探求だけを、星に記す。"], at: [25900, 27200, 30400, 31500] },
];
const DRIFT = { in: [13500, 16000], out: [30000, 32000] } as const;
const BESTOW = { in: 31800, charge: [32500, 35800], fall: [35800, 36700], out: [41600, 42600] } as const;
const NIGHTS = { start: 42600, step: 650, caption: [43000, 44200, 47000, 47900], out: [47200, 48200] } as const;
const RANK_STEPS = [
  { numeral: "I", title: "門前の解読者", t0: 47600, until: 49300 },
  { numeral: "V", title: "深淵の探究者", t0: 49100, until: 50800 },
  { numeral: "X", title: "至高の綴り手", t0: 50600, until: 53600 },
] as const;
const SOLITUDE = { in: 53800, line: [54400, 55700, 58300, 59300], out: [58600, 59600] } as const;
const FINALE = { line: [59700, 60800, 62300, 63000], logo: [62500, 63700], guide: [63400, 64300], out: [65700, 66600] } as const;
const LOOP = { in: [65800, 67000] } as const;
/** 予告編の長さ（ms） */
export const TRAILER_MS = 67_000;

// ---- 時刻の補助 ----

/** 区間 [a, b] での 0→1 の進み（なめらかに） */
function ease(t: number, a: number, b: number) {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

/** a〜b で浮かび、c〜d で消える */
function fade(t: number, [a, b, c, d]: readonly number[]) {
  return ease(t, a, b) * (1 - ease(t, c, d));
}

/** 浮かぶ・消えるときに、霞から結ぶように少しぼかす */
function veil(opacity: number): CSSProperties {
  return { opacity, filter: `blur(${(1 - opacity) * 4}px)` };
}

// 決定的な疑似乱数
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/** サーバーとブラウザで小数の桁がずれないよう丸めた百分率 */
const percent = (seed: number) => Math.round(rand(seed) * 10000) / 100;

const STARS = Array.from({ length: 90 }, (_, i) => {
  const big = rand(i + 500) > 0.9;
  return {
    left: percent(i),
    top: percent(i + 1000),
    size: big ? 2 : rand(i + 2000) > 0.6 ? 1.4 : 1,
    dur: 4 + rand(i + 3000) * 6,
    delay: -rand(i + 4000) * 10,
    max: big ? 1 : 0.45 + rand(i + 5000) * 0.4,
  };
});

/** 詠唱の魔法陣の頂点に灯す科目の色（デモの科目と同じ） */
const NODES = ["#e7a9c6", "#8db7f2", "#8fdcc4", "#e2c974", "#b9a2f7"].map((color, i) => ({ color, active: i === 1 }));

/** 下から上へ流す遺物（絵柄の重ならないものを選ぶ） */
const DRIFT_ITEMS: Item[] = (() => {
  const seen = new Set<string>();
  return [...RELICS, ...CATALYSTS, ...LORES].filter((item) => {
    if (seen.has(item.svgIcon)) return false;
    seen.add(item.svgIcon);
    return true;
  });
})();

const DRIFTERS = Array.from({ length: 14 }, (_, i) => {
  const left = i % 2 === 0;
  return {
    item: DRIFT_ITEMS[i % DRIFT_ITEMS.length],
    // 文字の幅（中央）にかからない左右の帯を昇る
    x: left ? 3 + rand(i + 70) * 10 : 87 + rand(i + 70) * 10,
    size: 34 + rand(i + 80) * 16,
    /** 画面の下から上まで昇るのにかかる時間（ms） */
    period: 11000 + rand(i + 90) * 6000,
    phase: rand(i + 100),
  };
});

/** 授かる遺物 */
const BESTOWED = RELICS.find((r) => r.id === "r-armillary")!;
const BESTOWED_FLAVOR = ["天球の運行を寸分違わず写す真鍮の環。", "回せば星々の和音が整い、", "理の言葉が澄んで響く。"];

/** 一夜ずつ灯る星（上から 15〜40% の帯に、左から右へ） */
const NIGHT_STARS = Array.from({ length: 7 }, (_, i) => ({
  x: 14 + i * 12 + (rand(i + 300) - 0.5) * 6,
  y: 18 + rand(i + 310) * 22,
}));

// ---- 場面 ----

/** 時刻 t（ms）の画面 */
function Frame({ t }: { t: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#03050b]">
      <Sky t={t} />
      <Hook t={t} />
      <World t={t} />
      <Bestow t={t} />
      <Nights t={t} />
      <Solitude t={t} />
      <Finale t={t} />
      <LoopBack t={t} />
    </div>
  );
}

/** 星空（アプリの背景と同じ星）。終幕の前に少しずつ沈める */
function Sky({ t }: { t: number }) {
  const opacity = 0.25 + ease(t, 3000, 7000) * 0.75 - ease(t, SOLITUDE.in - 400, SOLITUDE.in + 1000) * 0.5 + ease(t, FINALE.line[0] - 1000, FINALE.line[0] + 400) * 0.4;
  return (
    <div className="night-sky absolute inset-0" style={{ opacity }}>
      {STARS.map((s, i) => (
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
              "--max": s.max,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** 詠唱中の魔法陣を、画面いっぱいに寄せる */
function ChantCircle({ intensity, scale, opacity, t0 }: { intensity: number; scale: number; opacity: number; t0: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" data-t0={t0} style={{ opacity }}>
      <div className="relative w-[118%] shrink-0" style={{ transform: `scale(${scale})` }}>
        <MagicCircle color="#8db7f2" running intensity={intensity} nodes={NODES} className="w-full" />
      </div>
    </div>
  );
}

/** つかみ: 魔力の集束が高まりながら、ゆっくり引いていく */
function Hook({ t }: { t: number }) {
  if (t > HOOK.out[1]) return null;
  const out = ease(t, HOOK.out[0], HOOK.out[1]);
  return (
    <div style={{ filter: `blur(${out * 6}px)` }} className="absolute inset-0">
      <ChantCircle t0={0} intensity={0.35 + ease(t, 0, 4200) * 0.65} scale={1.32 - ease(t, 0, 5000) * 0.24 + out * 0.15} opacity={1 - out} />
    </div>
  );
}

/** 世界: 闇に描かれる古代の魔法陣とコンセプト。途中から遺物が淡く昇る */
function World({ t }: { t: number }) {
  if (t < SIGIL.in[0] || t > SIGIL.out[1] + 500) return null;
  const sigil = ease(t, SIGIL.in[0], SIGIL.in[1]) * (1 - ease(t, SIGIL.out[0], SIGIL.out[1]));
  const drift = ease(t, DRIFT.in[0], DRIFT.in[1]) * (1 - ease(t, DRIFT.out[0], DRIFT.out[1]));
  return (
    <>
      <div className="prologue absolute inset-0" data-drawing data-t0={SIGIL.t0} style={{ opacity: sigil, transform: `scale(${1 + (t - SIGIL.t0) / 150_000})` }}>
        <svg viewBox="-450 -620 900 1600" preserveAspectRatio="xMidYMid slice" className="prologue-pulse absolute inset-0 size-full text-[#e6dcb8]" fill="none" aria-hidden>
          <g transform="rotate(90)">
            <g className="prologue-far">{FAR_LAYER}</g>
            <g className="prologue-mid">{MID_LAYER}</g>
          </g>
          <g className="prologue-spin">{CORE_LAYER}</g>
        </svg>
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_42%,rgba(3,5,11,0.9)_58%,rgba(3,5,11,0.9)_78%,transparent)]" />
      </div>

      {drift > 0 &&
        DRIFTERS.map((d, i) => {
          // 画面の下端（110%）から上端（-10%）へ昇り、上下の端と文字の帯では消える
          const progress = ((t - DRIFT.in[0]) / d.period + d.phase) % 1;
          const y = 110 - progress * 120;
          const edge = Math.min(1, Math.max(0, (110 - y) / 15), Math.max(0, (y + 10) / 15));
          const textBand = y > 50 && y < 76 ? 0.35 : 1;
          return (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${d.x}%`,
                top: `${y}%`,
                width: d.size,
                height: d.size,
                transform: `translate(-50%, -50%) rotate(${(t / 60) * (i % 2 ? 1 : -1) * 0.2}deg)`,
                opacity: drift * edge * textBand * 0.3,
              }}
            >
              <ItemArt icon={d.item.svgIcon} rarity={d.item.rarity} color={d.item.color} seed={d.item.id} className="size-full" />
            </div>
          );
        })}

      <div className="absolute inset-x-0 top-[57%] grid place-items-center text-center">
        {WORLD_LINES.map(({ parts, at }, i) => (
          <Stanza key={i} parts={parts} opacity={fade(t, at)} />
        ))}
      </div>
    </>
  );
}

function Stanza({ parts, opacity, className = "text-foreground/90" }: { parts: ReactNode[]; opacity: number; className?: string }) {
  if (opacity <= 0) return null;
  return (
    <p className={`col-start-1 row-start-1 font-serif text-[17px] leading-[2.3] tracking-[0.22em] whitespace-nowrap ${className}`} style={veil(opacity)}>
      {parts.map((part, i) => (
        <span key={i} className="block">
          {part}
        </span>
      ))}
    </p>
  );
}

/** 授かる: 詠唱の陣が満ち、光が弾けて流れ星が降り、遺物が現れる */
function Bestow({ t }: { t: number }) {
  if (t < BESTOW.in || t > BESTOW.out[1]) return null;
  const [fallStart, impact] = BESTOW.fall;
  const circle = ease(t, BESTOW.in, BESTOW.in + 1300) * (1 - ease(t, fallStart - 200, fallStart + 600));
  const flash = ease(t, fallStart - 300, fallStart) * (1 - ease(t, fallStart, fallStart + 1200));
  const out = 1 - ease(t, BESTOW.out[0], BESTOW.out[1]);
  // 流れ星: 右上から陣の中心（上から 32%）へ
  const fall = ease(t, fallStart, impact);
  const head = { x: 92 - fall * 42, y: 2 + fall * 30 };
  const streak = fall > 0 && fall < 1;
  const ring = Math.max(0, (t - impact) / 1600);
  const item = ease(t, impact, impact + 1100);
  const name = ease(t, impact + 400, impact + 1300);
  const flavor = ease(t, impact + 1300, impact + 2300);

  return (
    <div className="absolute inset-0" style={{ opacity: out }}>
      <div className="absolute inset-x-0 top-[2%] h-[60%]">
        <ChantCircle t0={BESTOW.in} intensity={0.2 + ease(t, BESTOW.charge[0], BESTOW.charge[1]) * 0.8} scale={0.82 + ease(t, BESTOW.charge[0], BESTOW.charge[1]) * 0.06} opacity={circle} />
      </div>
      <div
        className="absolute inset-0"
        style={{ opacity: flash, background: "radial-gradient(60% 40% at 50% 32%, rgba(255,248,220,0.85), rgba(226,201,116,0.25) 45%, transparent 75%)" }}
      />
      {streak && (
        <div
          className="absolute h-px w-[46%] origin-right"
          style={{
            right: `${100 - head.x}%`,
            top: `${head.y}%`,
            transform: `rotate(${Math.atan2(30 * 16, -42 * 9) * (180 / Math.PI) + 180}deg)`,
            background: "linear-gradient(90deg, transparent, rgba(226,201,116,0.25) 50%, rgba(255,248,220,0.95))",
            boxShadow: "0 0 8px rgba(255,248,220,0.6)",
          }}
        >
          <span className="absolute top-1/2 right-0 size-1.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fff8dc] shadow-[0_0_12px_4px_rgba(255,248,220,0.7)]" />
        </div>
      )}
      {ring > 0 && ring < 1 && (
        <span
          className="absolute top-[32%] left-1/2 size-24 rounded-full border border-starlight/70"
          style={{ transform: `translate(-50%, -50%) scale(${1 + ring * 3})`, opacity: 1 - ring }}
        />
      )}
      <div
        className="absolute top-[15%] left-1/2 size-[220px]"
        style={{ transform: `translateX(-50%) translateY(${Math.sin(t / 900) * 5}px) scale(${0.85 + item * 0.15})`, ...veil(item) }}
      >
        <ItemArt icon={BESTOWED.svgIcon} rarity={BESTOWED.rarity} color={BESTOWED.color} seed={BESTOWED.id} className="size-full" />
      </div>
      <div className="absolute inset-x-0 top-[50%] flex flex-col items-center gap-1 text-center" style={veil(name)}>
        <p className="text-[11px] tracking-[0.4em] text-starlight/70">流れ星が遺したもの</p>
        <p className="mt-1 font-serif text-[26px] tracking-[0.3em] whitespace-nowrap" style={{ color: BESTOWED.color, textShadow: `0 0 14px ${BESTOWED.color}88` }}>
          {BESTOWED.name}
        </p>
        <p className="font-display text-[9px] tracking-[0.35em] text-starlight/55">THE CELESTIAL TUNER · RANK S</p>
      </div>
      <p className="absolute inset-x-0 top-[63%] text-center font-serif text-[14px] leading-[2.1] tracking-[0.18em] text-foreground/85" style={veil(flavor)}>
        {BESTOWED_FLAVOR.map((part, i) => (
          <span key={i} className="block whitespace-nowrap">
            {part}
          </span>
        ))}
      </p>
    </div>
  );
}

/** 積み重ね: 一夜ずつ星が灯って星座になり、階級の印が組み上がっていく */
function Nights({ t }: { t: number }) {
  if (t < NIGHTS.start || t > RANK_STEPS[2].until + 400) return null;
  // 階級の印が組み上がる間は、背後で淡く残す
  const constellation = 1 - ease(t, NIGHTS.out[0], NIGHTS.out[1]) * 0.88 - ease(t, RANK_STEPS[2].until - 900, RANK_STEPS[2].until) * 0.12;
  return (
    <div className="absolute inset-0">
      <svg viewBox="0 0 100 177.8" className="absolute inset-0 size-full" style={{ opacity: constellation }} aria-hidden>
        {NIGHT_STARS.map((s, i) => {
          const lit = ease(t, NIGHTS.start + i * NIGHTS.step, NIGHTS.start + i * NIGHTS.step + 500);
          const prev = NIGHT_STARS[i - 1];
          const drawn = prev ? ease(t, NIGHTS.start + i * NIGHTS.step - 300, NIGHTS.start + i * NIGHTS.step + 200) : 0;
          const y = (s.y / 100) * 177.8;
          return (
            <g key={i}>
              {prev && drawn > 0 && (
                <line
                  x1={prev.x}
                  y1={(prev.y / 100) * 177.8}
                  x2={prev.x + (s.x - prev.x) * drawn}
                  y2={(prev.y / 100) * 177.8 + (y - (prev.y / 100) * 177.8) * drawn}
                  stroke="#e2c974"
                  strokeOpacity={0.55}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <circle cx={s.x} cy={y} r={0.9 * lit} fill="#fff8dc" style={{ filter: "drop-shadow(0 0 1.5px #e2c974)" }} />
              <circle cx={s.x} cy={y} r={2.6 * lit} fill="#e2c974" opacity={0.15 * lit} />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-x-0 top-[57%] grid place-items-center text-center">
        <Stanza parts={["一夜ごとに、星がひとつ灯る。", "その軌跡が、あなたの星座になる。"]} opacity={fade(t, NIGHTS.caption)} />
      </div>
      {RANK_STEPS.map((step, i) => {
        const shown = ease(t, step.t0, step.t0 + 500) * (1 - ease(t, step.until - 400, step.until));
        if (shown <= 0) return null;
        return (
          <div key={step.numeral} className="absolute inset-0" style={{ opacity: shown }}>
            <div className="absolute top-[16%] left-1/2 size-[200px] -translate-x-1/2 text-starlight drop-shadow-[0_0_10px_rgba(226,201,116,0.45)]" data-t0={step.t0 - 400}>
              <RankSigil numeral={step.numeral} animate className="size-full" />
            </div>
            <div className="absolute inset-x-0 top-[52%] flex flex-col items-center gap-1 text-center">
              <p className="font-display text-[11px] tracking-[0.5em] text-starlight/60">{i === 0 ? "ARCANE RANK" : "ASCENSION"}</p>
              <p className="font-display text-[34px] text-starlight-gradient">{step.numeral}</p>
              <p className="font-serif text-[20px] tracking-[0.3em] whitespace-nowrap text-foreground/90">{step.title}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 孤独: 闇の中、遠く離れた二つの小さな光が、それぞれに脈打つ */
function Solitude({ t }: { t: number }) {
  if (t < SOLITUDE.in || t > SOLITUDE.out[1]) return null;
  const shown = ease(t, SOLITUDE.in, SOLITUDE.in + 1200) * (1 - ease(t, SOLITUDE.out[0], SOLITUDE.out[1]));
  const lights = [
    { x: 50, y: 34, size: 6, period: 2600, color: "#e2c974" },
    { x: 20, y: 15, size: 4, period: 3400, color: "#71e2ef" },
  ];
  return (
    <div className="absolute inset-0" style={{ opacity: shown }}>
      {lights.map((l, i) => {
        const pulse = 0.55 + 0.45 * Math.sin((t / l.period) * Math.PI * 2 + i * 1.7);
        return (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${l.x}%`,
              top: `${l.y}%`,
              width: l.size,
              height: l.size,
              transform: "translate(-50%, -50%)",
              background: l.color,
              opacity: pulse,
              boxShadow: `0 0 ${10 + pulse * 14}px ${3 + pulse * 3}px ${l.color}66`,
            }}
          />
        );
      })}
      <div className="absolute inset-x-0 top-[57%] grid place-items-center text-center">
        <Stanza parts={LINES[2]} opacity={fade(t, SOLITUDE.line)} />
      </div>
    </div>
  );
}

/** 終幕: 観測の始まりと、名と、入口の案内 */
function Finale({ t }: { t: number }) {
  if (t < FINALE.line[0] || t > FINALE.out[1]) return null;
  const out = 1 - ease(t, FINALE.out[0], FINALE.out[1]);
  const logo = ease(t, FINALE.logo[0], FINALE.logo[1]) * out;
  const guide = ease(t, FINALE.guide[0], FINALE.guide[1]) * out;
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-x-0 top-[40%] grid place-items-center text-center">
        <Stanza parts={LINES[3]} opacity={fade(t, FINALE.line)} className="font-medium text-starlight-gradient" />
      </div>
      <div className="absolute inset-x-0 top-[33%] flex flex-col items-center text-center" style={veil(logo)}>
        <p className="flex items-center gap-3 text-[12px] tracking-[0.6em] whitespace-nowrap text-starlight/75">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-starlight/60" />
          <span className="-mr-[0.6em]">マホログ</span>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-starlight/60" />
        </p>
        <p className="title-logo mt-3 font-display text-[54px] leading-none font-medium tracking-[0.18em] text-starlight-gradient" data-t0={FINALE.logo[0]}>
          <span className="-mr-[0.18em]">MAHOLOG</span>
        </p>
        <p className="mt-3 font-display text-[9px] tracking-[0.3em] whitespace-nowrap text-starlight/55">
          <span className="-mr-[0.3em]">ARCANE OBSERVATORY FOR KNOWLEDGE</span>
        </p>
        <div className="mt-6 flex items-center gap-3 text-starlight/50">
          <span className="h-px w-14 bg-gradient-to-r from-transparent to-starlight/50" />
          <ArcaneLogo className="size-6 text-starlight/80 drop-shadow-[0_0_6px_rgba(226,201,116,0.5)]" />
          <span className="h-px w-14 bg-gradient-to-l from-transparent to-starlight/50" />
        </div>
      </div>
      <div className="absolute inset-x-0 top-[62%] flex flex-col items-center gap-1.5 text-center" style={veil(guide)}>
        <p className="font-serif text-[15px] tracking-[0.25em] whitespace-nowrap text-foreground/90">入口は、プロフィールとコメント欄のリンクから</p>
        <p className="font-display text-[9px] tracking-[0.4em] text-starlight/60">LINK IN PROFILE · COMMENTS</p>
      </div>
    </div>
  );
}

/** 繰り返し再生のつなぎ: 冒頭と同じ魔法陣を浮かべ、最後の1コマを最初の1コマに重ねる */
function LoopBack({ t }: { t: number }) {
  if (t < LOOP.in[0]) return null;
  return <ChantCircle t0={TRAILER_MS} intensity={0.35} scale={1.32} opacity={ease(t, LOOP.in[0], LOOP.in[1])} />;
}

// ---- 音: アプリと同じ合成で、タイトルの曲と効果音を時刻どおりに鳴らす ----

/** 効果音を鳴らす時刻（ms） */
const SE_CUES: [number, Parameters<typeof synthSe>[1]][] = [
  [0, "chantStart"],
  [SIGIL.t0, "prologueOpen"],
  ...WORLD_LINES.map(({ at }): [number, Parameters<typeof synthSe>[1]] => [at[0], "prologueLine"]),
  [BESTOW.charge[0], "chantStart"],
  [BESTOW.fall[0] - 200, "chantComplete"],
  [BESTOW.fall[1], "reward"],
  [NIGHTS.start, "restore"],
  [RANK_STEPS[0].t0, "levelUp"],
  [RANK_STEPS[2].t0, "rankUp"],
  [SOLITUDE.line[0], "prologueLine"],
  [FINALE.line[0], "prologueLine"],
  [FINALE.logo[0], "begin"],
];

// ---- 遠くの森から届くフクロウの声（モリフクロウ風）。曲と同じく音声ファイルを使わずに合成する ----

/** 鳴かせる時刻（ms）と遠さ（0〜1。1 がいちばん遠く小さい） */
const OWL_CUES: [number, number][] = [
  [9000, 0.3],
  [22800, 0.45],
  [SOLITUDE.line[0] + 1600, 0.8],
];

/** 減衰していくノイズで作る、夜の森の残響 */
function forestReverb(ctx: AudioContext, destination: AudioNode) {
  const seconds = 3.2;
  const buffer = ctx.createBuffer(2, Math.round(ctx.sampleRate * seconds), ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2.6;
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = buffer;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 1400;
  convolver.connect(tone).connect(destination);
  return convolver;
}

/**
 * フクロウのひと声: 少し下がっていく丸い声と、かすかな息。tremolo を付けると震える長い声になる
 */
function hoot(ctx: AudioContext, out: AudioNode, at: number, o: { freq: number; length: number; level: number; tremolo?: boolean }) {
  const end = at + o.length;
  const voice = ctx.createGain();
  voice.gain.setValueAtTime(0.0001, at);
  voice.gain.exponentialRampToValueAtTime(o.level, at + Math.min(0.07, o.length * 0.3));
  voice.gain.setValueAtTime(o.level, Math.max(at + 0.07, end - 0.16));
  voice.gain.exponentialRampToValueAtTime(0.0001, end);
  voice.connect(out);

  // 声の芯（わずかに倍音を混ぜて、木の洞に響くような丸みを出す）
  [
    [1, 1],
    [2, 0.07],
  ].forEach(([mult, gain]) => {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(o.freq * mult * 1.03, at);
    osc.frequency.exponentialRampToValueAtTime(o.freq * mult * 0.9, end);
    const level = ctx.createGain();
    level.gain.value = gain;
    osc.connect(level).connect(voice);
    if (o.tremolo) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 9;
      const depth = ctx.createGain();
      depth.gain.value = o.freq * mult * 0.025;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(at);
      lfo.stop(end);
    }
    osc.start(at);
    osc.stop(end + 0.05);
  });

  // 息の音
  const noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * o.length), ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const breath = ctx.createBufferSource();
  breath.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = o.freq * 1.4;
  band.Q.value = 2.5;
  const breathLevel = ctx.createGain();
  breathLevel.gain.value = 0.18;
  breath.connect(band).connect(breathLevel).connect(voice);
  breath.start(at);
}

/** 「ホーー」……「ホッ、ホ、ホーーォ」 */
function owlCall(ctx: AudioContext, dry: AudioNode, wet: AudioNode, at: number, distance: number) {
  const out = ctx.createGain();
  const level = 0.1 * (1 - distance * 0.6);
  // 遠いほど高い音が削れ、残響に埋もれる
  const air = ctx.createBiquadFilter();
  air.type = "lowpass";
  air.frequency.value = 1800 - distance * 900;
  out.connect(air);
  const direct = ctx.createGain();
  direct.gain.value = 0.55 - distance * 0.35;
  air.connect(direct).connect(dry);
  const send = ctx.createGain();
  send.gain.value = 0.6 + distance * 0.4;
  air.connect(send).connect(wet);

  const f = 430;
  hoot(ctx, out, at, { freq: f, length: 0.85, level });
  hoot(ctx, out, at + 2.1, { freq: f * 1.04, length: 0.16, level: level * 0.7 });
  hoot(ctx, out, at + 2.45, { freq: f, length: 0.22, level: level * 0.8 });
  hoot(ctx, out, at + 2.85, { freq: f * 1.02, length: 1.2, level, tremolo: true });
}

/** 予告編の音を鳴らし始める */
function playSoundtrack(ctx: AudioContext, destination: AudioNode) {
  const master = ctx.createGain();
  master.connect(destination);
  const music = synthAmbience(ctx, "title", master);
  const now = ctx.currentTime;
  const at = (ms: number) => now + ms / 1000;
  const gain = music.output.gain;
  gain.setValueAtTime(0.0001, now);
  gain.linearRampToValueAtTime(0.9, at(2500));
  // 授かる瞬間と階級の昇格では曲を少し引き、効果音を立てる
  gain.setValueAtTime(0.9, at(BESTOW.fall[0] - 600));
  gain.linearRampToValueAtTime(0.45, at(BESTOW.fall[0]));
  gain.linearRampToValueAtTime(0.9, at(BESTOW.fall[1] + 2500));
  // 孤独の場面は静かに
  gain.setValueAtTime(0.9, at(SOLITUDE.in - 500));
  gain.linearRampToValueAtTime(0.55, at(SOLITUDE.in + 1000));
  gain.linearRampToValueAtTime(0.9, at(FINALE.logo[0]));
  // 冒頭の魔法陣へ戻る前に、曲を闇へ溶かす
  gain.setValueAtTime(0.9, at(TRAILER_MS - 2500));
  gain.linearRampToValueAtTime(0.0001, at(TRAILER_MS));
  const timers = SE_CUES.map(([ms, key]) => setTimeout(() => synthSe(ctx, key, master), ms));
  const reverb = forestReverb(ctx, master);
  OWL_CUES.forEach(([ms, distance]) => owlCall(ctx, master, reverb, at(ms), distance));
  return () => {
    timers.forEach(clearTimeout);
    music.stop();
  };
}

/** ページ上の CSS アニメーションを時刻 t に合わせる（data-t0 を持つ場面の中は、その時刻からの経過で） */
function syncAnimations(t: number) {
  document.getAnimations().forEach((a) => {
    const target = (a.effect as KeyframeEffect | null)?.target;
    const el = target instanceof Element ? target : (target as { element?: Element } | null)?.element;
    const host = el?.closest<HTMLElement>("[data-t0]");
    a.pause();
    a.currentTime = Math.max(0, t - Number(host?.dataset.t0 ?? 0));
  });
}

declare global {
  interface Window {
    __trailer?: {
      duration: number;
      /** 時刻 t（ms）の画面にし、ページ上の CSS アニメーションも同じ時刻へ合わせる */
      seek: (t: number) => Promise<void>;
      /** 予告編の音を実時間で録音し、webm（opus）を base64 で返す */
      recordAudio: () => Promise<string>;
    };
  }
}

/**
 * 予告編。?capture があれば撮影用に時刻を外から進め、無ければ「再生」で音と共に実時間で流す（確認用）。
 * 画面は 9:16 の枠に収め、PC で開いても縦長で見られるようにする
 */
export function Trailer() {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  // 撮影中は確認用のボタンを出さない
  const capture = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(location.search).has("capture"),
    () => true,
  );

  useEffect(() => {
    window.__trailer = {
      duration: TRAILER_MS,
      async seek(ms) {
        flushSync(() => setT(ms));
        syncAnimations(ms);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      },
      async recordAudio() {
        const ctx = new AudioContext();
        await ctx.resume();
        const tap = ctx.createMediaStreamDestination();
        const recorder = new MediaRecorder(tap.stream, { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 192_000 });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        const done = new Promise<void>((r) => (recorder.onstop = () => r()));
        recorder.start();
        const stop = playSoundtrack(ctx, tap);
        await new Promise((r) => setTimeout(r, TRAILER_MS + 800));
        recorder.stop();
        await done;
        stop();
        await ctx.close();
        const buffer = await new Blob(chunks, { type: "audio/webm" }).arrayBuffer();
        let binary = "";
        new Uint8Array(buffer).forEach((b) => (binary += String.fromCharCode(b)));
        return btoa(binary);
      },
    };
    return () => {
      delete window.__trailer;
      stopRef.current?.();
    };
  }, []);

  // 確認用の再生: 実時間で時刻を進め、CSS アニメーションも同じ時刻に合わせ続ける
  useEffect(() => {
    if (!playing) return;
    const ctx = new AudioContext();
    stopRef.current = playSoundtrack(ctx, ctx.destination);
    const begin = performance.now();
    let frame = requestAnimationFrame(function tick() {
      const now = Math.min(performance.now() - begin, TRAILER_MS);
      flushSync(() => setT(now));
      syncAnimations(now);
      if (now < TRAILER_MS) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    });
    return () => {
      cancelAnimationFrame(frame);
      stopRef.current?.();
      stopRef.current = null;
      void ctx.close();
    };
  }, [playing]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black">
      <div className="relative aspect-[9/16] h-full max-h-dvh max-w-full overflow-hidden">
        <Frame t={t} />
      </div>
      {!playing && !capture && (
        <button
          onClick={() => setPlaying(true)}
          className="absolute bottom-6 left-6 rounded-full border border-white/20 px-4 py-1.5 text-xs tracking-[0.2em] text-muted-foreground hover:text-starlight"
        >
          再生（確認用）
        </button>
      )}
    </div>
  );
}
