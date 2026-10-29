"use client";

import { useRef, useState, type ReactNode } from "react";
import { Bell, Download, Feather, RotateCcw, ScrollText, Upload, UserRound } from "lucide-react";
import { PageLoading } from "@/components/page-loading";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { jstDateKey } from "@/lib/date";
import type { Subject } from "@/lib/types";
import { FOCUS_MINUTE_OPTIONS, initialUserData, userActions, useStoredUserData } from "@/lib/user-store";
import { cn } from "@/lib/utils";

const USERNAME_MAX = 16;

/** 設定画面: 探究者の情報・学習設定・演出・探求データの管理 */
export function SettingsView({ subjects, isDemo }: { subjects: Subject[]; isDemo: boolean }) {
  const data = useStoredUserData();
  if (!data) return <PageLoading />;
  const { userProfile, settings } = data;
  const mainSubjectId = subjects.some((s) => s.id === settings.mainSubjectId) ? settings.mainSubjectId : null;

  return (
    <div className="scroll-area scrollbar-none flex h-full flex-col gap-4 p-3 animate-in fade-in duration-700 lg:p-5">
      <header className="min-w-0">
        <h1 className="flex items-baseline gap-2 text-xl tracking-[0.25em] whitespace-nowrap">
          秘術探究者の書斎
          <span className="truncate font-display text-[10px] tracking-[0.3em] text-starlight/70">SETTINGS</span>
        </h1>
        <p className="text-xs tracking-wider text-muted-foreground [word-break:auto-phrase]">
          探究者の名と詠唱の作法を定め、これまでの探求の記録を守ります
          {!isDemo && "（ここでの設定はこの端末に保存されます）"}
        </p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-3 lg:gap-4">
        <Panel icon={UserRound} title="探究者と詠唱" label="SCHOLAR">
          <Field label="探究者名" hint={`${userProfile.username.length} / ${USERNAME_MAX}`}>
            <input
              value={userProfile.username}
              maxLength={USERNAME_MAX}
              onChange={(e) => userActions.setUsername(e.target.value)}
              onBlur={(e) => userActions.setUsername(e.target.value.trim() || initialUserData().userProfile.username)}
              className="h-9 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 text-sm tracking-wider outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-starlight/55 focus-visible:shadow-[0_0_12px_-3px_rgba(226,201,116,0.45)]"
              aria-label="探究者名"
            />
          </Field>

          <Field label="主軸科目" hint="詠唱画面で最初に選ばれます">
            <div className="flex flex-wrap gap-1.5">
              {subjects.map((s) => {
                const active = s.id === mainSubjectId;
                return (
                  <button
                    key={s.id}
                    onClick={() => userActions.updateSettings({ mainSubjectId: active ? null : s.id })}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs tracking-wider transition-all duration-300",
                      active
                        ? "border-white/30 bg-white/[0.07] text-foreground"
                        : "border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground",
                    )}
                    style={active ? { boxShadow: `0 0 12px -3px ${s.color}` } : undefined}
                  >
                    <span className="size-1.5 rounded-full" style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }} />
                    {s.name}
                  </button>
                );
              })}
              {subjects.length === 0 && <span className="text-xs text-muted-foreground/70">有効な科目がありません</span>}
            </div>
          </Field>

          <Field label="デフォルト詠唱時間" hint="律動の詠唱の初期集中時間">
            <div className="grid grid-cols-4 gap-1.5">
              {FOCUS_MINUTE_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => userActions.updateSettings({ defaultFocusMinutes: m })}
                  aria-pressed={m === settings.defaultFocusMinutes}
                  className={cn(
                    "rounded-xl border py-1.5 font-display text-base transition-all duration-300",
                    m === settings.defaultFocusMinutes
                      ? "border-starlight/55 bg-starlight/[0.08] text-starlight shadow-[0_0_12px_-3px_rgba(226,201,116,0.45)]"
                      : "border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground",
                  )}
                >
                  {m}
                  <span className="ml-0.5 font-serif text-[10px]">分</span>
                </button>
              ))}
            </div>
          </Field>
        </Panel>

        <Panel icon={Feather} title="環境と演出" label="AMBIENCE">
          <ToggleRow
            icon={Feather}
            label="演出の軽量化"
            description="背景の星屑や漂う粒子を間引き、常に動き続けるアニメーションを止めて動作を軽くします"
            checked={settings.liteMode}
            onChange={(liteMode) => userActions.updateSettings({ liteMode })}
          />
          <ToggleRow
            icon={Bell}
            label="詠唱完了の報せ"
            description="詠唱や静息を終えたとき、静かなベルの音と振動で知らせます"
            checked={settings.chime}
            onChange={(chime) => userActions.updateSettings({ chime })}
          />
        </Panel>

        <Panel icon={ScrollText} title="探求データの管理" label="ARCHIVE">
          <DataControls />
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  label,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="glass flex min-h-0 flex-col gap-5 scroll-area scrollbar-none rounded-2xl p-4 lg:p-5">
      <h2 className="flex items-center gap-2 border-b border-white/10 pb-3 text-sm tracking-[0.25em] whitespace-nowrap">
        <Icon className="size-4 shrink-0 text-starlight" strokeWidth={1.25} />
        {title}
        <span className="ml-auto truncate font-display text-[10px] tracking-[0.3em] text-starlight/60">{label}</span>
      </h2>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 flex items-baseline justify-between gap-2 text-xs tracking-[0.2em] whitespace-nowrap text-muted-foreground">
        {label}
        {hint && <span className="truncate text-[10px] tracking-wider text-muted-foreground/70">{hint}</span>}
      </p>
      {children}
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: typeof UserRound;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <Icon className={cn("mt-0.5 size-4 shrink-0", checked ? "text-aqua" : "text-muted-foreground")} strokeWidth={1.25} />
      <div className="min-w-0 flex-1">
        <p className="text-sm tracking-wider whitespace-nowrap">{label}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground [word-break:auto-phrase]">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition-all duration-300",
          checked
            ? "border-aqua/60 bg-aqua/15 shadow-[0_0_12px_-2px_rgba(113,226,239,0.5)]"
            : "border-white/15 bg-white/[0.04]",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 left-0.5 size-4.5 -translate-y-1/2 rounded-full transition-all duration-300",
            checked ? "translate-x-5 bg-aqua shadow-[0_0_8px_rgba(113,226,239,0.8)]" : "bg-white/40",
          )}
        />
      </button>
    </div>
  );
}

