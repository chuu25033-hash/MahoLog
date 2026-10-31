"use client";

import { useMemo, useState } from "react";
import { ArrowDownUp, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { jstDateKey } from "@/lib/date";
import { formatMinutes } from "@/lib/game";
import type { ItemRarity, TitleItem } from "@/lib/items";
import {
  ACHIEVEMENT_TITLES,
  TITLE_CATEGORIES,
  TITLE_CATEGORY_LABEL,
  titleProgressMap,
  type Title,
  type TitleCategory,
  type TitleProgress,
} from "@/lib/titles";
import { equippedTitle, titleStatsOf, userActions, useUserData } from "@/lib/user-store";
import { cn } from "@/lib/utils";

/** 称号の格の札（RARE ○）の色。名前の色（GRADE_NAME_TONE）と同じ色相で、格が上がるほど明るく光る */
export const GRADE_TONE: Record<ItemRarity, string> = {
  SS: "text-starlight text-glow-gold",
  S: "text-starlight",
  A: "text-amethyst",
  B: "text-aqua/85",
  C: "text-muted-foreground",
};

/**
 * 称号の名前そのものの色。格が上がるほど豪華にする（中身は globals.css の .title-tone-*）:
 * C 控えめな白銀 → B 水色 → A 淡く光る紫 → S 光る金 → SS 光の筋が流れる金の濃淡
 */
export const GRADE_NAME_TONE: Record<ItemRarity, string> = {
  SS: "title-tone-ss",
  S: "title-tone-s",
  A: "title-tone-a",
  B: "title-tone-b",
  C: "title-tone-c",
};

/** 称号の格（実績の称号は grade、星天の塔の称号は遺物のレア度） */
export const titleGrade = (title: Title | TitleItem): ItemRarity => ("grade" in title ? title.grade : title.rarity);

/** 時間で測る条件は「1時間20分」のように示す */
/** 格の低い順（常品から神話へ）。降順はこれを逆にたどる */
const GRADE_ASC: ItemRarity[] = ["C", "B", "A", "S", "SS"];

const MINUTE_KINDS = new Set(["totalMinutes", "longestSession", "dailyMinutes", "weekendMinutes"]);

function progressLabel(title: Title, p: TitleProgress) {
  if (MINUTE_KINDS.has(title.condition.kind)) return `${formatMinutes(p.current)} / ${formatMinutes(p.target)}`;
  return `${p.current.toLocaleString()} / ${p.target.toLocaleString()}`;
}

/** 観測者の称号: 実績で解放した称号を一覧し、一つを選んでプロフィールに掲げる（魔術書庫のプロフィールから開く） */
export function TitlesDialog({ onClose }: { onClose: () => void }) {
  const data = useUserData();
  const [category, setCategory] = useState<TitleCategory>("continuous");
  const [onlyUnlocked, setOnlyUnlocked] = useState(false);
  /** 初めは格の低い順（C→SS）。押すと高い順（SS→C）に並べ替える */
  const [highFirst, setHighFirst] = useState(false);
  const progress = useMemo(() => titleProgressMap(titleStatsOf(data)), [data]);
  const { unlocked } = data.titles;
  const equipped = equippedTitle(data);
  // 期間限定の称号は、授かっていなければ一覧にも数にも出さない
  const shown = ACHIEVEMENT_TITLES.filter((t) => !t.limited || t.id in unlocked);
  const unlockedCount = shown.filter((t) => t.id in unlocked).length;
  // 同じ格の中は一覧の定義順（条件の軽い順）のまま
  const list = shown.filter((t) => t.category === category && (!onlyUnlocked || t.id in unlocked)).sort((a, b) => {
    const diff = GRADE_ASC.indexOf(a.grade) - GRADE_ASC.indexOf(b.grade);
    return highFirst ? -diff : diff;
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[min(32rem,calc(100%-2rem))]! gap-4 overflow-y-auto scrollbar-none rounded-2xl border border-white/10 bg-white/[0.04] p-5 ring-starlight/25 backdrop-blur-2xl">
        <DialogHeader className="items-center gap-1 text-center">
          <DialogTitle className="text-lg tracking-[0.35em] whitespace-nowrap text-starlight-gradient">
            <span className="-mr-[0.35em]">観測者の称号</span>
          </DialogTitle>
          <p className="font-display text-[10px] tracking-[0.4em] whitespace-nowrap text-starlight/70">
            <span className="-mr-[0.4em]">— OBSERVER&apos;S TITLES —</span>
          </p>
          <DialogDescription className="mt-1 text-[11px] tracking-wider [word-break:auto-phrase]">
            旅の歩みで解放した称号を一つ選び、プロフィールに掲げます
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.25em] whitespace-nowrap text-muted-foreground">掲げている称号</p>
            <p className="text-sm tracking-[0.15em] [word-break:auto-phrase]">
              {equipped ? <span className={GRADE_NAME_TONE[titleGrade(equipped)]}>【{equipped.name}】</span> : <span className="text-muted-foreground">まだ掲げていません</span>}
            </p>
          </div>
          <p className="shrink-0 text-right text-[10px] tracking-[0.2em] whitespace-nowrap text-muted-foreground">
            解放
            <span className="ml-1.5 font-display text-base text-starlight">{unlockedCount}</span>
            <span className="font-display"> / {shown.length}</span>
          </p>
        </div>

        <div role="tablist" aria-label="称号の分類" className="grid grid-cols-4 gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
          {TITLE_CATEGORIES.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                "flex flex-col items-center rounded-full py-1 text-xs leading-tight tracking-wider whitespace-nowrap transition-all duration-300",
                category === c
                  ? "bg-starlight/10 text-starlight ring-1 ring-starlight/45 shadow-[0_0_10px_-2px_rgba(226,201,116,0.4)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {TITLE_CATEGORY_LABEL[c].ja}
              {/* 英語の分類名は名前の下に小さく添える */}
              <span className="font-display text-[8px] tracking-[0.1em] opacity-60">{TITLE_CATEGORY_LABEL[c].en}</span>
            </button>
          ))}
        </div>

        <div className="-mt-1 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setHighFirst((v) => !v)}
            aria-label={highFirst ? "格の低い順に並べ替える" : "格の高い順に並べ替える"}
            className="flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] tracking-wider whitespace-nowrap text-muted-foreground transition-colors duration-300 hover:border-starlight/40 hover:text-starlight"
          >
            <ArrowDownUp className="size-3" strokeWidth={1.5} aria-hidden />
            <span className="font-display tracking-[0.15em]">{highFirst ? "RARE SS → C" : "RARE C → SS"}</span>
          </button>
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] tracking-wider whitespace-nowrap text-muted-foreground">
            <input type="checkbox" checked={onlyUnlocked} onChange={(e) => setOnlyUnlocked(e.target.checked)} className="accent-[#e2c974]" />
            解放した称号だけを表示
          </label>
        </div>

        {list.length === 0 ? (
          <p className="py-6 text-center text-xs tracking-wider text-muted-foreground">この分類で解放した称号は、まだありません</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((t) => (
              <TitleRow key={t.id} title={t} unlockedAt={unlocked[t.id] ?? null} progress={progress.get(t.id)!} equipped={data.equipment.titleId === t.id} />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TitleRow({ title, unlockedAt, progress, equipped }: { title: Title; unlockedAt: string | null; progress: TitleProgress; equipped: boolean }) {
  const isUnlocked = unlockedAt !== null;
  const veiled = !isUnlocked && title.hidden;

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 transition-colors duration-500",
        equipped ? "border-starlight/40 bg-starlight/[0.05]" : isUnlocked ? "border-white/10 bg-white/[0.03]" : "border-white/[0.05]",
      )}
    >
      <div className={cn("min-w-0 flex-1", !isUnlocked && "opacity-60")}>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className={cn("text-sm tracking-[0.15em] [word-break:auto-phrase]", isUnlocked && GRADE_NAME_TONE[title.grade])}>
            {veiled ? "【？？？】" : `【${title.name}】`}
          </span>
          <span className={cn("font-display text-[9px] tracking-[0.2em] whitespace-nowrap", GRADE_TONE[title.grade])}>RARE {title.grade}</span>
        </p>
        <p className="mt-0.5 text-[11px] tracking-wider text-muted-foreground [word-break:auto-phrase]">
          {veiled ? "解放するまで、条件は伏せられています" : title.description}
        </p>
        {isUnlocked && title.flavorText && (
          <p className="mt-1.5 text-[11px] leading-relaxed tracking-wider text-starlight/70 [word-break:auto-phrase]">{title.flavorText}</p>
        )}
        {isUnlocked ? (
          <p className="mt-1 font-display text-[9px] tracking-[0.2em] text-muted-foreground/70">{jstDateKey(new Date(unlockedAt)).replaceAll("-", ".")} UNLOCKED</p>
        ) : (
          !veiled && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-px flex-1 bg-white/10">
                <div className="h-full bg-aqua/70 shadow-[0_0_4px_rgba(113,226,239,0.6)]" style={{ width: `${(progress.current / progress.target) * 100}%` }} />
              </div>
              <span className="shrink-0 font-display text-[10px] tracking-wider whitespace-nowrap text-muted-foreground">{progressLabel(title, progress)}</span>
            </div>
          )
        )}
      </div>
      {isUnlocked && (
        <Button size="sm" variant={equipped ? "outline" : "default"} className="shrink-0" onClick={() => userActions.setTitle(equipped ? null : title.id)}>
          <Crown /> {equipped ? "下ろす" : "掲げる"}
        </Button>
      )}
    </li>
  );
}
