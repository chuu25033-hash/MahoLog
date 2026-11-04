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

/** 色ごとのグラデーションの id */
const gradId = (name: string, color: string) => `expedition-${name}-${color.replace(/[^0-9a-z]/gi, "")}`;

/**
 * 聖堂の壁: 柱の間に、灯のともる尖頭窓。窓は透かし彫り（中央の縦桟・小さな尖頭アーチ・円窓）と鉛の桟で区切り、
 * 光は上ほど強い。柱には柱頭と台座を付ける
 */
const CATHEDRAL_BAYS = [90, 270];
function cathedral(accent: string) {
  const id = gradId("window", accent);
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.62" />
          <stop offset="0.5" stopColor={accent} stopOpacity="0.26" />
          <stop offset="1" stopColor={accent} stopOpacity="0.05" />
        </linearGradient>
        <radialGradient id={`${id}-halo`} cx="0.5" cy="0.3" r="0.6">
          <stop offset="0" stopColor="#fff8e6" stopOpacity="0.28" />
          <stop offset="1" stopColor="#fff8e6" stopOpacity="0" />
        </radialGradient>
        {/* 古い硝子の菱形の鉛格子 */}
        <pattern id={`${id}-lattice`} width="9" height="13" patternUnits="userSpaceOnUse">
          <path d="M0,6.5 L4.5,0 L9,6.5 L4.5,13 Z" fill="none" stroke="currentColor" strokeWidth="0.7" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={360} height={240} />
      {CATHEDRAL_BAYS.map((cx) => (
        <g key={cx}>
          <path d={`M${cx - 34},214 V112 Q${cx - 34},62 ${cx},46 Q${cx + 34},62 ${cx + 34},112 V214 Z`} fill={`url(#${id})`} />
          <path d={`M${cx - 34},214 V112 Q${cx - 34},62 ${cx},46 Q${cx + 34},62 ${cx + 34},112 V214 Z`} fill={`url(#${id}-halo)`} />
          <path d={`M${cx - 34},214 V112 Q${cx - 34},62 ${cx},46 Q${cx + 34},62 ${cx + 34},112 V214 Z`} fill={`url(#${id}-lattice)`} opacity={0.55} />
          {/* 透かし彫り */}
          <g fill="none" stroke="currentColor" strokeLinecap="round">
            <path d={`M${cx},74 V214 M${cx - 34},150 H${cx + 34}`} strokeWidth={3.2} />
            <path d={`M${cx - 34},128 Q${cx - 33},96 ${cx - 17},86 Q${cx - 1},96 ${cx},128 M${cx},128 Q${cx + 1},96 ${cx + 17},86 Q${cx + 33},96 ${cx + 34},128`} strokeWidth={2.6} />
            <circle cx={cx} cy={70} r={10} strokeWidth={2.6} />
            <path d={`M${cx - 7},70 H${cx + 7} M${cx},63 V77`} strokeWidth={1.6} />
            <path d={`M${cx - 34},172 H${cx + 34} M${cx - 34},194 H${cx + 34} M${cx - 17},150 V214 M${cx + 17},150 V214`} strokeWidth={0.9} opacity={0.75} />
          </g>
          {/* 窓台 */}
          <rect x={cx - 40} y={212} width={80} height={6} />
        </g>
      ))}
      {/* 柱（柱頭・台座）と、上の蛇腹 */}
      {[0, 180, 360].map((x) => (
        <g key={x}>
          <rect x={x - 12} y={24} width={24} height={216} />
          <rect x={x - 16} y={30} width={32} height={6} />
          <rect x={x - 16} y={226} width={32} height={14} />
          <rect x={x - 3} y={36} width={6} height={190} fill={accent} opacity={0.06} />
        </g>
      ))}
      <rect x={0} y={16} width={360} height={4} fill={accent} opacity={0.12} />
    </>
  );
}

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

