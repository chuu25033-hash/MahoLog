"use client";

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { ease, ShortPlayer } from "./trailer";

// YouTube（横長 16:9）のブロックの合間に差し込むアイキャッチ「星見の湖」。約5秒・「少女勉強中」（?text=rest で「少女休憩中」）。
// 写真のような夜空を canvas に描く: ノイズで雲と暗黒帯を作った天の川、数万の微光星、色温度の違う明るい星、
// 地平の大気光、陰影と雪をまとう山並みと灯のともる観測塔、そして星空を映す凪いだ湖。空は北の空を軸にごくわずかに巡る。
// 時刻 t（ms）だけで画面が決まるように組み、video/capture.mjs --size 960x540 で撮る（フェードなし、頭から終わりまで絵が出ている）

/** 素材の長さ（ms） */
export const EYECATCH_MS = 5000;
/** 載せる文字（?text=rest で休憩中にする） */
const TITLES = {
  study: { ja: "少女勉強中", en: "NOW STUDYING" },
  rest: { ja: "少女休憩中", en: "NOW RESTING" },
} as const;
type TitleKey = keyof typeof TITLES;

// ---- 決定的なノイズ ----

function hash(x: number, y: number, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
/** 0〜1 の決定的な乱数列 */
function rng(seed: number) {
  let i = 0;
  return () => hash(i++, seed, 977);
}
function noise(x: number, y: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(x: number, y: number, seed: number, octaves = 5) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise(x, y, seed + o * 31) * amp;
    norm += amp;
    x *= 2.03;
    y *= 2.03;
    amp *= 0.5;
  }
  return sum / norm;
}
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

// ---- 一度だけ作る素材（画面の大きさごと） ----

type Star = { x: number; y: number; b: number; color: number; phase: number; speed: number };
type Assets = {
  W: number;
  H: number;
  /** 天の川と微光星を焼き込んだ空（画面より上下左右 10% 広い） */
  sky: HTMLCanvasElement;
  stars: Star[];
  sprites: HTMLCanvasElement[];
  scene: HTMLCanvasElement;
  /** 湖に映す景色（上下を返してぼかしたもの） */
  reflection: HTMLCanvasElement;
  /** 陰影をつけた山並み */
  mountains: HTMLCanvasElement;
  shore: Path2D;
};
let cache: Assets | null = null;

/** 星の色（青白・白・淡黄・橙） */
const STAR_COLORS: [number, number, number][] = [
  [190, 210, 255],
  [235, 240, 255],
  [255, 250, 238],
  [255, 228, 190],
  [255, 196, 150],
];

