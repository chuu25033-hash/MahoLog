"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { markPrologueCompleted } from "@/lib/prologue";
import { soundManager } from "@/lib/sound/sound-manager";
import { usePortraitPhone } from "@/lib/use-portrait-phone";

/** 魔法陣が描かれはじめてから、最初の一節が浮かぶまで（ms） */
const OPEN_MS = 3200;
/** 一節ごとの長さ（ms）。浮かぶ → 留まる → 消えるまで */
const LINE_MS = 6200;
/** 一節が浮かぶ・消えるのにかける時間（ms）。CSS の transition と合わせる */
const FADE_MS = 1600;
/** 最後の一節は長く留める（ms） */
const LAST_LINE_MS = 6000;
/** 全体が闇に溶けて、メイン画面へ移るまで（ms） */
const CLOSE_MS = 2200;

const LINES: ReactNode[] = [
  <>
    世界から、言葉と
    <ruby>
      刻<rp>（</rp>
      <rt>とき</rt>
      <rp>）</rp>
    </ruby>
    が失われて久しい。
  </>,
  "静寂の中に残されたのは、忘れ去られた古代の魔法陣のみ。",
  "汝の集積が、星脈に光を灯す鍵となる。",
  "— 観測を、始めよう。",
];

type Phase = "waiting" | "playing" | "closing";

/**
 * 初回のプロローグ（創世の記録）。飛ばせず、触れても進まない。
 * 暗闇に 1px の魔法陣が脈打ちながら描かれ、四つの節が静かに浮かんでは消える。
 * 縦持ちのスマホは魔法陣を上に小さく、文字を下に。PC・横画面は魔法陣を画面いっぱいに広げ、文字を中央に置く。
 * 見届けると印を残し、onDone を呼ぶ
 */
export function Prologue({ onDone }: { onDone?: () => void }) {
  const portrait = usePortraitPhone();
  // 音が起きていなければ（初めての訪問など）、最初の一触れで音を起こしてから始める
  const [phase, setPhase] = useState<Phase>(() => (soundManager.isAwake() ? "playing" : "waiting"));
  const [line, setLine] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // 演出の間は環境音を消し、背後の画面には触れられないようにする
  useEffect(() => {
    soundManager.setSilenced(true);
    const others = Array.from(document.body.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el !== rootRef.current && !el.inert,
    );
    others.forEach((el) => (el.inert = true));
    return () => {
      soundManager.setSilenced(false);
      others.forEach((el) => (el.inert = false));
    };
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    at(0, () => soundManager.playSe("prologueOpen"));
    let t = OPEN_MS;
    LINES.forEach((_, i) => {
      const last = i === LINES.length - 1;
      at(t, () => {
        setLine(i);
        soundManager.playSe("prologueLine");
      });
      t += last ? LAST_LINE_MS : LINE_MS;
      if (!last) at(t - FADE_MS, () => setLine(null));
    });
    at(t, () => setPhase("closing"));
    at(t + CLOSE_MS, () => {
      markPrologueCompleted();
      onDoneRef.current?.();
    });
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  function begin() {
    if (phase !== "waiting") return;
    void soundManager.wake();
    setPhase("playing");
  }

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal
      aria-label="プロローグ 創世の記録"
      onPointerDown={begin}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") begin();
      }}
      tabIndex={-1}
      className={`prologue fixed inset-0 z-[95] select-none overflow-hidden bg-[#03050b] outline-none transition-opacity ease-in-out ${
        phase === "closing" ? "opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${CLOSE_MS}ms` }}
      data-drawing={phase !== "waiting" || undefined}
    >
      {portrait ? <PortraitStage line={line} /> : <WideStage line={line} />}

      {phase === "waiting" && (
        <button
          type="button"
          autoFocus
          onClick={begin}
          className="prologue-wait absolute inset-x-0 bottom-[14dvh] mx-auto flex w-fit flex-col items-center gap-1 px-6 py-3 text-starlight/80 outline-none"
        >
          <span className="text-sm tracking-[0.4em] whitespace-nowrap">画面に触れて、記録をひらく</span>
          <span className="font-display text-[9px] tracking-[0.4em] text-starlight/50">TOUCH TO BEGIN</span>
        </button>
      )}
    </div>,
    document.body,
  );
}

