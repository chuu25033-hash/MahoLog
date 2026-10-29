"use client";

import { useState } from "react";
import { Map, MapPin } from "lucide-react";
import { MpBar } from "@/components/mp-bar";
import { StageMap } from "@/components/stage-map";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { boostLabel, resolveArea } from "@/lib/areas";
import { formatMinutes, STAGES, stageProgress } from "@/lib/game";
import { useUserData } from "@/lib/user-store";
import { cn } from "@/lib/utils";

/** ホームのステージ表示 + 滞在エリア（小ステージ）の選択 */
export function StageCard({ totalMp }: { totalMp: number }) {
  const data = useUserData();
  const [open, setOpen] = useState(false);
  const area = resolveArea(data.userProfile.currentStageId, totalMp);
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
        <DialogContent className="flex h-[calc(100dvh-1rem)] max-h-[44rem] max-w-3xl! flex-col gap-3 rounded-2xl p-4 ring-starlight/25 backdrop-blur-xl sm:max-w-3xl!">
          <DialogHeader>
            <DialogTitle className="tracking-[0.3em]">魔導の軌跡</DialogTitle>
            <DialogDescription>ノードをタップすると詳細が開きます。歩みは原点から上へと続いていきます。</DialogDescription>
          </DialogHeader>
          <StageMap totalMp={totalMp} currentArea={area} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
