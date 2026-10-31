"use client";

// SNS に載せる「探求の記録」の画像（1200×675）: 紋章・名前・階級と、七夜の魔法陣・学んだ時間
import { GOLD, createCanvas, drawFrame, drawNightSky, drawStar, fontFamily, spacedText, toPng } from "./canvas-card";
import { formatMinutes } from "./game";
import type { ItemRarity } from "./items";
import type { SubjectTotal } from "./types";

const W = 1200;
const H = 675;

export type ShareCardInput = {
  /** 紋章の SVG（画面に描いた要素をそのまま書き出したもの） */
  glyph: SVGSVGElement | null;
  tint: string;
  username: string;
  title: string | null;
  /** 称号の格。名前を画面と同じレア度の色で描く */
  titleGrade: ItemRarity | null;
  rankNumeral: string;
  rankTitle: string;
  phase: number;
  totalMp: number;
  weekMinutes: number;
  /** 七夜（今週）の科目ごとの時間 */
  radar: SubjectTotal[];
};

/**
 * 称号の名前の色。画面の GRADE_NAME_TONE（titles-dialog.tsx）と同じ色合いを、既定の配色の値で描く。
 * S と SS は光を帯び、SS は金の濃淡で塗る。baseline は文字のベースライン、size は文字の大きさ
 */
function paintTitle(ctx: CanvasRenderingContext2D, grade: ItemRarity, baseline: number, size: number) {
  switch (grade) {
    case "SS": {
      const g = ctx.createLinearGradient(0, baseline - size, 0, baseline + size * 0.2);
      g.addColorStop(0, "#fbf3d4");
      g.addColorStop(0.55, GOLD);
      g.addColorStop(1, "#b89645");
      ctx.fillStyle = g;
      ctx.shadowColor = "rgba(226, 201, 116, 0.6)";
      ctx.shadowBlur = 12;
      break;
    }
    case "S":
      ctx.fillStyle = GOLD;
      ctx.shadowColor = "rgba(226, 201, 116, 0.45)";
      ctx.shadowBlur = 10;
      break;
    case "A":
      ctx.fillStyle = "#a882fb";
      break;
    case "B":
      ctx.fillStyle = "rgba(226, 201, 116, 0.8)";
      break;
    case "C":
      ctx.fillStyle = "#71e2ef";
      break;
  }
}

/** 画面の SVG を、太さを画像の大きさに合わせ直して画像にする（画面では 1px 固定の線） */
async function svgImage(svg: SVGSVGElement, strokeWidth: number) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("color", GOLD);
  // 寸法の無い SVG は 300×150 として読まれるので、正方形の大きさを与える
  clone.setAttribute("width", "240");
  clone.setAttribute("height", "240");
  clone.removeAttribute("class");
  clone.querySelectorAll("[vector-effect]").forEach((el) => {
    el.removeAttribute("vector-effect");
    el.setAttribute("stroke-width", String(strokeWidth));
  });
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
}

/** 紋章: 色味の差す円・金の輪・目盛りと四方の星の後光 */
async function drawAvatar(ctx: CanvasRenderingContext2D, input: ShareCardInput, cx: number, cy: number, r: number) {
  const fill = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, 4, cx, cy, r);
  fill.addColorStop(0, input.tint);
  fill.addColorStop(1, "rgba(10, 15, 30, 0.95)");
  ctx.save();
  ctx.shadowColor = "rgba(226, 201, 116, 0.55)";
  ctx.shadowBlur = 40;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // 上から差す後光
  const glow = ctx.createRadialGradient(cx, cy - r * 0.65, 2, cx, cy - r * 0.65, r * 0.8);
  glow.addColorStop(0, "rgba(255, 236, 170, 0.25)");
  glow.addColorStop(1, "rgba(255, 236, 170, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  const halo = r * 1.2;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, halo, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    if (i % 3 === 0) continue;
    const [x1, y1] = polar(cx, cy, halo - 8, i * 30);
    const [x2, y2] = polar(cx, cy, halo, i * 30);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = GOLD;
  for (const deg of [0, 90, 180, 270]) {
    const [x, y] = polar(cx, cy, halo, deg);
    drawStar(ctx, x, y, deg === 0 ? 13 : 9);
  }

  if (input.glyph) {
    const size = r * 1.16;
    try {
      const img = await svgImage(input.glyph, 0.55);
      ctx.save();
      ctx.shadowColor = "rgba(255, 226, 140, 0.7)";
      ctx.shadowBlur = 14;
      ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
      ctx.restore();
    } catch {}
  }
}