/** 縦持ち: 魔法陣を上にコンパクトに、文字を中央下に読みやすく */
function PortraitStage({ line }: { line: number | null }) {
  return (
    <div className="flex h-full flex-col items-center px-8 pt-[calc(env(safe-area-inset-top)+10dvh)] pb-[calc(env(safe-area-inset-bottom)+8dvh)]">
      <svg
        viewBox="-200 -200 400 400"
        className="prologue-pulse size-[min(68vw,36dvh)] shrink-0 text-starlight"
        fill="none"
        aria-hidden
      >
        <g className="prologue-spin">{COMPACT_SIGIL}</g>
      </svg>
      <div className="relative mt-[6dvh] flex w-full flex-1 items-center justify-center">
        <Lines line={line} className="text-[15px] leading-[2.2] tracking-[0.2em]" />
      </div>
    </div>
  );
}

/** PC・横画面: 魔法陣を左右・放射状に大きく広げ、奥行きをつけて文字を中央に */
function WideStage({ line }: { line: number | null }) {
  return (
    <>
      <svg
        viewBox="-800 -450 1600 900"
        preserveAspectRatio="xMidYMid slice"
        className="prologue-pulse absolute inset-0 size-full text-starlight"
        fill="none"
        aria-hidden
      >
        <g className="prologue-far">{FAR_LAYER}</g>
        <g className="prologue-mid">{MID_LAYER}</g>
        <g className="prologue-spin">{CORE_LAYER}</g>
      </svg>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(closest-side,rgba(3,5,11,0.92)_0%,rgba(3,5,11,0.6)_45%,transparent_80%)] [background-size:70%_45%] bg-center bg-no-repeat"
        aria-hidden
      />
      <div className="absolute inset-0 flex items-center justify-center px-10">
        <Lines line={line} className="text-xl leading-loose tracking-[0.3em] whitespace-nowrap lg:text-2xl" />
      </div>
    </>
  );
}

/** 四つの節を同じ位置に重ね、いまの一節だけを浮かべる */
function Lines({ line, className }: { line: number | null; className: string }) {
  return (
    <div className="relative grid w-full place-items-center text-center" aria-live="polite">
      {LINES.map((text, i) => {
        const last = i === LINES.length - 1;
        return (
          <p
            key={i}
            aria-hidden={line !== i}
            className={`col-start-1 row-start-1 max-w-full font-serif [word-break:auto-phrase] transition-all ease-in-out ${className} ${
              last ? "font-medium text-starlight-gradient" : "text-foreground/90"
            } ${line === i ? "opacity-100 blur-0" : "opacity-0 blur-[3px]"}`}
            style={{ transitionDuration: `${FADE_MS}ms` }}
          >
            {text}
          </p>
        );
      })}
    </div>
  );
}

// ---------- 魔法陣の図形 ----------
// すべて 1px の線（拡大しても太らない）。pathLength=1 にそろえ、CSS で描き順を遅らせて描いていく

type Shape =
  | { kind: "circle"; cx?: number; cy?: number; r: number }
  | { kind: "ellipse"; rx: number; ry: number }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "polygon"; points: [number, number][] };

const polar = (r: number, deg: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [Math.round(Math.cos(a) * r * 100) / 100, Math.round(Math.sin(a) * r * 100) / 100];
};

const ring = (n: number, r: number, offset = 0) => Array.from({ length: n }, (_, i) => polar(r, offset + (i * 360) / n));

/** 星形の多角形（n 頂点を step おきに結ぶ） */
const star = (n: number, step: number, r: number, offset = 0): [number, number][] => {
  const pts = ring(n, r, offset);
  return Array.from({ length: n }, (_, i) => pts[(i * step) % n]);
};

const rays = (n: number, r1: number, r2: number, offset = 0): Shape[] =>
  Array.from({ length: n }, (_, i) => {
    const [x1, y1] = polar(r1, offset + (i * 360) / n);
    const [x2, y2] = polar(r2, offset + (i * 360) / n);
    return { kind: "line", x1, y1, x2, y2 };
  });

