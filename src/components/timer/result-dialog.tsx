"use client";

import { useEffect, useState } from "react";
import { Crown, MapPinned, Sparkles } from "lucide-react";
import { ItemArt, TreasureChest } from "@/components/item-art";
import { MagicRadar } from "@/components/magic-radar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Area } from "@/lib/areas";
import { calcLevel, stageProgress } from "@/lib/game";
import { RARITY_LABEL, type CatalystItem, type Item } from "@/lib/items";
import type { Subject, SubjectTotal } from "@/lib/types";
import { cn } from "@/lib/utils";

export type StudyResult = {
  id: number;
  subject: Subject;
  area: Area;
  savedMinutes: number;
  requestedMinutes: number;
  /** ブースト込みの獲得MP */
  gainedMp: number;
  areaBoost: number;
  catalyst: CatalystItem | null;
  beforeMp: number;
  afterMp: number;
  beforeTotals: SubjectTotal[];
  afterTotals: SubjectTotal[];
  drop: { item: Item; isNew: boolean } | null;
};

/** 宝箱演出の段階 */
type ChestStage = "hidden" | "closed" | "open";

const RARITY_TONE = {
  C: "border-aqua/40 text-aqua",
  B: "border-starlight/45 text-starlight",
  A: "border-amethyst/55 text-amethyst",
} as const;

/** リザルト（魔力獲得）: MP獲得 → 魔法陣が伸びる → レベルアップ/ステージ解放 → 宝箱 */
export function ResultDialog({ result, onClose }: { result: StudyResult; onClose: () => void }) {
  const [radarData, setRadarData] = useState(result.beforeTotals);
  const [showBonus, setShowBonus] = useState(false);
  const [chest, setChest] = useState<ChestStage>("hidden");

  useEffect(() => {
    const grow = setTimeout(() => setRadarData(result.afterTotals), 600);
    const bonus = setTimeout(() => setShowBonus(true), 1800);
    const appear = setTimeout(() => setChest("closed"), 2400);
    const open = setTimeout(() => setChest("open"), 3800);
    return () => {
      clearTimeout(grow);
      clearTimeout(bonus);
      clearTimeout(appear);
      clearTimeout(open);
    };
  }, [result]);

  const beforeLevel = calcLevel(result.beforeMp);
  const afterLevel = calcLevel(result.afterMp);
  const beforeStage = stageProgress(result.beforeMp).current;
  const afterStage = stageProgress(result.afterMp).current;
  const capped = result.savedMinutes < result.requestedMinutes;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-2xl! grid-cols-2 items-center gap-4 overflow-y-auto rounded-2xl p-6 ring-starlight/25 backdrop-blur-xl short:p-4 sm:max-w-2xl!">
        <div className="flex flex-col items-center gap-2 text-center">
          <DialogTitle className="text-sm font-normal tracking-[0.4em] text-aqua/80">詠唱完了</DialogTitle>
          <div className="relative flex flex-col items-center px-6 py-1">
            {/* 獲得の瞬間に広がる光輪 */}
            <span className="burst-ring size-16" />
            <span className="burst-ring size-16 [animation-delay:300ms]" />
            <p className="mp-glow font-display text-5xl text-starlight-gradient">+{result.gainedMp} MP</p>
            <p className="animate-float-up text-lg tracking-[0.4em] text-glow-gold [animation-delay:200ms]">獲得！</p>
          </div>
          {(result.areaBoost > 1 || result.catalyst) && (
            <p className="animate-in text-[11px] tracking-wider text-muted-foreground fade-in duration-700">
              基礎 {result.savedMinutes}
              {result.areaBoost > 1 && <span className="text-aqua"> × エリア {result.areaBoost}</span>}
              {result.catalyst && <span className="text-starlight"> × {result.catalyst.name} {result.catalyst.multiplier}</span>}
            </p>
          )}
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

          {chest !== "hidden" && (
            <DropReveal stage={chest} drop={result.drop} area={result.area} onOpen={() => setChest("open")} />
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

/** 宝箱が揺れて開き、ドロップしたアイテムが浮かび上がる */
function DropReveal({
  stage,
  drop,
  area,
  onOpen,
}: {
  stage: Exclude<ChestStage, "hidden">;
  drop: StudyResult["drop"];
  area: Area;
  onOpen: () => void;
}) {
  const opened = stage === "open";
  return (
    <div className="flex w-full animate-in flex-col items-center gap-1 fade-in slide-in-from-bottom-2 duration-700">
      <button
        type="button"
        onClick={onOpen}
        disabled={opened}
        aria-label="宝箱を開ける"
        className={cn("relative size-20 short:size-16", !opened && "chest-shake cursor-pointer")}
      >
        <TreasureChest open={opened} className={cn("absolute inset-0 transition-opacity duration-500", opened && drop && "opacity-25")} />
        {opened && drop && (
          <ItemArt
            glyph={drop.item.glyph}
            rarity={drop.item.rarity}
            color={drop.item.color}
            seed={drop.item.id}
            className="absolute inset-0 animate-in zoom-in-50 fade-in slide-in-from-bottom-6 duration-1000"
          />
        )}
      </button>
      {!opened && <p className="text-[11px] tracking-[0.3em] text-starlight/70 glimmer">宝箱を見つけた…</p>}
      {opened &&
        (drop ? (
          <div className="flex animate-in flex-col items-center gap-0.5 fade-in duration-1000">
            <span className={cn("rounded-full border px-2 text-[10px] tracking-[0.2em]", RARITY_TONE[drop.item.rarity])}>
              RARE {drop.item.rarity} · {RARITY_LABEL[drop.item.rarity]}
            </span>
            <span className="text-sm tracking-[0.15em] text-foreground">『{drop.item.name}』</span>
            <span className="text-[11px] text-muted-foreground">
              {drop.item.kind === "lore"
                ? drop.isNew
                  ? "図鑑に新しく登録された"
                  : "図鑑に登録済みの品だ"
                : drop.item.kind === "skin"
                  ? drop.isNew
                    ? `${drop.item.effect}（図鑑から適用できます）`
                    : "既に所持しているスキンだ"
                  : drop.item.effect}
            </span>
          </div>
        ) : (
          <p className="text-[11px] tracking-wider text-muted-foreground">
            宝箱は空だった…（{area.name}を探索し続けよう）
          </p>
        ))}
    </div>
  );
}
