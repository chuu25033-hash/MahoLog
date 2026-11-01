"use client";

import { WhisperText, whisperHost } from "@/components/whisper";
import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BookOpen, Check, Compass, FlaskConical, Download, Feather, Hexagon, LogOut, Music, RotateCcw, ScrollText, Sparkle, Undo2, Unlock, Upload, UserRound, Volume2, Wind, Wrench } from "lucide-react";
import { ArrowGlyph } from "@/components/arcane-icons";
import { ObserverIdField } from "@/components/observer/observer-id";
import { BackToLibrary } from "@/components/back-to-library";
import { PageLoading } from "@/components/page-loading";
import { Prologue } from "@/components/prologue/prologue";
import { SubjectPicker } from "@/components/subject-picker";
import { SubjectRuneChip } from "@/components/subject-rune-chip";
import { WIZARD_AVATARS, WizardAvatar } from "@/components/wizard-avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsAdmin } from "@/lib/admin";
import { overrideCloud, startNewObserver } from "@/lib/cloud-sync";
import { THEME_LABEL, unlockedThemes } from "@/lib/cycles";
import { jstDateKey } from "@/lib/date";
import { resetLibraryTour } from "@/lib/onboarding";
import { soundManager } from "@/lib/sound/sound-manager";
import { MIN_ACTIVE_SUBJECTS, activeSubjectsOf, resolveSubSubject } from "@/lib/subjects";
import type { Subject } from "@/lib/types";
import { FOCUS_MINUTE_OPTIONS, hasDevBackup, initialUserData, userActions, useStoredUserData } from "@/lib/user-store";
import { cn } from "@/lib/utils";

const USERNAME_MAX = 16;

