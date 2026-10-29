"use client";

import { useEffect, useState } from "react";
import { Check, Gem, ScrollText, Sparkles } from "lucide-react";
import { ItemArt } from "@/components/item-art";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { calcLevel, rankOf } from "@/lib/game";
import { TASKS, type TaskDef, type TaskScope, type TaskState } from "@/lib/tasks";
import type { Subject } from "@/lib/types";
import { userActions, useUserData, type TaskClaim } from "@/lib/user-store";
import { cn } from "@/lib/utils";

const SCOPES: { key: TaskScope; label: string; sub: string; reset: string }[] = [
  { key: "daily", label: "日課の儀式", sub: "DAILY", reset: "毎日 午前0時に巡り直します" },
  { key: "weekly", label: "週間の大誓約", sub: "WEEKLY", reset: "毎週 月曜の午前0時に巡り直します" },
];

const claimable = (t: TaskState | undefined) => !!t && !t.isClaimed && t.progress >= t.maxProgress;

/** 魔術書庫に置く「試練」ボタン。受け取れる報酬があれば数を灯す */
export function TrialsButton({ subjects }: { subjects: Subject[] }) {
  const data = useUserData();
  const [open, setOpen] = useState(false);

  // 開いた時点の詠唱履歴・日付で進捗を測り直す（日付をまたいだら巡り直す）
  useEffect(() => {
    userActions.syncTasks(subjects);
  }, [subjects, open]);

  const ready = TASKS.filter((t) => claimable(data.tasks[t.scope].items[t.id])).length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-auto items-center justify-start gap-2 rounded-2xl border bg-white/[0.03] px-3 py-2 text-sm tracking-[0.2em] backdrop-blur transition-all duration-300 hover:bg-white/[0.06]",
          ready > 0 ? "claim-glow border-starlight/45" : "border-white/15 hover:border-white/30",
        )}
      >
        <ScrollText className="size-4 text-starlight" strokeWidth={1.25} />
        試練
        {ready > 0 && (
          <span className="rounded-full border border-starlight/50 bg-starlight/10 px-1.5 font-display text-[10px] tracking-normal text-starlight">
            {ready}
          </span>
        )}
        <span className="ml-auto font-display text-[10px] tracking-[0.25em] text-starlight/70">TASKS</span>
      </button>
      {open && <TrialsDialog subjects={subjects} onClose={() => setOpen(false)} />}
    </>
  );
}

