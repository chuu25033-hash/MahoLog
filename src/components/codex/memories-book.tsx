"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fragmentsOf, isRestored } from "@/lib/crafting";
import { fillCoda, type AncientDocument } from "@/lib/items";
import { isDiscovered, type UserData } from "@/lib/user-store";

const ROMAN = ["I", "II", "III", "IV"];
const KANJI = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
/** これだけ横に動かしたら頁をめくる（px） */
const SWIPE = 48;

/**
 * 古代文書を時系列の一冊として通して読む。目次 → 各章（1冊1見開き）→ 最後の頁。
 * 手に入れた葉は復元前でも読め、まだ無い葉は細い線だけ、結びは復元した章だけに現れる
 */
export function MemoriesBook({
  data,
  documents,
  name,
  minutes,
  onClose,
}: {
  data: UserData;
  /** 棚に並んでいる文書（塔を知るまで『余白の原典』は含まない） */
  documents: AncientDocument[];
  name: string;
  minutes: number;
  onClose: () => void;
}) {
  const origin = documents.find((d) => d.zenithFloors);
  // 頁: 0 = 目次、1..n = 各章、n+1 = 最後の頁（原典が棚にあるときだけ）
  const last = documents.length + (origin ? 1 : 0);
  const [page, setPage] = useState(0);
  const swipeFrom = useRef<number | null>(null);

  const go = (to: number) => setPage(Math.max(0, Math.min(last, to)));

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowRight") go(page + 1);
    else if (e.key === "ArrowLeft") go(page - 1);
  }

  function onPointerDown(e: PointerEvent) {
    swipeFrom.current = e.clientX;
  }

  function onPointerUp(e: PointerEvent) {
    if (swipeFrom.current === null) return;
    const dx = e.clientX - swipeFrom.current;
    swipeFrom.current = null;
    if (dx <= -SWIPE) go(page + 1);
    else if (dx >= SWIPE) go(page - 1);
  }

  const doc = page >= 1 && page <= documents.length ? documents[page - 1] : null;
  const color = doc && isKnown(data, doc) ? doc.color : "#e2c974";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (swipeFrom.current = null)}
        className="flex h-[min(40rem,calc(100dvh-1rem))] max-w-[min(32rem,calc(100%-2rem))]! touch-pan-y flex-col gap-3 overflow-hidden rounded-2xl border bg-white/[0.04] p-6 backdrop-blur-2xl transition-[border-color,box-shadow] duration-700 short:p-4"
        style={{ borderColor: `${color}55`, boxShadow: `0 0 28px -14px ${color}` }}
      >
        <div className="flex flex-col items-center gap-0.5 text-center">
          <DialogTitle className="text-sm tracking-[0.3em] whitespace-nowrap text-starlight">
            <span className="-mr-[0.3em]">星脈の記憶</span>
          </DialogTitle>
          <span className="font-display text-[9px] tracking-[0.4em] whitespace-nowrap text-starlight/50">
            <span className="-mr-[0.4em]">STELLAR MEMORIES</span>
          </span>
        </div>
        <div className="rank-line w-full" />

        <DialogDescription
          render={<div />}
          key={page}
          className="min-h-0 flex-1 animate-in overflow-y-auto overscroll-contain fade-in text-sm leading-loose tracking-wider text-foreground/90 duration-700"
        >
          {page === 0 ? (
            <Contents data={data} documents={documents} hasLastPage={!!origin} onOpen={go} />
          ) : doc ? (
            <Chapter data={data} doc={doc} index={page - 1} name={name} minutes={minutes} />
          ) : (
            <LastPage restored={!!origin && isRestored(data, origin.id)} line={origin ? signature(origin, name, minutes) : ""} />
          )}
        </DialogDescription>

        <div className="rank-line w-full" />
        <nav className="flex items-center justify-between gap-2" aria-label="頁をめくる">
          <Button size="icon-sm" variant="ghost" onClick={() => go(page - 1)} disabled={page === 0} aria-label="前の頁">
            <ChevronLeft />
          </Button>
          <button
            type="button"
            onClick={() => go(0)}
            disabled={page === 0}
            className="flex items-center gap-1.5 font-display text-[11px] tracking-[0.3em] text-muted-foreground transition-colors enabled:hover:text-starlight"
            aria-label="目次へ"
          >
            {page === 0 ? "目次" : <List className="size-3.5" />}
            {page > 0 && (
              <span>
                {page} / {last}
              </span>
            )}
          </button>
          <Button size="icon-sm" variant="ghost" onClick={() => go(page + 1)} disabled={page === last} aria-label="次の頁">
            <ChevronRight />
          </Button>
        </nav>
      </DialogContent>
    </Dialog>
  );
}

/** 一葉でも見つけたか、復元した章は表題を明かす */
function isKnown(data: UserData, doc: AncientDocument) {
  return isRestored(data, doc.id) || fragmentsOf(doc.id).some((f) => isDiscovered(data, f.id));
}

