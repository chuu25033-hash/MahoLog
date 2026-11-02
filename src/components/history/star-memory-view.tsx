"use client";

import { useId, useMemo, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Moon, Sparkles, Star } from "lucide-react";
import { BackToLibrary } from "@/components/back-to-library";
import { ItemArt } from "@/components/item-art";
import { PageLoading } from "@/components/page-loading";
import { demoSubjects } from "@/lib/demo";
import { formatMinutes } from "@/lib/game";
import { startOfJstMonth } from "@/lib/date";
import { addMonths, firstChantMonth, observedNightsFrom, weekSizes, type ObservedNight } from "@/lib/star-memory";
import { withCustomNames } from "@/lib/subjects";
import type { Subject } from "@/lib/types";
import { totalChantMinutes, useStoredUserData } from "@/lib/user-store";
import { cn } from "@/lib/utils";

/** 拡大縮小しても 1px を保つ光の線 */
const hairline = { vectorEffect: "non-scaling-stroke", fill: "none", strokeWidth: 1 } as const;

const GOLD = "#e2c974";
const AQUA = "#7fe8dc";
const DIM = "#64748b";
const ROMAN = ["I", "II", "III", "IV", "V"];
const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ";

/** 一週間の7夜にちなむ七芒星 {7/3} */
function heptagram(r: number) {
  return Array.from({ length: 7 }, (_, i) => {
    const angle = ((-90 + ((i * 3) % 7) * (360 / 7)) * Math.PI) / 180;
    return `${Math.cos(angle) * r},${Math.sin(angle) * r}`;
  }).join(" ");
}

/** 7夜ごとに浮かび上がる星座 */
const CONSTELLATIONS = ["暁の竪琴座", "蒼銀の白鳥座", "紫晶の天秤座", "星冠座"];
/** 29日以降の月末の数夜で描く小さな星座 */
const LAST_CONSTELLATION = "宵灯の小鈴座";

/** その月の w 番目の星座の名前。月ごとに巡る順をずらすので、同じ月はいつ見ても同じ名前になる */
function constellationName(month: Date, w: number) {
  if (w >= CONSTELLATIONS.length) return LAST_CONSTELLATION;
  const jst = new Date(month.getTime() + 9 * 60 * 60 * 1000);
  return CONSTELLATIONS[(jst.getUTCFullYear() * 12 + jst.getUTCMonth() + w) % CONSTELLATIONS.length];
}

const monthLabel = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long" });

type Attribute = "cyan" | "aqua" | "purple";

/** 属性ごとの星のグラデーション（芯 → 中間 → 縁） */
const ATTRIBUTES: Record<Attribute, { label: string; stops: [string, string, string] }> = {
  cyan: { label: "蒼晶", stops: ["#f2fdff", "#a8f1ff", "#4fc9ec"] },
  aqua: { label: "水鏡", stops: ["#f1fffb", "#b8f5e4", "#5fdcc6"] },
  purple: { label: "紫晶", stops: ["#faf5ff", "#d9c8ff", "#a882fb"] },
};

const SUBJECT_ATTRIBUTE: Record<string, Attribute> = { s1: "purple", s2: "cyan", s3: "aqua", s4: "aqua", s5: "purple" };


const dateLabel = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" });

// 決定的な疑似乱数
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/** 極座標（度。0° が右、時計回り）→ 直交座標 */
function polar(r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.cos(rad) * r, y: Math.sin(rad) * r };
}

/** 星を並べる天球図盤の同心円軌道（内側から外側へ） */
const ORBITS = [48, 60, 72];
/** 中央の軌道 */
const ORBIT_MID = ORBITS[1];
/** 星座の中心と、夜が揃ったときに浮かぶ紋章の中心の半径。紋章が外周の目盛りにかからないよう、軌道より少し内側 */
const WEEK_CENTER_R = 56;

type WeekArc = { size: number; start: number; span: number; angle: number; x: number; y: number; end: number };
type ChartLayout = { weeks: WeekArc[]; step: number };

/**
 * 星座の並び: 左上から時計回りに、7夜の星座4つと月末の数夜の星座を円周へ並べる。
 * 夜どうしの間隔はどの星座も同じで、星座と星座のあいだは夜の間隔より広く空ける。28日の月は四象限にちょうど収まる
 */
