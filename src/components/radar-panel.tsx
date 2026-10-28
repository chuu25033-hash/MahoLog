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
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">魔法陣</h2>
        <div className="flex rounded-lg bg-muted p-0.5 text-xs" role="tablist">
          {RANGES.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={range === r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                "rounded-md px-3 py-1 transition-colors",
                range === r.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <MagicRadar data={current} />
      </div>
      {total > 0 && top && (
        <p className="text-center text-xs text-muted-foreground">
          合計 {formatMinutes(total)} ／ 得意属性: <span style={{ color: top.color }}>{top.name}</span>
        </p>
      )}
    </div>
  );
}
