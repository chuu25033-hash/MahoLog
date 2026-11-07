"use client";

import { useSyncExternalStore } from "react";
import { MagicCircle } from "@/components/magic-circle";
import { ease, fade, rand, ShortPlayer, veil } from "./trailer";

// YouTube（横長 16:9）の画面転換素材「星の帳」。約5秒。
// 中央から夜空の帳が円く広がって画面を覆い、魔法陣と星々の上に文字を出し、最後は中央から円く穴が開いて次の映像を見せる。
// 時刻 t（ms）だけで画面が決まるように組み、video/capture.mjs で撮る（--size 960x540、透過は --alpha）。
// 文字は ?text=start（べんきょーかいし）/ girl（少女勉強中）/ 無しなら文字なし（自分で載せる用）

// ---- 構成（ms） ----
const IN = [0, 1000] as const;
const OUT = [3950, 4950] as const;
const TEXT = [800, 1400, 3500, 4000] as const;
/** 素材の長さ（ms） */
export const TRANSITION_MS = 5000;

/** 画面の隅まで届く半径（16:9 の対角の半分 ≒ 57.4cqw）に、ぼかしの分を足す */
const FULL = 62;
/** 帳の縁のぼかし（cqw） */
const SOFT = 2.5;

const TEXTS: Record<string, { ja: string; en: string }> = {
  start: { ja: "べんきょーかいし", en: "STUDY TIME" },
  girl: { ja: "少女勉強中", en: "NOW STUDYING" },
};

function easeOut(t: number, a: number, b: number) {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return 1 - (1 - x) ** 3;
}
function easeIn(t: number, a: number, b: number) {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x ** 2.4;
}

/** 帳が広がる半径と、開く穴の半径（cqw） */
function radii(t: number) {
  return { cover: easeOut(t, IN[0], IN[1]) * FULL, hole: easeIn(t, OUT[0], OUT[1]) * FULL };
}

const STARS = Array.from({ length: 150 }, (_, i) => ({
  x: rand(i + 1) * 100,
  y: rand(i + 301) * 100,
  size: 0.08 + rand(i + 601) ** 3 * 0.32,
  phase: rand(i + 901) * Math.PI * 2,
  speed: 1.2 + rand(i + 1201) * 2.4,
  gold: rand(i + 1501) < 0.25,
}));

/** 中央から外へ流れ出す光の粒 */
const MOTES = Array.from({ length: 46 }, (_, i) => ({
  angle: rand(i + 2001) * Math.PI * 2,
  start: 700 + rand(i + 2101) * 2600,
  life: 1400 + rand(i + 2201) * 1200,
  reach: 18 + rand(i + 2301) * 30,
  size: 0.18 + rand(i + 2401) * 0.3,
}));

/** 画面を横切る流れ星 */
const SHOOTING = [
  { at: 1250, x: 78, y: 12, len: 16 },
  { at: 2350, x: 30, y: 8, len: 12 },
  { at: 3050, x: 92, y: 30, len: 14 },
];

function Frame({ t, text }: { t: number; text: string }) {
  const { cover, hole } = radii(t);
  // 穴が開く前は中心まで覆う（ぼかしの分だけ中心が透けないように）
  const inner = hole > 0 ? `transparent ${hole}cqw, black ${hole + SOFT}cqw` : "black 0";
  const mask = `radial-gradient(circle at 50% 50%, ${inner}, black ${Math.max(cover - SOFT, hole + SOFT)}cqw, transparent ${cover}cqw)`;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ containerType: "size" }}>
      <div className="absolute inset-0" style={{ maskImage: mask, WebkitMaskImage: mask }}>
        <Sky t={t} />
      </div>
      <Rings t={t} cover={cover} hole={hole} />
      <Caption t={t} text={text} />
    </div>
  );
}

