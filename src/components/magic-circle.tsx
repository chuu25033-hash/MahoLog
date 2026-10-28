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

/**
 * タイマー背景の魔法陣。running=false で回転と粒子が停止する。
 * intensity(0〜1) は経過に応じた発光の強さ・粒子の量。
 */
export function MagicCircle({
  color,
  running,
  intensity,
  className,
}: {
  color: string;
  running: boolean;
  intensity: number;
  className?: string;
}) {
  const visibleParticles = Math.round(6 + intensity * (PARTICLES.length - 6));

  return (
    <div
      className={cn("pointer-events-none relative aspect-square", !running && "paused-anim", className)}
      style={{ "--particle-color": color, containerType: "inline-size" } as CSSProperties}
      aria-hidden
    >
      <div
        className="absolute inset-[15%] rounded-full blur-3xl transition-opacity duration-1000"
        style={{ background: color, opacity: running ? 0.15 + intensity * 0.35 : 0.08 }}
      />
      <svg viewBox="-100 -100 200 200" className="absolute inset-0 h-full w-full animate-spin-slow">
        <defs>
          <path id="rune-path" d="M 0,-88 a 88,88 0 1,1 -0.01,0" />
        </defs>
        <circle r="96" fill="none" stroke={color} strokeOpacity="0.5" strokeWidth="0.8" />
        <circle r="80" fill="none" stroke={color} strokeOpacity="0.7" strokeWidth="1.2" />
        <text fill={color} fillOpacity="0.8" fontSize="9" letterSpacing="6">
          <textPath href="#rune-path">{RUNES + RUNES}</textPath>
        </text>
        {/* 六芒星 */}
        <polygon points="0,-78 67.5,39 -67.5,39" fill="none" stroke={color} strokeOpacity="0.6" strokeWidth="1" />
        <polygon points="0,78 67.5,-39 -67.5,-39" fill="none" stroke={color} strokeOpacity="0.6" strokeWidth="1" />
      </svg>
      <svg viewBox="-100 -100 200 200" className="absolute inset-[18%] h-[64%] w-[64%] animate-spin-slower">
        <circle r="70" fill="none" stroke={color} strokeOpacity="0.5" strokeWidth="1" strokeDasharray="4 6" />
        <rect x="-49" y="-49" width="98" height="98" fill="none" stroke={color} strokeOpacity="0.45" strokeWidth="1" />
        <rect x="-49" y="-49" width="98" height="98" fill="none" stroke={color} strokeOpacity="0.45" strokeWidth="1" transform="rotate(45)" />
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
