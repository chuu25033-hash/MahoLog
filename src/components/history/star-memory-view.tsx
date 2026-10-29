"use client";

import { useId, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Moon, Sparkles, Star } from "lucide-react";
import { ItemArt } from "@/components/item-art";
import { PageLoading } from "@/components/page-loading";
import { demoSubjects } from "@/lib/demo";
import { formatMinutes } from "@/lib/game";
import { RARITY_LABEL } from "@/lib/items";
import { MEMORY_WEEKS, mockObservedNights, type ObservedNight } from "@/lib/star-memory";
import { cn } from "@/lib/utils";

/** 拡大縮小しても 1px を保つ光の線 */
const hairline = { vectorEffect: "non-scaling-stroke", fill: "none", strokeWidth: 1 } as const;

const GOLD = "#e2c974";
const AQUA = "#7fe8dc";
const DIM = "#64748b";
const ROMAN = ["I", "II", "III", "IV"];

/** 週ごとに浮かび上がる星座 */
const CONSTELLATIONS = ["暁の竪琴座", "蒼銀の白鳥座", "紫晶の天秤座", "星冠座"];

type Attribute = "cyan" | "aqua" | "purple";

/** 属性ごとの星のグラデーション（芯 → 中間 → 縁） */
const ATTRIBUTES: Record<Attribute, { label: string; stops: [string, string, string] }> = {
  cyan: { label: "蒼晶", stops: ["#f2fdff", "#a8f1ff", "#4fc9ec"] },
  aqua: { label: "水鏡", stops: ["#f1fffb", "#b8f5e4", "#5fdcc6"] },
  purple: { label: "紫晶", stops: ["#faf5ff", "#d9c8ff", "#a882fb"] },
};

const SUBJECT_ATTRIBUTE: Record<string, Attribute> = { s1: "purple", s2: "cyan", s3: "aqua", s4: "aqua", s5: "purple" };

const subjectOf = (id: string) => demoSubjects.find((s) => s.id === id);

const dateLabel = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" });

// 決定的な疑似乱数
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/** 星座の中心: 左上から時計回りに週を並べる */
const WEEK_CENTERS = Array.from({ length: MEMORY_WEEKS }, (_, w) => {
  const angle = ((-135 + w * 90) * Math.PI) / 180;
  return { x: Math.cos(angle) * 46, y: Math.sin(angle) * 46, angle };
});

function starPosition(week: number, weekday: number) {
  const center = WEEK_CENTERS[week];
  const angle = ((-90 + weekday * (360 / 7) + week * 13) * Math.PI) / 180;
  const r = 21 + (rand(week * 7 + weekday) - 0.5) * 7;
  return { x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r };
}

