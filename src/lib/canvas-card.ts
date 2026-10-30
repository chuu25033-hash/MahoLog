"use client";

// canvas で描く画像（鍵の札・共有カード）の共通の道具: 夜空の下地・金の枠・字間をあけた文字・保存

export const GOLD = "#e2c974";
export const MONO = `ui-monospace, "SF Mono", Menlo, Consolas, monospace`;

/** next/font が付けたフォント名（CSS 変数）を canvas でも使う。読み込みを待ってから描く */
export async function fontFamily(variable: string, fallback: string, sample: string) {
  const family = getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || fallback;
  try {
    await document.fonts.load(`40px ${family}`, sample);
  } catch {}
  return family;
}

export function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext("2d")! };
}

/** 四芒星 */
export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
}

/** 夜空の下地と星屑（毎回同じ並びになるよう、簡単な疑似乱数で置く） */
export function drawNightSky(ctx: CanvasRenderingContext2D, w: number, h: number, stars = 90) {
  const bg = ctx.createRadialGradient(w / 2, h * 0.3, 40, w / 2, h / 2, w * 0.75);
  bg.addColorStop(0, "#1a2240");
  bg.addColorStop(1, "#080c16");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  let seed = 7;
  const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  ctx.fillStyle = "#fbf3d4";
  for (let i = 0; i < stars; i++) {
    ctx.globalAlpha = 0.15 + rand() * 0.5;
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h, 0.6 + rand() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** 二重の金の枠と四隅の星 */
export function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = GOLD;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, w - 72, h - 72);
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1;
  ctx.strokeRect(50, 50, w - 100, h - 100);
  ctx.globalAlpha = 1;
  ctx.fillStyle = GOLD;
  for (const [x, y] of [[36, 36], [w - 36, 36], [36, h - 36], [w - 36, h - 36]]) drawStar(ctx, x, y, 12);
  ctx.restore();
}

/** 字間をあけて描く（canvas の letterSpacing が無いブラウザでも揃うよう、1字ずつ置く）。align は x の基準 */
export function spacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: "left" | "center" | "right" = "center",
) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cursor = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, cursor, y);
    cursor += widths[i] + spacing;
  });
  return total;
}

export function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/png"));
}

/** PNG をダウンロードする */
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** スマホの共有シートで画像を渡せるか（PC ではダウンロードにする） */
export function canShareImage(file: File) {
  return window.matchMedia("(pointer: coarse)").matches && Boolean(navigator.canShare?.({ files: [file] }));
}