/** 針葉樹: 幹と、裾の広がるぎざぎざの枝の段 [中心, 高さ, 幅] */
const PINES: [number, number, number][] = [
  [30, 150, 44], [78, 190, 56], [124, 120, 36], [170, 170, 50], [222, 200, 60], [270, 140, 42], [318, 180, 54], [366, 130, 40],
];
function pinePath([cx, h, w]: (typeof PINES)[number], seed: number) {
  const top = 200 - h;
  const tiers = 6;
  let d = `M${cx - 2},200 L${cx - 2},${200 - h * 0.12} L${cx + 2},${200 - h * 0.12} L${cx + 2},200 Z `;
  for (let t = 0; t < tiers; t++) {
    const y0 = top + (h * 0.88 * t) / tiers;
    const y1 = top + (h * 0.88 * (t + 1.5)) / tiers;
    const half = (w / 2) * ((t + 1.4) / (tiers + 0.4));
    const j = (k: number) => (rand(seed * 13 + t * 5 + k, 22) - 0.5) * 3;
    d += `M${cx},${y0} L${cx + half * 0.45 + j(1)},${y0 + (y1 - y0) * 0.55} L${cx + half * 0.3},${y0 + (y1 - y0) * 0.5} L${cx + half + j(2)},${y1} L${cx + half * 0.55},${y1 - 2} L${cx},${y1 + 1} L${cx - half * 0.55},${y1 - 2} L${cx - half + j(3)},${y1} L${cx - half * 0.3},${y0 + (y1 - y0) * 0.5} L${cx - half * 0.45 + j(4)},${y0 + (y1 - y0) * 0.55} Z `;
  }
  return d;
}
const PINE_D = PINES.map((p, i) => pinePath(p, i)).join(" ");

/** 手前の太い幹: 上は枠の外まで伸び、根を張り、枝を少し伸ばす */
const TRUNKS = [
  { cx: 70, w: 26, lean: -4 },
  { cx: 290, w: 34, lean: 5 },
];
function trunkPath({ cx, w, lean }: (typeof TRUNKS)[number]) {
  const l = cx - w / 2, r = cx + w / 2;
  return [
    // 幹（上ほど少し細く）と根
    `M${l + lean - 2},-4 C${l + lean * 0.6},60 ${l + 2},130 ${l - 4},178 C${l - 14},188 ${l - 26},194 ${l - 34},200 L${r + 34},200 C${r + 24},194 ${r + 12},188 ${r + 4},178 C${r - 2},130 ${r + lean * 0.6},60 ${r + lean + 2},-4 Z`,
    // 枝
    `M${cx + lean * 0.5},70 C${cx + 30},58 ${cx + 52},40 ${cx + 66},20 L${cx + 70},24 C${cx + 56},46 ${cx + 34},66 ${cx + lean * 0.5},82 Z`,
    `M${cx + lean * 0.5},40 C${cx - 26},30 ${cx - 44},16 ${cx - 54},-2 L${cx - 48},-4 C${cx - 38},12 ${cx - 22},24 ${cx + lean * 0.5},28 Z`,
    // 苔むした茂み
    `M${cx - 120},200 C${cx - 116},186 ${cx - 100},182 ${cx - 90},190 C${cx - 84},180 ${cx - 66},182 ${cx - 62},200 Z`,
  ];
}
/** 部位ごとに分けた幹の輪郭（向きの違う輪郭が重なると穴が開くので、別々の path で塗る） */
const TRUNK_PARTS = TRUNKS.flatMap(trunkPath);

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

/** 床の絵（高さ 64）で、少女が踏む地面の線の高さ */
const GROUND = 6;
/** 床の層の上端から地面の線までの割合。少女の足裏をここに合わせる */
export const FLOOR_SURFACE = GROUND / 64;

const GRASS = range(70).map((i) => {
  const x = 3 + i * 5.6 + rand(i, 14) * 2;
  const h = 3 + rand(i, 15) * 4;
  return `M${x - 1.6},${GROUND + 1} L${x + rand(i, 16) * 2 - 1},${GROUND + 1 - h} L${x + 1.6},${GROUND + 1} Z`;
}).join(" ");

/* ---------- STAGE 3 星空の観測塔 ---------- */

