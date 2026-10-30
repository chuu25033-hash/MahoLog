"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookMarked, CalendarDays, Moon, Orbit, Settings, Sparkles, Sun, Swords, Wand2 } from "lucide-react";
import { AreaAmbience } from "@/components/area-ambience";
import { BoundWorldlinesDialog } from "@/components/bound-worldlines-dialog";
import { CycleRings } from "@/components/cycle/cycle-rings";
import { MpBar } from "@/components/mp-bar";
import { PageLoading } from "@/components/page-loading";
import { RadarPanel } from "@/components/radar-panel";
import { StageCard } from "@/components/stage-card";
import { TrialsDialog, readyCount } from "@/components/trials-dialog";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WizardAvatar } from "@/components/wizard-avatar";
import { RankSigil } from "@/components/arcane-icons";
import { dashboardSummary, type DashboardSummary } from "@/lib/aggregate";
import { cycleLabel } from "@/lib/cycles";
import { formatMinutes, levelProgress, rankOf } from "@/lib/game";
import { activeSubjectsOf } from "@/lib/subjects";
import { usePortraitPhone } from "@/lib/use-portrait-phone";
import type { Subject } from "@/lib/types";
import { equippedTitle, localProfile, localStudyLogs, useStoredUserData, userActions, useUserData } from "@/lib/user-store";
import { cn } from "@/lib/utils";

const MODE_LABEL = { pomodoro: "律動の詠唱", stopwatch: "無窮の詠唱" } as const;

/**
 * 魔術書庫。デモモードでは端末に保存した観測データから集計する。
 * 魔法陣（レーダー）は設定画面で選んだ「詠唱に使う科目」だけで描く
 */
export function DashboardView({ summary, subjects, isDemo }: { summary: DashboardSummary; subjects: Subject[]; isDemo: boolean }) {
  const stored = useStoredUserData();
  if (!stored) return <PageLoading />;
  const base = isDemo ? dashboardSummary(localProfile(stored), subjects, localStudyLogs(stored)) : summary;
  const activeIds = new Set(activeSubjectsOf(subjects, stored.userProfile.activeSubjects).map((s) => s.id));
  const radar = Object.fromEntries(
    Object.entries(base.radar).map(([range, totals]) => [range, totals.filter((t) => activeIds.has(t.subjectId))]),
  ) as DashboardSummary["radar"];
  return <Dashboard {...base} radar={radar} subjects={subjects} />;
}