function sprite(rgb: [number, number, number]) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  const [r, gg, b] = rgb;
  grad.addColorStop(0, `rgba(255,255,255,1)`);
  grad.addColorStop(0.08, `rgba(${r},${gg},${b},0.95)`);
  grad.addColorStop(0.22, `rgba(${r},${gg},${b},0.32)`);
  grad.addColorStop(0.5, `rgba(${r},${gg},${b},0.06)`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

/** 湖面の高さ（画面の高さに対する割合） */
const LAKE = 0.7;

function buildAssets(W: number, H: number): Assets {
  const TW = Math.round(W * 1.2);
  const TH = Math.round(H * 1.2);
  // 天の川: 左下の地平近くに明るい中心部を置き、右上へ抜ける帯
  const p0 = [0.12 * TW, 0.94 * TH];
  const p1 = [0.98 * TW, 0.0 * TH];
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const dir = [(p1[0] - p0[0]) / len, (p1[1] - p0[1]) / len];
  const Q = 4;
  const qw = Math.ceil(TW / Q);
  const qh = Math.ceil(TH / Q);
  const density = new Float32Array(qw * qh);
  const img = new ImageData(qw, qh);
  for (let y = 0; y < qh; y++) {
    for (let x = 0; x < qw; x++) {
      const px = x * Q - p0[0];
      const py = y * Q - p0[1];
      const along = (px * dir[0] + py * dir[1]) / len;
      const perp = px * dir[1] - py * dir[0];
      const width = TH * (0.085 + 0.05 * Math.sin(clamp01(along) * Math.PI) + 0.03 * (fbm(along * 6, 0.5, 71) - 0.5));
      const core = Math.exp(-(((along - 0.24) / 0.16) ** 2));
      const band = Math.exp(-((perp / width) ** 2)) * clamp01(along * 4 + 0.6) * clamp01((1.1 - along) * 3);
      const cloud = fbm(x * 0.022, y * 0.022, 11, 6);
      const fine = fbm(x * 0.09, y * 0.09, 23, 4);
      const lane = 1 - Math.abs(fbm(x * 0.03 + 40, y * 0.03, 37, 5) * 2 - 1);
      const dust = clamp01((lane - 0.55) * 3.2) * Math.exp(-((perp / (width * 0.5) - 0.25) ** 2));
      const dens = band * (0.35 + 1.1 * cloud ** 1.6 + 0.35 * fine) * (0.65 + 1.5 * core);
      const lit = dens * (1 - 0.88 * dust);
      density[y * qw + x] = clamp01(band * (0.5 + cloud) * (1 - 0.7 * dust));
      const warm = clamp01(core * 1.1 + lit * 0.15);
      // 帯の外にもごく淡い光の揺らぎ
      const haze = fbm(x * 0.01, y * 0.01, 53, 4) * 0.05;
      const k = 0.52;
      const i = (y * qw + x) * 4;
      img.data[i] = Math.min(255, 255 * (lit * k * mix(0.62, 1, warm) + haze * 0.6));
      img.data[i + 1] = Math.min(255, 255 * (lit * k * mix(0.7, 0.86, warm) + haze * 0.7));
      img.data[i + 2] = Math.min(255, 255 * (lit * k * mix(0.95, 0.7, warm) + haze));
      img.data[i + 3] = 255;
    }
  }
  const small = document.createElement("canvas");
  small.width = qw;
  small.height = qh;
  small.getContext("2d")!.putImageData(img, 0, 0);

  const sky = document.createElement("canvas");
  sky.width = TW;
  sky.height = TH;
  const g = sky.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, TW, TH);
  g.imageSmoothingQuality = "high";
  g.filter = `blur(${W / 640}px)`;
  g.drawImage(small, 0, 0, TW, TH);
  g.filter = "none";
  // 微光星: 天の川の濃いところほど密に
  const r = rng(101);
  g.globalCompositeOperation = "lighter";
  const dot = Math.max(1, W / 1920);
  for (let n = 0; n < 90000; n++) {
    const x = r() * TW;
    const y = r() * TH;
    const d = density[Math.min(qh - 1, Math.floor(y / Q)) * qw + Math.min(qw - 1, Math.floor(x / Q))];
    if (r() > 0.1 + d * 0.9) continue;
    const a = 0.08 + r() ** 2 * 0.55;
    const [cr, cg, cb] = STAR_COLORS[Math.floor(r() * STAR_COLORS.length)];
    g.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
    g.fillRect(x, y, dot * (r() < 0.15 ? 1.6 : 1), dot * (r() < 0.15 ? 1.6 : 1));
  }
  g.globalCompositeOperation = "source-over";

  // 明るい星（毎コマ瞬かせる）
  const sr = rng(202);
  const stars: Star[] = [];
  for (let n = 0; n < 1400; n++) {
    const x = sr() * TW;
    const y = sr() * TH;
    const d = density[Math.min(qh - 1, Math.floor(y / Q)) * qw + Math.min(qw - 1, Math.floor(x / Q))];
    if (sr() > 0.35 + d * 0.65) continue;
    stars.push({ x: x - W * 0.1, y: y - H * 0.1, b: sr() ** 4.2, color: Math.floor(sr() * STAR_COLORS.length), phase: sr() * 6.28, speed: 2 + sr() * 5 });
  }

  const mountains = buildMountains(W, H);
  // 手前の岸と針葉樹
  const shore = new Path2D();
  shore.moveTo(0, H);
  shore.lineTo(0, H * 0.86);
  shore.bezierCurveTo(W * 0.1, H * 0.87, W * 0.2, H * 0.93, W * 0.34, H);
  shore.closePath();
  shore.moveTo(W, H);
  shore.lineTo(W, H * 0.91);
  shore.bezierCurveTo(W * 0.94, H * 0.93, W * 0.88, H * 0.97, W * 0.82, H);
  shore.closePath();
  const tr = rng(505);
  const pine = (x: number, base: number, h: number) => {
    const w = h * 0.32;
    shore.moveTo(x, base - h);
    const tiers = 9;
    for (let i = 1; i <= tiers; i++) {
      const y = base - h + (h * 0.88 * i) / tiers;
      const spread = (w * i) / tiers * (0.85 + tr() * 0.3);
      shore.lineTo(x + spread, y);
      shore.lineTo(x + spread * 0.35, y - h * 0.02);
    }
    shore.lineTo(x + w * 0.06, base);
    shore.lineTo(x - w * 0.06, base);
    for (let i = tiers; i >= 1; i--) {
      const y = base - h + (h * 0.88 * i) / tiers;
      const spread = (w * i) / tiers * (0.85 + tr() * 0.3);
      shore.lineTo(x - spread * 0.35, y - h * 0.02);
      shore.lineTo(x - spread, y);
    }
    shore.closePath();
  };
  [
    [0.02, 0.9, 0.3],
    [0.055, 0.88, 0.22],
    [0.09, 0.9, 0.17],
    [0.125, 0.9, 0.12],
    [0.155, 0.92, 0.08],
    [0.975, 0.93, 0.2],
    [0.94, 0.94, 0.13],
  ].forEach(([x, base, h]) => pine(W * x, H * base, H * h));

  const scene = document.createElement("canvas");
  scene.width = W;
  scene.height = H;
  const reflection = document.createElement("canvas");
  reflection.width = W;
  reflection.height = Math.ceil(H * (1 - LAKE)) + 2;
  return { W, H, sky, stars, sprites: STAR_COLORS.map(sprite), scene, reflection, mountains, shore };
}