/** 星座: 明るい星を細い線で結ぶ（夜空の星は、どれも誰かの一夜） */
const CONSTELLATIONS: [number, number][][] = [
  [[30, 60], [62, 44], [92, 58], [118, 40], [150, 52]],
  [[200, 120], [226, 96], [258, 104], [270, 136], [236, 150], [200, 120]],
  [[320, 40], [342, 70], [372, 62], [392, 90]],
  [[70, 150], [104, 132], [130, 160]],
];
function constellations(accent: string) {
  return (
    <>
      {STARS.map((s, i) => (
        <circle key={i} cx={(s.x * 500) / 400} cy={s.y} r={s.r * 0.8} opacity={0.25 + rand(i, 17) * 0.5} />
      ))}
      {CONSTELLATIONS.map((line, i) => (
        <g key={i}>
          <path d={`M${line.map(([x, y]) => `${x},${y}`).join(" L")}`} fill="none" stroke={accent} strokeWidth={0.5} opacity={0.35} />
          {line.map(([x, y], j) => (
            <g key={j}>
              <circle cx={x} cy={y} r={3.2} fill={accent} opacity={0.12} />
              <circle cx={x} cy={y} r={1.3} fill="#fffbe8" opacity={0.95} />
            </g>
          ))}
        </g>
      ))}
    </>
  );
}

/** 観測所: 円屋根から望遠鏡がのぞき、細い塔の窓に灯がともる */
function domes(accent: string) {
  const dome = (cx: number, base: number, r: number, tilt: number) => (
    <>
      <path d={`M${cx - r},${base} A${r},${r} 0 0,1 ${cx + r},${base} Z`} />
      {/* 円屋根の細い開口と、そこから空を仰ぐ望遠鏡 */}
      <path d={`M${cx - 2},${base - r + 1} L${cx + 2},${base - r + 1} L${cx + 3},${base - 4} L${cx - 3},${base - 4} Z`} fill={accent} opacity={0.35} />
      <g transform={`rotate(${tilt} ${cx} ${base - r * 0.55})`}>
        <rect x={cx - 3} y={base - r * 0.55 - r * 1.15} width={6} height={r * 1.15} rx={1.5} />
        <rect x={cx - 4} y={base - r * 0.55 - r * 1.15} width={8} height={3} rx={1} />
      </g>
      {/* 円屋根の肋 */}
      <path d={`M${cx - r * 0.7},${base - r * 0.71} A${r},${r} 0 0,1 ${cx + r * 0.7},${base - r * 0.71}`} fill="none" stroke={accent} strokeWidth={0.5} opacity={0.18} />
    </>
  );
  return (
    <>
      <rect x={0} y={178} width={400} height={22} />
      {/* 大きな観測所 */}
      <rect x={30} y={120} width={100} height={80} />
      {dome(80, 120, 44, 28)}
      {/* 細い塔と、灯のともる窓 */}
      <rect x={176} y={70} width={26} height={130} />
      <path d="M172,72 L189,30 L206,72 Z" />
      {[90, 112, 134, 156].map((y, i) => (
        <path key={y} d={`M186,${y + 8} v-6 a3,3 0 0,1 6,0 v6 z`} fill={accent} opacity={i === 1 ? 0.35 : 0.7} />
      ))}
      {/* 小さな観測所 */}
      <rect x={250} y={140} width={80} height={60} />
      {dome(290, 140, 30, -22)}
      {range(4).map((i) => (
        <rect key={i} x={262 + i * 16} y={160} width={5} height={8} rx={2.5} fill={accent} opacity={0.55} />
      ))}
      {/* 渡り廊下のアーチ */}
      <path d="M130,150 H176 V200 H130 Z M138,200 V168 A7,7 0 0,1 152,168 V200 Z M156,200 V168 A7,7 0 0,1 170,168 V200 Z" fillRule="evenodd" />
      <path d="M202,160 H250 V200 H202 Z" />
      {range(5).map((i) => (
        <rect key={i} x={360 + (i % 2) * 12} y={150 + i * 9} width={14} height={4} />
      ))}
    </>
  );
}

/** 石の欄干: 上下の手すりの間に、壺形の小柱を並べる */
const BALUSTER = (x: number) =>
  `M${x - 3},52 C${x - 3},46 ${x - 6},40 ${x - 6},32 C${x - 6},24 ${x - 2.5},20 ${x - 2.5},14 L${x + 2.5},14 C${x + 2.5},20 ${x + 6},24 ${x + 6},32 C${x + 6},40 ${x + 3},46 ${x + 3},52 Z`;