function Dashboard({ profile, totals, radar, recentLogs, subjects }: DashboardSummary & { subjects: Subject[] }) {
  const data = useUserData();
  const level = levelProgress(profile.total_study_time);
  const rank = rankOf(level.level);
  const title = equippedTitle(data);
  const laps = data.cycle.count - 1;
  const portrait = usePortraitPhone();

  const profileCard = (
    <Card className="shrink-0 gap-3 px-4 compact:gap-2 compact:py-3 short:py-2">
      <div className="flex items-center gap-3">
        {/* 巡り終えた周天の数だけ、周回リングが外周を回る */}
        <div className="relative shrink-0" title={laps > 0 ? `${cycleLabel(data.cycle.count)}（${laps}周を巡り終えた）` : undefined}>
          <WizardAvatar avatar={profile.avatar_url} className="short:size-9" />
          <CycleRings laps={laps} className="absolute -inset-2" />
        </div>
        <div className="min-w-0">
          <p className="text-base tracking-wider">
            {title ? (
              <span className="mr-1 text-[11px] tracking-[0.15em] text-starlight text-glow-gold">【{title.name}】</span>
            ) : (
              <span className="text-[11px] tracking-[0.2em] text-muted-foreground">秘術探究者・</span>
            )}
            {profile.username}
          </p>
          <div className="flex items-center gap-1 text-[11px] tracking-[0.2em] whitespace-nowrap text-starlight/85">
            <RankSigil numeral={rank.numeral} className="size-5 shrink-0 text-starlight" />
            {/* 階級名の下に英語の階位を小さく添える */}
            <p className="flex flex-col leading-tight">
              {rank.title}
              <span className="font-display text-[9px] tracking-[0.2em] text-starlight/60">RANK {rank.numeral}</span>
            </p>
          </div>
        </div>
        <div className="ml-auto shrink-0 text-right">
          <p className="text-[10px] tracking-[0.3em] whitespace-nowrap text-muted-foreground">探求度</p>
          <p className="font-display text-3xl leading-none text-starlight-gradient short:text-2xl">{level.level}</p>
          <p className="font-display text-[9px] tracking-[0.2em] whitespace-nowrap text-starlight/60 short:hidden">PHASE {level.level}</p>
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2 text-[11px] tracking-wider short:hidden">
          <span className="text-muted-foreground">
            累積魔力 <span className="font-display text-foreground">{profile.total_study_time.toLocaleString()}</span>
            <span className="font-display"> MP</span>
          </span>
          <span className="text-muted-foreground">
            次なる感応まで <span className="font-display text-aqua">{level.remaining}</span>
            <span className="font-display"> MP</span>
          </span>
        </div>
        <MpBar ratio={level.ratio} />
      </div>
    </Card>
  );

  const stageCard = (
    <StageCard totalMp={profile.total_study_time} className="shrink-0 compact:py-3 short:py-2" />
  );

  const totalsRow = (
    <div className="grid shrink-0 grid-cols-3 gap-2">
      {[
        { label: "今宵", value: totals.today, icon: Sun },
        { label: "七夜", value: totals.week, icon: Moon },
        { label: "月巡り", value: totals.month, icon: Sparkles },
      ].map(({ label, value, icon: Icon }) => (
        <Card key={label} size="sm" className="items-center gap-1 px-2 text-center compact:py-2 short:gap-0 short:py-1.5">
          <Icon className="size-4 text-aqua/80 compact:hidden" strokeWidth={1.25} />
          <p className="text-[10px] tracking-[0.3em] text-muted-foreground">{label}</p>
          <p className="text-sm tracking-wider short:text-xs">{formatMinutes(value)}</p>
        </Card>
      ))}
    </div>
  );

  const radarCard = (
    <Card className="col-span-5 h-full min-h-0 px-4 short:py-3">
      <RadarPanel data={radar} />
    </Card>
  );

  const chantButton = (
    <Link
      href="/timer"
      className={cn(
        buttonVariants({ size: "lg" }),
        "group h-auto shrink-0 flex-col gap-1.5 rounded-2xl py-5 text-base tracking-[0.3em] compact:py-3 short:py-2",
      )}
    >
      <Wand2 className="size-6! transition-transform duration-500 group-hover:-rotate-12" strokeWidth={1.25} />
      詠唱を開始する
      <span className="font-display text-[10px] tracking-[0.3em] text-starlight/70">BEGIN THE CHANT</span>
    </Link>
  );

  const codexButton = (
    <Link
      href="/collection"
      className={cn(buttonVariants({ variant: "outline" }), "h-auto shrink-0 justify-start gap-2 rounded-2xl px-3 py-2 text-sm tracking-[0.2em]")}
    >
      <BookMarked className="size-4 text-starlight" strokeWidth={1.25} />
      <span className="flex flex-col items-start leading-tight">
        魔導図鑑
        <span className="font-display text-[9px] tracking-[0.25em] text-starlight/70">CODEX</span>
      </span>
    </Link>
  );

  const memoryCard = (
    <Card size="sm" className="min-h-0 flex-1 px-3">
      <h2 className="flex flex-col text-sm leading-tight tracking-[0.2em] whitespace-nowrap">
        詠唱の記憶
        <span className="font-display text-[9px] tracking-[0.25em] whitespace-normal text-starlight/60">OBSERVATIONAL MEMORY</span>
      </h2>
      {recentLogs.length === 0 ? (
        <p className="text-xs text-muted-foreground">まだ記憶は刻まれていません</p>
      ) : (
        <ul className="flex flex-col text-xs">
          {recentLogs.map((log) => (
            <li key={log.id} className="flex items-center gap-2 border-b border-white/[0.06] py-1.5 last:border-0">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: log.subject?.color, boxShadow: `0 0 6px ${log.subject?.color}` }}
              />
              <span className="min-w-0 tracking-wider">{log.subject?.name ?? "—"}</span>
              <span className="hidden text-[11px] whitespace-nowrap text-muted-foreground lg:inline">{MODE_LABEL[log.mode]}</span>
              <span className="ml-auto font-display whitespace-nowrap text-aqua">
                +{log.duration_minutes} <span className="text-[10px]">MP</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  if (portrait) {
    return (
      <>
        <AreaAmbience totalMp={profile.total_study_time} />
        {/* スマホ縦持ち: 詠唱への入口を上に置き、ほかは1列に並べて縦にスクロールする */}
        <div data-portrait-ready className="h-full scroll-area scrollbar-none">
          <div className="flex flex-col gap-3 px-4 pt-3 pb-8 animate-in fade-in duration-700">
            {profileCard}
            {chantButton}
            {stageCard}
            {totalsRow}
            <MenuTiles subjects={subjects} className="flex-none auto-rows-[4.25rem]" />
            <div className="aspect-square w-full">{radarCard}</div>
            {codexButton}
            {memoryCard}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AreaAmbience totalMp={profile.total_study_time} />
      {/* 1画面に収まらない低い画面（スマホ横持ちでブラウザの枠が出ているときなど）は、書庫ごと縦にスクロールさせる */}
      <div className="h-full scroll-area scrollbar-none">
        <div className="grid min-h-full grid-cols-12 grid-rows-1 gap-3 p-3 animate-in fade-in duration-700 short:gap-2 short:p-2 lg:gap-4 lg:p-5">
          {/* 左: プロフィール・ステージ・合計 */}
          <section className="col-span-4 flex min-h-0 flex-col gap-3 short:gap-2">
            {profileCard}
            {stageCard}
            {totalsRow}

            <MenuTiles subjects={subjects} />
          </section>

          {/* 中央: 魔法陣レーダーチャート */}
          {radarCard}

          {/* 右: 詠唱開始 & 詠唱の記憶 */}
          <section className="col-span-3 flex min-h-0 flex-col gap-3 short:gap-2">
            {chantButton}

            {codexButton}

            {memoryCard}
          </section>
        </div>
      </div>
    </>
  );
}

const tileClass = cn(
  buttonVariants({ variant: "outline" }),
  "group relative h-full min-h-0 flex-col gap-1 rounded-2xl px-2 py-2 text-sm tracking-[0.2em] whitespace-nowrap compact:flex-row compact:gap-2 short:py-1.5",
);

function TileContent({ icon: Icon, label, sub }: { icon: typeof Swords; label: string; sub: string }) {
  return (
    <>
      <Icon className="size-5! text-starlight transition-transform duration-500 group-hover:-rotate-6" strokeWidth={1.25} />
      {/* 低い画面ではアイコンだけを並べ、名前は title で伝える */}
      <span className="short:sr-only">{label}</span>
      <span className="font-display text-[9px] tracking-[0.25em] text-starlight/60 compact:hidden">{sub}</span>
    </>
  );
}

/** 左下の空きに並べる、詠唱・図鑑以外の行き先（星の試練はこの場でダイアログを開く） */
function MenuTiles({ subjects, className }: { subjects: Subject[]; className?: string }) {
  const data = useUserData();
  const [trialsOpen, setTrialsOpen] = useState(false);
  const [worldlinesOpen, setWorldlinesOpen] = useState(false);
  const ready = readyCount(data);

  // 受け取れる報酬の印を灯すため、表示した時点の進捗に測り直す
  useEffect(() => {
    userActions.syncTasks(subjects);
  }, [subjects]);

  return (
    <div className={cn("grid min-h-12 flex-1 grid-cols-2 gap-2 short:min-h-9 short:grid-cols-4", className)}>
      <button type="button" onClick={() => setTrialsOpen(true)} aria-haspopup="dialog" title="星の試練" className={cn(tileClass, ready > 0 && "claim-glow border-starlight/45")}>
        <TileContent icon={Swords} label="星の試練" sub="TRIALS" />
        {ready > 0 && (
          <span className="absolute top-2 right-2 rounded-full border border-starlight/50 bg-starlight/10 px-1.5 font-display text-[10px] tracking-normal text-starlight">
            {ready}
          </span>
        )}
      </button>
      <Link href="/history" title="魔導の軌跡" className={tileClass}>
        <TileContent icon={CalendarDays} label="魔導の軌跡" sub="CHRONICLE" />
      </Link>
      <button type="button" onClick={() => setWorldlinesOpen(true)} aria-haspopup="dialog" title="結びし世界線" className={tileClass}>
        <TileContent icon={Orbit} label="結びし世界線" sub="BOUND WORLDLINES" />
      </button>
      <Link href="/settings" title="設定" className={tileClass}>
        <TileContent icon={Settings} label="設定" sub="SETTINGS" />
      </Link>
      {trialsOpen && <TrialsDialog subjects={subjects} onClose={() => setTrialsOpen(false)} />}
      {worldlinesOpen && <BoundWorldlinesDialog onClose={() => setWorldlinesOpen(false)} />}
    </div>
  );
}