// ---- 山並み ----
// 稜線の形（湖面からの高さ、画面の高さに対する割合）を3層重ね、1画素ずつ陰影をつける。
// 縦に流れる沢（異方性のリッジノイズ）を左上の空明かりで照らし、遠い山ほど霞ませ、高い峰には雪を残す。
// 近い2層の稜線には針葉樹の梢を細かく立てる

const ridged = (n: number) => 1 - Math.abs(n * 2 - 1);
const bump = (u: number, at: number, w: number) => Math.exp(-(((u - at) / w) ** 2));

/** 針葉樹の梢（稜線に足す高さ） */
function treeline(u: number, spacing: number, height: number, seed: number) {
  const k = Math.floor(u / spacing);
  const f = u / spacing - k;
  const mask = clamp01((fbm(u * 7, 0.3, seed, 3) - 0.3) * 3);
  return height * (0.4 + 0.6 * hash(k, 1, seed)) * (1 - Math.abs(f * 2 - 1)) ** 1.3 * mask;
}

const farTop = (u: number) =>
  (0.04 + 0.1 * ridged(fbm(u * 4.2, 1.7, 301, 6)) ** 2 + 0.03 * ridged(fbm(u * 26, 2.3, 307, 4)) ** 1.5 + 0.008 * fbm(u * 90, 2.9, 311, 3)) * (1 - 0.5 * bump(u, 0.36, 0.14)) +
  0.075 * Math.exp(-Math.abs(u - 0.885) / 0.06) +
  0.035 * bump(u, 0.08, 0.08);
const midOpen = (u: number) => 1 - 0.8 * bump(u, 0.42, 0.2);
const midTop = (u: number) =>
  (0.016 + 0.07 * fbm(u * 5, 4.2, 401, 5) ** 1.3 + 0.008 * fbm(u * 30, 4.9, 409, 3)) * midOpen(u) + 0.024 * bump(u, 0.74, 0.05);
const nearTop = (u: number) => 0.004 + 0.008 * fbm(u * 9, 7.1, 501, 4);

type Layer = {
  top: (u: number, W: number) => number;
  lit: [number, number, number];
  shade: [number, number, number];
  haze: [number, number, number];
  hazeAmount: number;
  /** 沢の陰影の強さ */
  relief: number;
  /** 雪の残る高さ（無ければ雪なし） */
  snow?: number;
  seed: number;
};

const LAYERS: Layer[] = [
  {
    top: (u) => farTop(u),
    lit: [36, 48, 74],
    shade: [9, 13, 24],
    haze: [26, 36, 56],
    hazeAmount: 0.55,
    relief: 1,
    snow: 0.125,
    seed: 600,
  },
  {
    top: (u, W) => midTop(u) + treeline(u, 4 / W, 0.007, 610) * midOpen(u),
    lit: [20, 28, 46],
    shade: [6, 9, 18],
    haze: [18, 26, 44],
    hazeAmount: 0.35,
    relief: 0.8,
    seed: 620,
  },
  {
    top: (u, W) => nearTop(u) + treeline(u, 6 / W, 0.012, 630),
    lit: [9, 12, 22],
    shade: [3, 4, 9],
    haze: [10, 14, 26],
    hazeAmount: 0.2,
    relief: 0.5,
    seed: 640,
  },
];

