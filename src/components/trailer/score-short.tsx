"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArcaneLogo } from "@/components/arcane-icons";
import { soundManager } from "@/lib/sound/sound-manager";
import { loadPiano, SONGS, startSong, type NoteEvent, type NotePart, type SongKey, type SongSection } from "@/lib/sound/music";
import { TRACKS } from "./music-player";
import { ease, ShortPlayer, veil } from "./trailer";

// 曲を主役にした TikTok 用の動画。右から楽譜が流れてきて、演奏線を越えた音が光る。
// 曲は OfflineAudioContext で一度だけ描き出し、そのとき鳴らした音（揺らぎを含めた時刻と強さ）をすべて記録する。
// 映像はその記録だけで決まるので、音と映像が1音のずれもなく揃い、video/capture.mjs で1コマずつ撮れる。
//
//   node capture.mjs --url "http://localhost:3000/trailer/score?song=stars&from=chorus&sec=30" --out out/score-stars.mp4

const SAMPLE_RATE = 48000;
const FADE_SEC = 2;

// ---- 画面（1080×1920 で描き、枠に合わせて縮める） ----
const W = 1080;
const H = 1920;
/** 演奏線の位置と、楽譜が流れる速さ（px/秒） */
const PLAY_X = 300;
const SPEED = 280;
/** 音の高さ → 縦の位置（低い音ほど下） */
const yOf = (note: number) => 1480 - (note - 26) * 14;
/** 大譜表の線（ト音記号の段 E4〜F5、ヘ音記号の段 G2〜A3） */
const STAFF = [64, 67, 71, 74, 77, 43, 47, 50, 53, 57];
/** 鍵盤（C2〜D7） */
const KEY_LO = 36;
const KEY_HI = 98;
const KEY_X = 40;
const KEY_W = 1000;
const KEY_Y = 1620;
const WHITE_H = 120;
const BLACK_H = 74;

