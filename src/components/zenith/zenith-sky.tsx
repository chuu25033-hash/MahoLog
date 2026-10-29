import type { CSSProperties, ReactNode } from "react";

/** 拡大縮小しても 1px を保つ光の線 */
const hairline = { vectorEffect: "non-scaling-stroke", fill: "none", strokeWidth: 1 } as const;

// 決定的な疑似乱数（SSR とクライアントで同じ配置にする）
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const MAX_STARS = 240;
const MAX_BODIES = 14;
const COLORS = ["#a882fb", "#71e2ef", "#e2c974", "#cfe9ff"];

const STARS = Array.from({ length: MAX_STARS }, (_, i) => ({
  left: rand(i + 7000) * 100,
  top: rand(i + 8000) * 100,
  size: rand(i + 9000) > 0.92 ? 2 : 1,
  dur: 3 + rand(i + 9500) * 6,
  delay: -rand(i + 9700) * 9,
}));

type BodyKind = "orbit" | "hexagram" | "rings" | "astrolabe" | "octagon";
const KINDS: BodyKind[] = ["orbit", "hexagram", "rings", "astrolabe", "octagon"];

/** 幾何学天体の配置（viewBox 0 0 160 90 の中）。若い番号ほど低い階層から現れる */
const BODIES = Array.from({ length: MAX_BODIES }, (_, i) => ({
  x: 8 + rand(i + 100) * 144,
  y: 6 + rand(i + 200) * 78,
  r: 4 + rand(i + 300) * (i < 3 ? 14 : 9),
  kind: KINDS[i % KINDS.length],
  color: COLORS[Math.floor(rand(i + 400) * COLORS.length)],
  dur: 90 + rand(i + 500) * 160,
  reverse: rand(i + 600) > 0.5,
}));

function polygon(n: number, r: number, step = 1, offset = -90) {
  return Array.from({ length: n }, (_, i) => {
    const angle = ((offset + ((i * step) % n) * (360 / n)) * Math.PI) / 180;
    return `${(Math.cos(angle) * r).toFixed(2)},${(Math.sin(angle) * r).toFixed(2)}`;
  }).join(" ");
}

function Body({ kind, r }: { kind: BodyKind; r: number }): ReactNode {
  switch (kind) {
    case "orbit":
      return (
        <>
          <circle r={r} {...hairline} />
          <circle r={r * 0.55} strokeDasharray="1 2" {...hairline} />
          <circle cx={r} r={r * 0.08} {...hairline} />
          <circle r={r * 0.12} {...hairline} />
        </>
      );
    case "hexagram":
      return (
        <>
          <circle r={r} {...hairline} />
          <polygon points={polygon(3, r * 0.92)} {...hairline} />
          <polygon points={polygon(3, r * 0.92, 1, 90)} {...hairline} />
        </>
      );
    case "rings":
      return (
        <>
          {[1, 0.78, 0.56].map((k) => (
            <circle key={k} r={r * k} {...hairline} />
          ))}
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} y1={-r} y2={-r * 0.9} transform={`rotate(${i * 30})`} {...hairline} />
          ))}
        </>
      );
    case "astrolabe":
      return (
        <>
          <circle r={r} {...hairline} />
          <ellipse rx={r} ry={r * 0.32} {...hairline} />
          <ellipse rx={r} ry={r * 0.32} transform="rotate(60)" {...hairline} />
          <ellipse rx={r} ry={r * 0.32} transform="rotate(-60)" {...hairline} />
        </>
      );
    case "octagon":
      return (
        <>
          <polygon points={polygon(8, r, 3)} {...hairline} />
          <polygon points={polygon(8, r * 0.62)} {...hairline} />
        </>
      );
  }
}

/**
 * 星天の塔の空。階層が上がるほど星が増えて明るくなり、幾何学の天体が一つずつ現れ、
 * 星雲の光も濃くなっていく（5 層ごとに天体が一つ、およそ 70 層で満ちる）
 */
export function ZenithSky({ floor, className }: { floor: number; className?: string }) {
  const depth = Math.min(1, floor / 70);
  const stars = STARS.slice(0, Math.min(MAX_STARS, 40 + floor * 4));
  const bodies = BODIES.slice(0, Math.min(MAX_BODIES, 2 + Math.floor(floor / 5)));

  return (
    <div className={className} aria-hidden>
      {/* 星雲: 上へ行くほど紫と金の光が濃くなる */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(60% 45% at 50% 0%, rgba(168,130,251,${0.08 + depth * 0.2}), transparent 70%), radial-gradient(45% 40% at 85% 30%, rgba(113,226,239,${0.04 + depth * 0.12}), transparent 70%), radial-gradient(50% 40% at 15% 60%, rgba(226,201,116,${0.02 + depth * 0.1}), transparent 70%)`,
        }}
      />
      {stars.map((s, i) => (
        <span
          key={i}
          className="star"
          style={
            {
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              "--dur": `${s.dur}s`,
              "--delay": `${s.delay}s`,
              "--max": 0.5 + depth * 0.5,
            } as CSSProperties
          }
        />
      ))}
      <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        {bodies.map((b, i) => (
          <g key={i} transform={`translate(${b.x} ${b.y})`} stroke={b.color} strokeOpacity={0.14 + depth * 0.26}>
            <g
              className="zenith-body"
              style={{ "--dur": `${b.dur}s`, animationDirection: b.reverse ? "reverse" : "normal" } as CSSProperties}
            >
              <Body kind={b.kind} r={b.r} />
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}
