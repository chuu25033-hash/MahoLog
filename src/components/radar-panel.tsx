"use client";

import { useState } from "react";
import { formatMinutes } from "@/lib/game";
import type { SubjectTotal } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MagicRadar } from "./magic-radar";

const RANGES = [
  { key: "week", label: "1週間" },
  { key: "month", label: "1か月" },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

export function RadarPanel({ data }: { data: Record<RangeKey, SubjectTotal[]> }) {
  const [range, setRange] = useState<RangeKey>("week");
  const current = data[range];
  const top = [...current].sort((a, b) => b.minutes - a.minutes)[0];
  const total = current.reduce((acc, d) => acc + d.minutes, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex flex-col leading-tight tracking-[0.2em] whitespace-nowrap">
          魔法陣
          <span className="font-display text-[9px] tracking-[0.25em] text-starlight/70">ARCANE CIRCLE</span>
        </h2>
        <div className="flex rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-xs" role="tablist">
          {RANGES.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={range === r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                "rounded-full px-3 py-1 tracking-wider whitespace-nowrap transition-all duration-300",
                range === r.key
                  ? "bg-starlight/10 text-starlight ring-1 ring-starlight/45 shadow-[0_0_10px_-2px_rgba(226,201,116,0.4)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <MagicRadar data={current} />
        </div>
      </div>
      {/* 期間で文字数や表示有無が変わってもチャートの大きさが揃うよう、常に1行分の高さを確保する */}
      <p className="min-h-4 text-center text-xs leading-4 tracking-wider text-muted-foreground">
        {total > 0 && top && (
          <>
            合計 {formatMinutes(total)} ／ 得意属性 <span className="text-starlight">{top.name}</span>
          </>
        )}
      </p>
    </div>
  );
}