/** 結びの最後の一行（――観測者 〈名前〉、〈累計時間〉の刻をここに預ける） */
function signature(doc: AncientDocument, name: string, minutes: number) {
  const coda = fillCoda(doc.coda, name, minutes);
  const at = coda.lastIndexOf("――");
  return at >= 0 ? coda.slice(at) : coda;
}

function Contents({
  data,
  documents,
  hasLastPage,
  onOpen,
}: {
  data: UserData;
  documents: AncientDocument[];
  hasLastPage: boolean;
  onOpen: (page: number) => void;
}) {
  return (
    <ol className="flex flex-col gap-1">
      {documents.map((doc, i) => {
        const known = isKnown(data, doc);
        return (
          <li key={doc.id}>
            <button
              type="button"
              onClick={() => onOpen(i + 1)}
              className="flex w-full items-baseline gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
            >
              <span className="w-12 shrink-0 text-[11px] tracking-[0.2em] whitespace-nowrap text-muted-foreground">第{KANJI[i]}章</span>
              <span className="min-w-0 flex-1 tracking-[0.15em] whitespace-nowrap" style={known ? { color: doc.color } : undefined}>
                {known ? `『${doc.title}』` : <span className="text-muted-foreground/50">未発見の章</span>}
              </span>
              {known && <span className="shrink-0 text-[11px] tracking-wider whitespace-nowrap text-muted-foreground">{doc.era}</span>}
            </button>
          </li>
        );
      })}
      {hasLastPage && (
        <li>
          <button
            type="button"
            onClick={() => onOpen(documents.length + 1)}
            className="flex w-full items-baseline gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
          >
            <span className="w-12 shrink-0" />
            <span className="tracking-[0.15em] whitespace-nowrap text-muted-foreground">最後の頁</span>
          </button>
        </li>
      )}
    </ol>
  );
}

function Chapter({ data, doc, index, name, minutes }: { data: UserData; doc: AncientDocument; index: number; name: string; minutes: number }) {
  const known = isKnown(data, doc);
  const restored = isRestored(data, doc.id);
  const fragments = fragmentsOf(doc.id);

  if (!known) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <span className="text-[11px] tracking-[0.3em] whitespace-nowrap text-muted-foreground">第{KANJI[index]}章</span>
        <span className="tracking-[0.2em] whitespace-nowrap text-muted-foreground/60">未発見の章</span>
      </div>
    );
  }

  return (
    <article className="flex flex-col gap-3">
      <header className="flex flex-col items-center gap-0.5 text-center">
        <span className="text-[11px] tracking-[0.3em] whitespace-nowrap text-muted-foreground">
          <span className="-mr-[0.3em]">{doc.era}</span>
        </span>
        <span className="font-display text-[9px] tracking-[0.35em] whitespace-nowrap text-muted-foreground/60">
          <span className="-mr-[0.35em]">{doc.eraEn}</span>
        </span>
        <span className="mt-1 text-[11px] tracking-[0.3em] whitespace-nowrap text-foreground/70">― 第{KANJI[index]}章 ―</span>
        <h3 className="text-lg tracking-[0.25em] whitespace-nowrap" style={{ color: doc.color, textShadow: `0 0 12px ${doc.color}80` }}>
          <span className="-mr-[0.25em]">『{doc.title}』</span>
        </h3>
        <span className="text-[11px] tracking-[0.2em] whitespace-nowrap text-muted-foreground">記: {doc.author}</span>
      </header>

      <ol className="flex flex-col gap-2.5">
        {fragments.map((f, i) => {
          const held = restored || isDiscovered(data, f.id);
          return (
            <li key={f.id} className="flex gap-3">
              <span className="w-6 shrink-0 pt-px font-display text-[11px] tracking-wider" style={{ color: held ? doc.color : undefined }}>
                {ROMAN[i]}
              </span>
              {held ? (
                <p className="min-w-0 flex-1 [word-break:auto-phrase]">{doc.fragments[i]}</p>
              ) : (
                // まだ無い葉: 本文の代わりに細い線を一本だけ引く
                <span className="mt-[0.9em] h-px flex-1 bg-white/10" aria-label="まだ見つけていない葉" />
              )}
            </li>
          );
        })}
      </ol>

      {restored && (
        <p className="mt-1 text-center text-[13px] [word-break:auto-phrase]" style={{ color: doc.color, textShadow: `0 0 10px ${doc.color}66` }}>
          <span className="mb-1 block font-display text-[10px] tracking-[0.4em] opacity-70">✦</span>
          {fillCoda(doc.coda, name, minutes)}
        </p>
      )}
    </article>
  );
}

/** 最後の頁: 原典を復元していれば自分の名と刻の一行だけ。まだなら空白のまま閉じている */
function LastPage({ restored, line }: { restored: boolean; line: string }) {
  return (
    <div className="flex h-full items-center justify-center px-2 text-center">
      {restored ? (
        <p className="animate-in text-[13px] tracking-[0.15em] text-starlight/90 duration-[2400ms] [animation-delay:600ms] [animation-fill-mode:both] fade-in [word-break:auto-phrase]">
          {line}
        </p>
      ) : (
        <span className="sr-only">この頁は、まだ空白のまま閉じられている</span>
      )}
    </div>
  );
}