function balustrade(accent: string) {
  return (
    <>
      <rect x={0} y={4} width={200} height={9} />
      <rect x={0} y={4} width={200} height={1} fill={accent} opacity={0.3} />
      <rect x={0} y={52} width={200} height={12} />
      {range(10).map((i) => (
        <path key={i} d={BALUSTER(10 + i * 20)} />
      ))}
      <rect x={96} y={0} width={14} height={64} />
    </>
  );
}

/* ---------- STAGE 4 蒼氷の大回廊 ---------- */

/** 時計塔: 大沈黙の夜、一斉に止まった針。塔の縁には氷柱が下がる */
const CLOCK_TOWERS = [
  { x: 40, w: 50, top: 70, time: [10, 8] },
  { x: 170, w: 70, top: 30, time: [11, 58] },
  { x: 300, w: 46, top: 90, time: [3, 41] },
];
const clockHand = (cx: number, cy: number, deg: number, len: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return `M${cx},${cy} L${(cx + Math.cos(a) * len).toFixed(1)},${(cy + Math.sin(a) * len).toFixed(1)}`;
};
const clockTicks = (cx: number, cy: number, r: number) =>
  range(12)
    .map((k) => {
      const a = (k * 30 * Math.PI) / 180;
      return `M${(cx + Math.sin(a) * r * 0.82).toFixed(1)},${(cy - Math.cos(a) * r * 0.82).toFixed(1)} L${(cx + Math.sin(a) * r * 0.95).toFixed(1)},${(cy - Math.cos(a) * r * 0.95).toFixed(1)}`;
    })
    .join(" ");
function clocktower(accent: string) {
  return (
    <>
      <rect x={0} y={200} width={400} height={40} />
      {CLOCK_TOWERS.map(({ x, w, top, time: [h, m] }, i) => {
        const cx = x + w / 2, cy = top + w * 0.75, r = w * 0.36;
        const icicles = range(6)
          .map((k) => {
            const len = 6 + rand(i * 7 + k, 30) * 10;
            return `M${(x + 2 + k * (w / 6)).toFixed(1)},${top} l${(w / 24).toFixed(1)},${len.toFixed(1)} l${(w / 24).toFixed(1)},${(-len).toFixed(1)} Z`;
          })
          .join(" ");
        return (
          <g key={i}>
            <path d={`M${x},240 V${top} L${cx},${top - w * 0.9} L${x + w},${top} V240 Z`} />
            {/* 屋根の縁から下がる氷柱 */}
            <path d={icicles} />
            <circle cx={cx} cy={cy} r={r} fill={accent} opacity={0.16} />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={accent} strokeWidth={1} opacity={0.5} />
            <path d={clockTicks(cx, cy, r)} stroke={accent} strokeWidth={0.8} opacity={0.5} />
            <path
              d={`${clockHand(cx, cy, (h % 12) * 30 + m / 2, r * 0.5)} ${clockHand(cx, cy, m * 6, r * 0.78)}`}
              stroke={accent}
              strokeWidth={1.4}
              strokeLinecap="round"
              opacity={0.7}
            />
            {range(3).map((k) => (
              <rect key={k} x={cx - 2} y={cy + r + 14 + k * 26} width={4} height={10} rx={2} fill={accent} opacity={0.18} />
            ))}
          </g>
        );
      })}
    </>
  );
}

