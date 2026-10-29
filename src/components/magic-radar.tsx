"use client";

import { useId } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { TriangleAlert } from "lucide-react";
import type { SubjectTotal } from "@/lib/types";

export const MIN_RADAR_SUBJECTS = 3;

/** 頂点に添える小さな星の輝き */
function SparkleDot({ cx, cy, color, highlight }: { cx?: number; cy?: number; color: string; highlight?: boolean }) {
  if (cx === undefined || cy === undefined) return null;
  return (
    <g className="glimmer" style={{ animationDelay: `${(cx + cy) % 4}s` }}>
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

/** チャート背後の天球図（同心円・星座線・軌道） */
function CelestialBackdrop() {
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  return (
    <svg viewBox="-100 -100 200 200" className="absolute h-[min(84cqw,84cqh)] w-[min(84cqw,84cqh)]" aria-hidden>
      {/* SVG 要素の transform-origin は viewBox 座標基準なので、中心 (0,0) を明示する */}
      <g className="animate-spin-slower" style={{ transformBox: "view-box", transformOrigin: "0 0" }}>
        <circle r="98" fill="none" stroke="#e2c974" strokeOpacity="0.28" strokeWidth="0.5" />
        <circle r="94" fill="none" stroke="#e2c974" strokeOpacity="0.16" strokeWidth="0.4" />
        {ticks.map((deg) => (
          <line
            key={deg}
            x1="0"
            y1={deg % 30 === 0 ? -98 : -96}
            x2="0"
            y2="-94"
            stroke="#e2c974"
            strokeOpacity={deg % 30 === 0 ? 0.45 : 0.2}
            strokeWidth="0.4"
            transform={`rotate(${deg})`}
          />
        ))}
      </g>
      <g className="glimmer-slow">
        {/* 傾いた天体軌道 */}
        <ellipse rx="86" ry="34" fill="none" stroke="#71e2ef" strokeOpacity="0.16" strokeWidth="0.4" transform="rotate(-24)" />
        <ellipse rx="86" ry="30" fill="none" stroke="#a882fb" strokeOpacity="0.16" strokeWidth="0.4" transform="rotate(38)" />
        {/* 星座線 */}
        <polyline
          points="-78,-30 -60,-52 -38,-60 -30,-80"
          fill="none"
          stroke="#cfe9ff"
          strokeOpacity="0.22"
          strokeWidth="0.4"
        />
        <polyline points="58,52 72,30 84,40 76,62" fill="none" stroke="#cfe9ff" strokeOpacity="0.22" strokeWidth="0.4" />
        {[
          [-78, -30], [-60, -52], [-38, -60], [-30, -80], [58, 52], [72, 30], [84, 40], [76, 62],
        ].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="0.9" fill="#f4f1e6" opacity="0.8" />
        ))}
      </g>
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
    <div className="relative h-full w-full">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center [container-type:size]">
        <CelestialBackdrop />
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} outerRadius="66%">
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
