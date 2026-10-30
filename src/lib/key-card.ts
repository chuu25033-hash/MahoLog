"use client";

// 観測者IDと復元キーを、写真アプリに残しておける1枚の「鍵の札」の画像にする（canvas で描く）
import { GOLD, MONO, canShareImage, createCanvas, downloadBlob, drawFrame, drawNightSky, fontFamily, spacedText, toPng } from "./canvas-card";

const W = 1200;
const H = 720;

export async function renderKeyCard(id: string, key: string): Promise<Blob> {
  const { canvas, ctx } = createCanvas(W, H);
  const serif = await fontFamily("--font-mincho", "serif", "世界線を開く鍵観測者ID復元キーこの画像は誰にも見せず、大切に保管してください");
  const display = await fontFamily("--font-cinzel", "serif", "MAHOLOG OBSERVER ID RECOVERY KEY");

  drawNightSky(ctx, W, H);
  drawFrame(ctx, W, H);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = GOLD;
  ctx.font = `500 30px ${display}`;
  spacedText(ctx, "MAHOLOG", W / 2, 128, 14);
  ctx.fillStyle = "#e9e4d4";
  ctx.font = `500 40px ${serif}`;
  spacedText(ctx, "世界線を開く鍵", W / 2, 192, 12);

  const block = (label: string, sub: string, value: string, y: number, size: number) => {
    ctx.fillStyle = "rgba(233, 228, 212, 0.7)";
    ctx.font = `500 24px ${serif}`;
    spacedText(ctx, label, W / 2, y, 6);
    ctx.fillStyle = "rgba(226, 201, 116, 0.6)";
    ctx.font = `14px ${display}`;
    spacedText(ctx, sub, W / 2, y + 26, 5);
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(140, y + 44, W - 280, size + 40);
    ctx.strokeStyle = "rgba(226, 201, 116, 0.35)";
    ctx.strokeRect(140, y + 44, W - 280, size + 40);
    ctx.fillStyle = "#fbf3d4";
    ctx.font = `600 ${size}px ${MONO}`;
    spacedText(ctx, value, W / 2, y + 44 + 20 + size * 0.82, size * 0.12);
  };
  block("観測者ID", "OBSERVER ID", id, 262, 50);
  block("復元キー", "RECOVERY KEY", key, 432, 44);

  ctx.fillStyle = "rgba(233, 228, 212, 0.6)";
  ctx.font = `22px ${serif}`;
  spacedText(ctx, "この画像は誰にも見せず、大切に保管してください", W / 2, 640, 3);

  return toPng(canvas);
}

/**
 * 鍵の札を保存する。スマホでは共有シートから写真に保存でき、それ以外では PNG をダウンロードする。
 * 保存できたら true（共有シートを閉じただけなら false）
 */
export async function saveKeyCard(id: string, key: string): Promise<boolean> {
  const blob = await renderKeyCard(id, key);
  const file = new File([blob], `maholog-key-${id}.png`, { type: "image/png" });
  if (canShareImage(file)) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch {
      return false;
    }
  }
  downloadBlob(blob, file.name);
  return true;
}
