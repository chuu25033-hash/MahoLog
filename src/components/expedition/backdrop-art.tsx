import type { ReactNode } from "react";
import type { ExpeditionArt, ExpeditionSource } from "@/lib/expedition";

/**
 * 探索の景色の層に描く影絵。どれも左右の端で途切れないよう、絵柄を枠の内側に収めてあり、
 * 横に並べると継ぎ目なく続く。影絵は currentColor（層の色）で塗り、灯や熾火だけ accent の色を差す。
 * 新しい絵は ART に足し、lib/expedition.ts の ExpeditionArt に名前を加える
 */
type Art = { width: number; height: number; render: (accent: string) => ReactNode };

/** 決定的な疑似乱数（SSR とクライアントで同じ絵にする） */
const rand = (i: number, salt = 0) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** 尖頭アーチの列柱。壁から窓を抜く（evenodd） */
const ARCH_BAYS = [15, 165];
const archesPath =
  "M0,0 H300 V200 H0 Z " + ARCH_BAYS.map((x) => `M${x},200 V95 Q${x},35 ${x + 60},22 Q${x + 120},35 ${x + 120},95 V200 Z`).join(" ");

const STARS = range(46).map((i) => ({ x: 4 + rand(i, 1) * 392, y: 4 + rand(i, 2) * 192, r: 0.4 + rand(i, 3) * 1.1 }));

/** 書架: 棚板の間に背の不ぞろいな本を詰める */
function shelfBooks(x0: number, x1: number, shelfY: number, seed: number) {
  const books: ReactNode[] = [];
  let x = x0 + 2;
  let i = 0;
  while (x < x1 - 4) {
    const w = 4 + Math.floor(rand(seed + i, 4) * 6);
    const h = 24 + Math.floor(rand(seed + i, 5) * 14);
    if (x + w > x1 - 2) break;
    // ところどころ隙間を空け、まれに傾いた本を置く
    if (rand(seed + i, 6) > 0.9) {
      x += 6;
    } else if (rand(seed + i, 7) > 0.93) {
      books.push(<rect key={`${seed}-${i}`} x={x} y={shelfY - h + 2} width={w} height={h} transform={`rotate(-14 ${x + w} ${shelfY})`} />);
      x += w + 6;
    } else {
      books.push(<rect key={`${seed}-${i}`} x={x} y={shelfY - h} width={w} height={h} />);
      x += w + 0.8;
    }
    i++;
  }
  return books;
}

function bookcase(x: number, key: number, accent: string) {
  const width = 160;
  const shelves = [64, 110, 156, 200];
  return (
    <g key={key}>
      {/* 背板は淡く、奥の空がわずかに透ける */}
      <rect x={x} y={22} width={width} height={178} opacity={0.4} />
      <rect x={x - 4} y={14} width={width + 8} height={9} />
      <rect x={x} y={20} width={6} height={180} />
      <rect x={x + width - 6} y={20} width={6} height={180} />
      {shelves.map((y, i) => (
        <g key={y}>
          <rect x={x} y={y} width={width} height={5} />
          {shelfBooks(x + 6, x + width - 6, y, key * 40 + i * 9)}
        </g>
      ))}
      {/* 書架の上に灯る、一本の蝋燭 */}
      <rect x={x + 120} y={6} width={3} height={8} />
      <ellipse cx={x + 121.5} cy={3.5} rx={1.6} ry={2.8} fill={accent} className="expedition-flame" />
    </g>
  );
}

const TREES = [
  { cx: 60, top: 58, r: 32 },
  { cx: 150, top: 92, r: 24 },
  { cx: 238, top: 36, r: 40 },
  { cx: 336, top: 78, r: 28 },
];

const TOWERS = [
  { x: 40, w: 24, top: 90 },
  { x: 108, w: 16, top: 128 },
  { x: 168, w: 34, top: 58 },
  { x: 258, w: 20, top: 110 },
  { x: 318, w: 28, top: 78 },
];

