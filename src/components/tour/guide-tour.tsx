"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Compass } from "lucide-react";
import { ArrowGlyph } from "@/components/arcane-icons";
import { Button } from "@/components/ui/button";
import { markGuideSeen, useGuideSeen, type GuideId } from "@/lib/onboarding";
import { usePortraitPhone } from "@/lib/use-portrait-phone";
import { cn } from "@/lib/utils";

export type GuideStep = {
  /**
   * 照らす要素（data-tour の値）。並べたときは、画面に出ている最初のものを照らす（スマホとパソコンで置き場所が違うとき）。
   * 無いか、どれも見当たらなければ画面の中央で語る
   */
  target?: string | string[];
  title: string;
  label: string;
  /** 世界観の言葉に馴染みのない人にも何をするところか伝わるよう、ふつうの言葉で言い換えた一言 */
  plain?: string;
  /** 本文は一、二文に留める（長いと読まれない） */
  body: string;
};

// 「案内」のボタンから、いま開いている画面の案内をもう一度呼ぶ
let requested: GuideId | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export function openGuide(id: GuideId) {
  requested = id;
  emit();
}

function closeGuide(id: GuideId) {
  if (requested !== id) return;
  requested = null;
  emit();
}

function useRequestedGuide() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => requested,
    () => null,
  );
}

/** 案内を出すかどうか: 初めて開いたとき（auto のとき）か、「案内」のボタンで呼ばれたとき */
function useGuideOpen(id: GuideId, auto: boolean) {
  const seen = useGuideSeen(id);
  const asked = useRequestedGuide() === id;
  return asked || (auto && !seen);
}

function finishGuide(id: GuideId) {
  markGuideSeen(id);
  closeGuide(id);
}

/**
 * 画面の案内。初めてその画面を開いたときに、要のところを順に照らして語る。
 * いつでも飛ばせ、終えるか飛ばすと印を残して二度目からは出さない（「案内」のボタンや設定から見返せる）
 */
export function PageGuide({ id, steps, auto = true, onFinish }: { id: GuideId; steps: GuideStep[]; auto?: boolean; onFinish?: () => void }) {
  const open = useGuideOpen(id, auto);
  if (!open) return null;
  return (
    <Tour
      steps={steps}
      onFinish={() => {
        finishGuide(id);
        onFinish?.();
      }}
    />
  );
}

/** 画面の見出しの脇に置く、案内をもう一度開くボタン */
export function GuideButton({ id, className }: { id: GuideId; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => openGuide(id)}
      aria-label="この画面の案内"
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] py-1 pr-2.5 pl-2 text-[11px] tracking-[0.2em] whitespace-nowrap text-muted-foreground backdrop-blur transition-all duration-300 hover:border-starlight/40 hover:text-starlight",
        className,
      )}
    >
      <Compass className="size-3.5 shrink-0 text-starlight" strokeWidth={1.5} />
      <span className="max-[400px]:sr-only">案内</span>
    </button>
  );
}

/** 照らす枠の余白（px） */
const PAD = 8;
/** 説明の札と照らす枠との間（px） */
const GAP = 14;
/** 説明の札を置くのに要る高さの目安（px）。これより狭ければ画面の下端に置く */
const CARD_SPACE = 230;

type Rect = { top: number; left: number; width: number; height: number };

/** 照らす要素を探す。並べたときは、大きさのある（画面に出ている）最初のもの */
function findTarget(target: GuideStep["target"]) {
  const names = target === undefined ? [] : Array.isArray(target) ? target : [target];
  for (const name of names) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
      if (el.getBoundingClientRect().width > 0) return el;
    }
  }
  return null;
}

