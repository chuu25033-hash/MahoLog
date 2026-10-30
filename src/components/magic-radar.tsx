"use client";

import { useId } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { TriangleAlert } from "lucide-react";
import type { SubjectTotal } from "@/lib/types";

export const MIN_RADAR_SUBJECTS = 3;

/** 頂点に添える小さな星の輝き */
function SparkleDot({
  cx,
  cy,
  index,
  color,
  highlight,
}: {
  cx?: number;
  cy?: number;
  index: number;
  color: string;
  highlight?: boolean;
}) {
  if (cx === undefined || cy === undefined) return null;
  // 遅延を座標から作ると、描画アニメーションやリサイズで座標が動くたびに明滅の位相が飛んでちかちかするので、
  // 頂点の順番から決めて位相を固定する
  return (
    <g className="glimmer" style={{ animationDelay: `${-index * 0.9}s` }}>
      {/* 今回伸びた頂点: 金の細い光輪を重ねる */}
      {highlight && (
        <>
          <circle cx={cx} cy={cy} r={11} fill="none" stroke="#e2c974" strokeWidth={0.8} opacity={0.7} />
          <circle cx={cx} cy={cy} r={16} fill="none" stroke="#e2c974" strokeWidth={0.5} strokeDasharray="1 3" opacity={0.5} />
        </>
      )}
      <circle cx={cx} cy={cy} r={highlight ? 8 : 6} fill={highlight ? "#e2c974" : color} opacity={highlight ? 0.3 : 0.18} />
      <path
        d={`M ${cx} ${cy - 5} L ${cx + 1} ${cy - 1} L ${cx + 5} ${cy} L ${cx + 1} ${cy + 1} L ${cx} ${cy + 5} L ${cx - 1} ${cy + 1} L ${cx - 5} ${cy} L ${cx - 1} ${cy - 1} Z`}
        fill="#f6f1dc"
      />
      <circle cx={cx} cy={cy} r={1.2} fill="#ffffff" />
    </g>
  );
}

const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ";
/** 背後の図の 1 単位あたりの大きさに対する、チャートの外周の半径。
 * 図は min(幅,高さ) の 84% に 200 単位、チャートの外周は min(幅,高さ) の 33%（outerRadius 66%）なので 0.33 / 0.84 * 200 */
const CHART_R = 78.6;

/** 拡大縮小しても細さを保つ光の線 */
const hairline = { fill: "none", vectorEffect: "non-scaling-stroke" } as const;

/** 真上から時計回りに並ぶ、科目の頂点 */
function vertex(i: number, n: number, r = CHART_R) {
  const rad = ((-90 + (360 * i) / n) * Math.PI) / 180;
  return [Math.round(Math.cos(rad) * r * 100) / 100, Math.round(Math.sin(rad) * r * 100) / 100] as const;
}

/** 頂点どうしを一つ飛ばしに結ぶ星形（5科目なら五芒星）。偶数で一筆に描けないときは二つの多角形を重ねる */
function starPaths(n: number) {
  const step = n >= 5 ? 2 : 1;
  const visited = new Set<number>();
  const paths: string[] = [];
  for (let start = 0; start < n; start++) {
    if (visited.has(start)) continue;
    const pts: string[] = [];
    let i = start;
    do {
      visited.add(i);
      pts.push(vertex(i, n).join(","));
      i = (i + step) % n;
    } while (i !== start);
    paths.push(`M${pts.join("L")}Z`);
  }
  return paths;
}

/**
 * チャート背後の陣: 外周のルーンの帯と刻みの輪（逆向きにゆっくり巡る）、科目の頂点を結ぶ星形と頂点の輪、
 * 中心の印、傾いた天体軌道と星座線、中心からにじむ光
 */
