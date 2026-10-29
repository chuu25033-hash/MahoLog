import { THEME_LABEL, chapterOf } from "@/lib/cycles";
import { cn } from "@/lib/utils";

/** 拡大縮小しても 1px を保つ光の線 */
const hairline = { vectorEffect: "non-scaling-stroke", fill: "none", strokeWidth: 1 } as const;

/** 何重まで描くか（それ以上は最も外の環に周回数を添える） */
const MAX_RINGS = 6;

/**
 * 周回リング: 巡り終えた周天の数だけ、章の色の 1px の環を重ねる。
 * 環ごとに刻みの位置をずらし、ゆっくり逆向きに回して天球儀のように見せる
 */
export function CycleRings({ laps, animate = true, className }: { laps: number; animate?: boolean; className?: string }) {
  const count = Math.min(laps, MAX_RINGS);
  if (count <= 0) return null;
  return (
    <svg viewBox="-50 -50 100 100" className={cn("pointer-events-none overflow-visible", className)} aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const r = 44 + i * 2.5;
        const color = THEME_LABEL[chapterOf(i + 1).theme].swatch;
        return (
          <g
            key={i}
            stroke={color}
            className={animate ? "cycle-ring" : undefined}
            style={{ animationDuration: `${60 + i * 18}s`, animationDirection: i % 2 === 0 ? "normal" : "reverse" }}
          >
            <circle r={r} strokeOpacity={0.55 - i * 0.05} {...hairline} />
            {Array.from({ length: 3 + i }, (_, k) => (
              <circle key={k} cy={-r} r="0.9" fill={color} stroke="none" transform={`rotate(${(k * 360) / (3 + i) + i * 17})`} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
