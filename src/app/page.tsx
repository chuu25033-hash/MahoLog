import { Suspense } from "react";
import Link from "next/link";
import { Clock, Flame, Map, Sparkles, Wand2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageLoading } from "@/components/page-loading";
import { MpBar } from "@/components/mp-bar";
import { RadarPanel } from "@/components/radar-panel";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WizardAvatar } from "@/components/wizard-avatar";
import { getDashboardData } from "@/lib/data";
import { formatMinutes, levelProgress, stageProgress } from "@/lib/game";
import { cn } from "@/lib/utils";

const MODE_LABEL = { pomodoro: "ポモドーロ", stopwatch: "ストップウォッチ" } as const;

async function HomeContent() {
  const { profile, totals, radar, recentLogs } = await getDashboardData();
  const level = levelProgress(profile.total_study_time);
  const stage = stageProgress(profile.total_study_time);

  return (
    <>
      <div className="grid min-h-full grid-cols-12 gap-3 p-3 lg:gap-4 lg:p-5">
        {/* 左: プロフィール・ステージ・合計 */}
        <section className="col-span-4 flex flex-col gap-3">
          <Card className="gap-3 px-4">
            <div className="flex items-center gap-3">
              <WizardAvatar avatar={profile.avatar_url} />
              <div className="min-w-0">
                <p className="truncate font-bold">{profile.username}</p>
                <p className="text-xs text-muted-foreground">見習い魔法使い</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-[10px] text-muted-foreground">LEVEL</p>
                <p className="text-2xl leading-none font-extrabold text-primary">{level.level}</p>
              </div>
            </div>
            <div>
              <div className="mb-1 flex flex-wrap justify-between gap-x-2 text-xs">
                <span className="text-muted-foreground">累積魔力 {profile.total_study_time.toLocaleString()} MP</span>
                <span>次のLvまで {level.remaining} MP</span>
              </div>
              <MpBar ratio={level.ratio} />
            </div>
          </Card>

          <Card
            className={cn(
              "relative gap-2 bg-gradient-to-br px-4 ring-primary/30",
              stage.current.gradient,
            )}
          >
            <div className="flex items-center gap-2 text-xs text-primary">
              <Map className="size-4" />
              STAGE {stage.current.id}
            </div>
            <p className="text-lg font-extrabold">{stage.current.name}</p>
            <p className="text-xs text-muted-foreground short:hidden">{stage.current.description}</p>
            {stage.next ? (
              <div className="mt-1">
                <MpBar ratio={stage.ratio} variant="stage" />
                <p className="mt-1 text-xs">
                  次のステージ「{stage.next.name}」まで あと
                  <span className="mx-1 font-bold text-primary">{formatMinutes(stage.remainingMinutes)}</span>
                </p>
              </div>
            ) : (
              <p className="text-xs text-primary">全ステージ制覇！</p>
            )}
          </Card>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "今日", value: totals.today, icon: Flame },
              { label: "今週", value: totals.week, icon: Clock },
              { label: "今月", value: totals.month, icon: Sparkles },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} size="sm" className="items-center gap-1 px-2 text-center">
                <Icon className="size-4 text-primary" />
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className="text-sm font-bold short:text-xs">{formatMinutes(value)}</p>
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
              "h-auto flex-col gap-1 rounded-2xl py-4 text-base font-extrabold shadow-lg shadow-primary/30 short:py-2",
            )}
          >
            <Wand2 className="size-6!" />
            詠唱を始める
            <span className="text-[10px] font-normal opacity-80">勉強タイマーへ</span>
          </Link>

          <Card size="sm" className="min-h-0 flex-1 px-3">
            <h2 className="text-sm font-bold">最近の詠唱記録</h2>
            {recentLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground">まだ記録がありません</p>
            ) : (
              <ul className="flex flex-col gap-2 text-xs">
                {recentLogs.map((log) => (
                  <li key={log.id} className="flex items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: log.subject?.color }}
                    />
                    <span className="min-w-0 truncate">{log.subject?.name ?? "—"}</span>
                    <span className="hidden text-muted-foreground lg:inline">{MODE_LABEL[log.mode]}</span>
                    <span className="ml-auto font-bold whitespace-nowrap">+{log.duration_minutes} MP</span>
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
