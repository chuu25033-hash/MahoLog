"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, Lock, Orbit, Wand2 } from "lucide-react";
import { BackToLibrary } from "@/components/back-to-library";
import { EndingPanel } from "@/components/cycle/ascension-panels";
import { CycleRings } from "@/components/cycle/cycle-rings";
import { HiddenArt, ItemArt } from "@/components/item-art";
import { MpBar } from "@/components/mp-bar";
import { PageLoading } from "@/components/page-loading";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ZenithSky } from "@/components/zenith/zenith-sky";
import { ZENITH_AREA, resolveArea } from "@/lib/areas";
import {
  CLEAR_MP,
  ZENITH_MILESTONES,
  chapterOf,
  cycleLabel,
  cycleMarkMultiplier,
  nextMilestone,
  zenithProgress,
} from "@/lib/cycles";
import { formatMinutes } from "@/lib/game";
import { findItem, type Item } from "@/lib/items";
import { cycleMp, isCycleCleared, isDiscovered, isZenithOpen, useStoredUserData, userActions, type UserData } from "@/lib/user-store";
import { cn } from "@/lib/utils";

/** 拡大縮小しても 1px を保つ光の線 */
const hairline = { vectorEffect: "non-scaling-stroke", fill: "none", strokeWidth: 1 } as const;

/**
 * 星天の塔（Astra Zenith）: STAGE 6 の先に続く無限の階層。
 * 塔に滞在して詠唱すると 10 時間ごとに 1 層昇り、節目の階層で天界遺物と称号を授かる。周天の儀式もここで行う
 */
export function ZenithView({ totalMp: serverTotalMp, isDemo }: { totalMp: number; isDemo: boolean }) {
  const data = useStoredUserData();
  if (!data) return <PageLoading />;
  const totalMp = isDemo ? data.userProfile.totalMp : serverTotalMp;
  if (!isZenithOpen(data, totalMp)) return <SealedGate data={data} totalMp={totalMp} />;
  return <Zenith data={data} totalMp={totalMp} />;
}

function Header() {
  return (
    <header className="flex items-center gap-4">
      <BackToLibrary />
      <div className="min-w-0">
        <h1 className="flex items-baseline gap-2 text-xl tracking-[0.25em] whitespace-nowrap">
          星天の塔
          <span className="truncate font-display text-[10px] tracking-[0.3em] text-starlight/70">ASTRA ZENITH</span>
        </h1>
        <p className="text-xs tracking-wider text-muted-foreground [word-break:auto-phrase]">{ZENITH_AREA.description}</p>
      </div>
    </header>
  );
}

/** まだ STAGE 6 を制覇していない: 封じられた塔の扉 */
function SealedGate({ data, totalMp }: { data: UserData; totalMp: number }) {
  const progress = cycleMp(data, totalMp);
  return (
    <div className="flex h-full flex-col gap-4 p-3 animate-in fade-in duration-700 lg:p-5">
      <Header />
      <Card className="mx-auto my-auto w-full max-w-md items-center gap-3 px-6 text-center">
        <Lock className="size-6 text-muted-foreground" strokeWidth={1.25} />
        <p className="text-lg tracking-[0.3em]">塔の扉は閉ざされている</p>
        <p className="text-xs leading-relaxed tracking-wider text-muted-foreground [word-break:auto-phrase]">
          天空の大聖堂の最奥「星冠の祭壇」で、秘術の深奥に触れた者だけが、この塔を昇ることを許される。
        </p>
        <div className="w-full">
          <MpBar ratio={progress / CLEAR_MP} variant="stage" />
          <p className="mt-1.5 text-xs tracking-wider text-muted-foreground">
            扉が開くまで あと<span className="mx-1 text-starlight text-glow-gold">{formatMinutes(Math.max(0, CLEAR_MP - progress))}</span>
          </p>
        </div>
      </Card>
    </div>
  );
}