/** 氷の結晶の柱: [根元の中心, 高さ, 幅, 傾き] */
const SHARDS: [number, number, number, number][] = [
  [48, 110, 22, -6], [70, 160, 26, 4], [92, 90, 18, 10],
  [196, 70, 16, -8], [214, 130, 24, 0], [236, 84, 16, 9],
  [318, 120, 22, -5], [342, 176, 28, 3], [366, 96, 18, 8],
];

const shardPoints = ([cx, h, w, tilt]: (typeof SHARDS)[number]) =>
  `${cx - w / 2},200 ${cx - w / 2 + tilt * 0.6},${200 - h * 0.82} ${cx + tilt},${200 - h} ${cx + w / 2 + tilt * 0.6},${200 - h * 0.82} ${cx + w / 2},200`;

const ICICLES = (() => {
  let d = "M0,0 H300 V16 ";
  for (let x = 0; x < 300; x += 12) {
    const len = 10 + rand(x, 8) * (rand(x, 9) > 0.7 ? 70 : 34);
    d += `L${x + 5},${16 + len} L${x + 10},16 L${x + 12},${16 + rand(x, 10) * 4} `;
  }
  return d + "V0 Z";
})();

const CLOUD_PUFFS = range(12).map((i) => ({ cx: 22 + i * 40 + rand(i, 11) * 16, cy: 62 - rand(i, 12) * 24, r: 18 + rand(i, 13) * 18 }));

const GRASS = range(70).map((i) => {
  const x = 3 + i * 5.6 + rand(i, 14) * 2;
  const h = 3 + rand(i, 15) * 7;
  return `M${x - 1.6},11 L${x + rand(i, 16) * 2 - 1},${11 - h} L${x + 1.6},11 Z`;
}).join(" ");

