"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, Flame, Lock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AREAS, boostLabel, isAreaUnlocked, ORIGIN_AREA, type Area } from "@/lib/areas";
import { formatMinutes, STAGES, type Stage } from "@/lib/game";
import { RARITIES, RARITY_LABEL } from "@/lib/items";
import { userActions } from "@/lib/user-store";
import { cn } from "@/lib/utils";

/** 大ステージごとのマップの雰囲気（背景の深い色・灯の色・粒子の色） */
const STAGE_THEME: Record<number, { deep: string; glow: string; mote: string }> = {
  1: { deep: "#1c1308", glow: "#e8b86a", mote: "#f4d9a0" },
  2: { deep: "#08191f", glow: "#5fbf9f", mote: "#a8e6b8" },
  3: { deep: "#08142c", glow: "#71e2ef", mote: "#8db7f2" },
  4: { deep: "#0a1828", glow: "#a9d6f5", mote: "#e6f4ff" },
  5: { deep: "#1f0b0b", glow: "#f2a38d", mote: "#f2c27a" },
  6: { deep: "#17142b", glow: "#e2c974", mote: "#fbf3d4" },
};

const NODE_GAP = 78;
const RING_GAP = 104;
const PAD = 72;
/** ステージ内の小ステージの左右位置（%）。一本道を緩やかに蛇行させる */
const ZIGZAG = [34, 64, 38, 62];

type MapPoint =
  | { kind: "ring"; stage: Stage; x: number; y: number }
  | { kind: "area"; area: Area; x: number; y: number };

/** 下から上へ積み上げたマップの座標（y は上端からの px） */
function buildLayout() {
  const points: MapPoint[] = [];
  let cursor = PAD;
  for (const stage of STAGES) {
    const areas = AREAS.filter((a) => a.stageId === stage.id);
    if (stage.id === 1) {
      // 原点は大ステージ1の魔法陣の中心に置く
      points.push({ kind: "ring", stage, x: 50, y: cursor });
      points.push({ kind: "area", area: areas[0], x: 50, y: cursor });
      cursor += NODE_GAP;
      areas.slice(1).forEach((area, i) => {
        points.push({ kind: "area", area, x: ZIGZAG[i % ZIGZAG.length], y: cursor });
        cursor += NODE_GAP;
      });
    } else {
      cursor += RING_GAP - NODE_GAP + 16;
      points.push({ kind: "ring", stage, x: 50, y: cursor });
      cursor += RING_GAP;
      areas.forEach((area, i) => {
        points.push({ kind: "area", area, x: ZIGZAG[i % ZIGZAG.length], y: cursor });
        cursor += NODE_GAP;
      });
    }
  }
  const height = cursor - NODE_GAP + PAD;
  return { height, points: points.map((p) => ({ ...p, y: height - p.y })) };
}

const LAYOUT = buildLayout();
/** 一本道で結ぶ順番（原点の魔法陣は原点ノードと同じ位置なので除く） */
const PATH = LAYOUT.points.filter((p) => !(p.kind === "ring" && p.stage.id === 1));

function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const MOTES = Array.from({ length: 22 }, (_, i) => ({
  left: rand(i + 60) * 100,
  top: rand(i + 70) * 100,
  dur: 12 + rand(i + 80) * 14,
  delay: -rand(i + 90) * 26,
  drift: (rand(i + 100) - 0.5) * 70,
  size: 1.2 + rand(i + 110) * 1.6,
}));

const SPARKLE = "M0,-1 Q0.1,-0.1 1,0 Q0.1,0.1 0,1 Q-0.1,0.1 -1,0 Q-0.1,-0.1 0,-1Z";
const DIAMOND = "M0,-1 L0.62,0 L0,1 L-0.62,0Z";

function stageUnlocked(stage: Stage, totalMp: number) {
  return totalMp / 60 >= stage.requiredHours;
}

function pointUnlocked(p: MapPoint, totalMp: number) {
  return p.kind === "ring" ? stageUnlocked(p.stage, totalMp) : isAreaUnlocked(p.area, totalMp);
}