/** 氷の柱: 面取りした柱の中に、凍った誰かの一時間（結晶）が灯る。柱の間を薄い氷の弧が渡る */
function icepillars(accent: string) {
  const pillar = (x: number, i: number) => {
    const cy = 96 + rand(i, 31) * 50;
    const hex = range(6)
      .map((k) => {
        const a = (k * 60 * Math.PI) / 180;
        return `${(x + Math.cos(a) * 7).toFixed(1)},${(cy + Math.sin(a) * 9).toFixed(1)}`;
      })
      .join(" ");
    return (
      <g key={i}>
        <path d={`M${x - 16},220 L${x - 16},40 L${x - 10},30 L${x + 10},30 L${x + 16},40 L${x + 16},220 Z`} />
        {/* 柱頭の霜と、面取りの照り */}
        <path d={`M${x - 22},34 L${x + 22},34 L${x + 18},26 L${x - 18},26 Z`} />
        <path d={`M${x - 6},40 L${x - 6},214`} stroke={accent} strokeWidth={0.7} opacity={0.14} />
        <circle cx={x} cy={cy} r={16} fill={accent} opacity={0.1} />
        <polygon points={hex} fill={accent} opacity={0.5} />
        <polygon points={hex} fill="none" stroke="#ffffff" strokeWidth={0.6} opacity={0.5} />
      </g>
    );
  };
  return (
    <>
      {pillar(60, 0)}
      {pillar(240, 1)}
      <path d="M76,52 Q150,0 224,52 L224,60 Q150,10 76,60 Z" opacity={0.85} />
      <path d="M256,52 Q308,14 360,40 L360,48 Q308,22 256,60 Z" opacity={0.85} />
      <path d="M0,40 Q20,26 44,52 L44,60 Q20,34 0,48 Z" opacity={0.85} />
    </>
  );
}

/* ---------- STAGE 5 紅蓮の魔導炉 ---------- */

/** 錬金術の器具: 蒸留器・鎖で吊られた坩堝・配管と弁・ルーンの刻まれた台 */
function alchemy(accent: string) {
  return (
    <>
      <rect x={0} y={206} width={420} height={14} />
      {/* 蒸留器: 丸い胴と長い首、受け瓶 */}
      <circle cx={70} cy={168} r={30} />
      <path d="M62,140 L62,116 C62,96 96,80 128,92 L176,124 L172,130 L126,100 C100,90 78,100 78,116 L78,140 Z" />
      <path d="M168,128 L182,170 L196,170 L196,206 L160,206 L160,170 L174,170 Z" />
      <ellipse cx={70} cy={176} rx={18} ry={10} fill={accent} opacity={0.5} />
      <path d="M48,206 L54,196 L86,196 L92,206 Z" />
      {/* 鎖で吊られた坩堝。中の溶けた星が灯る */}
      <path d="M250,0 V86 M244,0 V86" stroke="currentColor" strokeWidth={1.4} strokeDasharray="4 2" fill="none" />
      <path d="M222,86 H272 L266,118 C262,130 232,130 228,118 Z" />
      <ellipse cx={247} cy={88} rx={22} ry={4} fill={accent} opacity={0.75} />
      {/* 配管と弁 */}
      <path d="M300,206 V120 C300,104 312,96 328,96 H420 V108 H330 C320,108 314,114 314,124 V206 Z" />
      <circle cx={360} cy={102} r={11} />
      <path d="M352,94 L368,110 M368,94 L352,110" stroke={accent} strokeWidth={1} opacity={0.35} />
      {/* ルーンの刻まれた台 */}
      <path d="M220,206 L226,176 H290 L296,206 Z" />
      <path d="M232,190 h6 m6,0 h8 m6,0 h4 m6,0 h10" stroke={accent} strokeWidth={1.2} opacity={0.55} />
    </>
  );
}

/* ---------- STAGE 6 天空の大聖堂 ---------- */

/** 雲に浮かぶ聖堂の島: 岩の島の上に尖塔の聖堂が立ち、下には岩が垂れる */
const ISLES = [
  { cx: 80, y: 120, w: 90 },
  { cx: 270, y: 80, w: 130 },
  { cx: 430, y: 140, w: 70 },
];
function skyisles(accent: string) {
  return (
    <>
      {ISLES.map(({ cx, y, w }, i) => {
        const l = cx - w / 2, r = cx + w / 2;
        return (
          <g key={i}>
            {/* 岩の島と、垂れる岩 */}
            <path d={`M${l},${y} L${r},${y} L${r - w * 0.12},${y + 10} L${cx + w * 0.2},${y + 40} L${cx + 4},${y + 64} L${cx - w * 0.18},${y + 34} L${l + w * 0.1},${y + 12} Z`} />
            {/* 聖堂: 身廊と尖塔 */}
            <rect x={cx - w * 0.3} y={y - w * 0.3} width={w * 0.6} height={w * 0.3} />
            <path d={`M${cx - w * 0.32},${y - w * 0.3} L${cx},${y - w * 0.46} L${cx + w * 0.32},${y - w * 0.3} Z`} />
            <path d={`M${cx + w * 0.16},${y} V${y - w * 0.62} L${cx + w * 0.22},${y - w * 0.9} L${cx + w * 0.28},${y - w * 0.62} V${y} Z`} />
            <path d={`M${cx - w * 0.28},${y} V${y - w * 0.48} L${cx - w * 0.23},${y - w * 0.68} L${cx - w * 0.18},${y - w * 0.48} V${y} Z`} />
            <circle cx={cx} cy={y - w * 0.18} r={w * 0.05} fill={accent} opacity={0.6} />
          </g>
        );
      })}
    </>
  );
}

