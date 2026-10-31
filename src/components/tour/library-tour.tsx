"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowGlyph } from "@/components/arcane-icons";
import { Button } from "@/components/ui/button";
import { markLibraryTourDone, useLibraryTourDone } from "@/lib/onboarding";
import { useStoredUserData } from "@/lib/user-store";
import { WORLDLINES_OPEN } from "@/lib/worldline-store";
import { usePortraitPhone } from "@/lib/use-portrait-phone";
import { cn } from "@/lib/utils";

type Step = {
  /** 照らす要素（data-tour の値）。無ければ画面の中央で語る */
  target?: string;
  title: string;
  label: string;
  body: string;
};

/** 書庫を巡る順。各ボタンが何をするところかを、一つずつ照らして語る */
const STEPS: Step[] = [
  {
    title: "魔術書庫へようこそ",
    label: "WELCOME TO THE LIBRARY",
    body: "ここは旅の拠点となる書庫です。はじめに、書庫に並ぶ扉をひとつずつ巡ってみましょう。",
  },
  {
    target: "profile",
    title: "探究者の記録",
    label: "SCHOLAR",
    body: "あなたの名と魔術階級、探求度です。学んだ時間はエリアや遺物の加護を受けて累積魔力（MP）となり、貯まるほど探求度と階級が上がります。名前に触れると、実績で得た称号をひとつ掲げられます。",
  },
  {
    target: "chant",
    title: "詠唱を開始する",
    label: "BEGIN THE CHANT",
    body: "学びの時間を計る詠唱の間へ向かいます。科目を選んで集中すると、詠唱の長さに応じて流れ星が降り、遺物が届きます。30分に届くと流星群が近づき、静息を挟んで25分以上の詠唱を紡ぐほど星脈との同調が高まります。閉じても続きから戻れます。",
  },
  {
    target: "stage",
    title: "滞在するエリア",
    label: "AREA",
    body: "いま滞在している地と、その地で魔力が増える属性です。「エリア選択」で移り住めます。魔力が貯まるほど奥地が開かれます。",
  },
  {
    target: "totals",
    title: "今宵・七夜・月巡り",
    label: "RECORDS",
    body: "今日・今週（月曜から）・今月に詠唱した時間です。",
  },
  {
    target: "trials",
    title: "星の試練",
    label: "TRIALS",
    body: "毎日の星天の導き、日課の儀式、週間の誓約がまとまっています。15分以上の詠唱が1回と数えられ、受け取れる報酬があると数字が灯ります。",
  },
  {
    target: "history",
    title: "魔導の軌跡",
    label: "CHRONICLE",
    body: "これまでの詠唱を暦で振り返れます。今週までの4週間を、1週ひとつの星座として描きます。",
  },
  {
    target: "worldlines",
    title: "結びし世界線",
    label: "BOUND WORLDLINES",
    body: WORLDLINES_OPEN
      ? "遠い世界線の観測者と結ばれ、互いの探求の気配を静かに感じられます。順位を競うことはありません。"
      : "遠い世界線の観測者と結ばれ、互いの探求の気配を静かに感じられる場所です。いまは準備中で、開くまでもうしばらくお待ちください。",
  },
  {
    target: "settings",
    title: "設定（秘術探究者の書斎）",
    label: "SETTINGS",
    body: "名前や紋章、詠唱時間、音を整えるところです。記録を引き継ぐための観測者IDと復元キーもここにあります。",
  },
  {
    target: "radar",
    title: "魔法陣",
    label: "ARCANE CIRCLE",
    body: "科目ごとに詠唱した時間の釣り合いを、魔法陣の形で映します。右上から画像にして共有もできます。",
  },
  {
    target: "codex",
    title: "魔導図鑑",
    label: "CODEX",
    body: "詠唱で手に入れた遺物や、復元した古代文書が収められていきます。錬成陣では余った遺物を原石に還元し、神話の遺物を生み出せます。",
  },
  {
    target: "memory",
    title: "詠唱の記憶",
    label: "OBSERVATIONAL MEMORY",
    body: "最近の詠唱と、得た魔力の記録です。",
  },
  {
    title: "準備は整いました",
    label: "READY TO OBSERVE",
    body: "まずは書庫を気ままに巡ってみてください。学びの時が来たら「詠唱を開始する」から。この案内は設定からいつでも見返せます。",
  },
];