/** バックアップの書き出し・復元と、探求記録の初期化 */
function DataControls() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<{ name: string; json: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  function exportBackup() {
    const blob = new Blob([userActions.exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `maholog-backup-${jstDateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ text: "探求の記録を書き出しました" });
  }

  async function pickFile(file: File | undefined) {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setPendingImport({ name: file.name, json: await file.text() });
  }

  // 各画面が保存データを読み直すよう、書き換え後は再読み込みする
  function restore() {
    if (!pendingImport) return;
    if (!userActions.importData(pendingImport.json)) {
      setPendingImport(null);
      setMessage({ text: "マホログのバックアップとして読み込めませんでした", error: true });
      return;
    }
    window.location.reload();
  }

  function reset() {
    userActions.reset();
    window.location.reload();
  }

  return (
    <>
      <DataAction
        icon={Download}
        title="記録の書き出し"
        description="この端末に刻まれた魔力・詠唱履歴・所持品を JSON ファイルとして保存します"
      >
        <Button variant="secondary" onClick={exportBackup}>
          <Download /> 書き出す
        </Button>
      </DataAction>

      <DataAction
        icon={Upload}
        title="記録の復元"
        description="書き出したバックアップを読み込み、現在の記録を上書きします"
      >
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload /> ファイルを選ぶ
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
      </DataAction>

      <div className="mt-auto rounded-xl border border-destructive/25 bg-destructive/[0.04] p-3">
        <p className="flex items-center gap-1.5 text-sm tracking-wider whitespace-nowrap text-destructive">
          <RotateCcw className="size-4 shrink-0" strokeWidth={1.25} />
          原点へ戻る
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground [word-break:auto-phrase]">
          すべての魔力・詠唱履歴・所持品・設定を消し、はじまりの小屋から旅をやり直します
        </p>
        <Button variant="destructive" className="mt-3 w-full" onClick={() => setResetOpen(true)}>
          <RotateCcw /> データを初期化する
        </Button>
      </div>

      {message && (
        <p className={cn("text-center text-xs tracking-wider", message.error ? "text-destructive" : "text-aqua/80")}>
          {message.text}
        </p>
      )}

      <Dialog open={pendingImport !== null} onOpenChange={(open) => !open && setPendingImport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="tracking-wider">記録を復元しますか？</DialogTitle>
            <DialogDescription className="[word-break:auto-phrase]">
              「{pendingImport?.name}」の内容で、この端末の記録を上書きします。現在の記録は失われます。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingImport(null)}>
              やめる
            </Button>
            <Button onClick={restore}>
              <Upload /> 復元する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="tracking-wider">本当にすべての魔力と記憶を消去しますか？</DialogTitle>
            <DialogDescription className="[word-break:auto-phrase]">
              累積魔力・魔導の軌跡・図鑑の記録・設定がすべて消え、元に戻すことはできません。必要なら先に記録を書き出してください。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              やめる
            </Button>
            <Button variant="destructive" onClick={reset}>
              <RotateCcw /> 消去して原点へ戻る
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DataAction({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <p className="flex items-center gap-1.5 text-sm tracking-wider whitespace-nowrap">
        <Icon className="size-4 shrink-0 text-aqua/80" strokeWidth={1.25} />
        {title}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground [word-break:auto-phrase]">{description}</p>
      <div className="mt-3 flex justify-end">{children}</div>
    </div>
  );
}