/** 魔導の軌跡: 下から上へ一本道で続く小ステージの縦スクロールマップ */
export function StageMap({ totalMp, currentArea }: { totalMp: number; currentArea: Area }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inspectedId, setInspectedId] = useState(currentArea.id);
  const [activeStage, setActiveStage] = useState(currentArea.stageId);
  const inspected = AREAS.find((a) => a.id === inspectedId) ?? currentArea;

  // 開いた時は現在地を画面中央へ
  useEffect(() => {
    const el = scrollRef.current;
    const p = LAYOUT.points.find((q) => q.kind === "area" && q.area.id === currentArea.id);
    if (el && p) el.scrollTop = p.y - el.clientHeight / 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 画面中央に最も近いノードのステージへ雰囲気を寄せる
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const center = el.scrollTop + el.clientHeight / 2;
        let nearest = LAYOUT.points[0];
        for (const p of LAYOUT.points) if (Math.abs(p.y - center) < Math.abs(nearest.y - center)) nearest = p;
        setActiveStage(nearest.kind === "ring" ? nearest.stage.id : nearest.area.stageId);
      });
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const returnToOrigin = () => {
    setInspectedId(ORIGIN_AREA.id);
    scrollRef.current?.scrollTo({ top: LAYOUT.height, behavior: "smooth" });
  };

  const theme = STAGE_THEME[activeStage];

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#05070c]">
      {/* 大ステージごとの背景を重ね、中央のステージだけを浮かび上がらせる */}
      {STAGES.map((s) => {
        const t = STAGE_THEME[s.id];
        return (
          <div
            key={s.id}
            aria-hidden
            className="pointer-events-none absolute inset-0 transition-opacity duration-[1400ms] ease-out"
            style={{
              opacity: s.id === activeStage ? 1 : 0,
              background: `radial-gradient(60% 45% at 30% 50%, ${t.glow}1f, transparent 70%), radial-gradient(50% 60% at 90% 10%, ${t.glow}12, transparent 70%), linear-gradient(to top, ${t.deep}, #05070c 85%)`,
            }}
          />
        );
      })}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {MOTES.map((m, i) => (
          <span
            key={i}
            className="mote transition-[background-color,box-shadow] duration-[1400ms]"
            style={
              {
                left: `${m.left}%`,
                top: `${m.top}%`,
                width: m.size,
                height: m.size,
                background: theme.mote,
                boxShadow: `0 0 6px ${theme.mote}`,
                animationName: "mote-drift",
                "--dur": `${m.dur}s`,
                "--delay": `${m.delay}s`,
                "--drift": `${m.drift}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      {/* 縦持ちでは地図を全幅にして、詳細は下に重ねる（横にはみ出してスクロールさせない） */}
      <div ref={scrollRef} className="scroll-area scrollbar-none absolute inset-y-0 left-0 right-[15.5rem] overflow-x-hidden portrait:right-0 portrait:bottom-[45%]">
        <div className="relative" style={{ height: LAYOUT.height }}>
          <TrailLines totalMp={totalMp} />
          {LAYOUT.points.map((p) =>
            p.kind === "ring" ? (
              <StageRing key={`ring-${p.stage.id}`} point={p} unlocked={pointUnlocked(p, totalMp)} />
            ) : (
              <AreaNode
                key={p.area.id}
                point={p}
                unlocked={pointUnlocked(p, totalMp)}
                current={p.area.id === currentArea.id}
                inspected={p.area.id === inspected.id}
                onSelect={() => setInspectedId(p.area.id)}
              />
            ),
          )}
        </div>
      </div>

      <Button
        variant="outline"
        size="xs"
        onClick={returnToOrigin}
        className="absolute bottom-3 left-3 border-[#e8b86a]/35 portrait:top-3 portrait:bottom-auto bg-black/30 font-serif tracking-wider backdrop-blur-md hover:border-[#e8b86a]/60"
      >
        <Flame className="candle-flame text-[#f4d9a0]" strokeWidth={1.25} /> 原点へ還る
      </Button>

      <AreaPanel area={inspected} totalMp={totalMp} current={inspected.id === currentArea.id} />
    </div>
  );
}

/** 小ステージを結ぶ 1px の一本道。解放済みの区間だけが発光する */
function TrailLines({ totalMp }: { totalMp: number }) {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 100 ${LAYOUT.height}`}
      preserveAspectRatio="none"
    >
      {PATH.slice(1).map((to, i) => {
        const from = PATH[i];
        const lit = pointUnlocked(to, totalMp);
        return (
          <line
            key={i}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={lit ? "#71e2ef" : "#ffffff"}
            strokeOpacity={lit ? 0.75 : 0.14}
            strokeWidth={1}
            strokeDasharray={lit ? undefined : "2 5"}
            vectorEffect="non-scaling-stroke"
            style={lit ? { filter: "drop-shadow(0 0 3px rgba(113,226,239,0.8))" } : undefined}
          />
        );
      })}
    </svg>
  );
}

/** 大ステージの境界に置く幾何学魔法陣とステージ名 */
function StageRing({ point, unlocked }: { point: Extract<MapPoint, { kind: "ring" }>; unlocked: boolean }) {
  const { stage } = point;
  const color = unlocked ? STAGE_THEME[stage.id].glow : "#ffffff";
  const isOrigin = stage.id === 1;
  return (
    <div className="pointer-events-none absolute" style={{ left: `${point.x}%`, top: point.y }}>
      <svg
        aria-hidden
        viewBox="-50 -50 100 100"
        className="absolute size-[92px] -translate-x-1/2 -translate-y-1/2 animate-spin-slower"
        style={{ opacity: unlocked ? 0.8 : 0.22, filter: unlocked ? `drop-shadow(0 0 4px ${color}80)` : undefined }}
        fill="none"
        stroke={color}
        strokeWidth={0.6}
      >
        <circle r={46} strokeOpacity={0.7} />
        <circle r={41} strokeDasharray="1 3" />
        <circle r={isOrigin ? 22 : 18} strokeOpacity={0.6} />
        <rect x={-29} y={-29} width={58} height={58} transform="rotate(45)" strokeOpacity={0.5} />
        <rect x={-29} y={-29} width={58} height={58} strokeOpacity={0.3} />
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} y1={-46} y2={-43} transform={`rotate(${i * 30})`} />
        ))}
      </svg>
      <div className="absolute right-[54px] w-40 -translate-y-1/2 text-right">
        <p className="font-display text-[10px] tracking-[0.3em] whitespace-nowrap" style={{ color: unlocked ? color : undefined }}>
          STAGE {stage.id}
        </p>
        <p className={cn("text-xs tracking-[0.2em]", !unlocked && "text-muted-foreground")}>{stage.name}</p>
      </div>
      {!unlocked && (
        <p className="absolute left-[54px] flex -translate-y-1/2 items-center gap-1 text-[10px] tracking-wider whitespace-nowrap text-muted-foreground">
          <Lock className="size-3" /> 累計 {stage.requiredHours}時間
        </p>
      )}
    </div>
  );
}

