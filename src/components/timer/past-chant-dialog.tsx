"use client";

import { useState, type ReactNode } from "react";
import { Feather } from "lucide-react";
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
import { DAILY_LIMIT_MINUTES } from "@/lib/game";
import { soundManager } from "@/lib/sound/sound-manager";
import type { Subject } from "@/lib/types";
import { MANUAL_CHANT_DAYS, userActions } from "@/lib/user-store";
import { cn } from "@/lib/utils";

const MINUTE_PRESETS = [15, 30, 60, 90, 120] as const;
const DAY_LABELS = ["今日", "昨日", "一昨日"];

function dayLabel(daysAgo: number) {
  return DAY_LABELS[daysAgo] ?? `${daysAgo}日前`;
}

/**
 * 詠唱の間で計り忘れた学びを、後から書き留めるダイアログ。科目は詠唱画面で選んでいるものを使う。
 * 刻めるのは魔力だけで、遺物・試練・エリアの属性などは計って詠唱したときだけに授かる
 */
export function PastChantDialog({
  open,
  onOpenChange,
  subject,
  subSubject,
  onRecorded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: Subject;
  subSubject: string | null;
  /** 刻めた分数（上限で切り詰めたあと。0 なら刻めなかった）と、何日前の記録か */
  onRecorded: (minutes: number, daysAgo: number) => void;
}) {
  const [daysAgo, setDaysAgo] = useState(0);
  const [minutesInput, setMinutesInput] = useState("30");
  const minutes = Math.floor(Number(minutesInput));
  const valid = Number.isFinite(minutes) && minutes >= 1 && minutes <= DAILY_LIMIT_MINUTES;

  function record() {
    if (!valid) return;
    const saved = userActions.recordPastChant({ minutes, subjectId: subject.id, subSubject, daysAgo });
    if (saved > 0) soundManager.playSe("chantComplete");
    onRecorded(saved, daysAgo);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(28rem,calc(100%-2rem))]!">
        <DialogHeader>
          <DialogTitle className="flex flex-col items-center gap-1 tracking-[0.2em]">
            <span className="flex items-center gap-2 whitespace-nowrap">
              <Feather className="size-4 text-starlight" strokeWidth={1.25} />
              詠唱を書き留める
            </span>
            <span className="font-display text-[9px] tracking-[0.3em] text-starlight/60">INSCRIBE A PAST CHANT</span>
          </DialogTitle>
          <DialogDescription className="[word-break:auto-phrase]">
            詠唱の間で計り忘れた学びを、魔導の軌跡に刻みます。書き留めた詠唱は学んだ分の魔力だけを授け、遺物の発見や試練には数えません。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-xs tracking-wider">
          <div className="flex flex-col items-center gap-1">
            <p className="text-muted-foreground">属性（詠唱画面で選んだ科目）</p>
            <SubjectRuneChip name={subject.name} subSubject={subSubject} color={subject.color} />
          </div>

          <div>
            <p className="mb-1.5 text-muted-foreground">学んだ日</p>
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: MANUAL_CHANT_DAYS }, (_, i) => (
                <ChoiceButton key={i} active={daysAgo === i} onClick={() => setDaysAgo(i)}>
                  {dayLabel(i)}
                </ChoiceButton>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-muted-foreground">学んだ時間</p>
            <div className="grid grid-cols-5 gap-1.5">
              {MINUTE_PRESETS.map((m) => (
                <ChoiceButton key={m} active={minutes === m} onClick={() => setMinutesInput(String(m))}>
                  {m}
                  <span className="ml-0.5 text-[10px]">分</span>
                </ChoiceButton>
              ))}
            </div>
            <label className="mt-2 flex items-center justify-center gap-2 text-muted-foreground">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={DAILY_LIMIT_MINUTES}
                value={minutesInput}
                onChange={(e) => setMinutesInput(e.target.value)}
                className="w-20 rounded-lg border border-white/15 bg-black/20 px-2 py-1 text-center font-display text-sm text-foreground outline-none focus:border-starlight/50"
              />
              分
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            やめる
          </Button>
          <Button onClick={record} disabled={!valid}>
            <Feather /> 刻む
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChoiceButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg border py-1 text-xs whitespace-nowrap transition-all duration-300",
        active
          ? "border-starlight/55 bg-starlight/[0.08] text-starlight shadow-[0_0_12px_-3px_rgba(226,201,116,0.45)]"
          : "border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
