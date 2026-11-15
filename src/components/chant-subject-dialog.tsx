"use client";

import { useMemo, useState } from "react";
import { SubjectPicker } from "@/components/subject-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMinutes } from "@/lib/game";
import { activeSubjectsOf, radarAxesOf, resolveSubSubject, subSubjectLimitsOf } from "@/lib/subjects";
import type { Subject } from "@/lib/types";
import { EDITABLE_CHANT_COUNT, userActions, useUserData, type ChantRecord } from "@/lib/user-store";

const dateLabel = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** 直近の詠唱の科目を付け替える（科目を選び忘れたまま詠唱したとき） */
export function ChantSubjectDialog({ record, subjects, onClose }: { record: ChantRecord; subjects: Subject[]; onClose: () => void }) {
  const data = useUserData();
  const activeKeys = data.userProfile.activeSubjects;
  // 詠唱の間と同じく、詠唱に使う科目から選ぶ
  const pickable = useMemo(() => activeSubjectsOf(subjects.filter((s) => s.is_active), activeKeys), [subjects, activeKeys]);
  const subLimits = useMemo(() => subSubjectLimitsOf(radarAxesOf(pickable, activeKeys)), [pickable, activeKeys]);
  const [subjectId, setSubjectId] = useState<string>(record.subjectId);
  const [subInput, setSubInput] = useState<string | null>(record.subSubject ?? null);

  const subject = pickable.find((s) => s.id === subjectId);
  const subSubject = resolveSubSubject(subject, subInput, subject && subLimits[subject.id]);
  const unchanged = subjectId === record.subjectId && (subSubject ?? null) === (record.subSubject ?? null);

  function save() {
    if (!subject || unchanged) return onClose();
    userActions.changeChantSubject(record.id, subject.id, subSubject ?? null, subjects);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[min(28rem,calc(100%-2rem))]! gap-4 overflow-y-auto scrollbar-none rounded-2xl border border-white/10 bg-white/[0.04] p-5 ring-starlight/25 backdrop-blur-2xl">
        <DialogHeader className="items-center gap-1 text-center">
          <DialogTitle className="text-lg tracking-[0.35em] whitespace-nowrap text-starlight-gradient">
            <span className="-mr-[0.35em]">属性の付け替え</span>
          </DialogTitle>
          <p className="font-display text-[10px] tracking-[0.4em] whitespace-nowrap text-starlight/70">
            <span className="-mr-[0.4em]">— REATTUNE —</span>
          </p>
          <DialogDescription className="mt-1 text-[11px] tracking-wider [word-break:auto-phrase]">
            {dateLabel.format(new Date(record.date))}の{formatMinutes(record.minutes)}の詠唱。直近{EDITABLE_CHANT_COUNT}回の詠唱は、科目を選び直せます。
            {record.manual ? "書き留めた記録なので、試練にはこれまでどおり数えません" : "試練の進み具合も選び直した科目で数え直します"}。授かった魔力はそのままです
          </DialogDescription>
        </DialogHeader>

        <SubjectPicker
          subjects={pickable}
          subjectId={subject?.id ?? null}
          subSubject={subInput}
          subLimits={subLimits}
          onChange={(id, sub) => {
            if (id) setSubjectId(id);
            setSubInput(sub);
          }}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            やめる
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={save} disabled={!subject || unchanged}>
            付け替える
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
