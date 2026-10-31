"use client";

// 探求度の上昇・魔術階級の昇格・新たな領域の解放・周天の制覇を告げるパネルと、その順番。
// 詠唱の結果ダイアログ（result-dialog.tsx）と、星の試練で MP を受け取ったときの成長の知らせ（GrowthDialog）で使う
import { useEffect, useState } from "react";
import { ChevronRight, MapPinned, Sparkles } from "lucide-react";
import { RankSigil } from "@/components/arcane-icons";
import { EndingPanel } from "@/components/cycle/ascension-panels";
import { MpBar } from "@/components/mp-bar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AREAS, boostLabel, isAreaUnlocked, stageOfArea, type Area } from "@/lib/areas";
import { CLEAR_MP } from "@/lib/cycles";
import { calcLevel, levelProgress, rankOf } from "@/lib/game";
import { soundManager } from "@/lib/sound/sound-manager";
import { cn } from "@/lib/utils";

export type GrowthStep = "level" | "rank" | "unlock" | "ending";

/** MP が beforeMp から afterMp へ増えたときに起きた成長。エリアの解放と周天の制覇は、この周天での MP（cycleStartMp から）で測る */
export function growthOf(beforeMp: number, afterMp: number, cycleStartMp: number) {
  const beforeLevel = calcLevel(beforeMp);
  const afterLevel = calcLevel(afterMp);
  const rankUp = rankOf(afterLevel).numeral !== rankOf(beforeLevel).numeral;
  const beforeCycleMp = beforeMp - cycleStartMp;
  const afterCycleMp = afterMp - cycleStartMp;
  const unlocked = AREAS.filter((a) => isAreaUnlocked(a, afterCycleMp) && !isAreaUnlocked(a, beforeCycleMp));
  const cleared = beforeCycleMp < CLEAR_MP && afterCycleMp >= CLEAR_MP;
  const steps: GrowthStep[] = [
    ...(afterLevel > beforeLevel ? (["level"] as const) : []),
    ...(rankUp ? (["rank"] as const) : []),
    ...(unlocked.length > 0 ? (["unlock"] as const) : []),
    ...(cleared ? (["ending"] as const) : []),
  ];
  return { beforeLevel, afterLevel, unlocked, steps };
}

/** 成長のパネルが開いた瞬間に、その出来事の音を鳴らす */
export function playGrowthSe(step: string) {
  if (step === "level") soundManager.playSe("levelUp");
  if (step === "rank") soundManager.playSe("rankUp");
  if (step === "unlock") soundManager.playSe("begin");
  if (step === "zenith") soundManager.playSe("rankUp");
  if (step === "ending") soundManager.playSe("levelUp");
}

/** 1枚ずつ切り替える進み具合の点 */
export function StepDots({ count, index }: { count: number; index: number }) {
  return (
    <div className="flex gap-1.5" aria-label={`${index + 1} / ${count}`}>
      {count > 1 &&
        Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className={cn(
              "size-1.5 rounded-full transition-all duration-500",
              i === index ? "bg-starlight shadow-[0_0_6px_rgba(226,201,116,0.8)]" : i < index ? "bg-starlight/40" : "bg-white/15",
            )}
          />
        ))}
    </div>
  );
}

/**
 * 星の試練などで詠唱の外から MP を得て成長したとき、結果ダイアログと同じパネルで告げる。
 * 起きた成長（探求度・階級・領域・周天の制覇）だけを「次へ」で1枚ずつ見せる
 */
