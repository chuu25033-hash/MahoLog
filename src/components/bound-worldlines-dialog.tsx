"use client";

import { useState, type FormEvent } from "react";
import { Copy, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isEmailAuthMode } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";
import { useWorldlines, type BindResult } from "@/lib/worldline-store";
import { lastChantLabel, normalizeWorldlineCode, presenceStatus, stageLabel, type Bond } from "@/lib/worldlines";

const BIND_MESSAGE: Record<BindResult | "invalid", { text: string; error?: boolean }> = {
  accepted: { text: "世界線が結ばれました" },
  pending: { text: "申し出を送りました。相手が応じると、互いの気配が見えるようになります" },
  exists: { text: "その世界線とはすでに結ばれているか、申し出の途中です", error: true },
  self: { text: "自分の世界線とは結べません", error: true },
  not_found: { text: "その世界線は見つかりませんでした", error: true },
  error: { text: "世界線を結べませんでした。時間をおいて試してください", error: true },
  invalid: { text: "「LN-」に続く6文字の世界線IDを入力してください", error: true },
};

/** 結びし世界線: 自分の世界線IDの共有と、結ばれた相手の気配の静かな観測。順位や数値の比較はしない */
export function BoundWorldlinesDialog({ onClose }: { onClose: () => void }) {
  const { myCode, bonds, loading, error, now, bind, accept, unbind } = useWorldlines();
  const [input, setInput] = useState("");
  const [binding, setBinding] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!myCode) return;
    try {
      await navigator.clipboard.writeText(myCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage({ text: "写し取れませんでした。IDを選んでコピーしてください", error: true });
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const code = normalizeWorldlineCode(input);
    if (!code) {
      setMessage(BIND_MESSAGE.invalid);
      return;
    }
    setBinding(true);
    const result = await bind(code);
    setBinding(false);
    setMessage(BIND_MESSAGE[result]);
    if (result === "accepted" || result === "pending") setInput("");
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-lg! gap-4 overflow-y-auto scrollbar-none rounded-2xl border border-white/10 bg-white/[0.04] p-5 ring-aqua/25 backdrop-blur-2xl sm:max-w-lg!">
        <DialogHeader className="items-center gap-1 text-center">
          <DialogTitle className="text-lg tracking-[0.35em] whitespace-nowrap text-starlight-gradient">
            <span className="-mr-[0.35em]">結びし世界線</span>
          </DialogTitle>
          <p className="font-display text-[10px] tracking-[0.4em] whitespace-nowrap text-starlight/70">
            <span className="-mr-[0.4em]">— BOUND WORLDLINES —</span>
          </p>
          <DialogDescription className="mt-1 text-[11px] leading-relaxed tracking-wider [word-break:auto-phrase]">
            世界線IDを交わした相手の気配だけが、ここに静かに届きます
            {!isEmailAuthMode && "（デモモード: 入力したIDごとに架空の探究者の気配を模擬します）"}
          </DialogDescription>
        </DialogHeader>

        {/* 自分の世界線ID */}
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] tracking-[0.3em] text-muted-foreground">あなたの世界線ID</p>
            <p className="mt-0.5 font-display text-lg tracking-[0.3em] text-aqua text-glow-aqua select-all">{myCode ?? "……"}</p>
          </div>
          <Button variant="outline" size="sm" onClick={copy} disabled={!myCode}>
            <Copy /> {copied ? "写しました" : "コピー"}
          </Button>
        </div>

        {/* 相手の世界線IDで結ぶ */}
        <form onSubmit={submit} className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="LN-XXXXXX"
              maxLength={12}
              aria-label="相手の世界線ID"
              autoCapitalize="characters"
              spellCheck={false}
              className="h-9 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.03] px-3 font-display text-sm tracking-[0.25em] uppercase outline-none transition-colors placeholder:text-muted-foreground/50 focus-visible:border-aqua/55 focus-visible:shadow-[0_0_12px_-3px_rgba(113,226,239,0.45)]"
            />
            <Button type="submit" variant="secondary" disabled={binding || !input.trim()}>
              <Link2 /> 世界線を結ぶ
            </Button>
          </div>
          {message && (
            <p className={cn("text-[11px] tracking-wider [word-break:auto-phrase]", message.error ? "text-destructive" : "text-aqua/80")}>
              {message.text}
            </p>
          )}
        </form>

        {/* 結ばれた相手 */}
        <ul className="flex flex-col gap-2">
          {loading && <li className="text-center text-xs tracking-wider text-muted-foreground glimmer">世界線を観測中…</li>}
          {error && <li className="text-center text-xs tracking-wider text-destructive">{error}</li>}
          {!loading && !error && bonds.length === 0 && (
            <li className="py-3 text-center text-xs leading-relaxed tracking-wider text-muted-foreground [word-break:auto-phrase]">
              まだ結ばれた世界線はありません。世界線IDを交わすと、相手の気配がここに灯ります
            </li>
          )}
          {bonds.map((bond) => (
            <BondCard key={bond.id} bond={bond} now={now} onAccept={() => accept(bond)} onUnbind={() => unbind(bond)} />
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/** 1px の二重線と四隅の菱形で縁取った相手のカード */
function BondCard({ bond, now, onAccept, onUnbind }: { bond: Bond; now: number; onAccept: () => void; onUnbind: () => void }) {
  const [confirmUnbind, setConfirmUnbind] = useState(false);
  const status = presenceStatus(bond.presence, now || undefined);
  const accepted = bond.status === "accepted";

  return (
    <li className="relative px-4 py-3">
      <span className="pointer-events-none absolute inset-0 rounded-[3px] border border-aqua/30" />
      <span className="pointer-events-none absolute inset-[3px] rounded-[2px] border border-white/[0.07]" />
      {["-top-[3px] -left-[3px]", "-top-[3px] -right-[3px]", "-bottom-[3px] -left-[3px]", "-bottom-[3px] -right-[3px]"].map((pos) => (
        <span key={pos} className={cn("pointer-events-none absolute size-1.5 rotate-45 border border-aqua/60 bg-midnight", pos)} />
      ))}

      <div className="relative flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2 whitespace-nowrap">
            <span className="truncate text-sm tracking-wider">{bond.name ?? "まだ名の知れぬ世界線"}</span>
            <span className="shrink-0 font-display text-[10px] tracking-[0.25em] text-muted-foreground">{bond.code}</span>
          </p>

          {accepted ? (
            <dl className="mt-1.5 grid gap-0.5 text-[11px] tracking-wider text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn("size-1.5 shrink-0 rounded-full", status.active ? "presence-glow bg-aqua" : "bg-white/25")}
                  aria-hidden
                />
                <dt className="sr-only">状態</dt>
                <dd className={status.active ? "text-aqua" : undefined}>
                  {status.label}
                  <span className="ml-1 opacity-70">（{status.note}）</span>
                </dd>
              </div>
              <div className="flex gap-1.5 pl-3">
                <dt className="sr-only">最後の探求</dt>
                <dd>{lastChantLabel(bond.presence, now || undefined)}</dd>
              </div>
              <div className="flex gap-1.5 pl-3">
                <dt className="sr-only">滞在中のステージ</dt>
                <dd className="font-display text-[10px] tracking-[0.15em] text-starlight/75">{stageLabel(bond.presence)}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-1.5 text-[11px] tracking-wider text-muted-foreground [word-break:auto-phrase]">
              {bond.status === "incoming" ? "あなたの世界線との結びを求めています" : "相手が応じるのを待っています"}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {bond.status === "incoming" && (
            <Button size="sm" variant="secondary" onClick={onAccept}>
              <Link2 /> 応じる
            </Button>
          )}
          <button
            type="button"
            onClick={() => (confirmUnbind ? onUnbind() : setConfirmUnbind(true))}
            onBlur={() => setConfirmUnbind(false)}
            className={cn(
              "flex items-center gap-1 text-[10px] tracking-wider whitespace-nowrap transition-colors",
              confirmUnbind ? "text-destructive" : "text-muted-foreground/60 hover:text-muted-foreground",
            )}
          >
            <Unlink className="size-3" strokeWidth={1.5} />
            {confirmUnbind ? "もう一度押して解く" : accepted ? "結びを解く" : "取り下げる"}
          </button>
        </div>
      </div>
    </li>
  );
}
