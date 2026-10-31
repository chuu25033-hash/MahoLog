"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookMarked, CalendarDays, Crown, Moon, Orbit, Settings, Sparkles, Sun, Swords, Wand2 } from "lucide-react";
import { AreaAmbience } from "@/components/area-ambience";
import { BoundWorldlinesDialog } from "@/components/bound-worldlines-dialog";
import { CycleRings } from "@/components/cycle/cycle-rings";
import { MpBar } from "@/components/mp-bar";
import { KeyBackupReminder } from "@/components/observer/key-backup";
import { LibraryTour } from "@/components/tour/library-tour";
import { PageLoading } from "@/components/page-loading";
import { WhisperText, whisperHost } from "@/components/whisper";
import { RadarPanel } from "@/components/radar-panel";
import { ShareRecordButton } from "@/components/share-record";
import { StageCard } from "@/components/stage-card";
import { GRADE_NAME_TONE, TitlesDialog, titleGrade } from "@/components/titles/titles-dialog";
import { TrialsDialog, readyCount } from "@/components/trials-dialog";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WizardAvatar } from "@/components/wizard-avatar";
import { ArrowGlyph, RankSigil } from "@/components/arcane-icons";
import { dashboardSummary, type DashboardSummary } from "@/lib/aggregate";
import { cycleLabel } from "@/lib/cycles";
import { formatMinutes, levelProgress, rankOf } from "@/lib/game";
import { sessionElapsedMs, useChantSession, type ChantSession } from "@/lib/chant-session";
import { activeSubjectsOf } from "@/lib/subjects";
import { usePortraitPhone } from "@/lib/use-portrait-phone";
import type { Subject } from "@/lib/types";
import { equippedTitle, localProfile, localStudyLogs, useStoredUserData, userActions, useUserData } from "@/lib/user-store";
import { GLYPHS, type Glyph } from "@/lib/glyphs";
import { cn } from "@/lib/utils";

const MODE_LABEL = { pomodoro: "律動の詠唱", stopwatch: "無窮の詠唱" } as const;

/**
 * 魔術書庫。デモモードでは端末に保存した観測データから集計する。
 * 魔法陣（レーダー）は設定画面で選んだ「詠唱に使う科目」だけで描く
 */
export function DashboardView({ summary, subjects, isDemo }: { summary: DashboardSummary; subjects: Subject[]; isDemo: boolean }) {
  const stored = useStoredUserData();
  if (!stored) return <PageLoading />;
  const summed = isDemo ? dashboardSummary(localProfile(stored), subjects, localStudyLogs(stored)) : summary;
  // 紋章は設定画面で選び、端末に保存したものを掲げる
  const base = { ...summed, profile: { ...summed.profile, avatar_url: stored.userProfile.avatar } };
  const activeIds = new Set(activeSubjectsOf(subjects, stored.userProfile.activeSubjects).map((s) => s.id));
  const radar = Object.fromEntries(
    Object.entries(base.radar).map(([range, totals]) => [range, totals.filter((t) => activeIds.has(t.subjectId))]),
  ) as DashboardSummary["radar"];
  return (
    <>
      <Dashboard {...base} radar={radar} subjects={subjects} />
      {/* 最初の詠唱を終えて書庫に戻ったとき、復元キーをまだ控えていなければ保存を促す。
          守る記録ができる前に鍵の話をして、覗きに来た人を引き留めないよう、初めての来訪では促さない */}
      <KeyBackupReminder />
      {/* 初めて書庫に入ったときは、各ボタンを巡る案内を見せる */}
      <LibraryTour />
    </>
  );
}