function chartLayout(sizes: number[]): ChartLayout {
  const gap = sizes.length > 4 ? 18 : 14;
  const step = (360 - sizes.length * gap) / sizes.reduce((acc, n) => acc + n - 1, 0);
  let cursor = -180 + gap / 2;
  const weeks = sizes.map((size) => {
    const start = cursor;
    const span = (size - 1) * step;
    cursor += span + gap;
    const angle = start + span / 2;
    return { size, start, span, angle, ...polar(WEEK_CENTER_R, angle), end: start + span + gap / 2 };
  });
  return { weeks, step };
}

/**
 * 夜ごとに乗る軌道。週ごとに位相をずらした緩やかな波で軌道を渡るので、どの週も外側から内側まで図盤を広く使い、
 * 星は円弧に沿いながらうねって進む。外側の軌道に長く留まり、内側へは時折だけ沈む
 */
const WEEK_ORBITS = Array.from({ length: 5 }, (_, w) =>
  Array.from({ length: 7 }, (_, d) => {
    const wave = Math.sin(w * 1.3 + 0.6 + d * 0.95);
    return ORBITS[wave > 0.2 ? 2 : wave > -0.75 ? 1 : 0];
  }),
);

function starPolar(layout: ChartLayout, week: number, night: number) {
  return { r: WEEK_ORBITS[week][night], angle: layout.weeks[week].start + night * layout.step };
}

function starPosition(layout: ChartLayout, week: number, night: number) {
  const { r, angle } = starPolar(layout, week, night);
  return polar(r, angle);
}

/** 前夜から今夜へ時計回りの円弧で結ぶ。同じ軌道ならその軌道に沿い、軌道を跨ぐ夜は緩やかな弧で渡る */
function tracePath(layout: ChartLayout, a: ObservedNight, b: ObservedNight) {
  const pa = starPolar(layout, a.week, a.nightIndex);
  const pb = starPolar(layout, b.week, b.nightIndex);
  const from = polar(pa.r, pa.angle);
  const to = polar(pb.r, pb.angle);
  const radius = (pa.r + pb.r) / 2;
  return `M ${from.x} ${from.y} A ${radius} ${radius} 0 0 1 ${to.x} ${to.y}`;
}

/** 内径 r1・外径 r2、角度 a1〜a2 の扇環 */
function annularSector(r1: number, r2: number, a1: number, a2: number) {
  const [p1, p2, p3, p4] = [polar(r2, a1), polar(r2, a2), polar(r1, a2), polar(r1, a1)];
  return `M ${p1.x} ${p1.y} A ${r2} ${r2} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${r1} ${r1} 0 0 0 ${p4.x} ${p4.y} Z`;
}

/** 正 n 角形（星座紋章の幾何学ライン用） */
function polygon(n: number, r: number, offset = -90) {
  return Array.from({ length: n }, (_, i) => {
    const p = polar(r, offset + (i * 360) / n);
    return `${p.x},${p.y}`;
  }).join(" ");
}

/** 背景に散らばる淡い星。多いと夜の星や空きの印と紛れるので、まばらに */
const DUST = Array.from({ length: 28 }, (_, i) => {
  const angle = rand(i + 300) * Math.PI * 2;
  const r = Math.sqrt(rand(i + 400)) * 84;
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r, r: 0.2 + rand(i + 500) * 0.35, o: 0.1 + rand(i + 600) * 0.3 };
});

/** 線が星から星へ伸びる間隔（秒） */
const TRACE_START = 0.6;
const TRACE_STEP = 0.24;
const TRACE_DURATION = 0.45;

function dominantAttribute(n: ObservedNight): Attribute {
  const totals = new Map<string, number>();
  n.sessions.forEach((s) => totals.set(s.subjectId, (totals.get(s.subjectId) ?? 0) + s.minutes));
  const [top] = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  return SUBJECT_ATTRIBUTE[top?.[0] ?? "s2"] ?? "cyan";
}

/** 詠唱時間の強さ（0〜1） */
const intensity = (minutes: number) => Math.min(minutes, 240) / 240;

/** 詠唱時間が長い夜ほど四芒星が大きくなる（中心から尖端までの長さ） */
function starSize(minutes: number) {
  return 1.5 + Math.sqrt(intensity(minutes)) * 1.9;
}

