import { cn } from "@/lib/utils";

/** ひとことを浮かべる枠に付ける class（触れたことを子の WhisperText へ伝える） */
export const whisperHost = "group/whisper relative";

/**
 * 触れたとき（マウスを重ねる・キーボードで選ぶ）に、枠のすぐ下（上）へ霞から結ぶように浮かぶ小さなひとこと。
 * ブラウザ標準の説明の吹き出し（title）は世界観を壊すので、代わりにこれを使う。
 * 置く枠には whisperHost を付けること
 */
export function WhisperText({ text, side = "bottom", className }: { text: string; side?: "top" | "bottom"; className?: string }) {
  return (
    <span
      role="tooltip"
      className={cn(
        "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 rounded-md border border-starlight/20 bg-[#070b16]/85 px-2 py-0.5 font-serif text-[10px] leading-relaxed font-normal tracking-[0.15em] whitespace-nowrap text-starlight/85 opacity-0 blur-[2px] shadow-[0_0_12px_-4px_rgba(226,201,116,0.5)] backdrop-blur transition-all duration-500",
        "group-hover/whisper:opacity-100 group-hover/whisper:blur-none group-focus-visible/whisper:opacity-100 group-focus-visible/whisper:blur-none",
        side === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5",
        className,
      )}
    >
      {text}
    </span>
  );
}