function buildMountains(W: number, H: number) {
  const HY = Math.round(H * LAKE);
  const unit = W / 1920;
  const img = new ImageData(W, HY);
  const d = img.data;
  for (const layer of LAYERS) {
    const tops = new Float32Array(W + 2);
    for (let x = -1; x <= W; x++) tops[x + 1] = HY - H * layer.top((x + 0.5) / W, W);
    // 稜線の累積和: 下へ行くほど広い幅で稜線の傾きを均し、峰から裾へ広がる斜面の向きを求める
    const sum = new Float64Array(W + 3);
    for (let x = 0; x < W + 2; x++) sum[x + 1] = sum[x] + tops[x];
    const avg = (from: number, to: number) => {
      const a = Math.max(0, Math.min(W + 1, Math.round(from)));
      const b = Math.max(a + 1, Math.min(W + 2, Math.round(to)));
      return (sum[b] - sum[a]) / (b - a);
    };
    // 岩肌の細かな起伏（沢は峰から放射状に下るよう、横の揺らぎで曲げる）
    const rock = (x: number, y: number) => {
      const wx = x + fbm(x * 0.004 / unit, y * 0.004 / unit, layer.seed + 3, 3) * 60 * unit;
      return ridged(fbm(wx * 0.011 / unit, y * 0.0065 / unit, layer.seed, 5));
    };
    for (let x = 0; x < W; x++) {
      const top = tops[x + 1];
      const height = HY - top;
      for (let y = Math.max(0, Math.floor(top)); y < HY; y++) {
        const cover = clamp01(y + 1 - top);
        if (cover <= 0) continue;
        const below = y - top;
        const depth = clamp01(below / Math.max(1, height));
        // 斜面の向き: 左の稜線が高い（= 画面上で小さい）なら右下がりの斜面で影、低ければ左上の空を向いて明るい
        const span = 3 * unit + below * 0.9;
        const facing = (avg(x + 1 - span, x + 1) - avg(x + 1, x + 1 + span)) / span;
        const face = clamp01(0.5 + facing * 1.4);
        const here = rock(x, y);
        const detail = (rock(x - 4 * unit, y - 2 * unit) - rock(x + 4 * unit, y + 2 * unit)) * 2.4 + (here - 0.5) * 0.7;
        let light = clamp01((0.18 + 0.62 * face + detail * layer.relief * 0.6) * (1 - depth * 0.6));
        // 稜線のすぐ下は空明かりを受けてわずかに明るい
        light = clamp01(light + 0.18 * clamp01(1 - below / (2.5 * unit)) * layer.relief);
        let r = mix(layer.shade[0], layer.lit[0], light);
        let g = mix(layer.shade[1], layer.lit[1], light);
        let b = mix(layer.shade[2], layer.lit[2], light);
        if (layer.snow !== undefined) {
          // 雪は高い峰の頂近くにだけ、沢に沿って筋になって残る
          const line = HY - H * (layer.snow + 0.035 * (fbm(x * 0.02 / unit, 3, layer.seed + 9, 4) - 0.5));
          const amount = clamp01((line - y) / (H * 0.03)) * clamp01((rock(x, y) - 0.3) * 2.2) * clamp01(1 - below / (H * 0.05));
          if (amount > 0) {
            const snow = 0.35 + 0.85 * face;
            r = mix(r, 88 * snow, amount * 0.8);
            g = mix(g, 98 * snow, amount * 0.8);
            b = mix(b, 124 * snow, amount * 0.8);
          }
        }
        const haze = depth ** 1.6 * layer.hazeAmount;
        r = mix(r, layer.haze[0], haze);
        g = mix(g, layer.haze[1], haze);
        b = mix(b, layer.haze[2], haze);
        const i = (y * W + x) * 4;
        const prev = d[i + 3] / 255;
        d[i] = prev > 0 ? mix(d[i], r, cover) : r;
        d[i + 1] = prev > 0 ? mix(d[i + 1], g, cover) : g;
        d[i + 2] = prev > 0 ? mix(d[i + 2], b, cover) : b;
        d[i + 3] = 255 * Math.max(prev, cover);
      }
    }
  }
  const c = document.createElement("canvas");
  c.width = W;
  c.height = HY;
  c.getContext("2d")!.putImageData(img, 0, 0);
  return c;
}

// ---- 1コマを描く ----

/** 流れ星 */
const METEORS = [
  { at: 1500, dur: 700, x: 0.66, y: 0.08, dx: -0.2, dy: 0.17, len: 0.11, power: 1 },
  { at: 3500, dur: 500, x: 0.3, y: 0.14, dx: -0.1, dy: 0.08, len: 0.06, power: 0.55 },
];