function TrialsDialog({ subjects, onClose }: { subjects: Subject[]; onClose: () => void }) {
  const data = useUserData();
  const [scope, setScope] = useState<TaskScope>("daily");
  const [burst, setBurst] = useState<{ taskId: string; claim: TaskClaim; key: number } | null>(null);
  const totalMp = data.userProfile.totalMp;
  const rank = rankOf(calcLevel(totalMp));
  const current = SCOPES.find((s) => s.key === scope)!;

  function claim(def: TaskDef) {
    const result = userActions.claimTask(def.id, subjects);
    if (result) setBurst((prev) => ({ taskId: def.id, claim: result, key: (prev?.key ?? 0) + 1 }));
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-lg! gap-4 overflow-y-auto scrollbar-none rounded-2xl border border-white/10 bg-white/[0.04] p-5 ring-starlight/25 backdrop-blur-2xl sm:max-w-lg!">
        <DialogHeader className="gap-1">
          <DialogTitle className="flex items-baseline gap-2 text-lg tracking-[0.25em] whitespace-nowrap">
            星の試練
            <span className="font-display text-[10px] tracking-[0.3em] text-starlight/70">TRIALS</span>
          </DialogTitle>
          <DialogDescription className="flex items-baseline justify-between gap-3 text-[11px] tracking-wider whitespace-nowrap">
            <span className="truncate">{current.reset}</span>
            <span className="shrink-0">
              累積魔力 <span className="font-display text-sm text-starlight text-glow-gold">{totalMp.toLocaleString()}</span>
              <span className="font-display text-[10px]"> MP</span>
              <span className="ml-2 font-display text-[10px] tracking-[0.2em] text-starlight/70">RANK {rank.numeral}</span>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div role="tablist" aria-label="試練の種類" className="grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
          {SCOPES.map((s) => {
            const ready = TASKS.filter((t) => t.scope === s.key && claimable(data.tasks[s.key].items[t.id])).length;
            return (
              <button
                key={s.key}
                role="tab"
                aria-selected={scope === s.key}
                onClick={() => setScope(s.key)}
                className={cn(
                  "flex items-baseline justify-center gap-1.5 rounded-full py-1.5 text-xs tracking-wider whitespace-nowrap transition-all duration-300",
                  scope === s.key
                    ? "bg-starlight/10 text-starlight ring-1 ring-starlight/45 shadow-[0_0_10px_-2px_rgba(226,201,116,0.4)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
                <span className="font-display text-[9px] tracking-[0.2em] opacity-70">{s.sub}</span>
                {ready > 0 && <span className="size-1.5 self-center rounded-full bg-starlight shadow-[0_0_6px_#e2c974]" />}
              </button>
            );
          })}
        </div>

        <ul className="flex flex-col gap-2">
          {TASKS.filter((t) => t.scope === scope).map((def) => (
            <TaskRow
              key={def.id}
              def={def}
              state={data.tasks[scope].items[def.id]}
              burst={burst?.taskId === def.id ? burst : null}
              onClaim={() => claim(def)}
            />
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function RewardLabel({ def }: { def: TaskDef }) {
  if (def.reward.kind === "mp") {
    return (
      <span className="font-display text-xs text-aqua">
        +{def.reward.mp} <span className="text-[10px]">MP</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[11px] tracking-wider text-starlight/90">
      <Gem className="size-3" strokeWidth={1.25} />
      {def.reward.rare ? "稀少触媒" : "触媒 ×1"}
    </span>
  );
}

function TaskRow({
  def,
  state,
  burst,
  onClaim,
}: {
  def: TaskDef;
  state: TaskState | undefined;
  burst: { claim: TaskClaim; key: number } | null;
  onClaim: () => void;
}) {
  const progress = state?.progress ?? 0;
  const max = state?.maxProgress ?? 1;
  const done = progress >= max;
  const claimed = state?.isClaimed ?? false;

  return (
    <li
      className={cn(
        "relative overflow-hidden rounded-xl border p-3 transition-colors duration-500",
        claimed ? "border-white/[0.06] bg-white/[0.01]" : done ? "border-starlight/30 bg-starlight/[0.03]" : "border-white/10 bg-white/[0.02]",
      )}
    >
      {burst && (
        // 回収の瞬間: 行の中心から静かに広がる金の光と、獲得した魔力・触媒
        <div key={burst.key} className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="claim-burst absolute size-40 rounded-full bg-[radial-gradient(closest-side,rgba(246,233,189,0.55),rgba(226,201,116,0.18)_55%,transparent)]" />
          <span className="claim-float relative flex items-center gap-1.5 text-sm tracking-wider text-starlight text-glow-gold">
            {burst.claim.item ? (
              <>
                <ItemArt
                  icon={burst.claim.item.svgIcon}
                  rarity={burst.claim.item.rarity}
                  color={burst.claim.item.color}
                  seed={burst.claim.item.id}
                  className="size-6"
                />
                {burst.claim.item.name}
              </>
            ) : (
              <span className="font-display">+{burst.claim.mp} MP</span>
            )}
          </span>
        </div>
      )}

      <div className={cn("flex items-start gap-3", claimed && "opacity-55")}>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2 text-sm tracking-wider whitespace-nowrap">
            <span className="truncate">【{def.title}】</span>
            <span className="ml-auto shrink-0">
              <RewardLabel def={def} />
            </span>
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground [word-break:auto-phrase]">{def.description}</p>
          <div className="mt-2 flex items-center gap-2">
            {/* 1px の進捗インジケーター */}
            <div className="relative h-px flex-1 bg-white/10">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 transition-[width] duration-700",
                  done ? "bg-starlight shadow-[0_0_6px_rgba(226,201,116,0.9)]" : "bg-aqua/80 shadow-[0_0_4px_rgba(113,226,239,0.7)]",
                )}
                style={{ width: `${Math.min(100, (progress / max) * 100)}%` }}
              />
            </div>
            <span className="shrink-0 font-display text-[10px] tracking-wider text-muted-foreground">
              {progress} / {max}
              <span className="ml-0.5 font-serif">{def.unit}</span>
            </span>
          </div>
        </div>

        <div className="flex w-28 shrink-0 justify-end self-center">
          {claimed ? (
            <span className="flex items-center gap-1 text-[11px] tracking-wider text-muted-foreground">
              <Check className="size-3.5" strokeWidth={1.5} /> 回収済み
            </span>
          ) : done ? (
            <button
              onClick={onClaim}
              className="claim-glow flex items-center gap-1 rounded-full border border-starlight/60 bg-starlight/10 px-3 py-1 text-[11px] tracking-wider whitespace-nowrap text-starlight transition-colors hover:bg-starlight/20"
            >
              <Sparkles className="size-3" strokeWidth={1.5} /> 魔力を回収する
            </button>
          ) : (
            <span className="text-[11px] tracking-wider text-muted-foreground/60">未達成</span>
          )}
        </div>
      </div>
    </li>
  );
}