function CelestialBackdrop({ count }: { count: number }) {
  const id = useId().replace(/:/g, "");
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  const runeR = 91;
  return (
    <svg viewBox="-100 -100 200 200" className="absolute h-[min(84cqw,84cqh)] w-[min(84cqw,84cqh)] overflow-visible" aria-hidden>
      <defs>
        <radialGradient id={`aura-${id}`}>
          <stop offset="0%" stopColor="#a882fb" stopOpacity="0.16" />
          <stop offset="45%" stopColor="#71e2ef" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#71e2ef" stopOpacity="0" />
        </radialGradient>
        <path id={`runes-${id}`} d={`M0,${-runeR} A${runeR},${runeR} 0 1,1 -0.01,${-runeR}`} />
      </defs>
      {/* 中心からにじむ光 */}
      <circle r="96" fill={`url(#aura-${id})`} />

      {/* 外周: ルーンの帯（SVG 要素の transform-origin は viewBox 基準なので、中心 (0,0) を明示する） */}
      <g className="animate-spin-slower" style={{ transformBox: "view-box", transformOrigin: "0 0" }}>
        <circle r="98" stroke="#e2c974" strokeOpacity="0.32" strokeWidth="0.5" {...hairline} />
        <circle r="87.5" stroke="#e2c974" strokeOpacity="0.22" strokeWidth="0.4" {...hairline} />
        <text className="glimmer-slow" fill="#e2c974" fillOpacity="0.5" fontSize="5.2">
          <textPath href={`#runes-${id}`} textLength={2 * Math.PI * runeR - 4} lengthAdjust="spacing">
            {RUNES + RUNES}
          </textPath>
        </text>
      </g>
      {/* 刻みの輪: ルーンと逆向きに巡る */}
      <g className="animate-spin-slow" style={{ transformBox: "view-box", transformOrigin: "0 0", animationDirection: "reverse" }}>
        <circle r="95" stroke="#e2c974" strokeOpacity="0.14" strokeWidth="0.4" strokeDasharray="0.6 2.4" {...hairline} />
        {ticks.map((deg) => (
          <line
            key={deg}
            y1={deg % 30 === 0 ? -87.5 : -86}
            y2="-84"
            stroke="#e2c974"
            strokeOpacity={deg % 30 === 0 ? 0.5 : 0.22}
            strokeWidth="0.4"
            transform={`rotate(${deg})`}
          />
        ))}
      </g>

      <g className="glimmer-slow">
        {/* 傾いた天体軌道 */}
        <ellipse rx="86" ry="34" stroke="#71e2ef" strokeOpacity="0.14" strokeWidth="0.4" transform="rotate(-24)" {...hairline} />
        <ellipse rx="86" ry="30" stroke="#a882fb" strokeOpacity="0.14" strokeWidth="0.4" transform="rotate(38)" {...hairline} />
        {/* 星座線 */}
        <polyline points="-78,-30 -60,-52 -38,-60 -30,-80" stroke="#cfe9ff" strokeOpacity="0.22" strokeWidth="0.4" {...hairline} />
        <polyline points="58,52 72,30 84,40 76,62" stroke="#cfe9ff" strokeOpacity="0.22" strokeWidth="0.4" {...hairline} />
        {[
          [-78, -30], [-60, -52], [-38, -60], [-30, -80], [58, 52], [72, 30], [84, 40], [76, 62],
        ].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="0.9" fill="#f4f1e6" opacity="0.8" />
        ))}
      </g>

      {/* 科目の頂点を結ぶ星形と、頂点の小さな輪 */}
      {starPaths(count).map((d) => (
        <path key={d} d={d} stroke="#e2c974" strokeOpacity="0.16" strokeWidth="0.5" {...hairline} />
      ))}
      <circle r={CHART_R} stroke="#e2c974" strokeOpacity="0.12" strokeWidth="0.4" strokeDasharray="1 2" {...hairline} />
      {Array.from({ length: count }, (_, i) => {
        const [x, y] = vertex(i, count);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="3.2" stroke="#e2c974" strokeOpacity="0.35" strokeWidth="0.5" {...hairline} />
            <circle cx={x} cy={y} r="1.8" stroke="#e2c974" strokeOpacity="0.2" strokeWidth="0.4" strokeDasharray="0.6 1" {...hairline} />
          </g>
        );
      })}

      {/* 中心の印 */}
      <g className="animate-spin-slow" style={{ transformBox: "view-box", transformOrigin: "0 0" }}>
        <circle r="13" stroke="#e2c974" strokeOpacity="0.28" strokeWidth="0.4" strokeDasharray="1 2" {...hairline} />
      </g>
      <circle r="7" stroke="#e2c974" strokeOpacity="0.3" strokeWidth="0.5" {...hairline} />
      <path d="M0,-5 L1,-1 L5,0 L1,1 L0,5 L-1,1 L-5,0 L-1,-1 Z" fill="#f6f1dc" fillOpacity="0.35" />
    </svg>
  );
}

