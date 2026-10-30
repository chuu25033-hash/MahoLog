"use client";

import { useEffect, useState } from "react";
import { Cloud, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { resolveLinkChoice, startCloudSync, useLinkChoice, type SaveSummary } from "@/lib/cloud-sync";

/**
 * クラウド同期を、アプリを開いたときに一度だけ始める。
 * ログインしたとき端末とアカウントの両方に記録があれば、どちらで続けるかをここで選んでもらう
 */
export function CloudSyncStarter() {
  useEffect(() => startCloudSync(), []);
  return (
    <>
      <LinkChoiceDialog />
      <LoginFailedNotice />
    </>
  );
}

function Summary({ icon: Icon, title, summary }: { icon: typeof Cloud; title: string; summary: SaveSummary }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-3 text-center">
      <Icon className="size-4 text-starlight" strokeWidth={1.25} />
      <p className="text-xs tracking-wider">{title}</p>
      <p className="font-display text-lg leading-tight text-starlight-gradient">
        {summary.mp.toLocaleString()} <span className="text-[10px]">MP</span>
      </p>
      <p className="text-[11px] tracking-wider text-muted-foreground">
        詠唱 {summary.chants}回
      </p>
    </div>
  );
}

/** ログインしたとき: この端末の記録とアカウントの記録のどちらで続けるか */
function LinkChoiceDialog() {
  const choice = useLinkChoice();
  const [busy, setBusy] = useState(false);
  if (!choice) return null;

  async function pick(which: "account" | "device") {
    setBusy(true);
    await resolveLinkChoice(which);
    // 各画面が保存データを読み直すよう、選んだ後は再読み込みする
    window.location.reload();
  }

  return (
    // 選ぶまでは閉じられない（どちらにも書かずに待っている）
    <Dialog open>
      <DialogContent showCloseButton={false} className="max-w-[min(30rem,calc(100%-2rem))]!">
        <DialogHeader>
          <DialogTitle className="tracking-[0.2em]">どちらの記録で続けますか？</DialogTitle>
          <DialogDescription className="[word-break:auto-phrase]">
            この端末と、ログインしたアカウントの両方に探求の記録があります。選ばなかった方の記録は、選んだ方で上書きされます。
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Summary icon={Cloud} title="アカウントの記録" summary={choice.account} />
          <Summary icon={Smartphone} title="この端末の記録" summary={choice.device} />
        </div>
        <DialogFooter className="sm:grid sm:grid-cols-2">
          <Button disabled={busy} onClick={() => pick("account")}>
            アカウントの記録で続ける
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => pick("device")}>
            この端末の記録で続ける
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Google から戻ってきたがログインできなかった（途中でやめた・期限切れなど）ことを知らせる */
function LoginFailedNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (new URL(window.location.href).searchParams.get("login") !== "failed") return;
    // 一度だけ知らせ、URL からは印を消しておく（開発時に effect が二度走っても、印は知らせるときに消す）
    const id = window.setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("login");
      window.history.replaceState(window.history.state, "", url);
      setOpen(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[min(24rem,calc(100%-2rem))]!">
        <DialogHeader>
          <DialogTitle className="tracking-[0.2em]">ログインできませんでした</DialogTitle>
          <DialogDescription className="[word-break:auto-phrase]">
            Google でのログインを完了できませんでした。もう一度お試しください。記録はこの端末に残っています。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>閉じる</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
