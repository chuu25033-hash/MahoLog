import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

const PARTICLES = Array.from({ length: 24 }, (_, i) => {
  // 決定的な疑似乱数（SSR とクライアントで同じ配置にする）
  const angle = (i * 137.5 * Math.PI) / 180;
  const radius = 32 + ((i * 53) % 18); // コンテナ幅に対する割合(cqi)
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    duration: 2.4 + ((i * 7) % 10) / 5,
    delay: -((i * 0.37) % 3),
  };
});

const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ";
const RUNE_PATH_LENGTH = 2 * Math.PI * 87 - 6; // 継ぎ目で文字が重ならないよう少し短く
const TICKS = Array.from({ length: 120 }, (_, i) => i * 3);

/** 拡大縮小しても 1px 以下を保つ光の線 */
const hairline = { vectorEffect: "non-scaling-stroke", fill: "none" } as const;

/**
 * タイマー背景の魔法陣。running=false で回転・明滅・粒子が停止する。
 * 線は繊細なアクアの光、color（科目色）は粒子と中心の淡い光に使う。
 * intensity(0〜1) は経過に応じた発光の強さ・粒子の量。
 */
export function MagicCircle({
  color,
  running,
  intensity,
  lineColor = "#71e2ef",
  className,
}: {
  color: string;
  running: boolean;
  intensity: number;
  lineColor?: string;
  className?: string;
}) {
  const visibleParticles = Math.round(6 + intensity * (PARTICLES.length - 6));
  const glow = running ? 0.1 + intensity * 0.25 : 0.05;

  return (
    <div
      className={cn("pointer-events-none relative aspect-square", !running && "paused-anim", className)}
      style={{ "--particle-color": color, containerType: "inline-size" } as CSSProperties}
      aria-hidden
    >
      {/* 中心に集まる淡い光 */}
      <div
        className="absolute inset-[20%] rounded-full blur-3xl transition-opacity duration-1000"
        style={{ background: `radial-gradient(circle, ${color}, ${lineColor} 45%, transparent 70%)`, opacity: glow }}
      />

      {/* 外周: 目盛り・ルーン文字 */}
      <svg
        viewBox="-100 -100 200 200"
        className="absolute inset-0 h-full w-full animate-spin-slow"
        style={{ filter: `drop-shadow(0 0 2px ${lineColor}99)` }}
      >
        <defs>
          <path id="rune-path" d="M 0,-87 a 87,87 0 1,1 -0.01,0" />
        </defs>
        <circle r="97" stroke={lineColor} strokeOpacity="0.35" strokeWidth="0.6" {...hairline} />
        <circle r="93" stroke={lineColor} strokeOpacity="0.6" strokeWidth="0.8" {...hairline} />
        {TICKS.map((deg) => (
          <line
            key={deg}
            x1="0"
            y1={deg % 30 === 0 ? -97 : -95}
            x2="0"
            y2="-93"
            stroke={lineColor}
            strokeOpacity={deg % 30 === 0 ? 0.7 : 0.3}
            strokeWidth="0.6"
            transform={`rotate(${deg})`}
            {...hairline}
          />
        ))}
        <text className="glimmer" fill={lineColor} fillOpacity="0.85" fontSize="7">
          {/* 円周（2π×87 ≒ 546.6）に文字間を合わせ、一周を隙間なく埋める */}
          <textPath href="#rune-path" textLength={RUNE_PATH_LENGTH} lengthAdjust="spacing">
            {RUNES + RUNES}
          </textPath>
        </text>
        <circle r="80" stroke={lineColor} strokeOpacity="0.55" strokeWidth="0.8" {...hairline} />
        {/* 六芒星 */}
        <polygon points="0,-80 69.3,40 -69.3,40" stroke={lineColor} strokeOpacity="0.5" strokeWidth="0.7" {...hairline} />
        <polygon points="0,80 69.3,-40 -69.3,-40" stroke={lineColor} strokeOpacity="0.5" strokeWidth="0.7" {...hairline} />
        {/* 頂点の小さな星 */}
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <circle key={deg} cy="-80" r="1.1" fill="#f4f1e6" transform={`rotate(${deg})`} className="glimmer" style={{ animationDelay: `${deg / 90}s` }} />
        ))}
      </svg>

      {/* 内周: 天体軌道（逆回転・明滅） */}
      <svg viewBox="-100 -100 200 200" className="absolute inset-[16%] h-[68%] w-[68%] animate-spin-slower">
        <g className="glimmer-slow">
          <circle r="72" stroke={lineColor} strokeOpacity="0.45" strokeWidth="0.6" strokeDasharray="2 5" {...hairline} />
          <ellipse rx="90" ry="34" stroke="#a882fb" strokeOpacity="0.4" strokeWidth="0.6" transform="rotate(-20)" {...hairline} />
          <ellipse rx="90" ry="34" stroke={lineColor} strokeOpacity="0.35" strokeWidth="0.6" transform="rotate(40)" {...hairline} />
          <ellipse rx="90" ry="34" stroke="#e2c974" strokeOpacity="0.3" strokeWidth="0.6" transform="rotate(100)" {...hairline} />
          <circle cx="84" cy="-12" r="1.6" fill="#f4f1e6" transform="rotate(-20)" />
          <circle cx="-70" cy="22" r="1.2" fill="#cfe9ff" transform="rotate(40)" />
        </g>
        <rect x="-50" y="-50" width="100" height="100" stroke={lineColor} strokeOpacity="0.3" strokeWidth="0.6" {...hairline} />
        <rect x="-50" y="-50" width="100" height="100" stroke={lineColor} strokeOpacity="0.3" strokeWidth="0.6" transform="rotate(45)" {...hairline} />
      </svg>

      {running &&
        PARTICLES.slice(0, visibleParticles).map((p, i) => (
          <span
            key={i}
            className="particle"
            style={
              {
                "--px": `${p.x}cqi`,
                "--py": `${p.y}cqi`,
                "--dur": `${p.duration}s`,
                "--delay": `${p.delay}s`,
              } as CSSProperties
            }
          />
        ))}
    </div>
  );
}