/** 七夜の魔法陣: 科目ごとの時間を、いちばん長い科目を外周として多角形で描く */
function drawRadar(ctx: CanvasRenderingContext2D, totals: SubjectTotal[], serif: string, cx: number, cy: number, r: number) {
  const n = totals.length;
  if (n < 3) return;
  const max = Math.max(1, ...totals.map((t) => t.minutes));
  const angle = (i: number) => (360 / n) * i;

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  for (const k of [1, 0.66, 0.33]) {
    ctx.globalAlpha = k === 1 ? 0.45 : 0.2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const [x, y] = polar(cx, cy, r * k, angle(i));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.globalAlpha = 0.2;
  for (let i = 0; i < n; i++) {
    const [x, y] = polar(cx, cy, r, angle(i));
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const points = totals.map((t, i) => polar(cx, cy, r * Math.max(0.04, t.minutes / max), angle(i)));
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = "rgba(226, 201, 116, 0.22)";
  ctx.fill();
  ctx.save();
  ctx.shadowColor = "rgba(226, 201, 116, 0.8)";
  ctx.shadowBlur = 12;
  ctx.strokeStyle = "#f0dc9a";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  totals.forEach((t, i) => {
    const [x, y] = points[i];
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.textBaseline = "middle";
  totals.forEach((t, i) => {
    const [x, y] = polar(cx, cy, r + 30, angle(i));
    const align = Math.abs(x - cx) < 8 ? "center" : x > cx ? "left" : "right";
    // 名前の長い科目は省かず、文字を小さくして枠の内に収める
    let size = 20;
    do {
      ctx.font = `${size}px ${serif}`;
      size -= 1;
    } while (size >= 12 && ctx.measureText(t.name).width + [...t.name].length * 2 > 150);
    ctx.fillStyle = "rgba(233, 228, 212, 0.85)";
    spacedText(ctx, t.name, align === "right" ? x + 6 : align === "left" ? x - 6 : x, y, 2, align);
  });
  ctx.textBaseline = "alphabetic";
}

export async function renderShareCard(input: ShareCardInput): Promise<Blob> {
  const { canvas, ctx } = createCanvas(W, H);
  const sample = `${input.username}${input.title ?? ""}${input.rankTitle}${input.radar.map((t) => t.name).join("")}秘術探究者七夜の魔法陣今週学んだ時間累積魔力探求度日々の学びは、夜空を彩る星となる。`;
  const serif = await fontFamily("--font-mincho", "serif", sample);
  const display = await fontFamily("--font-cinzel", "serif", "MAHOLOG RANK PHASE MP 0123456789 IVX");

  drawNightSky(ctx, W, H, 110);
  drawFrame(ctx, W, H);

  // 左: 紋章・名前・階級
  const lx = 320;
  await drawAvatar(ctx, input, lx, 205, 82);
  ctx.textBaseline = "alphabetic";
  ctx.font = `22px ${serif}`;
  if (input.title) {
    ctx.save();
    paintTitle(ctx, input.titleGrade ?? "S", 358, 22);
    spacedText(ctx, `【${input.title}】`, lx, 358, 4);
    ctx.restore();
  } else {
    ctx.fillStyle = GOLD;
    spacedText(ctx, "秘術探究者", lx, 358, 4);
  }
  ctx.fillStyle = "#f3eedf";
  ctx.font = `600 46px ${serif}`;
  spacedText(ctx, input.username, lx, 414, 6);
  // 階級名の下に英語の階位を小さく添える
  ctx.fillStyle = "rgba(233, 228, 212, 0.85)";
  ctx.font = `26px ${serif}`;
  spacedText(ctx, input.rankTitle, lx, 460, 6);
  ctx.fillStyle = "rgba(226, 201, 116, 0.7)";
  ctx.font = `16px ${display}`;
  spacedText(ctx, `RANK ${input.rankNumeral}`, lx, 488, 6);

  // 右: 七夜の魔法陣
  const rx = 850;
  ctx.fillStyle = "rgba(233, 228, 212, 0.75)";
  ctx.font = `22px ${serif}`;
  spacedText(ctx, "七夜の魔法陣", rx, 96, 8);
  if (input.radar.length >= 3 && input.weekMinutes > 0) {
    drawRadar(ctx, input.radar, serif, rx, 300, 135);
  } else {
    ctx.fillStyle = "rgba(233, 228, 212, 0.5)";
    ctx.font = `22px ${serif}`;
    spacedText(ctx, "今週の詠唱はこれから", rx, 300, 4);
  }

  // 下: 数字の帯
  ctx.strokeStyle = "rgba(226, 201, 116, 0.3)";
  ctx.beginPath();
  ctx.moveTo(110, 540);
  ctx.lineTo(W - 110, 540);
  ctx.stroke();
  const stats = [
    { label: "今週学んだ時間", value: formatMinutes(input.weekMinutes) },
    { label: "累積魔力", value: `${input.totalMp.toLocaleString()} MP` },
    { label: "探求度", value: `PHASE ${input.phase}` },
  ];
  stats.forEach((s, i) => {
    const x = 250 + i * 350;
    ctx.fillStyle = "rgba(233, 228, 212, 0.6)";
    ctx.font = `18px ${serif}`;
    spacedText(ctx, s.label, x, 574, 4);
    ctx.fillStyle = "#f0dc9a";
    ctx.font = `600 30px ${/[ぁ-んァ-ン一-龥]/.test(s.value) ? serif : display}`;
    spacedText(ctx, s.value, x, 612, 3);
  });

  ctx.fillStyle = GOLD;
  ctx.font = `16px ${display}`;
  spacedText(ctx, "MAHOLOG", W / 2, 72, 10);

  return toPng(canvas);
}
