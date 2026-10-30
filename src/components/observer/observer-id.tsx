"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CloudOff, Copy, KeyRound, LogOut, RefreshCw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { normalizeObserverId, restoreFromObserverId, signOutAccount, syncNow, useObserver, type ObserverState, type SyncStatus } from "@/lib/cloud-sync";
import { isCloudSyncEnabled } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";
import { GoogleSignInButton } from "./google-sign-in";

const STATUS_LABEL: Record<SyncStatus, { text: string; tone: string }> = {
  disabled: { text: "クラウド未接続（この端末にのみ保存）", tone: "text-muted-foreground" },
  idle: { text: "同期を待っています", tone: "text-muted-foreground" },
  syncing: { text: "星界と同期しています…", tone: "text-aqua/80" },
  synced: { text: "星界と同期済み", tone: "text-aqua" },
  offline: { text: "オフライン（つながったら同期します）", tone: "text-starlight/80" },
  error: { text: "同期できませんでした", tone: "text-destructive" },
  limited: { text: "試行が多すぎるため、1時間ほど同期を止めています", tone: "text-starlight/80" },
};

/** 同期の状態（失敗したときは再試行できる） */
function SyncStatusLine({ status }: { status: SyncStatus }) {
  const label = STATUS_LABEL[status];
  return (
    <p className={cn("mt-1.5 flex items-center gap-1 text-[11px] tracking-wider", label.tone)}>
      {status === "disabled" ? <CloudOff className="size-3 shrink-0" /> : <RefreshCw className={cn("size-3 shrink-0", status === "syncing" && "animate-spin")} />}
      {label.text}
      {(status === "error" || status === "offline") && (
        <button type="button" className="ml-auto underline-offset-2 hover:underline" onClick={() => void syncNow()}>
          再試行
        </button>
      )}
    </p>
  );
}

/**
 * 設定画面: 記録の預け先。Google でログインしていればアカウント、していなければ観測者ID（確認・コピーと
 * 別端末からの「世界線の復元」）と、Google ログインへの入口
 */