/** 照らす枠の余白（px） */
const PAD = 8;
/** 説明の札と照らす枠との間（px） */
const GAP = 14;
/** 説明の札を置くのに要る高さの目安（px）。これより狭ければ画面の下端に置く */
const CARD_SPACE = 230;

type Rect = { top: number; left: number; width: number; height: number };

/**
 * 初めて書庫に入ったときの案内。各ボタンを順に照らし、何をするところかを語る。
 * いつでも飛ばせる。終えるか飛ばすと印を残し、二度目からは出さない（設定から見返せる）
 */
export function LibraryTour() {
  const done = useLibraryTourDone();
  const data = useStoredUserData();
  // 既に詠唱を重ねている人には、改めて案内しない（設定から見返せる）
  const veteran = (data?.chantHistory.length ?? 0) > 0 && !wantsReplay();
  if (done || !data || veteran) return null;
  return <Tour />;
}

/** 設定の「書庫の案内をもう一度見る」から来たか */
function wantsReplay() {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).has("tour");
}

function Tour() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const portrait = usePortraitPhone();
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  function finish() {
    markLibraryTourDone();
    // 見返すために付けた印は消しておく
    if (wantsReplay()) router.replace("/dashboard", { scroll: false });
  }

  const next = () => (last ? finish() : setIndex((i) => i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  // 照らす要素を画面に収め、動いたり大きさが変わったりしても枠が追いかけるよう毎フレーム測る
  useEffect(() => {
    const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    let frame = 0;
    let prev = "";
    const measure = () => {
      const r = el?.getBoundingClientRect();
      const next = r && r.width > 0 ? { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 } : null;
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
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return createPortal(
    // 案内の間は背後に触れられないよう、画面全体を覆う
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal aria-labelledby="library-tour-title">
      {/* 照らす枠: 枠の外を暗く沈める。照らす相手が無い節は全体を暗くする */}
      <div
        className={cn(
          "pointer-events-none absolute rounded-2xl transition-all duration-500 ease-out motion-reduce:transition-none",
          rect ? "ring-1 ring-starlight/70 shadow-[0_0_0_9999px_rgba(3,5,11,0.72),0_0_24px_2px_rgba(226,201,116,0.35)]" : "shadow-[0_0_0_9999px_rgba(3,5,11,0.72)]",
        )}
        style={rect ?? { top: "50%", left: "50%", width: 0, height: 0 }}
        aria-hidden
      />
      <TourCard
        step={step}
        index={index}
        style={placeCard(rect, viewport, portrait)}
        nextRef={nextRef}
        onNext={next}
        onBack={back}
        onSkip={finish}
      />
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

function TourCard({
  step,
  index,
  style,
  nextRef,
  onNext,
  onBack,
  onSkip,
}: {
  step: Step;
  index: number;
  style: CSSProperties;
  nextRef: React.RefObject<HTMLButtonElement | null>;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const last = index === STEPS.length - 1;
  return (
    <div
      className="glass absolute flex flex-col gap-3 rounded-2xl bg-[rgba(9,13,24,0.94)]! p-4 backdrop-blur-xl transition-[top,bottom,left] duration-500 ease-out motion-reduce:transition-none"
      style={style}
    >
      {/* 節が変わるたびに、札の中身だけを静かに差し替える */}
      <div key={index} className="flex flex-col gap-2 animate-in fade-in duration-500">
        <div className="flex items-start justify-between gap-3">
          <h2 id="library-tour-title" className="flex flex-col text-base leading-tight tracking-[0.2em] whitespace-nowrap">
            {step.title}
            <span className="font-display text-[9px] tracking-[0.3em] text-starlight/60">{step.label}</span>
          </h2>
          <span className="shrink-0 font-display text-[11px] tracking-[0.2em] text-muted-foreground">
            {index + 1} / {STEPS.length}
          </span>
        </div>
        <p className="text-[13px] leading-relaxed tracking-wider text-foreground/85 [word-break:auto-phrase]">{step.body}</p>
      </div>
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
          {last ? "はじめる" : index === 0 ? "巡りはじめる" : "次へ"}
          {!last && <ArrowGlyph />}
        </Button>
      </div>
    </div>
  );
}
