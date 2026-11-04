"use client";

import { useEffect, useRef } from "react";

/**
 * 凍った星脈のオーロラを、canvas に一度だけ描く。本物のように、縦に細く伸びる光の筋を無数に並べ、
 * 緩やかに折れ曲がる幕を幾重にも重ねる。下の縁は鋭く明るい緑で、強く光る折り目には桃色の縁取り、
 * 上へ向かって青緑から紫へ溶けて消える。柔らかく広がる光と、細い光の筋を別々の canvas に描き、
 * それぞれ違う速さで揺らして、重なりがきらめくように見せる（描き直さず、canvas ごと CSS で動かす）
 */

const CURTAINS = [
  { base: 0.46, height: 0.4, phase: 0.3, waves: [1.1, 2.9], amp: 0.08, alpha: 0.85 },
  { base: 0.36, height: 0.32, phase: 2.1, waves: [1.6, 3.7], amp: 0.06, alpha: 0.6 },
  { base: 0.56, height: 0.3, phase: 4.2, waves: [0.8, 2.3], amp: 0.05, alpha: 0.5 },
  { base: 0.28, height: 0.22, phase: 5.6, waves: [2.2, 4.1], amp: 0.04, alpha: 0.35 },
];

function paint(canvas: HTMLCanvasElement, soft: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";
  const step = soft ? Math.max(2, w / 300) : Math.max(1, w / 1100);
  for (const c of CURTAINS) {
    for (let x = 0; x < w; x += step) {
      const t = x / w;
      // 下の縁: 大きなうねりは控えめにし、細かな折れを重ねて不揃いにする（なだらかだと、丘の稜線のように見えてしまう）
      const base = h * (c.base + c.amp * 0.55 * Math.sin(t * Math.PI * 2 * c.waves[0] + c.phase) + c.amp * 0.4 * Math.sin(t * Math.PI * 2 * c.waves[1] + c.phase * 1.7) + c.amp * 0.22 * Math.sin(t * Math.PI * 2 * 9.3 + c.phase * 2.3));
      // 細かな光の筋（高い周波数を重ね、明暗をはっきりさせる）
      const fine = Math.sin(x * 0.41 + c.phase) * Math.sin(x * 0.097 + c.phase * 2) * Math.sin(x * 0.023 + c.phase * 3);
      const ray = soft ? 0.75 : Math.max(0, 0.5 + 0.9 * fine) ** 1.4;
      // 幕の折り目: 折れて重なる所ほど明るく背が高い
      const fold = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * (c.waves[0] + 0.7) + c.phase * 3);
      const height = h * c.height * (0.55 + 0.45 * fold) * (0.85 + 0.15 * ray);
      const a = c.alpha * (soft ? 0.12 : 0.06 + 0.94 * ray) * (0.45 + 0.55 * fold);
      const pink = fold > 0.72 ? (fold - 0.72) * 2.4 : 0;
      if (soft) {
        // 柔らかな光の層は、下の縁も硬くせずに溶かす（縁がくっきりすると、空に波打つ帯が見えてしまう）
        const sg = ctx.createLinearGradient(0, base + h * 0.04, 0, base - height);
        sg.addColorStop(0, "rgba(100,240,175,0)");
        sg.addColorStop(0.12, `rgba(110,240,180,${a * 0.6})`);
        sg.addColorStop(0.4, `rgba(70,210,190,${a * 0.3})`);
        sg.addColorStop(0.75, `rgba(120,130,235,${a * 0.12})`);
        sg.addColorStop(1, "rgba(170,110,235,0)");
        ctx.fillStyle = sg;
        ctx.fillRect(x, base - height, step, height + h * 0.04);
        continue;
      }
      const g = ctx.createLinearGradient(0, base, 0, base - height);
      g.addColorStop(0, `rgba(255,120,200,0)`);
      g.addColorStop(0.012, `rgba(255,130,200,${a * pink})`);
      // 下の縁は、筋の明暗によらずいつも明るく光らせる（縁が暗いと、幕の下端が丘の稜線のように見えてしまう）
      const edge = c.alpha * (0.45 + 0.55 * fold) * 0.75;
      g.addColorStop(0.02, `rgba(190,255,215,${Math.min(1, Math.max(edge, a * 1.3))})`);
      g.addColorStop(0.07, `rgba(130,245,190,${Math.max(edge * 0.45, a * 0.85)})`);
      g.addColorStop(0.16, `rgba(100,240,175,${a * 0.7})`);
      g.addColorStop(0.45, `rgba(70,210,190,${a * 0.26})`);
      g.addColorStop(0.75, `rgba(120,130,235,${a * 0.1})`);
      g.addColorStop(1, "rgba(170,110,235,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x, base - height, step, height + h * 0.006);
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

function AuroraCanvas({ soft, className, blur }: { soft: boolean; className: string; blur: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let frame = 0;
    let timer = 0;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1) * (soft ? 0.5 : 1);
      const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
      if (w === 0 || h === 0 || (canvas.width === w && canvas.height === h)) return;
      canvas.width = w;
      canvas.height = h;
      paint(canvas, soft);
    };
    draw();
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
  }, [soft]);
  return <canvas ref={ref} className={`absolute inset-0 size-full ${className}`} style={{ filter: `blur(${blur}px)` }} aria-hidden />;
}

export function AuroraSky() {
  return (
    <div className="relative size-full">
      <AuroraCanvas soft className="sky-aurora-glow" blur={10} />
      <AuroraCanvas soft={false} className="sky-aurora" blur={0.6} />
    </div>
  );
}