export function GrowthDialog({ beforeMp, afterMp, cycleStartMp, onClose }: { beforeMp: number; afterMp: number; cycleStartMp: number; onClose: () => void }) {
  // 開いた時点の成長を固定する（ending から次の周天へ進むと MP の基準が変わるため）
  const [growth] = useState(() => growthOf(beforeMp, afterMp, cycleStartMp));
  const [index, setIndex] = useState(0);
  const { steps } = growth;
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;

  useEffect(() => {
    playGrowthSe(step);
  }, [step]);

  if (!step) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] max-w-[min(28rem,calc(100%-2rem))]! flex-col gap-4 scroll-area rounded-2xl p-6 ring-starlight/25 backdrop-blur-xl short:gap-3 short:p-4 max-sm:p-5">
        <div key={step} className="animate-in fade-in duration-700">
          {step === "level" && <LevelPanel beforeLevel={growth.beforeLevel} afterMp={afterMp} />}
          {step === "rank" && <RankPanel level={growth.afterLevel} />}
          {step === "unlock" && <UnlockPanel areas={growth.unlocked} />}
          {step === "ending" && <EndingPanel totalMp={afterMp} onStay={onClose} />}
        </div>
        <div className="flex items-center justify-between gap-3">
          <StepDots count={steps.length} index={index} />
          {last ? (
            <Button onClick={onClose}>
              <Sparkles /> 閉じる
            </Button>
          ) : (
            <Button onClick={() => setIndex((i) => i + 1)}>
              次へ <ChevronRight />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 探求度（レベル）の上昇 */
export function LevelPanel({ beforeLevel, afterMp }: { beforeLevel: number; afterMp: number }) {
  const progress = levelProgress(afterMp);
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <DialogTitle className="font-display text-xs font-normal tracking-[0.5em] whitespace-nowrap text-starlight/80">
        <span className="-mr-[0.5em]">INSIGHT DEEPENS</span>
      </DialogTitle>
      <div className="relative flex items-center gap-4 py-2 whitespace-nowrap">
        <span className="burst-ring size-20" />
        <span className="font-display text-3xl text-muted-foreground">{beforeLevel}</span>
        <ChevronRight className="size-5 text-starlight/70" strokeWidth={1.25} />
        <span className="mp-glow font-display text-5xl text-starlight-gradient">{progress.level}</span>
      </div>
      <DialogDescription className="tracking-[0.2em]">探求度が高まった</DialogDescription>
      <div className="w-full max-w-64">
        <MpBar ratio={progress.ratio} />
        <p className="mt-1.5 text-[11px] tracking-wider text-muted-foreground">
          次なる感応まで <span className="font-display text-aqua">{progress.remaining}</span>
          <span className="font-display"> MP</span>
        </p>
      </div>
    </div>
  );
}

/** 魔術階級の昇格。1px の光の線が静かに伸び、新たな階級の名を浮かび上がらせる */
export function RankPanel({ level }: { level: number }) {
  const rank = rankOf(level);
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <DialogTitle className="font-display text-xs font-normal tracking-[0.5em] whitespace-nowrap text-starlight/80">
        <span className="-mr-[0.5em]">RANK UP</span>
      </DialogTitle>
      <div className="rank-line w-full" />
      <div className="flex animate-in flex-col items-center gap-2 fade-in slide-in-from-bottom-2 duration-1000 [animation-delay:700ms] [animation-fill-mode:both]">
        <RankSigil numeral={rank.numeral} animate className="size-24 text-starlight drop-shadow-[0_0_6px_rgba(226,201,116,0.5)] short:size-16" />
        <p className="font-display text-sm tracking-[0.4em] whitespace-nowrap text-starlight/80">
          <span className="-mr-[0.4em]">RANK {rank.numeral}</span>
        </p>
        <p className="text-2xl tracking-[0.3em] whitespace-nowrap text-starlight-gradient">
          <span className="-mr-[0.3em]">{rank.title}</span>
        </p>
        <DialogDescription className="tracking-[0.2em]">魔術階級が昇格した</DialogDescription>
      </div>
      <div className="rank-line w-full [animation-delay:300ms]" />
    </div>
  );
}

/** 新たな領域（ステージ・エリア）の解放 */
export function UnlockPanel({ areas }: { areas: Area[] }) {
  // 大ステージの入口が開いたら「新ステージ」、同じステージ内なら「新エリア」
  const newStage = areas.some((a) => a.stageId > 1 && a.id.endsWith("-1"));
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <DialogTitle className="flex items-center gap-1.5 font-display text-xs font-normal tracking-[0.4em] whitespace-nowrap text-aqua/90">
        <MapPinned className="size-4" strokeWidth={1.25} />
        <span className="-mr-[0.4em]">{newStage ? "THE SEAL IS BROKEN" : "A NEW PATH OPENS"}</span>
      </DialogTitle>
      <DialogDescription className="tracking-[0.2em]">
        {newStage ? "封印が解け、奥地への道が開かれた" : "新たな地へ足を踏み入れられる"}
      </DialogDescription>
      <div className="flex w-full flex-col gap-2">
        {areas.map((area) => {
          const stage = stageOfArea(area)!;
          return (
            <div
              key={area.id}
              className="relative overflow-hidden rounded-xl border border-aqua/35 bg-white/[0.03] p-3 text-left shadow-[0_0_18px_-6px_rgba(113,226,239,0.5)]"
            >
              <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", stage.gradient)} />
              <p className="relative font-display text-[10px] tracking-[0.3em] text-starlight/70">
                STAGE {stage.id} · AREA {area.id}
                <span className="ml-2 font-serif tracking-wider text-muted-foreground">{stage.name}</span>
              </p>
              <p className="relative mt-1 text-lg tracking-[0.15em]">{area.name}</p>
              <p className="relative mt-0.5 text-xs leading-relaxed text-muted-foreground [word-break:auto-phrase]">{area.description}</p>
              <p className="relative mt-1.5 text-[11px] tracking-wider text-muted-foreground">
                属性ブースト {boostLabel(area)}
                <span className="ml-1 font-display text-aqua">MP ×{area.boost.multiplier}</span>
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] tracking-wider text-muted-foreground">魔術書庫の「エリア選択」から移り住めます</p>
    </div>
  );
}