type Rgb = readonly [number, number, number];
const GOLD: Rgb = [226, 201, 116];
const GOLD_HI: Rgb = [251, 243, 212];
const LAVENDER: Rgb = [196, 190, 221];
const BLUE: Rgb = [127, 160, 226];
const DEEP: Rgb = [80, 110, 200];
const STARRY: Rgb = [220, 232, 255];
const rgba = ([r, g, b]: Rgb, a: number) => `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;

const PART_COLOR: Record<NotePart, Rgb> = { melody: GOLD, double: GOLD, chord: LAVENDER, left: BLUE, bass: DEEP, star: STARRY, drum: STARRY };

/** 段ごとの明るさ（前奏は暗く、サビで星が満ち、間奏で少し引く） */
const MOOD: Record<SongSection, number> = { intro: 0.35, verse: 0.6, pre: 0.75, chorus: 1, chorus2: 1.1, interlude: 0.5 };

type BarMark = { at: number; section: SongSection; inSection: number };
type Score = { buffer: AudioBuffer; gain: number; notes: NoteEvent[]; bars: BarMark[]; barSec: number };

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** 曲を描き出し、鳴らした音と小節の区切りを記録する */
async function renderScore(key: SongKey, from: "intro" | "chorus", seconds: number): Promise<Score> {
  const ctx = new OfflineAudioContext(2, SAMPLE_RATE * seconds, SAMPLE_RATE);
  const fade = ctx.createGain();
  fade.gain.setValueAtTime(1, seconds - FADE_SEC);
  fade.gain.linearRampToValueAtTime(0, seconds);
  fade.connect(ctx.destination);
  await loadPiano(ctx);
  const notes: NoteEvent[] = [];
  const bars: BarMark[] = [];
  startSong(ctx, fade, key, { from, duration: seconds, onNote: (e) => notes.push(e), onBar: (e) => bars.push(e) });
  const buffer = await ctx.startRendering();
  // いちばん大きいところが -1 dBFS になるよう持ち上げる（撮影では音量をさらに整える）
  let peak = 0;
  for (let c = 0; c < 2; c++) for (const v of buffer.getChannelData(c)) peak = Math.max(peak, Math.abs(v));
  notes.sort((a, b) => a.at - b.at);
  return { buffer, gain: peak > 0 ? 0.89 / peak : 1, notes, bars, barSec: 240 / SONGS[key].bpm };
}

/** 背景の星（位置は毎回同じ） */
const SKY = Array.from({ length: 170 }, (_, i) => ({
  x: hash(i * 3 + 1) * W,
  y: hash(i * 3 + 2) * 1560,
  r: 0.6 + hash(i * 3 + 3) ** 3 * 2.4,
  phase: hash(i * 7) * Math.PI * 2,
  speed: 0.4 + hash(i * 11) * 1.4,
}));

/** 鍵盤の並び: 白鍵の数と、各鍵の左端と幅 */
const isBlack = (n: number) => [1, 3, 6, 8, 10].includes(n % 12);
const WHITE_KEYS = Array.from({ length: KEY_HI - KEY_LO + 1 }, (_, i) => KEY_LO + i).filter((n) => !isBlack(n));
const WHITE_W = KEY_W / WHITE_KEYS.length;
function keyRect(n: number) {
  if (!isBlack(n)) return { x: KEY_X + WHITE_KEYS.indexOf(n) * WHITE_W, w: WHITE_W, h: WHITE_H, black: false };
  const left = WHITE_KEYS.indexOf(n - 1);
  return { x: KEY_X + (left + 1) * WHITE_W - WHITE_W * 0.3, w: WHITE_W * 0.6, h: BLACK_H, black: true };
}

/** 段の明るさ（段の頭の1小節で、前の段からなめらかに移る） */
function moodAt(score: Score, t: number) {
  const i = score.bars.findLastIndex((b) => b.at <= t);
  if (i < 0) return MOOD.intro;
  const bar = score.bars[i];
  const here = MOOD[bar.section];
  if (bar.inSection !== 0 || i === 0) return here;
  const before = MOOD[score.bars[i - 1].section];
  return before + (here - before) * clamp((t - bar.at) / score.barSec);
}

function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: Rgb, alpha: number) {
  if (alpha <= 0.002) return;
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, rgba(color, alpha));
  grad.addColorStop(0.35, rgba(color, alpha * 0.32));
  grad.addColorStop(1, rgba(color, 0));
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

/** 四つの角を持つ星 */
function sparkle(g: CanvasRenderingContext2D, x: number, y: number, size: number, color: Rgb, alpha: number) {
  if (alpha <= 0.002) return;
  const s = size;
  const k = s * 0.18;
  g.beginPath();
  g.moveTo(x, y - s);
  g.quadraticCurveTo(x + k, y - k, x + s, y);
  g.quadraticCurveTo(x + k, y + k, x, y + s);
  g.quadraticCurveTo(x - k, y + k, x - s, y);
  g.quadraticCurveTo(x - k, y - k, x, y - s);
  g.fillStyle = rgba(color, alpha);
  g.fill();
}

/** 時刻 t（秒）の楽譜を描く */
function draw(g: CanvasRenderingContext2D, score: Score, t: number) {
  const mood = moodAt(score, t);
  g.globalCompositeOperation = "source-over";
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#05070f");
  bg.addColorStop(0.45, "#0a1022");
  bg.addColorStop(1, "#070a14");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  g.globalCompositeOperation = "lighter";
  // 遠くの星雲: 段が進むほど、楽譜の後ろがほのかに明るむ
  glow(g, W * 0.55, 900, 900, [70, 80, 150], 0.1 + 0.12 * mood);
  glow(g, W * 0.3, 1050, 520, [140, 110, 70], 0.04 + 0.06 * mood);

  // ---- 打楽器: キックで星空全体がわずかに脈打ち、リムやブラシで星が1つ2つ瞬く
  let pulse = 0;
  const flicker = new Map<number, number>();
  for (const n of score.notes) {
    if (n.part !== "drum" || n.at > t) continue;
    const dt = t - n.at;
    if (dt > 1.2) continue;
    if (n.drum === "kick") pulse += n.velocity * Math.exp(-dt / 0.28);
    if (n.drum === "rim" || n.drum === "tap")
      for (let k = 0; k < 3; k++) {
        const i = Math.floor(hash(n.at * 997 + k) * SKY.length);
        flicker.set(i, Math.max(flicker.get(i) ?? 0, n.velocity * Math.exp(-dt / 0.3)));
      }
  }
  pulse = Math.min(1, pulse);

  SKY.forEach((s, i) => {
    const tw = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
    const a = (0.12 + 0.35 * tw) * (0.45 + 0.55 * mood) + pulse * 0.12 + (flicker.get(i) ?? 0) * 0.9;
    g.fillStyle = rgba(STARRY, a);
    g.beginPath();
    g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    g.fill();
    if (s.r > 2 || flicker.has(i)) glow(g, s.x, s.y, s.r * 6, STARRY, a * 0.25);
  });

  // ---- 大譜表: 星図の罫線のように細く
  g.globalCompositeOperation = "source-over";
  for (const n of STAFF) {
    const y = yOf(n);
    const line = g.createLinearGradient(0, 0, W, 0);
    line.addColorStop(0, rgba(LAVENDER, 0));
    line.addColorStop(0.12, rgba(LAVENDER, 0.1));
    line.addColorStop(0.88, rgba(LAVENDER, 0.1));
    line.addColorStop(1, rgba(LAVENDER, 0));
    g.strokeStyle = line;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }

  // ---- 演奏線
  g.globalCompositeOperation = "lighter";
  const playLine = g.createLinearGradient(0, 380, 0, 1560);
  playLine.addColorStop(0, rgba(GOLD, 0));
  playLine.addColorStop(0.5, rgba(GOLD, 0.22 + pulse * 0.12));
  playLine.addColorStop(1, rgba(GOLD, 0));
  g.fillStyle = playLine;
  g.fillRect(PLAY_X - 1, 380, 2, 1180);
  // 演奏線のまわりの淡い光（縦に引き伸ばした楕円で、上下の端も溶かす）
  g.save();
  g.translate(PLAY_X, 970);
  g.scale(1, 15);
  glow(g, 0, 0, 42, GOLD, 0.06 + 0.05 * mood);
  g.restore();

  const xOf = (at: number) => PLAY_X + (at - t) * SPEED;
  /** 右端から入ってくるときと、左へ去るときの薄れ */
  const edge = (x: number) => clamp((W - x) / 140) * clamp((x + 40) / (PLAY_X + 40));

  // ---- 旋律を星座のように結ぶ線
  const melody = score.notes.filter((n) => n.part === "melody");
  for (let i = 1; i < melody.length; i++) {
    const [a, b] = [melody[i - 1], melody[i]];
    if (b.at - a.at > 1.8) continue;
    const [xa, xb] = [xOf(a.at), xOf(b.at)];
    if (xb < -40 || xa > W + 40) continue;
    const lit = b.at <= t ? 0.32 : a.at <= t ? 0.16 : 0.07;
    g.strokeStyle = rgba(GOLD, lit * Math.min(edge(xa), edge(xb)) * (0.6 + 0.4 * mood));
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(xa, yOf(a.note));
    g.lineTo(xb, yOf(b.note));
    g.stroke();
  }

  // ---- 音符
  for (const n of score.notes) {
    if (n.part === "drum") continue;
    const x = xOf(n.at);
    const length = n.part === "star" ? 0 : Math.min(n.length, 2.6);
    if (x + length * SPEED < -60 || x > W + 60) continue;
    const y = yOf(n.note);
    const dt = t - n.at;
    const color = PART_COLOR[n.part];
    const played = dt >= 0;
    const flash = played ? Math.exp(-dt / 0.15) : 0;
    const ringing = played ? (dt <= Math.max(length, 0.3) ? 1 : Math.exp(-(dt - Math.max(length, 0.3)) / 0.45)) : 0;
    const fade = edge(x);
    const v = 0.65 + 0.7 * n.velocity;

    if (n.part === "bass") {
      // 低い支え: 鍵盤のすぐ上を、長い光の帯で
      const band = g.createLinearGradient(x, 0, x + length * SPEED, 0);
      band.addColorStop(0, rgba(DEEP, (0.2 + 0.35 * ringing) * clamp((W - x) / 140)));
      band.addColorStop(1, rgba(DEEP, 0));
      g.fillStyle = band;
      g.fillRect(x, y - 5, length * SPEED, 10);
      continue;
    }

    // 伸ばしている長さ（尾）
    if (length > 0.05) {
      const width = n.part === "melody" ? 4 : n.part === "double" ? 3 : 2.4;
      const base = n.part === "melody" ? 0.28 : n.part === "double" ? 0.18 : 0.13;
      const tail = g.createLinearGradient(x, 0, x + length * SPEED, 0);
      tail.addColorStop(0, rgba(color, (base + 0.35 * ringing) * fade));
      tail.addColorStop(1, rgba(color, 0));
      g.fillStyle = tail;
      g.fillRect(x, y - width / 2, length * SPEED, width);
    }

    if (n.part === "melody" || n.part === "double") {
      const size = (n.part === "melody" ? 15 : 10) * v * (1 + 0.7 * flash);
      const a = (played ? 0.55 + 0.45 * ringing : 0.5) * fade;
      glow(g, x, y, size * (3 + 3 * flash), GOLD, (0.25 + 0.5 * flash + 0.2 * ringing) * fade);
      sparkle(g, x, y, size * 1.5, GOLD_HI, a);
      g.fillStyle = rgba(GOLD_HI, a);
      g.beginPath();
      g.arc(x, y, size * 0.32, 0, Math.PI * 2);
      g.fill();
    } else if (n.part === "star") {
      // 星の瞬き: 鳴った瞬間に強く光り、ゆっくり消える
      const a = (played ? 0.35 + 0.65 * Math.exp(-dt / 0.6) : 0.3) * fade;
      glow(g, x, y, 26 + 30 * flash, STARRY, (0.15 + 0.5 * flash) * fade);
      sparkle(g, x, y, 7 + 9 * flash, STARRY, a);
    } else {
      // 和音と左手: 小さな丸
      const r = (n.part === "chord" ? 6 : 7.5) * v * (1 + 0.5 * flash);
      const a = (played ? 0.4 + 0.5 * ringing : 0.32) * fade;
      glow(g, x, y, r * (3 + 3 * flash), color, (0.12 + 0.4 * flash + 0.12 * ringing) * fade);
      g.fillStyle = rgba(color, a);
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }

    // 演奏線で鳴った瞬間の波紋と、舞い上がる光の粒
    if (played && dt < 1.6 && (n.part === "melody" || n.part === "chord" || n.part === "left")) {
      const big = n.part === "melody";
      if (dt < 0.9) {
        g.strokeStyle = rgba(color, (big ? 0.5 : 0.18) * (1 - dt / 0.9) * n.velocity * 1.6);
        g.lineWidth = big ? 2 : 1.2;
        g.beginPath();
        g.arc(PLAY_X, y, (big ? 16 : 8) + dt * (big ? 130 : 60), 0, Math.PI * 2);
        g.stroke();
      }
      const count = big ? 7 : 2;
      for (let k = 0; k < count; k++) {
        const seed = n.at * 131 + n.note * 17 + k;
        const angle = hash(seed) * Math.PI * 2;
        const speed = 30 + hash(seed + 0.5) * 70;
        const life = 1 + hash(seed + 0.7) * 0.6;
        if (dt > life) continue;
        const px = PLAY_X - dt * SPEED * 0.45 + Math.cos(angle) * speed * dt;
        const py = y + Math.sin(angle) * speed * dt - 26 * dt * dt;
        const a = (1 - dt / life) ** 1.5 * (big ? 0.8 : 0.4);
        glow(g, px, py, big ? 12 : 7, color, a * 0.5);
        g.fillStyle = rgba(big ? GOLD_HI : color, a);
        g.beginPath();
        g.arc(px, py, big ? 2.2 : 1.5, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  // ---- 鍵盤: 輪郭は細く控えめに。鳴っている鍵だけが灯り、光が上へ漏れる
  const lit = new Map<number, { level: number; color: Rgb }>();
  for (const n of score.notes) {
    if (n.part === "drum" || n.part === "bass" || n.note < KEY_LO || n.note > KEY_HI) continue;
    const dt = t - n.at;
    if (dt < 0) break;
    const hold = n.part === "star" ? 0.35 : Math.min(Math.max(n.length, 0.25), 2.6);
    if (dt > hold + 0.6) continue;
    const env = dt <= hold ? 0.55 + 0.45 * Math.exp(-dt / 0.18) : 0.55 * Math.exp(-(dt - hold) / 0.18);
    const level = env * (0.5 + n.velocity);
    const prev = lit.get(n.note);
    if (!prev || prev.level < level) lit.set(n.note, { level: Math.min(1, level), color: PART_COLOR[n.part] });
  }

  g.globalCompositeOperation = "source-over";
  for (const black of [false, true])
    for (let n = KEY_LO; n <= KEY_HI; n++) {
      if (isBlack(n) !== black) continue;
      const r = keyRect(n);
      const on = lit.get(n);
      g.fillStyle = black ? "rgba(6,8,16,0.96)" : "rgba(14,18,34,0.55)";
      g.fillRect(r.x + 1, KEY_Y, r.w - 2, r.h);
      if (on) {
        const fill = g.createLinearGradient(0, KEY_Y, 0, KEY_Y + r.h);
        fill.addColorStop(0, rgba(on.color, on.level * 0.75));
        fill.addColorStop(1, rgba(on.color, on.level * 0.15));
        g.fillStyle = fill;
        g.fillRect(r.x + 1, KEY_Y, r.w - 2, r.h);
      }
      g.strokeStyle = rgba(LAVENDER, black ? 0.12 : 0.1);
      g.lineWidth = 1;
      g.strokeRect(r.x + 1.5, KEY_Y + 0.5, r.w - 3, r.h);
    }
  g.globalCompositeOperation = "lighter";
  for (const [n, on] of lit) {
    const r = keyRect(n);
    const cx = r.x + r.w / 2;
    const up = g.createLinearGradient(0, KEY_Y - 110, 0, KEY_Y);
    up.addColorStop(0, rgba(on.color, 0));
    up.addColorStop(1, rgba(on.color, on.level * 0.35));
    g.fillStyle = up;
    g.fillRect(cx - r.w / 2, KEY_Y - 110, r.w, 110);
    glow(g, cx, KEY_Y, r.w * 1.6, on.color, on.level * 0.35);
  }
  // 鍵盤の上の細い光の縁
  const rim = g.createLinearGradient(KEY_X, 0, KEY_X + KEY_W, 0);
  rim.addColorStop(0, rgba(GOLD, 0));
  rim.addColorStop(0.5, rgba(GOLD, 0.25 + pulse * 0.1));
  rim.addColorStop(1, rgba(GOLD, 0));
  g.fillStyle = rim;
  g.fillRect(KEY_X, KEY_Y - 1, KEY_W, 1.5);
  g.globalCompositeOperation = "source-over";
}

function ScoreCanvas({ score, t }: { score: Score; t: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const g = ref.current?.getContext("2d");
    if (g) draw(g, score, t / 1000);
  }, [score, t]);
  return <canvas ref={ref} width={W} height={H} className="absolute inset-0 size-full" />;
}

/** 動画で見せる曲名: その場所の物語に合わせた一言 */
const TITLES: Record<SongKey, string> = {
  title: "星はどれも、誰かの一夜",
  prelude: "灯の前に、ひとり座る",
  rest: "星の下で、ひと息を",
  hearth: "残り火と、最初の一行",
  forest: "根の下で眠る言葉",
  stars: "瞬きを忘れた星たちへ",
  frost: "凍った一時間だけが残った",
  forge: "刻を薪にくべて",
  sanctum: "鈴に溶けた名前",
  zenith: "果てのない塔を、ひとりで",
};

/** 終幕（名と入口の案内）の時刻。動画の終わりから数える（ms） */
const finaleOf = (d: number) => ({ dim: [d - 6500, d - 5300], logo: [d - 5600, d - 4400], guide: [d - 4700, d - 3800], out: [d - 1100, d - 150] }) as const;

/** 終幕: 名と入口の案内（ほかの動画と同じ） */
function Finale({ t, duration }: { t: number; duration: number }) {
  const f = finaleOf(duration);
  if (t < f.logo[0]) return null;
  const out = 1 - ease(t, f.out[0], f.out[1]);
  const logo = ease(t, f.logo[0], f.logo[1]) * out;
  const guide = ease(t, f.guide[0], f.guide[1]) * out;
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-x-0 top-[33%] flex flex-col items-center text-center" style={veil(logo)}>
        <p className="flex items-center gap-3 text-[12px] tracking-[0.5em] whitespace-nowrap text-starlight/75">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-starlight/60" />
          <span className="-mr-[0.5em]">勉強記録アプリ マホログ</span>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-starlight/60" />
        </p>
        <p className="title-logo mt-3 font-display text-[54px] leading-none font-medium tracking-[0.18em] text-starlight-gradient" data-t0={f.logo[0]}>
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

/** 時刻 t（ms）の画面: 楽譜と曲名。終わりの数秒は楽譜を沈めて、名と入口の案内を出す */
function ScoreFrame({ score, t, song, duration }: { score: Score; t: number; song: SongKey; duration: number }) {
  const stage = TRACKS.find((x) => x.key === song)?.name ?? "";
  const f = finaleOf(duration);
  const dim = ease(t, f.dim[0], f.dim[1]);
  const titleOpacity = ease(t, 300, 1500) * (1 - dim);
  // 頭は黒から入り、終幕では楽譜を薄く沈めて残し、最後に黒へ
  const curtain = Math.max(1 - ease(t, 0, 800), dim * 0.72, ease(t, f.out[0], f.out[1]));

  return (
    <div className="@container absolute inset-0 overflow-hidden bg-black">
      <ScoreCanvas score={score} t={t} />
      <div className="absolute inset-x-0 top-[8.5%] flex flex-col items-center gap-[1.6cqw]" style={{ opacity: titleOpacity }}>
        <span className="text-[2.4cqw] tracking-[0.4em] whitespace-nowrap text-starlight/60">マホログ の BGM</span>
        <h1 className="text-starlight-gradient text-[5.4cqw] leading-tight tracking-[0.14em] whitespace-nowrap">{TITLES[song]}</h1>
        <span className="flex items-center gap-[2cqw] text-[2.4cqw] tracking-[0.3em] whitespace-nowrap text-starlight/55">
          <span className="h-px w-[6cqw] bg-gradient-to-r from-transparent to-starlight/50" />
          {stage}
          <span className="h-px w-[6cqw] bg-gradient-to-l from-transparent to-starlight/50" />
        </span>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: curtain }} />
      <Finale t={t} duration={duration} />
    </div>
  );
}

const LENGTHS = [15, 30, 60] as const;

/** 曲の楽譜を流す動画。song・from・sec は URL から受け取る */
export function ScoreShort({ song, from, seconds }: { song: SongKey; from: "intro" | "chorus"; seconds: number }) {
  // 描き出した楽譜（いま選んでいる曲・位置・長さのものだけを使う）
  const id = `${song}-${from}-${seconds}`;
  const [rendered, setRendered] = useState<{ id: string; score: Score } | null>(null);
  const score = rendered?.id === id ? rendered.score : null;
  const capture = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(location.search).has("capture"),
    () => true,
  );

  // アプリの環境音と重ならないようにする
  useEffect(() => {
    soundManager.setSilenced(true);
    return () => soundManager.setSilenced(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void renderScore(song, from, seconds).then((s) => !cancelled && setRendered({ id: `${song}-${from}-${seconds}`, score: s }));
    return () => {
      cancelled = true;
    };
  }, [song, from, seconds]);

  const play = useCallback(
    (ctx: AudioContext, destination: AudioNode) => {
      if (!score) return () => {};
      const src = ctx.createBufferSource();
      src.buffer = score.buffer;
      const gain = ctx.createGain();
      gain.gain.value = score.gain;
      src.connect(gain).connect(destination);
      src.start();
      return () => {
        try {
          src.stop();
        } catch {}
        gain.disconnect();
      };
    },
    [score],
  );

  const frame = useCallback(
    (t: number) => (score ? <ScoreFrame score={score} t={t} song={song} duration={seconds * 1000} /> : null),
    [score, song, seconds],
  );

  const href = (patch: Partial<{ song: SongKey; from: string; sec: number }>) => {
    const q = new URLSearchParams({ song, from, sec: String(seconds) });
    for (const [k, v] of Object.entries(patch)) q.set(k, String(v));
    return `/trailer/score?${q}`;
  };
  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-0.5 text-[11px] whitespace-nowrap ${active ? "border-starlight/60 text-starlight" : "border-white/15 text-muted-foreground hover:text-starlight"}`;

  return (
    <>
      {score ? (
        <ShortPlayer key={id} duration={seconds * 1000} frame={frame} play={play} />
      ) : (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black text-xs tracking-[0.3em] text-muted-foreground">
          曲を描き出しています…
        </div>
      )}
      {!capture && (
        <div className="fixed top-4 left-4 z-[95] flex max-w-56 flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {TRACKS.map((x) => (
              <Link key={x.key} href={href({ song: x.key })} className={chip(x.key === song)}>
                {x.name}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Link href={href({ from: "intro" })} className={chip(from === "intro")}>
              最初から
            </Link>
            <Link href={href({ from: "chorus" })} className={chip(from === "chorus")}>
              サビの手前から
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {LENGTHS.map((s) => (
              <Link key={s} href={href({ sec: s })} className={chip(seconds === s)}>
                {s}秒
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
