"use client";

import { useState } from "react";
import { CUSTOM_FOCUS_MAX, CUSTOM_FOCUS_MIN, parseCustomFocus } from "@/lib/user-store";
import { cn } from "@/lib/utils";

const choiceClass = (primary: boolean) =>
  cn(
    "shrink-0 rounded-lg border px-2.5 py-1 font-serif text-xs whitespace-nowrap transition-all duration-300",
    primary
      ? "border-starlight/55 bg-starlight/[0.08] text-starlight shadow-[0_0_12px_-3px_rgba(226,201,116,0.45)]"
      : "border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground",
  );

/**
 * 律動の詠唱で自分の詠唱時間を決める入力欄（詠唱の間と設定で同じものを使う）。
 * 決められる幅を外れた数や数でないものは保存せず、ブラウザの知らせではなく世界観の言葉で下に添える
 */
export function CustomMinutesEditor({
  initial,
  label,
  onSave,
  onCancel,
}: {
  initial: number;
  /** 読み上げ用の名前 */
  label: string;
  onSave: (minutes: number) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(String(initial));
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      noValidate
      className="flex min-w-0 flex-1 flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const result = parseCustomFocus(draft);
        if ("error" in result) setError(result.error);
        else onSave(result.minutes);
      }}
    >
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          min={CUSTOM_FOCUS_MIN}
          max={CUSTOM_FOCUS_MAX}
          step={1}
          autoFocus
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              onCancel();
            }
          }}
          aria-label={`${label}（${CUSTOM_FOCUS_MIN}〜${CUSTOM_FOCUS_MAX}分）`}
          aria-invalid={error != null}
          aria-describedby={error ? "custom-minutes-error" : undefined}
          className={cn(
            "w-16 min-w-0 rounded-lg border bg-white/[0.03] px-2 py-1 text-center font-display text-sm text-starlight outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            error ? "border-[#f2a38d]/70" : "border-starlight/40 focus:border-starlight/70",
          )}
        />
        <span className="font-serif text-[10px] whitespace-nowrap text-muted-foreground">
          分（{CUSTOM_FOCUS_MIN}〜{CUSTOM_FOCUS_MAX}）
        </span>
        <button type="submit" className={cn(choiceClass(true), "ml-auto")}>
          決定
        </button>
        <button type="button" onClick={onCancel} className={choiceClass(false)}>
          やめる
        </button>
      </div>
      {error && (
        <p id="custom-minutes-error" role="alert" className="animate-in text-[11px] tracking-wider text-[#f2a38d] fade-in duration-300 [word-break:auto-phrase]">
          {error}
        </p>
      )}
    </form>
  );
}
