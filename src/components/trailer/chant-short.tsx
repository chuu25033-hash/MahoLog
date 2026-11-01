"use client";

import type { CSSProperties } from "react";
import { ArcaneLogo } from "@/components/arcane-icons";
import { ItemArt } from "@/components/item-art";
import { RELICS } from "@/lib/items";
import { forestReverb, owlCall, synthTrailerTheme } from "@/lib/sound/synth";
import { ChantCircle, ease, fade, rand, ShortPlayer, STARS, veil } from "./trailer";

// TikTok T02「25分勉強すると、こうなる。」。25分のタイマーが早回しで減り、流れ星が降りて報酬が開くまで。
// 予告編（trailer.tsx）と同じく、時刻 t（ms）だけで画面が決まるように組み、video/capture.mjs で撮る。
// 報酬はアプリの仕様どおり: 25分の詠唱で降る流れ星は1つ、魔力は +25 MP（加護などが無いとき）

// ---- 構成（ms） ----
// バンッとタイマー → 刻みが少しずつ速まり、後半は目で追えない → 00:00 で一瞬の静止
// → 陣が弾けて流れ星 → ボンッと魔力が数え上がる → 流れ星が遺した品 → 「何が降るかは、星しだい。」
// → ロゴと入口の案内 → 冒頭のタイマーへ戻る
const COUNT_END = 5200;
const BURST = COUNT_END + 300;
const FALL = [5600, 6400] as const;
const BOOM = 6450;
const MP_COUNT = [BOOM, 7600] as const;
// 文字は1節に5秒前後とり、読み切ってから次へ進む
const MP_RISE = [8000, 8600] as const;
const ITEM = { in: 8500, name: [9200, 10200], flavor: [10600, 11500, 15300, 16100] } as const;
const CAPTION = [16100, 17000, 19600, 20400] as const;
const SCENE_OUT = [19800, 20900] as const;
const FINALE = { logo: [21100, 22600], guide: [22600, 23700], out: [26700, 27600] } as const;
const LOOP = [27200, 28300] as const;
/** 動画の長さ（ms） */
export const CHANT_SHORT_MS = 28_300;

/** 詠唱の長さ（秒） */
const CHANT_SEC = 25 * 60;
/** 授かる魔力（25分 × 倍率なし） */
const GAINED_MP = 25;

// ---- 時計の早回し ----
// 経過秒 = 実時間に近い刻み（1刻み 0.55 秒）+ 指数で速まる分。冒頭は数えられる速さで、後半は目で追えない
const BASE_MS_PER_SEC = 550;
const GROWTH = 8;
const EXP_SCALE = (CHANT_SEC - COUNT_END / BASE_MS_PER_SEC) / (Math.exp(GROWTH) - 1);

/** 時刻 t までに進んだ詠唱の秒数（連続値） */
function elapsedSec(t: number) {
  if (t <= 0) return 0;
  if (t >= COUNT_END) return CHANT_SEC;
  return t / BASE_MS_PER_SEC + EXP_SCALE * (Math.exp((GROWTH * t) / COUNT_END) - 1);
}

