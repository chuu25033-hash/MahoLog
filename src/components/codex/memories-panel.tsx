"use client";

import { WhisperText, whisperHost } from "@/components/whisper";
import { useState } from "react";
import { BookOpenText, Check, ScrollText } from "lucide-react";
import { ItemArt } from "@/components/item-art";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { canRestore, fragmentsOf, isRestored, memoryOf, restoredCount } from "@/lib/crafting";
import { STAGES } from "@/lib/game";
import { DOCUMENTS, type MemoryItem } from "@/lib/items";
import { soundManager } from "@/lib/sound/sound-manager";
import { isDiscovered, userActions, type UserData } from "@/lib/user-store";
import { cn } from "@/lib/utils";

const ROMAN = ["I", "II", "III", "IV"];

/** 星脈の記憶: 古代文書の断片を集め、4葉が揃ったら復元して記憶を読む */
export function MemoriesPanel({ data }: { data: UserData }) {
  const [reading, setReading] = useState<MemoryItem | null>(null);
  const restored = restoredCount(data);

  function restore(documentId: string) {
    const memory = userActions.restoreDocument(documentId);
    if (!memory) return;
    soundManager.playSe("restore");
    setReading(memory);
  }

  return (
    <section className="glass rounded-2xl p-3 lg:p-4">
      <h2 className="mb-1 flex items-baseline gap-2 text-sm tracking-[0.2em] whitespace-nowrap portrait:flex-wrap">
        <ScrollText className="size-4 shrink-0 self-center text-starlight" strokeWidth={1.25} />
        <span className="flex flex-col leading-tight">
          星脈の記憶
          <span className="font-display text-[9px] tracking-[0.3em] text-starlight/60">STELLAR MEMORIES</span>
        </span>
        <span className="ml-auto font-display text-xs text-muted-foreground">
          {restored} / {DOCUMENTS.length}
          <span className="ml-2 font-serif text-[11px] tracking-wider text-aqua">全属性 MP +{restored}%</span>
        </span>
      </h2>
      <p className="mb-3 text-[11px] leading-relaxed tracking-wider text-muted-foreground [word-break:auto-phrase]">
        各ステージに降る流れ星が運ぶ古代文書の断片（I〜IV）を集め、4葉が揃えば復元できます。復元した文書1冊ごとに、全属性の獲得MPが永久に +1% されます
      </p>
      <ul className="grid grid-cols-3 gap-2 portrait:grid-cols-1">
        {DOCUMENTS.map((doc) => (
          <li key={doc.id}>
            <DocumentCard documentId={doc.id} data={data} onRestore={() => restore(doc.id)} onRead={() => setReading(memoryOf(doc.id))} />
          </li>
        ))}
      </ul>
      {reading && <MemoryDialog memory={reading} onClose={() => setReading(null)} />}
    </section>
  );
}

