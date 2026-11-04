"use client";

import { useEffect, useRef } from "react";

/**
 * 写真のような星空を、canvas に一度だけ描く（星の数が多いので、要素を並べずに一枚の絵にする）。
 * 星の明るさは暗い星ほど多く、色は白〜淡い黄が多く、青白い星と橙の星が少し混じる。明るい星にだけ柔らかな光の暈、
 * いちばん明るい数個にだけ細く長い光の筋。milkyWay を渡すと、無数の淡い光の塊で天の川を描き、暗い塵の筋で割る。
 * 舞台の大きさが変わったら描き直す
 */

/** 決定的な乱数（同じ舞台なら、いつも同じ星空になる） */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 星の色（表面の温度）: 白〜淡い黄が多く、青白・橙は少ない */
const STAR_COLORS: [number, string][] = [
  [0.12, "205,220,255"],
  [0.42, "255,255,255"],
  [0.72, "255,246,230"],
  [0.9, "255,228,190"],
  [0.98, "255,204,160"],
  [1, "255,178,140"],
];
const starColor = (r: number) => STAR_COLORS.find(([edge]) => r <= edge)![1];

export type StarSkyOptions = {
  seed: number;
  /** 星の多さ（1 が標準） */
  density: number;
  /** 天の川の傾き（度）。無ければ描かない */
  milkyWay?: number;
  /** 天の川の明るさ（0〜1） */
  milkyGlow?: number;
};

function paint(canvas: HTMLCanvasElement, { seed, density, milkyWay, milkyGlow = 1 }: StarSkyOptions) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  const scale = Math.sqrt((w * h) / (1280 * 720));
  const rnd = mulberry32(seed);
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 2;
  ctx.clearRect(0, 0, w, h);

  // 天の川: 帯に沿って、淡い光の塊を無数に重ね、暗い塵の筋で割る
  const band = milkyWay === undefined ? null : (() => {
    const a = (milkyWay * Math.PI) / 180;
    return { ux: Math.cos(a), uy: Math.sin(a), cx: w * 0.5, cy: h * 0.42, half: Math.hypot(w, h) * 0.6, width: h * 0.16 };
  })();
  const bandPoint = (along: number, across: number) => band && [band.cx + band.ux * along - band.uy * across, band.cy + band.uy * along + band.ux * across];
  if (band) {
    ctx.globalCompositeOperation = "lighter";
    const glowCount = Math.round(1400 * scale);
    for (let i = 0; i < glowCount; i++) {
      const along = (rnd() * 2 - 1) * band.half;
      // 帯の中ほどが明るい
      const core = Math.exp(-((along / (band.half * 0.55)) ** 2));
      const across = gauss() * band.width * (0.7 + 0.5 * core);
      const [x, y] = bandPoint(along, across)!;
      const r = (6 + rnd() * 38) * scale;
      const tint = rnd() < 0.55 ? "190,200,255" : rnd() < 0.6 ? "255,228,205" : "214,190,255";
      const alpha = (0.012 + rnd() * 0.03) * (0.4 + core) * milkyGlow;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${tint},${alpha})`);
      g.addColorStop(1, `rgba(${tint},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // 暗い塵の筋（帯の中心から少しずれて、途切れながら走る）
    ctx.globalCompositeOperation = "source-over";
    const dustCount = Math.round(380 * scale);
    for (let i = 0; i < dustCount; i++) {
      const along = (rnd() * 2 - 1) * band.half * 0.8;
      const wave = Math.sin(along / (band.width * 1.7)) * band.width * 0.18;
      const across = wave + gauss() * band.width * 0.12 - band.width * 0.06;
      const [x, y] = bandPoint(along, across)!;
      const r = (4 + rnd() * 16) * scale;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(4,2,14,${0.05 + rnd() * 0.08})`);
      g.addColorStop(1, "rgba(4,2,14,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  ctx.globalCompositeOperation = "lighter";
  const dot = (x: number, y: number, r: number, color: string, alpha: number) => {
    ctx.fillStyle = `rgba(${color},${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const px = Math.max(1, w / 1280);

  // 無数のかすかな星（天の川の中ほど密に）
  const faint = Math.round(2600 * density * scale * scale);
  for (let i = 0; i < faint; i++) {
    let x = rnd() * w, y = rnd() * h;
    if (band && rnd() < 0.45) {
      const along = (rnd() * 2 - 1) * band.half;
      [x, y] = bandPoint(along, gauss() * band.width * 0.9)!;
    }
    const m = rnd() ** 2.2;
    dot(x, y, (0.25 + m * 0.5) * px, starColor(rnd()), 0.18 + m * 0.5);
  }

  // ふつうの星: 小さな光の暈を持つ
  const mid = Math.round(220 * density * scale);
  for (let i = 0; i < mid; i++) {
    const x = rnd() * w, y = rnd() * h;
    const m = rnd() ** 3;
    const r = (0.6 + m * 0.9) * px;
    const color = starColor(rnd());
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, `rgba(${color},${0.22 + m * 0.2})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    dot(x, y, r, color, 0.7 + m * 0.3);
  }

  // 明るい星: 柔らかな大きい暈。いちばん明るい数個にだけ、細く長い光の筋
  const bright = Math.round(14 * density);
  for (let i = 0; i < bright; i++) {
    const x = rnd() * w, y = rnd() * h * 0.85;
    const color = starColor(rnd() * 0.9);
    const r = (1.1 + rnd() * 0.8) * px;
    const halo = r * (7 + rnd() * 6);
    const g = ctx.createRadialGradient(x, y, 0, x, y, halo);
    g.addColorStop(0, `rgba(${color},0.55)`);
    g.addColorStop(0.15, `rgba(${color},0.16)`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - halo, y - halo, halo * 2, halo * 2);
    if (i < 4) {
      const len = halo * (2.2 + rnd());
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const lg = ctx.createLinearGradient(x - dx * len, y - dy * len, x + dx * len, y + dy * len);
        lg.addColorStop(0, `rgba(${color},0)`);
        lg.addColorStop(0.5, `rgba(${color},0.45)`);
        lg.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = lg;
        if (dx) ctx.fillRect(x - len, y - 0.5 * px, len * 2, px);
        else ctx.fillRect(x - 0.5 * px, y - len, px, len * 2);
      }
    }
    dot(x, y, r, "255,255,255", 0.95);
  }
  ctx.globalCompositeOperation = "source-over";
}

export function StarSky(options: StarSkyOptions) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { seed, density, milkyWay, milkyGlow } = options;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let frame = 0;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
      if (w === 0 || h === 0 || (canvas.width === w && canvas.height === h)) return;
      canvas.width = w;
      canvas.height = h;
      paint(canvas, { seed, density, milkyWay, milkyGlow });
    };
    draw();
    // 大きさが変わったら、落ち着いてから一度だけ描き直す
    let timer = 0;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(draw);
      }, 150);
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [seed, density, milkyWay, milkyGlow]);
  return <canvas ref={ref} className="size-full" aria-hidden />;
}
