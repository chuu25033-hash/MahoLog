"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { BackToLibrary } from "@/components/back-to-library";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Subject } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * スマホ縦持ちの詠唱画面。魔法陣を画面幅いっぱいの主役に据え、
 * 詠唱の作法（形式・時間）だけを手元に残し、属性や滞在地は「詠唱の支度」のシートに収める。
 * 詠唱している間は操作を退け、魔法陣と時刻だけにする
 */
export function PortraitTimer({
  locked,
  phase,
  subject,
  subSubject,
  modeToggle,
  subjectSection,
  durationRows,
  areaBox,
  mpSummary,
  magicCircle,
  clockFace,
  overlays,
}: {
  locked: boolean;
  phase: "idle" | "focus" | "breakReady" | "break";
  subject: Subject | undefined;
  subSubject: string | null;
  modeToggle: ReactNode;
  subjectSection: ReactNode;
  durationRows: ReactNode;
  areaBox: ReactNode;
  mpSummary: ReactNode;
  magicCircle: ReactNode;
  clockFace: ReactNode;
  overlays: ReactNode;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const preparing = phase === "idle";

  return (
    <div className="flex h-full flex-col animate-in fade-in duration-700">
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 pt-3">
        <BackToLibrary guard={locked} />
        {preparing && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            className="flex min-w-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] py-1 pr-3 pl-2.5 text-[11px] tracking-[0.2em] whitespace-nowrap text-muted-foreground backdrop-blur transition-all duration-300 hover:border-starlight/40 hover:text-starlight"
          >
            <SlidersHorizontal className="size-3.5 shrink-0 text-starlight" strokeWidth={1.5} />
            詠唱の支度
          </button>
        )}
      </header>

      {/* 魔法陣は幅いっぱいに描き、背の低い端末では下の操作の分だけ縮める */}
      <section className="flex min-h-0 flex-1 items-center justify-center px-2">
        <div className="relative flex aspect-square w-full max-w-[min(100%,calc(100dvh-15rem))] items-center justify-center">
          {magicCircle}
          {clockFace}
        </div>
      </section>

      <footer
        className={cn(
          "flex shrink-0 flex-col gap-2.5 px-4 pt-2 pb-4 transition-all duration-700",
          !preparing && "pointer-events-none translate-y-4 opacity-0",
        )}
        aria-hidden={!preparing}
      >
        {modeToggle}
        {durationRows}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex items-center justify-center gap-1.5 text-[11px] tracking-[0.2em] text-muted-foreground transition-colors hover:text-starlight"
        >
          属性
          <span className="text-foreground">
            {subject?.name ?? "—"}
            {subSubject && <span className="text-muted-foreground"> · {subSubject}</span>}
          </span>
          を変える
        </button>
      </footer>

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="top-auto bottom-0 left-0 max-h-[85dvh] w-full max-w-none translate-x-0 translate-y-0 gap-3 rounded-t-2xl rounded-b-none p-4 pb-[max(1rem,env(safe-area-inset-bottom))] ring-starlight/25 backdrop-blur-2xl sm:max-w-none data-open:slide-in-from-bottom-8 data-open:zoom-in-100">
          <DialogHeader>
            <DialogTitle className="text-sm tracking-[0.25em]">詠唱の支度</DialogTitle>
          </DialogHeader>
          {subjectSection}
          {areaBox}
          {mpSummary}
        </DialogContent>
      </Dialog>

      {overlays}
    </div>
  );
}