function draw(canvas: HTMLCanvasElement, t: number) {
  const W = canvas.width;
  const H = canvas.height;
  if (!cache || cache.W !== W || cache.H !== H) cache = buildAssets(W, H);
  const a = cache;
  const s = t / 1000;
  const HY = H * LAKE;
  const g = a.scene.getContext("2d")!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = 1;

  // 夜空の地色と、地平の大気光
  const base = g.createLinearGradient(0, 0, 0, HY);
  base.addColorStop(0, "#010208");
  base.addColorStop(0.5, "#040917");
  base.addColorStop(0.85, "#0a1428");
  base.addColorStop(1, "#13213a");
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  const airglow = g.createLinearGradient(0, HY - H * 0.22, 0, HY);
  airglow.addColorStop(0, "rgba(40,90,80,0)");
  airglow.addColorStop(0.7, "rgba(46,104,92,0.13)");
  airglow.addColorStop(1, "rgba(90,120,120,0.18)");
  g.fillStyle = airglow;
  g.fillRect(0, 0, W, HY);
  const town = g.createRadialGradient(W * 0.16, HY, 0, W * 0.16, HY, W * 0.38);
  town.addColorStop(0, "rgba(190,120,80,0.16)");
  town.addColorStop(1, "rgba(190,120,80,0)");
  g.fillStyle = town;
  g.fillRect(0, 0, W, HY + 2);

  // 空: 北の空を軸に、気づくか気づかないかの速さで巡る
  g.save();
  const pivotX = W * 0.36;
  const pivotY = -H * 0.9;
  g.translate(pivotX, pivotY);
  g.rotate(((-0.2 + s * 0.06) * Math.PI) / 180);
  g.translate(-pivotX, -pivotY);
  g.globalCompositeOperation = "lighter";
  g.drawImage(a.sky, -W * 0.1, -H * 0.1);
  const unit = W / 1920;
  for (const st of a.stars) {
    // 地平に近い星ほどよく瞬く
    const low = clamp01((st.y / HY - 0.55) * 2.2);
    const tw = 1 + (0.04 + 0.14 * low) * Math.sin(s * st.speed + st.phase) * Math.sin(s * st.speed * 0.37 + st.phase * 2);
    const b = st.b * tw * (1 - 0.45 * low);
    if (b < 0.02) continue;
    const size = unit * (5 + b * 30);
    g.globalAlpha = clamp01(0.35 + b * 1.4);
    g.drawImage(a.sprites[st.color], st.x - size / 2, st.y - size / 2, size, size);
  }
  g.globalAlpha = 1;
  // 流れ星
  for (const m of METEORS) {
    const p = (t - m.at) / m.dur;
    if (p < 0 || p > 1) continue;
    const head = 1 - (1 - p) ** 1.6;
    const hx = W * (m.x + m.dx * head);
    const hy = H * (m.y + m.dy * head);
    const l = Math.hypot(m.dx * W, m.dy * H);
    const ux = (m.dx * W) / l;
    const uy = (m.dy * H) / l;
    const tail = W * m.len * Math.min(1, p * 2.5);
    const life = Math.sin(p * Math.PI) ** 0.7 * m.power;
    const grad = g.createLinearGradient(hx, hy, hx - ux * tail, hy - uy * tail);
    grad.addColorStop(0, `rgba(235,255,240,${life})`);
    grad.addColorStop(0.08, `rgba(200,240,225,${life * 0.7})`);
    grad.addColorStop(1, "rgba(160,190,255,0)");
    g.strokeStyle = grad;
    g.lineCap = "round";
    g.lineWidth = 2.2 * unit;
    g.beginPath();
    g.moveTo(hx, hy);
    g.lineTo(hx - ux * tail, hy - uy * tail);
    g.stroke();
    g.globalAlpha = life;
    const hs = unit * 26;
    g.drawImage(a.sprites[1], hx - hs / 2, hy - hs / 2, hs, hs);
    g.globalAlpha = 1;
  }
  g.restore();
  g.globalCompositeOperation = "source-over";

  // 山並み（陰影は一度だけ焼き込んである）
  g.drawImage(a.mountains, 0, 0);
  // 観測塔と灯（中ほどの山の肩に立つ）
  const tx = W * 0.74;
  const ty = HY - H * midTop(0.74) + H * 0.004;
  const th = H * 0.085;
  const tw = H * 0.016;
  g.fillStyle = "#04060e";
  g.beginPath();
  g.moveTo(tx - tw * 0.6, ty);
  g.lineTo(tx - tw * 0.42, ty - th);
  g.lineTo(tx + tw * 0.42, ty - th);
  g.lineTo(tx + tw * 0.6, ty);
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(tx, ty - th, tw * 0.62, Math.PI, 0);
  g.fill();
  const flicker = 0.88 + 0.07 * Math.sin(s * 5.1) + 0.05 * Math.sin(s * 12.3);
  const wy = ty - th * 0.72;
  const glow = g.createRadialGradient(tx, wy, 0, tx, wy, H * 0.05);
  glow.addColorStop(0, `rgba(255,200,120,${0.45 * flicker})`);
  glow.addColorStop(1, "rgba(255,180,100,0)");
  g.globalCompositeOperation = "lighter";
  g.fillStyle = glow;
  g.fillRect(tx - H * 0.05, wy - H * 0.05, H * 0.1, H * 0.1);
  g.fillStyle = `rgba(255,214,150,${flicker})`;
  g.fillRect(tx - tw * 0.12, wy - tw * 0.2, tw * 0.24, tw * 0.4);
  g.globalCompositeOperation = "source-over";
  // 湖岸の薄い霧
  const mist = g.createLinearGradient(0, HY - H * 0.04, 0, HY + 2);
  mist.addColorStop(0, "rgba(120,140,180,0)");
  mist.addColorStop(1, "rgba(120,140,180,0.1)");
  g.fillStyle = mist;
  g.fillRect(0, HY - H * 0.04, W, H * 0.04 + 2);

  // 湖: 凪いだ水面。上の景色を逆さにして少しぼかし、ごく緩やかなさざ波でだけ揺らす
  const out = canvas.getContext("2d")!;
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.globalAlpha = 1;
  out.globalCompositeOperation = "source-over";
  const top = Math.floor(HY);
  out.drawImage(a.scene, 0, 0, W, top, 0, 0, W, top);
  const L = H - top;
  const r = a.reflection.getContext("2d")!;
  r.setTransform(1, 0, 0, 1, 0, 0);
  r.clearRect(0, 0, W, a.reflection.height);
  r.filter = `blur(${1.4 * unit}px)`;
  r.setTransform(1, 0, 0, -1, 0, L);
  r.drawImage(a.scene, 0, top - L, W, L, 0, 0, W, L);
  r.filter = "none";
  r.setTransform(1, 0, 0, 1, 0, 0);
  out.fillStyle = "#03050c";
  out.fillRect(0, top, W, L);
  // 遠く（水際）ほど鏡のように、手前ほど水の色が勝る
  const strip = Math.max(1, Math.round(unit));
  for (let y = 0; y < L; y += strip) {
    const depth = y / L;
    const off = (Math.sin(y / unit * 0.09 + s * 1.3) * 0.5 + Math.sin(y / unit * 0.023 - s * 0.7) * 1.2) * depth * unit;
    out.globalAlpha = mix(0.82, 0.38, depth ** 0.8);
    out.drawImage(a.reflection, 0, y, W, strip, off, top + y, W, strip);
  }
  out.globalAlpha = 1;
  const deep = out.createLinearGradient(0, top, 0, H);
  deep.addColorStop(0, "rgba(6,10,22,0.08)");
  deep.addColorStop(0.5, "rgba(3,5,12,0.3)");
  deep.addColorStop(1, "rgba(1,2,6,0.62)");
  out.fillStyle = deep;
  out.fillRect(0, top, W, L);
  // 水面に揺れる淡い光の筋（両端の溶けた横長の光）
  out.globalCompositeOperation = "lighter";
  const sr = rng(808);
  for (let i = 0; i < 26; i++) {
    const depth = sr() ** 1.4;
    const y = top + (0.04 + depth * 0.7) * L;
    const x = sr() * W + Math.sin(s * 0.5 + i) * 6 * unit;
    const w = (60 + sr() * 220) * unit * (1 - depth * 0.4);
    const alpha = (0.025 + 0.035 * (0.5 + 0.5 * Math.sin(s * (0.8 + sr()) + sr() * 6.28))) * (1 - depth * 0.6);
    const streak = out.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    streak.addColorStop(0, "rgba(160,180,225,0)");
    streak.addColorStop(0.5, `rgba(160,180,225,${alpha})`);
    streak.addColorStop(1, "rgba(160,180,225,0)");
    out.fillStyle = streak;
    out.fillRect(x - w / 2, y, w, (1 + depth * 1.5) * unit);
  }
  out.globalCompositeOperation = "source-over";
  // 水際の細い光
  const edge = out.createLinearGradient(0, top - unit, 0, top + 3 * unit);
  edge.addColorStop(0, "rgba(140,160,205,0)");
  edge.addColorStop(0.4, "rgba(140,160,205,0.1)");
  edge.addColorStop(1, "rgba(140,160,205,0)");
  out.fillStyle = edge;
  out.fillRect(0, top - unit, W, 4 * unit);
  // 手前の岸と木立
  out.fillStyle = "#010205";
  out.fill(a.shore);
  // 周辺減光
  const vig = out.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.45, W * 0.7);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.5)");
  out.fillStyle = vig;
  out.fillRect(0, 0, W, H);
}