/** 図形を、描き始めの時刻（s）と濃さを添えて並べる */
function draw(shapes: Shape[], start: number, span: number, opacity = 1): ReactNode[] {
  return shapes.map((s, i) => {
    const style = {
      "--draw-delay": `${start + (shapes.length > 1 ? (i / (shapes.length - 1)) * span : 0)}s`,
      opacity,
    } as CSSProperties;
    const key = `${start}-${i}`;
    const common = {
      className: "prologue-draw",
      stroke: "currentColor",
      strokeWidth: 1,
      vectorEffect: "non-scaling-stroke" as const,
      pathLength: 1,
      style,
    };
    switch (s.kind) {
      case "circle":
        return <circle key={key} {...common} cx={s.cx ?? 0} cy={s.cy ?? 0} r={s.r} />;
      case "ellipse":
        return <ellipse key={key} {...common} rx={s.rx} ry={s.ry} />;
      case "line":
        return <line key={key} {...common} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />;
      case "polygon":
        return <polygon key={key} {...common} points={s.points.map((p) => p.join(",")).join(" ")} />;
    }
  });
}

const circles = (...rs: number[]): Shape[] => rs.map((r) => ({ kind: "circle", r }));

/** 縦持ち用: 小さくまとめた一つの魔法陣 */
const COMPACT_SIGIL = [
  ...draw(circles(180, 172), 0, 0.6),
  ...draw(circles(132, 96, 40), 0.6, 1.2),
  ...draw([{ kind: "polygon", points: ring(3, 132) }, { kind: "polygon", points: ring(3, 132, 60) }], 1.4, 0.5),
  ...draw(rays(12, 96, 132, 15), 2, 1.2, 0.7),
  ...draw(rays(24, 172, 180), 2.6, 1, 0.8),
  ...draw(
    ring(6, 132).map(([cx, cy]) => ({ kind: "circle", cx, cy, r: 9 })),
    3,
    0.8,
  ),
  ...draw([{ kind: "polygon", points: star(8, 3, 40) }], 3.4, 0, 0.8),
];

/** 横画面の奥の層: 画面を横切る楕円と、四隅へ伸びる光の筋 */
const FAR_LAYER = [
  ...draw([{ kind: "ellipse", rx: 760, ry: 400 }, { kind: "ellipse", rx: 620, ry: 330 }], 0.4, 0.8, 0.35),
  ...draw(rays(8, 340, 920, 45 / 2), 1.2, 1.6, 0.22),
  ...draw([{ kind: "line", x1: -790, y1: 0, x2: 790, y2: 0 }], 0.8, 0, 0.45),
];

/** 横画面の中ほどの層: 左右に広がる翼のような副陣と、外輪の放射線 */
const satellites = [-1, 1].flatMap((side): Shape[] => [
  { kind: "circle", cx: side * 500, cy: 0, r: 70 },
  { kind: "circle", cx: side * 500, cy: 0, r: 52 },
  { kind: "polygon", points: ring(4, 70, 45).map(([x, y]) => [x + side * 500, y]) },
  { kind: "circle", cx: side * 660, cy: 0, r: 30 },
  { kind: "polygon", points: ring(3, 30, side * 90).map(([x, y]) => [x + side * 660, y]) },
  { kind: "line", x1: side * 340, y1: -120, x2: side * 500, y2: -70 },
  { kind: "line", x1: side * 340, y1: 120, x2: side * 500, y2: 70 },
]);

const MID_LAYER = [
  ...draw(rays(36, 300, 340), 1.6, 1.4, 0.55),
  ...draw(rays(12, 300, 400, 15), 2, 1, 0.45),
  ...draw(circles(400), 1.8, 0, 0.3),
  ...draw(satellites, 2.4, 1.6, 0.7),
];

/** 横画面の中心の層: ゆっくり巡る主陣 */
const CORE_LAYER = [
  ...draw(circles(300, 290), 0, 0.5),
  ...draw(circles(240, 180, 110, 50), 0.5, 1.2),
  ...draw([{ kind: "polygon", points: ring(4, 240) }, { kind: "polygon", points: ring(4, 240, 45) }], 1.2, 0.4),
  ...draw([{ kind: "polygon", points: star(7, 3, 180) }], 1.8, 0, 0.8),
  ...draw(rays(24, 240, 290), 2.2, 1, 0.6),
  ...draw(
    ring(8, 240).map(([cx, cy]) => ({ kind: "circle", cx, cy, r: 12 })),
    2.8,
    0.8,
  ),
  ...draw([{ kind: "polygon", points: star(5, 2, 50) }], 3.2, 0, 0.9),
];
