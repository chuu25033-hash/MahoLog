"use client";

import { useState } from "react";
import Link from "next/link";
import { Map, MapPin } from "lucide-react";
import { MpBar } from "@/components/mp-bar";
import { StageMap } from "@/components/stage-map";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { boostLabel, resolveArea, stageOfArea } from "@/lib/areas";
import { chapterOf, cycleLabel, zenithFloor } from "@/lib/cycles";
import { formatMinutes, stageProgress } from "@/lib/game";
import { cycleMp, isZenithOpen, useUserData } from "@/lib/user-store";
import { cn } from "@/lib/utils";

/**
 * ホームのステージ表示 + 滞在エリア（小ステージ）の選択。
 * totalMp は累積MP。ステージの進み具合はこの周天での MP で測る。STAGE 6 を制覇していれば星天の塔へ入れる
 */
export function StageCard({ totalMp, className, ...rest }: { totalMp: number; className?: string; "data-tour"?: string }) {
  const data = useUserData();
  const [open, setOpen] = useState(false);
  const progressMp = cycleMp(data, totalMp);
  const zenithOpen = isZenithOpen(data, totalMp);
  const area = resolveArea(data.userProfile.currentStageId, progressMp, zenithOpen);
  const stage = stageProgress(progressMp);
  const areaStage = stageOfArea(area);
  // 魔導の軌跡（ステージの一本道）では、塔にいるときは最も奥の解放済みエリアを現在地として示す
  const mapArea = area.zenith ? resolveArea(null, progressMp) : area;

  return (
    <Card {...rest} className={cn("gap-2 px-4", className)}>
      {/* 滞在ステージごとの淡い色味 */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br",
          areaStage?.gradient ?? "from-violet-300/14 via-sky-300/[0.05] to-transparent",
        )}
      />
      <div className="relative flex items-center gap-2 font-display text-[11px] tracking-[0.3em] whitespace-nowrap text-starlight/80">
        <Map className="size-3.5 shrink-0 short:hidden" strokeWidth={1.25} />
        <span className="short:tracking-[0.1em]">{area.zenith ? `ZENITH ${zenithFloor(data.zenith.minutes)}F` : `AREA ${area.id}`}</span>
        {data.cycle.count > 1 && (
          <span className="font-serif text-[10px] tracking-wider whitespace-normal text-muted-foreground">
            {cycleLabel(data.cycle.count)}・{chapterOf(data.cycle.count).name}
          </span>
        )}
        <span className="ml-auto flex shrink-0 gap-1">
          {zenithOpen && (
            <Link href="/zenith" className={cn(buttonVariants({ variant: "outline", size: "xs" }), "font-serif tracking-wider")}>
              星天の塔
            </Link>
          )}
          <Button variant="outline" size="xs" className="font-serif tracking-wider" onClick={() => setOpen(true)}>
            <MapPin /> エリア選択
          </Button>
        </span>
      </div>
      <p className="relative text-lg leading-tight tracking-[0.15em]">
        {area.name}
        <span className="ml-2 text-[11px] tracking-wider text-muted-foreground">{area.alias ?? areaStage?.name}</span>
      </p>
      {area.epigraph ? (
        <p className="origin-epigraph relative text-xs leading-relaxed tracking-[0.2em] text-starlight/85 compact:hidden">{area.epigraph}</p>
      ) : (
        <p className="relative text-xs leading-relaxed text-muted-foreground compact:hidden">{area.description}</p>
      )}
      <p className="relative text-[11px] tracking-wider text-muted-foreground short:hidden">
        属性ブースト {boostLabel(area)}
        <span className="ml-1 font-display text-aqua">MP ×{area.boost.multiplier}</span>
      </p>
      {area.zenith ? (
        <p className="relative text-xs tracking-wider text-muted-foreground">
          詠唱した時間で塔を昇る <span className="text-starlight">（10時間で1層）</span>
        </p>
      ) : stage.next ? (
        <div className="relative mt-1 short:mt-0">
          <MpBar ratio={stage.ratio} variant="stage" />
          <p className="mt-1.5 text-xs tracking-wider text-muted-foreground short:mt-1 short:text-[11px]">
            {/* 低い画面では1行に収めるため、ステージ名を省いて残り時間を優先する */}
            次のステージ<span className="short:hidden">「<span className="text-foreground">{stage.next.name}</span>」</span>まで あと
            <span className="mx-1 text-starlight text-glow-gold">{formatMinutes(stage.remainingMinutes)}</span>
          </p>
        </div>
      ) : (
        <p className="relative text-xs text-starlight">この周天の全ステージを制覇</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[calc(100dvh-1rem)] max-h-[44rem] max-w-[min(48rem,calc(100%-2rem))]! flex-col gap-3 rounded-2xl p-4 ring-starlight/25 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="tracking-[0.3em]">エリア選択</DialogTitle>
            <DialogDescription>ノードをタップすると詳細が開きます。歩みは原点から上へと続いていきます。</DialogDescription>
          </DialogHeader>
          <StageMap totalMp={progressMp} currentArea={mapArea} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