/** 鈴の列柱: 雲の上に崩れかけの白い列柱が並び、アーチから鈴が下がる */
const bellPath = (cx: number, top: number, s: number) =>
  `M${cx - 9 * s},${top + 26 * s} C${cx - 9 * s},${top + 14 * s} ${cx - 6 * s},${top + 8 * s} ${cx},${top + 8 * s} C${cx + 6 * s},${top + 8 * s} ${cx + 9 * s},${top + 14 * s} ${cx + 9 * s},${top + 26 * s} L${cx + 11 * s},${top + 29 * s} L${cx - 11 * s},${top + 29 * s} Z`;
function belfry(accent: string) {
  return (
    <>
      <path d="M0,10 H360 V220 H0 Z M30,220 V96 Q30,46 90,34 Q150,46 150,96 V220 Z M210,220 V96 Q210,46 270,34 Q330,46 330,96 V220 Z" fillRule="evenodd" />
      {/* 崩れた上端 */}
      <path d="M0,10 L20,16 L50,8 L80,18 L110,6 L140,16 L170,8 L200,18 L240,6 L270,16 L300,8 L322,20 L340,10 L360,14 V24 H0 Z" />
      {/* アーチから下がる鈴 */}
      <path d="M90,34 V42 M270,34 V41" stroke="currentColor" strokeWidth={1.4} />
      <path d={`${bellPath(90, 34, 1)} ${bellPath(270, 34, 0.85)}`} />
      <circle cx={90} cy={66} r={3.4} fill={accent} opacity={0.75} />
      <circle cx={270} cy={61} r={2.8} fill={accent} opacity={0.75} />
      {/* 柱の溝 */}
      <path d="M170,40 V220 M180,40 V220 M190,40 V220 M350,40 V220 M10,40 V220" stroke={accent} strokeWidth={0.6} opacity={0.12} />
    </>
  );
}

/* ---------- 星天の塔 ---------- */

/** 浮かぶ足場: ルーンの刻まれた石の板と、宙に途切れる階段 */
function fragments(accent: string) {
  const slab = (x: number, y: number, w: number, i: number) => (
    <g key={i}>
      <path d={`M${x},${y} H${x + w} L${x + w - 8},${y + 10} L${x + w * 0.6},${y + 26} L${x + w * 0.4},${y + 18} L${x + 8},${y + 10} Z`} />
      <path d={`M${x + w * 0.25},${y + 5} h4 m5,0 h6 m5,0 h3`} stroke={accent} strokeWidth={1} opacity={0.6} />
      <rect x={x} y={y - 1} width={w} height={1} fill={accent} opacity={0.35} />
    </g>
  );
  return (
    <>
      {slab(20, 120, 80, 0)}
      {slab(160, 70, 60, 1)}
      {slab(300, 140, 90, 2)}
      {/* 宙に途切れる階段 */}
      {range(6).map((i) => (
        <rect key={i} x={226 + i * 12} y={150 - i * 12} width={14} height={5} />
      ))}
      {range(5).map((i) => (
        <circle key={i} cx={60 + i * 80 + rand(i, 40) * 20} cy={40 + rand(i, 41) * 60} r={1.4} fill={accent} opacity={0.7} />
      ))}
    </>
  );
}

