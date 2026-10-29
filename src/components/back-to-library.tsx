"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const DESTINATION = "/dashboard";

/** 各画面の左上に置く、拠点（魔術書庫）へ戻る導線。guard なら戻る前に確かめる（詠唱中など） */
export function BackToLibrary({ guard = false, className }: { guard?: boolean; className?: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Link
        href={DESTINATION}
        onClick={(e) => {
          if (!guard) return;
          e.preventDefault();
          setConfirmOpen(true);
        }}
        className={cn(
          "flex w-fit shrink-0 items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.03] py-1 pr-3 pl-1.5 text-[11px] tracking-[0.2em] whitespace-nowrap text-muted-foreground backdrop-blur transition-all duration-300 hover:border-starlight/40 hover:text-starlight",
          className,
        )}
      >
        <ChevronLeft className="size-3.5" strokeWidth={1.5} />
        魔術書庫
      </Link>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="tracking-wider">詠唱中です。魔術書庫に戻りますか？</DialogTitle>
            <DialogDescription className="[word-break:auto-phrase]">
              戻ると詠唱が中断される場合があります。記録する場合は、先に「終了して記録」を押してください。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              詠唱に留まる
            </Button>
            <Button variant="secondary" onClick={() => router.push(DESTINATION)}>
              魔術書庫へ戻る
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
