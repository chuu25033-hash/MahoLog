"use client";

import { useState } from "react";
import { Check, Flame, Lock, Map, MapPin } from "lucide-react";
import { MpBar } from "@/components/mp-bar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { areasOfStage, boostLabel, isAreaUnlocked, ORIGIN_AREA, resolveArea, type Area } from "@/lib/areas";
import { formatMinutes, STAGES, stageProgress } from "@/lib/game";
import { RARITY_LABEL } from "@/lib/items";
import { mockActions, useMockState } from "@/lib/mock-store";
import { cn } from "@/lib/utils";

/** ホームのステージ表示 + 滞在エリア（小ステージ）の選択 */
export function StageCard({ totalMp }: { totalMp: number }) {
  const mock = useMockState();
  const [open, setOpen] = useState(false);
  const area = resolveArea(mock.areaId, totalMp);
  const stage = stageProgress(totalMp);
  const areaStage = STAGES.find((s) => s.id === area.stageId)!;

  return (
    <Card className="gap-2 px-4">
      {/* 滞在ステージごとの淡い色味 */}
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", areaStage.gradient)} />
      <div className="relative flex items-center gap-2 font-display text-[11px] tracking-[0.3em] text-starlight/80">
        <Map className="size-3.5" strokeWidth={1.25} />
        AREA {area.id}
        <Button variant="outline" size="xs" className="ml-auto font-serif tracking-wider" onClick={() => setOpen(true)}>
          <MapPin /> エリア選択
        </Button>
      </div>
      <p className="relative truncate text-lg leading-tight tracking-[0.15em] whitespace-nowrap">
        {area.name}
        <span className="ml-2 text-[11px] tracking-wider text-muted-foreground">{area.alias ?? areaStage.name}</span>
      </p>
      {area.epigraph ? (
        <p className="origin-epigraph relative text-xs leading-relaxed tracking-[0.2em] text-starlight/85">{area.epigraph}</p>
      ) : (
        <p className="relative text-xs leading-relaxed text-muted-foreground short:hidden">{area.description}</p>
      )}
      <p className="relative text-[11px] tracking-wider text-muted-foreground">
        属性ブースト {boostLabel(area)}
        <span className="ml-1 font-display text-aqua">MP ×{area.boost.multiplier}</span>
      </p>
      {stage.next ? (
        <div className="relative mt-1">
          <MpBar ratio={stage.ratio} variant="stage" />
          <p className="mt-1.5 text-xs tracking-wider text-muted-foreground">
            次のステージ「<span className="text-foreground">{stage.next.name}</span>」まで あと
            <span className="mx-1 text-starlight text-glow-gold">{formatMinutes(stage.remainingMinutes)}</span>
          </p>
        </div>
      ) : (
        <p className="relative text-xs text-starlight">全ステージ制覇</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-3xl! gap-3 scroll-area rounded-2xl p-5 ring-starlight/25 backdrop-blur-xl sm:max-w-3xl!">
          <DialogHeader>
            <DialogTitle className="tracking-[0.3em]">滞在エリアの選択</DialogTitle>
            <DialogDescription>
              解放済みのエリアをタップすると滞在場所になります。エリアごとに属性ブーストと宝箱の中身が変わります。
            </DialogDescription>
          </DialogHeader>
          <OriginButton selected={area.id === ORIGIN_AREA.id} />
          <div className="grid grid-cols-[1fr_15rem] gap-4">
            <ol className="flex flex-col gap-2">
              {STAGES.map((s) => {
                const stageLocked = totalMp / 60 < s.requiredHours;
                return (
                  <li key={s.id} className={cn("rounded-xl border border-white/10 bg-white/[0.02] p-2", stageLocked && "opacity-45")}>
                    <p className="mb-1.5 flex items-center gap-2 text-xs tracking-[0.2em]">
                      <span className="font-display text-[10px] text-starlight/80">STAGE {s.id}</span>
                      {s.name}
                      {stageLocked && (
                        <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Lock className="size-3" /> 累計 {s.requiredHours}時間で解放
                        </span>
                      )}
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {areasOfStage(s.id).map((a) => (
                        <AreaButton key={a.id} area={a} unlocked={isAreaUnlocked(a, totalMp)} selected={a.id === area.id} />
                      ))}
                    </div>
                  </li>
                );
              })}
            </ol>
            <AreaDetail area={area} />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AreaButton({ area, unlocked, selected }: { area: Area; unlocked: boolean; selected: boolean }) {
  return (
    <button
      disabled={!unlocked}
      onClick={() => mockActions.setArea(area.id)}
      title={unlocked ? area.description : `累計 ${area.requiredHours}時間で解放`}
      className={cn(
        "flex flex-col items-start rounded-lg border px-2 py-1 text-left transition-all duration-300 disabled:cursor-not-allowed",
        selected
          ? "border-starlight/55 bg-starlight/[0.08] shadow-[0_0_12px_-3px_rgba(226,201,116,0.5)]"
          : unlocked
            ? "border-white/10 hover:border-white/30 hover:bg-white/[0.04]"
            : "border-white/5 opacity-50",
      )}
    >
      <span className="flex w-full items-center gap-1 font-display text-[10px] text-starlight/80">
        {area.id}
        {selected && <Check className="ml-auto size-3 text-starlight" />}
        {!unlocked && <Lock className="ml-auto size-3 text-muted-foreground" />}
      </span>
      <span className="w-full truncate text-[11px] tracking-wider">{unlocked ? area.name : "？？？"}</span>
    </button>
  );
}

/** 原点「灯火の机（はじまりの小屋）」へのワンタップ帰還。進行度に関わらず常に選べる */
function OriginButton({ selected }: { selected: boolean }) {
  return (
    <button
      onClick={() => mockActions.setArea(ORIGIN_AREA.id)}
      aria-pressed={selected}
      className={cn(
        "group flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all duration-500",
        selected
          ? "border-[#e8b86a]/50 bg-[#e8b86a]/[0.08] shadow-[0_0_18px_-6px_rgba(232,184,106,0.6)]"
          : "border-white/10 bg-white/[0.02] hover:border-[#e8b86a]/40 hover:bg-[#e8b86a]/[0.05]",
      )}
    >
      <Flame className="candle-flame size-4 shrink-0 text-[#f4d9a0]" strokeWidth={1.25} />
      <span className="min-w-0">
        <span className="flex items-baseline gap-2 whitespace-nowrap">
          <span className="font-display text-[10px] tracking-[0.25em] text-starlight/80">ORIGIN {ORIGIN_AREA.id}</span>
          <span className="truncate text-sm tracking-[0.15em]">
            {ORIGIN_AREA.name}（{ORIGIN_AREA.alias}）
          </span>
        </span>
        <span className="block truncate text-[11px] tracking-[0.2em] text-muted-foreground">原点の記憶 — {ORIGIN_AREA.epigraph}</span>
      </span>
      <span className="ml-auto shrink-0 text-[11px] tracking-[0.2em] whitespace-nowrap text-starlight/80">
        {selected ? <Check className="size-3.5" /> : "原点へ還る"}
      </span>
    </button>
  );
}

/** 選択中エリアの滞在効果（ブースト・ドロップ率） */
function AreaDetail({ area }: { area: Area }) {
  const none = 100 - area.drops.A - area.drops.B - area.drops.C;
  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-white/10 p-3 text-xs tracking-wider"
      style={{ background: `linear-gradient(160deg, ${area.ambience.colors[0]}14, transparent 60%)` }}
    >
      <p className="font-display text-[10px] text-starlight/80">AREA {area.id}</p>
      <p className="text-base tracking-[0.15em]">{area.name}</p>
      {area.alias && <p className="-mt-1.5 text-[11px] text-muted-foreground">{area.alias}</p>}
      {area.epigraph && <p className="origin-epigraph leading-relaxed tracking-[0.2em] text-starlight/85">{area.epigraph}</p>}
      <p className="leading-relaxed text-muted-foreground">{area.description}</p>
      <div className="border-t border-white/10 pt-2">
        <p className="mb-1 text-muted-foreground">属性魔力ブースト</p>
        <p>
          {boostLabel(area)} <span className="font-display text-aqua">MP ×{area.boost.multiplier}</span>
        </p>
      </div>
      <div className="border-t border-white/10 pt-2">
        <p className="mb-1 text-muted-foreground">宝箱のドロップ率</p>
        <ul className="space-y-0.5">
          {(["A", "B", "C"] as const).map((r) => (
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
    </div>
  );
}