/** 中心のゴールド/アクアの発光。詠唱時間が長いほど強く滲む */
function starGlow(minutes: number, selected: boolean) {
  const k = intensity(minutes);
  const near = 0.6 + k * 1.6 + (selected ? 1 : 0);
  const far = 2 + k * 6 + (selected ? 3 : 0);
  const alpha = Math.round((0.3 + k * 0.6) * 255)
    .toString(16)
    .padStart(2, "0");
  return `drop-shadow(0 0 ${near}px ${AQUA}) drop-shadow(0 0 ${far}px ${GOLD}${alpha})`;
}

/** 尖端までの長さ 1 の四芒星 ✦ */
const SPARKLE = "M0,-1 Q0.1,-0.1 1,0 Q0.1,0.1 0,1 Q-0.1,0.1 -1,0 Q-0.1,-0.1 0,-1Z";

/** 中心から細く伸びて消えていく光芒 */
function flare(length: number, width: number) {
  return `${-length},0 0,${-width} ${length},0 0,${width}`;
}

/** 半対角線 r の菱形 ◇ */
function diamond(x: number, y: number, r: number) {
  return `${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`;
}

export function StarMemoryView() {
  const stored = useStoredUserData();
  // 表示する月（null は今月）。今の日時はプリレンダーでは読めないので、保存データを読み込んでから決める
  const [picked, setMonth] = useState<Date | null>(null);
  const history = stored?.chantHistory;
  const nights = useMemo(() => (history ? observedNightsFrom(history, picked ?? startOfJstMonth()) : []), [history, picked]);
  if (!stored || !history) return <PageLoading />;

  const thisMonth = startOfJstMonth();
  const month = picked ?? thisMonth;
  const first = firstChantMonth(history);
  return (
    <StarMemory
      key={month.getTime()}
      month={month}
      nights={nights}
      allMinutes={totalChantMinutes(stored)}
      subjects={withCustomNames(demoSubjects, stored.userProfile.customSubjectNames)}
      onPrev={month > first ? () => setMonth(addMonths(month, -1)) : undefined}
      onNext={month < thisMonth ? () => setMonth(addMonths(month, 1)) : undefined}
    />
  );
}

/** 月を切り替える。前は詠唱履歴の最も古い月まで、先は今月まで */
function MonthSwitcher({ month, onPrev, onNext }: { month: Date; onPrev?: () => void; onNext?: () => void }) {
  const button =
    "grid size-8 place-items-center rounded-full text-starlight transition-colors hover:bg-white/[0.06] disabled:pointer-events-none disabled:opacity-25";
  return (
    <nav aria-label="表示する月" className="flex shrink-0 items-center gap-1 portrait:justify-center">
      <button type="button" onClick={onPrev} disabled={!onPrev} aria-label="前の月" className={button}>
        <ChevronLeft className="size-4" strokeWidth={1.25} />
      </button>
      <p className="min-w-[6.5em] text-center text-sm tracking-[0.2em] whitespace-nowrap" aria-live="polite">
        {monthLabel.format(month)}
      </p>
      <button type="button" onClick={onNext} disabled={!onNext} aria-label="次の月" className={button}>
        <ChevronRight className="size-4" strokeWidth={1.25} />
      </button>
    </nav>
  );
}