function Zenith({ data, totalMp }: { data: UserData; totalMp: number }) {
  const { floor, ratio, remainingMinutes } = zenithProgress(data.zenith.minutes);
  const inTower = data.userProfile.currentStageId === ZENITH_AREA.id;
  const milestone = nextMilestone(floor);

  function descend() {
    userActions.setCurrentStage(resolveArea(null, cycleMp(data, totalMp)).id);
  }

  return (
    <>
      {/* 昇った階層の分だけ濃くなる星天 */}
      <ZenithSky floor={floor} className="pointer-events-none fixed inset-0 -z-[5] overflow-hidden" />
      <div className="scroll-area scrollbar-none flex h-full flex-col gap-4 p-3 animate-in fade-in duration-700 lg:p-5">
        <Header />
        <div className="grid min-h-0 flex-1 grid-cols-12 gap-3 lg:gap-4">
          <Card className="col-span-5 min-h-0 items-center gap-3 px-4 text-center">
            <p className="font-display text-[10px] tracking-[0.4em] text-starlight/70">CURRENT FLOOR</p>
            <TowerDiagram floor={floor} ratio={ratio} className="min-h-0 w-full max-w-56 flex-1" />
            <p className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="font-display text-5xl text-starlight-gradient short:text-4xl">{floor}</span>
              <span className="text-sm tracking-[0.3em] text-starlight/80">層</span>
            </p>
            <div className="w-full max-w-64">
              <MpBar ratio={ratio} />
              <p className="mt-1.5 text-[11px] tracking-wider text-muted-foreground">
                {floor + 1}層まで あと<span className="mx-1 text-starlight text-glow-gold">{formatMinutes(remainingMinutes)}</span>
                <span className="text-muted-foreground/80">（累計 {formatMinutes(data.zenith.minutes)}）</span>
              </p>
            </div>
            <div className="flex w-full max-w-64 flex-col gap-2">
              {inTower ? (
                <>
                  <Link href="/timer" className={cn(buttonVariants(), "tracking-[0.2em]")}>
                    <Wand2 /> 塔で詠唱を始める
                  </Link>
                  <Button variant="outline" size="sm" onClick={descend}>
                    <ArrowDownToLine /> 塔を降りる
                  </Button>
                </>
              ) : (
                <Button className="claim-glow tracking-[0.2em]" onClick={() => userActions.setCurrentStage(ZENITH_AREA.id)}>
                  <Orbit /> 塔に滞在する
                </Button>
              )}
              <p className="text-[10px] leading-relaxed tracking-wider text-muted-foreground [word-break:auto-phrase]">
                滞在中は全属性の獲得MP ×{ZENITH_AREA.boost.multiplier}。詠唱した時間10時間ごとに1層昇る
              </p>
            </div>
          </Card>

          <section className="col-span-7 flex min-h-0 flex-col gap-3">
            <Card size="sm" className="min-h-0 flex-1 gap-2 px-3">
              <h2 className="flex items-baseline gap-2 text-sm tracking-[0.2em] whitespace-nowrap">
                節目の階層
                <span className="min-w-0 truncate font-display text-[9px] tracking-[0.25em] text-starlight/60">MILESTONES</span>
                {milestone && (
                  <span className="ml-auto text-[11px] tracking-wider text-muted-foreground">
                    次は {milestone.floor}層（あと{milestone.floor - floor}層）
                  </span>
                )}
              </h2>
              <ul className="scroll-area scrollbar-none flex min-h-0 flex-col gap-1.5">
                {ZENITH_MILESTONES.map((m) => (
                  <MilestoneRow key={m.floor} floor={m.floor} reached={floor >= m.floor} rewards={m.rewards} data={data} />
                ))}
              </ul>
            </Card>
            <CycleRite data={data} totalMp={totalMp} />
          </section>
        </div>
      </div>
    </>
  );
}

function MilestoneRow({ floor, reached, rewards, data }: { floor: number; reached: boolean; rewards: string[]; data: UserData }) {
  const items = rewards.map((id) => findItem(id)).filter((i): i is Item => !!i);
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-1.5",
        reached ? "border-starlight/35 bg-starlight/[0.04]" : "border-white/[0.08] bg-white/[0.02]",
      )}
    >
      <span className={cn("w-14 shrink-0 font-display text-lg", reached ? "text-starlight text-glow-gold" : "text-muted-foreground")}>
        {floor}
        <span className="ml-0.5 font-serif text-[10px]">層</span>
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1">
        {items.map((item) => {
          const owned = isDiscovered(data, item.id);
          return (
            <span key={item.id} className="flex min-w-0 items-center gap-1.5">
              {/* 授かるまでは、何が得られるかを伏せておく */}
              {owned ? (
                <ItemArt icon={item.svgIcon} rarity={item.rarity} color={item.color} seed={item.id} className="size-9 shrink-0" />
              ) : (
                <HiddenArt className="size-9 shrink-0" />
              )}
              <span className="min-w-0">
                <span className="block font-display text-[9px] tracking-[0.2em] text-muted-foreground">
                  {owned ? `${item.kind === "title" ? "称号" : "天界遺物"} · ${item.rarity}` : "UNKNOWN"}
                </span>
                <span className={cn("block truncate text-xs tracking-wider", owned ? "text-foreground" : "text-muted-foreground/60")}>
                  {owned ? (item.kind === "title" ? `【${item.name}】` : `『${item.name}』`) : "？？？"}
                </span>
              </span>
            </span>
          );
        })}
      </div>
    </li>
  );
}