function Sky({ t }: { t: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    draw(canvas, t);
  }, [t]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

/** 文字: 一字ずつ霞から結ぶ */
function Title({ t, title }: { t: number; title: TitleKey }) {
  const sub = ease(t, 900, 1700);
  return (
    <div className="absolute inset-x-0 flex flex-col items-center" style={{ top: "33%" }}>
      <p
        className="font-serif whitespace-nowrap"
        style={{ fontSize: "5.6cqw", letterSpacing: "0.42em", marginRight: "-0.42em", color: "#f4efe4", lineHeight: 1 }}
      >
        {[...TITLES[title].ja].map((ch, i) => {
          const o = ease(t, 80 + i * 110, 880 + i * 110);
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: o,
                filter: `blur(${(1 - o) * 0.6}cqw)`,
                transform: `translateY(${(1 - o) * 0.5}cqw)`,
                textShadow: "0 0 1.6cqw rgba(150,180,255,0.45), 0 0 0.35cqw rgba(0,0,0,0.7)",
              }}
            >
              {ch}
            </span>
          );
        })}
      </p>
      <div className="flex items-center" style={{ marginTop: "2.4cqw", gap: "1.6cqw", opacity: sub, filter: `blur(${(1 - sub) * 0.3}cqw)` }}>
        <span style={{ height: 1, width: "7cqw", background: "linear-gradient(90deg, transparent, rgba(230,222,200,0.7))" }} />
        <p className="font-display whitespace-nowrap" style={{ fontSize: "1.3cqw", letterSpacing: "0.6em", marginRight: "-0.6em", color: "rgba(236,228,206,0.8)" }}>
          {TITLES[title].en}
        </p>
        <span style={{ height: 1, width: "7cqw", background: "linear-gradient(270deg, transparent, rgba(230,222,200,0.7))" }} />
      </div>
    </div>
  );
}

