"use client";

import type { CSSProperties } from "react";
import { resolveArea, type AmbienceKind } from "@/lib/areas";
import { activeSkin, useMockState } from "@/lib/mock-store";

// 決定的な疑似乱数（SSR とクライアントで同じ配置にする）
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const MOTES = Array.from({ length: 28 }, (_, i) => ({
  left: rand(i + 10) * 100,
  top: rand(i + 20) * 100,
  dur: 14 + rand(i + 30) * 16,
  delay: -rand(i + 40) * 30,
  drift: (rand(i + 50) - 0.5) * 80,
  colorIndex: i % 2,
}));

/** 粒子の動き方と大きさ */
const KIND_STYLE: Record<AmbienceKind, { animation: string; size: number; blur: number }> = {
  dust: { animation: "mote-drift", size: 1.5, blur: 0 },
  firefly: { animation: "mote-drift", size: 2.5, blur: 1 },
  stardust: { animation: "mote-fall", size: 1.5, blur: 0 },
  snow: { animation: "mote-fall", size: 2, blur: 0.5 },
  ember: { animation: "mote-rise", size: 2, blur: 0.5 },
  halo: { animation: "mote-rise", size: 3, blur: 1.5 },
};

/** 滞在エリアに応じた背景の淡いグラデーションと漂う粒子 */
export function AreaAmbience({ totalMp }: { totalMp: number }) {
  const mock = useMockState();
  const area = resolveArea(mock.areaId, totalMp);
  const skin = activeSkin(mock);
  const [c1, c2] = area.ambience.colors;
  const kind = KIND_STYLE[area.ambience.kind];

  return (
    <div className="pointer-events-none fixed inset-0 -z-[5] overflow-hidden" aria-hidden>
      <div
        key={area.id}
        className="absolute inset-0 animate-in fade-in duration-1000"
        style={{
          background: `radial-gradient(70% 55% at 15% 0%, ${c1}1a, transparent 70%), radial-gradient(60% 50% at 90% 100%, ${c2}14, transparent 70%), radial-gradient(50% 40% at 50% 50%, ${skin.aura}, transparent 75%)`,
        }}
      />
      {MOTES.map((m, i) => {
        const color = area.ambience.colors[m.colorIndex];
        return (
          <span
            key={`${area.id}-${i}`}
            className="mote"
            style={
              {
                left: `${m.left}%`,
                top: `${m.top}%`,
                width: kind.size,
                height: kind.size,
                background: color,
                boxShadow: `0 0 ${4 + kind.blur * 4}px ${color}`,
                animationName: kind.animation,
                "--dur": `${m.dur}s`,
                "--delay": `${m.delay}s`,
                "--drift": `${m.drift}px`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
