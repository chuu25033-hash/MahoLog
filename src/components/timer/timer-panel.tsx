"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { FastForward, Hourglass, MapPin, Moon, Pause, Play, Square, Timer as TimerIcon } from "lucide-react";
import { saveStudyLog } from "@/app/actions/study";
import { ArrowGlyph } from "@/components/arcane-icons";
import { BackToLibrary } from "@/components/back-to-library";
import { ItemArt } from "@/components/item-art";
import { MagicCircle } from "@/components/magic-circle";
import { SubjectPicker } from "@/components/subject-picker";
import { SubjectRuneChip } from "@/components/subject-rune-chip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { timerSummary } from "@/lib/aggregate";
import { areaMultiplier, boostLabel, resolveArea } from "@/lib/areas";
import { DAILY_LIMIT_MINUTES, formatMinutes } from "@/lib/game";
import { resolveSubSubject } from "@/lib/subjects";
import { soundManager } from "@/lib/sound/sound-manager";
import { setChantPresence } from "@/lib/worldline-store";
import { CATALYSTS, blessingMultiplier, dropMultiplier, rollDrop } from "@/lib/items";
import {
  FOCUS_MINUTE_OPTIONS,
  activeSkin,
  armedCatalyst,
  getUserData,
  isDiscovered,
  localStudyLogs,
  todayChantMinutes,
  userActions,
  useUserData,
} from "@/lib/user-store";
import type { StudyMode, Subject, SubjectTotal } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ResultDialog, type StudyResult } from "./result-dialog";
import { notifyFinish, useClock } from "./use-clock";

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
  isDemo,
  initialFocusMin = 25,
  initialSubjectId,
  initialSubSubject = null,
}: {
  subjects: Subject[];
  initialTotalMp: number;
  initialWeekTotals: SubjectTotal[];
  todayMinutes: number;
  isDemo: boolean;
  /** 設定画面のデフォルト詠唱時間 */
  initialFocusMin?: number;
  /** 設定画面の主軸科目 */
  initialSubjectId?: string | null;
  /** 設定画面の詳細科目 */
  initialSubSubject?: string | null;
}) {
  const [mode, setMode] = useState<StudyMode>("pomodoro");
  const [focusMin, setFocusMin] = useState<number>(initialFocusMin);
  const [breakMin, setBreakMin] = useState<number>(5);
  const initialSubject = subjects.find((s) => s.id === initialSubjectId);
  const [subjectId, setSubjectId] = useState(initialSubject?.id ?? subjects[0]?.id ?? "");
  const [subSubjectInput, setSubSubjectInput] = useState(initialSubject ? initialSubSubject : null);
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

  const data = useUserData();
  const area = resolveArea(data.userProfile.currentStageId, totalMp);
  const skin = activeSkin(data);
  const catalyst = armedCatalyst(data);

  // 設定で選択中の科目が外されたら、詠唱に使う科目の先頭に切り替える
  const subject = subjects.find((s) => s.id === subjectId) ?? subjects[0];
  const subSubject = resolveSubSubject(subject, subSubjectInput);
  const resting = phase === "break" || phase === "breakReady";
  const color = resting ? "#cfe9ff" : (subject?.color ?? "#a882fb");
  const lineColor = resting ? "#a882fb" : skin.lineColor;
  const boost = subject ? areaMultiplier(area, subject.name) : 1;

  const save = useCallback(
    (minutes: number) => {
      if (!subject) return;
      if (minutes < 1) {
        setMessage("詠唱が短く、星に刻まれませんでした（1分未満）");
        return;
      }
      // 詠唱画面は画面を移っても状態が残るので、魔法陣はいま選ばれている科目で組み直す。
      // デモモードは保存した詠唱履歴から測り直し、それ以外は手元の集計に無い科目を 0 分で補う
      const beforeTotals = isDemo
        ? timerSummary(subjects, localStudyLogs(getUserData())).weekTotals
        : subjects.map(
            (s) => weekTotals.find((t) => t.subjectId === s.id) ?? { subjectId: s.id, name: s.name, color: s.color, minutes: 0 },
          );
      startSaving(async () => {
        const res = await saveStudyLog({ subjectId: subject.id, minutes, mode, demoTotalMp: totalMp });
        if (!res.ok) {
          setMessage(res.error);
          return;
        }
        if (isDemo) {
          // デモモードの1日上限はローカルの詠唱履歴で判定する
          res.savedMinutes = Math.min(res.savedMinutes, DAILY_LIMIT_MINUTES - todayChantMinutes(getUserData()));
          if (res.savedMinutes < 1) {
            setMessage("本日の記録上限（12時間）に達しています");
            return;
          }
        }
        const afterTotals = beforeTotals.map((t) =>
          t.subjectId === subject.id ? { ...t, minutes: t.minutes + res.savedMinutes } : t,
        );
        // 獲得MP = 勉強時間 × エリアの属性ブースト × 秘宝の加護 × 触媒
        // TODO: Supabase 接続時はボーナス分の MP も DB に保存する（現状はローカル表示のみ）
        const owned = (id: string) => isDiscovered(getUserData(), id);
        const areaBoost = areaMultiplier(area, subject.name);
        const blessing = blessingMultiplier(owned, subject.name);
        const usedCatalyst = userActions.consumeCatalyst();
        const gainedMp = Math.round(res.savedMinutes * areaBoost * blessing * (usedCatalyst?.multiplier ?? 1));
        const drop = rollDrop(area, Math.random, dropMultiplier(owned));
        const isNew = drop ? userActions.addItem(drop) : false;
        if (isDemo) {
          userActions.recordChant({
            minutes: res.savedMinutes,
            subjectId: subject.id,
            subSubject,
            mp: gainedMp,
            stageId: area.id,
            mode,
            catalystId: usedCatalyst?.id ?? null,
            dropId: drop?.id ?? null,
          });
        }
        // リザルトで達成した試練をその場で受け取れるよう、この詠唱を含めて進捗を測り直す
        userActions.syncTasks(subjects);

        setWeekTotals(afterTotals);
        setTotalMp(res.beforeMp + gainedMp);
        setTodayMp((v) => v + gainedMp);
        setResult({
          id: Date.now(),
          subject,
          subSubject,
          area,
          savedMinutes: res.savedMinutes,
          requestedMinutes: minutes,
          gainedMp,
          areaBoost,
          blessing,
          catalyst: usedCatalyst,
          beforeMp: res.beforeMp,
          afterMp: res.beforeMp + gainedMp,
          beforeTotals,
          afterTotals,
          drop: drop ? { item: drop, isNew } : null,
        });
      });
    },
    [area, isDemo, mode, subject, subSubject, subjects, totalMp, weekTotals],
  );

  // 詠唱している間だけ、結ばれた世界線へ「深き集中」の気配を残す（記録時の完了は DB 側で刻まれる）
  useEffect(() => {
    if (phase !== "focus") return;
    setChantPresence(true, area.id);
    return () => setChantPresence(false);
  }, [phase, area.id]);

  // 魔力を集束している間は、環境音を控えめにする
  useEffect(() => {
    soundManager.setDucked(phase === "focus" && running);
    return () => soundManager.setDucked(false);
  }, [phase, running]);

  // ポモドーロ: 勉強・休憩の終了判定
  useEffect(() => {
    if (mode !== "pomodoro" || !running) return;
    if (phase !== "focus" && phase !== "break") return;
    const targetMs = (phase === "focus" ? focusMin : breakMin) * 60_000;
    const id = setTimeout(() => {
      notifyFinish(getUserData().settings.chime);
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
      notifyFinish(getUserData().settings.chime);
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
    soundManager.playSe("chantStart");
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
    soundManager.playSe("chantComplete");
    save(minutes);
  };

  /** デモ用: 計測を待たずに設定時間ぶん完了したことにする */
  const skipToFinish = () => {
    const minutes = mode === "pomodoro" ? focusMin : Math.max(25, Math.floor(read() / 60_000));
    reset();
    setConfirmBaseMs(0);
    setPhase(mode === "pomodoro" ? "breakReady" : "idle");
    soundManager.playSe("chantComplete");
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
    breakReady: "詠唱完了 — 静息を待つ",
    break: running ? "静息中" : "静息中断",
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
      {/* 枠線（glass の ::before）が中身と一緒に流れないよう、スクロールは内側の領域だけで行う */}
      <section className="glass col-span-4 flex min-h-0 flex-col overflow-hidden rounded-2xl">
        <div className="flex min-h-0 flex-1 flex-col gap-3 scroll-area scrollbar-none p-3 short:gap-2 lg:p-4">
          <div className="grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 text-sm">
            {(
              [
                { key: "pomodoro", label: "律動の詠唱", icon: Hourglass },
                { key: "stopwatch", label: "無窮の詠唱", icon: TimerIcon },
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
            <p className="mb-1.5 text-xs tracking-[0.2em] text-muted-foreground">属性（科目 <ArrowGlyph /> 詳細）</p>
            <SubjectPicker
              subjects={subjects}
              subjectId={subject?.id ?? null}
              subSubject={subSubjectInput}
              onChange={(id, sub) => {
                setSubjectId(id ?? subjectId);
                setSubSubjectInput(sub);
              }}
              disabled={locked}
            />
          </div>

          {mode === "pomodoro" && (
            <div className="space-y-1.5">
              <OptionRow label="詠唱時間" unit="分" options={FOCUS_MINUTE_OPTIONS} value={focusMin} onChange={setFocusMin} disabled={phase !== "idle"} />
              <OptionRow label="静息時間" unit="分" options={BREAK_OPTIONS} value={breakMin} onChange={setBreakMin} disabled={phase !== "idle"} />
            </div>
          )}
          {mode === "stopwatch" && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              果てなく詠唱を続けます。2時間途切れずに続くと、星が詠唱の継続を確かめに訪れます。
            </p>
          )}

          <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.02] p-2.5 text-xs tracking-wider">
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-3.5 text-aqua/80" strokeWidth={1.25} />
              滞在中 <span className="font-display text-[10px] text-starlight/80">AREA {area.id}</span>
              <span className="truncate text-foreground">{area.name}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              属性ブースト {boostLabel(area)}
              <span className="ml-1 font-display text-aqua">×{area.boost.multiplier}</span>
              {boost > 1 && <span className="ml-1 text-starlight text-glow-gold">適用中</span>}
            </p>
            <div>
              <p className="mb-1 text-[11px] text-muted-foreground">触媒（次回の詠唱に使用）</p>
              <div className="flex flex-wrap gap-1">
                {CATALYSTS.filter((c) => (data.inventory[c.id] ?? 0) > 0).map((c) => {
                  const armed = catalyst?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      disabled={locked}
                      onClick={() => userActions.armCatalyst(armed ? null : c.id)}
                      title={c.effect}
                      className={cn(
                        "flex items-center gap-1 rounded-full border py-0.5 pr-2 pl-0.5 text-[11px] transition-all duration-300 disabled:opacity-50",
                        armed
                          ? "border-starlight/55 bg-starlight/[0.08] text-starlight shadow-[0_0_10px_-3px_rgba(226,201,116,0.5)]"
                          : "border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground",
                      )}
                    >
                      <ItemArt icon={c.svgIcon} rarity={c.rarity} color={c.color} seed={c.id} className="size-5" />
                      ×{c.multiplier}
                      <span className="text-[10px] opacity-70">({data.inventory[c.id]})</span>
                    </button>
                  );
                })}
                {CATALYSTS.every((c) => (data.inventory[c.id] ?? 0) === 0) && (
                  <span className="text-[11px] text-muted-foreground/70">所持していません</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-auto space-y-0.5 border-t border-white/10 pt-2 text-xs tracking-wider text-muted-foreground">
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
        </div>
      </section>

      {/* 中央: 魔法陣 + タイマー */}
      <section className="relative col-span-8 flex min-h-0 flex-col items-center justify-center">
        <BackToLibrary guard={locked} className="absolute top-0 left-0 z-20" />
        <div className="relative flex aspect-square h-full max-h-[calc(100dvh-4rem)] max-w-full items-center justify-center">
          <MagicCircle
            color={color}
            lineColor={lineColor}
            particleColor={skin.particleColor}
            nodes={subjects.map((s) => ({ color: s.color, active: s.id === subject?.id }))}
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
            {resting || !subject ? (
              <p className="flex items-center gap-2 text-sm tracking-[0.3em]">
                <span className="h-px w-6 bg-gradient-to-r from-transparent to-white/40" />
                <span style={{ color, textShadow: `0 0 10px ${color}80` }}>静息</span>
                <span className="h-px w-6 bg-gradient-to-l from-transparent to-white/40" />
              </p>
            ) : (
              <SubjectRuneChip name={subject.name} subSubject={subSubject} color={subject.color} />
            )}

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
                    <Moon /> 静息に入る
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
                    静息を終える
                  </Button>
                </>
              )}
            </div>
            {isDemo && phase === "focus" && (
              <button
                onClick={skipToFinish}
                disabled={saving}
                className="flex items-center gap-1 text-[11px] tracking-wider text-muted-foreground underline-offset-4 hover:text-starlight hover:underline"
              >
                <FastForward className="size-3" /> デモ: 計測を省略して完了
              </button>
            )}
            {saving && <p className="text-xs tracking-wider text-aqua/70 glimmer">魔力を記録中…</p>}
            {message && <p className="text-xs text-destructive">{message}</p>}
          </div>
        </div>
      </section>

      {/* 放置確認ダイアログ */}
      <Dialog open={confirmOpen} onOpenChange={(open) => !open && continueFocus()}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="tracking-wider">まだ詠唱を続けていますか？</DialogTitle>
            <DialogDescription>
              2時間、途切れず詠唱が続いています。5分以内に応答がなければ、ここまでの詠唱を魔導の軌跡に刻んで中断します。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => { setConfirmOpen(false); finish(); }}>
              詠唱を終えて刻む
            </Button>
            <Button onClick={continueFocus}>詠唱を続ける</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {result && <ResultDialog key={result.id} result={result} subjects={subjects} onClose={() => setResult(null)} />}
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
    <div className="flex items-center gap-2">
      <p className="w-14 shrink-0 text-xs tracking-[0.2em] whitespace-nowrap text-muted-foreground">{label}</p>
      <div className="grid flex-1 gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <button
            key={o}
            disabled={disabled}
            onClick={() => onChange(o)}
            className={cn(
              "rounded-lg border py-1 font-display text-sm transition-all duration-300 disabled:opacity-50",
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