function Frame({ t, title }: { t: number; title: TitleKey }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ containerType: "size", background: "#010208" }}>
      <Sky t={t} />
      <Title t={t} title={title} />
    </div>
  );
}

// ---- 音 ----
// ピアノの短い一節（Gmaj9 → A → Dmaj9）に、柔らかな弦の和音と、流れ星のきらめきを添える。
// 録音したピアノ（public/sounds/piano/）を、アプリの曲と同じく短3度おきの音から音程をずらして鳴らす

const SAMPLE_NOTES = Array.from({ length: 26 }, (_, i) => 33 + i * 3);
const sampleUrl = (note: number) =>
  `/sounds/piano/${({ 0: "C", 3: "Ds", 6: "Fs", 9: "A" } as Record<number, string>)[note % 12]}${Math.floor(note / 12) - 1}.mp3`;
let bank: Map<number, AudioBuffer> | null = null;
let loading: Promise<void> | null = null;
function loadSamples(ctx: BaseAudioContext) {
  loading ??= Promise.all(
    SAMPLE_NOTES.map(async (note) => [note, await ctx.decodeAudioData(await (await fetch(sampleUrl(note))).arrayBuffer())] as const),
  ).then((entries) => void (bank = new Map(entries)));
  return loading;
}

const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);

function piano(ctx: BaseAudioContext, out: AudioNode, note: number, at: number, velocity: number) {
  if (!bank) return;
  const base = SAMPLE_NOTES.reduce((best, n) => (Math.abs(n - note) < Math.abs(best - note) ? n : best));
  const src = ctx.createBufferSource();
  src.buffer = bank.get(base)!;
  src.playbackRate.value = 2 ** ((note - base) / 12);
  const felt = ctx.createBiquadFilter();
  felt.type = "lowpass";
  felt.frequency.value = 1200 + 7000 * velocity ** 1.6;
  const g = ctx.createGain();
  g.gain.value = 0.42 * velocity ** 1.3;
  const pan = ctx.createStereoPanner();
  pan.pan.value = Math.max(-0.4, Math.min(0.4, (note - 64) / 40));
  src.connect(felt).connect(g).connect(pan).connect(out);
  src.start(at);
}

