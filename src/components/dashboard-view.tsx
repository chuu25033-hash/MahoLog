"use client";

import Link from "next/link";
import { BookMarked, Moon, Sparkles, Sun, Wand2 } from "lucide-react";
import { AreaAmbience } from "@/components/area-ambience";
import { MpBar } from "@/components/mp-bar";
import { PageLoading } from "@/components/page-loading";
import { RadarPanel } from "@/components/radar-panel";
import { StageCard } from "@/components/stage-card";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WizardAvatar } from "@/components/wizard-avatar";
import { WorldlineEchoes } from "@/components/worldline-echoes";
import { dashboardSummary, type DashboardSummary } from "@/lib/aggregate";
import { formatMinutes, levelProgress, rankOf } from "@/lib/game";
import type { Subject } from "@/lib/types";
import { localProfile, localStudyLogs, useStoredUserData } from "@/lib/user-store";
import { cn } from "@/lib/utils";

const MODE_LABEL = { pomodoro: "律動の詠唱", stopwatch: "無窮の詠唱" } as const;

/** 魔術書庫。デモモードでは端末に保存した観測データから集計する */
export function DashboardView({ summary, subjects, isDemo }: { summary: DashboardSummary; subjects: Subject[]; isDemo: boolean }) {
  const stored = useStoredUserData();
  if (!isDemo) return <Dashboard {...summary} />;
  if (!stored) return <PageLoading />;
  return <Dashboard {...dashboardSummary(localProfile(stored), subjects, localStudyLogs(stored))} />;
}

function Dashboard({ profile, totals, radar, recentLogs }: DashboardSummary) {
  const level = levelProgress(profile.total_study_time);
  const rank = rankOf(level.level);

  return (
    <>
      <AreaAmbience totalMp={profile.total_study_time} />
      <WorldlineEchoes />
      {/* 隙間は背景の世界線の残光へホバーを通す */}
      <div data-open-sky className="scroll-area grid h-full grid-cols-12 gap-3 p-3 animate-in fade-in duration-700 lg:gap-4 lg:p-5">
        {/* 左: プロフィール・ステージ・合計 */}
        <section className="col-span-4 flex flex-col gap-3">
          <Card className="gap-3 px-4">
            <div className="flex items-center gap-3">
              <WizardAvatar avatar={profile.avatar_url} />
              <div className="min-w-0">
                <p className="truncate text-base tracking-wider whitespace-nowrap">
                  <span className="text-[11px] tracking-[0.2em] text-muted-foreground">秘術探究者・</span>
                  {profile.username}
                </p>
                <p className="truncate text-[11px] tracking-[0.2em] whitespace-nowrap text-starlight/85">
                  <span className="mr-1.5 font-display text-[10px] tracking-[0.2em] text-starlight/60">RANK {rank.numeral}</span>
                  {rank.title}
                </p>
              </div>
              <div className="ml-auto shrink-0 text-right">
                <p className="text-[10px] tracking-[0.3em] whitespace-nowrap text-muted-foreground">探求度</p>
                <p className="font-display text-3xl leading-none text-starlight-gradient">{level.level}</p>
                <p className="font-display text-[9px] tracking-[0.2em] whitespace-nowrap text-starlight/60">PHASE {level.level}</p>
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2 text-[11px] tracking-wider">
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

          <StageCard totalMp={profile.total_study_time} />

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "今宵", value: totals.today, icon: Sun },
              { label: "七夜", value: totals.week, icon: Moon },
              { label: "月巡り", value: totals.month, icon: Sparkles },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} size="sm" className="items-center gap-1 px-2 text-center">
                <Icon className="size-4 text-aqua/80" strokeWidth={1.25} />
                <p className="text-[10px] tracking-[0.3em] text-muted-foreground">{label}</p>
                <p className="text-sm tracking-wider short:text-xs">{formatMinutes(value)}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* 中央: 魔法陣レーダーチャート */}
        <Card className="col-span-5 min-h-72 px-4 short:min-h-64">
          <RadarPanel data={radar} />
        </Card>

        {/* 右: 詠唱開始 & 詠唱の記憶 */}
        <section className="col-span-3 flex flex-col gap-3">
          <Link
            href="/timer"
            className={cn(
              buttonVariants({ size: "lg" }),
              "group h-auto flex-col gap-1.5 rounded-2xl py-5 text-base tracking-[0.3em] short:py-2",
            )}
          >
            <Wand2 className="size-6! transition-transform duration-500 group-hover:-rotate-12" strokeWidth={1.25} />
            詠唱を開始する
            <span className="font-display text-[10px] tracking-[0.3em] text-starlight/70">BEGIN THE CHANT</span>
          </Link>

          <Link
            href="/collection"
            className={cn(buttonVariants({ variant: "outline" }), "h-auto justify-start gap-2 rounded-2xl px-3 py-2 text-sm tracking-[0.2em]")}
          >
            <BookMarked className="size-4 text-starlight" strokeWidth={1.25} />
            魔導図鑑
            <span className="ml-auto font-display text-[10px] tracking-[0.25em] text-starlight/70">CODEX</span>
          </Link>

          <Card size="sm" className="min-h-0 flex-1 px-3">
            <h2 className="flex items-baseline gap-2 text-sm tracking-[0.2em] whitespace-nowrap">
              詠唱の記憶
              <span className="min-w-0 truncate font-display text-[9px] tracking-[0.25em] text-starlight/60">OBSERVATIONAL MEMORY</span>
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
                    <span className="min-w-0 truncate tracking-wider">{log.subject?.name ?? "—"}</span>
                    <span className="hidden text-[11px] whitespace-nowrap text-muted-foreground lg:inline">{MODE_LABEL[log.mode]}</span>
                    <span className="ml-auto font-display whitespace-nowrap text-aqua">
                      +{log.duration_minutes} <span className="text-[10px]">MP</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}