function Tour({ steps, onFinish }: { steps: GuideStep[]; onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const portrait = usePortraitPhone();
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  const next = () => (last ? onFinish() : setIndex((i) => i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));
  // 飛ばすときも、締めくくりの頁（見返せる旨）だけは見せる
  const skip = () => setIndex(steps.length - 1);

  // 照らす要素を画面に収め、動いたり大きさが変わったりしても枠が追いかけるよう毎フレーム測る。
  // 読み込みが遅れて後から現れる要素もあるので、探すのも毎フレーム行う
  useEffect(() => {
    let frame = 0;
    let prev = "";
    let scrolled = false;
    const measure = () => {
      const el = findTarget(step.target);
      if (el && !scrolled) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        scrolled = true;
      }
      const r = el?.getBoundingClientRect();
      const next = r ? { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 } : null;
      const view = { width: window.innerWidth, height: window.innerHeight };
      const key = JSON.stringify([next, view]);
      if (key !== prev) {
        prev = key;
        setRect(next);
        setViewport(view);
      }
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [step.target]);

  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (last) onFinish();
        else skip();
      } else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return createPortal(
    // 案内の間は背後に触れられないよう、画面全体を覆う
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal aria-labelledby="guide-tour-title">
      {/* 照らす枠: 枠の外を暗く沈める。照らす相手が無い節は全体を暗くする */}
      <div
        className={cn(
          "pointer-events-none absolute rounded-2xl transition-all duration-500 ease-out motion-reduce:transition-none",
          rect ? "ring-1 ring-starlight/70 shadow-[0_0_0_9999px_rgba(3,5,11,0.72),0_0_24px_2px_rgba(226,201,116,0.35)]" : "shadow-[0_0_0_9999px_rgba(3,5,11,0.72)]",
        )}
        style={rect ?? { top: "50%", left: "50%", width: 0, height: 0 }}
        aria-hidden
      />
      <div
        className="glass absolute flex flex-col gap-3 rounded-2xl bg-[rgba(9,13,24,0.94)]! p-4 backdrop-blur-xl transition-[top,bottom,left] duration-500 ease-out motion-reduce:transition-none"
        style={placeCard(rect, viewport, portrait)}
      >
        <GuidePage step={step} index={index} total={steps.length} titleId="guide-tour-title" />
        <GuideControls
          index={index}
          total={steps.length}
          nextRef={nextRef}
          onNext={next}
          onBack={back}
          onSkip={skip}
        />
      </div>
    </div>,
    document.body,
  );
}

/** 説明の札の置き場所: 照らす枠の下に余白があれば下、無ければ上、どちらも狭ければ画面の下端 */
function placeCard(rect: Rect | null, view: { width: number; height: number }, portrait: boolean): CSSProperties {
  const width = portrait ? Math.min(view.width - 32, 400) : 360;
  if (!rect) return { width, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  const left = portrait
    ? (view.width - width) / 2
    : Math.min(Math.max(rect.left + rect.width / 2 - width / 2, 16), view.width - width - 16);
  const below = view.height - (rect.top + rect.height);
  if (below >= CARD_SPACE) return { width, left, top: rect.top + rect.height + GAP };
  if (rect.top >= CARD_SPACE) return { width, left, bottom: view.height - rect.top + GAP };
  return { width, left, bottom: 16 };
}

/** 案内の一頁: 見出しと英語の名、ふつうの言葉の言い換え、本文 */
function GuidePage({ step, index, total, titleId }: { step: GuideStep; index: number; total: number; titleId?: string }) {
  return (
    // 頁が変わるたびに、札の中身だけを静かに差し替える
    <div key={index} className="flex flex-col gap-2 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-3">
        <h2 id={titleId} className="flex flex-col text-base leading-tight tracking-[0.2em] whitespace-nowrap">
          {step.title}
          <span className="font-display text-[9px] tracking-[0.3em] text-starlight/60">{step.label}</span>
        </h2>
        <span className="shrink-0 font-display text-[11px] tracking-[0.2em] text-muted-foreground">
          {index + 1} / {total}
        </span>
      </div>
      {step.plain && (
        <p className="w-fit rounded-md border border-starlight/25 bg-starlight/[0.06] px-2 py-0.5 text-xs leading-relaxed tracking-wider text-starlight [word-break:auto-phrase]">
          {step.plain}
        </p>
      )}
      <p className="text-[13px] leading-relaxed tracking-wider text-foreground/85 [word-break:auto-phrase]">{step.body}</p>
    </div>
  );
}

function GuideControls({
  index,
  total,
  nextRef,
  onNext,
  onBack,
  onSkip,
  doneLabel = "はじめる",
  startLabel = "巡りはじめる",
}: {
  index: number;
  total: number;
  doneLabel?: string;
  startLabel?: string;
  nextRef?: React.RefObject<HTMLButtonElement | null>;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const last = index === total - 1;
  return (
    <div className="flex items-center gap-2">
      {!last && (
        <button
          type="button"
          onClick={onSkip}
          className="mr-auto text-xs tracking-[0.2em] text-muted-foreground underline-offset-4 transition-colors hover:text-starlight hover:underline"
        >
          スキップ
        </button>
      )}
      {index > 0 && (
        <Button variant="outline" size="sm" className={cn(last && "mr-auto")} onClick={onBack}>
          戻る
        </Button>
      )}
      <Button ref={nextRef} size="sm" className={cn(index === 0 && "ml-auto")} onClick={onNext}>
        {last ? doneLabel : index === 0 ? startLabel : "次へ"}
        {!last && <ArrowGlyph />}
      </Button>
    </div>
  );
}

/**
 * ダイアログの中に置く案内。ダイアログの外に重ねると、外に触れたとみなされて閉じてしまうので、
 * 照らす代わりに、ダイアログの上の方に頁をめくる札として出す
 */
export function InlineGuide({ id, steps, className }: { id: GuideId; steps: GuideStep[]; className?: string }) {
  const open = useGuideOpen(id, true);
  const [index, setIndex] = useState(0);
  if (!open) return null;
  const finish = () => {
    finishGuide(id);
    setIndex(0);
  };
  const last = index === steps.length - 1;
  return (
    <section
      aria-label="案内"
      className={cn("flex flex-col gap-3 rounded-xl border border-starlight/30 bg-[rgba(9,13,24,0.7)] p-3 text-left shadow-[0_0_18px_-6px_rgba(226,201,116,0.45)]", className)}
    >
      <GuidePage step={steps[index]} index={index} total={steps.length} />
      <GuideControls
        index={index}
        total={steps.length}
        doneLabel="閉じる"
        startLabel="次へ"
        onNext={() => (last ? finish() : setIndex((i) => i + 1))}
        onBack={() => setIndex((i) => Math.max(0, i - 1))}
        onSkip={finish}
      />
    </section>
  );
}