/** 周天の儀式: 今の周天と刻印。この周天を制覇していれば、次なる周天へ進める */
function CycleRite({ data, totalMp }: { data: UserData; totalMp: number }) {
  const [open, setOpen] = useState(false);
  const chapter = chapterOf(data.cycle.count);
  const cleared = isCycleCleared(data, totalMp);
  const progress = cycleMp(data, totalMp);
  return (
    <Card size="sm" className="shrink-0 gap-2 px-3">
      <div className="flex items-center gap-3">
        <div className="relative size-14 shrink-0">
          <CycleRings laps={data.cycle.count} className="absolute inset-[12%]" />
          <Orbit className="absolute inset-[32%] size-[36%] text-starlight" strokeWidth={1} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2 text-sm tracking-[0.2em] whitespace-nowrap">
            周天の儀式
            <span className="truncate font-display text-[9px] tracking-[0.25em] text-starlight/60">{chapter.label}</span>
          </p>
          <p className="truncate text-xs tracking-wider whitespace-nowrap text-muted-foreground">
            {cycleLabel(data.cycle.count)}・<span className="text-foreground">{chapter.name}</span>
            <span className="ml-2">
              周天の刻印 <span className="font-display text-amethyst">MP ×{Number(cycleMarkMultiplier(data.cycle.count).toFixed(2))}</span>
            </span>
          </p>
        </div>
        {cleared ? (
          <Button size="sm" className="claim-glow shrink-0" onClick={() => setOpen(true)}>
            次なる周天へ
          </Button>
        ) : (
          <p className="shrink-0 text-right text-[11px] tracking-wider text-muted-foreground">
            この周天の制覇まで
            <br />
            あと<span className="mx-1 text-starlight">{formatMinutes(Math.max(0, CLEAR_MP - progress))}</span>
          </p>
        )}
      </div>
      {open && (
        <Dialog open onOpenChange={setOpen}>
          <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-md! scroll-area rounded-2xl p-6 ring-starlight/25 backdrop-blur-xl sm:max-w-md!">
            <EndingPanel totalMp={totalMp} onStay={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

/** 塔の断面: いまの階層を中心に、下の層は灯り、上の層はまだ点線で描かれる */
function TowerDiagram({ floor, ratio, className }: { floor: number; ratio: number; className?: string }) {
  const base = Math.max(1, floor - 3);
  const tiers = Array.from({ length: 8 }, (_, i) => base + i);
  return (
    <svg viewBox="-50 -62 100 124" className={cn("overflow-visible", className)} aria-hidden>
      {/* 天頂の星 */}
      <g stroke="currentColor" className="text-starlight">
        <path d="M0,-60 L1.6,-55 L6,-54 L1.6,-53 L0,-48 L-1.6,-53 L-6,-54 L-1.6,-55 Z" strokeOpacity="0.7" {...hairline} />
        <line y1="-46" y2="-38" strokeOpacity="0.3" strokeDasharray="1 2" {...hairline} />
      </g>
      {tiers.map((n, i) => {
        const y = 52 - i * 11.5;
        const w = 30 - i * 2.6;
        const top = w - 2.6;
        const reached = n < floor;
        const current = n === floor;
        return (
          <g key={n} stroke="currentColor" className={current ? "text-starlight" : reached ? "text-aqua" : "text-muted-foreground"}>
            <path
              d={`M${-w},${y} L${-top},${y - 11.5} H${top} L${w},${y} Z`}
              strokeOpacity={current ? 0.95 : reached ? 0.55 : 0.25}
              strokeDasharray={reached || current ? undefined : "1.5 2"}
              {...hairline}
            />
            {current && (
              // いまの層: 次の層までの進み具合だけ光が満ちる
              <rect x={-top} y={y - 11.5 * ratio} width={top * 2} height={11.5 * ratio} fill="currentColor" fillOpacity="0.12" stroke="none" />
            )}
            <text
              x={w + 4}
              y={y - 3.5}
              fontSize="5"
              fill="currentColor"
              fillOpacity={current ? 1 : reached ? 0.6 : 0.35}
              stroke="none"
              className="font-display"
            >
              {n}F
            </text>
          </g>
        );
      })}
      <line x1="-38" x2="38" y1="56" y2="56" stroke="currentColor" strokeOpacity="0.3" className="text-starlight" {...hairline} />
    </svg>
  );
}
