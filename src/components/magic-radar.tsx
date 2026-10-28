"use client";

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { TriangleAlert } from "lucide-react";
import type { SubjectTotal } from "@/lib/types";

export const MIN_RADAR_SUBJECTS = 3;

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
  if (data.length < MIN_RADAR_SUBJECTS) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
        <TriangleAlert className="size-8 text-primary" />
        <p>魔法陣の描画には3科目以上の選択が必要です</p>
      </div>
    );
  }

  const max = Math.max(60, ...data.map((d) => d.minutes));
  const chartData = data.map((d) => ({ ...d, hours: d.minutes / 60 }));

  return (
    <div className="relative h-full w-full">
      {/* 魔法陣の装飾リング */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center [container-type:size]" aria-hidden>
        <div className="size-[min(78cqw,78cqh)] animate-spin-slower rounded-full border border-dashed border-primary/30" />
        <div className="absolute size-[min(72cqw,72cqh)] rounded-full border border-primary/20 shadow-[0_0_40px_-10px] shadow-violet-400/40" />
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} outerRadius="70%">
          <PolarGrid gridType="polygon" stroke="oklch(0.82 0.13 85 / 25%)" />
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
                  fontWeight={active ? 800 : 500}
                  fill={item?.color ?? "currentColor"}
                >
                  {payload.value}
                </text>
              );
            }}
          />
          <PolarRadiusAxis domain={[0, max / 60]} tick={false} axisLine={false} />
          <Radar
            dataKey="hours"
            stroke="oklch(0.85 0.14 85)"
            strokeWidth={2}
            fill="oklch(0.7 0.18 300)"
            fillOpacity={0.45}
            dot={{ r: 3, fill: "oklch(0.9 0.12 85)" }}
            animationDuration={animationDuration}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