function Sky({ t }: { t: number }) {
  const s = t / 1000;
  return (
    <>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 50%, #1b2452 0%, #0b1030 42%, #04050f 100%)" }} />
      {/* 漂う星雲 */}
      <div
        className="absolute rounded-full blur-[6cqw]"
        style={{ left: `${8 + s * 1.2}%`, top: "18%", width: "46cqw", height: "30cqw", background: "radial-gradient(closest-side, rgba(120,92,200,0.32), transparent)" }}
      />
      <div
        className="absolute rounded-full blur-[6cqw]"
        style={{ right: `${6 + s * 1.4}%`, bottom: "10%", width: "50cqw", height: "32cqw", background: "radial-gradient(closest-side, rgba(70,150,210,0.26), transparent)" }}
      />
      {/* 星々 */}
      {STARS.map((star, i) => {
        const twinkle = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(s * star.speed + star.phase));
        return (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}cqw`,
              height: `${star.size}cqw`,
              opacity: twinkle,
              background: star.gold ? "#f3dc9a" : "#e6efff",
              boxShadow: `0 0 ${star.size * 3}cqw ${star.gold ? "rgba(226,201,116,0.7)" : "rgba(180,210,255,0.6)"}`,
            }}
          />
        );
      })}
      {/* 魔法陣: 広がりながらゆっくり寄る */}
      <div className="absolute inset-0 flex items-center justify-center" data-t0={0}>
        <div
          className="w-[62cqw] shrink-0"
          style={{ opacity: 0.55 * ease(t, 200, 1200), transform: `scale(${0.82 + easeOut(t, 0, 1400) * 0.2 + s * 0.02}) rotate(${-14 + easeOut(t, 0, 1400) * 14}deg)` }}
        >
          <MagicCircle color="#8db7f2" running intensity={0.5 + ease(t, 600, 3400) * 0.5} className="w-full" />
        </div>
      </div>
      {/* 文字の下に敷く淡い光 */}
      <div
        className="absolute left-1/2 top-1/2 h-[26cqw] w-[70cqw] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(4,6,18,0.72), rgba(4,6,18,0.35) 60%, transparent)" }}
      />
      {MOTES.map((m, i) => {
        const p = (t - m.start) / m.life;
        if (p < 0 || p > 1) return null;
        const r = 6 + p * m.reach;
        return (
          <span
            key={i}
            className="absolute rounded-full bg-[#f3dc9a]"
            style={{
              left: `calc(50% + ${Math.cos(m.angle) * r}cqw)`,
              top: `calc(50% + ${Math.sin(m.angle) * r * 0.62}cqw)`,
              width: `${m.size}cqw`,
              height: `${m.size}cqw`,
              opacity: Math.sin(p * Math.PI) * 0.9,
              boxShadow: `0 0 ${m.size * 4}cqw rgba(226,201,116,0.8)`,
            }}
          />
        );
      })}
      {SHOOTING.map((sh, i) => {
        const p = (t - sh.at) / 700;
        if (p < 0 || p > 1) return null;
        return (
          <span
            key={i}
            className="absolute h-[0.12cqw] rounded-full"
            style={{
              left: `${sh.x - p * 22}%`,
              top: `${sh.y + p * 14}%`,
              width: `${sh.len}cqw`,
              transform: "translateX(-100%) rotate(-32deg)",
              transformOrigin: "100% 50%",
              opacity: Math.sin(p * Math.PI),
              background: "linear-gradient(90deg, transparent, rgba(255,246,214,0.95))",
              boxShadow: "0 0 0.6cqw rgba(255,240,200,0.6)",
            }}
          />
        );
      })}
    </>
  );
}

/** 帳の縁に灯る光の輪（広がるときと、穴が開くとき） */
function Rings({ t, cover, hole }: { t: number; cover: number; hole: number }) {
  const rings: { r: number; o: number; key: string }[] = [];
  const inO = 1 - ease(t, IN[1] - 250, IN[1] + 100);
  if (t > IN[0] && inO > 0) rings.push({ r: cover - SOFT / 2, o: inO, key: "in" });
  const outO = ease(t, OUT[0], OUT[0] + 150) * (1 - ease(t, OUT[1] - 250, OUT[1]));
  if (outO > 0) rings.push({ r: hole + SOFT / 2, o: outO, key: "out" });
  return (
    <>
      {rings.map(({ r, o, key }) => (
        <div key={key} className="pointer-events-none absolute inset-0" style={{ opacity: o }}>
          <Ring r={r} color="#f3dc9a" glow="rgba(226,201,116,0.75)" width={0.22} />
          <Ring r={r * 0.94} color="#71e2ef" glow="rgba(113,226,239,0.5)" width={0.1} />
          {Array.from({ length: 28 }, (_, i) => {
            const a = (i / 28) * Math.PI * 2 + t / 900;
            const size = 0.25 + rand(i + 3001) * 0.35;
            return (
              <span
                key={i}
                className="absolute rounded-full bg-[#fff3cf]"
                style={{
                  left: `calc(50% + ${Math.cos(a) * r}cqw)`,
                  top: `calc(50% + ${Math.sin(a) * r}cqw)`,
                  width: `${size}cqw`,
                  height: `${size}cqw`,
                  transform: "translate(-50%, -50%)",
                  boxShadow: `0 0 ${size * 4}cqw rgba(226,201,116,0.9)`,
                }}
              />
            );
          })}
        </div>
      ))}
    </>
  );
}

function Ring({ r, color, glow, width }: { r: number; color: string; glow: string; width: number }) {
  if (r <= 0) return null;
  return (
    <div
      className="absolute left-1/2 top-1/2 rounded-full"
      style={{
        width: `${r * 2}cqw`,
        height: `${r * 2}cqw`,
        transform: "translate(-50%, -50%)",
        border: `${width}cqw solid ${color}`,
        boxShadow: `0 0 1.4cqw ${glow}, inset 0 0 1.4cqw ${glow}`,
      }}
    />
  );
}

function Caption({ t, text }: { t: number; text: string }) {
  const entry = TEXTS[text];
  if (!entry) return null;
  const o = fade(t, TEXT);
  if (o <= 0) return null;
  const rise = (1 - ease(t, TEXT[0], TEXT[1])) * 1.2;
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center text-center drop-shadow-[0_0_1.2cqw_rgba(0,0,0,0.9)]"
      style={{ ...veil(o), transform: `translateY(${rise}cqw)` }}
    >
      <p className="font-serif text-[7.2cqw] leading-none tracking-[0.18em] whitespace-nowrap text-starlight-gradient">
        <span className="-mr-[0.18em]">{entry.ja}</span>
      </p>
      <div className="mt-[2.2cqw] flex items-center gap-[1.4cqw] text-starlight/70">
        <span className="h-px w-[6cqw] bg-gradient-to-r from-transparent to-starlight/70" />
        <p className="font-display text-[1.5cqw] tracking-[0.5em] whitespace-nowrap">
          <span className="-mr-[0.5em]">{entry.en}</span>
        </p>
        <span className="h-px w-[6cqw] bg-gradient-to-l from-transparent to-starlight/70" />
      </div>
    </div>
  );
}

// ---- 音 ----
// 入り: 風が吸い上がる → 帳が覆いきる瞬間に低い響きと鐘の和音 → 水晶のきらめきが散る → 抜け: 風が逃げ、澄んだ鐘で締める
// D マイナー（add9）で、可愛すぎず大人っぽい響きにする

function noiseBuffer(ctx: BaseAudioContext, seconds: number) {
  const buf = ctx.createBuffer(2, Math.round(ctx.sampleRate * seconds), ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return buf;
}

function reverb(ctx: BaseAudioContext, seconds = 3.2) {
  const conv = ctx.createConvolver();
  const buf = ctx.createBuffer(2, Math.round(ctx.sampleRate * seconds), ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3.2;
  }
  conv.buffer = buf;
  return conv;
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** 風: 帯域を from→to へ滑らせたノイズ */
function whoosh(ctx: BaseAudioContext, out: AudioNode, at: number, dur: number, from: number, to: number, peak: number, peakAt: number) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, dur + 0.1);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(from, at);
  bp.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + dur * peakAt);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(bp).connect(g).connect(out);
  src.start(at);
  src.stop(at + dur + 0.1);
}

/** 鐘: 倍音のずれた正弦波を重ねる */
function bell(ctx: BaseAudioContext, out: AudioNode, at: number, midi: number, gain: number, decay: number) {
  const f = hz(midi);
  [
    [1, 1],
    [2.01, 0.42],
    [2.76, 0.22],
    [5.4, 0.08],
  ].forEach(([ratio, amp]) => {
    const o = ctx.createOscillator();
    o.frequency.value = f * ratio;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain * amp, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay / ratio ** 0.5);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + decay + 0.1);
  });
}

function playSoundtrack(ctx: AudioContext, destination: AudioNode) {
  const now = ctx.currentTime + 0.05;
  const end = now + TRANSITION_MS / 1000;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.9, now);
  master.gain.setValueAtTime(0.9, end - 0.35);
  master.gain.linearRampToValueAtTime(0.0001, end);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.ratio.value = 4;
  master.connect(comp).connect(destination);
  const dry = ctx.createGain();
  dry.gain.value = 0.8;
  dry.connect(master);
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  const verb = reverb(ctx);
  wet.connect(verb).connect(master);
  const both = ctx.createGain();
  both.connect(dry);
  both.connect(wet);
  const at = (ms: number) => now + ms / 1000;

  // 入り: 吸い上がる風と、高まる響き
  whoosh(ctx, both, at(-50), 1.15, 260, 5200, 0.55, 0.85);
  const riser = ctx.createOscillator();
  riser.type = "sine";
  riser.frequency.setValueAtTime(hz(50), at(0));
  riser.frequency.exponentialRampToValueAtTime(hz(74), at(950));
  const rg = ctx.createGain();
  rg.gain.setValueAtTime(0.0001, at(0));
  rg.gain.exponentialRampToValueAtTime(0.05, at(900));
  rg.gain.exponentialRampToValueAtTime(0.0001, at(1050));
  riser.connect(rg).connect(wet);
  riser.start(at(0));
  riser.stop(at(1100));

  // 覆いきる瞬間: 低い響き
  const boom = ctx.createOscillator();
  boom.frequency.setValueAtTime(hz(38) * 2, at(950));
  boom.frequency.exponentialRampToValueAtTime(hz(38), at(1200));
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.0001, at(950));
  bg.gain.exponentialRampToValueAtTime(0.5, at(975));
  bg.gain.exponentialRampToValueAtTime(0.0001, at(2600));
  boom.connect(bg).connect(dry);
  boom.start(at(950));
  boom.stop(at(2700));

  // 鐘の和音（D・A・E・F）
  [50, 57, 64, 65, 69].forEach((m, i) => bell(ctx, both, at(960 + i * 18), m, [0.16, 0.12, 0.09, 0.08, 0.07][i], 3.6));

  // 敷きの和音（暗く柔らかい）
  [38, 45, 53, 57].forEach((m, i) => {
    [-6, 6].forEach((cents) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = hz(m);
      o.detune.value = cents;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(380, at(950));
      lp.frequency.linearRampToValueAtTime(900, at(3200));
      lp.frequency.linearRampToValueAtTime(300, at(4600));
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at(950));
      g.gain.exponentialRampToValueAtTime(0.022 - i * 0.003, at(1500));
      g.gain.setValueAtTime(0.022 - i * 0.003, at(3700));
      g.gain.exponentialRampToValueAtTime(0.0001, at(4800));
      o.connect(lp).connect(g).connect(both);
      o.start(at(950));
      o.stop(at(4900));
    });
  });

  // 水晶のきらめき（D マイナー・ペンタトニックを上から散らす）
  const sparkle = [86, 81, 84, 79, 77, 81, 74, 76, 72, 81, 79, 74];
  sparkle.forEach((m, i) => bell(ctx, wet, at(1250 + i * 190 + (i % 3) * 30), m, 0.05 - i * 0.002, 1.4));

  // 抜け: 風が逃げ、澄んだ鐘で締める
  whoosh(ctx, both, at(3750), 1.2, 5200, 340, 0.42, 0.3);
  bell(ctx, both, at(3980), 74, 0.11, 2.2);
  bell(ctx, both, at(3990), 81, 0.07, 2.2);
  bell(ctx, wet, at(4150), 86, 0.05, 1.6);

  const nodes = [master, comp, dry, wet, verb, both];
  return () => {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0, ctx.currentTime);
    nodes.forEach((n) => n.disconnect());
  };
}

export function TransitionShort() {
  const text = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(location.search).get("text") ?? "",
    () => "",
  );
  return <ShortPlayer landscape duration={TRANSITION_MS} frame={(t) => <Frame t={t} text={text} />} play={playSoundtrack} />;
}