/**
 * 有効科目数 N に応じた N 角形の魔法陣レーダーチャート。
 * 値は正規化せず実時間のまま描くので、特化型は大きく突き出た形になる。
 */
export function MagicRadar({
  data,
  highlightSubjectId,
  animationDuration = 900,
}: {
  data: SubjectTotal[];
  highlightSubjectId?: string;
  animationDuration?: number;
}) {
  const gradientId = useId().replace(/:/g, "");

  if (data.length < MIN_RADAR_SUBJECTS) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
        <TriangleAlert className="size-7 text-starlight" strokeWidth={1.25} />
        <p className="tracking-wider">魔法陣の描画には3科目以上の選択が必要です</p>
      </div>
    );
  }

  // 最大科目を外周ちょうどに合わせる。実時間のままだと目盛りが切りの良い値に丸められ、
  // 期間ごとに魔法陣の大きさが変わるので、最大科目を 1 とした比率で描き 4 本の同心多角形を固定で引く
  const maxMinutes = Math.max(60, ...data.map((d) => d.minutes));
  const ringTicks = [0, 0.25, 0.5, 0.75, 1];
  const chartData = data.map((d) => ({ ...d, ratio: d.minutes / maxMinutes }));

  return (
    <div className="relative h-full w-full [&_.recharts-radar-polygon]:[filter:drop-shadow(0_0_6px_rgba(113,226,239,0.45))]">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center [container-type:size]">
        <CelestialBackdrop count={data.length} />
      </div>
      <ResponsiveContainer width="100%" height="100%">
        {/* 眺めるだけの図なので、キーボード操作の層（フォーカスと枠）を持たせない */}
        <RadarChart data={chartData} outerRadius="66%" accessibilityLayer={false}>
          <defs>
            <radialGradient id={`fill-${gradientId}`} cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#a882fb" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#71e2ef" stopOpacity={0.35} />
            </radialGradient>
            <linearGradient id={`stroke-${gradientId}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#71e2ef" />
              <stop offset="100%" stopColor="#a882fb" />
            </linearGradient>
          </defs>
          <PolarGrid gridType="polygon" stroke="#cfe9ff" strokeOpacity={0.14} strokeWidth={0.6} />
          <PolarAngleAxis
            dataKey="name"
            tick={({ x, y, payload, textAnchor }) => {
              const item = chartData.find((d) => d.name === payload.value);
              const active = item?.subjectId === highlightSubjectId;
              return (
                <text
                  x={x}
                  y={y}
                  textAnchor={textAnchor}
                  dominantBaseline="central"
                  fontSize={12}
                  letterSpacing="0.15em"
                  fontWeight={active ? 700 : 400}
                  fill={active ? "#e2c974" : "#c9d3e6"}
                >
                  {payload.value}
                </text>
              );
            }}
          />
          <PolarRadiusAxis domain={[0, 1]} ticks={ringTicks} allowDataOverflow tick={false} axisLine={false} />
          <Radar
            dataKey="ratio"
            stroke={`url(#stroke-${gradientId})`}
            strokeWidth={1}
            fill={`url(#fill-${gradientId})`}
            fillOpacity={0.4}
            dot={(props: { cx?: number; cy?: number; index?: number }) => (
              <SparkleDot
                key={props.index}
                cx={props.cx}
                cy={props.cy}
                index={props.index ?? 0}
                color={chartData[props.index ?? 0]?.color ?? "#71e2ef"}
                highlight={highlightSubjectId !== undefined && chartData[props.index ?? 0]?.subjectId === highlightSubjectId}
              />
            )}
            animationDuration={animationDuration}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
