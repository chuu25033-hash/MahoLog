"use client";

import { useEffect, useState, type Dispatch, type MouseEvent, type SetStateAction } from "react";
import { ChevronRight, Gift, Hourglass, MapPinned, Sparkles } from "lucide-react";
import { ArrowGlyph, RankSigil } from "@/components/arcane-icons";
import { ItemArt, ShootingStar } from "@/components/item-art";
import { MagicRadar } from "@/components/magic-radar";
import { MpBar } from "@/components/mp-bar";
import { RewardLabel, claimable } from "@/components/trials-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EndingPanel, ZenithPanel } from "@/components/cycle/ascension-panels";
import { AREAS, boostLabel, isAreaUnlocked, stageOfArea, type Area } from "@/lib/areas";
import { DROP_SLOT_MINUTES } from "@/lib/drops";
import { CLEAR_MP } from "@/lib/cycles";
import { calcLevel, formatMinutes, levelProgress, rankOf } from "@/lib/game";
import { STARDUST_ORE, type CatalystItem, type Item, type ItemRarity } from "@/lib/items";
import { soundManager } from "@/lib/sound/sound-manager";
import { TASKS } from "@/lib/tasks";
import type { Subject, SubjectTotal } from "@/lib/types";
import { getUserData, userActions, useUserData, type ZenithClimb } from "@/lib/user-store";
import { cn } from "@/lib/utils";

export type StudyResult = {
  id: number;
  subject: Subject;
  subSubject: string | null;
  area: Area;
  savedMinutes: number;
  requestedMinutes: number;
  /** ブースト込みの獲得MP */
  gainedMp: number;
  areaBoost: number;
  /** 所持している秘宝の加護 */
  blessing: number;
  /** 周天の刻印 */
  cycleMark: number;
  catalyst: CatalystItem | null;
  beforeMp: number;
  afterMp: number;
  beforeTotals: SubjectTotal[];
  afterTotals: SubjectTotal[];
  /** 降った流れ星の品（25分ごとに1つ・最大4つ。25分未満は空） */
  drops: { item: Item; isNew: boolean }[];
  /** 流れ星に添えられた星屑の原石の数 */
  ore: number;
  /** 次の詠唱へ持ち越す星の余韻（分） */
  echo: number;
  /** 星天の塔での登頂（塔で詠唱したときだけ） */
  climb: ZenithClimb | null;
  /** この周天を始めた時点の累積MP（エリアの解放はここからの MP で測る） */
  cycleStartMp: number;
};

/** 宝箱演出の段階 */
type ChestStage = "hidden" | "closed" | "open";

const RARITY_TONE = {
  C: "border-aqua/40 text-aqua",
  B: "border-starlight/45 text-starlight",
  A: "border-amethyst/55 text-amethyst",
  S: "border-starlight/70 text-starlight text-glow-gold",
  SS: "border-starlight/80 text-starlight text-glow-gold",
} as const;

/** 詠唱完了後のパネル。成長の物語に沿って 成果 → 探求度 → 魔術階級 → 新たな領域 → 塔の階層 → 周天の終幕 の順に進む */
type Step = "result" | "level" | "rank" | "unlock" | "zenith" | "ending";

/**
 * リザルト: 「次へ」で1枚ずつ切り替える。成果の宝箱も自動では開かず、タップで開けてから先へ進む。成果と試練報酬は必ず、探求度の上昇・魔術階級の昇格・
 * 新たな領域の解放は起きたときだけ挟む。試練報酬で得た MP も成長の判定に含める
 */