export const ART: Record<ExpeditionArt, Art> = {
  stars: {
    width: 400,
    height: 200,
    render: () => STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={0.35 + rand(i, 17) * 0.65} />),
  },
  arches: {
    width: 300,
    height: 200,
    render: () => <path d={archesPath} fillRule="evenodd" />,
  },
  shelves: {
    width: 360,
    height: 200,
    render: (accent) => [bookcase(10, 0, accent), bookcase(190, 1, accent)],
  },
  trees: {
    width: 400,
    height: 200,
    render: () =>
      TREES.map(({ cx, top, r }, i) => (
        <g key={i}>
          <path d={`M${cx - 4},200 L${cx - 2.5},${top + r} L${cx + 2.5},${top + r} L${cx + 4},200 Z`} />
          <circle cx={cx} cy={top + r} r={r} />
          <circle cx={cx - r * 0.62} cy={top + r * 1.35} r={r * 0.72} />
          <circle cx={cx + r * 0.6} cy={top + r * 1.3} r={r * 0.68} />
          <ellipse cx={cx + (i % 2 ? 26 : -24)} cy={196} rx={18} ry={9} />
        </g>
      )),
  },
  spires: {
    width: 400,
    height: 200,
    render: (accent) => (
      <>
        <rect x={0} y={172} width={400} height={28} />
        {TOWERS.map(({ x, w, top }, i) => (
          <g key={i}>
            <path d={`M${x},200 V${top} H${x - 3} L${x + w / 2},${top - w * 1.5} L${x + w + 3},${top} H${x + w} V200 Z`} />
            {range(Math.floor((168 - top) / 26)).map((j) =>
              rand(i * 7 + j, 18) > 0.35 ? (
                <path
                  key={j}
                  d={`M${x + w / 2 - 2},${top + 22 + j * 26} v-5 a2,2 0 0,1 4,0 v5 z`}
                  fill={accent}
                  opacity={0.55 + rand(i + j, 19) * 0.4}
                />
              ) : null,
            )}
          </g>
        ))}
      </>
    ),
  },
  crystals: {
    width: 400,
    height: 200,
    render: (accent) =>
      SHARDS.map((s, i) => (
        <g key={i}>
          <polygon points={shardPoints(s)} />
          <path d={`M${s[0]},200 L${s[0] + s[3]},${200 - s[1]}`} stroke={accent} strokeWidth={0.8} opacity={0.35} fill="none" />
        </g>
      )),
  },
  icicles: {
    width: 300,
    height: 100,
    render: (accent) => (
      <>
        <path d={ICICLES} />
        <rect x={0} y={15} width={300} height={0.8} fill={accent} opacity={0.25} />
      </>
    ),
  },
  forge: {
    width: 400,
    height: 200,
    render: (accent) => (
      <>
        {/* 炉と煙突、炉の口に揺れる熾火 */}
        <path d="M30,200 V122 Q85,78 140,122 V200 Z M76,104 V22 H96 V96 Z M72,22 H100 V14 H72 Z" />
        <g opacity={0.4}>
          <path d="M62,200 V164 Q85,138 108,164 V200 Z" fill={accent} className="expedition-flame" />
        </g>
        <rect x={140} y={92} width={124} height={7} />
        <path d="M262,200 V44 H288 V200 Z M258,44 H292 V36 H258 Z M258,120 H292 V128 H258 Z" />
        {/* 金床 */}
        <path d="M184,200 L190,176 H176 C172,170 176,164 184,164 H222 C224,170 216,176 208,176 L214,200 Z" />
        {/* 大釜と、その上の照り返し */}
        <ellipse cx={346} cy={166} rx={30} ry={24} />
        <path d="M322,182 L316,200 H324 L330,186 Z M370,182 L376,200 H368 L362,186 Z" />
        <ellipse cx={346} cy={146} rx={24} ry={4} fill={accent} opacity={0.55} />
      </>
    ),
  },
  clouds: {
    width: 500,
    height: 100,
    render: () => (
      <>
        <rect x={0} y={64} width={500} height={36} />
        {CLOUD_PUFFS.map((c, i) => (
          <circle key={i} cx={c.cx} cy={c.cy + 18} r={c.r} />
        ))}
      </>
    ),
  },
  floor: {
    width: 400,
    height: 64,
    render: (accent) => (
      <>
        <rect x={0} y={4} width={400} height={60} />
        <rect x={0} y={4} width={400} height={0.8} fill={accent} opacity={0.35} />
        <path
          d="M0,26 H400 M0,46 H400 M60,4 V26 M180,4 V26 M300,4 V26 M120,26 V46 M240,26 V46 M360,26 V46 M30,46 V64 M150,46 V64 M270,46 V64 M390,46 V64"
          stroke={accent}
          strokeWidth={0.6}
          opacity={0.08}
          fill="none"
        />
      </>
    ),
  },
  grass: {
    width: 400,
    height: 64,
    render: (accent) => (
      <>
        <rect x={0} y={10} width={400} height={54} />
        <path d={GRASS} />
        {range(7).map((i) => (
          <circle key={i} cx={28 + i * 56 + rand(i, 20) * 20} cy={8 - rand(i, 21) * 3} r={0.9} fill={accent} opacity={0.7} />
        ))}
      </>
    ),
  },
};

/** 層の絵の幅 ÷ 高さ */
export function sourceAspect(source: ExpeditionSource) {
  if ("image" in source) return source.aspect;
  const art = ART[source.art];
  return art.width / art.height;
}

/** 層に並べる1枚分の絵。描く絵は SVG で、画像は <img> で読み込む */
export function BackdropTile({ source, accent }: { source: ExpeditionSource; accent: string }) {
  const aspectRatio = sourceAspect(source);
  if ("image" in source) {
    // 背景画像は飾り。読み込みの順は景色の見え方だけに関わるので、遅らせて構わない
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={source.image} alt="" loading="lazy" decoding="async" draggable={false} className="h-full w-auto max-w-none shrink-0 select-none" style={{ aspectRatio }} />;
  }
  const art = ART[source.art];
  return (
    <svg viewBox={`0 0 ${art.width} ${art.height}`} className="h-full w-auto shrink-0" style={{ aspectRatio }} fill="currentColor" aria-hidden>
      {art.render(accent)}
    </svg>
  );
}