/** 設定画面: 探究者の情報・学習設定・演出・探求データの管理。Supabase 接続時はログアウトもここから */
export function SettingsView({
  subjects,
  isDemo,
  signOutAction,
}: {
  subjects: Subject[];
  isDemo: boolean;
  signOutAction?: () => Promise<void>;
}) {
  const data = useStoredUserData();
  if (!data) return <PageLoading />;
  const { userProfile, settings } = data;
  const activeSubjects = activeSubjectsOf(subjects, userProfile.activeSubjects);
  const mainSubject = activeSubjects.find((s) => s.id === userProfile.subject);

  return (
    <div className="scroll-area scrollbar-none flex h-full flex-col gap-4 short:gap-2 p-3 animate-in fade-in duration-700 portrait:px-4 portrait:pb-8 lg:p-5">
      <header className="flex items-center gap-4">
        <BackToLibrary />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-col text-xl leading-tight tracking-[0.25em] whitespace-nowrap short:text-base">
            秘術探究者の書斎
            <span className="font-display text-[9px] tracking-[0.3em] text-starlight/70">SETTINGS</span>
          </h1>
          <p className="text-xs tracking-wider text-muted-foreground [word-break:auto-phrase] short:hidden">
            探究者の名と詠唱の作法を定め、これまでの探求の記録を守ります
            {!isDemo && "（ここでの設定はこの端末に保存されます）"}
          </p>
        </div>
        {signOutAction && (
          <form action={signOutAction} className="shrink-0">
            <Button type="submit" variant="outline" size="sm">
              <LogOut /> ログアウト
            </Button>
          </form>
        )}
      </header>

      {/* 縦持ちでは3枚を縦に積み、枠ごとではなく画面全体をスクロールする */}
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-3 portrait:flex-none portrait:grid-cols-1 lg:gap-4">
        <Panel icon={UserRound} title="探究者と演出" label="SCHOLAR">
          <Field label="探究者名" hint={`${userProfile.username.length} / ${USERNAME_MAX}`}>
            <input
              value={userProfile.username}
              maxLength={USERNAME_MAX}
              onChange={(e) => userActions.setUsername(e.target.value)}
              onBlur={(e) => userActions.setUsername(e.target.value.trim() || initialUserData().userProfile.username)}
              className="h-9 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 text-sm tracking-wider outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-starlight/55 focus-visible:shadow-[0_0_12px_-3px_rgba(226,201,116,0.45)]"
              aria-label="探究者名"
            />
          </Field>

          <Field label="紋章" hint={WIZARD_AVATARS[userProfile.avatar]?.name}>
            <div className="flex justify-between gap-3 px-2 py-2">
              {Object.entries(WIZARD_AVATARS).map(([id, { name }]) => (
                <button
                  key={id}
                  onClick={() => userActions.setAvatar(id)}
                  aria-pressed={id === userProfile.avatar}
                  aria-label={name}
                  className={cn(
                    whisperHost,
                    "rounded-full transition-all duration-300",
                    id === userProfile.avatar ? "opacity-100" : "opacity-45 grayscale-[0.4] hover:opacity-80",
                  )}
                >
                  <WizardAvatar
                    avatar={id}
                    className={cn("size-10 short:size-8", id !== userProfile.avatar && "shadow-none ring-white/15")}
                  />
                  <WhisperText text={name} />
                </button>
              ))}
            </div>
          </Field>

          <ObserverIdField />

          <Field label="デフォルト詠唱時間" hint="律動の詠唱の初期集中時間">
            <div className="grid grid-cols-4 gap-1.5">
              {FOCUS_MINUTE_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => userActions.updateSettings({ defaultFocusMinutes: m })}
                  aria-pressed={m === settings.defaultFocusMinutes}
                  className={cn(
                    "rounded-xl border py-1.5 font-display text-base transition-all duration-300",
                    m === settings.defaultFocusMinutes
                      ? "border-starlight/55 bg-starlight/[0.08] text-starlight shadow-[0_0_12px_-3px_rgba(226,201,116,0.45)]"
                      : "border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground",
                  )}
                >
                  {m}
                  <span className="ml-0.5 font-serif text-[10px]">分</span>
                </button>
              ))}
            </div>
          </Field>

          {data.cycle.count > 1 && (
            <Field label="光の線の色調" hint="周天の章で開かれる">
              <div className="grid grid-cols-3 gap-1.5">
                {unlockedThemes(data.cycle.count).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => userActions.updateSettings({ chapterTheme: theme })}
                    aria-pressed={theme === settings.chapterTheme}
                    className={cn(
                      whisperHost,
                      "flex items-center justify-center gap-1.5 rounded-xl border py-1.5 text-xs tracking-[0.2em] transition-all duration-300",
                      theme === settings.chapterTheme
                        ? "border-starlight/55 bg-starlight/[0.08] text-starlight"
                        : "border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground",
                    )}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ background: THEME_LABEL[theme].swatch, boxShadow: `0 0 6px ${THEME_LABEL[theme].swatch}` }}
                    />
                    {THEME_LABEL[theme].name}
                    <WhisperText text={THEME_LABEL[theme].description} />
                  </button>
                ))}
              </div>
            </Field>
          )}

          <Field label="環境と演出">
            <div className="flex flex-col gap-2">
              <ToggleRow
                icon={Feather}
                label="演出の軽量化"
                description="星屑や粒子を間引き、常に動くアニメーションを止めて軽くします"
                checked={settings.liteMode}
                onChange={(liteMode) => userActions.updateSettings({ liteMode })}
              />
              <ToggleRow
                icon={Bell}
                label="詠唱完了の報せ"
                description="詠唱や静息を終えたとき、静かなベルの音と振動で知らせます"
                checked={settings.chime}
                onChange={(chime) => userActions.updateSettings({ chime })}
              />
            </div>
          </Field>

          <PrologueReplay />
        </Panel>

        <Panel icon={Hexagon} title="詠唱の領域" label="DOMAINS">
          <ActiveSubjectsField subjects={subjects} activeIds={activeSubjects.map((s) => s.id)} />

          <Field
            label={
              <span>
                主軸カテゴリ <ArrowGlyph /> 詳細科目
              </span>
            }
            hint="詠唱画面で最初に選ばれます"
          >
            <SubjectPicker
              subjects={activeSubjects}
              subjectId={mainSubject?.id ?? null}
              subSubject={mainSubject ? userProfile.subSubject : null}
              onChange={(subject, subSubject) => userActions.setSubject(subject, subSubject)}
              allowNone
            />
            {mainSubject && (
              <SubjectRuneChip
                name={mainSubject.name}
                subSubject={resolveSubSubject(mainSubject, userProfile.subSubject)}
                color={mainSubject.color}
                className="mt-3"
              />
            )}
          </Field>
        </Panel>

        <Panel icon={ScrollText} title="音と記録" label="SOUND & ARCHIVE">
          <Field label="音の響き" hint="滞在する地の環境音と、操作の効果音">
            <div className="flex flex-col gap-2">
              <ToggleRow
                icon={Volume2}
                label="音声"
                description="すべての環境音と効果音を鳴らします。切ると完了の報せも振動だけになります"
                checked={settings.sound}
                onChange={(sound) => userActions.updateSettings({ sound })}
              />
              <VolumeRow
                icon={Wind}
                label="環境音"
                value={settings.bgmVolume}
                disabled={!settings.sound}
                onChange={(bgmVolume) => userActions.updateSettings({ bgmVolume })}
              />
              <VolumeRow
                icon={Sparkle}
                label="効果音"
                value={settings.seVolume}
                disabled={!settings.sound}
                onChange={(seVolume) => userActions.updateSettings({ seVolume })}
                onCommit={() => soundManager.playSe("tap")}
              />
              {/* 環境音のピアノの録音は CC-BY 3.0。作者の表示がライセンスの条件 */}
              <p className="mt-1 text-[10px] leading-relaxed tracking-wider text-muted-foreground/60">
                ピアノの音: Salamander Grand Piano by Alexander Holm（
                <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  CC BY 3.0
                </a>
                ）
              </p>
            </div>
          </Field>

          <DataControls />
        </Panel>
      </div>
    </div>
  );
}