export function ResultDialog({ result, subjects, onClose }: { result: StudyResult; subjects: Subject[]; onClose: () => void }) {
  const [claimedMp, setClaimedMp] = useState(0);
  const [index, setIndex] = useState(0);
  const [chest, setChest] = useState<ChestStage>("hidden");

  const beforeMp = result.beforeMp;
  const afterMp = result.afterMp + claimedMp;
  const beforeLevel = calcLevel(beforeMp);
  const afterLevel = calcLevel(afterMp);
  const rankUp = rankOf(afterLevel).numeral !== rankOf(beforeLevel).numeral;
  // エリアの解放と周天の制覇は、この周天での MP で測る
  const beforeCycleMp = beforeMp - result.cycleStartMp;
  const afterCycleMp = afterMp - result.cycleStartMp;
  const unlocked = AREAS.filter((a) => isAreaUnlocked(a, afterCycleMp) && !isAreaUnlocked(a, beforeCycleMp));
  const cleared = beforeCycleMp < CLEAR_MP && afterCycleMp >= CLEAR_MP;
  const ascended = result.climb !== null && result.climb.afterFloor > result.climb.beforeFloor;

  const steps: Step[] = [
    "result",
    ...(afterLevel > beforeLevel ? (["level"] as const) : []),
    ...(rankUp ? (["rank"] as const) : []),
    ...(unlocked.length > 0 ? (["unlock"] as const) : []),
    ...(ascended ? (["zenith"] as const) : []),
    ...(cleared ? (["ending"] as const) : []),
  ];
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;
  // 流れ星に触れるまでは成果の幕に留まる（降らなかった詠唱は待たない）
  const waitingChest = step === "result" && result.drops.length > 0 && chest !== "open";

  /** 画面のどこをタップしても、宝箱の演出を一段進める（ボタンの操作はそれぞれに任せる） */
  function advanceChest(e: MouseEvent) {
    if (!waitingChest || (e.target as HTMLElement).closest("button, a")) return;
    setChest((c) => (c === "hidden" ? "closed" : "open"));
  }

  // 各パネルが開いた瞬間に、その出来事の音を鳴らす
  useEffect(() => {
    if (step === "level") soundManager.playSe("levelUp");
    if (step === "rank") soundManager.playSe("rankUp");
    if (step === "unlock") soundManager.playSe("begin");
    if (step === "zenith") soundManager.playSe("rankUp");
    if (step === "ending") soundManager.playSe("levelUp");
  }, [step]);

  return (
    <Dialog
      open
      onOpenChange={(open, { reason }) => {
        if (open) return;
        // 宝箱を開けるまでは、枠の外をタップしても閉じずに演出を進める（× と Esc では閉じられる）
        if (reason === "outside-press" && waitingChest) {
          setChest((c) => (c === "hidden" ? "closed" : "open"));
          return;
        }
        onClose();
      }}
    >
      <DialogContent
        onClick={advanceChest}
        className={cn(
          "flex max-h-[calc(100dvh-1rem)] flex-col gap-4 scroll-area rounded-2xl p-6 ring-starlight/25 backdrop-blur-xl short:gap-3 short:p-4 max-sm:p-5",
          // 画面幅いっぱいに広がらないよう、狭い画面でも左右に余白を残す
          step === "result" ? "max-w-[min(42rem,calc(100%-2rem))]!" : "max-w-[min(28rem,calc(100%-2rem))]!",
        )}
      >
        <div key={step} className="animate-in fade-in duration-700">
          {step === "result" && <ResultPanel result={result} subjects={subjects} chest={chest} onChestChange={setChest} onClaimed={(mp) => setClaimedMp((v) => v + mp)} />}
          {step === "level" && <LevelPanel beforeLevel={beforeLevel} afterMp={afterMp} />}
          {step === "rank" && <RankPanel level={afterLevel} />}
          {step === "unlock" && <UnlockPanel areas={unlocked} />}
          {step === "zenith" && result.climb && <ZenithPanel climb={result.climb} />}
          {step === "ending" && <EndingPanel totalMp={afterMp} onStay={onClose} />}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-label={`${index + 1} / ${steps.length}`}>
            {steps.length > 1 &&
              steps.map((s, i) => (
                <span
                  key={s}
                  className={cn(
                    "size-1.5 rounded-full transition-all duration-500",
                    i === index ? "bg-starlight shadow-[0_0_6px_rgba(226,201,116,0.8)]" : i < index ? "bg-starlight/40" : "bg-white/15",
                  )}
                />
              ))}
          </div>
          {waitingChest ? (
            <p className="text-[11px] tracking-[0.3em] text-starlight/70 glimmer">タップして進む</p>
          ) : last ? (
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

/** Step 1: 詠唱成果（時間・獲得MP・魔法陣・宝箱）と、達成した試練の報酬受取 */
function ResultPanel({
  result,
  subjects,
  chest,
  onChestChange,
  onClaimed,
}: {
  result: StudyResult;
  subjects: Subject[];
  chest: ChestStage;
  onChestChange: Dispatch<SetStateAction<ChestStage>>;
  onClaimed: (mp: number) => void;
}) {
  const [radarData, setRadarData] = useState(result.beforeTotals);
  const capped = result.savedMinutes < result.requestedMinutes;

  // 魔法陣が育ち、宝箱が現れるまでは見せる。宝箱を開けるのはタップしてから
  useEffect(() => {
    const grow = setTimeout(() => setRadarData(result.afterTotals), 600);
    // 先にタップして進めていたら、その段階を戻さない
    const appear = setTimeout(() => onChestChange((c) => (c === "hidden" ? "closed" : c)), 1600);
    return () => {
      clearTimeout(grow);
      clearTimeout(appear);
    };
  }, [result, onChestChange]);

  return (
    <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
      <div className="flex flex-col items-center gap-2 text-center">
        <DialogTitle className="text-sm font-normal tracking-[0.4em] text-aqua/80">詠唱完了</DialogTitle>
        <p className="flex items-center gap-1.5 text-xs tracking-[0.2em] text-muted-foreground">
          <Hourglass className="size-3.5 text-aqua/80" strokeWidth={1.25} />
          詠唱時間 <span className="text-foreground">{formatMinutes(result.savedMinutes)}</span>
        </p>
        <div className="relative flex flex-col items-center px-6 py-1">
          {/* 獲得の瞬間に広がる光輪 */}
          <span className="burst-ring size-16" />
          <span className="burst-ring size-16 [animation-delay:300ms]" />
          <p className="mp-glow font-display text-5xl text-starlight-gradient short:text-4xl">+{result.gainedMp} MP</p>
          <p className="animate-float-up text-lg tracking-[0.4em] text-glow-gold [animation-delay:200ms]">授かりし魔力</p>
        </div>
        {(result.areaBoost > 1 || result.blessing > 1 || result.catalyst || result.cycleMark > 1) && (
          <p className="animate-in text-[11px] tracking-wider text-muted-foreground fade-in duration-700">
            基礎 {result.savedMinutes}
            {result.areaBoost > 1 && <span className="text-aqua"> × エリア {result.areaBoost}</span>}
            {result.blessing > 1 && <span className="text-amethyst"> × 秘宝の加護 {Number(result.blessing.toFixed(2))}</span>}
            {result.catalyst && <span className="text-starlight"> × {result.catalyst.name} {result.catalyst.multiplier}</span>}
            {result.cycleMark > 1 && <span className="text-amethyst"> × 周天の刻印 {Number(result.cycleMark.toFixed(2))}</span>}
          </p>
        )}
        <DialogDescription>
          <span className="text-foreground">
            {result.subject.name}
            {result.subSubject && (
              <>
                {" "}
                <ArrowGlyph className="text-muted-foreground" /> {result.subSubject}
              </>
            )}
          </span>{" "}
          の魔力が高まった
        </DialogDescription>
        {capped && <p className="text-xs text-destructive">一夜に刻める詠唱は12時間まで。超えた分は星に届きません</p>}

        {result.drops.length === 0 ? (
          <p className="text-[11px] tracking-wider text-muted-foreground [word-break:auto-phrase]">
            流れ星は、{DROP_SLOT_MINUTES}分以上続けた詠唱にだけ降る
          </p>
        ) : (
          chest !== "hidden" && (
            <DropReveal stage={chest} drops={result.drops} ore={result.ore} echo={result.echo} onOpen={() => onChestChange("open")} />
          )
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="mx-auto aspect-square w-full max-w-64 short:max-w-44">
          <MagicRadar data={radarData} highlightSubjectId={result.subject.id} animationDuration={1200} />
        </div>
        <TrialRewards subjects={subjects} onClaimed={onClaimed} />
      </div>
    </div>
  );
}

/** この詠唱で達成した（まだ受け取っていない）試練の報酬を、その場で受け取る */
function TrialRewards({ subjects, onClaimed }: { subjects: Subject[]; onClaimed: (mp: number) => void }) {
  const data = useUserData();
  // 開いた時点で受け取れる試練を覚えておき、受け取った後も一覧に残す（進捗は詠唱の記録時に測り直してある）
  const [defs] = useState(() => {
    const { tasks } = getUserData();
    return TASKS.filter((t) => claimable(tasks[t.scope].items[t.id]));
  });
  const [received, setReceived] = useState<string[]>([]);
  if (defs.length === 0) return null;
  const pending = defs.filter((t) => claimable(data.tasks[t.scope].items[t.id]));

  function claimAll() {
    let mp = 0;
    const items: string[] = [];
    for (const def of pending) {
      const claim = userActions.claimTask(def.id, subjects);
      if (!claim) continue;
      mp += claim.mp;
      if (claim.item) items.push(claim.item.name);
    }
    if (mp === 0 && items.length === 0) return;
    soundManager.playSe("reward");
    setReceived(items);
    onClaimed(mp);
  }

  return (
    <div className="rounded-xl border border-starlight/25 bg-starlight/[0.04] p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs tracking-[0.25em] whitespace-nowrap text-starlight">
        <Gift className="size-3.5 shrink-0" strokeWidth={1.25} />
        試練の達成
      </p>
      <ul className="flex flex-col gap-1.5">
        {defs.map((def) => {
          const claimed = data.tasks[def.scope].items[def.id]?.isClaimed ?? false;
          return (
            <li key={def.id} className={cn("flex items-center gap-2 text-xs tracking-wider", claimed && "opacity-55")}>
              <span className="min-w-0">{def.title}</span>
              <span className="ml-auto shrink-0">
                <RewardLabel def={def} />
              </span>
            </li>
          );
        })}
      </ul>
      {pending.length > 0 ? (
        <Button size="sm" variant="secondary" className="claim-glow mt-2.5 w-full" onClick={claimAll}>
          <Gift /> 報酬をすべて受け取る
        </Button>
      ) : (
        <p className="mt-2 text-center text-[11px] tracking-wider text-aqua/80 [word-break:auto-phrase]">
          報酬を受け取った{received.length > 0 && `（${received.join("・")}）`}
        </p>
      )}
    </div>
  );
}

/** Step 2: 探求度（レベル）の上昇 */
function LevelPanel({ beforeLevel, afterMp }: { beforeLevel: number; afterMp: number }) {
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

/** Step 3: 魔術階級の昇格。1px の光の線が静かに伸び、新たな階級の名を浮かび上がらせる */
function RankPanel({ level }: { level: number }) {
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

/** Step 4: 新たな領域（ステージ・エリア）の解放 */
function UnlockPanel({ areas }: { areas: Area[] }) {
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

/** 鐘の音で告げる格（秘宝・至宝・神話） */
const RARE_DROP = new Set<ItemRarity>(["A", "S", "SS"]);

/** 流れ星が降りて明滅し、触れるとほどけて、降った品（1〜4つ）と星屑の原石が浮かび上がる */
function DropReveal({
  stage,
  drops,
  ore,
  echo,
  onOpen,
}: {
  stage: Exclude<ChestStage, "hidden">;
  drops: StudyResult["drops"];
  ore: number;
  echo: number;
  onOpen: () => void;
}) {
  const opened = stage === "open";
  // 流れ星がほどけた瞬間に、降った品のいちばん高い格で音を分ける（秘宝・至宝が混じれば鐘、常品・稀品だけなら水晶）
  const rare = drops.some((d) => RARE_DROP.has(d.item.rarity));
  useEffect(() => {
    if (opened) soundManager.playSe(rare ? "dropRare" : "dropNormal");
  }, [opened, rare]);
  return (
    <div className="flex w-full animate-in flex-col items-center gap-1 fade-in slide-in-from-bottom-2 duration-700">
      <button
        type="button"
        onClick={onOpen}
        disabled={opened}
        aria-label="流れ星に触れる"
        className={cn("relative transition-all duration-700", opened ? "size-10" : "star-arrive size-20 cursor-pointer short:size-16")}
      >
        <ShootingStar open={opened} className={cn("absolute inset-0 transition-opacity duration-500", opened && "opacity-40")} />
      </button>
      {!opened ? (
        <>
          <p className="text-[11px] tracking-[0.3em] text-starlight/70 glimmer">
            {drops.length > 1 ? `流れ星が${drops.length}つ降りた` : "流れ星が降りた"}…触れて受け取る
          </p>
        </>
      ) : (
        <>
          <ul className={cn("grid w-full gap-2", drops.length === 1 ? "grid-cols-1" : drops.length === 3 ? "grid-cols-3" : "grid-cols-2", drops.length === 4 && "sm:grid-cols-4")}>
            {drops.map((drop, i) => (
              <li
                key={i}
                className="flex animate-in flex-col items-center gap-0.5 text-center fade-in slide-in-from-bottom-4 duration-1000 [animation-fill-mode:both]"
                style={{ animationDelay: `${i * 250}ms` }}
              >
                <ItemArt icon={drop.item.svgIcon} rarity={drop.item.rarity} color={drop.item.color} seed={drop.item.id} className="size-14 short:size-12" />
                <span className={cn("rounded-full border px-2 text-[10px] tracking-[0.2em] whitespace-nowrap", RARITY_TONE[drop.item.rarity])}>
                  RARE {drop.item.rarity}
                  {drops.length === 1 && ` · ${drop.item.type}`}
                </span>
                <span className={cn("tracking-[0.1em] text-foreground [word-break:auto-phrase]", drops.length === 1 ? "text-sm" : "text-xs")}>
                  {drop.item.kind === "fragment" ? drop.item.name : `『${drop.item.name}』`}
                </span>
                <span className="text-[10px] leading-snug text-muted-foreground [word-break:auto-phrase]">{dropNote(drop)}</span>
              </li>
            ))}
          </ul>
          {ore > 0 && (
            <p
              className="mt-1 animate-in text-[11px] tracking-wider text-aqua fade-in duration-1000 [animation-fill-mode:both]"
              style={{ animationDelay: `${drops.length * 250}ms` }}
            >
              {STARDUST_ORE.name} ×{ore} も添えられていた
            </p>
          )}
          {echo > 0 && (
            <p
              className="animate-in text-[10px] tracking-wider text-muted-foreground fade-in duration-1000 [animation-fill-mode:both]"
              style={{ animationDelay: `${drops.length * 250 + 250}ms` }}
            >
              星の余韻 {echo}分は、次の詠唱へ持ち越された
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** 降った品に添える一言 */
function dropNote({ item, isNew }: StudyResult["drops"][number]) {
  switch (item.kind) {
    case "lore":
      return isNew ? "魔導図鑑に新たに記された" : "すでに図鑑に記された品だ";
    case "skin":
      return isNew ? `${item.effect}（図鑑から適用できます）` : "すでに纏える意匠だ";
    case "relic":
      return isNew ? `${item.effect}の加護を得た` : "既に所持している秘宝だ";
    case "fragment":
      return isNew ? "古代文書の断片だ（図鑑の「星脈の記憶」へ）" : "既に持っている断片だ（錬成陣で還元できる）";
    default:
      return item.effect ?? "";
  }
}
