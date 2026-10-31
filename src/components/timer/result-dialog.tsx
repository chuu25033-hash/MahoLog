"use client";

import { useEffect, useRef, useState, type Dispatch, type MouseEvent, type SetStateAction } from "react";
import { ChevronRight, Gift, Hourglass, Sparkles } from "lucide-react";
import { ArrowGlyph } from "@/components/arcane-icons";
import { ItemArt, ShootingStar } from "@/components/item-art";
import { MagicRadar } from "@/components/magic-radar";
import { RewardLabel, claimable } from "@/components/trials-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EndingPanel, ZenithPanel } from "@/components/cycle/ascension-panels";
import { LevelPanel, RankPanel, StepDots, UnlockPanel, growthOf, playGrowthSe } from "@/components/growth-panels";
import type { Area } from "@/lib/areas";
import { DROP_SLOT_MINUTES } from "@/lib/drops";
import { formatMinutes } from "@/lib/game";
import { STARDUST_ORE, type CatalystItem, type Item, type ItemRarity } from "@/lib/items";
import type { MeteorShower } from "@/lib/reward";
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
  /** 流星群の接近による特別観測（30分未満は null） */
  meteor: MeteorShower | null;
  /** この詠唱を含めた星脈との同調数 */
  combo: number;
  /** 同調による魔力の倍率 */
  comboMp: number;
  /** 同調による稀品以上の確率の倍率 */
  comboDrop: number;
  /** 「星脈の調律師」に届く同調か */
  comboTitle: boolean;
  /** 星天の塔での登頂（塔で詠唱したときだけ） */
  climb: ZenithClimb | null;
  /** この周天を始めた時点の累積MP（エリアの解放はここからの MP で測る） */
  cycleStartMp: number;
};

/** 魔力の演出の段階: 数え上げ → 魔法陣へ吸い込まれる → 星脈が満ちた */
type MannaPhase = "charge" | "absorb" | "filled";

/** 結果を開いてからの魔力の演出の時刻（ミリ秒）。詠唱完了の音と重ならないよう、少し間を置いて数え始める */
const TIMELINE = { countAt: 350, countMs: 1100, absorbAt: 1650, filledAt: 2650, meteorAt: 3200 } as const;

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 0 から target まで、始めは速く終わりはゆっくり数え上げる（動きを減らす設定では一度に出す） */
function useCountUp(target: number, running: boolean, duration: number) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!running) return;
    if (reducedMotion() || target <= 0) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, running, duration]);
  return value;
}

/**
 * 数え上がる MP。数え上げの間に結果パネル全体（魔法陣）を毎フレーム描き直すと科目の文字がちらつくので、数字だけをここで描き直す。
 * 最後の値の幅を見えない文字で先に取っておき、桁が増えても幅が揺れないようにする
 */
function CountUpMp({ target, running }: { target: number; running: boolean }) {
  const value = useCountUp(target, running, TIMELINE.countMs);
  return (
    <span className="inline-grid">
      <span className="invisible [grid-area:1/1]">+{target} MP</span>
      <span className="[grid-area:1/1]">+{value} MP</span>
    </span>
  );
}

/** 吸い込まれる光の粒子の数 */
const MANNA_PARTICLES = 16;

/**
 * 魔力の数字から光の粒子をこぼし、ゆるい弧を描いて魔法陣の中心へ吸い込ませる。
 * 位置は root（結果パネル）基準で測るので、横並び・縦並び（スマホ）のどちらの配置でも陣へ向かう。動きを減らす設定では描かない
 */