/** 小ステージのノード。現在地は金の四芒星、解放済みは蒼の菱形、未解放は暗い菱形 */
function AreaNode({
  point,
  unlocked,
  current,
  inspected,
  onSelect,
}: {
  point: Extract<MapPoint, { kind: "area" }>;
  unlocked: boolean;
  current: boolean;
  inspected: boolean;
  onSelect: () => void;
}) {
  const { area } = point;
  const origin = area.origin;
  const color = current ? (origin ? "#f4d9a0" : "#e2c974") : unlocked ? (origin ? "#e8b86a" : "#71e2ef") : "#3a4152";
  const labelRight = point.x <= 50;
  return (
    <button
      onClick={onSelect}
      aria-pressed={inspected}
      aria-label={unlocked ? `${area.id} ${area.name}` : `${area.id} 未解放`}
      className="group absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-1 focus-visible:ring-aqua/60"
      style={{ left: `${point.x}%`, top: point.y }}
    >
      {inspected && <span className="absolute inset-0 rounded-full border border-white/40 shadow-[0_0_12px_-2px_rgba(255,255,255,0.35)]" />}
      {current && <span className="absolute inset-1 animate-ping rounded-full opacity-25" style={{ background: color, animationDuration: "2.6s" }} />}
      <svg
        viewBox="-1 -1 2 2"
        className={cn("relative transition-transform duration-300 group-hover:scale-125", current ? "size-6" : "size-4", origin && "candle-flame")}
        style={{ filter: unlocked ? `drop-shadow(0 0 ${current ? 6 : 3}px ${color})` : undefined }}
      >
        {current || origin ? (
          <>
            <path d={SPARKLE} fill={color} />
            <path d={SPARKLE} transform="rotate(45) scale(0.5)" fill={color} opacity={0.7} />
            <path d={SPARKLE} transform="scale(0.3)" fill="#ffffff" opacity={0.85} />
          </>
        ) : unlocked ? (
          <>
            <path d={DIAMOND} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={0.12} />
            <path d={DIAMOND} transform="scale(0.4)" fill={color} />
          </>
        ) : (
          <path d={DIAMOND} fill="#0b0e16" stroke={color} strokeWidth={0.12} />
        )}
      </svg>
      <span
        className={cn(
          "absolute top-1/2 flex -translate-y-1/2 flex-col whitespace-nowrap",
          labelRight ? "left-full ml-1 items-start text-left" : "right-full mr-1 items-end text-right",
        )}
      >
        <span className={cn("font-display text-[10px] tracking-[0.2em]", current ? "text-starlight" : "text-starlight/70")}>
          {area.id}
          {current && " · 滞在中"}
        </span>
        <span className={cn("text-[11px] tracking-wider", unlocked ? "text-foreground/90" : "text-muted-foreground/70")}>
          {/* 縦持ちの狭い地図では、名前が地図の端で切れないよう別名を省く */}
          {unlocked ? (
            <>
              {area.name}
              {area.alias && <span className="portrait:hidden">（{area.alias}）</span>}
            </>
          ) : (
            "？？？"
          )}
        </span>
      </span>
    </button>
  );
}