/** 詠唱に使う科目の複数選択。魔法陣を組めるよう3科目未満には減らせない */
function ActiveSubjectsField({ subjects, activeIds }: { subjects: Subject[]; activeIds: string[] }) {
  const [warning, setWarning] = useState(false);

  function toggle(id: string) {
    if (!activeIds.includes(id)) {
      setWarning(false);
      userActions.setActiveSubjects(subjects.filter((s) => s.id === id || activeIds.includes(s.id)).map((s) => s.id));
      return;
    }
    if (activeIds.length <= MIN_ACTIVE_SUBJECTS) {
      setWarning(true);
      return;
    }
    setWarning(false);
    userActions.setActiveSubjects(activeIds.filter((a) => a !== id));
  }

  return (
    <Field label="詠唱に使う科目" hint={`${activeIds.length} 領域 ・ 正${activeIds.length}角形の魔法陣`}>
      {/* 科目名が収まる幅を保ち、狭い列では1列に並べる */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(6.75rem,1fr))] gap-1.5">
        {subjects.map((s) => {
          const checked = activeIds.includes(s.id);
          return (
            <button
              key={s.id}
              role="checkbox"
              aria-checked={checked}
              onClick={() => toggle(s.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs tracking-wider whitespace-nowrap transition-all duration-300",
                checked
                  ? "border-white/25 bg-white/[0.05] text-foreground"
                  : "border-white/10 text-muted-foreground hover:border-white/25",
              )}
              style={checked ? { boxShadow: `0 0 10px -4px ${s.color}` } : undefined}
            >
              <span
                className="flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border"
                style={{ borderColor: checked ? s.color : "rgba(255,255,255,0.25)", background: checked ? `${s.color}26` : undefined }}
              >
                {checked && <Check className="size-2.5" strokeWidth={2} style={{ color: s.color }} />}
              </span>
              <span>{s.name}</span>
            </button>
          );
        })}
      </div>
      <p
        role="status"
        className={cn(
          "mt-2 text-[11px] leading-relaxed tracking-wider text-starlight/80 transition-opacity duration-500 [word-break:auto-phrase]",
          warning ? "opacity-100" : "opacity-0",
        )}
      >
        秘術を構築するには最低3つの領域（科目）の選択が必要です
      </p>
    </Field>
  );
}

/** 初めて訪れたときに見たプロローグと書庫の案内を、いつでも見返せるようにする */
function PrologueReplay() {
  const router = useRouter();
  const [playing, setPlaying] = useState(false);

  function replayTour() {
    resetLibraryTour();
    router.push("/dashboard?tour");
  }

  return (
    <Field label="はじまりの記録" hint="初めて訪れたときの演出と案内">
      <div className="flex flex-col gap-1.5">
        <Button variant="outline" size="sm" className="h-auto w-full py-2 [word-break:auto-phrase]" onClick={() => setPlaying(true)}>
          <BookOpen /> プロローグ（創世の記録）を再生する
        </Button>
        <Button variant="outline" size="sm" className="h-auto w-full py-2 [word-break:auto-phrase]" onClick={replayTour}>
          <Compass /> 書庫の案内をもう一度見る
        </Button>
      </div>
      {playing && <Prologue onDone={() => setPlaying(false)} />}
    </Field>
  );
}

