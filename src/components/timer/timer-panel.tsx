"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Coffee, Hourglass, Pause, Play, Square, Timer as TimerIcon } from "lucide-react";
import { saveStudyLog } from "@/app/actions/study";
import { MagicCircle } from "@/components/magic-circle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DAILY_LIMIT_MINUTES, formatMinutes } from "@/lib/game";
import type { StudyMode, Subject, SubjectTotal } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ResultDialog, type StudyResult } from "./result-dialog";
import { notifyFinish, useClock } from "./use-clock";

const FOCUS_OPTIONS = [25, 30, 60] as const;
const BREAK_OPTIONS = [5, 10, 20] as const;
const IDLE_CHECK_MS = 2 * 60 * 60 * 1000; // ストップウォッチの放置確認（2時間）
const IDLE_RESPONSE_MS = 5 * 60 * 1000; // 確認ダイアログの応答待ち

/** idle: 開始前 / focus: 勉強中 / breakReady: 休憩待機 / break: 休憩中 */
type Phase = "idle" | "focus" | "breakReady" | "break";

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mmss = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

export function TimerPanel({
  subjects,
  initialTotalMp,
  initialWeekTotals,
  todayMinutes,
}: {
  subjects: Subject[];
  initialTotalMp: number;
  initialWeekTotals: SubjectTotal[];
  todayMinutes: number;
}) {
  const [mode, setMode] = useState<StudyMode>("pomodoro");
  const [focusMin, setFocusMin] = useState<number>(25);
  const [breakMin, setBreakMin] = useState<number>(5);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const { elapsedMs, running, start: resume, pause, reset, read } = useClock();

  const [totalMp, setTotalMp] = useState(initialTotalMp);
  const [weekTotals, setWeekTotals] = useState(initialWeekTotals);
  const [todayMp, setTodayMp] = useState(todayMinutes);
  const [result, setResult] = useState<StudyResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  // ストップウォッチ放置確認
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmBaseMs, setConfirmBaseMs] = useState(0);
  const checkpointRef = useRef(0);

  const subject = subjects.find((s) => s.id === subjectId);
  const resting = phase === "break" || phase === "breakReady";
  const color = resting ? "#cfe9ff" : (subject?.color ?? "#a882fb");
  const lineColor = resting ? "#a882fb" : "#71e2ef";

  const save = useCallback(
    (minutes: number) => {
      if (!subject) return;
      if (minutes < 1) {
        setMessage("1分未満のため記録されませんでした");
        return;
      }
      const beforeTotals = weekTotals;
      startSaving(async () => {
        const res = await saveStudyLog({ subjectId: subject.id, minutes, mode, demoTotalMp: totalMp });
        if (!res.ok) {
          setMessage(res.error);
          return;
        }
        const afterTotals = beforeTotals.map((t) =>
          t.subjectId === subject.id ? { ...t, minutes: t.minutes + res.savedMinutes } : t,
        );
        setWeekTotals(afterTotals);
        setTotalMp(res.afterMp);
        setTodayMp((v) => v + res.savedMinutes);
        setResult({
          id: Date.now(),
          subject,
          savedMinutes: res.savedMinutes,
          requestedMinutes: minutes,
          beforeMp: res.beforeMp,
          afterMp: res.afterMp,
          beforeTotals,
          afterTotals,
        });
      });
    },
    [mode, subject, totalMp, weekTotals],
  );

  // ポモドーロ: 勉強・休憩の終了判定
  useEffect(() => {
    if (mode !== "pomodoro" || !running) return;
    if (phase !== "focus" && phase !== "break") return;
    const targetMs = (phase === "focus" ? focusMin : breakMin) * 60_000;
    const id = setTimeout(() => {
      notifyFinish();
      reset();
      if (phase === "focus") {
        // 自動で休憩を始めず、手動スタートの「休憩待機」へ
        setPhase("breakReady");
        save(focusMin);
      } else {
        setPhase("idle");
      }
    }, Math.max(0, targetMs - read()));
    return () => clearTimeout(id);
  }, [mode, phase, running, focusMin, breakMin, read, reset, save]);

  // ストップウォッチ: 2時間連続で放置確認
  useEffect(() => {
    if (mode !== "stopwatch" || !running || confirmOpen) return;
    const id = setTimeout(() => {
      checkpointRef.current = read();
      notifyFinish();
      setConfirmOpen(true);
    }, Math.max(0, confirmBaseMs + IDLE_CHECK_MS - read()));
    return () => clearTimeout(id);
  }, [mode, running, read, confirmOpen, confirmBaseMs]);

  // 応答がなければ、確認を出した時点までで一時停止して保存
  useEffect(() => {
    if (!confirmOpen) return;
    const id = setTimeout(() => {
      setConfirmOpen(false);
      reset();
      setConfirmBaseMs(0);
      setPhase("idle");
      save(Math.floor(checkpointRef.current / 60_000));
    }, IDLE_RESPONSE_MS);
    return () => clearTimeout(id);
  }, [confirmOpen, reset, save]);

  const startFocus = () => {
    setMessage(null);
    setConfirmBaseMs(0);
    reset();
    resume();
    setPhase("focus");
  };

  const startBreak = () => {
    reset();
    resume();
    setPhase("break");
  };

  const finish = () => {
    const minutes = Math.floor(read() / 60_000);
    reset();
    setConfirmBaseMs(0);
    setPhase("idle");
    save(minutes);
  };

  const continueFocus = () => {
    setConfirmBaseMs(read());
    setConfirmOpen(false);
  };

  const targetMs =
    mode === "pomodoro" && (phase === "focus" || phase === "break")
      ? (phase === "focus" ? focusMin : breakMin) * 60_000
      : 0;
  const displayMs =
    mode === "pomodoro"
      ? phase === "idle"
        ? focusMin * 60_000
        : phase === "breakReady"
          ? breakMin * 60_000
          : targetMs - elapsedMs
      : elapsedMs;
  const intensity =
    phase !== "focus"
      ? 0
      : mode === "pomodoro"
        ? elapsedMs / targetMs
        : Math.min(1, elapsedMs / (60 * 60_000));
  const locked = phase !== "idle" && phase !== "breakReady";
  const statusLabel = {
    idle: "詠唱準備",
    focus: running ? "魔力集束中…" : "詠唱中断",
    breakReady: "詠唱完了 — 休憩待機中",
    break: running ? "休憩中" : "休憩中断",
  }[phase];

  if (subjects.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
        有効なマイ科目がありません。設定画面で科目をオンにしてください。
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-12 gap-3 p-3 lg:gap-4 lg:p-5">
      {/* 左: 設定パネル */}
      <section className="glass col-span-4 flex min-h-0 flex-col gap-4 overflow-y-auto rounded-2xl p-3 short:gap-3 lg:p-5">
        <div className="grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 text-sm">
          {(
            [
              { key: "pomodoro", label: "ポモドーロ", icon: Hourglass },
              { key: "stopwatch", label: "ストップウォッチ", icon: TimerIcon },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              disabled={phase !== "idle"}
              onClick={() => setMode(key)}
              className={cn(
                "flex items-center justify-center gap-1 rounded-full py-1.5 text-xs tracking-wider whitespace-nowrap transition-all duration-300 disabled:opacity-50 short:text-[11px]",
                mode === key
                  ? "bg-starlight/10 text-starlight ring-1 ring-starlight/45 shadow-[0_0_10px_-2px_rgba(226,201,116,0.4)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" strokeWidth={1.5} />
              {label}
            </button>
          ))}
        </div>

        <div>
          <p className="mb-2 text-xs tracking-[0.2em] text-muted-foreground">属性（科目）</p>
          <div className="flex flex-wrap gap-1.5">
            {subjects.map((s) => (
              <button
                key={s.id}
                disabled={locked}
                onClick={() => setSubjectId(s.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs tracking-wider transition-all duration-300 disabled:cursor-not-allowed",
                  s.id === subjectId
                    ? "border-white/30 bg-white/[0.07] text-foreground"
                    : "border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground",
                  locked && s.id !== subjectId && "opacity-30",
                )}
                style={s.id === subjectId ? { boxShadow: `0 0 12px -3px ${s.color}` } : undefined}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }}
                />
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {mode === "pomodoro" && (
          <>
            <OptionRow label="勉強時間" unit="分" options={FOCUS_OPTIONS} value={focusMin} onChange={setFocusMin} disabled={phase !== "idle"} />
            <OptionRow label="休憩時間" unit="分" options={BREAK_OPTIONS} value={breakMin} onChange={setBreakMin} disabled={phase !== "idle"} />
          </>
        )}
        {mode === "stopwatch" && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            カウントアップで計測します。2時間連続で計測すると集中確認が表示されます。
          </p>
        )}

        <div className="mt-auto space-y-1 border-t border-white/10 pt-3 text-xs tracking-wider text-muted-foreground">
          <p className="flex items-baseline justify-between gap-2">
            本日の獲得魔力
            <span>
              <span className="font-display text-sm text-foreground">{todayMp}</span>
              <span className="font-display text-[10px]"> MP</span>
              <span className="ml-1 text-[10px]">／ 上限 {formatMinutes(DAILY_LIMIT_MINUTES)}</span>
            </span>
          </p>
          <p className="flex items-baseline justify-between gap-2">
            累積魔力
            <span className="font-display text-sm text-starlight text-glow-gold">
              {totalMp.toLocaleString()} <span className="text-[10px]">MP</span>
            </span>
          </p>
        </div>
      </section>

      {/* 中央: 魔法陣 + タイマー */}
      <section className="relative col-span-8 flex min-h-0 flex-col items-center justify-center">
        <div className="relative flex aspect-square h-full max-h-[calc(100dvh-4rem)] max-w-full items-center justify-center">
          <MagicCircle
            color={color}
            lineColor={lineColor}
            running={running}
            intensity={intensity}
            className="absolute inset-0 h-full w-full"
          />
          <div className="relative z-10 flex flex-col items-center gap-2 text-center">
            <p className="text-xs tracking-[0.35em] text-aqua/70">{statusLabel}</p>
            <p
              className="font-display text-5xl font-normal text-[#e8fbfd] text-glow-aqua short:text-4xl lg:text-7xl"
              aria-label={formatClock(displayMs)}
            >
              {/* セリフ体は数字幅が揃わないので1文字ずつ固定幅で並べる */}
              {formatClock(displayMs)
                .split("")
                .map((ch, i) => (
                  <span key={i} className={cn("inline-block text-center", ch === ":" ? "w-[0.4em] -translate-y-[0.06em]" : "w-[0.72em]")}>
                    {ch}
                  </span>
                ))}
            </p>
            <p className="flex items-center gap-2 text-sm tracking-[0.3em]">
              <span className="h-px w-6 bg-gradient-to-r from-transparent to-white/40" />
              <span style={{ color, textShadow: `0 0 10px ${color}80` }}>{resting ? "休憩" : subject?.name}</span>
              <span className="h-px w-6 bg-gradient-to-l from-transparent to-white/40" />
            </p>

            <div className="mt-2 flex gap-2">
              {phase === "idle" && (
                <Button size="lg" onClick={startFocus} disabled={saving}>
                  <Play /> 詠唱開始
                </Button>
              )}
              {phase === "focus" && (
                <>
                  {running ? (
                    <Button size="lg" variant="secondary" onClick={pause}>
                      <Pause /> 一時停止
                    </Button>
                  ) : (
                    <Button size="lg" variant="secondary" onClick={resume}>
                      <Play /> 再開
                    </Button>
                  )}
                  <Button size="lg" onClick={finish}>
                    <Square /> 終了して記録
                  </Button>
                </>
              )}
              {phase === "breakReady" && (
                <>
                  <Button size="lg" onClick={startBreak}>
                    <Coffee /> 休憩を始める
                  </Button>
                  <Button size="lg" variant="secondary" onClick={() => setPhase("idle")}>
                    スキップ
                  </Button>
                </>
              )}
              {phase === "break" && (
                <>
                  {running ? (
                    <Button size="lg" variant="secondary" onClick={pause}>
                      <Pause /> 一時停止
                    </Button>
                  ) : (
                    <Button size="lg" variant="secondary" onClick={resume}>
                      <Play /> 再開
                    </Button>
                  )}
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => {
                      reset();
                      setPhase("idle");
                    }}
                  >
                    休憩を終える
                  </Button>
                </>
              )}
            </div>
            {saving && <p className="text-xs tracking-wider text-aqua/70 glimmer">魔力を記録中…</p>}
            {message && <p className="text-xs text-destructive">{message}</p>}
          </div>
        </div>
      </section>

      {/* 放置確認ダイアログ */}
      <Dialog open={confirmOpen} onOpenChange={(open) => !open && continueFocus()}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="tracking-wider">まだ集中中ですか？</DialogTitle>
            <DialogDescription>
              2時間連続で計測しています。5分以内に応答がない場合、ここまでの記録を保存して一時停止します。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => { setConfirmOpen(false); finish(); }}>
              終了して記録
            </Button>
            <Button onClick={continueFocus}>集中を続ける</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {result && <ResultDialog key={result.id} result={result} onClose={() => setResult(null)} />}
    </div>
  );
}

function OptionRow({
  label,
  unit,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  unit: string;
  options: readonly number[];
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-xs tracking-[0.2em] text-muted-foreground">{label}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            disabled={disabled}
            onClick={() => onChange(o)}
            className={cn(
              "rounded-xl border py-1.5 font-display text-base transition-all duration-300 disabled:opacity-50",
              o === value
                ? "border-starlight/55 bg-starlight/[0.08] text-starlight shadow-[0_0_12px_-3px_rgba(226,201,116,0.45)]"
                : "border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground",
            )}
          >
            {o}
            <span className="ml-0.5 font-serif text-[10px]">{unit}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