export function ObserverIdField() {
  const observer = useObserver();
  const [copied, setCopied] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  if (!observer) return null;
  if (observer.account) return <AccountField observer={observer} />;

  async function copy() {
    if (!observer) return;
    try {
      await navigator.clipboard.writeText(observer.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  return (
    <div className="rounded-xl border border-starlight/25 bg-starlight/[0.03] p-3">
      <p className="flex items-center gap-1.5 text-sm tracking-wider whitespace-nowrap">
        <KeyRound className="size-4 shrink-0 text-starlight" strokeWidth={1.25} />
        <span className="flex flex-col leading-tight">
          観測者ID
          <span className="font-display text-[9px] tracking-[0.25em] text-starlight/60">OBSERVER ID</span>
        </span>
      </p>
      <div className="@container mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-center font-mono text-[clamp(0.75rem,3.6cqw,1rem)] tracking-[0.12em] whitespace-nowrap text-starlight">
          {observer.id}
        </code>
        <Button variant="outline" size="icon-sm" onClick={copy} aria-label="観測者IDをコピー">
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      <SyncStatusLine status={observer.status} />
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground [word-break:auto-phrase]">
        別の端末やブラウザでこの ID を入力すると、探求の記録をそのまま引き継げます。ID を知る人は誰でも記録を開けるので、他の人には教えないでください。
      </p>
      <Button variant="secondary" size="sm" className="mt-2.5 w-full" disabled={!isCloudSyncEnabled} onClick={() => setRestoreOpen(true)}>
        <KeyRound /> 観測者IDで世界線を復元
      </Button>
      {restoreOpen && <RestoreDialog onClose={() => setRestoreOpen(false)} onRestored={() => window.location.reload()} />}
      {isCloudSyncEnabled && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground [word-break:auto-phrase]">
            Google でログインすると、ID を覚えなくても別の端末で記録を引き継げます。他の人に記録を開かれることもありません。
          </p>
          <GoogleSignInButton size="sm" />
        </div>
      )}
    </div>
  );
}

/** Google でログイン中: アカウントと同期の状態、ログアウト */
function AccountField({ observer }: { observer: ObserverState }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<"closed" | "open" | "unsynced">("closed");
  const [busy, setBusy] = useState(false);

  async function signOut(force = false) {
    setBusy(true);
    const result = await signOutAccount({ force });
    setBusy(false);
    if (result === "unsynced") {
      setConfirm("unsynced");
      return;
    }
    // 端末の記録は初期化済み（各画面は保存データの変更をそのまま反映する）。タイトルへ戻る
    router.push("/");
  }

  return (
    <div className="rounded-xl border border-starlight/25 bg-starlight/[0.03] p-3">
      <p className="flex items-center gap-1.5 text-sm tracking-wider whitespace-nowrap">
        <UserRound className="size-4 shrink-0 text-starlight" strokeWidth={1.25} />
        <span className="flex flex-col leading-tight">
          アカウント
          <span className="font-display text-[9px] tracking-[0.25em] text-starlight/60">ACCOUNT</span>
        </span>
      </p>
      <p className="mt-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-center text-sm tracking-wider [overflow-wrap:anywhere]">
        {observer.account?.email ?? "Google アカウント"}
      </p>
      <SyncStatusLine status={observer.status} />
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground [word-break:auto-phrase]">
        探求の記録はこのアカウントに預けています。別の端末でも同じアカウントでログインすれば、記録をそのまま引き継げます。
      </p>
      <Button variant="outline" size="sm" className="mt-2.5 w-full" onClick={() => setConfirm("open")}>
        <LogOut /> ログアウト
      </Button>

      <Dialog open={confirm !== "closed"} onOpenChange={(open) => !open && !busy && setConfirm("closed")}>
        <DialogContent className="max-w-[min(28rem,calc(100%-2rem))]!">
          <DialogHeader>
            <DialogTitle className="tracking-[0.2em]">ログアウトしますか？</DialogTitle>
            <DialogDescription className="[word-break:auto-phrase]">
              {confirm === "unsynced"
                ? "まだアカウントに預け終えていない変更があります。このままログアウトすると、その変更は失われます。"
                : "この端末からは探求の記録を消して、はじまりの状態に戻ります。記録はアカウントに残っているので、もう一度ログインすれば戻れます。"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setConfirm("closed")}>
              やめる
            </Button>
            <Button variant={confirm === "unsynced" ? "destructive" : "secondary"} disabled={busy} onClick={() => signOut(confirm === "unsynced")}>
              <LogOut /> {busy ? "預けています…" : confirm === "unsynced" ? "変更を捨ててログアウト" : "ログアウトする"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const RESULT_MESSAGE = {
  invalid: "ML-XXXX-XXXX の形の観測者IDを入力してください（0・1 は使われていません）",
  "not-found": "この観測者IDの記録は星界に見つかりませんでした",
  same: "この端末は既にこの観測者IDで同期しています",
  limited: "観測者IDの入力が続けて外れたため、しばらく受け付けられません。1時間ほど待ってからお試しください",
  error: "星界と交信できませんでした。通信状態を確かめてもう一度お試しください",
} as const;

/**
 * 世界線の復元（ログイン）: 観測者IDを入力して、別の端末の探求記録をこの端末に呼び戻す。
 * この端末の記録は置き換わる（それまでの ID のままクラウドに残っていれば、その ID でいつでも戻れる）
 */
export function RestoreDialog({ onClose, onRestored }: { onClose: () => void; onRestored: () => void }) {
  const observer = useObserver();
  const [input, setInput] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const code = normalizeObserverId(input);

  async function restore() {
    setBusy(true);
    setError(null);
    const result = await restoreFromObserverId(input);
    setBusy(false);
    if (result === "ok") {
      onRestored();
      return;
    }
    setConfirming(false);
    setError(RESULT_MESSAGE[result]);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-[min(28rem,calc(100%-2rem))]!">
        <DialogHeader>
          <DialogTitle className="tracking-[0.2em]">世界線の復元</DialogTitle>
          <DialogDescription className="[word-break:auto-phrase]">
            {confirming
              ? "この端末の探求記録は、入力した観測者IDの記録に置き換わります。"
              : "別の端末で発行された観測者IDを入力すると、その探求記録（魔力・階級・図鑑・周天）をこの端末に呼び戻します。"}
          </DialogDescription>
        </DialogHeader>

        {confirming ? (
          <div className="flex flex-col gap-2 text-xs leading-relaxed tracking-wider [word-break:auto-phrase]">
            <p className="rounded-lg border border-starlight/30 bg-starlight/[0.05] px-3 py-2 text-center font-mono text-base tracking-[0.2em] text-starlight">{code}</p>
            {observer && (
              <p className="text-muted-foreground">
                いまの記録は観測者ID <span className="font-mono text-foreground">{observer.id}</span>
                {observer.status === "synced"
                  ? " として星界に預けてあり、この ID で復元すればいつでも戻れます。"
                  : " のまま、まだ星界に預け終えていません。戻れなくなるおそれがあります。"}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <input
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && code && setConfirming(true)}
              placeholder="ML-XXXX-XXXX"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-label="観測者ID"
              className="h-11 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 text-center font-mono text-lg tracking-[0.2em] uppercase outline-none transition-colors placeholder:text-muted-foreground/50 focus-visible:border-starlight/55"
            />
            {code && code !== input.trim().toUpperCase() && <p className="text-center text-[11px] text-muted-foreground">→ {code}</p>}
          </div>
        )}

        {error && <p className="text-center text-[11px] tracking-wider text-destructive [word-break:auto-phrase]">{error}</p>}

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={confirming ? () => setConfirming(false) : onClose}>
            {confirming ? "戻る" : "やめる"}
          </Button>
          {confirming ? (
            <Button disabled={busy} onClick={restore}>
              <KeyRound /> {busy ? "交信中…" : "置き換えて復元する"}
            </Button>
          ) : (
            <Button disabled={!code} onClick={() => setConfirming(true)}>
              <KeyRound /> 次へ
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
