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
/** 六芒星の交点を結ぶ円の内側に刻む、小さなルーン環の半径（中央の天球儀より外側） */
const INNER_RUNE_RADIUS = 42;

/** 拡大縮小しても 1px 以下を保つ光の線 */
const hairline = { vectorEffect: "non-scaling-stroke", fill: "none" } as const;

/** 魔法陣の頂点（科目ノード）を置く半径 */
const NODE_RADIUS = 80;
/** 頂点に灯す極細の四芒星 ✦（中心 (0, -NODE_RADIUS)） */
const SPARKLE_PATH = `M0,${-NODE_RADIUS - 3.6} L0.6,${-NODE_RADIUS - 0.6} L3.6,${-NODE_RADIUS} L0.6,${-NODE_RADIUS + 0.6} L0,${-NODE_RADIUS + 3.6} L-0.6,${-NODE_RADIUS + 0.6} L-3.6,${-NODE_RADIUS} L-0.6,${-NODE_RADIUS - 0.6} Z`;

export type MagicCircleNode = { color: string; active: boolean };

/** 真上から時計回りに並ぶ正N角形の頂点 */
function polygonPoints(n: number, r = NODE_RADIUS) {
  return Array.from({ length: n }, (_, i) => {
    const rad = ((-90 + (360 * i) / n) * Math.PI) / 180;
    return [Math.cos(rad) * r, Math.sin(rad) * r] as const;
  });
}

/** 天球儀のリング: [rotateX, rotateY, 不透明度] */
const ARMILLARY_RINGS = [
  [0, 0, 0.55],
  [0, 60, 0.4],
  [0, 120, 0.4],
  [66, 20, 0.3],
] as const;

/**
 * タイマー背景の魔法陣。running=false で回転・明滅・粒子・発光が停止する。
 * 線は繊細なアクアの光（スキンで変化）、color（科目色）は中央の天球儀と淡い光に使う。
 * スターライトゴールドの粒子が中央へ集束し、intensity(0〜1) の経過に応じて量と発光が増す。
 * nodes（科目）が3つ以上あれば、六芒星の代わりに科目数 N の正N角形を描き、各頂点に科目色の ✦ を灯す。
 */
