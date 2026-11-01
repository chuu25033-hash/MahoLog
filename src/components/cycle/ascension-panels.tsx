"use client";

import { useState } from "react";
import { ChevronRight, Orbit, Sparkles } from "lucide-react";
import { CycleRings } from "@/components/cycle/cycle-rings";
import { ItemArt } from "@/components/item-art";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CYCLE_MARK_RATE, THEME_LABEL, chapterOf, cycleLabel, cycleMarkMultiplier, type Chapter } from "@/lib/cycles";
import { findItem, zenithRewardKind, zenithRewardName } from "@/lib/items";
import { soundManager } from "@/lib/sound/sound-manager";
import { userActions, useUserData, type ZenithClimb } from "@/lib/user-store";

const FINALE_LINES = [
  "星冠の祭壇に、最後の灯がともった。",
  "三百時間ぶんの魔力は、ひとつの円環となって静かに閉じる。",
  "――けれど円環の終わりは、次の円環の始まりでもある。",
];

/**
 * STAGE 6 制覇のエンディング。「次なる周天へ進む」を選ぶと、はじまりの小屋から次の章が始まる。
 * 留まることもでき、そのときは星天の塔からいつでも周天の儀式に臨める
 */
export function EndingPanel({ totalMp, onStay }: { totalMp: number; onStay: () => void }) {
  const data = useUserData();
  const [chapter, setChapter] = useState<Chapter | null>(null);

  if (chapter) return <ChapterReveal chapter={chapter} />;

  const next = chapterOf(data.cycle.count + 1);
  function advance() {
    const c = userActions.advanceCycle(totalMp);
    if (!c) return;
    soundManager.playSe("rankUp");
    setChapter(c);
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <DialogTitle className="font-display text-xs font-normal tracking-[0.5em] whitespace-nowrap text-starlight/80">
        <span className="-mr-[0.5em]">FINALE</span>
      </DialogTitle>
      <div className="relative size-28 short:size-20">
        <span className="burst-ring size-20" />
        <CycleRings laps={data.cycle.count} className="absolute inset-[18%]" />
        <Orbit className="absolute inset-[34%] size-[32%] text-starlight" strokeWidth={1} />
      </div>
      <div className="flex flex-col gap-1.5">
        {FINALE_LINES.map((line, i) => (
          <p
            key={line}
            className="animate-in text-sm tracking-[0.2em] fade-in slide-in-from-bottom-1 duration-1000 [animation-fill-mode:both] [word-break:auto-phrase]"
            style={{ animationDelay: `${400 + i * 900}ms` }}
          >
            {line}
          </p>
        ))}
      </div>
      <DialogDescription className="animate-in text-[11px] leading-relaxed tracking-wider fade-in duration-1000 [animation-delay:3200ms] [animation-fill-mode:both] [word-break:auto-phrase]">
        次なる周天「{next.name}」では、はじまりの小屋から旅を辿り直します。階級・図鑑・所持品・星天の塔の階層は引き継がれ、
        周天の刻印（全属性の獲得MP +{Math.round(CYCLE_MARK_RATE * 100)}%）が刻まれます。
      </DialogDescription>
      <div className="flex w-full animate-in flex-col gap-2 fade-in duration-1000 [animation-delay:3600ms] [animation-fill-mode:both]">
        <Button className="claim-glow" onClick={advance}>
          <Sparkles /> 次なる周天へ進む
        </Button>
        <Button variant="outline" size="sm" onClick={onStay}>
          この周天に留まる
        </Button>
        <p className="text-[10px] tracking-wider text-muted-foreground">星天の塔は魔術書庫からいつでも開けます。周天の儀式も塔で行えます</p>
      </div>
    </div>
  );
}

