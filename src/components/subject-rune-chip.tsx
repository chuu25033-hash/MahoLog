import { cn } from "@/lib/utils";

/** 選択中の科目を「理科 ➔ 物理」の形で、1px の二重線とルーン文字の枠に収めて示す */
export function SubjectRuneChip({
  name,
  subSubject,
  color,
  className,
}: {
  name: string;
  subSubject: string | null;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn("relative inline-flex max-w-full items-center gap-2 px-3.5 py-1 text-sm tracking-[0.25em] whitespace-nowrap", className)}
      style={{ boxShadow: `0 0 14px -6px ${color}` }}
    >
      <span className="pointer-events-none absolute inset-0 rounded-[3px] border" style={{ borderColor: `${color}80` }} />
      <span className="pointer-events-none absolute inset-[3px] rounded-[2px] border" style={{ borderColor: `${color}30` }} />
      <span className="text-[9px] tracking-normal opacity-60" style={{ color }} aria-hidden>
        ᚱ
      </span>
      <span style={{ color, textShadow: `0 0 10px ${color}80` }}>{name}</span>
      {subSubject && (
        <>
          <span className="text-[10px] tracking-normal text-muted-foreground" aria-label="の">
            ➔
          </span>
          <span className="truncate text-[#e8fbfd]">{subSubject}</span>
        </>
      )}
      <span className="text-[9px] tracking-normal opacity-60" style={{ color }} aria-hidden>
        ᛟ
      </span>
    </span>
  );
}