function Dashboard({ profile, totals, radar, recentLogs, subjects }: DashboardSummary & { subjects: Subject[] }) {
  const data = useUserData();
  const level = levelProgress(profile.total_study_time);
  const rank = rankOf(level.level);
  const title = equippedTitle(data);
  const [titlesOpen, setTitlesOpen] = useState(false);
  const laps = data.cycle.count - 1;
  const portrait = usePortraitPhone();

  const profileCard = (
    <Card data-tour="profile" className="shrink-0 gap-3 px-4 compact:gap-2 compact:py-3 short:py-2">
      <div className="flex items-center gap-3">
        {/* 巡り終えた周天の数だけ、周回リングが外周を回る */}
        <div className={cn(whisperHost, "shrink-0")}>
          <WizardAvatar avatar={profile.avatar_url} className="short:size-9" />
          <CycleRings laps={laps} className="absolute -inset-2" />
          {laps > 0 && <WhisperText text={`${cycleLabel(data.cycle.count)}（${laps}周を巡り終えた）`} />}
        </div>
        <div className="min-w-0">
          {/* 称号と名前に触れると、掲げる称号を選べる */}
          <button
            type="button"
            onClick={() => setTitlesOpen(true)}
            aria-haspopup="dialog"
            className={cn(whisperHost, "text-left text-base tracking-wider transition-colors duration-300 hover:text-starlight")}
          >
            {title ? (
              <span className={cn("mr-1 text-[11px] tracking-[0.15em]", GRADE_NAME_TONE[titleGrade(title)])}>【{title.name}】</span>
            ) : (
              <span className="text-[11px] tracking-[0.2em] text-muted-foreground">秘術探究者・</span>
            )}
            {profile.username}
            <Crown className="ml-1.5 inline size-3 align-baseline text-starlight/50" strokeWidth={1.25} aria-hidden />
            <WhisperText text="掲げる称号を選ぶ" />
          </button>
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
      {titlesOpen && <TitlesDialog onClose={() => setTitlesOpen(false)} />}
    </Card>
  );

  const stageCard = (
    <StageCard data-tour="stage" totalMp={profile.total_study_time} className="shrink-0 compact:py-3 short:py-2" />
  );

  const totalsRow = (
    <div data-tour="totals" className="grid shrink-0 grid-cols-3 gap-2">
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
    <Card data-tour="radar" className="relative col-span-5 h-full min-h-0 px-4 short:py-3">
      <CornerMarks />
      <RadarPanel
        data={radar}
        action={
          <ShareRecordButton
            record={{
              avatar: profile.avatar_url,
              username: profile.username,
              title: title?.name ?? null,
              titleGrade: title ? titleGrade(title) : null,
              rankNumeral: rank.numeral,
              rankTitle: rank.title,
              phase: level.level,
              totalMp: profile.total_study_time,
              weekMinutes: radar.week.reduce((acc, t) => acc + t.minutes, 0),
              radar: radar.week,
            }}
          />
        }
      />
    </Card>
  );

  const chantButton = <ChantButton />;

  const codexButton = (
    <Link
      href="/collection"
      data-tour="codex"
      className={cn(
        buttonVariants({ variant: "outline" }),
        "group relative h-auto shrink-0 justify-start gap-3 overflow-hidden rounded-2xl px-4 py-4 text-base tracking-[0.2em] compact:py-2.5 short:py-2",
      )}
    >
      <CornerMarks />
      <BackdropGlyph glyph="tome" className="-right-[6%] top-1/2 size-[130%] max-w-28 -translate-y-1/2" />
      <span className="relative grid size-11 shrink-0 place-items-center rounded-full border border-starlight/30 shadow-[0_0_12px_-4px_rgba(226,201,116,0.5)] compact:size-8">
        <span className="absolute inset-1 rounded-full border border-dashed border-starlight/20" aria-hidden />
        <BookMarked className="size-5! text-starlight transition-transform duration-500 group-hover:-rotate-6" strokeWidth={1.25} />
      </span>
      <span className="relative flex flex-col items-start leading-tight">
        魔導図鑑
        <span className="font-display text-[9px] tracking-[0.25em] text-starlight/70">CODEX</span>
        <span className="mt-1 text-[10px] tracking-[0.15em] whitespace-nowrap text-muted-foreground short:hidden">遺物・古代文書・錬成陣</span>
      </span>
    </Link>
  );

  const memoryCard = (limit: number, className?: string) => (
    <Card data-tour="memory" size="sm" className={cn("min-h-0 px-3", className)}>
      <h2 className="flex flex-col text-sm leading-tight tracking-[0.2em] whitespace-nowrap">
        詠唱の記憶
        <span className="font-display text-[9px] tracking-[0.25em] whitespace-normal text-starlight/60">OBSERVATIONAL MEMORY</span>
      </h2>
      {recentLogs.length === 0 ? (
        <p className="text-xs text-muted-foreground">まだ記憶は刻まれていません</p>
      ) : (
        <ul className="flex flex-col text-xs">
          {recentLogs.slice(0, limit).map((log) => (
            <li key={log.id} className="flex items-center gap-2 border-b border-white/[0.06] py-1.5 last:border-0">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: log.subject?.color, boxShadow: `0 0 6px ${log.subject?.color}` }}
              />
              <span className="min-w-0 tracking-wider">{log.subject?.name ?? "—"}</span>
              <span className="hidden text-[11px] whitespace-nowrap text-muted-foreground lg:inline">{log.manual ? "書き留め" : MODE_LABEL[log.mode]}</span>
              <span className="ml-auto font-display whitespace-nowrap text-aqua">
                +{log.duration_minutes} <span className="text-[10px]">MP</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link href="/history" className="-mt-1 self-end text-[10px] tracking-[0.2em] text-muted-foreground transition-colors hover:text-starlight">
        魔導の軌跡で見る <ArrowGlyph />
      </Link>
    </Card>
  );

  if (portrait) {
    return (
      <>
        <AreaAmbience totalMp={profile.total_study_time} />
        {/* スマホ縦持ち: 詠唱への入口を上に置き、ほかは1列に並べて縦にスクロールする */}
        <div className="h-full scroll-area scrollbar-none">
          <div className="flex flex-col gap-3 px-4 pt-3 pb-8 animate-in fade-in duration-700">
            {profileCard}
            {chantButton}
            {stageCard}
            {totalsRow}
            <MenuTiles subjects={subjects} className="flex-none auto-rows-[8rem]" />
            <div className="aspect-square w-full">{radarCard}</div>
            {codexButton}
            {memoryCard(5)}
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
            {/* 詠唱の扉は大きく取りつつ上限を設け、残りの高さに記憶を収まるだけ並べる */}
            <ChantButton className="max-h-[36dvh] min-h-32 flex-[1.4] text-lg short:min-h-0 short:flex-none short:text-base" />

            {codexButton}

            {memoryCard(6, "flex-1 overflow-hidden")}
          </section>
        </div>
      </div>
    </>
  );
}

const tileClass = cn(
  buttonVariants({ variant: "outline" }),
  // 枠そのものの高さで、入りきらない行を省く（tile-cramped）。画面の高さだけでは決めない
  "group relative h-full min-h-0 flex-col gap-1 overflow-hidden rounded-2xl px-2 py-2 text-sm tracking-[0.2em] whitespace-nowrap [container:tile/size] compact:flex-row compact:gap-3 short:py-1.5",
);

/**
 * メニューの中身: 飾り角と、隅に淡く敷いた線画の上に、輪で囲んだアイコン・名前・英字・ひとこと。
 * 画面が低めのときはアイコンの右に文字を並べる横長の形にし、枠が低くて入りきらないときだけ、ひとこと（tile-snug）・英字（tile-cramped）の順に省く。
 * とても低い画面ではアイコンだけを並べ、名前は aria-label で読み上げに伝える（ブラウザの説明の吹き出しは世界観を壊すので出さない）
 */
function TileContent({ icon: Icon, label, sub, note, glyph }: { icon: typeof Swords; label: string; sub: string; note: string; glyph: Glyph }) {
  return (
    <>
      <CornerMarks />
      <BackdropGlyph glyph={glyph} className="-right-[14%] -bottom-[22%] size-[78%] compact:-right-[6%] compact:-bottom-[35%] compact:size-[60%]" />
      <span className="relative grid size-11 shrink-0 place-items-center rounded-full border border-starlight/30 shadow-[0_0_12px_-4px_rgba(226,201,116,0.5)] compact:size-10 tile-snug:size-8 short:size-auto short:border-0 short:shadow-none">
        <span className="absolute inset-1 rounded-full border border-dashed border-starlight/20 short:hidden" aria-hidden />
        <Icon className="size-5! text-starlight transition-transform duration-500 group-hover:-rotate-6" strokeWidth={1.25} />
      </span>
      <span className="relative flex flex-col items-center gap-1 leading-tight compact:items-start short:sr-only">
        <span>{label}</span>
        <span className="font-display text-[9px] tracking-[0.25em] text-starlight/60 tile-cramped:hidden">{sub}</span>
        <span className="mt-1 text-[10px] tracking-[0.15em] whitespace-nowrap text-muted-foreground compact:mt-0 tile-snug:hidden">{note}</span>
      </span>
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
      <button type="button" data-tour="trials" onClick={() => setTrialsOpen(true)} aria-haspopup="dialog" aria-label="星の試練" className={cn(tileClass, ready > 0 && "claim-glow border-starlight/45")}>
        <TileContent icon={Swords} label="星の試練" sub="TRIALS" note="日課の儀式と週間の誓約" glyph="seal" />
        {ready > 0 && (
          <span className="absolute top-3 right-3 rounded-full border compact:top-1.5 compact:right-1.5 short:top-1 short:right-1 border-starlight/50 bg-starlight/10 px-1.5 font-display text-[10px] tracking-normal text-starlight">
            {ready}
          </span>
        )}
      </button>
      <Link href="/history" data-tour="history" aria-label="魔導の軌跡" className={tileClass}>
        <TileContent icon={CalendarDays} label="魔導の軌跡" sub="CHRONICLE" note="暦と星の記憶をたどる" glyph="starmap" />
      </Link>
      <button type="button" data-tour="worldlines" onClick={() => setWorldlinesOpen(true)} aria-haspopup="dialog" aria-label="結びし世界線" className={tileClass}>
        <TileContent icon={Orbit} label="結びし世界線" sub="BOUND WORLDLINES" note="遠い観測者の気配" glyph="armillary" />
      </button>
      <Link href="/settings" data-tour="settings" aria-label="設定" className={tileClass}>
        <TileContent icon={Settings} label="設定" sub="SETTINGS" note="名・紋章・音・観測者ID" glyph="gear" />
      </Link>
      {trialsOpen && <TrialsDialog subjects={subjects} onClose={() => setTrialsOpen(false)} />}
      {worldlinesOpen && <BoundWorldlinesDialog onClose={() => setWorldlinesOpen(false)} />}
    </div>
  );
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const mmss = `${String(Math.floor((total % 3600) / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

/** 詠唱の間の様子をひとことで（律動の詠唱は残り時間、無窮の詠唱は経過時間） */
function chantStatus(session: ChantSession, now: number) {
  if (session.phase !== "focus") return "静息中";
  if (session.clock.startedAt === null) return "詠唱中断";
  const elapsed = sessionElapsedMs(session, now);
  if (session.mode === "stopwatch") return `詠唱中 ${formatClock(elapsed)}`;
  const left = session.focusMin * 60_000 - elapsed;
  return left > 0 ? `残り ${formatClock(left)}` : "詠唱完了 — 戻って刻む";
}

/** 詠唱を始める扉。詠唱の途中で書庫に来ていれば、詠唱の間へ戻る扉として様子を映す */
function ChantButton({ className }: { className?: string }) {
  const session = useChantSession();
  const ticking = session !== null && session.clock.startedAt !== null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  return (
    <Link
      href="/timer"
      data-tour="chant"
      className={cn(
        buttonVariants({ size: "lg" }),
        "group relative h-auto shrink-0 flex-col gap-1.5 overflow-hidden rounded-2xl py-5 text-base tracking-[0.3em] compact:py-3 short:py-2",
        session && "shadow-[0_0_18px_-4px_rgba(226,201,116,0.6)]",
        className,
      )}
    >
      {/* 背後でゆっくり巡る魔法陣の輪 */}
      <ChantRings />
      <Wand2 className="relative size-6! transition-transform duration-500 group-hover:-rotate-12 lg:size-8!" strokeWidth={1.25} />
      <span className="relative">{session ? "詠唱の間へ戻る" : "詠唱を開始する"}</span>
      <span className="relative font-display text-[10px] tracking-[0.3em] text-starlight/70">
        {session ? "RETURN TO THE CHANT" : "BEGIN THE CHANT"}
      </span>
      {session && <span className="relative text-[11px] tracking-[0.2em] text-aqua/90 glimmer">{chantStatus(session, now)}</span>}
    </Link>
  );
}

/** 詠唱の扉の背後で巡る、淡い魔法陣の輪（ルーンの刻みと六芒星） */
function ChantRings() {
  return (
    <svg
      viewBox="-100 -100 200 200"
      // ボタンの「中の SVG を小さく揃える」指定から外すため、大きさは size-auto と style で決める
      style={{ width: "118%", height: "auto" }}
      className="pointer-events-none absolute top-1/2 left-1/2 size-auto max-w-none -translate-x-1/2 -translate-y-1/2 animate-spin-slow text-starlight opacity-[0.13] transition-opacity duration-700 group-hover:opacity-25 short:hidden"
      fill="none"
      stroke="currentColor"
      aria-hidden
    >
      <circle r="92" vectorEffect="non-scaling-stroke" />
      <circle r="84" strokeDasharray="1 5" vectorEffect="non-scaling-stroke" />
      <circle r="58" vectorEffect="non-scaling-stroke" />
      <polygon points="0,-58 50.2,29 -50.2,29" vectorEffect="non-scaling-stroke" />
      <polygon points="0,58 50.2,-29 -50.2,-29" vectorEffect="non-scaling-stroke" />
      {Array.from({ length: 24 }, (_, i) => (
        <line key={i} y1="-92" y2="-86" transform={`rotate(${i * 15})`} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

/** 枠の四隅に置く 1px の飾り角 */
function CornerMarks() {
  return (
    <span className="pointer-events-none absolute inset-1.5 short:hidden" aria-hidden>
      <span className="absolute top-0 left-0 size-2.5 border-t border-l border-starlight/35" />
      <span className="absolute top-0 right-0 size-2.5 border-t border-r border-starlight/35" />
      <span className="absolute bottom-0 left-0 size-2.5 border-b border-l border-starlight/35" />
      <span className="absolute right-0 bottom-0 size-2.5 border-r border-b border-starlight/35" />
    </span>
  );
}

/** 枠の隅に淡く敷く、その場所を表す大きな線画 */
function BackdropGlyph({ glyph, className }: { glyph: Glyph; className?: string }) {
  return (
    <svg
      viewBox="-34 -34 68 68"
      className={cn(
        "pointer-events-none absolute text-starlight opacity-[0.1] transition-all duration-700 group-hover:opacity-[0.2] group-hover:rotate-6 short:hidden",
        className,
      )}
      aria-hidden
    >
      <circle r="32" fill="none" stroke="currentColor" strokeDasharray="1 3" vectorEffect="non-scaling-stroke" />
      <path d={GLYPHS[glyph]} fill="none" stroke="currentColor" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
