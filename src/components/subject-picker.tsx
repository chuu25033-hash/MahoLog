"use client";

import { CUSTOM_SUB_SUBJECT_MAX, isCustomSubject, subSubjectsOf } from "@/lib/subjects";
import type { Subject } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 主科目（大カテゴリ）→ 詳細科目の二段で選ぶ。カスタムは詳細科目を自由記述する */
export function SubjectPicker({
  subjects,
  subjectId,
  subSubject,
  onChange,
  disabled = false,
  allowNone = false,
}: {
  subjects: Subject[];
  subjectId: string | null;
  subSubject: string | null;
  onChange: (subjectId: string | null, subSubject: string | null) => void;
  disabled?: boolean;
  /** 選択中の主科目をもう一度押すと選択を外せる */
  allowNone?: boolean;
}) {
  const subject = subjects.find((s) => s.id === subjectId);
  const subs = subSubjectsOf(subject);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {subjects.map((s) => {
          const active = s.id === subjectId;
          return (
            <button
              key={s.id}
              disabled={disabled}
              aria-pressed={active}
              onClick={() => (active ? allowNone && onChange(null, null) : onChange(s.id, null))}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs tracking-wider whitespace-nowrap transition-all duration-300 disabled:cursor-not-allowed",
                active
                  ? "border-white/30 bg-white/[0.07] text-foreground"
                  : "border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground",
                disabled && !active && "opacity-30",
              )}
              style={active ? { boxShadow: `0 0 12px -3px ${s.color}` } : undefined}
            >
              <span className="size-1.5 rounded-full" style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }} />
              {s.name}
            </button>
          );
        })}
        {subjects.length === 0 && <span className="text-xs text-muted-foreground/70">有効な科目がありません</span>}
      </div>

      {subject && (subs.length > 0 || isCustomSubject(subject)) && (
        <div className="flex flex-wrap items-center gap-1 border-l pl-2.5" style={{ borderColor: `${subject.color}55` }}>
          {isCustomSubject(subject) ? (
            <input
              value={subSubject ?? ""}
              maxLength={CUSTOM_SUB_SUBJECT_MAX}
              disabled={disabled}
              placeholder="例: 行政書士、心理学"
              onChange={(e) => onChange(subject.id, e.target.value || null)}
              onBlur={(e) => onChange(subject.id, e.target.value.trim() || null)}
              aria-label="カスタム科目"
              className="h-7 w-full rounded-md border border-white/15 bg-white/[0.03] px-2.5 text-xs tracking-wider outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-starlight/55 disabled:opacity-50"
            />
          ) : (
            subs.map((name) => {
              const active = name === subSubject;
              return (
                <button
                  key={name}
                  disabled={disabled}
                  aria-pressed={active}
                  onClick={() => onChange(subject.id, active ? null : name)}
                  className={cn(
                    "rounded-[3px] border px-2 py-0.5 text-[11px] tracking-wider whitespace-nowrap transition-all duration-300 disabled:cursor-not-allowed",
                    active ? "text-foreground" : "border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground",
                    disabled && !active && "opacity-30",
                  )}
                  style={active ? { borderColor: `${subject.color}aa`, background: `${subject.color}14` } : undefined}
                >
                  {name}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