export function MagicCircle({
  color,
  running,
  intensity,
  lineColor = "#71e2ef",
  particleColor = "#e2c974",
  nodes,
  className,
}: {
  color: string;
  running: boolean;
  intensity: number;
  lineColor?: string;
  particleColor?: string;
  nodes?: MagicCircleNode[];
  className?: string;
}) {
  const polygon = nodes && nodes.length >= 3 ? nodes : null;
  const visibleParticles = Math.round(6 + intensity * (PARTICLES.length - 6));
  const glow = running ? 0.1 + intensity * 0.25 : 0.04;

  return (
    <div
      className={cn(
        "pointer-events-none relative aspect-square transition-[filter] duration-700",
        !running && "paused-anim brightness-75 saturate-50",
        className,
      )}
      style={{ "--particle-color": particleColor, containerType: "inline-size" } as CSSProperties}
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
          <path id="inner-rune-path" d={`M 0,-${INNER_RUNE_RADIUS} a ${INNER_RUNE_RADIUS},${INNER_RUNE_RADIUS} 0 1,1 -0.01,0`} />
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
        {polygon ? (
          <SubjectPolygon nodes={polygon} lineColor={lineColor} />
        ) : (
          <>
            {/* 六芒星 */}
            <polygon points="0,-80 69.3,40 -69.3,40" stroke={lineColor} strokeOpacity="0.5" strokeWidth="0.7" {...hairline} />
            <polygon points="0,80 69.3,-40 -69.3,-40" stroke={lineColor} strokeOpacity="0.5" strokeWidth="0.7" {...hairline} />
          </>
        )}
        {/* 六芒星の交点を通る円と、その内側のルーン環 */}
        <circle r="46.2" stroke={lineColor} strokeOpacity="0.45" strokeWidth="0.6" {...hairline} />
        <circle r="40.6" stroke={lineColor} strokeOpacity="0.25" strokeWidth="0.6" {...hairline} />
        <text fill={lineColor} fillOpacity="0.6" fontSize="3.6">
          <textPath href="#inner-rune-path" textLength={2 * Math.PI * INNER_RUNE_RADIUS - 3} lengthAdjust="spacing">
            {[...RUNES].reverse().join("")}
          </textPath>
        </text>
        {!polygon && (
          <>
            {/* 頂点の印章: 小さな二重円にルーンを刻み、中心に星を灯す */}
            {[0, 60, 120, 180, 240, 300].map((deg, i) => (
              <g key={deg} transform={`rotate(${deg})`}>
                <circle cy="-80" r="5.5" stroke={lineColor} strokeOpacity="0.5" strokeWidth="0.6" {...hairline} />
                <circle cy="-80" r="4" stroke={lineColor} strokeOpacity="0.25" strokeWidth="0.6" {...hairline} />
                <text y="-84.6" textAnchor="middle" dominantBaseline="central" fill={lineColor} fillOpacity="0.7" fontSize="2.4">
                  {RUNES[i * 4]}
                </text>
                <circle cy="-80" r="1.1" fill="#f4f1e6" className="glimmer" style={{ animationDelay: `${deg / 90}s` }} />
              </g>
            ))}
          </>
        )}
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

      {/* 中央: 科目色の細線で描く天球儀（3D に傾いたリングがゆっくり回る） */}
      <div className="armillary inset-[30%]!" style={{ "--ring-color": color } as CSSProperties}>
        <div className="armillary-gimbal">
          {ARMILLARY_RINGS.map(([x, y, opacity], i) => (
            <div
              key={i}
              className="armillary-ring"
              style={{ transform: `rotateY(${y}deg) rotateX(${x}deg)`, opacity: running ? opacity : opacity * 0.5 }}
            />
          ))}
          <div className="armillary-ring armillary-equator inset-[-6%]!" style={{ opacity: running ? 0.6 : 0.3 }} />
        </div>
        {/* 天球儀の核: 集束した光が溜まっていく */}
        <div
          className="absolute inset-[38%] rounded-full transition-all duration-1000"
          style={{
            background: `radial-gradient(circle, #fff8dc, ${particleColor} 40%, transparent 70%)`,
            opacity: running ? 0.35 + intensity * 0.65 : 0.15,
            transform: `scale(${0.6 + intensity * 0.6})`,
          }}
        />
      </div>

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

/** 科目数 N の正N角形（1px の光線）。5角形以上は一つ飛ばしの星形を淡く重ね、各頂点に ✦ とルーンを置く */
function SubjectPolygon({ nodes, lineColor }: { nodes: MagicCircleNode[]; lineColor: string }) {
  const n = nodes.length;
  const points = polygonPoints(n);
  return (
    <g>
      <polygon
        points={points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")}
        stroke={lineColor}
        strokeOpacity="0.6"
        strokeWidth="1"
        {...hairline}
      />
      {n >= 5 &&
        points.map(([x, y], i) => {
          const [x2, y2] = points[(i + 2) % n];
          return <line key={i} x1={x} y1={y} x2={x2} y2={y2} stroke={lineColor} strokeOpacity="0.3" strokeWidth="1" {...hairline} />;
        })}
      {nodes.map((node, i) => (
        <g key={i} transform={`rotate(${(360 * i) / n})`}>
          <circle cy={-NODE_RADIUS} r="5.5" stroke={node.color} strokeOpacity={node.active ? 0.8 : 0.4} strokeWidth="1" {...hairline} />
          <circle cy={-NODE_RADIUS} r="4" stroke={lineColor} strokeOpacity="0.25" strokeWidth="1" {...hairline} />
          <text
            y={-NODE_RADIUS + 8.2}
            textAnchor="middle"
            dominantBaseline="central"
            fill={node.color}
            fillOpacity={node.active ? 0.9 : 0.55}
            fontSize="2.6"
          >
            {RUNES[(i * 5) % RUNES.length]}
          </text>
          <path
            d={SPARKLE_PATH}
            fill={node.active ? "#fff8dc" : node.color}
            fillOpacity={node.active ? 1 : 0.75}
            style={{ filter: `drop-shadow(0 0 ${node.active ? 2.5 : 1.2}px ${node.color})` }}
          />
        </g>
      ))}
    </g>
  );
}
