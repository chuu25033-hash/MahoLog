"use client";

import { useEffect, useState } from "react";
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
import { loadChantSession, useChantSession } from "@/lib/chant-session";
import { cn } from "@/lib/utils";

const DESTINATION = "/dashboard";
/** いまの詠唱の途中で、一度確かめて書庫へ戻ったことの印（詠唱を終えると消す） */
const LEFT_KEY = "maholog_chant_left_to_library";

function leftOnce() {
  try {
    return sessionStorage.getItem(LEFT_KEY) === "1";
  } catch {
    return false;
  }
}

function setLeftOnce(value: boolean) {
  try {
    if (value) sessionStorage.setItem(LEFT_KEY, "1");
    else sessionStorage.removeItem(LEFT_KEY);
  } catch {
    // 保存できない端末では、毎回確かめるだけ
  }
}

/**
 * 各画面の左上に置く、拠点（魔術書庫）へ戻る導線。guard なら戻る前に確かめる（詠唱中など）。
 * 同じ詠唱の途中で一度確かめて戻っていれば、書庫から詠唱の間へ入り直した後は確かめずに戻す
 */
export function BackToLibrary({ guard = false, className }: { guard?: boolean; className?: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const session = useChantSession();
  // 詠唱を終えたら（進行中の詠唱の書き留めが消えたら）、印も消して次の詠唱ではまた確かめる。
  // 読み込み直後は詠唱が無い扱いで描かれるので、端末の書き留めを直に確かめてから消す
  useEffect(() => {
    if (!session && !loadChantSession()) setLeftOnce(false);
  }, [session]);

  return (
    <>
      <Link
        href={DESTINATION}
        onClick={(e) => {
          if (!guard || leftOnce()) return;
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
              戻っても詠唱の時は流れ続け、詠唱の間に戻れば続きから再開できます。ここで記録する場合は、先に「終了して記録」を押してください。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              詠唱に留まる
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setLeftOnce(true);
                // 詠唱の間は離れても状態ごと残るので、閉じてから移る（開いたままだと、詠唱の間に戻ったときにまた出ている）
                setConfirmOpen(false);
                router.push(DESTINATION);
              }}
            >
              魔術書庫へ戻る
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