/** allMinutes は通算の詠唱時間（星図に描く月より前も含む） */
function StarMemory({
  month,
  nights,
  allMinutes,
  subjects,
  onPrev,
  onNext,
}: {
  month: Date;
  nights: ObservedNight[];
  allMinutes: number;
  /** カスタム科目は設定で付けた名前で表す */
  subjects: Subject[];
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const sizes = weekSizes(month);
  const observed = nights.filter((n) => n.minutes > 0);
  const [selected, setSelected] = useState<ObservedNight>(observed.at(-1) ?? nights.find((n) => n.today) ?? nights[0]);

  const completed = sizes.map((size, w) => nights.filter((n) => n.week === w && n.minutes > 0).length === size);
  const totalMinutes = observed.reduce((acc, n) => acc + n.minutes, 0);

  return (
    <div className="flex h-full flex-col gap-3 short:gap-2 p-3 animate-in fade-in duration-700 portrait:scroll-area portrait:scrollbar-none portrait:px-4 portrait:pb-8 lg:gap-4 lg:p-5">
      <header className="flex items-end justify-between gap-4 portrait:flex-col portrait:items-stretch">
        <div className="flex min-w-0 items-center gap-4">
          <BackToLibrary />
          <div className="min-w-0">
            <h1 className="flex flex-col text-xl leading-tight tracking-[0.25em] whitespace-nowrap short:text-base">
              魔導の軌跡
              <span className="font-display text-[9px] tracking-[0.3em] text-starlight/70">ARCANE TRACES</span>
            </h1>
            <p className="text-xs tracking-wider text-muted-foreground [word-break:auto-phrase] short:hidden">詠唱した夜は星となり、ひと月の学びが夜空に自分だけの星座を描きます</p>
          </div>
        </div>
        <div className="flex items-end gap-6 portrait:flex-col portrait:items-stretch portrait:gap-3">
          <MonthSwitcher month={month} onPrev={onPrev} onNext={onNext} />
          {/* 縦持ちでは4つが横に収まらないので、2つずつ2段に並べる */}
          <dl className="flex shrink-0 gap-4 text-right portrait:grid portrait:grid-cols-2 portrait:gap-x-6 portrait:gap-y-2 portrait:text-left text-[11px] tracking-wider whitespace-nowrap text-muted-foreground">
            {[
              { label: "詠唱した夜", value: `${observed.length}` },
              { label: "この月の詠唱", value: formatMinutes(totalMinutes) },
              { label: "完成した星座", value: `${completed.filter(Boolean).length}` },
              { label: "通算の詠唱", value: formatMinutes(allMinutes) },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd className="font-display text-lg leading-tight text-starlight-gradient">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {/* 星図盤と詳細パネルを黄金比（1.618 : 1）で分け、パネルは星図盤の中心の高さに揃える */}
      <div className="grid min-h-0 flex-1 grid-cols-[1.618fr_1fr] gap-4 portrait:flex-none portrait:grid-cols-1 lg:gap-8">
        <section className="relative flex min-h-80 short:min-h-0 items-center justify-center [container-type:size] portrait:aspect-square portrait:min-h-0">
          <div
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 size-[min(100cqw,100cqh)] -translate-1/2 rounded-full"
            style={{ background: "radial-gradient(closest-side, rgba(226,201,116,0.08), rgba(127,232,220,0.03) 70%, transparent)" }}
          />
          <CelestialChart sizes={sizes} nights={nights} completed={completed} selected={selected} onSelect={setSelected} />
        </section>

        <aside className="flex min-h-0 scroll-area scrollbar-none flex-col">
          <div className="my-auto flex flex-col gap-3">
            <NightDetail night={selected} subjects={subjects} />
            <ConstellationList month={month} sizes={sizes} nights={nights} completed={completed} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function CelestialChart({
  sizes,
  nights,
  completed,
  selected,
  onSelect,
}: {
  sizes: number[];
  nights: ObservedNight[];
  completed: boolean[];
  selected: ObservedNight;
  onSelect: (n: ObservedNight) => void;
}) {
  const gradientId = useId().replace(/:/g, "");
  const layout = chartLayout(sizes);
  const observed = nights.filter((n) => n.minutes > 0);
  // 詠唱した夜は日付順に灯る。前夜から線が伸びてくる星は、線が届いた瞬間に灯る
  const order = new Map(observed.map((n, i) => [n, i]));
  const litAt = (i: number) => TRACE_START + i * TRACE_STEP;
  // 同じ週の中で前夜と今夜をともに詠唱できた場合だけ結ぶ。未詠唱の夜で軌跡は途切れる
  const segments = nights.flatMap((n, j) => {
    const prev = nights[j - 1];
    return j > 0 && prev.week === n.week && prev.minutes > 0 && n.minutes > 0 ? [{ from: prev, to: n }] : [];
  });

  return (
    <svg viewBox="-100 -100 200 200" className="size-[min(100cqw,100cqh)] overflow-visible" role="img" aria-label="詠唱の天球図盤">
      <defs>
        {/* 星は原点・尖端までの長さ 1 で描くので、グラデーションもその座標で定義する */}
        {Object.entries(ATTRIBUTES).map(([key, { stops }]) => (
          <radialGradient key={key} id={`${gradientId}-${key}`} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="22%" stopColor={stops[0]} />
            <stop offset="55%" stopColor={stops[1]} />
            <stop offset="100%" stopColor={stops[2]} />
          </radialGradient>
        ))}
        <radialGradient id={`${gradientId}-flare`} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="4">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="25%" stopColor={GOLD} stopOpacity="0.6" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 天球図盤の縁: 二重リングと分度目盛り（ゆっくり回る） */}
      <g className="animate-spin-slower" style={{ transformBox: "view-box", transformOrigin: "0 0" }}>
        <circle r="98" stroke={GOLD} strokeOpacity="0.42" {...hairline} />
        <circle r="95.5" stroke={GOLD} strokeOpacity="0.3" {...hairline} />
        {Array.from({ length: 360 }, (_, i) => (
          <line
            key={i}
            y1="-95.5"
            y2={i % 10 === 0 ? -91.5 : i % 5 === 0 ? -93 : -94.3}
            stroke={GOLD}
            strokeOpacity={i % 10 === 0 ? 0.55 : i % 5 === 0 ? 0.32 : 0.16}
            transform={`rotate(${i})`}
            {...hairline}
          />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <text
            key={i}
            y="-88.6"
            textAnchor="middle"
            dominantBaseline="central"
            className="font-display"
            fontSize="2.6"
            fill={GOLD}
            fillOpacity="0.5"
            transform={`rotate(${i * 30})`}
          >
            {i * 30}
          </text>
        ))}
        <circle r="86" stroke={GOLD} strokeOpacity="0.2" {...hairline} />
      </g>

      {/* 星座の境: 基点と区切りの子午線 */}
      <g stroke={GOLD}>
        {layout.weeks.map(({ end: deg }) => {
          const tip = polar(86, deg);
          const inner = polar(32, deg);
          const outer = polar(80, deg);
          return (
            <g key={deg}>
              <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} strokeOpacity="0.12" strokeDasharray="0.6 1.8" {...hairline} />
              <polygon points={diamond(tip.x, tip.y, 1.6)} strokeOpacity="0.5" {...hairline} />
            </g>
          );
        })}
      </g>

      {/* 星が乗る同心円の軌道 */}
      <g stroke="#cfe9ff">
        {ORBITS.map((r) => (
          <circle
            key={r}
            r={r}
            strokeOpacity={r === ORBIT_MID ? 0.1 : 0.07}
            strokeDasharray={r === ORBIT_MID ? undefined : "1 2.5"}
            {...hairline}
          />
        ))}
      </g>
      <g className="glimmer-slow">
        <ellipse rx="82" ry="30" stroke="#71e2ef" strokeOpacity="0.1" transform="rotate(-18)" {...hairline} />
        <ellipse rx="82" ry="26" stroke="#a882fb" strokeOpacity="0.1" transform="rotate(32)" {...hairline} />
      </g>

      {/* 中心の魔導陣: ルーン環と七芒星（縁と逆向きにゆっくり回る） */}
      <g className="animate-spin-slow" style={{ transformBox: "view-box", transformOrigin: "0 0", animationDirection: "reverse" }}>
        <path id={`${gradientId}-runes`} d="M 0,-25 a 25,25 0 1,1 -0.01,0" fill="none" />
        <circle r="30" stroke={GOLD} strokeOpacity="0.18" {...hairline} />
        <circle r="28" stroke={GOLD} strokeOpacity="0.1" {...hairline} />
        <text fill={GOLD} fillOpacity="0.3" fontSize="2.4">
          <textPath href={`#${gradientId}-runes`} textLength={2 * Math.PI * 25 - 2} lengthAdjust="spacing">
            {RUNES}
          </textPath>
        </text>
        <circle r="22" stroke={GOLD} strokeOpacity="0.12" {...hairline} />
        <polygon points={heptagram(20)} stroke={GOLD} strokeOpacity="0.14" {...hairline} />
        <circle r="6" stroke="#cfe9ff" strokeOpacity="0.2" {...hairline} />
      </g>
      {DUST.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#f4f1e6" opacity={d.o} />
      ))}

      {/* 夜が揃った星座: その区画に天体紋章が浮かび上がる。月末の数夜の星座は区画が狭いので、紋章も小さく */}
      {layout.weeks.map((c, w) => {
        if (!completed[w]) return null;
        const points = Array.from({ length: c.size }, (_, d) => starPosition(layout, w, d));
        const lastIndex = order.get(nights[w * 7 + c.size - 1]) ?? 0;
        const half = c.span / 2 + 6;
        const scale = c.size === 7 ? 1 : 0.45;
        return (
          <g key={w} className="memory-silhouette" style={{ "--delay": `${litAt(lastIndex) + 0.3}s` } as CSSProperties}>
            <path d={annularSector(33, 79, c.angle - half, c.angle + half)} stroke={GOLD} strokeOpacity="0.22" {...hairline} fill={GOLD} fillOpacity="0.03" />
            {ORBITS.map((r) => {
              const a = polar(r, c.angle - half);
              const b = polar(r, c.angle + half);
              return <path key={r} d={`M ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y}`} stroke={AQUA} strokeOpacity="0.2" {...hairline} />;
            })}
            <g transform={`translate(${c.x} ${c.y}) scale(${scale})`}>
              <g className="animate-spin-slower" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
                <circle r="27.5" stroke={AQUA} strokeOpacity="0.22" strokeDasharray="0.6 1.6" {...hairline} />
                <circle r="25" stroke={GOLD} strokeOpacity="0.34" {...hairline} />
                {Array.from({ length: 28 }, (_, i) => (
                  <line
                    key={i}
                    y1="-25"
                    y2={i % 4 === 0 ? -22.6 : -23.8}
                    stroke={GOLD}
                    strokeOpacity="0.3"
                    transform={`rotate(${(i * 360) / 28})`}
                    {...hairline}
                  />
                ))}
                <polygon points={heptagram(22)} stroke={GOLD} strokeOpacity="0.2" {...hairline} />
                <circle r="15" stroke={AQUA} strokeOpacity="0.2" {...hairline} />
                <polygon points={polygon(4, 15)} stroke={AQUA} strokeOpacity="0.2" {...hairline} />
                <polygon points={polygon(4, 15, -45)} stroke={AQUA} strokeOpacity="0.2" {...hairline} />
                <circle r="9" stroke={GOLD} strokeOpacity="0.26" {...hairline} />
                <polygon points={diamond(0, 0, 2.4)} stroke={GOLD} strokeOpacity="0.4" {...hairline} fill={GOLD} fillOpacity="0.08" />
              </g>
            </g>
            {points.map((p, d) => (
              <polygon key={d} points={diamond(p.x, p.y, 2.2)} stroke={GOLD} strokeOpacity="0.22" {...hairline} />
            ))}
          </g>
        );
      })}

      {/* 星座の銘 */}
      {layout.weeks.map((c, w) => {
        const p = polar(81, c.angle);
        return (
          <text
            key={w}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="font-display"
            fontSize="3.4"
            letterSpacing="0.8"
            fill={completed[w] ? GOLD : DIM}
            fillOpacity={completed[w] ? 0.85 : 0.6}
          >
            WEEK {ROMAN[w]}
          </text>
        );
      })}

      {/* 週の中を日付順に一本道で結ぶ 1px の魔力の軌跡。前夜の星から円弧を描いて伸びる */}
      {segments.map(({ from: a, to: b }) => {
        const d = tracePath(layout, a, b);
        const maskId = `${gradientId}-trace-${b.date.getTime()}`;
        return (
          <g key={b.date.getTime()}>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="-100" y="-100" width="200" height="200">
              <path
                d={d}
                pathLength={1}
                stroke="#fff"
                strokeWidth={4}
                fill="none"
                className="memory-trace"
                style={
                  {
                    "--delay": `${litAt(order.get(b) ?? 0) - TRACE_DURATION}s`,
                    "--dur": `${TRACE_DURATION}s`,
                  } as CSSProperties
                }
              />
            </mask>
            <path d={d} mask={`url(#${maskId})`} stroke="#cfe9ff" strokeOpacity="0.6" {...hairline} />
          </g>
        );
      })}

      {/* 詠唱の星 */}
      {nights.map((n) => {
        const p = starPosition(layout, n.week, n.nightIndex);
        const isSelected = n === selected;
        const select = () => onSelect(n);
        const label = `${dateLabel.format(n.date)} ${n.minutes > 0 ? formatMinutes(n.minutes) : n.future || n.today ? "未詠唱" : "休息"}`;

        if (n.minutes === 0) {
          return (
            <g
              key={n.date.getTime()}
              tabIndex={n.future ? undefined : 0}
              role={n.future ? undefined : "button"}
              aria-label={n.future ? undefined : label}
              onPointerEnter={n.future ? undefined : select}
              onClick={n.future ? undefined : select}
              onFocus={n.future ? undefined : select}
              className={cn("outline-none", !n.future && "cursor-pointer")}
            >
              <circle cx={p.x} cy={p.y} r="4" fill="transparent" />
              {n.future ? (
                // まだ訪れていない夜: 星が灯るのを待つ座。淡い金の破線がゆっくり呼吸する
                <g className="memory-socket">
                  <circle cx={p.x} cy={p.y} r="2.2" stroke={GOLD} strokeOpacity="0.3" strokeDasharray="0.8 1.6" {...hairline} />
                  <polygon points={diamond(p.x, p.y, 1.1)} stroke={GOLD} strokeOpacity="0.55" {...hairline} />
                </g>
              ) : (
                // 休息の夜: 灯らなかった星の跡。冷えた灰の細い輪郭だけを残し、灯った星の邪魔をしない
                <polygon points={diamond(p.x, p.y, 1)} stroke={DIM} strokeOpacity="0.7" {...hairline} />
              )}
              {isSelected && <polygon points={diamond(p.x, p.y, 3.4)} stroke={DIM} strokeOpacity="0.8" {...hairline} />}
            </g>
          );
        }

        const size = starSize(n.minutes);
        const k = intensity(n.minutes);
        const fill = `url(#${gradientId}-${dominantAttribute(n)})`;
        return (
          <g
            key={n.date.getTime()}
            tabIndex={0}
            role="button"
            aria-label={label}
            aria-pressed={isSelected}
            onPointerEnter={select}
            onClick={select}
            onFocus={select}
            className="memory-star cursor-pointer outline-none"
            style={{ "--delay": `${litAt(order.get(n) ?? 0)}s` } as CSSProperties}
          >
            <circle cx={p.x} cy={p.y} r={Math.max(size + 2.5, 5)} fill="transparent" />
            {isSelected && (
              <>
                <polygon points={diamond(p.x, p.y, size + 3.6)} stroke={GOLD} className="guidance-halo" {...hairline} />
                <polygon points={diamond(p.x, p.y, size + 2.2)} stroke={GOLD} strokeOpacity="0.6" {...hairline} />
              </>
            )}
            <g
              className="memory-star-core"
              style={{ transform: isSelected ? "scale(1.25)" : undefined, filter: starGlow(n.minutes, isSelected) }}
            >
              <g transform={`translate(${p.x} ${p.y}) scale(${size})`}>
                {/* 上下左右へ伸びる十字の光芒と、斜めの淡い光芒 */}
                <g fill={`url(#${gradientId}-flare)`}>
                  <polygon points={flare(2.6 + k * 1.4, 0.05)} />
                  <polygon points={flare(2.6 + k * 1.4, 0.05)} transform="rotate(90)" />
                  <polygon points={flare(1.1, 0.04)} transform="rotate(45)" opacity="0.5" />
                  <polygon points={flare(1.1, 0.04)} transform="rotate(-45)" opacity="0.5" />
                </g>
                <path d={SPARKLE} fill={fill} />
                <path d={SPARKLE} transform="rotate(45) scale(0.5)" fill={fill} opacity="0.7" />
                <path d={SPARKLE} transform="scale(0.32)" fill="#ffffff" opacity={0.7 + k * 0.3} />
              </g>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

function NightDetail({ night, subjects }: { night: ObservedNight; subjects: Subject[] }) {
  const totals = new Map<string, number>();
  night.sessions.forEach((s) => totals.set(s.subjectId, (totals.get(s.subjectId) ?? 0) + s.minutes));
  const breakdown = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const attribute = night.minutes > 0 ? ATTRIBUTES[dominantAttribute(night)] : null;

  return (
    <article key={night.date.getTime()} className="glass flex flex-col gap-3 rounded-2xl p-4 animate-in fade-in duration-500">
      <header className="flex flex-wrap items-baseline justify-between gap-x-2">
        <h2 className="text-base tracking-[0.2em] whitespace-nowrap">{dateLabel.format(night.date)}</h2>
        <span className="font-display text-[10px] tracking-[0.25em] whitespace-nowrap text-starlight/70">
          WEEK {ROMAN[night.week]} · NIGHT {night.nightIndex + 1}
        </span>
      </header>

      {night.minutes === 0 ? (
        <p className="flex items-center gap-2 text-xs tracking-wider text-muted-foreground">
          <Moon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.25} />
          {night.future ? "まだ訪れていない夜です" : night.today ? "今宵はまだ詠唱していません。詠唱すると、この夜に星が灯ります" : "休息の夜。この日に星は灯っていません"}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] tracking-[0.3em] text-muted-foreground">詠唱時間</p>
              <p className="text-sm tracking-wider whitespace-nowrap">{formatMinutes(night.minutes)}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] tracking-[0.3em] text-muted-foreground">獲得魔力</p>
              <p className="font-display whitespace-nowrap text-aqua text-glow-aqua">
                +{night.mp} <span className="text-[10px]">MP</span>
              </p>
            </div>
          </div>
          {night.catalyst && (
            <p className="-mt-1 text-[11px] tracking-wider text-starlight/80">
              {night.catalyst.name}の力で魔力 ×{night.catalyst.multiplier}
            </p>
          )}

          <section>
            <h3 className="mb-1.5 flex items-center gap-2 text-xs tracking-[0.2em] whitespace-nowrap text-muted-foreground">
              詠唱した属性
              {attribute && (
                <span className="ml-auto flex items-center gap-1.5 text-foreground">
                  <span
                    className="size-1.5 rotate-45"
                    style={{ background: `radial-gradient(circle, ${attribute.stops.join(", ")})`, boxShadow: `0 0 6px ${attribute.stops[2]}` }}
                  />
                  {attribute.label}の星
                </span>
              )}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {breakdown.map(([id, minutes]) => {
                const subject = subjects.find((s) => s.id === id);
                return (
                  <li key={id} className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 tracking-wider">{subject?.name ?? "—"}</span>
                    <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${(minutes / night.minutes) * 100}%`,
                          background: subject?.color,
                          boxShadow: `0 0 6px ${subject?.color}`,
                        }}
                      />
                    </span>
                    <span className="w-16 shrink-0 text-right whitespace-nowrap text-muted-foreground">{formatMinutes(minutes)}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h3 className="mb-1.5 text-xs tracking-[0.2em] whitespace-nowrap text-muted-foreground">流れ星が遺した品</h3>
            {night.drops.length === 0 ? (
              <p className="text-[11px] tracking-wider text-muted-foreground/70">この夜、流れ星は降りませんでした</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {night.drops.map((item, i) => (
                  <li key={`${item.id}-${i}`} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-1">
                    <ItemArt icon={item.svgIcon} rarity={item.rarity} color={item.color} seed={item.id} className="size-9 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs tracking-wider">{item.name}</p>
                      <p className="text-[10px] tracking-wider text-muted-foreground">
                        <span className="font-display text-starlight/80">RARE {item.rarity}</span> {item.type}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </article>
  );
}

function ConstellationList({
  month,
  sizes,
  nights,
  completed,
}: {
  month: Date;
  sizes: number[];
  nights: ObservedNight[];
  completed: boolean[];
}) {
  return (
    <section className="glass rounded-2xl p-4">
      <div className="mb-2 flex items-end justify-between gap-2">
        <h2 className="flex flex-col text-sm leading-tight tracking-[0.2em] whitespace-nowrap">
          描かれた星座
          <span className="font-display text-[9px] tracking-[0.25em] text-starlight/60">CONSTELLATIONS</span>
        </h2>
        <p className="text-[10px] tracking-wider whitespace-nowrap text-muted-foreground">7夜で1つの星座・月末は数夜の星座</p>
      </div>
      <ul className="flex flex-col text-xs">
        {sizes.map((size, w) => {
          const name = constellationName(month, w);
          const lit = nights.filter((n) => n.week === w && n.minutes > 0).length;
          // まだ来ていない夜か今日が残っていれば、途切れたとは言わない
          const inProgress = nights.some((n) => n.week === w && (n.future || n.today));
          return (
            <li key={name} className="flex items-center gap-2 border-b border-white/[0.06] py-1.5 last:border-0">
              {completed[w] ? (
                <Sparkles className="size-3.5 shrink-0 text-starlight" strokeWidth={1.25} />
              ) : (
                <Star className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.25} />
              )}
              <span className="font-display text-[10px] text-muted-foreground">{ROMAN[w]}</span>
              <span className={cn("min-w-0 tracking-wider", completed[w] ? "text-starlight" : "text-muted-foreground")}>
                {completed[w] ? name : inProgress ? "紡がれている星座" : "途切れた星座"}
              </span>
              <span className="ml-auto font-display whitespace-nowrap text-muted-foreground">
                {lit} / {size}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
