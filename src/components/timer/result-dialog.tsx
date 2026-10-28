"use client";

import { useEffect, useState } from "react";
import { Crown, MapPinned, Sparkles } from "lucide-react";
import { MagicRadar } from "@/components/magic-radar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { calcLevel, stageProgress } from "@/lib/game";
import type { Subject, SubjectTotal } from "@/lib/types";

export type StudyResult = {
  id: number;
  subject: Subject;
  savedMinutes: number;
  requestedMinutes: number;
  beforeMp: number;
  afterMp: number;
  beforeTotals: SubjectTotal[];
  afterTotals: SubjectTotal[];
};

/** リザルト（魔力獲得）: MP獲得 → 魔法陣が伸びる → レベルアップ/ステージ解放 */
export function ResultDialog({ result, onClose }: { result: StudyResult; onClose: () => void }) {
  const [radarData, setRadarData] = useState(result.beforeTotals);
  const [showBonus, setShowBonus] = useState(false);

  useEffect(() => {
    const grow = setTimeout(() => setRadarData(result.afterTotals), 600);
    const bonus = setTimeout(() => setShowBonus(true), 1800);
    return () => {
      clearTimeout(grow);
      clearTimeout(bonus);
    };
  }, [result]);

  const beforeLevel = calcLevel(result.beforeMp);
  const afterLevel = calcLevel(result.afterMp);
  const beforeStage = stageProgress(result.beforeMp).current;
  const afterStage = stageProgress(result.afterMp).current;
  const capped = result.savedMinutes < result.requestedMinutes;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl! grid-cols-2 items-center gap-4 rounded-2xl p-6 ring-starlight/25 backdrop-blur-xl sm:max-w-2xl!">
        <div className="flex flex-col items-center gap-2 text-center">
          <DialogTitle className="text-sm font-normal tracking-[0.4em] text-aqua/80">詠唱完了</DialogTitle>
          <p className="animate-float-up font-display text-5xl text-starlight-gradient drop-shadow-[0_0_14px_rgba(226,201,116,0.35)]">
            +{result.savedMinutes} MP
          </p>
          <p className="animate-float-up text-lg tracking-[0.4em] [animation-delay:200ms]">獲得</p>
          <DialogDescription>
            <span className="text-foreground">{result.subject.name}</span> の魔力が高まった
          </DialogDescription>
          {capped && (
            <p className="text-xs text-destructive">本日の上限（12時間）を超えた分は記録されません</p>
          )}

          {showBonus && afterLevel > beforeLevel && (
            <div className="flex animate-in items-center gap-2 rounded-xl border border-starlight/40 bg-starlight/[0.07] px-4 py-2 text-starlight shadow-[0_0_18px_-4px_rgba(226,201,116,0.5)] zoom-in-75 fade-in duration-700">
              <Crown className="size-5" strokeWidth={1.25} />
              <span className="font-display tracking-[0.15em]">LEVEL UP · {beforeLevel} → {afterLevel}</span>
            </div>
          )}
          {showBonus && afterStage.id !== beforeStage.id && (
            <div className="flex animate-in flex-col items-center gap-1 rounded-xl border border-aqua/40 bg-aqua/[0.06] px-4 py-2 text-aqua shadow-[0_0_18px_-4px_rgba(113,226,239,0.5)] slide-in-from-bottom-4 fade-in duration-1000">
              <span className="flex items-center gap-1 text-xs tracking-[0.3em]">
                <MapPinned className="size-4" /> 新エリア解放
              </span>
              <span className="text-lg tracking-[0.2em] text-foreground">「{afterStage.name}」</span>
            </div>
          )}

          <Button className="mt-2" onClick={onClose}>
            <Sparkles /> 閉じる
          </Button>
        </div>

        <div className="aspect-square w-full">
          <MagicRadar data={radarData} highlightSubjectId={result.subject.id} animationDuration={1200} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