function DocumentCard({
  documentId,
  data,
  onRestore,
  onRead,
}: {
  documentId: string;
  data: UserData;
  onRestore: () => void;
  onRead: () => void;
}) {
  const doc = DOCUMENTS.find((d) => d.id === documentId)!;
  const stage = STAGES.find((s) => s.id === doc.stageId);
  const fragments = fragmentsOf(documentId);
  const restored = isRestored(data, documentId);
  const ready = canRestore(data, documentId);
  const held = fragments.filter((f) => (data.inventory[f.id] ?? 0) > 0).length;
  // 一葉でも見つけるまでは、表題も伏せておく
  const known = restored || fragments.some((f) => isDiscovered(data, f.id));

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-2 rounded-xl border p-3 transition-all duration-500",
        restored ? "bg-white/[0.04]" : "border-white/10 bg-black/15",
        ready && "claim-glow",
      )}
      style={restored || ready ? { borderColor: `${doc.color}66`, boxShadow: `0 0 16px -8px ${doc.color}` } : undefined}
    >
      <div className="flex items-center gap-2">
        <ItemArt
          icon={memoryOf(documentId).svgIcon}
          rarity="S"
          color={doc.color}
          seed={documentId}
          locked={!restored}
          className="size-10 shrink-0"
        />
        <div className="min-w-0">
          <p className="flex flex-wrap items-baseline gap-x-1.5 font-display text-[10px] tracking-[0.25em] text-starlight/60">
            STAGE {doc.stageId}
            <span className="font-serif tracking-wider whitespace-nowrap text-muted-foreground">{stage?.name}</span>
          </p>
          <p className="text-sm tracking-[0.15em]" style={restored ? { color: doc.color } : undefined}>
            {known ? `『${doc.title}』` : "未発見の古代文書"}
          </p>
        </div>
      </div>

      {/* 4葉の断片。手元にある葉が灯る */}
      <div className="grid grid-cols-4 gap-1">
        {fragments.map((f, i) => {
          const count = data.inventory[f.id] ?? 0;
          const lit = restored || count > 0;
          return (
            <span
              key={f.id}
              className={cn(
                whisperHost,
                "flex h-7 items-center justify-center rounded-md border font-display text-[11px] tracking-wider transition-colors duration-500",
                lit ? "bg-white/[0.04]" : "border-white/10 text-white/20",
              )}
              style={lit ? { borderColor: `${doc.color}80`, color: doc.color, textShadow: `0 0 8px ${doc.color}80` } : undefined}
            >
              {ROMAN[i]}
              {count > 1 && <span className="absolute -top-1.5 -right-1 font-display text-[9px] text-aqua">×{count}</span>}
              <WhisperText text={f.name} />
            </span>
          );
        })}
      </div>

      <div className="mt-auto">
        {restored ? (
          <Button size="sm" variant="outline" className="w-full" onClick={onRead}>
            <BookOpenText /> 記憶を読む
          </Button>
        ) : ready ? (
          <Button size="sm" className="w-full" onClick={onRestore}>
            <ScrollText /> 復元する
          </Button>
        ) : (
          <p className="text-center text-[11px] tracking-wider text-muted-foreground">
            断片 <span className="font-display text-foreground">{held}</span> / 4
          </p>
        )}
      </div>
    </div>
  );
}

/** 復元した古代文書の記憶。すりガラスの頁に、一節ずつ静かに浮かび上がる */
function MemoryDialog({ memory, onClose }: { memory: MemoryItem; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[min(32rem,calc(100%-2rem))]! gap-4 overflow-y-auto scrollbar-none rounded-2xl border border-white/10 bg-white/[0.04] p-6 ring-starlight/25 backdrop-blur-2xl short:p-4">
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="font-display text-[10px] tracking-[0.5em] whitespace-nowrap text-starlight/70">
            <span className="-mr-[0.5em]">STELLAR MEMORY</span>
          </p>
          <DialogTitle className="text-lg tracking-[0.3em] whitespace-nowrap" style={{ color: memory.color, textShadow: `0 0 12px ${memory.color}80` }}>
            <span className="-mr-[0.3em]">{memory.name}</span>
          </DialogTitle>
        </div>
        <div className="rank-line w-full" />
        <DialogDescription render={<div />} className="flex flex-col gap-3 text-sm leading-loose tracking-wider text-foreground/90">
          {memory.memory.map((line, i) => (
            <p
              key={i}
              className="animate-in fade-in slide-in-from-bottom-1 duration-1000 [animation-fill-mode:both] [word-break:auto-phrase]"
              style={{ animationDelay: `${600 + i * 900}ms` }}
            >
              {line}
            </p>
          ))}
          {/* 秘された結び: 4葉の本文が浮かび終えたあと、文書の色で遅れて滲み出る */}
          <p
            className="mt-2 animate-in fade-in text-center text-[13px] duration-[2400ms] [animation-fill-mode:both] [word-break:auto-phrase]"
            style={{ animationDelay: `${600 + memory.memory.length * 900 + 1200}ms`, color: memory.color, textShadow: `0 0 10px ${memory.color}66` }}
          >
            <span className="mb-2 block font-display text-[10px] tracking-[0.4em] opacity-70">✦</span>
            {memory.coda}
          </p>
        </DialogDescription>
        <div className="rank-line w-full [animation-delay:300ms]" />
        <p className="flex items-center justify-center gap-1.5 text-[11px] tracking-wider text-aqua">
          <Check className="size-3.5" />
          復元の加護: {memory.effect}（永久）
        </p>
      </DialogContent>
    </Dialog>
  );
}