function Panel({
  icon: Icon,
  title,
  label,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  label: string;
  children: ReactNode;
}) {
  return (
    // 枠線（glass の ::before）が中身と一緒に流れないよう、スクロールは内側の領域だけで行う
    <section className="glass flex min-h-0 flex-col overflow-hidden rounded-2xl">
      <h2 className="mx-4 mt-4 flex shrink-0 items-center gap-2 border-b border-white/10 pb-3 text-sm tracking-[0.25em] whitespace-nowrap short:mx-3 short:mt-3 short:pb-2 lg:mx-5 lg:mt-5">
        <Icon className="size-4 shrink-0 text-starlight" strokeWidth={1.25} />
        <span className="flex flex-col leading-tight">
          {title}
          <span className="font-display text-[9px] tracking-[0.3em] whitespace-normal text-starlight/60">{label}</span>
        </span>
      </h2>
      <div className="flex min-h-0 flex-1 flex-col gap-4 scroll-area scrollbar-none p-4 short:gap-3 short:p-3 lg:p-5">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 text-xs tracking-[0.2em] text-muted-foreground">
        <span className="whitespace-nowrap">{label}</span>
        {hint && <span className="text-[10px] tracking-wider text-muted-foreground/70">{hint}</span>}
      </p>
      {children}
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: typeof UserRound;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    // 説明文はスイッチの下まで回り込ませ、狭い列でも1語ずつ折り返さないようにする
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
      <Icon className={cn("mt-0.5 size-4 shrink-0", checked ? "text-aqua" : "text-muted-foreground")} strokeWidth={1.25} />
      <p className="text-sm tracking-wider whitespace-nowrap">{label}</p>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition-all duration-300",
          checked
            ? "border-aqua/60 bg-aqua/15 shadow-[0_0_12px_-2px_rgba(113,226,239,0.5)]"
            : "border-white/15 bg-white/[0.04]",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 left-0.5 size-4.5 -translate-y-1/2 rounded-full transition-all duration-300",
            checked ? "translate-x-5 bg-aqua shadow-[0_0_8px_rgba(113,226,239,0.8)]" : "bg-white/40",
          )}
        />
      </button>
      <p className="col-start-2 col-end-4 mt-1 text-[11px] leading-relaxed text-muted-foreground [word-break:auto-phrase]">{description}</p>
    </div>
  );
}

/** 音量スライダー（0〜100%）。指を離したときに onCommit で試し鳴らしできる */
function VolumeRow({
  icon: Icon,
  label,
  value,
  disabled,
  onChange,
  onCommit,
}: {
  icon: typeof UserRound;
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
  onCommit?: () => void;
}) {
  const percent = Math.round(value * 100);
  return (
    <label
      className={cn(
        "flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-2.5 py-2 transition-opacity duration-300",
        disabled && "opacity-45",
      )}
    >
      <Icon className={cn("size-4 shrink-0", disabled ? "text-muted-foreground" : "text-aqua")} strokeWidth={1.25} />
      <span className="shrink-0 text-sm tracking-wider whitespace-nowrap">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={percent}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        aria-label={`${label}の音量`}
        className="h-1.5 min-w-0 flex-1 cursor-pointer accent-aqua disabled:cursor-not-allowed"
      />
      <span className="w-9 shrink-0 text-right font-display text-xs text-muted-foreground">{percent}%</span>
    </label>
  );
}

/**
 * 開発者ツール: いまのデータを退避して全解放・サンプルに切り替え、いつでも元に戻せる。
 * 開発サーバーと、管理者の観測者IDでだけ表示する。管理者には曲の試聴・書き出しへの入口も出す
 */
function DevTools({ admin }: { admin: boolean }) {
  const [backedUp] = useState(hasDevBackup);

  // 各画面が保存データを読み直すよう、切り替えたら再読み込みする
  function apply(action: () => void) {
    action();
    overrideCloud();
    window.location.reload();
  }

  function restore() {
    if (!userActions.restoreDevBackup()) return;
    overrideCloud();
    window.location.reload();
  }

  return (
    <div className="rounded-xl border border-dashed border-amethyst/40 bg-amethyst/[0.04] p-3">
      <p className="flex items-center gap-1.5 text-sm tracking-wider whitespace-nowrap text-amethyst">
        <Wrench className="size-4 shrink-0" strokeWidth={1.25} />
        <span className="flex flex-col leading-tight">
          {admin ? "管理者ツール" : "開発者ツール"}
          <span className="font-display text-[9px] tracking-[0.25em] text-amethyst/70">{admin ? "ADMIN ONLY" : "DEV ONLY"}</span>
        </span>
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground [word-break:auto-phrase]">
        {backedUp
          ? "全解放・サンプルに切り替え中です。退避しておいた元のデータにいつでも戻せます"
          : "いまのデータをこの端末に退避してから、全解放（全ステージ・最高階級・全遺物・全文書・全称号・錬成素材）か、直近4週間の詠唱を重ねたサンプルに切り替えます"}
      </p>
      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        <Button variant="secondary" size="sm" onClick={() => apply(userActions.unlockAll)}>
          <Unlock /> 全解放する
        </Button>
        <Button variant="secondary" size="sm" onClick={() => apply(userActions.loadSample)}>
          <FlaskConical /> サンプルを読み込む
        </Button>
        <Button variant="outline" size="sm" className="col-span-2" disabled={!backedUp} onClick={restore}>
          <Undo2 /> 元のデータに戻す
        </Button>
        {admin && (
          <Link href="/music" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "col-span-2")}>
            <Music /> 音楽（試聴と書き出し）
          </Link>
        )}
      </div>
    </div>
  );
}