function hall(ctx: BaseAudioContext, seconds: number) {
  const conv = ctx.createConvolver();
  const buf = ctx.createBuffer(2, Math.round(ctx.sampleRate * seconds), ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
  }
  conv.buffer = buf;
  return conv;
}

function playSoundtrack(ctx: AudioContext, destination: AudioNode) {
  const now = ctx.currentTime + 0.05;
  const at = (ms: number) => now + ms / 1000;
  const master = ctx.createGain();
  // 画面は切れ目なく出し入れするが、音の終わりだけはプツッと切れないよう一瞬で絞る
  master.gain.setValueAtTime(0.9, now);
  master.gain.setValueAtTime(0.9, at(EYECATCH_MS - 220));
  master.gain.linearRampToValueAtTime(0.0001, at(EYECATCH_MS));
  master.connect(destination);
  const dry = ctx.createGain();
  dry.gain.value = 0.85;
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  const verb = hall(ctx, 3.6);
  dry.connect(master);
  wet.connect(verb).connect(master);
  const bus = ctx.createGain();
  bus.connect(dry);
  bus.connect(wet);

  // 弦の和音（柔らかく敷く）
  const pad = (notes: number[], from: number, to: number, level: number) =>
    notes.forEach((n) =>
      [-7, 7].forEach((cents) => {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = hz(n);
        o.detune.value = cents;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 900;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, at(from));
        g.gain.exponentialRampToValueAtTime(level, at(from + 450));
        g.gain.setValueAtTime(level, at(to - 200));
        g.gain.exponentialRampToValueAtTime(0.0001, at(to + 500));
        o.connect(lp).connect(g).connect(bus);
        o.start(at(from));
        o.stop(at(to + 600));
      }),
    );
  pad([55, 62, 66], 0, 1900, 0.012);
  pad([57, 61, 64], 1900, 3000, 0.012);
  pad([50, 57, 62, 66], 3000, EYECATCH_MS, 0.013);

  // ピアノ: 左手と和音
  const roll = (notes: number[], ms: number, velocity: number) => notes.forEach((n, i) => piano(ctx, bus, n, at(ms + i * 35), velocity));
  roll([31, 43], 20, 0.5);
  roll([59, 62, 66, 69], 80, 0.32);
  roll([33, 45], 1900, 0.48);
  roll([61, 64, 69], 1960, 0.3);
  roll([26, 38, 50], 3000, 0.52);
  roll([57, 61, 64, 66], 3070, 0.32);
  // 旋律
  (
    [
      [78, 120, 0.55],
      [81, 560, 0.5],
      [83, 1000, 0.52],
      [81, 1400, 0.46],
      [76, 1960, 0.5],
      [78, 2350, 0.48],
      [73, 2700, 0.44],
      [78, 3070, 0.56],
      [90, 3500, 0.3],
    ] as const
  ).forEach(([n, ms, v]) => piano(ctx, bus, n, at(ms), v));

  // 流れ星のきらめき（高い鐘をそっと）
  (
    [
      [1500, [93, 98, 100]],
      [3500, [95, 100]],
    ] as const
  ).forEach(([ms, notes]) =>
    notes.forEach((n, i) => {
      const o = ctx.createOscillator();
      o.frequency.value = hz(n);
      const g = ctx.createGain();
      const start = at(ms + i * 70);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.022, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 1.2);
      o.connect(g).connect(wet);
      o.start(start);
      o.stop(start + 1.3);
    }),
  );

  return () => {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.disconnect();
  };
}

export function EyecatchShort() {
  // ピアノの音を先に読み込んでおき、録音の頭から鳴るようにする
  useEffect(() => {
    void loadSamples(new OfflineAudioContext(1, 1, 44100));
  }, []);
  const title = useSyncExternalStore(
    () => () => {},
    (): TitleKey => (new URLSearchParams(location.search).get("text") === "rest" ? "rest" : "study"),
    (): TitleKey => "study",
  );
  return <ShortPlayer landscape duration={EYECATCH_MS} frame={(t) => <Frame t={t} title={title} />} play={playSoundtrack} />;
}