function launchManna(root: HTMLElement, from: HTMLElement, to: HTMLElement) {
  if (reducedMotion() || typeof root.animate !== "function") return;
  const base = root.getBoundingClientRect();
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const sx = a.left + a.width / 2 - base.left;
  const sy = a.top + a.height / 2 - base.top;
  const tx = b.left + b.width / 2 - base.left;
  const ty = b.top + b.height / 2 - base.top;
  // 進む向きに垂直な向き（弧のふくらみに使う）
  const len = Math.hypot(tx - sx, ty - sy) || 1;
  const nx = -(ty - sy) / len;
  const ny = (tx - sx) / len;
  for (let i = 0; i < MANNA_PARTICLES; i++) {
    const dot = document.createElement("span");
    const size = 2 + Math.random() * 3;
    const gold = i % 3 !== 0;
    dot.className = "manna-particle";
    dot.style.width = dot.style.height = `${size}px`;
    dot.style.background = gold ? "#f6f1dc" : "#cfe9ff";
    dot.style.boxShadow = gold ? "0 0 8px 1px rgba(226,201,116,0.75)" : "0 0 8px 1px rgba(113,226,239,0.7)";
    root.appendChild(dot);
    const x0 = sx + (Math.random() - 0.5) * a.width * 0.8;
    const y0 = sy + (Math.random() - 0.5) * a.height * 0.6;
    const bend = (Math.random() - 0.5) * Math.min(160, len * 0.6);
    const mx = (x0 + tx) / 2 + nx * bend;
    const my = (y0 + ty) / 2 + ny * bend;
    const x1 = tx + (Math.random() - 0.5) * 10;
    const y1 = ty + (Math.random() - 0.5) * 10;
    const at = (x: number, y: number, scale: number) => `translate(${x - size / 2}px, ${y - size / 2}px) scale(${scale})`;
    const animation = dot.animate(
      [
        { transform: at(x0, y0, 0.6), opacity: 0 },
        { transform: at(x0, y0 - 6, 1), opacity: 1, offset: 0.15 },
        { transform: at(mx, my, 0.9), opacity: 0.9, offset: 0.6 },
        { transform: at(x1, y1, 0.3), opacity: 0 },
      ],
      { duration: 850 + Math.random() * 250, delay: i * 35, easing: "cubic-bezier(0.5, 0, 0.75, 1)", fill: "both" },
    );
    animation.onfinish = animation.oncancel = () => dot.remove();
  }
}

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
  const { beforeLevel, afterLevel, unlocked, steps: growth } = growthOf(beforeMp, afterMp, result.cycleStartMp);
  const ascended = result.climb !== null && result.climb.afterFloor > result.climb.beforeFloor;

  // 塔の階層は領域の解放の後、周天の終幕の前に挟む
  const steps: Step[] = ["result", ...growth.filter((s) => s !== "ending"), ...(ascended ? (["zenith"] as const) : []), ...(growth.includes("ending") ? (["ending"] as const) : [])];
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
    playGrowthSe(step);
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
          <StepDots count={steps.length} index={index} />
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
  const [phase, setPhase] = useState<MannaPhase>("charge");
  const [counting, setCounting] = useState(false);
  const capped = result.savedMinutes < result.requestedMinutes;
  const rootRef = useRef<HTMLDivElement>(null);
  const mpRef = useRef<HTMLDivElement>(null);
  const radarRef = useRef<HTMLDivElement>(null);

  // 魔力の演出: 数え上げ（蓄積の音）→ 光の粒子が魔法陣へ吸い込まれる（吸入の音）→ 陣が育って脈打ち → 流れ星が降りる。
  // 流れ星を開けるのはタップしてから（開いた瞬間に解放の音）
  useEffect(() => {
    const timers = [
      setTimeout(() => {
        setCounting(true);
        soundManager.playMannaCharge();
      }, TIMELINE.countAt),
      setTimeout(() => {
        setPhase("absorb");
        soundManager.playMannaAbsorb();
        if (rootRef.current && mpRef.current && radarRef.current) launchManna(rootRef.current, mpRef.current, radarRef.current);
      }, TIMELINE.absorbAt),
      setTimeout(() => {
        setPhase("filled");
        setRadarData(result.afterTotals);
      }, TIMELINE.filledAt),
      // 先にタップして進めていたら、その段階を戻さない
      setTimeout(() => onChestChange((c) => (c === "hidden" ? "closed" : c)), TIMELINE.meteorAt),
    ];
    return () => timers.forEach(clearTimeout);
  }, [result, onChestChange]);

  return (
    <div ref={rootRef} className="relative grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
      {/* 魔力が星脈を満たした瞬間、画面の暗がりが一度だけ静かに脈打つ */}
      {phase === "filled" && (
        <span
          className="manna-glow pointer-events-none absolute -inset-4 bg-[radial-gradient(60%_55%_at_50%_45%,rgba(113,226,239,0.07),rgba(168,130,251,0.04)_45%,transparent_75%)]"
          aria-hidden
        />
      )}
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
          {/* 数え上げてから、光の粒子となって魔法陣へ流れ出す間だけ淡くなる（浮かび上がりのアニメーションと重ならないよう外側で薄める） */}
          <div ref={mpRef} className={cn("transition-[opacity,scale] duration-700", phase === "absorb" && "scale-95 opacity-45")}>
            <p className="mp-glow font-display text-5xl tabular-nums text-starlight-gradient short:text-4xl" aria-label={`+${result.gainedMp} MP`}>
              <CountUpMp target={result.gainedMp} running={counting} />
            </p>
          </div>
          <p className="animate-float-up text-lg tracking-[0.4em] text-glow-gold [animation-delay:200ms]">授かりし魔力</p>
        </div>
        {(result.areaBoost > 1 || result.blessing > 1 || result.catalyst || result.cycleMark > 1 || result.comboMp > 1) && (
          <p className="animate-in text-[11px] tracking-wider text-muted-foreground fade-in duration-700">
            基礎 {result.savedMinutes}
            {result.areaBoost > 1 && <span className="text-aqua"> × エリア {result.areaBoost}</span>}
            {result.blessing > 1 && <span className="text-amethyst"> × 秘宝の加護 {Number(result.blessing.toFixed(2))}</span>}
            {result.catalyst && <span className="text-starlight"> × {result.catalyst.name} {result.catalyst.multiplier}</span>}
            {result.cycleMark > 1 && <span className="text-amethyst"> × 周天の刻印 {Number(result.cycleMark.toFixed(2))}</span>}
            {result.comboMp > 1 && <span className="text-starlight"> × 同調 {result.combo}連 {Number(result.comboMp.toFixed(2))}</span>}
          </p>
        )}
        {result.combo > 0 && <ComboNote result={result} />}
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
        {/* 場所は最初から取っておき、満ちたときに浮かび上がらせる（枠の大きさを途中で変えない） */}
        <p
          className={cn(
            "text-[11px] tracking-[0.2em] text-aqua/80 transition-opacity duration-1000 [word-break:auto-phrase]",
            phase === "filled" ? "opacity-100" : "opacity-0",
          )}
          aria-hidden={phase !== "filled"}
        >
          {result.drops.length > 0 ? "魔力が星脈を満たし、流れ星が引き寄せられた…" : "魔力が星脈を満たした"}
        </p>
        {capped && <p className="text-xs text-destructive">一夜に刻める詠唱は12時間まで。超えた分は星に届きません</p>}

        {result.drops.length === 0 ? (
          <p className="text-[11px] tracking-wider text-muted-foreground [word-break:auto-phrase]">
            流れ星は、{DROP_SLOT_MINUTES}分以上続けた詠唱にだけ降る
          </p>
        ) : (
          <DropReveal stage={chest} drops={result.drops} ore={result.ore} echo={result.echo} meteor={result.meteor} onOpen={() => onChestChange("open")} />
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div ref={radarRef} className="relative mx-auto aspect-square w-full max-w-64 short:max-w-44">
          {/* 粒子を受け止めた陣の奥が、一度だけ光る */}
          {phase === "filled" && (
            <span
              className="manna-pulse pointer-events-none absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgba(226,201,116,0.22),rgba(113,226,239,0.08)_45%,transparent_70%)]"
              aria-hidden
            />
          )}
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

/** 鐘の音で告げる格（秘宝・至宝・神話） */
const RARE_DROP = new Set<ItemRarity>(["A", "S", "SS"]);

/**
 * 流れ星が降りて明滅し、触れるとほどけて、降った品（1〜4つ）と星屑の原石が浮かび上がる。
 * 開いた後の中身は最初から見えないまま場所を取っておき、閉じた流れ星を同じ場所に重ねる。
 * 現れる前・触れる前・開いた後で枠の大きさが変わらないようにする
 */
function DropReveal({
  stage,
  drops,
  ore,
  echo,
  meteor,
  onOpen,
}: {
  stage: ChestStage;
  drops: StudyResult["drops"];
  ore: number;
  echo: number;
  meteor: MeteorShower | null;
  onOpen: () => void;
}) {
  const opened = stage === "open";
  // 流れ星がほどけた瞬間に、記憶の解放の音を鳴らす（秘宝・至宝が混じれば深い鐘、常品・稀品だけなら澄んだ水晶の鐘）
  const rare = drops.some((d) => RARE_DROP.has(d.item.rarity));
  useEffect(() => {
    if (opened) soundManager.playMemoryUnlock(rare);
  }, [opened, rare]);
  return (
    <div className="grid w-full">
      {/* 開いた後の中身: 開くまでは見えないまま場所だけ取る。開いたときに描き直して、浮かび上がりの動きを始めから見せる */}
      <div key={opened ? "open" : "closed"} className={cn("flex flex-col items-center gap-1 [grid-area:1/1]", !opened && "invisible")} aria-hidden={!opened}>
        <span className="relative size-10">
          <ShootingStar open className="absolute inset-0 opacity-40" />
        </span>
        {meteor && (
          <div className="mb-1 flex flex-col items-center gap-0.5 animate-in fade-in duration-1000">
            <p className="text-xs tracking-[0.3em] whitespace-nowrap text-starlight text-glow-gold">流星群の接近 ― 特別観測</p>
            <p className="font-display text-[9px] tracking-[0.3em] whitespace-nowrap text-starlight/60">METEOR SHOWER</p>
            <p className="text-[10px] leading-snug tracking-wider text-muted-foreground [word-break:auto-phrase]">
              長き詠唱に星脈がゆらぎ、先人の秘宝が地上へ手繰り寄せられた
            </p>
          </div>
        )}
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
              {meteor?.upgradedIndex === i && (
                <span className="text-[10px] tracking-wider whitespace-nowrap text-starlight">流星群の輝きで秘宝以上に</span>
              )}
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
            {meteor && ore > meteor.ore && <span className="text-muted-foreground">（うち流星群 ×{meteor.ore}）</span>}
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
      </div>
      {/* 閉じた流れ星: 現れてから触れるまで、同じ場所の上に重ねる */}
      {stage === "closed" && (
        <div className="flex animate-in flex-col items-center gap-1 fade-in slide-in-from-bottom-2 duration-700 [grid-area:1/1]">
          <button type="button" onClick={onOpen} aria-label="流れ星に触れる" className="star-arrive relative size-20 cursor-pointer short:size-16">
            <ShootingStar open={false} className="absolute inset-0" />
          </button>
          <p className="text-[11px] tracking-[0.3em] text-starlight/70 glimmer">
            {meteor ? "流星群が降りた" : drops.length > 1 ? `流れ星が${drops.length}つ降りた` : "流れ星が降りた"}…触れて受け取る
          </p>
        </div>
      )}
    </div>
  );
}

/** 星脈との同調（コンボ）の一言。補正が乗った段階と、調律師に届いたことを添える */
function ComboNote({ result }: { result: StudyResult }) {
  const perks = [
    result.comboMp > 1 && `魔力 +${Math.round((result.comboMp - 1) * 100)}%`,
    result.comboDrop > 1 && `稀品以上の流れ星 +${Math.round((result.comboDrop - 1) * 100)}%`,
  ].filter(Boolean);
  return (
    <div className="flex animate-in flex-col items-center gap-0.5 fade-in duration-700">
      <p className="text-xs tracking-[0.25em] whitespace-nowrap text-amethyst">
        星脈との同調 <span className="font-display text-sm text-starlight text-glow-gold">{result.combo}</span>連
      </p>
      {perks.length > 0 && <p className="text-[10px] tracking-wider text-muted-foreground">{perks.join("・")}</p>}
      {result.comboTitle && (
        <p className="text-[10px] tracking-wider text-starlight [word-break:auto-phrase]">途切れぬ詠唱が星脈を調律した ― 称号『星脈の調律師』</p>
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
      return isNew ? `${item.effect}の加護を得た` : `すでに所持している${item.rarity === "S" ? "至宝" : "秘宝"}だ`;
    case "fragment":
      return isNew ? "古代文書の断片だ（図鑑の「星脈の記憶」へ）" : "すでに持っている断片だ（錬成陣で還元できる）";
    default:
      return item.effect ?? "";
  }
}