/** 背景に散らばる淡い星 */
const DUST = Array.from({ length: 70 }, (_, i) => {
  const angle = rand(i + 300) * Math.PI * 2;
  const r = Math.sqrt(rand(i + 400)) * 88;
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r, r: 0.25 + rand(i + 500) * 0.45, o: 0.15 + rand(i + 600) * 0.4 };
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

// 日付が変わるまでは同じ履歴を使い回す（getSnapshot は同じ参照を返す必要がある）
let cache: { key: string; nights: ObservedNight[] } | null = null;
function snapshot() {
  const key = new Date().toDateString();
  if (cache?.key !== key) cache = { key, nights: mockObservedNights() };
  return cache.nights;
}
const noopSubscribe = () => () => {};

export function StarMemoryView() {
  const nights = useSyncExternalStore(noopSubscribe, snapshot, () => null);
  if (!nights) return <PageLoading />;
  return <StarMemory nights={nights} />;
}

function StarMemory({ nights }: { nights: ObservedNight[] }) {
  const observed = nights.filter((n) => n.minutes > 0);
  const [selected, setSelected] = useState<ObservedNight>(observed.at(-1) ?? nights[0]);

  const completed = Array.from({ length: MEMORY_WEEKS }, (_, w) => nights.filter((n) => n.week === w && n.minutes > 0).length === 7);
  const totalMinutes = observed.reduce((acc, n) => acc + n.minutes, 0);

  return (
    <div className="flex h-full flex-col gap-3 p-3 animate-in fade-in duration-700 lg:gap-4 lg:p-5">
      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-baseline gap-2 text-xl tracking-[0.25em] whitespace-nowrap">
            星図の記憶
            <span className="truncate font-display text-[10px] tracking-[0.3em] text-starlight/70">CELESTIAL ASTROLOGY</span>
          </h1>
          <p className="text-xs tracking-wider text-muted-foreground">詠唱した夜は星となり、日々の学びが夜空に自分だけの星座を描きます</p>
        </div>
        <dl className="flex shrink-0 gap-4 text-right text-[11px] tracking-wider whitespace-nowrap text-muted-foreground">
          {[
            { label: "観測した夜", value: `${observed.length}` },
            { label: "総詠唱", value: formatMinutes(totalMinutes) },
            { label: "完成した星座", value: `${completed.filter(Boolean).length}` },
          ].map(({ label, value }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className="font-display text-lg leading-tight text-starlight-gradient">{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-3 lg:gap-4">
        <section className="glass relative col-span-8 flex min-h-80 items-center justify-center overflow-hidden rounded-2xl [container-type:size]">
          <CelestialChart nights={nights} completed={completed} selected={selected} onSelect={setSelected} />
        </section>

        <aside className="col-span-4 flex min-h-0 flex-col gap-3 overflow-y-auto">
          <NightDetail night={selected} />
          <ConstellationList nights={nights} completed={completed} />
        </aside>
      </div>
    </div>
  );
}

function CelestialChart({
  nights,
  completed,
  selected,
  onSelect,
}: {
  nights: ObservedNight[];
  completed: boolean[];
  selected: ObservedNight;
  onSelect: (n: ObservedNight) => void;
}) {
  const gradientId = useId().replace(/:/g, "");
  const observed = nights.filter((n) => n.minutes > 0);
  // 観測した夜は日付順に灯る。前夜から線が伸びてくる星は、線が届いた瞬間に灯る
  const order = new Map(observed.map((n, i) => [n, i]));
  const litAt = (i: number) => TRACE_START + i * TRACE_STEP;
  // 同じ週の中で前夜と今夜をともに観測できた場合だけ結ぶ。休息の夜で線は途切れる
  const segments = nights.flatMap((n, j) => {
    const prev = nights[j - 1];
    return j > 0 && prev.week === n.week && prev.minutes > 0 && n.minutes > 0 ? [{ from: prev, to: n }] : [];
  });

  return (
    <svg viewBox="-100 -100 200 200" className="size-[min(96cqw,96cqh)] overflow-visible" role="img" aria-label="詠唱の星図">
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

      {/* ゆっくり回る外周の目盛り */}
      <g className="animate-spin-slower" style={{ transformBox: "view-box", transformOrigin: "0 0" }}>
        <circle r="97" stroke={GOLD} strokeOpacity="0.3" {...hairline} />
        <circle r="93" stroke={GOLD} strokeOpacity="0.18" strokeDasharray="0.6 2.4" {...hairline} />
        {Array.from({ length: 72 }, (_, i) => (
          <line
            key={i}
            y1="-93"
            y2={i % 6 === 0 ? -97 : -95}
            stroke={GOLD}
            strokeOpacity={i % 6 === 0 ? 0.5 : 0.22}
            transform={`rotate(${i * 5})`}
            {...hairline}
          />
        ))}
      </g>

      {/* 天球の骨格 */}
      <g stroke="#cfe9ff">
        <circle r="86" strokeOpacity="0.14" {...hairline} />
        <circle r="66" strokeOpacity="0.07" strokeDasharray="1 3" {...hairline} />
        <circle r="26" strokeOpacity="0.08" {...hairline} />
        <circle r="6" strokeOpacity="0.16" {...hairline} />
        {[0, 45, 90, 135].map((deg) => (
          <line key={deg} x1="-86" x2="86" strokeOpacity="0.05" transform={`rotate(${deg})`} {...hairline} />
        ))}
      </g>
      <g className="glimmer-slow">
        <ellipse rx="84" ry="30" stroke="#71e2ef" strokeOpacity="0.12" transform="rotate(-18)" {...hairline} />
        <ellipse rx="84" ry="26" stroke="#a882fb" strokeOpacity="0.12" transform="rotate(32)" {...hairline} />
      </g>
      {DUST.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#f4f1e6" opacity={d.o} />
      ))}

      {/* 7夜が揃った週: 星座のシルエットが浮かび上がる */}
      {WEEK_CENTERS.map((c, w) => {
        if (!completed[w]) return null;
        const points = Array.from({ length: 7 }, (_, d) => starPosition(w, d));
        const lastIndex = order.get(nights[w * 7 + 6]) ?? 0;
        return (
          <g key={w} className="memory-silhouette" style={{ "--delay": `${litAt(lastIndex) + 0.3}s` } as CSSProperties}>
            <circle cx={c.x} cy={c.y} r="30" stroke={GOLD} strokeOpacity="0.28" {...hairline} fill={GOLD} fillOpacity="0.03" />
            <circle cx={c.x} cy={c.y} r="33" stroke={GOLD} strokeOpacity="0.14" strokeDasharray="0.8 2.2" {...hairline} />
            {points.map((p, d) => (
              <polygon key={d} points={diamond(p.x, p.y, 2.2)} stroke={GOLD} strokeOpacity="0.22" {...hairline} />
            ))}
          </g>
        );
      })}

      {/* 週の銘 */}
      {WEEK_CENTERS.map((c, w) => (
        <text
          key={w}
          x={Math.cos(c.angle) * 80}
          y={Math.sin(c.angle) * 80}
          textAnchor="middle"
          dominantBaseline="central"
          className="font-display"
          fontSize="3.6"
          letterSpacing="0.8"
          fill={completed[w] ? GOLD : DIM}
          fillOpacity={completed[w] ? 0.8 : 0.6}
        >
          WEEK {ROMAN[w]}
        </text>
      ))}

      {/* 週の中を日付順に一本道で結ぶ光の線 */}
      {segments.map(({ from: a, to: b }) => {
        const from = starPosition(a.week, a.weekday);
        const to = starPosition(b.week, b.weekday);
        return (
          <line
            key={b.date.getTime()}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            pathLength={1}
            stroke="#cfe9ff"
            strokeOpacity="0.6"
            className="memory-trace"
            style={{ "--delay": `${litAt(order.get(b) ?? 0) - TRACE_DURATION}s`, "--dur": `${TRACE_DURATION}s` } as CSSProperties}
            {...hairline}
          />
        );
      })}

      {/* 観測点 */}
      {nights.map((n) => {
        const p = starPosition(n.week, n.weekday);
        const isSelected = n === selected;
        const select = () => onSelect(n);
        const label = `${dateLabel.format(n.date)} ${n.minutes > 0 ? formatMinutes(n.minutes) : n.future ? "未観測" : "休息"}`;

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
                <polygon points={diamond(p.x, p.y, 1.3)} stroke={DIM} strokeOpacity="0.5" strokeDasharray="0.6 1.2" {...hairline} />
              ) : (
                <polygon points={diamond(p.x, p.y, 0.8)} fill={DIM} fillOpacity="0.5" />
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

function NightDetail({ night }: { night: ObservedNight }) {
  const totals = new Map<string, number>();
  night.sessions.forEach((s) => totals.set(s.subjectId, (totals.get(s.subjectId) ?? 0) + s.minutes));
  const breakdown = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const attribute = night.minutes > 0 ? ATTRIBUTES[dominantAttribute(night)] : null;

  return (
    <article key={night.date.getTime()} className="glass flex flex-col gap-3 rounded-2xl p-4 animate-in fade-in duration-500">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-base tracking-[0.2em] whitespace-nowrap">{dateLabel.format(night.date)}</h2>
        <span className="truncate font-display text-[10px] tracking-[0.25em] text-starlight/70">
          WEEK {ROMAN[night.week]} · NIGHT {night.weekday + 1}
        </span>
      </header>

      {night.minutes === 0 ? (
        <p className="flex items-center gap-2 text-xs tracking-wider text-muted-foreground">
          <Moon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.25} />
          {night.future ? "まだ訪れていない夜です" : "休息の夜。この日に星は灯っていません"}
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
            <p className="-mt-1 truncate text-[11px] tracking-wider text-starlight/80">
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
                const subject = subjectOf(id);
                return (
                  <li key={id} className="flex items-center gap-2 text-xs">
                    <span className="w-8 shrink-0 tracking-wider">{subject?.name ?? "—"}</span>
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
            <h3 className="mb-1.5 text-xs tracking-[0.2em] whitespace-nowrap text-muted-foreground">宝箱から見つかった品</h3>
            {night.drops.length === 0 ? (
              <p className="text-[11px] tracking-wider text-muted-foreground/70">この夜の宝箱は空でした</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {night.drops.map((item, i) => (
                  <li key={`${item.id}-${i}`} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-1">
                    <ItemArt glyph={item.glyph} rarity={item.rarity} color={item.color} seed={item.id} className="size-9 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate text-xs tracking-wider">{item.name}</p>
                      <p className="truncate text-[10px] tracking-wider text-muted-foreground">
                        <span className="font-display text-starlight/80">RARE {item.rarity}</span> {RARITY_LABEL[item.rarity]}
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

function ConstellationList({ nights, completed }: { nights: ObservedNight[]; completed: boolean[] }) {
  return (
    <section className="glass rounded-2xl p-4">
      <h2 className="mb-2 flex items-baseline gap-2 text-sm tracking-[0.2em] whitespace-nowrap">
        描かれた星座
        <span className="min-w-0 truncate font-display text-[9px] tracking-[0.25em] text-starlight/60">CONSTELLATIONS</span>
      </h2>
      <ul className="flex flex-col text-xs">
        {CONSTELLATIONS.slice(0, MEMORY_WEEKS).map((name, w) => {
          const lit = nights.filter((n) => n.week === w && n.minutes > 0).length;
          const inProgress = nights.some((n) => n.week === w && n.future);
          return (
            <li key={name} className="flex items-center gap-2 border-b border-white/[0.06] py-1.5 last:border-0">
              {completed[w] ? (
                <Sparkles className="size-3.5 shrink-0 text-starlight" strokeWidth={1.25} />
              ) : (
                <Star className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.25} />
              )}
              <span className="font-display text-[10px] text-muted-foreground">{ROMAN[w]}</span>
              <span className={cn("min-w-0 truncate tracking-wider", completed[w] ? "text-starlight" : "text-muted-foreground")}>
                {completed[w] ? name : inProgress ? "観測中の星座" : "途切れた星座"}
              </span>
              <span className="ml-auto font-display whitespace-nowrap text-muted-foreground">{lit} / 7</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