/** 新たな章の幕開け: 授かったものを並べる */
export function ChapterReveal({ chapter }: { chapter: Chapter }) {
  const skin = findItem(chapter.skinId);
  const theme = THEME_LABEL[chapter.theme];
  const gifts = [
    `周天の刻印 — 全属性の獲得MP ×${Number(cycleMarkMultiplier(chapter.cycle).toFixed(2))}`,
    ...(skin ? [`魔法陣の意匠『${skin.name}』を授かった`] : []),
    `UI の色調「${theme.name}」が開かれた（設定から切り替えられます）`,
    ...(chapter.loreVariant ? [`各エリアの伝承の品が${chapter.loreVariant === "shadow" ? "〈影〉" : "〈蒼炎〉"}の姿に変わり、裏の物語が読めるようになる`] : []),
  ];
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <DialogTitle className="font-display text-xs font-normal tracking-[0.5em] whitespace-nowrap text-starlight/80">
        <span className="-mr-[0.5em]">{chapter.label}</span>
      </DialogTitle>
      <div className="rank-line w-full" />
      <div className="flex animate-in flex-col items-center gap-1 fade-in slide-in-from-bottom-2 duration-1000 [animation-delay:600ms] [animation-fill-mode:both]">
        <p className="text-sm tracking-[0.4em] whitespace-nowrap text-muted-foreground">
          <span className="-mr-[0.4em]">{cycleLabel(chapter.cycle)}</span>
        </p>
        <p className="text-3xl tracking-[0.3em] whitespace-nowrap text-starlight-gradient">
          <span className="-mr-[0.3em]">{chapter.name}</span>
        </p>
        {skin && (
          <ItemArt icon={skin.svgIcon} rarity={skin.rarity} color={skin.color} seed={skin.id} className="mt-2 size-20 short:size-14" />
        )}
      </div>
      <ul className="flex w-full animate-in flex-col gap-1.5 text-left text-xs tracking-wider fade-in duration-1000 [animation-delay:1400ms] [animation-fill-mode:both]">
        {gifts.map((g) => (
          <li key={g} className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 [word-break:auto-phrase]">
            <ChevronRight className="mt-0.5 size-3 shrink-0 text-starlight/70" />
            {g}
          </li>
        ))}
      </ul>
      <div className="rank-line w-full [animation-delay:300ms]" />
    </div>
  );
}

/** 星天の塔で階層を昇った: 節目を越えていれば天界遺物・称号も示す */
export function ZenithPanel({ climb }: { climb: ZenithClimb }) {
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <DialogTitle className="font-display text-xs font-normal tracking-[0.5em] whitespace-nowrap text-amethyst">
        <span className="-mr-[0.5em]">ASCENSION</span>
      </DialogTitle>
      <div className="relative flex items-center gap-4 py-2 whitespace-nowrap">
        <span className="burst-ring size-20" />
        <span className="font-display text-3xl text-muted-foreground">{climb.beforeFloor}</span>
        <ChevronRight className="size-5 text-starlight/70" strokeWidth={1.25} />
        <span className="mp-glow font-display text-5xl text-starlight-gradient">{climb.afterFloor}</span>
        <span className="text-sm tracking-[0.3em] text-starlight/80">層</span>
      </div>
      <DialogDescription className="tracking-[0.2em]">
        {climb.afterFloor - climb.beforeFloor > 1 ? `星天の塔を、一度に${climb.afterFloor - climb.beforeFloor}層昇った` : "星天の塔を、また一層昇った"}
      </DialogDescription>
      {climb.rewards.length > 0 && (
        <div className="flex w-full flex-col gap-2">
          <p className="text-[11px] tracking-[0.3em] text-starlight">節目の階層で授かったもの</p>
          {climb.rewards.map(({ item, isNew }) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-starlight/40 bg-white/[0.03] p-2 text-left shadow-[0_0_18px_-6px_rgba(226,201,116,0.6)]"
            >
              <ItemArt icon={item.svgIcon} rarity={item.rarity} color={item.color} seed={item.id} className="size-14 shrink-0" />
              <div className="min-w-0">
                <p className="font-display text-[10px] tracking-[0.2em] text-starlight/80">
                  RARE {item.rarity} · {zenithRewardKind(item)}
                </p>
                <p className="text-sm tracking-[0.15em]">{zenithRewardName(item)}</p>
                <p className="text-[11px] text-muted-foreground [word-break:auto-phrase]">
                  {item.kind === "fragment" ? "4葉が揃えば、図鑑の星脈の記憶で復元できる" : item.effect}
                  {isNew && " ・図鑑に記された"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
