import { Suspense } from "react";
import Link from "next/link";
import { BookMarked, Moon, Sparkles, Sun, Wand2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AreaAmbience } from "@/components/area-ambience";
import { PageLoading } from "@/components/page-loading";
import { MpBar } from "@/components/mp-bar";
import { RadarPanel } from "@/components/radar-panel";
import { StageCard } from "@/components/stage-card";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WizardAvatar } from "@/components/wizard-avatar";
import { getDashboardData } from "@/lib/data";
import { formatMinutes, levelProgress } from "@/lib/game";
import { cn } from "@/lib/utils";

const MODE_LABEL = { pomodoro: "ポモドーロ", stopwatch: "ストップウォッチ" } as const;

async function HomeContent() {
  const { profile, totals, radar, recentLogs } = await getDashboardData();
  const level = levelProgress(profile.total_study_time);

  return (
    <>
      <AreaAmbience totalMp={profile.total_study_time} />
      <div className="grid min-h-full grid-cols-12 gap-3 p-3 lg:gap-4 lg:p-5">
        {/* 左: プロフィール・ステージ・合計 */}
        <section className="col-span-4 flex flex-col gap-3">
          <Card className="gap-3 px-4">
            <div className="flex items-center gap-3">
              <WizardAvatar avatar={profile.avatar_url} />
              <div className="min-w-0">
                <p className="truncate text-base tracking-wider">{profile.username}</p>
                <p className="text-[11px] tracking-[0.2em] text-muted-foreground">見習い魔法使い</p>
              </div>
              <div className="ml-auto text-right">
                <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">LEVEL</p>
                <p className="font-display text-3xl leading-none text-starlight-gradient">{level.level}</p>
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2 text-[11px] tracking-wider">
                <span className="text-muted-foreground">
                  累積魔力 <span className="font-display text-foreground">{profile.total_study_time.toLocaleString()}</span>
                  <span className="font-display"> MP</span>
                </span>
                <span className="text-muted-foreground">
                  次のLvまで <span className="font-display text-aqua">{level.remaining}</span>
                  <span className="font-display"> MP</span>
                </span>
              </div>
              <MpBar ratio={level.ratio} />
            </div>
          </Card>

          <StageCard totalMp={profile.total_study_time} />

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "今日", value: totals.today, icon: Sun },
              { label: "今週", value: totals.week, icon: Moon },
              { label: "今月", value: totals.month, icon: Sparkles },
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

        {/* 右: 詠唱開始 & 直近ログ */}
        <section className="col-span-3 flex flex-col gap-3">
          <Link
            href="/timer"
            className={cn(
              buttonVariants({ size: "lg" }),
              "group h-auto flex-col gap-1.5 rounded-2xl py-5 text-base tracking-[0.3em] short:py-2",
            )}
          >
            <Wand2 className="size-6! transition-transform duration-500 group-hover:-rotate-12" strokeWidth={1.25} />
            詠唱を始める
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
            <h2 className="text-sm tracking-[0.2em]">最近の詠唱記録</h2>
            {recentLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground">まだ記録がありません</p>
            ) : (
              <ul className="flex flex-col text-xs">
                {recentLogs.map((log) => (
                  <li key={log.id} className="flex items-center gap-2 border-b border-white/[0.06] py-1.5 last:border-0">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: log.subject?.color, boxShadow: `0 0 6px ${log.subject?.color}` }}
                    />
                    <span className="min-w-0 truncate tracking-wider">{log.subject?.name ?? "—"}</span>
                    <span className="hidden text-[11px] text-muted-foreground lg:inline">{MODE_LABEL[log.mode]}</span>
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

export default function HomePage() {
  return (
    <AppShell>
      <Suspense fallback={<PageLoading />}>
        <HomeContent />
      </Suspense>
    </AppShell>
  );
}
