"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ImageDown, KeyRound, LockKeyhole, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { markKeySaved, snoozeKeyReminder, useObserver } from "@/lib/cloud-sync";
import { saveKeyCard } from "@/lib/key-card";
import { isCloudSyncEnabled } from "@/lib/supabase/config";
import { useStoredUserData } from "@/lib/user-store";
import { cn } from "@/lib/utils";

/** 復元キーを控える2つの手段: 鍵の札を画像で保存する / 観測者IDと復元キーをまとめてコピーする */
export function KeyBackupActions({ id, secret, className }: { id: string; secret: string; className?: string }) {
  const [done, setDone] = useState<"image" | "copy" | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveImage() {
    setBusy(true);
    try {
      if (await saveKeyCard(id, secret)) {
        markKeySaved();
        setDone("image");
      }
    } catch {}
    setBusy(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`マホログ\n観測者ID: ${id}\n復元キー: ${secret}`);
      markKeySaved();
      setDone("copy");
    } catch {}
  }

  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      <Button variant="secondary" size="sm" disabled={busy} onClick={saveImage}>
        {done === "image" ? <Check /> : <ImageDown />} 画像で保存
      </Button>
      <Button variant="outline" size="sm" onClick={copy}>
        {done === "copy" ? <Check /> : <Copy />} まとめてコピー
      </Button>
    </div>
  );
}

/** 初めて書庫に入ったときの案内を済ませたか。この端末にだけ覚える */
const FIRST_GUIDE_KEY = "maholog_first_library_guided";
const firstGuideListeners = new Set<() => void>();

function readFirstGuided() {
  try {
    return localStorage.getItem(FIRST_GUIDE_KEY) === "1";
  } catch {
    return true;
  }
}

function markFirstGuided() {
  try {
    localStorage.setItem(FIRST_GUIDE_KEY, "1");
  } catch {}
  firstGuideListeners.forEach((fn) => fn());
}

/**
 * 初めて書庫に入ったとき、まず書斎（設定）で観測者IDと復元キーを確かめるよう案内する。
 * 案内は一度きり。既に鍵を控えた人・Google でログインした人（ID と鍵を使わない）には出さない
 */
export function FirstVisitKeyGuide() {
  const router = useRouter();
  const observer = useObserver();
  const guided = useSyncExternalStore(
    (onChange) => {
      firstGuideListeners.add(onChange);
      return () => firstGuideListeners.delete(onChange);
    },
    readFirstGuided,
    () => true,
  );
  if (guided || !observer || observer.account || observer.keySaved) return null;

  function goToStudy() {
    markFirstGuided();
    router.push("/settings#observer-id");
  }

  return (
    <Dialog open onOpenChange={(open) => !open && markFirstGuided()}>
      <DialogContent className="max-w-[min(28rem,calc(100%-2rem))]!">
        <DialogHeader>
          <DialogTitle className="flex flex-col items-center gap-1 tracking-[0.2em]">
            <span className="flex items-center gap-2 whitespace-nowrap">
              <KeyRound className="size-4 text-starlight" strokeWidth={1.25} />
              ようこそ、魔術書庫へ
            </span>
            <span className="font-display text-[9px] tracking-[0.3em] text-starlight/60">WELCOME TO THE LIBRARY</span>
          </DialogTitle>
          <DialogDescription className="flex flex-col gap-1.5 [word-break:auto-phrase]">
            <span>探求を始める前に、まずは書斎で観測者IDと復元キーを確かめてください。</span>
            <span>端末を替えたりブラウザのデータを消したりしても、この二つがあれば記録を呼び戻せます。</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={markFirstGuided}>
            あとで
          </Button>
          <Button onClick={goToStudy}>
            <ScrollText /> 書斎で確かめる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 復元キーをまだ控えていない人へ、詠唱を終えて書庫に戻ったときに保存を促す。
 * 最初の詠唱のあとに一度、「あとで」を選べば詠唱を重ねたころにもう一度
 */
export function KeyBackupReminder() {
  const observer = useObserver();
  const data = useStoredUserData();
  // 一度開いたら、保存して控えた印が付いても閉じるまで出しておく
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const chants = data?.chantHistory.length ?? 0;
  // 星界に預け終えていない鍵はまだ使えないので、同期できてから促す
  const due =
    isCloudSyncEnabled &&
    observer !== null &&
    !observer.account &&
    observer.status === "synced" &&
    !observer.keySaved &&
    data !== null &&
    chants >= observer.keyReminderAt;
  if (due && !open && !dismissed) setOpen(true);
  if (!open || dismissed || !observer) return null;

  function later() {
    // 画像やコピーで控えた後に閉じたなら、先へ延ばす必要はない
    if (!observer?.keySaved) snoozeKeyReminder(chants);
    setDismissed(true);
  }

  function saved() {
    markKeySaved();
    setDismissed(true);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && later()}>
      <DialogContent className="max-w-[min(28rem,calc(100%-2rem))]!">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 tracking-[0.2em]">
            <LockKeyhole className="size-4 text-starlight" strokeWidth={1.25} />
            復元キーを控えてください
          </DialogTitle>
          <DialogDescription className="[word-break:auto-phrase]">
            探求の記録は星界に預けてあります。端末を替えたりブラウザのデータを消したりしたとき、記録を呼び戻せるのはこの観測者IDと復元キーだけです。なくすと二度と戻せません。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5 rounded-xl border border-starlight/25 bg-black/20 p-3 text-center font-mono">
          <p className="text-[10px] tracking-[0.3em] text-muted-foreground">観測者ID</p>
          <p className="text-lg tracking-[0.15em] text-starlight">{observer.id}</p>
          <p className="mt-1 text-[10px] tracking-[0.3em] text-muted-foreground">復元キー</p>
          <p className="text-[clamp(0.75rem,3.8vw,1rem)] tracking-[0.08em] whitespace-nowrap text-starlight">{observer.key}</p>
        </div>
        <KeyBackupActions id={observer.id} secret={observer.key} />
        <p className="text-center text-[11px] tracking-wider text-muted-foreground [word-break:auto-phrase]">
          画像は写真アプリに、コピーはメモアプリなどに残しておくと安心です。設定画面からもいつでも確かめられます。
        </p>
        <DialogFooter>
          {observer.keySaved ? (
            <Button onClick={() => setDismissed(true)}>閉じる</Button>
          ) : (
            <>
              <Button variant="outline" onClick={later}>
                あとで
              </Button>
              <Button onClick={saved}>控えました</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