/** タップした小ステージの詳細（すりガラス） */
function AreaPanel({ area, totalMp, current }: { area: Area; totalMp: number; current: boolean }) {
  const unlocked = isAreaUnlocked(area, totalMp);
  const stage = STAGES.find((s) => s.id === area.stageId)!;
  const none = 100 - RARITIES.reduce((acc, r) => acc + area.drops[r], 0);
  return (
    <div
      key={area.id}
      className="absolute inset-y-2 right-2 flex w-60 animate-in flex-col gap-2 rounded-xl border border-white/15 bg-white/[0.05] p-3 text-xs tracking-wider shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6)] backdrop-blur-xl duration-300 fade-in slide-in-from-right-2 portrait:top-auto portrait:left-2 portrait:h-[calc(45%-0.75rem)] portrait:w-auto portrait:slide-in-from-bottom-2"
    >
      {/* 背が低いときは中身を縮めず、枠の中でスクロールさせる */}
      <div className="scroll-area scrollbar-none -mr-1 flex min-h-0 flex-1 flex-col gap-2 pr-1 [&>*]:shrink-0">
        <p className="font-display text-[10px] tracking-[0.25em] whitespace-nowrap text-starlight/80">
          STAGE {area.id} · {stage.name}
        </p>
        {unlocked ? (
          <>
            <p className="text-base tracking-[0.15em]">{area.name}</p>
            {area.alias && <p className="-mt-1.5 text-[11px] text-muted-foreground">{area.alias}</p>}
            {area.epigraph && <p className="origin-epigraph leading-relaxed tracking-[0.2em] text-starlight/85">{area.epigraph}</p>}
            <p className="leading-relaxed text-muted-foreground [word-break:auto-phrase]">{area.description}</p>
            <div className="border-t border-white/10 pt-2">
              <p className="mb-1 text-muted-foreground">属性魔力ブースト</p>
              <p>
                {boostLabel(area)} <span className="font-display text-aqua">MP ×{area.boost.multiplier}</span>
              </p>
            </div>
            <div className="border-t border-white/10 pt-2">
              <p className="mb-1 text-muted-foreground">流れ星の降る確率</p>
              <ul className="space-y-0.5">
                {RARITIES.map((r) => (
                  <li key={r} className="flex justify-between">
                    <span>
                      <span className="font-display">RARE {r}</span>
                      <span className="ml-1 text-[10px] text-muted-foreground">{RARITY_LABEL[r]}</span>
                    </span>
                    <span className="font-display text-starlight">{area.drops[r]}%</span>
                  </li>
                ))}
                <li className="flex justify-between text-muted-foreground">
                  <span>なし</span>
                  <span className="font-display">{none}%</span>
                </li>
              </ul>
            </div>
          </>
        ) : (
          <>
            <p className="text-base tracking-[0.15em]">？？？</p>
            <p className="leading-relaxed text-muted-foreground">まだ誰の足跡もない、霧の向こうの場所。</p>
            <p className="flex items-center gap-1 border-t border-white/10 pt-2 text-muted-foreground">
              <Lock className="size-3" /> 累計 {area.requiredHours}時間で解放
            </p>
            <p>
              あと<span className="mx-1 text-starlight text-glow-gold">{formatMinutes(area.requiredHours * 60 - totalMp)}</span>
            </p>
          </>
        )}
      </div>
      <Button
        size="sm"
        disabled={!unlocked || current}
        onClick={() => userActions.setCurrentStage(area.id)}
        className="w-full font-serif tracking-wider"
      >
        {current ? (
          <>
            <Check /> 滞在中
          </>
        ) : (
          <>
            <MapPin /> 滞在場所として設定する
          </>
        )}
      </Button>
    </div>
  );
}
