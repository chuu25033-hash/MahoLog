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
      <DialogContent className="max-w-2xl! sm:max-w-2xl! grid-cols-2 items-center gap-4 p-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <DialogTitle className="text-sm text-muted-foreground">詠唱完了</DialogTitle>
          <p className="animate-float-up bg-gradient-to-r from-amber-200 via-primary to-fuchsia-300 bg-clip-text text-5xl font-extrabold text-transparent">
            +{result.savedMinutes} MP
          </p>
          <p className="animate-float-up text-lg font-bold [animation-delay:200ms]">獲得！</p>
          <DialogDescription>
            <span style={{ color: result.subject.color }}>{result.subject.name}</span> の魔力が高まった
          </DialogDescription>
          {capped && (
            <p className="text-xs text-destructive">本日の上限（12時間）を超えた分は記録されません</p>
          )}

          {showBonus && afterLevel > beforeLevel && (
            <div className="flex animate-in items-center gap-2 rounded-lg bg-primary/15 px-3 py-2 text-primary zoom-in-50 fade-in duration-500">
              <Crown className="size-5" />
              <span className="font-extrabold">LEVEL UP! Lv.{beforeLevel} → Lv.{afterLevel}</span>
            </div>
          )}
          {showBonus && afterStage.id !== beforeStage.id && (
            <div className="flex animate-in flex-col items-center gap-1 rounded-lg bg-emerald-400/15 px-3 py-2 text-emerald-200 slide-in-from-bottom-4 fade-in duration-700">
              <span className="flex items-center gap-1 text-xs">
                <MapPinned className="size-4" /> 新エリア解放
              </span>
              <span className="text-lg font-extrabold">「{afterStage.name}」</span>
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