/** 詠唱の秒数 n に届く時刻（二分探索） */
function timeAtSec(n: number) {
  let lo = 0;
  let hi = COUNT_END;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (elapsedSec(mid) < n) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** 刻みの音を鳴らす時刻。秒が変わるたびに鳴らし、間隔が詰まったら一定の細かさ（MIN_GAP）で鳴らし続ける */
const MIN_GAP = 70;
const TICKS: number[] = (() => {
  const out: number[] = [];
  for (let n = 1; n < CHANT_SEC; n++) {
    const at = timeAtSec(n);
    if (out.length > 0 && at - out[out.length - 1] < MIN_GAP) break;
    out.push(at);
  }
  for (let at = out[out.length - 1] + MIN_GAP; at < COUNT_END - 20; at += MIN_GAP) out.push(at);
  return out;
})();

function clock(t: number) {
  const left = Math.max(0, CHANT_SEC - Math.floor(elapsedSec(t)));
  return `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
}

/** 流れ星が遺す品。はじまりの地から降る秘宝「星詠みの輝石」 */
const BESTOWED = RELICS.find((r) => r.id === "r-starstone")!;
const BESTOWED_EN = "THE STARSEER STONE · RANK A";
/** 図鑑の「星詠みの輝石」の書き出しだけを使う */
const BESTOWED_FLAVOR = ["大沈黙の夜明け前、", "最後に瞬いた一番星を閉じ込めた輝石。"];

// ---- 場面 ----

/** 弾けて飛び散る光の粒 */
const SHARDS = Array.from({ length: 28 }, (_, i) => ({
  angle: (i / 28) * Math.PI * 2 + rand(i + 700) * 0.3,
  reach: 120 + rand(i + 710) * 170,
  size: 2 + rand(i + 720) * 3,
}));

function Frame({ t }: { t: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#03050b]">
      <Sky t={t} />
      <Timer t={t} />
      <Headline t={t} />
      <Fall t={t} />
      <Mana t={t} />
      <Bestowed t={t} />
      <Caption t={t} />
      <Finale t={t} />
      <LoopBack t={t} />
    </div>
  );
}

function Sky({ t }: { t: number }) {
  const opacity = 0.7 + ease(t, BOOM, BOOM + 1500) * 0.3 - ease(t, SCENE_OUT[0], SCENE_OUT[1]) * 0.3 + ease(t, FINALE.logo[0], FINALE.logo[1]) * 0.3;
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

/** 魔法陣の中の時計 */
function ClockFace({ text, label, heat, gold }: { text: string; label: string; heat: number; gold: boolean }) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-3 text-center">
      <p className="text-[13px] tracking-[0.4em] whitespace-nowrap text-aqua/75">{label}</p>
      <p
        className="font-display text-[78px] leading-none"
        style={{
          color: gold ? "#fbf3d4" : "#e8fbfd",
          textShadow: `0 0 ${14 + heat * 26}px ${gold ? "rgba(226,201,116,0.8)" : "rgba(113,226,239,0.6)"}, 0 0 3px rgba(255,255,255,0.5)`,
          filter: `blur(${heat > 0.6 ? (heat - 0.6) * 2.2 : 0}px)`,
        }}
      >
        {text.split("").map((ch, i) => (
          <span key={i} className={`inline-block text-center ${ch === ":" ? "w-[0.4em] -translate-y-[0.06em]" : "w-[0.72em]"}`}>
            {ch}
          </span>
        ))}
      </p>
    </div>
  );
}

/** 魔法陣と時計。バンッと現れ、刻みが速まるほど光と揺れが増し、00:00 で止まって弾ける */
function Timer({ t }: { t: number }) {
  if (t > BURST + 700) return null;
  const slam = 1 - ease(t, 0, 260);
  const progress = ease(t, 0, COUNT_END);
  // 時計の速さ（秒/ms）から、文字のぶれと画面の揺れを決める
  const rate = t < COUNT_END ? (elapsedSec(t + 16) - elapsedSec(t)) / 16 : 0;
  const heat = Math.min(1, rate * 1.2);
  const shake = t < COUNT_END ? ease(t, COUNT_END - 1400, COUNT_END) * 3 : 0;
  const dx = (rand(Math.floor(t / 33)) - 0.5) * shake;
  const dy = (rand(Math.floor(t / 33) + 50) - 0.5) * shake;
  const burst = ease(t, BURST, BURST + 600);
  const zero = t >= COUNT_END;
  return (
    <div
      className="absolute inset-x-0 top-[12%] h-[76%]"
      style={{
        transform: `translate(${dx}px, ${dy}px) scale(${1 + slam * 0.14 + burst * 0.35})`,
        opacity: 1 - burst,
        filter: `blur(${burst * 8}px)`,
      }}
    >
      <ChantCircle t0={0} intensity={0.3 + progress * 0.7} scale={0.8 + progress * 0.06} opacity={1} />
      <div className="absolute inset-0 grid place-items-center">
        <ClockFace text={clock(t)} label={zero ? "詠唱完了" : "魔力集束中…"} heat={heat} gold={zero} />
      </div>
      {/* 現れた瞬間の閃光 */}
      <div className="absolute inset-0" style={{ opacity: slam * 0.55, background: "radial-gradient(50% 35% at 50% 50%, rgba(232,251,253,0.9), rgba(113,226,239,0.2) 60%, transparent 80%)" }} />
    </div>
  );
}

/** 冒頭の一行。0秒目から読める状態で出しておく */
function Headline({ t }: { t: number }) {
  const opacity = 1 - ease(t, COUNT_END - 300, COUNT_END + 200);
  if (opacity <= 0) return null;
  return (
    <div className="absolute inset-x-0 top-[9%] flex flex-col items-center gap-1 text-center" style={{ opacity }}>
      <p className="font-serif text-[26px] tracking-[0.18em] whitespace-nowrap text-starlight-gradient drop-shadow-[0_0_10px_rgba(226,201,116,0.35)]">
        25分勉強すると、こうなる。
      </p>
    </div>
  );
}

/** 陣が弾け、流れ星が中心へ降りて、ボンッと光が開く */
function Fall({ t }: { t: number }) {
  if (t < BURST || t > BOOM + 1600) return null;
  const flash = ease(t, BURST, BURST + 60) * (1 - ease(t, BURST + 60, BURST + 900));
  const fall = ease(t, FALL[0], FALL[1]);
  const head = { x: 96 - fall * 46, y: -2 + fall * 44 };
  // 画面は 540×960。向きは px で求める
  const angle = Math.atan2(44 * 9.6, -46 * 5.4) * (180 / Math.PI) + 180;
  const impact = ease(t, BOOM, BOOM + 80) * (1 - ease(t, BOOM + 80, BOOM + 1100));
  const shards = Math.max(0, (t - BOOM) / 1000);
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0" style={{ opacity: flash, background: "radial-gradient(60% 40% at 50% 46%, rgba(255,248,220,0.9), rgba(113,226,239,0.25) 50%, transparent 80%)" }} />
      {fall > 0 && fall < 1 && (
        <div
          className="absolute h-[2px] w-[50%] origin-right"
          style={{
            right: `${100 - head.x}%`,
            top: `${head.y}%`,
            transform: `rotate(${angle}deg)`,
            background: "linear-gradient(90deg, transparent, rgba(226,201,116,0.3) 50%, rgba(255,248,220,1))",
            boxShadow: "0 0 10px rgba(255,248,220,0.7)",
          }}
        >
          <span className="absolute top-1/2 right-0 size-2 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fff8dc] shadow-[0_0_16px_6px_rgba(255,248,220,0.75)]" />
        </div>
      )}
      <div className="absolute inset-0" style={{ opacity: impact, background: "radial-gradient(45% 30% at 50% 42%, rgba(255,248,220,0.95), rgba(226,201,116,0.35) 45%, transparent 75%)" }} />
      {[0, 160].map((delay) => {
        const r = (t - BOOM - delay) / 1100;
        if (r <= 0 || r >= 1) return null;
        return (
          <span
            key={delay}
            className="absolute top-[42%] left-1/2 size-28 rounded-full border-2 border-starlight/80"
            style={{ transform: `translate(-50%, -50%) scale(${0.4 + (1 - (1 - r) ** 3) * 4})`, opacity: (1 - r) * 0.9 }}
          />
        );
      })}
      {shards > 0 &&
        shards < 1 &&
        SHARDS.map((s, i) => {
          const d = (1 - (1 - shards) ** 3) * s.reach;
          return (
            <span
              key={i}
              className="absolute top-[42%] left-1/2 rounded-full bg-[#fff8dc]"
              style={{
                width: s.size,
                height: s.size,
                transform: `translate(${Math.cos(s.angle) * d - s.size / 2}px, ${Math.sin(s.angle) * d - s.size / 2}px)`,
                opacity: 1 - shards,
                boxShadow: "0 0 8px 2px rgba(226,201,116,0.7)",
              }}
            />
          );
        })}
    </div>
  );
}

/** 授かりし魔力: ボンッと現れて数え上がり、品が現れる前に上へ退く */
function Mana({ t }: { t: number }) {
  if (t < BOOM || t > SCENE_OUT[1]) return null;
  const pop = ease(t, BOOM, BOOM + 220);
  const x = Math.min(1, Math.max(0, (t - MP_COUNT[0]) / (MP_COUNT[1] - MP_COUNT[0])));
  const count = Math.round(GAINED_MP * (1 - (1 - x) ** 2));
  const done = ease(t, MP_COUNT[1], MP_COUNT[1] + 120) * (1 - ease(t, MP_COUNT[1] + 120, MP_COUNT[1] + 600));
  const rise = ease(t, MP_RISE[0], MP_RISE[1]);
  const out = 1 - ease(t, SCENE_OUT[0], SCENE_OUT[1]);
  return (
    <div
      className="absolute inset-x-0 flex flex-col items-center gap-1 text-center"
      style={{ top: `${33 - rise * 22}%`, transform: `scale(${(1.5 - pop * 0.5 + done * 0.08) * (1 - rise * 0.38)})`, opacity: pop * out }}
    >
      <p className="text-[15px] tracking-[0.45em] whitespace-nowrap text-glow-gold text-starlight">授かりし魔力</p>
      <p className="font-display text-[11px] tracking-[0.4em] text-starlight/60">MANA GAINED</p>
      <p
        className="mt-2 font-display text-[72px] leading-none tabular-nums text-starlight-gradient"
        style={{ filter: `drop-shadow(0 0 ${14 + done * 20}px rgba(226,201,116,0.75)) drop-shadow(0 0 3px rgba(255,248,220,0.9))` }}
      >
        +{count} MP
      </p>
    </div>
  );
}

/** 流れ星が遺したもの: 光の中から品がひとつ、静かに浮かび上がる */
function Bestowed({ t }: { t: number }) {
  if (t < ITEM.in || t > SCENE_OUT[1]) return null;
  const out = 1 - ease(t, SCENE_OUT[0], SCENE_OUT[1]);
  const item = ease(t, ITEM.in, ITEM.in + 1200);
  const halo = ease(t, ITEM.in - 200, ITEM.in + 900);
  const ring = (t - ITEM.in) / 1800;
  const name = ease(t, ITEM.name[0], ITEM.name[1]);
  const flavor = fade(t, ITEM.flavor);
  return (
    <div className="absolute inset-0" style={{ opacity: out }}>
      <div
        className="absolute top-[38%] left-1/2 size-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ opacity: halo * (0.75 + Math.sin(t / 700) * 0.1), background: `radial-gradient(closest-side, ${BESTOWED.color}55, rgba(168,130,251,0.18) 55%, transparent)` }}
      />
      {ring > 0 && ring < 1 && (
        <span
          className="absolute top-[38%] left-1/2 size-[200px] rounded-full border border-[#cfe9ff]/70"
          style={{ transform: `translate(-50%, -50%) scale(${0.6 + (1 - (1 - ring) ** 3) * 1.4})`, opacity: (1 - ring) * 0.8 }}
        />
      )}
      <div
        className="absolute top-[38%] left-1/2 size-[210px]"
        style={{ transform: `translate(-50%, -50%) translateY(${Math.sin(t / 900) * 5}px) scale(${0.85 + item * 0.15})`, ...veil(item) }}
      >
        <ItemArt icon={BESTOWED.svgIcon} rarity={BESTOWED.rarity} color={BESTOWED.color} seed={BESTOWED.id} className="size-full" />
      </div>
      <div className="absolute inset-x-0 top-[52%] flex flex-col items-center gap-1 text-center" style={veil(name)}>
        <p className="text-[11px] tracking-[0.4em] whitespace-nowrap text-starlight/70">流れ星が遺したもの</p>
        <p className="mt-1 font-serif text-[26px] tracking-[0.3em] whitespace-nowrap" style={{ color: BESTOWED.color, textShadow: `0 0 14px ${BESTOWED.color}88` }}>
          {BESTOWED.name}
        </p>
        <p className="font-display text-[9px] tracking-[0.35em] whitespace-nowrap text-starlight/55">{BESTOWED_EN}</p>
      </div>
      <p className="absolute inset-x-0 top-[64%] text-center font-serif text-[15px] leading-[2.1] tracking-[0.18em] text-foreground/85" style={veil(flavor)}>
        {BESTOWED_FLAVOR.map((part, i) => (
          <span key={i} className="block whitespace-nowrap">
            {part}
          </span>
        ))}
      </p>
    </div>
  );
}

/** 締めの一行（解読文と同じ場所に入れ替わる） */
function Caption({ t }: { t: number }) {
  const line = fade(t, CAPTION);
  if (line <= 0) return null;
  return (
    <div className="absolute inset-x-0 top-[65%] grid place-items-center text-center">
      <p className="font-serif text-[20px] tracking-[0.25em] whitespace-nowrap text-starlight-gradient" style={veil(line)}>
        何が降るかは、星しだい。
      </p>
    </div>
  );
}

/** 終幕: 名と入口の案内（予告編と同じ） */
function Finale({ t }: { t: number }) {
  if (t < FINALE.logo[0] || t > FINALE.out[1]) return null;
  const out = 1 - ease(t, FINALE.out[0], FINALE.out[1]);
  const logo = ease(t, FINALE.logo[0], FINALE.logo[1]) * out;
  const guide = ease(t, FINALE.guide[0], FINALE.guide[1]) * out;
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-x-0 top-[33%] flex flex-col items-center text-center" style={veil(logo)}>
        <p className="flex items-center gap-3 text-[12px] tracking-[0.5em] whitespace-nowrap text-starlight/75">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-starlight/60" />
          <span className="-mr-[0.5em]">勉強記録アプリ マホログ</span>
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

/** 繰り返し再生のつなぎ: 冒頭のタイマーを淡く浮かべ、1コマ目の「バンッ」へつなぐ */
function LoopBack({ t }: { t: number }) {
  if (t < LOOP[0]) return null;
  const opacity = ease(t, LOOP[0], LOOP[1]) * 0.4;
  return (
    <div className="absolute inset-x-0 top-[12%] h-[76%]" style={{ opacity }}>
      <ChantCircle t0={CHANT_SHORT_MS} intensity={0.3} scale={0.8} opacity={1} />
      <div className="absolute inset-0 grid place-items-center">
        <ClockFace text="25:00" label="魔力集束中…" heat={0} gold={false} />
      </div>
    </div>
  );
}

// ---- 音 ----
// 曲（タイトルのピアノとオルゴール）と同じ音色・同じ調で効果音を組み、曲の一部のように聞かせる。
// 冒頭から「ボンッ」までは F の響き。曲は「ボンッ」の瞬間に最初の和音（Fmaj7）が鳴るよう始める。
// 後半の鐘やピアノは、そのとき鳴っている曲の和音に合わせる。効果音は数を絞り、曲の静けさを壊さない

const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

type Partial = [ratio: number, amp: number, decay: number];

function partials(ctx: AudioContext, out: AudioNode, freq: number, at: number, level: number, list: Partial[], attack: number) {
  for (const [ratio, amp, decay] of list) {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq * ratio;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level * amp, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  }
}

/** 曲と同じ柔らかいピアノ */
function piano(ctx: AudioContext, out: AudioNode, note: number, at: number, level: number) {
  partials(ctx, out, midi(note), at, level, [[1, 1, 4.5], [2.003, 0.35, 2.4], [3.008, 0.12, 1.4], [4.015, 0.05, 0.9]], 0.03);
}

/** 曲と同じオルゴール（decay で余韻の長さを変える） */
function musicBox(ctx: AudioContext, out: AudioNode, note: number, at: number, level: number, decay = 2.2) {
  partials(ctx, out, midi(note), at, level, [[1, 1, decay], [1.003, 0.4, decay * 0.9], [4.1, 0.08, Math.min(0.5, decay * 0.3)]], 0.006);
}

/** 澄んだ鐘 */
function bell(ctx: AudioContext, out: AudioNode, note: number, at: number, level: number) {
  partials(ctx, out, midi(note), at, level, [[1, 1, 3.6], [2.0, 0.25, 2.2], [2.76, 0.1, 1.1], [5.4, 0.03, 0.4]], 0.005);
}

/** 柔らかな低い「ドン」: 音程のある短い胴鳴り */
function thump(ctx: AudioContext, out: AudioNode, at: number, from: number, to: number, level: number, decay: number) {
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + decay * 0.6);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(level, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + decay + 0.05);
}

// F の音
const F2 = 41, C3 = 48, F3 = 53, A3 = 57, C4 = 60, E4 = 64, F4 = 65, C5 = 72, F5 = 77, A5 = 81, C6 = 84, F6 = 89;
/** 刻みが昇っていく音階（F の五音） */
const RUN = [69, 72, 74, 77, 79, 81, 84, 86, 89, 91, 93, 96];

/** バンッ: ピアノの低い F の和音と、柔らかな胴鳴り、遠い鐘 */
function slam(ctx: AudioContext, out: AudioNode, at: number) {
  thump(ctx, out, at, 90, 52, 0.22, 0.6);
  [F2, C3, F3].forEach((note, i) => piano(ctx, out, note, at + i * 0.015, 0.12 - i * 0.025));
  bell(ctx, out, F5, at, 0.035);
}

/**
 * 時を刻む音: オルゴールの「チッ・タッ」。00:00 まで途切れさせず、速まるにつれて音階を昇りながら
 * 音量と余韻を少しずつ細くし、下でふくらむ和音（swell）へなめらかに受け渡す
 */
function ticks(ctx: AudioContext, out: AudioNode, at: (ms: number) => number) {
  TICKS.forEach((ms, i) => {
    const gap = (TICKS[i + 1] ?? COUNT_END) - ms;
    const p = ms / COUNT_END;
    const step = Math.min(RUN.length - 2, Math.floor(p ** 1.4 * (RUN.length - 1)));
    // 細かくなるほど一音ずつは小さく短く（間隔 550ms → 70ms で、音量は約 0.45 倍、余韻は 1.2 → 0.35 秒）
    const dense = 1 - Math.min(1, Math.max(0, (gap - 70) / (550 - 70)));
    const level = 0.034 * (1 - dense * 0.55);
    musicBox(ctx, out, RUN[step + (i % 2)], at(ms), level, 1.2 - dense * 0.85);
  });
}

/** 刻みの下でふくらむ和音（Fmaj7）。00:00 でふっと途切れる */
function swell(ctx: AudioContext, out: AudioNode, from: number, to: number) {
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.setValueAtTime(350, from);
  tone.frequency.exponentialRampToValueAtTime(2000, to);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, from);
  env.gain.exponentialRampToValueAtTime(0.05, to - 0.04);
  env.gain.linearRampToValueAtTime(0, to);
  tone.connect(env).connect(out);
  [F3, A3, C4, E4, F4].forEach((note, i) => {
    const osc = ctx.createOscillator();
    osc.type = i < 2 ? "triangle" : "sine";
    osc.frequency.value = midi(note);
    osc.detune.value = (i - 2) * 3;
    const gain = ctx.createGain();
    gain.gain.value = 0.3;
    osc.connect(gain).connect(tone);
    osc.start(from);
    osc.stop(to + 0.05);
  });
}

function playSoundtrack(ctx: AudioContext, destination: AudioNode) {
  const master = ctx.createGain();
  master.connect(destination);
  // 効果音にも曲と同じくらいの残響をかけ、同じ部屋で鳴っているように聞かせる
  const sfx = ctx.createGain();
  sfx.connect(master);
  const wet = ctx.createGain();
  wet.gain.value = 0.4;
  sfx.connect(wet).connect(forestReverb(ctx, master));
  const now = ctx.currentTime + 0.05;
  const at = (ms: number) => now + ms / 1000;

  // つかみ〜00:00
  slam(ctx, sfx, at(0));
  ticks(ctx, sfx, at);
  swell(ctx, sfx, at(500), at(COUNT_END));
  musicBox(ctx, sfx, F6, at(COUNT_END), 0.045, 2.4);

  // 陣が弾け、流れ星が降りる
  bell(ctx, sfx, F4, at(BURST), 0.03);
  bell(ctx, sfx, C5, at(BURST + 80), 0.02);
  [93, 89, 84, 81].forEach((note, i) => musicBox(ctx, sfx, note, at(FALL[0] + i * 180), 0.018, 1.2));

  // ボンッ: 胴鳴りと低い F。ここで曲の最初の和音も鳴る
  thump(ctx, sfx, at(BOOM), 110, 45, 0.22, 1.2);
  piano(ctx, sfx, F2, at(BOOM), 0.13);
  bell(ctx, sfx, F4, at(BOOM), 0.04);
  // 数え上がる魔力: 5 ごとに一音だけ昇る
  for (let k = 5; k <= GAINED_MP; k += 5) {
    const x = 1 - Math.sqrt(1 - k / GAINED_MP);
    musicBox(ctx, sfx, RUN[2 + k / 5], at(MP_COUNT[0] + x * (MP_COUNT[1] - MP_COUNT[0])), 0.015, 1);
  }
  musicBox(ctx, sfx, C6, at(MP_COUNT[1] + 60), 0.028, 2.4);

  // 品が浮かぶ: 低い鐘と、ひとつのオルゴール
  bell(ctx, sfx, F3, at(ITEM.in), 0.05);
  musicBox(ctx, sfx, A5, at(ITEM.in + 450), 0.025, 2.6);

  // 曲の和音は1小節 4.8 秒で Fmaj7（6.45秒〜）→ Em7（11.25秒〜）→ Dm7（16.05秒〜）→ Cmaj7（20.85秒〜）
  bell(ctx, sfx, 74, at(CAPTION[0]), 0.03);
  [48, 55, 60, 64].forEach((note, i) => piano(ctx, sfx, note, at(FINALE.logo[0] + i * 250), 0.045));

  // 曲は効果音より一段引いて流す
  const MUSIC_LEVEL = 0.6;
  // 曲: 最初の小節が「ボンッ」に重なるよう、0.3秒前に始める（曲は始めてから 0.3 秒後に最初の和音を鳴らす）
  let music: ReturnType<typeof synthTrailerTheme> | null = null;
  const start = setTimeout(() => {
    music = synthTrailerTheme(ctx, master);
    const gain = music.output.gain;
    gain.setValueAtTime(MUSIC_LEVEL, ctx.currentTime);
    gain.setValueAtTime(MUSIC_LEVEL, at(FINALE.out[0]));
    gain.linearRampToValueAtTime(0.0001, at(CHANT_SHORT_MS - 200));
  }, BOOM - 300 + 50);

  owlCall(ctx, master, forestReverb(ctx, master), at(18000), 0.6);

  return () => {
    clearTimeout(start);
    music?.stop();
  };
}

export function ChantShort() {
  return <ShortPlayer duration={CHANT_SHORT_MS} frame={(t) => <Frame t={t} />} play={playSoundtrack} />;
}