export const ART: Record<ExpeditionArt, Art> = {
  constellations: { width: 500, height: 200, render: constellations },
  domes: { width: 400, height: 200, render: domes },
  balustrade: { width: 200, height: 64, render: balustrade },
  clocktower: { width: 400, height: 240, render: clocktower },
  icepillars: { width: 360, height: 220, render: icepillars },
  alchemy: { width: 420, height: 220, render: alchemy },
  skyisles: { width: 500, height: 200, render: skyisles },
  belfry: { width: 360, height: 220, render: belfry },
  fragments: { width: 400, height: 200, render: fragments },
  pines: { width: 400, height: 200, render: () => <path d={PINE_D} /> },
  trunks: { width: 400, height: 200, render: () => TRUNK_PARTS.map((d, i) => <path key={i} d={d} />) },
  cathedral: { width: 360, height: 240, render: cathedral },
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
        <defs>
          <linearGradient id={gradId("floor", accent)} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={accent} stopOpacity="0.16" />
            <stop offset="0.45" stopColor={accent} stopOpacity="0.04" />
            <stop offset="1" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x={0} y={GROUND} width={400} height={64 - GROUND} />
        {/* 磨いた石の床に、灯がぼんやり映る */}
        <rect x={0} y={GROUND} width={400} height={64 - GROUND} fill={`url(#${gradId("floor", accent)})`} />
        <rect x={0} y={GROUND} width={400} height={0.8} fill={accent} opacity={0.35} />
        <path
          d="M0,26 H400 M0,46 H400 M60,6 V26 M180,6 V26 M300,6 V26 M120,26 V46 M240,26 V46 M360,26 V46 M30,46 V64 M150,46 V64 M270,46 V64 M390,46 V64"
          stroke={accent}
          strokeWidth={0.6}
          opacity={0.08}
          fill="none"
        />
      </>
    ),
  },
  // 魔導炉の床: 黒い石に、熾火のひびが走って光る
  magma: {
    width: 400,
    height: 64,
    render: (accent) => (
      <>
        <rect x={0} y={GROUND} width={400} height={64 - GROUND} />
        <rect x={0} y={GROUND} width={400} height={0.8} fill={accent} opacity={0.4} />
        <path
          d="M20,64 L34,44 L28,30 L46,14 M120,64 L112,48 L126,36 L118,22 M210,64 L222,50 L214,40 L232,24 L228,12 M300,64 L292,46 L306,34 M360,64 L372,42 L366,26 L380,12"
          fill="none"
          stroke={accent}
          strokeWidth={0.8}
          opacity={0.3}
          className="expedition-flame"
        />
        <path d="M34,44 L50,40 M126,36 L140,40 M214,40 L200,34 M306,34 L320,30" fill="none" stroke={accent} strokeWidth={0.5} opacity={0.2} />
      </>
    ),
  },
  grass: {
    width: 400,
    height: 64,
    render: (accent) => (
      <>
        <rect x={0} y={GROUND} width={400} height={64 - GROUND} />
        <path d={GRASS} />
        {range(7).map((i) => (
          <circle key={i} cx={28 + i * 56 + rand(i, 20) * 20} cy={GROUND - 2 - rand(i, 21) * 2} r={0.9} fill={accent} opacity={0.7} />
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
export function BackdropTile({ source, accent, rim = 0 }: { source: ExpeditionSource; accent: string; rim?: number }) {
  const aspectRatio = sourceAspect(source);
  if ("image" in source) {
    // 背景画像は飾り。読み込みの順は景色の見え方だけに関わるので、遅らせて構わない
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={source.image} alt="" loading="lazy" decoding="async" draggable={false} className="h-full w-auto max-w-none shrink-0 select-none" style={{ aspectRatio }} />;
  }
  const art = ART[source.art];
  return (
    <svg viewBox={`0 0 ${art.width} ${art.height}`} className="h-full w-auto shrink-0" style={{ aspectRatio }} fill="currentColor" aria-hidden>
      {/* 影絵の上の縁に差す光: 同じ絵を少し上へずらして灯の色で敷き、その上に影絵を重ねる */}
      {rim > 0 && (
        <g transform="translate(0 -1.2)" fill={accent} stroke={accent} opacity={rim} style={{ color: accent }}>
          {art.render(accent)}
        </g>
      )}
      {art.render(accent)}
    </svg>
  );
}