/** バックアップの書き出し・復元と、探求記録の初期化 */
function DataControls() {
  const admin = useIsAdmin();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<{ name: string; json: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  function exportBackup() {
    const blob = new Blob([userActions.exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `maholog-backup-${jstDateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ text: "探求の記録を書き出しました" });
  }

  async function pickFile(file: File | undefined) {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setPendingImport({ name: file.name, json: await file.text() });
  }

  // 各画面が保存データを読み直すよう、書き換え後は再読み込みする
  function restore() {
    if (!pendingImport) return;
    if (!userActions.importData(pendingImport.json)) {
      setPendingImport(null);
      setMessage({ text: "マホログのバックアップとして読み込めませんでした", error: true });
      return;
    }
    // 読み込んだ記録が少なくても、星界の記録に巻き戻されないようにする
    overrideCloud();
    window.location.reload();
  }

  function reset() {
    userActions.reset();
    // 旅をやり直すときは新しい観測者IDになる（これまでの記録は元の ID のまま星界に残る）
    startNewObserver();
    window.location.reload();
  }

  return (
    <>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <p className="flex items-center gap-1.5 text-sm tracking-wider whitespace-nowrap">
          <ScrollText className="size-4 shrink-0 text-aqua/80" strokeWidth={1.25} />
          記録の保管
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground [word-break:auto-phrase]">
          魔力・詠唱履歴・図鑑・称号・設定など、この端末の記録をまるごと JSON に書き出し、復元時はそのファイルで現在の記録を上書きします
        </p>
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          <Button variant="secondary" size="sm" onClick={exportBackup}>
            <Download /> 書き出す
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload /> 復元する
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        {message && (
          <p className={cn("mt-2 text-center text-[11px] tracking-wider", message.error ? "text-destructive" : "text-aqua/80")}>
            {message.text}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-destructive/25 bg-destructive/[0.04] p-3">
        <p className="flex items-center gap-1.5 text-sm tracking-wider whitespace-nowrap text-destructive">
          <RotateCcw className="size-4 shrink-0" strokeWidth={1.25} />
          原点へ戻る
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground [word-break:auto-phrase]">
          すべての魔力と記憶を消し、はじまりの小屋から旅をやり直します
        </p>
        <Button variant="destructive" size="sm" className="mt-2.5 w-full" onClick={() => setResetOpen(true)}>
          <RotateCcw /> データを初期化する
        </Button>
      </div>

      {/* 開発サーバー（npm run dev）と、管理者の観測者IDでだけ出す */}
      {(process.env.NODE_ENV === "development" || admin) && <DevTools admin={admin} />}

      <Dialog open={pendingImport !== null} onOpenChange={(open) => !open && setPendingImport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="tracking-wider">記録を復元しますか？</DialogTitle>
            <DialogDescription className="[word-break:auto-phrase]">
              「{pendingImport?.name}」の内容で、この端末の記録を上書きします。現在の記録は失われます。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingImport(null)}>
              やめる
            </Button>
            <Button onClick={restore}>
              <Upload /> 復元する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="tracking-wider">本当にすべての魔力と記憶を消去しますか？</DialogTitle>
            <DialogDescription className="[word-break:auto-phrase]">
              累積魔力・魔導の軌跡・図鑑の記録・設定がすべて消え、新しい観測者IDで旅をやり直します。これまでの記録は、いまの観測者IDと復元キーで復元しない限り戻せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              やめる
            </Button>
            <Button variant="destructive" onClick={reset}>
              <RotateCcw /> 消去して原点へ戻る
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
