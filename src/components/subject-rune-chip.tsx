"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ArrowGlyph } from "@/components/arcane-icons";
import { cn } from "@/lib/utils";

/**
 * 選択中の科目を「理科 › 物理」の形で、1px の二重線とルーン文字の枠に収めて示す。
 * 1行で置ける幅に収まらないときだけ、科目名を上に、詳細科目を下に積む。
 * 詳細科目の無い（カスタム科目など）長い名前は、名前を文節で2段に折る（どちらも字は削らない）
 */
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
  const chipRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [stacked, setStacked] = useState(false);

  // 1行で並べたときの幅（見えない複製で測る）が、札を置ける幅を超えるかを見る
  useLayoutEffect(() => {
    const parent = chipRef.current?.parentElement;
    const measure = measureRef.current;
    if (!parent || !measure) {
      setStacked(false);
      return;
    }
    // 余白を除いた中身の幅と比べる
    const check = () => {
      const style = getComputedStyle(parent);
      const inner = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      setStacked(measure.offsetWidth > inner);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [name, subSubject]);

  const rune = (glyph: string) => (
    <span className="text-[9px] tracking-normal opacity-60" style={{ color }} aria-hidden>
      {glyph}
    </span>
  );
  const nameText = <span style={{ color, textShadow: `0 0 10px ${color}80` }}>{name}</span>;
  // 積むときの名前: 置ける幅で文節ごとに折り、段の長さをそろえる（区切りの無い英字も枠の中で折る）
  const wrappedName = (
    <span
      className="min-w-0 text-balance whitespace-normal [overflow-wrap:anywhere] [word-break:auto-phrase]"
      style={{ color, textShadow: `0 0 10px ${color}80` }}
    >
      {name}
    </span>
  );
  const oneLine = (
    <>
      {rune("ᚱ")}
      {nameText}
      {subSubject && (
        <>
          <span className="text-[10px] tracking-normal text-muted-foreground" aria-label="の">
            <ArrowGlyph className="size-3" />
          </span>
          <span className="text-[#e8fbfd]">{subSubject}</span>
        </>
      )}
      {rune("ᛟ")}
    </>
  );

  return (
    <span
      ref={chipRef}
      className={cn(
        "relative inline-flex max-w-full px-3.5 py-1 text-sm tracking-[0.25em]",
        stacked ? "flex-col items-center gap-0.5 text-center" : "items-center gap-2 whitespace-nowrap",
        className,
      )}
      style={{ boxShadow: `0 0 14px -6px ${color}` }}
    >
      <span className="pointer-events-none absolute inset-0 rounded-[3px] border" style={{ borderColor: `${color}80` }} />
      <span className="pointer-events-none absolute inset-[3px] rounded-[2px] border" style={{ borderColor: `${color}30` }} />
      {stacked ? (
        <>
          <span className="flex max-w-full items-center gap-2">
            {rune("ᚱ")}
            {wrappedName}
            {rune("ᛟ")}
          </span>
          {subSubject && <span className="text-[#e8fbfd] [word-break:auto-phrase]">{subSubject}</span>}
        </>
      ) : (
        oneLine
      )}
      {/* 1行で並べたときの幅を測るための、見えない複製 */}
      <span
        ref={measureRef}
        className="pointer-events-none invisible absolute top-0 left-0 inline-flex w-max items-center gap-2 px-3.5 py-1 whitespace-nowrap"
        aria-hidden
      >
        {oneLine}
      </span>
    </span>
  );
}
