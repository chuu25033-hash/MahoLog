import { GUIDANCE_CYCLE } from "@/lib/celestial-guidance";
import { cn } from "@/lib/utils";

/** 拡大縮小しても 1px を保つ光の線 */
const hairline = { vectorEffect: "non-scaling-stroke", fill: "none", strokeWidth: 1 } as const;

const GOLD = "#e2c974";
const DIM = "#64748b";
const STAR_R = 78;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

/** 七つの星の位置（真上から時計回り） */
const STARS = Array.from({ length: GUIDANCE_CYCLE }, (_, i) => {
  const angle = (i / GUIDANCE_CYCLE) * Math.PI * 2 - Math.PI / 2;
  return {
    x: Math.cos(angle) * STAR_R,
    y: Math.sin(angle) * STAR_R,
    lx: Math.cos(angle) * 62,
    ly: Math.sin(angle) * 62,
  };
});

/** 七芒星 {7/3}: 3つ飛ばしに結ぶ */
const HEPTAGRAM = Array.from({ length: GUIDANCE_CYCLE }, (_, i) => STARS[(i * 3) % GUIDANCE_CYCLE])
  .map((s) => `${s.x},${s.y}`)
  .join(" ");

/**
 * 七夜の星が並ぶ幾何学的な円盤（星図）。
 * night 夜目の星がスターライトゴールドに明滅し、それまでの星は淡く灯り、星座の線で結ばれる。
 */
export function StarChart({ night, className }: { night: number; className?: string }) {
  const lit = STARS.slice(0, night);

  return (
    <div className={cn("relative", className)} aria-hidden>
      {/* ゆっくり回る外周の目盛り */}
      <svg viewBox="-100 -100 200 200" className="absolute inset-0 size-full animate-spin-slower overflow-visible">
        <circle r="97" stroke={GOLD} strokeOpacity="0.3" {...hairline} />
        <circle r="93" stroke={GOLD} strokeOpacity="0.2" strokeDasharray="0.6 2.4" {...hairline} />
        {Array.from({ length: 72 }, (_, i) => (
          <line
            key={i}
            y1="-93"
            y2={i % 6 === 0 ? -97 : -95}
            stroke={GOLD}
            strokeOpacity={i % 6 === 0 ? 0.55 : 0.25}
            transform={`rotate(${i * 5})`}
            {...hairline}
          />
        ))}
      </svg>

      <svg viewBox="-100 -100 200 200" className="absolute inset-0 size-full overflow-visible">
        {/* 円盤の骨格 */}
        <g stroke="#71e2ef">
          <circle r="86" strokeOpacity="0.18" {...hairline} />
          <circle r={STAR_R} strokeOpacity="0.12" strokeDasharray="2 3" {...hairline} />
          <circle r="54" strokeOpacity="0.14" {...hairline} />
          <circle r="34" strokeOpacity="0.22" {...hairline} />
          {STARS.map((s, i) => (
            <line key={i} x1={s.x * 0.44} y1={s.y * 0.44} x2={s.x * 1.1} y2={s.y * 1.1} strokeOpacity="0.08" {...hairline} />
          ))}
        </g>
        <polygon points={HEPTAGRAM} stroke={GOLD} strokeOpacity="0.14" {...hairline} />
        <polygon points={STARS.map((s) => `${s.x},${s.y}`).join(" ")} stroke={DIM} strokeOpacity="0.3" {...hairline} />

        {/* これまでに辿った星座 */}
        {lit.length > 1 && (
          <polyline
            className="guidance-trace"
            points={lit.map((s) => `${s.x},${s.y}`).join(" ")}
            stroke={GOLD}
            strokeOpacity="0.7"
            pathLength={1}
            {...hairline}
          />
        )}

        {STARS.map((s, i) => {
          const n = i + 1;
          const today = n === night;
          const passed = n < night;
          return (
            <g key={i}>
              <text
                x={s.lx}
                y={s.ly}
                textAnchor="middle"
                dominantBaseline="central"
                className="font-display"
                fontSize="6"
                letterSpacing="0.5"
                fill={today ? "#f6e9bd" : passed ? GOLD : DIM}
                fillOpacity={today ? 1 : passed ? 0.65 : 0.5}
              >
                {ROMAN[i]}
              </text>
              {today ? (
                <g transform={`translate(${s.x} ${s.y})`}>
                  <circle r="9" stroke={GOLD} className="guidance-halo" {...hairline} />
                  <circle r="5.5" stroke={GOLD} strokeOpacity="0.5" {...hairline} />
                  <g className="guidance-star-today" style={{ filter: `drop-shadow(0 0 3px ${GOLD}) drop-shadow(0 0 8px ${GOLD})` }}>
                    <path d="M0,-7 L1.4,-1.4 L7,0 L1.4,1.4 L0,7 L-1.4,1.4 L-7,0 L-1.4,-1.4 Z" fill="#fff4cf" />
                    <circle r="1.6" fill="#ffffff" />
                  </g>
                </g>
              ) : (
                <g transform={`translate(${s.x} ${s.y})`}>
                  <circle r="3.5" stroke={passed ? GOLD : DIM} strokeOpacity={passed ? 0.5 : 0.35} {...hairline} />
                  <circle
                    r={passed ? 1.8 : 1.2}
                    fill={passed ? GOLD : DIM}
                    fillOpacity={passed ? 0.85 : 0.5}
                    style={passed ? { filter: `drop-shadow(0 0 3px ${GOLD})` } : undefined}
                  />
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
