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
 * 書庫の聖堂の壁: 柱の間の尖頭窓から、外の夜空（星空と月）が透けて見える。窓は透かし彫り（中央の縦桟・小さな尖頭アーチ・円窓）と
 * 菱形の鉛格子で区切り、硝子は月明かりでほんのり青い。柱には柱頭と台座を付ける
 */
const CATHEDRAL_BAYS = [90, 270];
function cathedral(accent: string) {
  const id = gradId("window", accent);
  const windowPath = (cx: number) => `M${cx - 34},214 V112 Q${cx - 34},62 ${cx},46 Q${cx + 34},62 ${cx + 34},112 V214 Z`;
  return (
    <>
      <defs>
        {/* 月明かりを受ける古い硝子: 上ほど明るく、ほんのり青い */}
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.2" />
          <stop offset="0.6" stopColor={accent} stopOpacity="0.07" />
          <stop offset="1" stopColor={accent} stopOpacity="0.02" />
        </linearGradient>
        {/* 古い硝子の菱形の鉛格子 */}
        <pattern id={`${id}-lattice`} width="9" height="13" patternUnits="userSpaceOnUse">
          <path d="M0,6.5 L4.5,0 L9,6.5 L4.5,13 Z" fill="none" stroke="currentColor" strokeWidth="0.6" />
        </pattern>
      </defs>
      {/* 壁に窓を抜き、外の夜空（星空と月）を透かす */}
      <path d={`M0,0 H360 V240 H0 Z ${CATHEDRAL_BAYS.map(windowPath).join(" ")}`} fillRule="evenodd" />
      {CATHEDRAL_BAYS.map((cx) => (
        <g key={cx}>
          <path d={windowPath(cx)} fill={`url(#${id})`} />
          <path d={windowPath(cx)} fill={`url(#${id}-lattice)`} opacity={0.5} />
          {/* 透かし彫り */}
          <g fill="none" stroke="currentColor" strokeLinecap="round">
            <path d={`M${cx},74 V214 M${cx - 34},150 H${cx + 34}`} strokeWidth={3.2} />
            <path d={`M${cx - 34},128 Q${cx - 33},96 ${cx - 17},86 Q${cx - 1},96 ${cx},128 M${cx},128 Q${cx + 1},96 ${cx + 17},86 Q${cx + 33},96 ${cx + 34},128`} strokeWidth={2.6} />
            <circle cx={cx} cy={70} r={10} strokeWidth={2.6} />
            <path d={`M${cx - 7},70 H${cx + 7} M${cx},63 V77`} strokeWidth={1.6} />
            <path d={`M${cx - 34},172 H${cx + 34} M${cx - 34},194 H${cx + 34} M${cx - 17},150 V214 M${cx + 17},150 V214`} strokeWidth={0.9} opacity={0.75} />
          </g>
          {/* 窓の縁に差す月明かりと、窓台 */}
          <path d={`M${cx - 34},214 V112 Q${cx - 34},62 ${cx},46 Q${cx + 34},62 ${cx + 34},112 V214`} fill="none" stroke={accent} strokeWidth={0.8} opacity={0.3} />
          <rect x={cx - 40} y={212} width={80} height={6} />
          <rect x={cx - 40} y={212} width={80} height={0.8} fill={accent} opacity={0.3} />
        </g>
      ))}
      {/* 柱（柱頭・台座）と、上の蛇腹 */}
      {[0, 180, 360].map((x) => (
        <g key={x}>
          <rect x={x - 12} y={24} width={24} height={216} />
          <rect x={x - 16} y={30} width={32} height={6} />
          <rect x={x - 16} y={226} width={32} height={14} />
          <rect x={x + 9} y={36} width={2} height={190} fill={accent} opacity={0.08} />
        </g>
      ))}
      <rect x={0} y={16} width={360} height={4} fill={accent} opacity={0.1} />
    </>
  );
}

/** 尖頭アーチの列柱。壁から窓を抜く（evenodd） */
const ARCH_BAYS = [15, 165];
const archesPath =
  "M0,0 H300 V200 H0 Z " + ARCH_BAYS.map((x) => `M${x},200 V95 Q${x},35 ${x + 60},22 Q${x + 120},35 ${x + 120},95 V200 Z`).join(" ");

const STARS = range(46).map((i) => ({ x: 4 + rand(i, 1) * 392, y: 4 + rand(i, 2) * 192, r: 0.4 + rand(i, 3) * 1.1 }));

/** 星の色: 白・青白・暖色・薄紫を混ぜる */
const STAR_TINTS = ["#fff8ec", "#dce6ff", "#ffe6c4", "#e9dcff"];
/** 明るい星は、四方に光の筋を伸ばす */
const sparklePath = (x: number, y: number, s: number) =>
  `M${x},${y - s * 2.4} L${x + s * 0.32},${y - s * 0.32} L${x + s * 2.4},${y} L${x + s * 0.32},${y + s * 0.32} L${x},${y + s * 2.4} L${x - s * 0.32},${y + s * 0.32} L${x - s * 2.4},${y} L${x - s * 0.32},${y - s * 0.32} Z`;
const SPARKLES = range(5).map((i) => ({ x: 30 + i * 78 + rand(i, 50) * 30, y: 15 + rand(i, 51) * 150, s: 0.9 + rand(i, 52) * 0.8 }));
function starfield() {
  return (
    <>
      {STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.85} fill={STAR_TINTS[i % 4]} opacity={0.3 + rand(i, 17) * 0.6} />
      ))}
      {SPARKLES.map((p, i) => (
        <g key={i} fill={STAR_TINTS[i % 4]}>
          <circle cx={p.x} cy={p.y} r={p.s * 2.4} opacity={0.08} />
          <path d={sparklePath(p.x, p.y, p.s)} opacity={0.85} />
        </g>
      ))}
    </>
  );
}


/** 書架: 棚板の間に背の不ぞろいな本を詰める。背表紙の色は濃淡があり、ところどころ金の帯が入る。まれに傾いた本 */
function shelfBooks(x0: number, x1: number, shelfY: number, seed: number, accent: string) {
  const books: ReactNode[] = [];
  let x = x0 + 2;
  let i = 0;
  while (x < x1 - 4) {
    const w = 4 + Math.floor(rand(seed + i, 4) * 6);
    const h = 24 + Math.floor(rand(seed + i, 5) * 14);
    if (x + w > x1 - 2) break;
    const tone = 0.7 + rand(seed + i, 8) * 0.3;
    const banded = rand(seed + i, 9) > 0.55;
    if (rand(seed + i, 6) > 0.9) {
      x += 6;
    } else if (rand(seed + i, 7) > 0.93) {
      books.push(<rect key={`${seed}-${i}`} x={x} y={shelfY - h + 2} width={w} height={h} opacity={tone} transform={`rotate(-14 ${x + w} ${shelfY})`} />);
      x += w + 6;
    } else {
      books.push(
        <g key={`${seed}-${i}`}>
          <rect x={x} y={shelfY - h} width={w} height={h} opacity={tone} />
          {banded && (
            <path d={`M${x + 0.6},${shelfY - h * 0.82} h${w - 1.2} M${x + 0.6},${shelfY - h * 0.2} h${w - 1.2}`} stroke={accent} strokeWidth={0.6} opacity={0.32} />
          )}
        </g>,
      );
      x += w + 0.8;
    }
    i++;
  }
  return books;
}

/** 燭台: 三本の蝋燭と、炎のまわりの柔らかな灯 */
function candelabra(cx: number, base: number, accent: string, key: string) {
  const id = gradId("candle", accent);
  return (
    <g key={key}>
      <circle cx={cx} cy={base - 16} r={22} fill={`url(#${id})`} className="expedition-flame" />
      <path d={`M${cx - 1},${base} V${base - 6} M${cx - 9},${base - 6} Q${cx},${base - 2} ${cx + 9},${base - 6} M${cx - 6},${base} H${cx + 6}`} stroke="currentColor" strokeWidth={1.4} fill="none" />
      {[-9, 0, 9].map((dx, k) => (
        <g key={k}>
          <rect x={cx + dx - 1.4} y={base - 6 - (k === 1 ? 10 : 7)} width={2.8} height={k === 1 ? 10 : 7} />
          <ellipse cx={cx + dx} cy={base - 6 - (k === 1 ? 10 : 7) - 2.6} rx={1.3} ry={2.6} fill="#fff2cc" className="expedition-flame" />
        </g>
      ))}
    </g>
  );
}

function bookcase(x: number, key: number, accent: string) {
  const width = 160;
  const shelves = [64, 110, 156, 200];
  const id = gradId("candle", accent);
  return (
    <g key={key}>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor={accent} stopOpacity="0.45" />
          <stop offset="0.4" stopColor={accent} stopOpacity="0.12" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* 背板は淡く、奥がわずかに透ける */}
      <rect x={x} y={22} width={width} height={178} opacity={0.4} />
      <rect x={x - 4} y={14} width={width + 8} height={9} />
      <rect x={x} y={20} width={6} height={180} />
      <rect x={x + width - 6} y={20} width={6} height={180} />
      {shelves.map((y, i) => (
        <g key={y}>
          {shelfBooks(x + 6, x + width - 6, y, key * 40 + i * 9, accent)}
          <rect x={x} y={y} width={width} height={5} />
          <rect x={x} y={y} width={width} height={0.7} fill={accent} opacity={0.22} />
        </g>
      ))}
      {/* 書架の上の燭台 */}
      {candelabra(x + 112, 14, accent, `c${key}`)}
    </g>
  );
}

/**
 * 灯火の机: 蝋燭に照らされて開いた本、インク壺と羽根ペン、積んだ本と巻物。
 * 景色の中をときおり通り過ぎる（はじまりの小屋の机の名残）
 */
function readingDesk(accent: string) {
  const id = gradId("desk", accent);
  return (
    <>
      <defs>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" stopColor={accent} stopOpacity="0.5" />
          <stop offset="0.35" stopColor={accent} stopOpacity="0.14" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-page`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f6e7c4" stopOpacity="0.32" />
          <stop offset="1" stopColor="#f6e7c4" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* 蝋燭の灯が机のまわりを照らす */}
      <ellipse cx={332} cy={56} rx={110} ry={80} fill={`url(#${id}-glow)`} className="expedition-flame" />
      {/* 机: 天板・彫りのある脚・引き出し */}
      <rect x={200} y={70} width={160} height={7} />
      <rect x={200} y={70} width={160} height={0.8} fill={accent} opacity={0.4} />
      <path d="M208,77 H352 V90 H208 Z" />
      <path d="M268,82 h24" stroke={accent} strokeWidth={0.8} opacity={0.35} />
      <path d="M212,90 C210,100 216,108 212,120 H220 C216,108 222,100 220,90 Z M340,90 C338,100 344,108 340,120 H348 C344,108 350,100 348,90 Z" />
      {/* 開いた本: 灯を受けた頁と、かすれた行 */}
      <path d="M248,70 C254,64 266,63 278,66 L278,70 Z" fill={`url(#${id}-page)`} />
      <path d="M278,70 L278,66 C290,63 302,64 308,70 Z" fill={`url(#${id}-page)`} />
      <path d="M254,67.5 h18 M282,67 h18 M256,68.8 h16 M284,68.6 h14" stroke="currentColor" strokeWidth={0.4} opacity={0.5} />
      {/* 燭台と炎 */}
      <path d="M326,70 h12 l-2,-2 h-8 Z M330,68 V54 h4 V68 Z" />
      <ellipse cx={332} cy={50} rx={1.8} ry={3.6} fill="#fff2cc" className="expedition-flame" />
      {/* インク壺と羽根ペン */}
      <path d="M222,70 C220,66 220,62 224,61 H230 C234,62 234,66 232,70 Z" />
      <path d="M228,61 C232,52 240,42 250,36 C246,44 240,52 230,62 Z" />
      <path d="M229,61 L249,37" stroke={accent} strokeWidth={0.4} opacity={0.35} />
      {/* 床に積んだ本と、立て掛けた巻物 */}
      <path d="M372,120 V112 H404 V120 Z M376,112 V105 H400 V112 Z M370,105 V98 H398 V105 Z" />
      <path d="M372,112 H404 M376,105 H400" stroke={accent} strokeWidth={0.4} opacity={0.3} />
      <path d="M176,120 L188,84 L193,85 L182,120 Z M184,120 L192,90 L196,91 L189,120 Z" />
      <circle cx={190} cy={84} r={2.4} />
      <circle cx={194} cy={90} r={2} />
    </>
  );
}

const TREES = [
  { cx: 60, top: 58, r: 32 },
  { cx: 150, top: 92, r: 24 },
  { cx: 238, top: 36, r: 40 },
  { cx: 336, top: 78, r: 28 },
];

/** 多角形を時計回りにそろえる（向きの違う輪郭を一つの path に重ねると、重なった所に穴が開くため） */
function clockwise(points: number[][]) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return area < 0 ? [...points].reverse() : points;
}
const polygonD = (points: number[][]) => `M${clockwise(points).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L")} Z`;

/**
 * 針葉樹: 細い幹から、段ごとに左右へ不揃いに枝が伸びる。枝は先へ行くほど垂れ、下の縁は細かな葉の房でぎざぎざになる。
 * 下の段ほど長く、ところどころ枝の短い段や隙間がある [中心, 高さ, 幅]
 */
const PINES: [number, number, number][] = [
  [30, 150, 46], [78, 190, 58], [124, 120, 38], [170, 172, 52], [222, 198, 62], [270, 140, 44], [318, 182, 56], [366, 132, 42],
];
function pinePath([cx, h, w]: (typeof PINES)[number], seed: number) {
  const top = 200 - h;
  const tiers = Math.round(h / 12);
  const girth = w / 46;
  const lean = (rand(seed, 44) - 0.5) * 2;
  const polys: number[][][] = [
    [
      [cx - 3.2 * girth, 200],
      [cx - 1.5 * girth, 197],
      [cx - 1.1 * girth + lean * 0.5, top + h * 0.6],
      [cx - 0.5 * girth + lean, top + h * 0.2],
      [cx + 0.5 * girth + lean, top + h * 0.2],
      [cx + 1.1 * girth + lean * 0.5, top + h * 0.6],
      [cx + 1.5 * girth, 197],
      [cx + 3.2 * girth, 200],
    ],
    [[cx + lean, top - 5], [cx + lean + 2.6, top + 9], [cx + lean - 2.6, top + 9]],
  ];
  for (let t = 0; t < tiers; t++) {
    const f = (t + 1) / tiers;
    const y = top + h * 0.93 * f;
    for (const side of [-1, 1]) {
      const r = (k: number) => rand(seed * 37 + t * 4 + (side > 0 ? 2 : 0) + k, 40);
      const len = (w / 2) * (0.16 + 0.84 * f ** 0.85) * (0.68 + r(0) * 0.5);
      const droop = len * (0.28 + r(1) * 0.18);
      const thick = 2.6 + f * 4;
      const tipX = cx + side * len, tipY = y + droop;
      const pts = [
        [cx, y - thick * 0.6],
        [cx + side * len * 0.35, y - 0.6],
        [cx + side * len * 0.72, y + droop * 0.5],
        [tipX, tipY],
      ];
      // 下の縁: 葉の房でぎざぎざに戻る
      const teeth = 6;
      for (let k = 1; k <= teeth; k++) {
        const u = k / (teeth + 1);
        pts.push([tipX - side * len * u, y + droop * (1 - u) * 0.95 + thick * u + (k % 2 ? 2 + r(3 + k) * 1.6 : 0)]);
      }
      pts.push([cx, y + thick]);
      polys.push(pts);
    }
  }
  return polys.map(polygonD).join(" ");
}
const PINE_D = PINES.map((p, i) => pinePath(p, i)).join(" ");

/**
 * 手前の古い幹: 上は枠の外まで伸び、根を張り、枝を伸ばす。樹皮には縦の筋、根と枝の上には苔、枝先からは苔の房が垂れる。
 * 大きな幹の洞には小さな書架があり、ランタンの灯が本を照らす（樹海の図書室）
 */
const TRUNKS = [
  { cx: 70, w: 26, lean: -4, hollow: false },
  { cx: 290, w: 36, lean: 5, hollow: true },
];
function trunkParts({ cx, w, lean }: (typeof TRUNKS)[number]) {
  const l = cx - w / 2, r = cx + w / 2;
  return [
    // 幹（上ほど少し細く）と、うねる根
    `M${l + lean - 2},-4 C${l + lean * 0.6},60 ${l + 2},130 ${l - 4},176 C${l - 10},184 ${l - 22},188 ${l - 30},192 C${l - 38},196 ${l - 44},198 ${l - 48},200 L${r + 46},200 C${r + 40},197 ${r + 32},194 ${r + 24},190 C${r + 14},186 ${r + 6},182 ${r + 4},176 C${r - 2},130 ${r + lean * 0.6},60 ${r + lean + 2},-4 Z`,
    // 枝
    `M${cx + lean * 0.5},70 C${cx + 30},58 ${cx + 52},40 ${cx + 66},20 L${cx + 70},24 C${cx + 56},46 ${cx + 34},66 ${cx + lean * 0.5},82 Z`,
    `M${cx + lean * 0.5},40 C${cx - 26},30 ${cx - 44},16 ${cx - 54},-2 L${cx - 48},-4 C${cx - 38},12 ${cx - 22},24 ${cx + lean * 0.5},28 Z`,
  ];
}
/** 幹の横の位置 u（0 が左の縁、1 が右の縁）と高さ y にある点。幹は上ほど傾きの分だけずれる */
function trunkAt({ cx, w, lean }: (typeof TRUNKS)[number], u: number, y: number) {
  const k = 1 - Math.min(1, y / 176);
  const left = cx - w / 2 + lean * k * 0.9;
  const width = w * (1 - k * 0.12);
  return [left + width * u, y] as const;
}
/** 樹皮の裂け目: 幹の曲がりに沿って、短く、ときに途中で分かれる。[path, 太さ, 濃さ] */
function barkFissures(t: (typeof TRUNKS)[number], seed: number): [string, number, number][] {
  return range(26).map((k) => {
    const r = (s: number) => rand(seed * 53 + k, s);
    const u = 0.08 + r(1) * 0.84;
    const y0 = 4 + r(2) * 160;
    const len = 10 + r(3) ** 1.5 * 34;
    const wob = (r(4) - 0.5) * 1.6;
    const [x0] = trunkAt(t, u, y0);
    const [x1] = trunkAt(t, u, y0 + len * 0.5);
    const [x2] = trunkAt(t, u, y0 + len);
    let d = `M${x0.toFixed(1)},${y0.toFixed(1)} Q${(x1 + wob).toFixed(1)},${(y0 + len * 0.5).toFixed(1)} ${(x2 - wob * 0.4).toFixed(1)},${(y0 + len).toFixed(1)}`;
    if (r(5) > 0.6) {
      const fy = y0 + len * (0.3 + r(6) * 0.3);
      const [fx] = trunkAt(t, u, fy);
      d += ` M${(fx + wob * 0.5).toFixed(1)},${fy.toFixed(1)} q${((r(7) - 0.5) * 4).toFixed(1)},${(len * 0.2).toFixed(1)} ${((r(7) - 0.5) * 5).toFixed(1)},${(len * 0.38).toFixed(1)}`;
    }
    return [d, 0.3 + r(8) * 0.5, 0.035 + r(9) * 0.06];
  });
}
function trunks(accent: string) {
  const id = gradId("hollow", accent);
  return (
    <>
      <defs>
        <radialGradient id={id} cx="0.5" cy="0.6" r="0.6">
          <stop offset="0" stopColor="#f2c27a" stopOpacity="0.85" />
          <stop offset="0.5" stopColor="#c8823a" stopOpacity="0.35" />
          <stop offset="1" stopColor="#c8823a" stopOpacity="0" />
        </radialGradient>
      </defs>
      {TRUNKS.map((t, i) => {
        const { cx, w, lean, hollow } = t;
        return (
          <g key={i}>
            {trunkParts(t).map((d, k) => (
              <path key={k} d={d} />
            ))}
            {/* 樹皮: 幹の曲がりに沿う、長さも濃さも違う短い裂け目と、ところどころの節 */}
            {barkFissures(t, i).map(([d, width, opacity], k) => (
              <path key={k} d={d} fill="none" stroke={accent} strokeWidth={width} strokeLinecap="round" opacity={opacity} />
            ))}
            {[[0.3, 0.42, 3.4], [0.62, 0.7, 2.6]].map(([u, v, r], k) => {
              const y = v * 176;
              const [x] = trunkAt(t, u, y);
              return (
                <g key={k}>
                  <ellipse cx={x} cy={y} rx={r * 0.45} ry={r * 0.8} fill="#000000" opacity={0.3} />
                  <path d={`M${x - r * 0.5},${y - r * 0.9} q${r * 0.5},${-r * 0.4} ${r},0`} fill="none" stroke={accent} strokeWidth={0.35} opacity={0.08} />
                </g>
              );
            })}
            {/* 根と枝の上の苔 */}
            <path
              d={`M${cx - w / 2 - 40},198 C${cx - w / 2 - 30},192 ${cx - w / 2 - 16},188 ${cx - w / 2 - 6},180 M${cx + w / 2 + 6},180 C${cx + w / 2 + 16},188 ${cx + w / 2 + 30},192 ${cx + w / 2 + 40},198 M${cx + lean * 0.5 + 6},68 C${cx + 30},56 ${cx + 50},40 ${cx + 64},22`}
              fill="none"
              stroke={accent}
              strokeWidth={1.6}
              strokeLinecap="round"
              opacity={0.16}
            />
            {/* 枝先から垂れる苔の房 */}
            {[[cx + 58, 30, 26], [cx + 40, 50, 18], [cx - 40, 10, 22], [cx - 24, 22, 14]].map(([x, y, len], k) => (
              <path key={k} d={`M${x},${y} c-2,${len * 0.3} 2,${len * 0.6} -1,${len} M${x + 3},${y + 1} c2,${len * 0.25} -2,${len * 0.5} 1,${len * 0.8}`} fill="none" stroke="currentColor" strokeWidth={0.9} />
            ))}
            {/* 洞の書架とランタンの灯 */}
            {hollow && (
              <g>
                <path d={`M${cx - 10},140 V112 Q${cx - 10},96 ${cx + 1},92 Q${cx + 12},96 ${cx + 12},112 V140 Z`} fill={`url(#${id})`} />
                <path d={`M${cx - 10},140 V112 Q${cx - 10},96 ${cx + 1},92 Q${cx + 12},96 ${cx + 12},112 V140`} fill="none" stroke="currentColor" strokeWidth={1.6} />
                <rect x={cx - 10} y={120} width={22} height={1.6} />
                <rect x={cx - 10} y={138} width={22} height={2} />
                {[[-8, 109, 2.4, 11], [-5.2, 111, 2, 9], [-2.8, 108, 2.6, 12], [4, 110, 2.2, 10], [6.6, 112, 2, 8], [-7, 128, 2.6, 10], [-4, 130, 2, 8], [2, 127, 3, 11]].map(([dx, y, bw, bh], k) => (
                  <rect key={k} x={cx + dx} y={y + (k < 5 ? 11 - bh : 10 - bh)} width={bw} height={bh} />
                ))}
                <path d={`M${cx + 7},126 h3 v-4 h-3 Z`} />
                <circle cx={cx + 8.5} cy={124} r={1.1} fill="#fff2cc" className="expedition-flame" />
              </g>
            )}
          </g>
        );
      })}
    </>
  );
}

/** 草の葉: 根元から反りながら伸びる細い葉 */
const blade = (x: number, base: number, h: number, lean: number, w = 1.6) =>
  `M${(x - w / 2).toFixed(1)},${base} Q${(x + lean * 0.35).toFixed(1)},${(base - h * 0.62).toFixed(1)} ${(x + lean).toFixed(1)},${(base - h).toFixed(1)} Q${(x + lean * 0.3 + w * 0.3).toFixed(1)},${(base - h * 0.55).toFixed(1)} ${(x + w / 2).toFixed(1)},${base} Z`;
/** 草むら: 長さと傾きの違う葉を束ねる */
function grassClump(x: number, base: number, size: number, seed: number) {
  return range(9)
    .map((k) => {
      const r = (s: number) => rand(seed * 19 + k, s);
      return blade(x + (r(1) - 0.5) * size * 0.6, base, size * (0.5 + r(2) * 0.7), (r(3) - 0.5) * size * 0.9, 1.2 + r(4) * 0.8);
    })
    .join(" ");
}
/** シダ: 根元から弧を描く葉軸に、小葉が並ぶ */
function fern(x: number, base: number, size: number, seed: number) {
  const fronds = [-62, -38, -14, 12, 36, 60];
  return fronds
    .map((deg, k) => {
      const a = ((deg + (rand(seed + k, 50) - 0.5) * 14) * Math.PI) / 180;
      const len = size * (0.7 + rand(seed + k, 51) * 0.4) * (1 - Math.abs(deg) / 200);
      const pts: string[] = [];
      for (let j = 1; j <= 8; j++) {
        const t = j / 9;
        // 弧を描く葉軸（先ほど垂れる）
        const px = x + Math.sin(a) * len * t;
        const py = base - Math.cos(a) * len * t + len * t * t * 0.35;
        const leaf = size * 0.16 * (1 - t * 0.7);
        const nx = Math.cos(a), ny = Math.sin(a);
        pts.push(`M${px.toFixed(1)},${py.toFixed(1)} l${(nx * leaf - ny * leaf * 0.3).toFixed(1)},${(ny * leaf + nx * leaf * 0.3 - leaf * 0.4).toFixed(1)} l${(ny * leaf * 0.6).toFixed(1)},${(-nx * leaf * 0.6 + leaf * 0.3).toFixed(1)} Z`);
        pts.push(`M${px.toFixed(1)},${py.toFixed(1)} l${(-nx * leaf - ny * leaf * 0.3).toFixed(1)},${(-ny * leaf + nx * leaf * 0.3 - leaf * 0.4).toFixed(1)} l${(ny * leaf * 0.6).toFixed(1)},${(-nx * leaf * 0.6 + leaf * 0.3).toFixed(1)} Z`);
      }
      const ex = x + Math.sin(a) * len, ey = base - Math.cos(a) * len + len * 0.35;
      return `M${x},${base} Q${(x + Math.sin(a) * len * 0.5).toFixed(1)},${(base - Math.cos(a) * len * 0.6).toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)} L${(ex + 0.6).toFixed(1)},${(ey + 0.6).toFixed(1)} Q${(x + Math.sin(a) * len * 0.5 + 0.8).toFixed(1)},${(base - Math.cos(a) * len * 0.6 + 0.8).toFixed(1)} ${x + 0.9},${base} Z ${pts.join(" ")}`;
    })
    .join(" ");
}
/**
 * 下草: 少女のすぐ後ろの、シダ・反った草むら・苔むした岩・倒木。淡く光るキノコと小さな花がところどころに灯る
 */
function undergrowth(accent: string) {
  const id = gradId("glowcap", accent);
  const base = 120;
  return (
    <>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor="#9ff5e0" stopOpacity="0.6" />
          <stop offset="1" stopColor="#9ff5e0" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* 苔むした倒木 */}
      <path d={`M300,${base} C300,${base - 14} 306,${base - 18} 316,${base - 18} L420,${base - 14} C430,${base - 13} 432,${base - 4} 428,${base} Z`} />
      <ellipse cx={426} cy={base - 7} rx={4} ry={7} fill="none" stroke={accent} strokeWidth={0.5} opacity={0.2} />
      <path d={`M312,${base - 17} C340,${base - 20} 380,${base - 18} 418,${base - 14}`} fill="none" stroke={accent} strokeWidth={1.4} strokeLinecap="round" opacity={0.18} />
      {/* 苔むした岩 */}
      <path d={`M120,${base} C118,${base - 16} 132,${base - 26} 148,${base - 24} C164,${base - 22} 172,${base - 12} 170,${base} Z`} />
      <path d={`M124,${base - 14} C132,${base - 25} 150,${base - 27} 162,${base - 18}`} fill="none" stroke={accent} strokeWidth={1.6} strokeLinecap="round" opacity={0.2} />
      {/* シダと草むら */}
      <path d={fern(40, base, 46, 1)} />
      <path d={fern(236, base, 38, 2)} />
      <path d={fern(520, base, 50, 3)} />
      <path d={grassClump(90, base, 30, 4)} />
      <path d={grassClump(190, base, 22, 5)} />
      <path d={grassClump(280, base, 26, 6)} />
      <path d={grassClump(460, base, 32, 7)} />
      <path d={grassClump(580, base, 24, 8)} />
      {/* 淡く光るキノコ */}
      {[[176, 0.9], [184, 0.6], [446, 1], [454, 0.7], [462, 0.5]].map(([x, s], k) => (
        <g key={k}>
          <circle cx={x} cy={base - 10 * s} r={12 * s} fill={`url(#${id})`} />
          <rect x={x - 0.7 * s} y={base - 9 * s} width={1.4 * s} height={9 * s} />
          <path d={`M${x - 5 * s},${base - 8.6 * s} Q${x},${base - 15 * s} ${x + 5 * s},${base - 8.6 * s} Z`} />
          <path d={`M${x - 4.6 * s},${base - 8.8 * s} Q${x},${base - 7.4 * s} ${x + 4.6 * s},${base - 8.8 * s}`} fill="none" stroke="#9ff5e0" strokeWidth={0.8} opacity={0.85} />
        </g>
      ))}
      {/* 小さな花 */}
      {[[60, 18], [112, 22], [214, 16], [352, 24], [500, 20], [560, 14]].map(([x, h], k) => (
        <g key={k}>
          <path d={`M${x},${base} Q${x + 1.5},${base - h * 0.6} ${x + 0.5},${base - h}`} fill="none" stroke="currentColor" strokeWidth={0.6} />
          <circle cx={x + 0.5} cy={base - h} r={1.2} fill={accent} opacity={0.8} />
          <circle cx={x + 0.5} cy={base - h} r={3.2} fill={accent} opacity={0.12} />
        </g>
      ))}
    </>
  );
}



const ICICLES = (() => {
  let d = "M0,0 H300 V16 ";
  for (let x = 0; x < 300; x += 12) {
    const len = 10 + rand(x, 8) * (rand(x, 9) > 0.7 ? 70 : 34);
    d += `L${x + 5},${16 + len} L${x + 10},16 L${x + 12},${16 + rand(x, 10) * 4} `;
  }
  return d + "V0 Z";
})();


/** 床の絵（高さ 64）で、少女が踏む地面の線の高さ */
const GROUND = 6;
/** 床の層の上端から地面の線までの割合。少女の足裏をここに合わせる */
export const FLOOR_SURFACE = GROUND / 64;

/** 床の草: 地面の線から、長さと傾きの違う葉が反りながら伸びる */
const GRASS = range(110)
  .map((i) => {
    const x = 2 + i * 3.6 + rand(i, 14) * 2.4;
    const h = 2.5 + rand(i, 15) ** 1.5 * 5.5;
    return blade(x, GROUND + 1, Math.min(h, GROUND + 0.5), (rand(i, 16) - 0.5) * 4, 1 + rand(i, 17) * 0.8);
  })
  .join(" ");

/* ---------- STAGE 3 星空の観測塔 ---------- */

/** 星座: 明るい星を細い線で結ぶ（夜空の星は、どれも誰かの一夜）。先頭の星は光の筋を伸ばす */
const CONSTELLATIONS: [number, number][][] = [
  [[30, 60], [62, 44], [92, 58], [118, 40], [150, 52]],
  [[200, 120], [226, 96], [258, 104], [270, 136], [236, 150], [200, 120]],
  [[320, 40], [342, 70], [372, 62], [392, 90]],
  [[70, 150], [104, 132], [130, 160]],
];
function constellations(accent: string) {
  // 背景の星は星空（star-sky.tsx）に任せ、ここでは星座の星と、それを結ぶ細い線だけを描く
  return (
    <>
      {CONSTELLATIONS.map((line, i) => (
        <g key={i}>
          <path
            d={`M${line.map(([x, y]) => `${x},${y}`).join(" L")}`}
            fill="none"
            stroke={accent}
            strokeWidth={0.35}
            strokeLinecap="round"
            strokeDasharray="0.1 2.2"
            opacity={0.5}
          />
          {line.map(([x, y], j) => (
            <g key={j}>
              <circle cx={x} cy={y} r={j === 0 ? 4.5 : 3} fill={STAR_TINTS[(i + j) % 4]} opacity={0.12} />
              <circle cx={x} cy={y} r={j === 0 ? 1.1 : 0.8} fill="#ffffff" opacity={0.95} />
            </g>
          ))}
        </g>
      ))}
    </>
  );
}

/** 円筒の陰影: 左は陰、右は天文盤の灯を受ける */
function cylinderShade(id: string, accent: string) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#000000" stopOpacity="0.4" />
      <stop offset="0.45" stopColor="#000000" stopOpacity="0" />
      <stop offset="0.82" stopColor={accent} stopOpacity="0.08" />
      <stop offset="1" stopColor={accent} stopOpacity="0.22" />
    </linearGradient>
  );
}
/** 石積み: 横の目地と、段ごとにずれる縦の目地 */
function masonry(x0: number, x1: number, y0: number, y1: number, accent: string, course = 7, key = "") {
  const rows = Math.floor((y1 - y0) / course);
  const d = range(rows)
    .map((k) => {
      const y = y0 + (k + 1) * course;
      const offset = (k % 2) * 6;
      const joints = range(Math.floor((x1 - x0) / 12))
        .map((j) => `M${(x0 + offset + j * 12).toFixed(1)},${y - course} v${course}`)
        .join(" ");
      return `M${x0},${y} H${x1} ${joints}`;
    })
    .join(" ");
  return <path key={key} d={d} fill="none" stroke={accent} strokeWidth={0.3} opacity={0.08} />;
}
/** 灯る尖頭窓 */
const litWindow = (x: number, y: number, w: number, h: number, opacity: number, key: string | number) => (
  <path key={key} d={`M${x},${y + h} V${y + w / 2} A${w / 2},${w / 2} 0 0,1 ${x + w},${y + w / 2} V${y + h} Z`} fill="#ffd9a0" opacity={opacity} />
);

/**
 * 観測所: 石積みの円筒の胴に蛇腹と灯る窓、台座。円屋根には肋が走り、向きに合わせて割れた開口から望遠鏡が空へ突き出る
 */
function observatory(cx: number, base: number, r: number, angle: number, accent: string, key: string) {
  const a = (angle * Math.PI) / 180;
  const ux = Math.cos(a), uy = -Math.sin(a);
  const px = -uy, py = ux;
  const pivot = [cx, base - r * 0.42] as const;
  // 望遠鏡が円屋根の面を抜ける点までの長さ（円屋根の中心は (cx, base)）
  const exit = (() => {
    const ox = pivot[0] - cx, oy = pivot[1] - base;
    const b = ox * ux + oy * uy, c = ox * ox + oy * oy - r * r;
    return -b + Math.sqrt(b * b - c);
  })();
  const at = (along: number, side: number) => `${(pivot[0] + ux * along + px * side).toFixed(1)},${(pivot[1] + uy * along + py * side).toFixed(1)}`;
  const slitW = r * 0.56;
  const clip = `expedition-dome-${key}`;
  const glow = gradId(`slit-${key}`, accent);
  const shade = gradId(`cyl-${key}`, accent);
  const domePath = `M${cx - r},${base} A${r},${r} 0 0,1 ${cx + r},${base} Z`;
  const drumL = cx - r - 4, drumR = cx + r + 4;
  return (
    <g key={key}>
      <defs>
        <clipPath id={clip}>
          <path d={domePath} />
        </clipPath>
        {cylinderShade(shade, accent)}
        {/* 開口の奥の灯: 架台のあたりが明るく、空へ向かって薄れる */}
        <radialGradient id={glow} cx={pivot[0]} cy={pivot[1]} r={r * 1.1} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffd9a0" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#ffd9a0" stopOpacity="0.2" />
          <stop offset="1" stopColor="#ffd9a0" stopOpacity="0.06" />
        </radialGradient>
      </defs>
      {/* 胴と台座 */}
      <rect x={drumL} y={base} width={drumR - drumL} height={220 - base} />
      <rect x={drumL - 5} y={206} width={drumR - drumL + 10} height={14} />
      <rect x={drumL - 5} y={206} width={drumR - drumL + 10} height={0.8} fill={accent} opacity={0.22} />
      {masonry(drumL, drumR, base + 6, 206, accent, 7, `${key}-m`)}
      {range(3).map((k) => litWindow(cx - r * 0.55 + k * r * 0.5, base + 22, 6, 14, k === 1 ? 0.7 : 0.45, `${key}-w${k}`))}
      <rect x={drumL} y={base} width={drumR - drumL} height={220 - base} fill={`url(#${shade})`} />
      {/* 蛇腹 */}
      <rect x={drumL - 4} y={base - 3} width={drumR - drumL + 8} height={5} />
      <rect x={drumL - 4} y={base - 3} width={drumR - drumL + 8} height={0.8} fill={accent} opacity={0.35} />
      {/* 円屋根と肋 */}
      <path d={domePath} />
      <path d={domePath} fill={`url(#${shade})`} />
      <path
        d={range(5)
          .map((k) => {
            const f = (k + 1) / 6;
            const rx = r * Math.abs(1 - 2 * f);
            return `M${cx},${base - r} A${rx.toFixed(1)},${r} 0 0,${f < 0.5 ? 0 : 1} ${(cx + (f < 0.5 ? -1 : 1) * rx).toFixed(1)},${base}`;
          })
          .join(" ")}
        fill="none"
        stroke={accent}
        strokeWidth={0.45}
        opacity={0.14}
      />
      {/* 開口: 望遠鏡の向きにまっすぐ割れた扉。奥の灯が漏れ、縁が灯を受ける */}
      <g clipPath={`url(#${clip})`}>
        <path d={`M${at(-r * 0.5, slitW / 2)} L${at(r * 2, slitW / 2)} L${at(r * 2, -slitW / 2)} L${at(-r * 0.5, -slitW / 2)} Z`} fill="#05060f" />
        <path d={`M${at(-r * 0.5, slitW / 2)} L${at(r * 2, slitW / 2)} L${at(r * 2, -slitW / 2)} L${at(-r * 0.5, -slitW / 2)} Z`} fill={`url(#${glow})`} />
        <path d={`M${at(-r * 0.5, slitW / 2)} L${at(r * 2, slitW / 2)} M${at(-r * 0.5, -slitW / 2)} L${at(r * 2, -slitW / 2)}`} stroke={accent} strokeWidth={0.6} opacity={0.4} />
      </g>
      {/* 灯を背にした架台（フォーク）と、後ろの釣り合い錘 */}
      <path d={`M${pivot[0] - r * 0.05},${base} V${pivot[1] + r * 0.06} H${pivot[0] + r * 0.05} V${base} Z`} />
      <path d={`M${pivot[0] - r * 0.13},${pivot[1] + r * 0.08} V${pivot[1] - r * 0.04} H${pivot[0] - r * 0.09} V${pivot[1] + r * 0.04} H${pivot[0] + r * 0.09} V${pivot[1] - r * 0.04} H${pivot[0] + r * 0.13} V${pivot[1] + r * 0.08} Z`} />
      <path d={`M${at(-r * 0.42, r * 0.08)} L${at(-r * 0.26, r * 0.08)} L${at(-r * 0.26, -r * 0.08)} L${at(-r * 0.42, -r * 0.08)} Z`} />
      {/* 筒: 根元から先へわずかに太り、円屋根から少し突き出て遮光の覆いが付く。締め輪が灯を受ける */}
      <path d={`M${at(-r * 0.26, r * 0.075)} L${at(exit + r * 0.12, r * 0.1)} L${at(exit + r * 0.12, -r * 0.1)} L${at(-r * 0.26, -r * 0.075)} Z`} />
      <path d={`M${at(exit + r * 0.08, r * 0.125)} L${at(exit + r * 0.28, r * 0.13)} L${at(exit + r * 0.28, -r * 0.13)} L${at(exit + r * 0.08, -r * 0.125)} Z`} />
      <path d={`M${at(r * 0.1, r * 0.08)} L${at(r * 0.1, -r * 0.08)} M${at(exit * 0.6, r * 0.092)} L${at(exit * 0.6, -r * 0.092)}`} stroke="#ffd9a0" strokeWidth={0.6} opacity={0.45} />
      <circle cx={pivot[0]} cy={pivot[1]} r={r * 0.05} fill="#ffd9a0" opacity={0.5} />
    </g>
  );
}

/**
 * 螺旋階段の塔: わずかに膨らむ石の円筒。頂には持ち送りに載る胸壁、その上に石板葺きの円錐屋根と頂華。
 * 灯る窓は、内の螺旋階段に沿って昇る
 */
function spiralStairTower(cx: number, accent: string) {
  const shade = gradId("cyl-tower", accent);
  const half = (y: number) => 17 + Math.sin(((y - 52) / 168) * Math.PI) * 1.6;
  const body = (() => {
    const l: string[] = [], r: string[] = [];
    for (let y = 52; y <= 220; y += 8) {
      l.push(`${(cx - half(y)).toFixed(1)},${y}`);
      r.unshift(`${(cx + half(y)).toFixed(1)},${y}`);
    }
    return `M${l.join(" L")} L${r.join(" L")} Z`;
  })();
  return (
    <g>
      <defs>{cylinderShade(shade, accent)}</defs>
      <path d={body} />
      {masonry(cx - 18, cx + 18, 58, 220, accent, 6, "tower-m")}
      {/* 螺旋に沿って昇る窓 */}
      {range(8).map((k) => {
        const y = 196 - k * 18;
        const x = cx + Math.sin(k * 1.1) * 9 - 2;
        return litWindow(x, y, 4, 8, 0.4 + (k % 3) * 0.2, `tw${k}`);
      })}
      <path d={body} fill={`url(#${shade})`} />
      {/* 持ち送りと胸壁 */}
      <path d={`M${cx - 22},52 H${cx + 22} V44 H${cx - 22} Z`} />
      <path d={range(9).map((k) => `M${cx - 21 + k * 5},52 l1.2,4 h1.6 l1.2,-4 Z`).join(" ")} />
      <path d={range(5).map((k) => `M${cx - 22 + k * 10},44 v-5 h5 v5 Z`).join(" ")} />
      <rect x={cx - 22} y={44} width={44} height={0.8} fill={accent} opacity={0.3} />
      {/* 石板葺きの円錐屋根と頂華 */}
      <path d={`M${cx - 20},40 L${cx},2 L${cx + 20},40 Z`} />
      <path
        d={range(5)
          .map((k) => {
            const y = 10 + k * 6;
            const w = ((y - 2) / 38) * 20;
            return `M${(cx - w).toFixed(1)},${y} H${(cx + w).toFixed(1)}`;
          })
          .join(" ")}
        stroke={accent}
        strokeWidth={0.3}
        opacity={0.1}
      />
      <path d={`M${cx},2 L${cx + 20},40`} stroke={accent} strokeWidth={0.5} opacity={0.3} />
      <path d={`M${cx - 0.6},2 V-6 H${cx + 0.6} V2 Z`} />
      <circle cx={cx} cy={-1} r={1.6} />
      <circle cx={cx} cy={-7} r={1} fill={accent} opacity={0.8} />
    </g>
  );
}

function domes(accent: string) {
  const shade = gradId("cyl-wing", accent);
  return (
    <>
      <defs>{cylinderShade(shade, accent)}</defs>
      <rect x={0} y={212} width={480} height={8} />
      {observatory(96, 126, 44, 40, accent, "a")}
      {/* 渡りの回廊: 柱とアーチ、上に欄干 */}
      <path d="M150,220 V166 H210 V220 Z M156,220 V188 A9,9 0 0,1 174,188 V220 Z M186,220 V188 A9,9 0 0,1 204,188 V220 Z" fillRule="evenodd" />
      <path d="M148,166 H212 V161 H148 Z" />
      <path d={range(11).map((k) => `M${151 + k * 5.6},161 v-7 h2 v7 Z`).join(" ")} />
      <rect x={148} y={152} width={64} height={2.4} />
      <rect x={148} y={152} width={64} height={0.7} fill={accent} opacity={0.3} />
      {spiralStairTower(232, accent)}
      {/* 小さな観測所 */}
      {observatory(330, 156, 28, 62, accent, "b")}
      {/* 切妻屋根の棟と煙突 */}
      <path d="M372,220 V176 L402,154 L432,176 V220 Z" />
      <path d="M418,166 V146 H426 V172 Z" />
      <path d="M372,176 L402,154 L432,176" fill="none" stroke={accent} strokeWidth={0.6} opacity={0.3} />
      {masonry(372, 432, 182, 214, accent, 7, "wing-m")}
      {range(2).map((k) => litWindow(384 + k * 26, 188, 6, 12, 0.5, `ww${k}`))}
      <rect x={372} y={176} width={60} height={44} fill={`url(#${shade})`} />
      <path d="M432,220 V196 H480 V220 Z" />
    </>
  );
}

/**
 * 石の欄干: 刳形の付いた笠石と、台座の地覆の間に、ろくろで挽いた形（膨らみ・くびれ・輪）の小柱を並べる。
 * 間に笠と羽目板の付いた親柱を立て、月明かりが右の面と上の縁に差す。ところどころ風化した染み
 */
const BALUSTER = (x: number) => {
  const p = (dx: number, y: number) => `${(x + dx).toFixed(2)},${y}`;
  // 下から: 台・膨らみ・くびれ・輪・頭
  const right = [p(4.2, 54), p(4.2, 51), p(2.6, 50), p(5.4, 43), p(5.2, 36), p(2, 29), p(1.4, 25), p(3, 23.5), p(3, 21.5), p(1.8, 20.5), p(3.6, 18), p(3.6, 16)];
  const left = right.map((pt) => {
    const [px, py] = pt.split(",").map(Number);
    return `${(2 * x - px).toFixed(2)},${py}`;
  });
  return `M${p(-4.2, 54)} L${left.slice(1).join(" L")} L${right.slice().reverse().join(" L")} Z`;
};
function balustrade(accent: string) {
  const id = gradId("baluster", accent);
  const posts = [0, 100];
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000000" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor={accent} stopOpacity="0.25" />
        </linearGradient>
      </defs>
      {/* 地覆 */}
      <rect x={0} y={54} width={200} height={10} />
      <rect x={0} y={54} width={200} height={0.7} fill={accent} opacity={0.18} />
      {/* 小柱 */}
      {range(8).map((k) =>
        posts.map((px) => {
          const x = px + 18 + k * 10.5;
          return (
            <g key={`${px}-${k}`}>
              <path d={BALUSTER(x)} />
              <path d={BALUSTER(x)} fill={`url(#${id})`} />
            </g>
          );
        }),
      )}
      {/* 笠石: 上の笠と下の玉縁 */}
      <path d="M0,16 H200 V12 H0 Z" />
      <path d="M0,12 H200 V5 C200,3.6 198.6,3 197,3 H3 C1.4,3 0,3.6 0,5 Z" />
      <rect x={0} y={3} width={200} height={0.9} fill={accent} opacity={0.4} />
      <rect x={0} y={12} width={200} height={0.5} fill={accent} opacity={0.14} />
      {/* 親柱: 笠と羽目板 */}
      {posts.map((x) => (
        <g key={x}>
          <rect x={x + 1} y={2} width={14} height={62} />
          <rect x={x - 0.5} y={0} width={17} height={3.4} />
          <rect x={x + 3.5} y={20} width={9} height={28} fill="none" stroke={accent} strokeWidth={0.4} opacity={0.18} />
          <rect x={x + 1} y={2} width={14} height={62} fill={`url(#${id})`} />
          <rect x={x - 0.5} y={0} width={17} height={0.8} fill={accent} opacity={0.45} />
        </g>
      ))}
      {/* 風化の染み */}
      {[[40, 8, 6], [128, 58, 9], [172, 7, 5]].map(([x, y, w], k) => (
        <ellipse key={k} cx={x} cy={y} rx={w} ry={1.4} fill="#000000" opacity={0.25} />
      ))}
    </>
  );
}

/* ---------- STAGE 4 蒼氷の大回廊 ---------- */

/**
 * 時計塔: 控え壁のある四角い石の塔。上に鐘の見える鐘楼、四隅に小尖塔の付いた尖塔屋根。
 * 時計の文字盤にはローマ数字と目盛り、飾りの付いた針が大沈黙の夜の時刻で止まり、凍ってひびが走る。
 * 張り出しと屋根には雪が積もり、縁から氷柱が下がる
 */
const CLOCK_NUMERALS = ["XII", "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
const CLOCK_TOWERS = [
  { cx: 70, w: 40, base: 260, top: 92, time: [10, 8], haze: 0.55 },
  { cx: 214, w: 64, base: 260, top: 40, time: [11, 58], haze: 0 },
  { cx: 356, w: 46, base: 260, top: 76, time: [3, 41], haze: 0.35 },
];
const clockPoint = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
};
/** 飾りの付いた針: 根元に釣り合いの輪、先に槍の穂 */
function clockHandPath(cx: number, cy: number, deg: number, len: number, width: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  const ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
  const at = (along: number, side: number) => `${(cx + ux * along + px * side).toFixed(2)},${(cy + uy * along + py * side).toFixed(2)}`;
  return `M${at(-len * 0.2, width * 0.5)} L${at(len * 0.72, width * 0.4)} L${at(len * 0.78, width * 1.6)} L${at(len, 0)} L${at(len * 0.78, -width * 1.6)} L${at(len * 0.72, -width * 0.4)} L${at(-len * 0.2, -width * 0.5)} Z`;
}
function clockFace(cx: number, cy: number, r: number, [h, m]: number[], accent: string, key: string) {
  const ticks = range(60)
    .map((k) => {
      const [x1, y1] = clockPoint(cx, cy, r * (k % 5 === 0 ? 0.84 : 0.9), k * 6);
      const [x2, y2] = clockPoint(cx, cy, r * 0.95, k * 6);
      return `M${x1.toFixed(2)},${y1.toFixed(2)} L${x2.toFixed(2)},${y2.toFixed(2)}`;
    })
    .join(" ");
  return (
    <g key={key}>
      {/* 文字盤の枠（石の縁）と、凍った盤面 */}
      <circle cx={cx} cy={cy} r={r * 1.12} />
      <circle cx={cx} cy={cy} r={r} fill={accent} opacity={0.12} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={accent} strokeWidth={0.7} opacity={0.55} />
      <circle cx={cx} cy={cy} r={r * 0.62} fill="none" stroke={accent} strokeWidth={0.3} opacity={0.3} />
      <path d={ticks} stroke={accent} strokeWidth={0.35} opacity={0.6} />
      {r > 14 &&
        CLOCK_NUMERALS.map((n, k) => {
          const [x, y] = clockPoint(cx, cy, r * 0.73, k * 30);
          return (
            <text key={n} x={x} y={y} fontSize={r * 0.16} fill={accent} opacity={0.75} textAnchor="middle" dominantBaseline="central" fontFamily="serif" transform={`rotate(${k * 30} ${x} ${y})`}>
              {n}
            </text>
          );
        })}
      {/* 止まった針 */}
      <path d={clockHandPath(cx, cy, (h % 12) * 30 + m / 2, r * 0.52, r * 0.035)} fill={accent} opacity={0.85} />
      <path d={clockHandPath(cx, cy, m * 6, r * 0.8, r * 0.025)} fill={accent} opacity={0.85} />
      <circle cx={cx} cy={cy} r={r * 0.06} fill={accent} />
      {/* 凍ってできたひび */}
      <path d={`M${cx - r * 0.7},${cy - r * 0.2} L${cx - r * 0.3},${cy - r * 0.05} L${cx - r * 0.1},${cy + r * 0.25} L${cx + r * 0.35},${cy + r * 0.4} M${cx - r * 0.3},${cy - r * 0.05} L${cx - r * 0.2},${cy - r * 0.42}`} fill="none" stroke="#ffffff" strokeWidth={0.35} opacity={0.4} />
    </g>
  );
}
/** 張り出しの縁から下がる氷柱 */
function icicleRow(x0: number, x1: number, y: number, seed: number) {
  const n = Math.max(3, Math.floor((x1 - x0) / 4));
  return range(n)
    .map((k) => {
      const x = x0 + ((k + 0.5) * (x1 - x0)) / n;
      const len = 2 + rand(seed * 17 + k, 70) ** 2 * 9;
      return `M${(x - 1.1).toFixed(1)},${y} L${x.toFixed(1)},${(y + len).toFixed(1)} L${(x + 1.1).toFixed(1)},${y} Z`;
    })
    .join(" ");
}
function clocktower(accent: string) {
  return (
    <>
      {/* 塔をつなぐ雪の積もった胸壁 */}
      <rect x={0} y={232} width={420} height={28} />
      <path d={range(28).map((k) => `M${k * 15},232 v-6 h8 v6 Z`).join(" ")} />
      <path d={range(28).map((k) => `M${k * 15},226 h8`).join(" ")} stroke="#ffffff" strokeWidth={1.2} opacity={0.3} />
      {CLOCK_TOWERS.map(({ cx, w, base, top, time, haze }, i) => {
        const l = cx - w / 2, r = cx + w / 2;
        const belfryTop = top;
        const belfryBottom = top + w * 0.7;
        const clockY = belfryBottom + w * 0.62;
        const faceR = w * 0.36;
        const spireTop = top - w * 1.25;
        return (
          <g key={i} opacity={1 - haze * 0.35}>
            {/* 控え壁と塔の胴 */}
            <path d={`M${l - 6},${base} V${base - 60} L${l - 2},${base - 76} V${base} Z M${r + 6},${base} V${base - 60} L${r + 2},${base - 76} V${base} Z`} />
            <rect x={l} y={belfryTop} width={w} height={base - belfryTop} />
            {/* 鐘楼: 尖頭の開口から鐘がのぞく */}
            {[0.28, 0.72].map((f, k) => {
              const ox = l + w * f;
              const ow = w * 0.22;
              return (
                <g key={k}>
                  <path d={`M${ox - ow / 2},${belfryBottom - 4} V${belfryTop + w * 0.28} Q${ox - ow / 2},${belfryTop + w * 0.12} ${ox},${belfryTop + w * 0.08} Q${ox + ow / 2},${belfryTop + w * 0.12} ${ox + ow / 2},${belfryTop + w * 0.28} V${belfryBottom - 4} Z`} fill={accent} opacity={0.14} />
                  <path d={`M${ox - ow * 0.3},${belfryTop + w * 0.42} Q${ox - ow * 0.3},${belfryTop + w * 0.3} ${ox},${belfryTop + w * 0.28} Q${ox + ow * 0.3},${belfryTop + w * 0.3} ${ox + ow * 0.3},${belfryTop + w * 0.42} L${ox + ow * 0.38},${belfryTop + w * 0.46} H${ox - ow * 0.38} Z`} />
                </g>
              );
            })}
            {/* 張り出し（蛇腹）と雪、氷柱 */}
            {[belfryTop, belfryBottom, clockY + faceR * 1.5].map((y, k) => (
              <g key={k}>
                <rect x={l - 3} y={y - 2} width={w + 6} height={4} />
                <rect x={l - 3} y={y - 3.2} width={w + 6} height={1.6} fill="#ffffff" opacity={0.4} />
                <path d={icicleRow(l - 2, r + 2, y + 2, i * 5 + k)} fill="#dff1ff" opacity={0.5} />
              </g>
            ))}
            {/* 文字盤の上の小さな破風と雪 */}
            <path d={`M${cx - faceR * 1.3},${clockY - faceR * 1.15} L${cx},${clockY - faceR * 1.75} L${cx + faceR * 1.3},${clockY - faceR * 1.15} Z`} />
            <path d={`M${cx - faceR * 1.3},${clockY - faceR * 1.15} L${cx},${clockY - faceR * 1.75} L${cx + faceR * 1.3},${clockY - faceR * 1.15}`} fill="none" stroke="#ffffff" strokeWidth={1.1} opacity={0.35} />
            {clockFace(cx, clockY, faceR, time, accent, `f${i}`)}
            {/* 下の階の、淡く灯る細い窓 */}
            {range(Math.max(1, Math.floor((base - (clockY + faceR * 1.5) - 20) / 26))).map((k) => (
              <path key={k} d={`M${cx - 2},${clockY + faceR * 1.5 + 22 + k * 26} v-8 a2,2 0 0,1 4,0 v8 z`} fill={accent} opacity={0.22} />
            ))}
            {/* 尖塔屋根と四隅の小尖塔、頂の十字飾り、屋根の雪 */}
            <path d={`M${l - 2},${belfryTop} L${cx},${spireTop} L${r + 2},${belfryTop} Z`} />
            <path d={`M${cx},${spireTop} L${r + 2},${belfryTop}`} stroke="#ffffff" strokeWidth={0.9} opacity={0.32} />
            {[l + 2, r - 2].map((x, k) => (
              <path key={k} d={`M${x - 3},${belfryTop} L${x},${belfryTop - w * 0.42} L${x + 3},${belfryTop} Z`} />
            ))}
            <path d={`M${cx - 0.7},${spireTop} V${spireTop - 8} H${cx + 0.7} V${spireTop} Z M${cx - 3},${spireTop - 5} H${cx + 3} V${spireTop - 3.8} H${cx - 3} Z`} />
            {/* 灯を受ける右の縁 */}
            <path d={`M${r},${belfryTop} V${base}`} stroke={accent} strokeWidth={0.6} opacity={0.25} />
          </g>
        );
      })}
    </>
  );
}

/**
 * 氷の柱廊: 台座・柱身・柱頭のある石の柱を、透き通る氷が包む。氷の中には、凍った誰かの一時間が面取りした結晶として灯る。
 * 柱と柱は二重の刳形の尖頭アーチで結ばれ、上に雪が積もり、内から氷柱が下がる
 */
const CLOISTER_PILLARS = [60, 240];
/** 尖頭アーチの帯（外の弧と内の弧のあいだ） */
function gothicArch(x1: number, x2: number, spring: number, thick: number) {
  const mid = (x1 + x2) / 2, span = x2 - x1;
  const apex = spring - span * 0.5;
  return `M${x1},${spring} Q${x1},${apex + span * 0.12} ${mid},${apex} Q${x2},${apex + span * 0.12} ${x2},${spring} L${x2 - thick},${spring} Q${x2 - thick},${apex + span * 0.16} ${mid},${apex + thick * 1.2} Q${x1 + thick},${apex + span * 0.16} ${x1 + thick},${spring} Z`;
}
/** アーチの内の弧に沿って下がる氷柱 */
function archIcicles(x1: number, x2: number, spring: number, thick: number, seed: number) {
  const mid = (x1 + x2) / 2, span = x2 - x1;
  const apex = spring - span * 0.5 + thick * 1.2;
  const pts: string[] = [];
  for (let k = 1; k < 14; k++) {
    const t = k / 14;
    // 内の弧の上の点（二次ベジェ）
    const half = t < 0.5;
    const u = half ? t * 2 : (t - 0.5) * 2;
    const [ax, ay, cxp, cyp, bx, by] = half
      ? [x1 + thick, spring, x1 + thick, apex + span * 0.16 - thick * 1.2, mid, apex]
      : [mid, apex, x2 - thick, apex + span * 0.16 - thick * 1.2, x2 - thick, spring];
    const x = (1 - u) ** 2 * ax + 2 * (1 - u) * u * cxp + u * u * bx;
    const y = (1 - u) ** 2 * ay + 2 * (1 - u) * u * cyp + u * u * by;
    const len = 2 + rand(seed * 31 + k, 75) ** 2 * 12;
    pts.push(`M${(x - 1).toFixed(1)},${y.toFixed(1)} L${x.toFixed(1)},${(y + len).toFixed(1)} L${(x + 1).toFixed(1)},${y.toFixed(1)} Z`);
  }
  return pts.join(" ");
}
function icepillars(accent: string) {
  const id = gradId("ice", accent);
  // アーチの頂が絵の上で切れないよう、柱頭（アーチの起点）を低めに置く
  const spring = 96, thick = 8;
  const arches: [number, number][] = [
    [-120 + 20, 60 - 20],
    [60 + 20, 240 - 20],
    [240 + 20, 420 - 20],
  ];
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={accent} stopOpacity="0.1" />
          <stop offset="0.4" stopColor={accent} stopOpacity="0.22" />
          <stop offset="0.75" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="1" stopColor={accent} stopOpacity="0.32" />
        </linearGradient>
        <radialGradient id={`${id}-core`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="0.25" stopColor={accent} stopOpacity="0.6" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* 尖頭アーチ（二重の刳形）と、上に積もる雪、内から下がる氷柱 */}
      {arches.map(([x1, x2], k) => {
        const mid = (x1 + x2) / 2, span = x2 - x1, apex = spring - span * 0.5;
        return (
          <g key={k}>
            <path d={gothicArch(x1, x2, spring, thick)} />
            <path d={`M${x1 + thick * 0.5},${spring} Q${x1 + thick * 0.5},${apex + span * 0.14} ${mid},${apex + thick * 0.6} Q${x2 - thick * 0.5},${apex + span * 0.14} ${x2 - thick * 0.5},${spring}`} fill="none" stroke={accent} strokeWidth={0.4} opacity={0.2} />
            <path d={`M${x1},${spring} Q${x1},${apex + span * 0.12} ${mid},${apex} Q${x2},${apex + span * 0.12} ${x2},${spring}`} fill="none" stroke="#ffffff" strokeWidth={1.6} opacity={0.32} />
            <path d={archIcicles(x1, x2, spring, thick, k)} fill="#dff4ff" opacity={0.55} />
          </g>
        );
      })}
      {CLOISTER_PILLARS.map((x, i) => {
        const cy = spring + 46 + rand(i, 31) * 30;
        // 氷の輪郭: 柱より一回り太く、縁が不揃い
        const sheath = (() => {
          const l: string[] = [], r: string[] = [];
          for (let y = spring + 8; y <= 206; y += 12) {
            const jl = (rand(i * 50 + y, 76) - 0.5) * 3, jr = (rand(i * 50 + y, 77) - 0.5) * 3;
            l.push(`${(x - 17 + jl).toFixed(1)},${y}`);
            r.unshift(`${(x + 17 + jr).toFixed(1)},${y}`);
          }
          return `M${l.join(" L")} L${r.join(" L")} Z`;
        })();
        const prism = (dx: number, dy: number, s: number) =>
          `M${x + dx},${cy + dy - 10 * s} L${x + dx + 6 * s},${cy + dy - 5 * s} L${x + dx + 6 * s},${cy + dy + 6 * s} L${x + dx},${cy + dy + 11 * s} L${x + dx - 6 * s},${cy + dy + 6 * s} L${x + dx - 6 * s},${cy + dy - 5 * s} Z`;
        return (
          <g key={i}>
            {/* 台座・柱身・柱頭 */}
            <path d={`M${x - 24},220 V210 H${x - 20} V204 H${x + 20} V210 H${x + 24} V220 Z`} />
            <rect x={x - 12} y={spring} width={24} height={206 - spring} />
            <path d={`M${x - 22},${spring - 8} H${x + 22} V${spring - 4} L${x + 15},${spring + 4} H${x - 15} L${x - 22},${spring - 4} Z`} />
            <rect x={x - 23} y={spring - 9.6} width={46} height={1.8} fill="#ffffff" opacity={0.42} />
            {/* 透き通る氷と、縦の照り返し */}
            <path d={sheath} fill={`url(#${id})`} />
            <path d={sheath} fill="none" stroke="#e8f8ff" strokeWidth={0.5} opacity={0.4} />
            <path d={`M${x + 9},${spring + 12} L${x + 10},196 M${x + 12.5},${spring + 26} L${x + 13},${spring + 70} M${x - 10},${spring + 34} L${x - 9.5},${spring + 80}`} stroke="#ffffff" strokeWidth={0.6} opacity={0.25} />
            {/* 柱頭から垂れる雫と氷柱 */}
            <path d={icicleRow(x - 20, x + 20, spring + 4, i + 20)} fill="#dff4ff" opacity={0.55} />
            {/* 氷の中に封じられた一時間の結晶 */}
            <circle cx={x} cy={cy} r={22} fill={`url(#${id}-core)`} opacity={0.55} />
            <path d={prism(0, 0, 1)} fill={accent} opacity={0.45} />
            <path d={`M${x},${cy - 10} L${x + 6},${cy - 5} L${x + 6},${cy + 6} L${x},${cy + 11} Z`} fill="#ffffff" opacity={0.25} />
            <path d={prism(0, 0, 1)} fill="none" stroke="#ffffff" strokeWidth={0.5} opacity={0.6} />
            <path d={`M${x},${cy - 10} V${cy + 11}`} stroke="#ffffff" strokeWidth={0.35} opacity={0.5} />
            <path d={sparklePath(x + 3, cy - 7, 1)} fill="#ffffff" opacity={0.9} />
          </g>
        );
      })}
    </>
  );
}

/** 氷の結晶の群れ: [根元の中心, 高さ, 幅, 傾き] */
const CRYSTAL_SHARDS: [number, number, number, number][] = [
  [40, 96, 18, -10], [58, 150, 24, 3], [78, 108, 18, 12], [92, 64, 12, 18],
  [190, 70, 14, -14], [206, 124, 20, -2], [224, 90, 16, 10],
  [318, 112, 18, -8], [338, 172, 26, 2], [360, 120, 20, 9], [376, 70, 12, 16],
];
/** 面取りした結晶: 暗い面と、灯を受けて明るい面。稜線と縁に光、先にきらめき */
function crystalShard([cx, h, w, tilt]: (typeof CRYSTAL_SHARDS)[number], i: number, accent: string) {
  const p = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`;
  const bl = [cx - w / 2, 200], br = [cx + w / 2, 200];
  const sl = [cx - w / 2 + tilt * 0.6, 200 - h * 0.8], sr = [cx + w / 2 + tilt * 0.6, 200 - h * 0.8];
  const tip = [cx + tilt, 200 - h];
  const mid = [cx + w * 0.08, 200];
  const ridgeTop = [cx + tilt * 0.62 + w * 0.06, 200 - h * 0.82];
  const id = gradId("facet", accent);
  return (
    <g key={i}>
      <path d={`M${p(bl[0], bl[1])} L${p(sl[0], sl[1])} L${p(tip[0], tip[1])} L${p(ridgeTop[0], ridgeTop[1])} L${p(mid[0], mid[1])} Z`} />
      <path d={`M${p(mid[0], mid[1])} L${p(ridgeTop[0], ridgeTop[1])} L${p(tip[0], tip[1])} L${p(sr[0], sr[1])} L${p(br[0], br[1])} Z`} />
      <path d={`M${p(mid[0], mid[1])} L${p(ridgeTop[0], ridgeTop[1])} L${p(tip[0], tip[1])} L${p(sr[0], sr[1])} L${p(br[0], br[1])} Z`} fill={`url(#${id})`} />
      <path d={`M${p(sl[0], sl[1])} L${p(tip[0], tip[1])} L${p(sr[0], sr[1])}`} fill="none" stroke={accent} strokeWidth={0.6} opacity={0.55} strokeLinejoin="round" />
      <path d={`M${p(mid[0], mid[1])} L${p(ridgeTop[0], ridgeTop[1])} L${p(tip[0], tip[1])}`} fill="none" stroke="#ffffff" strokeWidth={0.4} opacity={0.3} />
      {h > 100 && <path d={sparklePath(tip[0], tip[1] + 2, 1.1)} fill="#ffffff" opacity={0.8} />}
    </g>
  );
}
function crystalField(accent: string) {
  const id = gradId("facet", accent);
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.42" />
          <stop offset="0.6" stopColor={accent} stopOpacity="0.14" />
          <stop offset="1" stopColor={accent} stopOpacity="0.04" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="1" r="0.6">
          <stop offset="0" stopColor={accent} stopOpacity="0.35" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* 群れの根元の光 */}
      {[64, 208, 344].map((x) => (
        <ellipse key={x} cx={x} cy={200} rx={60} ry={36} fill={`url(#${id}-glow)`} />
      ))}
      {CRYSTAL_SHARDS.map((s, i) => crystalShard(s, i, accent))}
      {/* 根元に積もる霜 */}
      <path d="M0,200 C20,192 40,190 60,194 C80,188 110,190 130,196 C160,192 180,188 210,193 C240,190 270,194 300,192 C330,186 360,190 400,196 L400,200 Z" />
      <path d="M0,200 C20,192 40,190 60,194 C80,188 110,190 130,196 C160,192 180,188 210,193 C240,190 270,194 300,192 C330,186 360,190 400,196" fill="none" stroke="#ffffff" strokeWidth={0.5} opacity={0.25} />
    </>
  );
}

/* ---------- STAGE 5 紅蓮の魔導炉 ---------- */

/** 炉の火のグラデーション: 下ほど白く熱く、上へ熾火の色に沈む */
function fireGradient(id: string, accent: string) {
  return (
    <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stopColor="#fff4d6" />
      <stop offset="0.3" stopColor="#ffc87a" />
      <stop offset="0.7" stopColor={accent} />
      <stop offset="1" stopColor={accent} stopOpacity="0.45" />
    </linearGradient>
  );
}

/**
 * 煙: 口から立ちのぼり、右へ流れながら広がって薄れる。根元は炉の火に下から照らされて赤く、上は灰色の煙になる。
 * ぼかしの効果は使わず、柔らかな放射グラデーションの楕円を重ねて描く
 */
function smokePlume(cx: number, top: number, s: number, accent: string, key: string) {
  const smoke = `expedition-smoke-${key}`;
  const lit = `expedition-smoke-lit-${key}`;
  const puffs = range(11).map((k) => {
    const t = k / 10;
    return {
      x: cx + t * t * 70 * s + Math.sin(k * 1.9) * 2.5 * s,
      y: top - 3 - t * 100 * s,
      rx: (4 + t * 30) * s,
      ry: (3.2 + t * 20) * s,
      o: 0.9 - t * 0.75,
    };
  });
  return (
    <g key={key}>
      <defs>
        <radialGradient id={smoke}>
          <stop offset="0" stopColor="#8a6656" stopOpacity="0.5" />
          <stop offset="0.55" stopColor="#6a4a40" stopOpacity="0.22" />
          <stop offset="1" stopColor="#5e4038" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={lit}>
          <stop offset="0" stopColor={accent} stopOpacity="0.45" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      {puffs.map((p, k) => (
        <ellipse key={k} cx={+p.x.toFixed(1)} cy={+p.y.toFixed(1)} rx={+p.rx.toFixed(1)} ry={+p.ry.toFixed(1)} fill={`url(#${smoke})`} opacity={+p.o.toFixed(2)} />
      ))}
      {puffs.slice(0, 4).map((p, k) => (
        <ellipse key={`l${k}`} cx={+p.x.toFixed(1)} cy={+(p.y + p.ry * 0.3).toFixed(1)} rx={+(p.rx * 0.9).toFixed(1)} ry={+(p.ry * 0.7).toFixed(1)} fill={`url(#${lit})`} opacity={0.8 - k * 0.18} />
      ))}
    </g>
  );
}

/**
 * 煙突: 台座の上に、上へわずかに細る煉瓦の筒。鉄の帯を巻き、頂は段々に張り出す笠石で、口の縁が炉の火に照る
 */
function smokestack(cx: number, top: number, w0: number, w1: number, accent: string, key: string) {
  const plinth = 22;
  const body = `M${cx - w0 / 2},${220 - plinth} L${cx - w1 / 2},${top} H${cx + w1 / 2} L${cx + w0 / 2},${220 - plinth} Z`;
  const half = (y: number) => w1 / 2 + ((w0 - w1) / 2) * ((y - top) / (220 - plinth - top));
  const clip = `expedition-stack-${key}`;
  const shade = gradId(`cyl-stack-${key}`, accent);
  const bands = range(Math.floor((200 - plinth - top) / 30)).map((k) => top + 26 + k * 30);
  return (
    <g key={key}>
      <defs>
        <clipPath id={clip}>
          <path d={body} />
        </clipPath>
        {cylinderShade(shade, accent)}
      </defs>
      {/* 台座: 刳形の付いた四角い基壇 */}
      <rect x={cx - w0 / 2 - 5} y={220 - plinth} width={w0 + 10} height={plinth} />
      <rect x={cx - w0 / 2 - 7} y={220 - plinth - 3} width={w0 + 14} height={4} />
      <rect x={cx - w0 / 2 - 7} y={220 - plinth - 3} width={w0 + 14} height={0.6} fill={accent} opacity={0.4} />
      {masonry(cx - w0 / 2 - 5, cx + w0 / 2 + 5, 220 - plinth, 220, accent, 7, `${key}-p`)}
      <path d={body} />
      <g clipPath={`url(#${clip})`}>{masonry(cx - w0 / 2, cx + w0 / 2, top, 220 - plinth, accent, 4, `${key}-m`)}</g>
      <path d={body} fill={`url(#${shade})`} />
      {bands.map((y, k) => (
        <g key={k}>
          <rect x={+(cx - half(y) - 0.8).toFixed(1)} y={y} width={+(half(y) * 2 + 1.6).toFixed(1)} height={1.8} />
          <rect x={+(cx - half(y) - 0.8).toFixed(1)} y={y} width={+(half(y) * 2 + 1.6).toFixed(1)} height={0.5} fill={accent} opacity={0.3} />
        </g>
      ))}
      {/* 段々に張り出す笠石 */}
      <path d={`M${cx - w1 / 2},${top + 5} H${cx - w1 / 2 - 1.5} V${top + 2.5} H${cx - w1 / 2 - 3} V${top - 2} H${cx + w1 / 2 + 3} V${top + 2.5} H${cx + w1 / 2 + 1.5} V${top + 5} H${cx + w1 / 2} Z`} />
      <rect x={cx - w1 / 2 - 3} y={top - 2} width={w1 + 6} height={0.6} fill={accent} opacity={0.5} />
      <rect x={cx + w1 / 2 + 1.5} y={top + 2.5} width={1.5} height={2.5} fill={accent} opacity={0.25} />
      <ellipse cx={cx} cy={top - 2} rx={w1 / 2} ry={0.9} fill="#ffd9a0" opacity={0.6} className="expedition-flame" />
      <path d={`M${cx + w1 / 2},${top + 5} L${cx + w0 / 2},${220 - plinth}`} stroke={accent} strokeWidth={0.6} opacity={0.3} />
    </g>
  );
}

/** 窓の灯: 下ほど明るい */
function windowGlow(id: string, accent: string) {
  return (
    <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stopColor="#ffd9a0" stopOpacity="0.85" />
      <stop offset="0.6" stopColor="#ffb878" stopOpacity="0.6" />
      <stop offset="1" stopColor={accent} stopOpacity="0.4" />
    </linearGradient>
  );
}
/** 工場の縦長の窓: 半円の頭に、鉄の桟の格子。窓台と、ところどころ灯の落ちた硝子 */
function factoryWindow(x: number, y: number, w: number, h: number, glow: string, accent: string, key: string, seed: number) {
  const r = w / 2;
  const d = `M${x},${y + h} V${y + r} A${r},${r} 0 0,1 ${x + w},${y + r} V${y + h} Z`;
  const cols = 3, rows = Math.max(2, Math.round((h - r) / 6));
  const bars = [
    ...range(cols - 1).map((k) => `M${(x + (w * (k + 1)) / cols).toFixed(1)},${y + 1} V${y + h}`),
    ...range(rows).map((k) => `M${x},${(y + r + ((h - r) * k) / rows).toFixed(1)} H${x + w}`),
  ].join(" ");
  // 灯の落ちた硝子を一枚か二枚
  const dark = range(2).map((k) => ({ c: Math.floor(rand(seed + k, 81) * cols), r: 1 + Math.floor(rand(seed + k, 82) * (rows - 1)) }));
  return (
    <g key={key}>
      <path d={d} fill={`url(#${glow})`} className="expedition-flame" />
      {dark.map(({ c, r: row }, k) => (
        <rect key={k} x={+(x + (w * c) / cols).toFixed(1)} y={+(y + r + ((h - r) * row) / rows).toFixed(1)} width={+(w / cols).toFixed(1)} height={+((h - r) / rows).toFixed(1)} opacity={0.75} />
      ))}
      <path d={bars} stroke="currentColor" strokeWidth={0.8} />
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.2} />
      <rect x={x - 1.5} y={y + h} width={w + 3} height={2} />
      <rect x={x - 1.5} y={y + h} width={w + 3} height={0.5} fill={accent} opacity={0.35} />
    </g>
  );
}

/** 錬金炉の塔（アタノール）: 石の円筒に、肋の走る丸屋根と煙道。灯る細い窓と、熾火の色の丸窓 */
function athanorTower(cx: number, glow: string, accent: string) {
  const shade = gradId("cyl-athanor", accent);
  const l = cx - 17, r = cx + 17;
  return (
    <g>
      <defs>{cylinderShade(shade, accent)}</defs>
      {/* 煙道と笠 */}
      <rect x={cx - 3} y={46} width={6} height={38} />
      <rect x={cx - 3.8} y={60} width={7.6} height={1.6} />
      <path d={`M${cx - 6.5},47 H${cx + 6.5} L${cx + 3.5},42 H${cx - 3.5} Z`} />
      <ellipse cx={cx} cy={42} rx={3.4} ry={0.9} fill="#ffd9a0" opacity={0.55} className="expedition-flame" />
      {/* 丸屋根と肋、頂の小さな灯籠 */}
      <path d={`M${l - 2},100 A19,22 0 0,1 ${r + 2},100 Z`} />
      <path
        d={[-0.6, -0.25, 0.1, 0.45, 0.8].map((f) => `M${cx},78 Q${(cx + f * 15).toFixed(1)},${82} ${(cx + f * 19).toFixed(1)},100`).join(" ")}
        fill="none"
        stroke={accent}
        strokeWidth={0.35}
        opacity={0.2}
      />
      <path d={`M${cx},78 A19,22 0 0,1 ${r + 2},100`} fill="none" stroke={accent} strokeWidth={0.7} opacity={0.35} />
      {/* 胴 */}
      <rect x={l} y={100} width={34} height={120} />
      {masonry(l, r, 104, 220, accent, 6, "athanor-m")}
      <circle cx={cx} cy={128} r={7.5} />
      <circle cx={cx} cy={128} r={5.4} fill={`url(#${glow})`} className="expedition-flame" />
      <path d={`M${cx - 5.4},128 H${cx + 5.4} M${cx},122.6 V133.4`} stroke="currentColor" strokeWidth={0.8} />
      {factoryWindow(cx - 9, 150, 5, 14, glow, accent, "at1", 11)}
      {factoryWindow(cx + 4, 176, 5, 14, glow, accent, "at2", 13)}
      <rect x={l} y={100} width={34} height={120} fill={`url(#${shade})`} />
      {/* 蛇腹 */}
      <rect x={l - 3} y={98} width={40} height={4} />
      <rect x={l - 3} y={98} width={40} height={0.7} fill={accent} opacity={0.4} />
    </g>
  );
}

/**
 * 奥の鋳造所（上に 80 の余白を取り、煙を描く）: 台座に立つ煉瓦の煙突から煙が流れ、
 * 瓦葺きの切妻の炉の館（妻の丸窓、桟の入った縦長の窓、白く燃える炉口と鉄格子、棟の越屋根）、
 * 溶けた星の流れる石の水道橋（迫石のアーチ、端の樋から坩堝へ注ぐ）、丸屋根の錬金炉の塔。どれも炉心の灯を受けて右が明るい
 */
function foundry(accent: string) {
  const fire = gradId("foundry-fire", accent);
  const glow = gradId("foundry-window", accent);
  const hallShade = gradId("cyl-hall", accent);
  const pour = gradId("foundry-pour", accent);
  const mouth = "M144,220 V184 A23,23 0 0,1 190,184 V220 Z";
  const roofL = 70, roofR = 264, apex = 167, apexY = 84, eave = 136;
  const roofAt = (y: number) => ((y - apexY) / (eave - apexY)) * (apex - roofL);
  return (
    <>
      <defs>
        {fireGradient(fire, accent)}
        {windowGlow(glow, accent)}
        {cylinderShade(hallShade, accent)}
        <linearGradient id={pour} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd9a0" stopOpacity="0.9" />
          <stop offset="1" stopColor={accent} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {smokePlume(40, 22, 0.9, accent, "plume-a")}
      {smokePlume(302, 60, 0.65, accent, "plume-b")}
      <rect x={0} y={212} width={480} height={8} />
      {smokestack(40, 22, 22, 15, accent, "a")}
      {smokestack(302, 60, 17, 12, accent, "b")}

      {/* 炉の館: 瓦葺きの切妻屋根、破風板、棟の越屋根 */}
      <path d={`M${roofL},${eave} L${apex},${apexY} L${roofR},${eave} Z`} />
      <path
        d={range(7)
          .map((k) => {
            const y = apexY + 6 + k * 7;
            const dx = roofAt(y);
            return `M${(apex - dx).toFixed(1)},${y} H${(apex + dx).toFixed(1)}`;
          })
          .join(" ")}
        stroke={accent}
        strokeWidth={0.3}
        opacity={0.12}
      />
      <path d={`M${roofL - 3},${eave + 2} L${apex},${apexY - 2} L${roofR + 3},${eave + 2}`} fill="none" stroke="currentColor" strokeWidth={3} />
      <path d={`M${apex},${apexY - 3.4} L${roofR + 3},${eave + 0.6}`} stroke={accent} strokeWidth={0.7} opacity={0.4} />
      <path d={`M${apex - 9},${apexY + 4} V${apexY - 12} H${apex + 9} V${apexY + 4} Z`} />
      <path d={`M${apex - 12},${apexY - 12} L${apex},${apexY - 19} L${apex + 12},${apexY - 12} Z`} />
      <path d={`M${apex},${apexY - 19} L${apex + 12},${apexY - 12}`} stroke={accent} strokeWidth={0.5} opacity={0.4} />
      {range(3).map((k) => (
        <rect key={k} x={apex - 6.6 + k * 4.8} y={apexY - 9} width={3} height={9} fill={`url(#${glow})`} className="expedition-flame" />
      ))}
      {/* 妻の丸窓 */}
      <circle cx={apex} cy={113} r={10} />
      <circle cx={apex} cy={113} r={8} fill={`url(#${glow})`} className="expedition-flame" />
      <path d={range(4).map((k) => { const a = (k * Math.PI) / 4; return `M${(apex + Math.cos(a) * 8).toFixed(1)},${(113 + Math.sin(a) * 8).toFixed(1)} L${(apex - Math.cos(a) * 8).toFixed(1)},${(113 - Math.sin(a) * 8).toFixed(1)}`; }).join(" ")} stroke="currentColor" strokeWidth={0.8} />
      <circle cx={apex} cy={113} r={3} />
      <circle cx={apex} cy={113} r={8} fill="none" stroke="currentColor" strokeWidth={1.4} />
      {/* 壁 */}
      <rect x={78} y={136} width={178} height={84} />
      {masonry(78, 256, 138, 220, accent, 6, "hall-m")}
      {[86, 106, 214, 234].map((x, k) => factoryWindow(x, 148, 12, 36, glow, accent, `hw${k}`, k * 7))}
      {/* 炉口: 白く燃える火と、前の鉄格子、迫石のアーチと要石。前の地面に火が映る */}
      <ellipse cx={167} cy={219} rx={48} ry={6} fill={accent} opacity={0.25} />
      <path d={mouth} fill={`url(#${fire})`} className="expedition-flame" />
      <path d={range(6).map((k) => `M${149.5 + k * 7},162 V220`).join(" ")} stroke="currentColor" strokeWidth={1.6} />
      <path d="M144,200 H190" stroke="currentColor" strokeWidth={1.2} />
      <path
        d={range(11)
          .map((k) => {
            const a = Math.PI - (k * Math.PI) / 10;
            return `M${(167 + Math.cos(a) * 23).toFixed(1)},${(184 - Math.sin(a) * 23).toFixed(1)} L${(167 + Math.cos(a) * 30).toFixed(1)},${(184 - Math.sin(a) * 30).toFixed(1)}`;
          })
          .join(" ")}
        stroke={accent}
        strokeWidth={0.45}
        opacity={0.3}
      />
      <path d="M137,184 A30,30 0 0,1 197,184" fill="none" stroke={accent} strokeWidth={0.7} opacity={0.4} />
      <path d="M163.5,153 H170.5 L169,162 H165 Z" />
      <rect x={78} y={136} width={178} height={84} fill={`url(#${hallShade})`} />
      {/* 控え壁と軒の蛇腹 */}
      {[78, 128, 206, 256].map((x) => (
        <g key={x}>
          <path d={`M${x - 5},220 V172 L${x - 2.5},164 H${x + 2.5} L${x + 5},172 V220 Z`} />
          <path d={`M${x + 2.5},164 L${x + 5},172 V220`} fill="none" stroke={accent} strokeWidth={0.5} opacity={0.3} />
        </g>
      ))}
      <rect x={74} y={134} width={186} height={3} />
      <rect x={74} y={134} width={186} height={0.6} fill={accent} opacity={0.35} />

      {/* 溶けた星の流れる石の水道橋: 迫石のアーチ、鉄の樋、端から坩堝へ注ぐ */}
      <path d="M266,220 V158 H390 V220 Z M280,220 V190 A11,11 0 0,1 302,190 V220 Z M316,220 V190 A11,11 0 0,1 338,190 V220 Z M352,220 V190 A11,11 0 0,1 374,190 V220 Z" fillRule="evenodd" />
      {masonry(266, 390, 160, 184, accent, 6, "aq-m")}
      {[291, 327, 363].map((c) => (
        <path
          key={c}
          d={range(7)
            .map((k) => {
              const a = Math.PI - (k * Math.PI) / 6;
              return `M${(c + Math.cos(a) * 11).toFixed(1)},${(190 - Math.sin(a) * 11).toFixed(1)} L${(c + Math.cos(a) * 16).toFixed(1)},${(190 - Math.sin(a) * 16).toFixed(1)}`;
            })
            .join(" ")}
          stroke={accent}
          strokeWidth={0.4}
          opacity={0.25}
        />
      ))}
      <rect x={264} y={152} width={130} height={6} />
      <rect x={266} y={151.2} width={124} height={1.2} fill="#ffcf8a" opacity={0.8} className="expedition-flame" />
      <path d="M394,152 H401 L399,157 H394 Z" />
      <path d="M398,156 C400,170 399,190 399,203 H401.5 C401.5,190 402.5,170 400,156 Z" fill={`url(#${pour})`} className="expedition-flame" />
      <ellipse cx={400} cy={205} rx={9} ry={4} fill={accent} opacity={0.3} />
      <path d="M390,204 H411 L408,220 H393 Z" />
      <ellipse cx={400.5} cy={204.5} rx={10} ry={1.4} fill="#ffd9a0" opacity={0.7} />
      {athanorTower(440, glow, accent)}
      {/* 小屋の片流れ屋根 */}
      <path d="M462,220 V184 L480,177 V220 Z" />
      <path d="M462,184 L480,177" stroke={accent} strokeWidth={0.5} opacity={0.3} />
    </>
  );
}

/**
 * 遠くの工房の町並み: 霞の向こうに、切妻・鋸屋根・丸屋根の棟と細い煙突が連なり、ところどころ窓が灯る。煙は細く長くたなびく
 */
const FAR_BUILDINGS: [number, number, number, "gable" | "saw" | "flat" | "dome" | "stack"][] = [
  [0, 56, 46, "gable"],
  [56, 40, 64, "flat"],
  [96, 72, 38, "saw"],
  [176, 14, 128, "stack"],
  [196, 78, 54, "gable"],
  [274, 50, 70, "dome"],
  [330, 12, 140, "stack"],
  [348, 92, 44, "saw"],
  [440, 50, 60, "gable"],
  [490, 30, 40, "flat"],
];
function foundryFar(accent: string) {
  const base = 200;
  return (
    <>
      {FAR_BUILDINGS.filter(([, , , t]) => t === "stack").map(([x, w, h], i) => smokePlume(x + w / 2, base - h, 0.6, accent, `far${i}`))}
      <rect x={0} y={base - 10} width={520} height={10} />
      {FAR_BUILDINGS.map(([x, w, h, type], i) => {
        const top = base - h;
        let d = "";
        if (type === "gable") d = `M${x},${base} V${top} L${x + w / 2},${top - w * 0.32} L${x + w},${top} V${base} Z`;
        else if (type === "flat") d = `M${x},${base} V${top} H${x + w} V${base} Z M${x - 1.5},${top} H${x + w + 1.5} V${top - 3} H${x - 1.5} Z`;
        else if (type === "saw") d = `M${x},${base} V${top} ${range(Math.floor(w / 18)).map((k) => `L${x + k * 18},${top - 12} L${x + k * 18 + 18},${top}`).join(" ")} H${x + w} V${base} Z`;
        else if (type === "dome") d = `M${x},${base} V${top} A${w / 2},${w * 0.42} 0 0,1 ${x + w},${top} V${base} Z M${x + w / 2 - 1},${top - w * 0.42} V${top - w * 0.42 - 8} H${x + w / 2 + 1} V${top - w * 0.42} Z`;
        else d = `M${x},${base} L${x + 2},${top} H${x + w - 2} L${x + w},${base} Z M${x},${top + 3} H${x + w} V${top} H${x} Z`;
        const lit = type !== "stack";
        const rows = Math.floor((h - 14) / 12);
        return (
          <g key={i}>
            <path d={d} />
            {lit &&
              range(rows).flatMap((r) =>
                range(Math.floor((w - 8) / 10)).map((c) =>
                  rand(i * 31 + r * 7 + c, 85) > 0.62 ? (
                    <rect key={`${r}-${c}`} x={x + 6 + c * 10} y={top + 8 + r * 12} width={3} height={5} fill="#ffcf8a" opacity={+(0.35 + rand(i + r + c, 86) * 0.4).toFixed(2)} />
                  ) : null,
                ),
              )}
            <path d={`M${x + w},${top} V${base}`} stroke={accent} strokeWidth={0.5} opacity={0.2} />
          </g>
        );
      })}
    </>
  );
}

/**
 * 錬金術の器具。どれも床（下端）に据える。
 * 煉瓦の炉（扉の奥で火が燃える）に掛けた蒸留器: 丸い硝子の胴では灯る液が泡立ち、兜の嘴から受け瓶へ滴が落ちる。
 * 配合表を広げた書見台、硝子器の並ぶ作業台の上には鎖で吊られた坩堝（溶けた星が光る）、
 * 鋲打ちの銅の釜と配管・ハンドル・圧力計
 */
function alchemy(accent: string) {
  const id = gradId("brew", accent);
  const fire = gradId("brew-fire", accent);
  const brick = "M44,220 V172 Q44,160 56,160 H100 Q112,160 112,172 V220 Z";
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2c8" stopOpacity="0.95" />
          <stop offset="0.25" stopColor={accent} stopOpacity="0.85" />
          <stop offset="1" stopColor={accent} stopOpacity="0.35" />
        </linearGradient>
        {fireGradient(fire, accent)}
        <radialGradient id={`${id}-molten`} cx="0.45" cy="0.5" r="0.55">
          <stop offset="0" stopColor="#fff6dc" />
          <stop offset="0.45" stopColor={accent} />
          <stop offset="1" stopColor={accent} stopOpacity="0.5" />
        </radialGradient>
        <radialGradient id={`${id}-halo`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={accent} stopOpacity="0.4" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-flask`}>
          <circle cx={78} cy={134} r={23} />
        </clipPath>
        <clipPath id={`${id}-brick`}>
          <path d={brick} />
        </clipPath>
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000000" stopOpacity="0.35" />
          <stop offset="0.55" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor={accent} stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* 煉瓦の炉: 扉の奥で火が燃え、鉄の格子と炉の縁が照る */}
      <ellipse cx={78} cy={219} rx={40} ry={4} fill={accent} opacity={0.25} />
      <path d={brick} />
      <g clipPath={`url(#${id}-brick)`}>{masonry(44, 112, 160, 220, accent, 6, "kiln-m")}</g>
      <path d="M64,220 V200 A14,14 0 0,1 92,200 V220 Z" fill={`url(#${fire})`} className="expedition-flame" />
      <path d={range(4).map((k) => `M${69 + k * 6},190 V220`).join(" ")} stroke="currentColor" strokeWidth={1.3} />
      <path d="M60,200 A18,18 0 0,1 96,200" fill="none" stroke={accent} strokeWidth={0.6} opacity={0.4} />
      <path d={brick} fill={`url(#${id}-shade)`} />
      <rect x={40} y={156} width={76} height={5} rx={1} />
      <rect x={40} y={156} width={76} height={0.8} fill={accent} opacity={0.45} />
      {/* 蒸留器の丸い胴: 暗い硝子の中で、灯る液が泡立つ */}
      <circle cx={78} cy={134} r={24} opacity={0.6} />
      <g clipPath={`url(#${id}-flask)`}>
        <rect x={52} y={136} width={52} height={24} fill={`url(#${id})`} />
        <path d="M54,136 Q78,133 102,136" fill="none" stroke="#fff6dc" strokeWidth={0.9} opacity={0.85} />
        {[[68, 148, 1.5], [84, 152, 1.1], [75, 142, 0.9], [90, 145, 1.2], [80, 156, 0.8]].map(([x, y, r], k) => (
          <circle key={k} cx={x} cy={y} r={r} fill="none" stroke="#fff6dc" strokeWidth={0.5} opacity={0.7} />
        ))}
      </g>
      <circle cx={78} cy={134} r={24} fill="none" stroke={accent} strokeWidth={0.7} opacity={0.4} />
      <path d="M63,120 A18,18 0 0,1 73,113" fill="none" stroke="#ffffff" strokeWidth={1} opacity={0.3} strokeLinecap="round" />
      {/* 首と兜（アレンビック）、受け瓶へ下る嘴 */}
      <rect x={73} y={98} width={10} height={14} opacity={0.75} />
      <path d="M66,100 C64,86 70,78 78,77 C88,78 92,86 90,100 Z" />
      <path d="M78,77 C88,78 92,86 90,100" fill="none" stroke={accent} strokeWidth={0.6} opacity={0.4} />
      <path d="M86,84 L178,146 L176,150 L88,94 Z" />
      <path d="M88,84.5 L178,146" stroke={accent} strokeWidth={0.4} opacity={0.35} />
      <circle cx={178} cy={154} r={1.2} fill="#ffd9a0" opacity={0.9} className="expedition-flame" />
      {/* 受け瓶と、その台 */}
      <rect x={174} y={148} width={8} height={14} opacity={0.75} />
      <circle cx={178} cy={174} r={13} opacity={0.65} />
      <path d="M166,178 A13,13 0 0,0 190,178 Z" fill={`url(#${id})`} opacity={0.8} />
      <circle cx={178} cy={174} r={13} fill="none" stroke={accent} strokeWidth={0.6} opacity={0.35} />
      <path d="M162,188 H194 V192 H162 Z M165,192 L163,220 H166 L169,192 Z M191,192 L193,220 H190 L187,192 Z" />
      {/* 配合表を広げた書見台: 最後の欄だけが空いている */}
      <path d="M140,220 L144,214 H152 V184 H156 V214 H164 L168,220 Z" />
      <path d="M128,186 L176,172 L178,177 L130,191 Z" />
      <path d="M131,184 L152,178 L153,170 L131,176 Z M154,178 L175,172 L174,164 L155,170 Z" fill="#ffe7c0" opacity={0.28} />
      <path d="M134,177 L150,172.5 M134,180 L149,175.6 M157,170.5 L172,166 M157,173.5 L166,171" stroke={accent} strokeWidth={0.5} opacity={0.55} />
      <path d="M167,170.8 L172,169.4" stroke={accent} strokeWidth={0.4} opacity={0.3} strokeDasharray="0.8 0.8" />

      {/* 鎖で吊られた坩堝。溶けた星の面が光り、上に熱の暈 */}
      {[238, 260].map((x) => (
        <path key={x} d={range(14).map((k) => `M${x},${k * 6 + 1} v4.4`).join(" ")} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      ))}
      {[238, 260].map((x) => (
        <path key={x} d={range(14).map((k) => `M${x - 1.4},${k * 6 + 4.2} h2.8`).join(" ")} stroke="currentColor" strokeWidth={0.9} />
      ))}
      <ellipse cx={249} cy={88} rx={42} ry={20} fill={`url(#${id}-halo)`} />
      <path d="M224,90 H274 L268,120 C264,132 234,132 230,120 Z" />
      <path d="M236,84 L238,92 M262,84 L260,92" stroke="currentColor" strokeWidth={1.4} />
      <path d="M230,84 Q249,78 268,84" fill="none" stroke="currentColor" strokeWidth={1.6} />
      <ellipse cx={249} cy={91} rx={23} ry={4.2} fill={`url(#${id}-molten)`} className="expedition-flame" />
      <path d="M226,98 H272 M228,110 H270" stroke={accent} strokeWidth={0.5} opacity={0.28} />
      <path d="M268,98 L264,122" stroke={accent} strokeWidth={0.7} opacity={0.35} />
      {[[240, 80], [258, 76], [250, 70], [246, 62]].map(([x, y], k) => (
        <circle key={k} cx={x} cy={y} r={0.9} fill="#fff2c8" opacity={0.8 - k * 0.12} />
      ))}
      {/* 作業台と、並ぶ硝子器 */}
      <rect x={204} y={176} width={96} height={5} />
      <rect x={204} y={176} width={96} height={0.7} fill={accent} opacity={0.4} />
      <path d="M210,181 H215 V220 H210 Z M289,181 H294 V220 H289 Z M215,204 H289 V207 H215 Z" />
      {/* 細首の丸瓶 */}
      <path d="M222,176 C212,176 211,164 218,160 V148 H222 V160 C229,164 228,176 222,176 Z" opacity={0.7} />
      <path d="M213,168 C213,174 216,176 220,176 C225,176 227,174 227,168 Z" fill={`url(#${id})`} opacity={0.7} />
      {/* 三角の瓶 */}
      <path d="M236,176 L244,158 V150 H248 V158 L256,176 Z" opacity={0.7} />
      <path d="M239,170 L253,170 L256,176 H236 Z" fill={`url(#${id})`} opacity={0.75} className="expedition-flame" />
      {/* 試験管の立て */}
      <path d="M262,176 V164 H290 V176 H288 V167 H264 V176 Z" />
      {[266, 272, 278, 284].map((x, k) => (
        <g key={x}>
          <rect x={x - 1.6} y={154} width={3.2} height={20} rx={1.6} opacity={0.65} />
          <rect x={x - 1.6} y={154 + 6 + k * 3} width={3.2} height={14 - k * 3} rx={1.6} fill={accent} opacity={k % 2 ? 0.35 : 0.65} />
        </g>
      ))}
      {/* 台の下に積んだ古書 */}
      <path d="M222,220 V213 H252 V220 Z M226,213 V207 H250 V213 Z" />
      <path d="M222,213 H252 M226,207 H250" stroke={accent} strokeWidth={0.4} opacity={0.25} />

      {/* 鋲打ちの銅の釜: 丸窓の奥で溶けた星が光る */}
      <path d="M352,220 V150 C352,138 366,132 382,132 C398,132 412,138 412,150 V220 Z" />
      <path d="M382,132 C398,132 412,138 412,150 V220" fill="none" stroke={accent} strokeWidth={0.7} opacity={0.35} />
      <path d="M352,150 H412 M352,196 H412" stroke={accent} strokeWidth={0.5} opacity={0.25} />
      {range(10).map((k) => (
        <circle key={k} cx={355 + k * 6.2} cy={152.5} r={0.7} fill={accent} opacity={0.4} />
      ))}
      <circle cx={382} cy={174} r={11} />
      <circle cx={382} cy={174} r={8} fill={`url(#${id}-molten)`} className="expedition-flame" />
      <circle cx={382} cy={174} r={11} fill="none" stroke={accent} strokeWidth={0.8} opacity={0.5} />
      {range(8).map((k) => {
        const a = (k * Math.PI) / 4;
        return <circle key={k} cx={+(382 + Math.cos(a) * 9.6).toFixed(2)} cy={+(174 + Math.sin(a) * 9.6).toFixed(2)} r={0.6} fill={accent} opacity={0.55} />;
      })}
      <rect x={348} y={214} width={68} height={6} />
      <rect x={348} y={214} width={68} height={0.6} fill={accent} opacity={0.3} />
      {/* 配管: 床から立ち上がり、肘で折れて釜へ。継ぎ手の鍔と鋲 */}
      <path d="M314,220 V122 C314,106 326,98 342,98 H420 V110 H344 C334,110 328,116 328,126 V220 Z" />
      <path d="M376,110 V132 H388 V110 Z" />
      <path d="M328,126 C328,116 334,110 344,110 H420" fill="none" stroke={accent} strokeWidth={0.5} opacity={0.3} />
      {[[311, 196, 20, 4], [311, 140, 20, 4], [372, 120, 20, 4]].map(([x, y, w, h], k) => (
        <g key={k}>
          <rect x={x} y={y} width={w} height={h} />
          <rect x={x} y={y} width={w} height={0.6} fill={accent} opacity={0.4} />
        </g>
      ))}
      {[352, 404].map((x) => (
        <g key={x}>
          <rect x={x} y={95} width={4} height={18} />
          <rect x={x + 3.4} y={95} width={0.6} height={18} fill={accent} opacity={0.4} />
        </g>
      ))}
      {/* 圧力計 */}
      <circle cx={321} cy={166} r={9} />
      <circle cx={321} cy={166} r={7} fill={accent} opacity={0.14} />
      <path
        d={range(9)
          .map((k) => {
            const a = Math.PI * (0.8 + k * 0.175);
            return `M${(321 + Math.cos(a) * 5.4).toFixed(2)},${(166 + Math.sin(a) * 5.4).toFixed(2)} L${(321 + Math.cos(a) * 6.6).toFixed(2)},${(166 + Math.sin(a) * 6.6).toFixed(2)}`;
          })
          .join(" ")}
        stroke={accent}
        strokeWidth={0.4}
        opacity={0.7}
      />
      <path d="M321,166 L325.5,161.5" stroke="#ffd9a0" strokeWidth={0.7} opacity={0.85} />
      <circle cx={321} cy={166} r={7} fill="none" stroke={accent} strokeWidth={0.5} opacity={0.5} />
      {/* ハンドル: 輪と輻、灯を受ける右の縁 */}
      <circle cx={366} cy={104} r={10} fill="none" stroke="currentColor" strokeWidth={2.4} />
      <path d={range(3).map((k) => { const a = (k * Math.PI) / 3 + 0.3; return `M${(366 + Math.cos(a) * 10).toFixed(2)},${(104 + Math.sin(a) * 10).toFixed(2)} L${(366 - Math.cos(a) * 10).toFixed(2)},${(104 - Math.sin(a) * 10).toFixed(2)}`; }).join(" ")} stroke="currentColor" strokeWidth={1.4} />
      <circle cx={366} cy={104} r={2.6} />
      <path d="M366,93 A11,11 0 0,1 376,108" fill="none" stroke={accent} strokeWidth={0.6} opacity={0.45} />
    </>
  );
}

/**
 * 手前の熾火: 床に寄せた石炭の山（隙間から火が透ける）、積んだ星鉄の鋳塊、壁に立て掛けた火ばさみ、熾火のこぼれた火床
 */
function coalHeap(cx: number, w: number, h: number, seed: number, accent: string, key: string) {
  const chunks = range(Math.round(w / 3.2)).map((k) => {
    const t = (k + 0.5) / Math.round(w / 3.2);
    const x = cx - w / 2 + t * w;
    const top = 100 - h * Math.sin(t * Math.PI) ** 0.8 * (0.75 + rand(seed + k, 61) * 0.25);
    const s = 2.4 + rand(seed + k, 62) * 2.2;
    return `M${(x - s).toFixed(1)},${(top + s * 0.8).toFixed(1)} L${(x - s * 0.4).toFixed(1)},${(top - s * 0.3).toFixed(1)} L${(x + s * 0.6).toFixed(1)},${(top - s * 0.1).toFixed(1)} L${(x + s).toFixed(1)},${(top + s).toFixed(1)} V100 H${(x - s).toFixed(1)} Z`;
  });
  return (
    <g key={key}>
      <ellipse cx={cx} cy={100} rx={w * 0.62} ry={h * 0.5} fill={accent} opacity={0.18} className="expedition-flame" />
      <path d={`M${cx - w / 2},100 Q${cx},${100 - h * 1.25} ${cx + w / 2},100 Z`} fill="#ffcf8a" opacity={0.75} className="expedition-flame" />
      <path d={chunks.join(" ")} />
      {range(4).map((k) => (
        <circle key={k} cx={+(cx - w * 0.3 + rand(seed + k, 63) * w * 0.6).toFixed(1)} cy={+(100 - h * (0.2 + rand(seed + k, 64) * 0.4)).toFixed(1)} r={0.7} fill="#fff2c8" opacity={0.9} />
      ))}
    </g>
  );
}
function embers(accent: string) {
  return (
    <>
      {coalHeap(70, 56, 30, 1, accent, "c1")}
      {coalHeap(110, 26, 14, 9, accent, "c2")}
      {/* 星鉄の鋳塊 */}
      <path d="M220,100 L223,92 H247 L250,100 Z M226,92 L229,85 H245 L248,92 Z M236,85 L239,78 H253 L256,85 Z" />
      <path d="M223,92 H247 M229,85 H245 M239,78 H253" stroke={accent} strokeWidth={0.7} opacity={0.5} />
      <path d="M247,92 L250,100 M245,85 L248,92 M253,78 L256,85" stroke={accent} strokeWidth={0.5} opacity={0.35} />
      {/* 立て掛けた火ばさみと、柄の長い柄杓 */}
      <path d="M300,100 L322,40 L324.5,41 L303,100 Z M308,100 L323,42 L325,43 L311,100 Z" />
      <circle cx={323.5} cy={41} r={2} />
      <path d="M346,100 L360,44 L362,44.6 L349,100 Z" />
      <path d="M340,100 C340,92 352,92 352,100 Z" />
      <path d="M362,44.6 L349,100" stroke={accent} strokeWidth={0.4} opacity={0.4} />
      {coalHeap(470, 70, 36, 21, accent, "c3")}
      {coalHeap(524, 28, 14, 33, accent, "c4")}
      {/* こぼれた熾火 */}
      {range(10).map((k) => (
        <circle key={k} cx={+(140 + k * 40 + rand(k, 65) * 20).toFixed(1)} cy={+(98.5 - rand(k, 66) * 1.5).toFixed(1)} r={+(0.8 + rand(k, 67) * 0.6).toFixed(2)} fill="#ffcf8a" opacity={+(0.6 + rand(k, 68) * 0.3).toFixed(2)} />
      ))}
    </>
  );
}

/** 魔導炉の床のひび: 床の石の継ぎ目から、枝分かれしながら走る */
const MAGMA_CRACKS = (() => {
  // 乱数の種はどれも整数にする（小数だと、サーバとブラウザで値がずれることがある）
  const main: string[] = [], branches: string[] = [];
  range(7).forEach((i) => {
    let x = 20 + i * 56 + rand(i, 70) * 24;
    let y = 64;
    const pts = [`M${x.toFixed(1)},${y}`];
    for (let k = 0; y > GROUND + 4; k++) {
      const seed = i * 40 + k;
      y -= 5 + rand(seed, 71) * 7;
      x += (rand(seed, 72) - 0.5) * 16;
      pts.push(`L${x.toFixed(1)},${Math.max(GROUND + 3, y).toFixed(1)}`);
      if (rand(seed, 73) > 0.65) {
        const dir = rand(seed, 74) > 0.5 ? 1 : -1;
        branches.push(`M${x.toFixed(1)},${y.toFixed(1)} l${(dir * (5 + rand(seed, 75) * 9)).toFixed(1)},${(-2 - rand(seed, 76) * 5).toFixed(1)} l${(dir * (3 + rand(seed, 77) * 5)).toFixed(1)},${(rand(seed, 78) * 3).toFixed(1)}`);
      }
    }
    main.push(pts.join(" "));
  });
  return { main: main.join(" "), branches: branches.join(" ") };
})();

/* ---------- STAGE 6 天空の大聖堂 ---------- */

const CLOUD_PUFFS2 = range(14).map((i) => ({ cx: 18 + i * 36 + rand(i, 11) * 14, cy: 58 - rand(i, 12) * 22, r: 16 + rand(i, 13) * 18 }));
/** 雲の帯: 上は明るく、下は霞へ溶ける */
function cloudBank() {
  return (
    <>
      <defs>
        <linearGradient id="expedition-cloud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.25" stopColor="currentColor" stopOpacity="1" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <g fill="url(#expedition-cloud)">
        <rect x={0} y={60} width={500} height={40} />
        {CLOUD_PUFFS2.map((c, i) => (
          <circle key={i} cx={c.cx} cy={c.cy + 18} r={c.r} />
        ))}
      </g>
    </>
  );
}

/**
 * 雲海: 積雲の塊がいくつも盛り上がり、上の面は星冠の光（右上から）を受けて明るく、下は影になって霞へ溶ける。
 * 端で切れる塊は反対の端にも描き、横に並べたとき継ぎ目なく続くようにする
 */
/** 積雲の塊（中心・底・幅・高さ）。奥の列は高く大きく、手前の列は低い */
const SEA_MOUNDS = range(11).map((i) => {
  const back = i < 5;
  return {
    x: back ? 20 + i * 100 + rand(i, 90) * 40 : 60 + (i - 5) * 84 + rand(i, 90) * 30,
    base: back ? 84 : 104,
    w: back ? 90 + rand(i, 91) * 60 : 60 + rand(i, 91) * 50,
    h: back ? 34 + rand(i, 92) * 24 : 20 + rand(i, 92) * 18,
  };
});
/** 塊を、縁が盛り上がる小さな丸の重なりにする（もくもくした積雲の頭）。端で切れる塊は反対の端にも描く */
const SEA_PUFFS = SEA_MOUNDS.flatMap((m, i) => {
  const n = Math.max(5, Math.round(m.w / 10));
  return range(n).map((k) => {
    const t = (k + 0.5) / n;
    const top = m.base - m.h * Math.sin(t * Math.PI) ** 0.6;
    const r = m.h * (0.28 + rand(i * 30 + k, 93) * 0.22) * (0.7 + 0.3 * Math.sin(t * Math.PI));
    return { x: +(m.x - m.w / 2 + t * m.w).toFixed(1), y: +(top + r * 0.85).toFixed(1), r: +r.toFixed(1) };
  });
});
const SEA_WRAPPED = SEA_PUFFS.flatMap((p) => [p, { ...p, x: p.x - 500 }, { ...p, x: p.x + 500 }]).filter((p) => p.x + p.r > 0 && p.x - p.r < 500);
function cloudSea(accent: string) {
  const lit = gradId("cloudsea-lit", accent);
  const shade = gradId("cloudsea-shade", accent);
  const soft = gradId("cloudsea-soft", accent);
  return (
    <>
      <defs>
        <radialGradient id={lit} cx="0.68" cy="0.2" r="0.7">
          <stop offset="0" stopColor={accent} stopOpacity="0.55" />
          <stop offset="0.4" stopColor={accent} stopOpacity="0.18" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={shade} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.35" />
        </linearGradient>
        {/* 雲の縁をわずかにぼかす */}
        <filter id={soft} x="-5%" y="-20%" width="110%" height="140%">
          <feGaussianBlur stdDeviation="0.9" />
        </filter>
      </defs>
      <g filter={`url(#${soft})`}>
        <rect x={0} y={96} width={500} height={24} />
        {SEA_WRAPPED.map((p, k) => (
          <circle key={k} cx={p.x} cy={p.y} r={p.r} />
        ))}
        {SEA_WRAPPED.map((p, k) => (
          <circle key={`l${k}`} cx={p.x} cy={p.y} r={p.r} fill={`url(#${lit})`} />
        ))}
        <rect x={0} y={70} width={500} height={50} fill={`url(#${shade})`} />
      </g>
    </>
  );
}

/** 浮島の岩の下側: 岩の層が段になって垂れ、先は尖る。層の筋が灯を受ける */
function isleRock(w: number, depth: number, seed: number) {
  const n = 9;
  const pts: string[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const x = -w / 2 + t * w;
    const sag = Math.sin(t * Math.PI) ** 1.4;
    const y = 4 + depth * sag * (0.55 + rand(seed + k, 95) * 0.45);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    if (k < n) pts.push(`${(x + w / n / 2).toFixed(1)},${(y + 2 + rand(seed + k, 96) * depth * 0.18).toFixed(1)}`);
  }
  return `M${-w / 2 - 3},0 H${w / 2 + 3} L${pts.reverse().join(" L")} Z`;
}
function isleStrata(w: number, depth: number, accent: string) {
  return (
    <path
      d={range(4)
        .map((k) => {
          const y = 6 + k * depth * 0.16;
          const half = (w / 2) * (1 - k * 0.2);
          return `M${(-half).toFixed(1)},${y.toFixed(1)} Q0,${(y + 3).toFixed(1)} ${half.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ")}
      fill="none"
      stroke={accent}
      strokeWidth={0.4}
      opacity={0.18}
    />
  );
}
/** 灯る細い尖頭窓 */
const lancet = (x: number, y: number, w: number, h: number, o: number, key: string) => (
  <path key={key} d={`M${x},${y + h} V${y + w} Q${x},${y} ${x + w / 2},${y - w * 0.4} Q${x + w},${y} ${x + w},${y + w} V${y + h} Z`} fill="#ffeec8" opacity={o} />
);
/**
 * 雲の上の大聖堂（横から見た姿）: 西の塔には薔薇窓と鐘楼、四隅の小尖塔と高い尖塔。身廊の高窓と側廊の窓が灯り、
 * 控え壁の小尖塔から飛び梁が渡る。交差部には細い尖塔、東の端は丸い後陣。地面の高さを 0 とした座標で描く
 */
function skyCathedral(accent: string) {
  return (
    <g>
      {/* 側廊と身廊、屋根 */}
      <rect x={-38} y={-22} width={88} height={22} />
      <rect x={-38} y={-42} width={84} height={20} />
      <path d="M-40,-42 L-34,-54 H42 L48,-42 Z" />
      <path d="M-34,-54 H42 L48,-42" fill="none" stroke={accent} strokeWidth={0.6} opacity={0.45} />
      {range(6).map((k) => lancet(-31 + k * 13, -39, 4, 13, 0.55, `c${k}`))}
      {range(6).map((k) => lancet(-31 + k * 13, -17, 4, 11, 0.4, `a${k}`))}
      {/* 控え壁と飛び梁、小尖塔 */}
      {range(6).map((k) => {
        const x = -25 + k * 13;
        return (
          <g key={k}>
            <path d={`M${x - 2},0 V-28 L${x},-34 L${x + 2},-28 V0 Z`} />
            <path d={`M${x + 1},-26 Q${x + 4},-36 ${x + 8},-38`} fill="none" stroke="currentColor" strokeWidth={1.4} />
            <path d={`M${x + 2},-28 V0`} stroke={accent} strokeWidth={0.4} opacity={0.35} />
          </g>
        );
      })}
      {/* 後陣と円錐屋根 */}
      <path d="M48,0 V-34 Q60,-34 64,-20 V0 Z" />
      <path d="M47,-34 L54,-48 L64,-22 Z" />
      <path d="M54,-48 L64,-22" stroke={accent} strokeWidth={0.5} opacity={0.4} />
      {lancet(53, -28, 3.5, 12, 0.5, "ap")}
      {/* 交差部の細い尖塔 */}
      <path d="M12,-54 V-62 H20 V-54 Z M11,-62 L16,-104 L21,-62 Z" />
      <path d="M16,-104 L21,-62" stroke={accent} strokeWidth={0.5} opacity={0.45} />
      <circle cx={16} cy={-107} r={1.4} fill="#fff4d0" opacity={0.9} />
      {/* 西の塔: 薔薇窓、鐘楼の開口、四隅の小尖塔と尖塔、頂の星 */}
      <rect x={-60} y={-86} width={22} height={86} />
      <path d={`M-60,0 V-86 M-38,-86 V0`} stroke={accent} strokeWidth={0.4} opacity={0.2} />
      <circle cx={-49} cy={-54} r={6.4} />
      <circle cx={-49} cy={-54} r={5} fill="#ffeec8" opacity={0.6} />
      <path d={range(4).map((k) => { const a = (k * Math.PI) / 4; return `M${(-49 + Math.cos(a) * 5).toFixed(2)},${(-54 + Math.sin(a) * 5).toFixed(2)} L${(-49 - Math.cos(a) * 5).toFixed(2)},${(-54 - Math.sin(a) * 5).toFixed(2)}`; }).join(" ")} stroke="currentColor" strokeWidth={0.7} />
      <circle cx={-49} cy={-54} r={1.6} />
      {lancet(-55, -80, 4, 14, 0.5, "b1")}
      {lancet(-47, -80, 4, 14, 0.5, "b2")}
      {lancet(-51, -30, 4, 18, 0.45, "door")}
      <rect x={-62} y={-88} width={26} height={3} />
      <path d="M-62,-88 L-60,-98 L-58,-88 Z M-38,-88 L-36,-98 L-34,-88 Z" />
      <path d="M-59,-88 L-49,-138 L-39,-88 Z" />
      <path d="M-49,-138 L-39,-88" stroke={accent} strokeWidth={0.6} opacity={0.5} />
      <path d={range(5).map((k) => { const y = -96 - k * 8; const dx = ((y + 138) / 50) * 10; return `M${(-49 + dx).toFixed(1)},${y} l1.6,-1.4`; }).join(" ")} stroke="currentColor" strokeWidth={0.8} />
      <circle cx={-49} cy={-142} r={4} fill={accent} opacity={0.25} />
      <circle cx={-49} cy={-142} r={1.6} fill="#fff8e0" />
      <path d={`M-38,-86 V0 M50,-22 V0`} stroke={accent} strokeWidth={0.6} opacity={0.35} />
    </g>
  );
}
/** 小さな礼拝堂: 切妻の堂と、鈴の見える小さな鐘楼 */
function skyChapel(accent: string) {
  return (
    <g>
      <rect x={-18} y={-16} width={34} height={16} />
      <path d="M-20,-16 L-4,-28 L18,-16 Z" />
      <path d="M-4,-28 L18,-16" stroke={accent} strokeWidth={0.6} opacity={0.45} />
      {lancet(-12, -12, 3, 9, 0.45, "w1")}
      {lancet(2, -12, 3, 9, 0.45, "w2")}
      <rect x={10} y={-40} width={10} height={40} />
      <path d="M9,-40 L15,-54 L21,-40 Z" />
      <path d="M12,-36 V-30 A3,3 0 0,1 18,-30 V-36" fill="#ffeec8" opacity={0.35} />
      <path d="M13,-31 Q15,-36 17,-31 Z" />
      <path d="M20,-40 V0" stroke={accent} strokeWidth={0.5} opacity={0.35} />
    </g>
  );
}
/** 糸杉 */
const cypress = (x: number, h: number) => `M${x},0 C${x - h * 0.16},${-h * 0.35} ${x - h * 0.1},${-h * 0.8} ${x},${-h} C${x + h * 0.1},${-h * 0.8} ${x + h * 0.16},${-h * 0.35} ${x},0 Z`;

/**
 * 雲に浮かぶ島々: いちばん大きな島に大聖堂、小さな島に礼拝堂、もう一つの岩には糸杉。
 * 島の下には岩の層が垂れ、根元を霞が巻く
 */
const SKY_ISLES = [
  { cx: 300, y: 132, w: 150, depth: 52, s: 0.82, kind: "cathedral" },
  { cx: 92, y: 150, w: 62, depth: 30, s: 0.9, kind: "chapel" },
  { cx: 448, y: 108, w: 38, depth: 22, s: 1, kind: "cypress" },
] as const;
function skyisles(accent: string) {
  const mist = gradId("isle-mist", accent);
  return (
    <>
      <defs>
        <radialGradient id={mist}>
          <stop offset="0" stopColor="#d8c8e0" stopOpacity="0.35" />
          <stop offset="1" stopColor="#d8c8e0" stopOpacity="0" />
        </radialGradient>
      </defs>
      {SKY_ISLES.map(({ cx, y, w, depth, s, kind }, i) => (
        <g key={i} transform={`translate(${cx} ${y})`}>
          <path d={isleRock(w, depth, i * 20)} />
          {isleStrata(w, depth, accent)}
          <path d={`M${w / 2 + 3},0 L${w / 2 - 6},${depth * 0.3}`} stroke={accent} strokeWidth={0.6} opacity={0.35} />
          {/* 島の縁の草と、零れ落ちる細い霧の滝 */}
          <rect x={-w / 2 - 3} y={-1.5} width={w + 6} height={1.5} fill={accent} opacity={0.3} />
          {kind === "cathedral" && <path d={`M${w / 2 - 2},2 V${depth * 0.9}`} stroke="#e8dcf0" strokeWidth={1.6} opacity={0.18} />}
          <ellipse cx={0} cy={depth * 0.35} rx={w * 0.75} ry={depth * 0.3} fill={`url(#${mist})`} />
          <g transform={`scale(${s})`}>
            {kind === "cathedral" && skyCathedral(accent)}
            {kind === "chapel" && skyChapel(accent)}
            {kind === "cypress" && (
              <>
                <path d={`${cypress(-6, 30)} ${cypress(4, 22)} ${cypress(12, 16)}`} />
                <path d={`M-6,-30 C-1,-24 0,-12 0,0`} fill="none" stroke={accent} strokeWidth={0.4} opacity={0.3} />
              </>
            )}
          </g>
        </g>
      ))}
    </>
  );
}

/** 鈴: 肩が丸く、腰がくびれ、口が開く。縁と帯を持つ */
const bellPath = (cx: number, top: number, s: number) =>
  `M${cx - 4 * s},${top} C${cx - 9 * s},${top} ${cx - 10 * s},${top + 6 * s} ${cx - 10 * s},${top + 12 * s} C${cx - 10 * s},${top + 19 * s} ${cx - 12 * s},${top + 22 * s} ${cx - 15 * s},${top + 25 * s} H${cx + 15 * s} C${cx + 12 * s},${top + 22 * s} ${cx + 10 * s},${top + 19 * s} ${cx + 10 * s},${top + 12 * s} C${cx + 10 * s},${top + 6 * s} ${cx + 9 * s},${top} ${cx + 4 * s},${top} Z`;
/** 四つ葉の飾り窓 */
const quatrefoil = (cx: number, cy: number, r: number) =>
  range(4)
    .map((k) => {
      const a = (k * Math.PI) / 2;
      return `M${(cx + Math.cos(a) * r * 0.5 + r * 0.45).toFixed(2)},${(cy + Math.sin(a) * r * 0.5).toFixed(2)} A${(r * 0.45).toFixed(2)},${(r * 0.45).toFixed(2)} 0 1,0 ${(cx + Math.cos(a) * r * 0.5 - r * 0.45).toFixed(2)},${(cy + Math.sin(a) * r * 0.5).toFixed(2)} A${(r * 0.45).toFixed(2)},${(r * 0.45).toFixed(2)} 0 1,0 ${(cx + Math.cos(a) * r * 0.5 + r * 0.45).toFixed(2)},${(cy + Math.sin(a) * r * 0.5).toFixed(2)} Z`;
    })
    .join(" ");

/**
 * 鈴の列柱: 雲の上に開く、大理石の尖頭アーチの回廊。束ね柱には柱頭と台座、アーチには二重の刳形と小さな花弁の飾り（カスプ）、
 * 三角の小間には四つ葉の飾り窓。上には透かしの胸壁と小尖塔、下には低い欄干。
 * アーチの頂から下がる青銅の鈴は星冠の光を右の肩に受け、舌が淡く光る
 */
const BELFRY_COLUMNS = [0, 180, 360];
function belfry(accent: string) {
  const shade = gradId("cyl-belfry", accent);
  const bronze = gradId("bell-bronze", accent);
  const spring = 104, apex = 40, half = 14;
  const bays = [[half, 180 - half], [180 + half, 360 - half]] as const;
  const archD = (l: number, r: number, inset = 0) => {
    const mid = (l + r) / 2, span = r - l;
    return `M${l + inset},${spring} Q${l + inset},${apex + span * 0.16 + inset} ${mid},${apex + inset * 1.3} Q${r - inset},${apex + span * 0.16 + inset} ${r - inset},${spring}`;
  };
  return (
    <>
      <defs>
        {cylinderShade(shade, accent)}
        <linearGradient id={bronze} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000000" stopOpacity="0.3" />
          <stop offset="0.55" stopColor={accent} stopOpacity="0.06" />
          <stop offset="0.85" stopColor={accent} stopOpacity="0.4" />
          <stop offset="1" stopColor={accent} stopOpacity="0.12" />
        </linearGradient>
      </defs>
      {/* 壁と、雲の見える開口 */}
      <path d={`M0,22 H360 V220 H0 Z ${bays.map(([l, r]) => `${archD(l, r)} V220 H${l} Z`).join(" ")}`} fillRule="evenodd" />
      {bays.map(([l, r], k) => {
        const mid = (l + r) / 2;
        return (
          <g key={k}>
            {/* 二重の刳形と、内の縁の花弁の飾り */}
            <path d={archD(l, r)} fill="none" stroke={accent} strokeWidth={0.9} opacity={0.4} />
            <path d={archD(l, r, -6)} fill="none" stroke={accent} strokeWidth={0.4} opacity={0.22} />
            <path
              d={[0.22, 0.4, 0.6, 0.78]
                .map((t) => {
                  const x = l + (r - l) * t;
                  const u = Math.abs(t - 0.5) * 2;
                  const y = apex + (spring - apex) * u ** 1.8 * 0.55 + 2;
                  return `M${(x - 6).toFixed(1)},${(y - 1).toFixed(1)} Q${x.toFixed(1)},${(y + 8).toFixed(1)} ${(x + 6).toFixed(1)},${(y - 1).toFixed(1)}`;
                })
                .join(" ")}
              stroke="currentColor"
              strokeWidth={1.6}
              fill="none"
            />
            {/* 低い欄干: 笠と小柱 */}
            <rect x={l} y={190} width={r - l} height={4} />
            <rect x={l} y={190} width={r - l} height={0.7} fill={accent} opacity={0.4} />
            <path d={range(Math.floor((r - l) / 8)).map((j) => `M${l + 5 + j * 8},194 h3 v12 h-3 Z`).join(" ")} />
            <rect x={l} y={206} width={r - l} height={14} />
            {/* 鈴: 頂から下がる吊り金具と軛、青銅の胴に帯、光る舌 */}
            <path d={`M${mid},${apex + 4} V${apex + 18}`} stroke="currentColor" strokeWidth={1.4} />
            <rect x={mid - 9} y={apex + 17} width={18} height={3.4} rx={1} />
            <path d={bellPath(mid, apex + 20, 1.05)} />
            <path d={bellPath(mid, apex + 20, 1.05)} fill={`url(#${bronze})`} />
            <path d={`M${mid - 10.4},${apex + 33} H${mid + 10.4} M${mid - 13},${apex + 42} H${mid + 13}`} stroke={accent} strokeWidth={0.5} opacity={0.4} />
            <path d={`M${mid + 6},${apex + 22} C${mid + 10},${apex + 24} ${mid + 10.5},${apex + 32} ${mid + 11},${apex + 38}`} fill="none" stroke="#fff4d8" strokeWidth={0.8} opacity={0.55} strokeLinecap="round" />
            <circle cx={mid} cy={apex + 48} r={2.4} fill={accent} opacity={0.85} />
            <circle cx={mid} cy={apex + 48} r={8} fill={accent} opacity={0.12} />
          </g>
        );
      })}
      {/* 小間の四つ葉の飾り窓 */}
      {BELFRY_COLUMNS.map((x) => (
        <g key={`q${x}`}>
          <path d={quatrefoil(x, 52, 11)} fill="#ffeec8" opacity={0.14} />
          <path d={quatrefoil(x, 52, 11)} fill="none" stroke={accent} strokeWidth={0.5} opacity={0.35} />
        </g>
      ))}
      {/* 束ね柱: 柱身の細い筋、柱頭（葉飾りの膨らみと冠板）、台座 */}
      {BELFRY_COLUMNS.map((x) => (
        <g key={x}>
          <rect x={x - half} y={spring} width={half * 2} height={116} />
          <path d={range(5).map((k) => `M${x - 10 + k * 5},${spring + 8} V204`).join(" ")} stroke={accent} strokeWidth={0.4} opacity={0.16} />
          <rect x={x - half} y={spring} width={half * 2} height={116} fill={`url(#${shade})`} />
          <path d={`M${x - half - 2},${spring + 8} C${x - half - 2},${spring} ${x - half - 6},${spring - 2} ${x - half - 7},${spring - 4} H${x + half + 7} C${x + half + 6},${spring - 2} ${x + half + 2},${spring} ${x + half + 2},${spring + 8} Z`} />
          <rect x={x - half - 9} y={spring - 8} width={half * 2 + 18} height={4.4} />
          <rect x={x - half - 9} y={spring - 8} width={half * 2 + 18} height={0.8} fill={accent} opacity={0.5} />
          <path d={`M${x - half - 6},220 V210 H${x - half - 3} V204 H${x + half + 3} V210 H${x + half + 6} V220 Z`} />
          <rect x={x - half - 3} y={204} width={half * 2 + 6} height={0.7} fill={accent} opacity={0.35} />
          <path d={`M${x + half},${spring} V204`} stroke={accent} strokeWidth={0.6} opacity={0.35} />
        </g>
      ))}
      {/* 軒の蛇腹と、透かしの胸壁、小尖塔 */}
      <rect x={0} y={20} width={360} height={4} />
      <rect x={0} y={20} width={360} height={0.8} fill={accent} opacity={0.45} />
      <rect x={0} y={8} width={360} height={12} />
      <path d={range(18).map((k) => quatrefoil(10 + k * 20, 14, 7)).join(" ")} fill="#ffeec8" opacity={0.1} />
      <rect x={0} y={7} width={360} height={0.7} fill={accent} opacity={0.4} />
      {BELFRY_COLUMNS.map((x) => (
        <g key={`p${x}`}>
          <path d={`M${x - 5},20 V6 L${x},-6 L${x + 5},6 V20 Z`} />
          <path d={`M${x},-6 L${x + 5},6 V20`} fill="none" stroke={accent} strokeWidth={0.5} opacity={0.45} />
        </g>
      ))}
    </>
  );
}

/**
 * 参道の手前: 三本の蝋燭を立てた背の高い燭台（炎のまわりがほのかに明るい）、床に落ちた一枚の白い羽根（雲海の羽根）、
 * 床を這う薄い雲
 */
function candleStand(x: number, h: number, accent: string, key: string) {
  const top = 100 - h;
  return (
    <g key={key}>
      <circle cx={x} cy={top - 8} r={16} fill={accent} opacity={0.08} />
      <circle cx={x} cy={top - 8} r={7} fill={accent} opacity={0.12} />
      {/* 三本脚と、節のある軸 */}
      <path d={`M${x - 9},100 L${x - 1.4},${100 - 12} L${x + 1.4},${100 - 12} L${x + 9},100 L${x + 7},100 L${x},${100 - 8} L${x - 7},100 Z`} />
      <rect x={x - 1} y={top} width={2} height={h - 10} />
      {[0.3, 0.62].map((f) => (
        <ellipse key={f} cx={x} cy={top + (h - 10) * f} rx={2.6} ry={1.4} />
      ))}
      {/* 受け皿と枝、蝋燭 */}
      <path d={`M${x - 11},${top} Q${x},${top + 6} ${x + 11},${top} H${x + 12} Q${x},${top + 8} ${x - 12},${top} Z`} />
      {[-9, 0, 9].map((dx, k) => {
        const ch = k === 1 ? 9 : 6.5;
        const cy = top - (k === 1 ? 4 : 0);
        return (
          <g key={dx}>
            {k !== 1 && <path d={`M${x},${top - 1} Q${x + dx * 0.6},${top - 1} ${x + dx},${cy}`} fill="none" stroke="currentColor" strokeWidth={1} />}
            <rect x={x + dx - 1.6} y={cy - ch} width={3.2} height={ch} fill="#efe6d6" opacity={0.75} />
            <rect x={x + dx - 3} y={cy} width={6} height={1.2} />
            <path d={`M${x + dx},${cy - ch - 6} C${x + dx + 1.6},${cy - ch - 3} ${x + dx + 1.4},${cy - ch - 0.6} ${x + dx},${cy - ch - 0.4} C${x + dx - 1.4},${cy - ch - 0.6} ${x + dx - 1.6},${cy - ch - 3} ${x + dx},${cy - ch - 6} Z`} fill="#ffe2a8" className="expedition-flame" />
            <circle cx={x + dx} cy={cy - ch - 2.4} r={3.2} fill={accent} opacity={0.25} />
          </g>
        );
      })}
      <path d={`M${x + 1},${top} V${100 - 12}`} stroke={accent} strokeWidth={0.4} opacity={0.4} />
    </g>
  );
}
function sanctumFore(accent: string) {
  const wisp = gradId("fore-wisp", accent);
  return (
    <>
      <defs>
        <radialGradient id={wisp}>
          <stop offset="0" stopColor="#e6dcf0" stopOpacity="0.28" />
          <stop offset="1" stopColor="#e6dcf0" stopOpacity="0" />
        </radialGradient>
      </defs>
      {[[60, 30], [250, 44], [420, 36], [560, 28]].map(([x, rx]) => (
        <ellipse key={x} cx={x} cy={96} rx={rx} ry={6} fill={`url(#${wisp})`} />
      ))}
      {candleStand(130, 64, accent, "c1")}
      {candleStand(470, 52, accent, "c2")}
      {/* 白い羽根: 軸と、片側に流れる羽枝 */}
      <g transform="translate(300 98) rotate(-8)">
        <path d="M-14,0 C-8,-4 4,-5 14,-2 C6,1 -6,2 -14,0 Z" fill="#f2ece4" opacity={0.8} />
        <path d="M-17,0.4 L14,-2" stroke="#f8f2ea" strokeWidth={0.5} opacity={0.9} />
        <path d="M-6,-2.4 l2,-1.8 M0,-3.2 l2,-1.6 M6,-3.4 l1.6,-1.2" stroke="#f2ece4" strokeWidth={0.4} opacity={0.6} />
      </g>
    </>
  );
}

/* ---------- 星天の塔 ---------- */

/** 星天の塔の床: 星空を淡く映す硝子の床。灯の照り返しと、映り込んだ星、流れる光の筋 */
function starglass(accent: string) {
  const id = gradId("starglass", accent);
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.28" />
          <stop offset="0.35" stopColor={accent} stopOpacity="0.08" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x={0} y={GROUND} width={400} height={64 - GROUND} />
      <rect x={0} y={GROUND} width={400} height={64 - GROUND} fill={`url(#${id})`} />
      <rect x={0} y={GROUND} width={400} height={0.7} fill="#ffffff" opacity={0.35} />
      {range(24).map((i) => (
        <circle key={i} cx={rand(i, 90) * 400} cy={GROUND + 4 + rand(i, 91) * 50} r={0.3 + rand(i, 92) * 0.6} fill="#e8e0ff" opacity={0.25 + rand(i, 93) * 0.35} />
      ))}
      <path d="M40,24 L120,24 M210,40 L260,40 M300,18 L380,18" stroke="#ffffff" strokeWidth={0.4} opacity={0.12} />
    </>
  );
}


/**
 * 浮かぶ島。上面はわずかに起伏する岩棚で、縁が灯を受ける。下は幾層もの岩が重なって先細りに垂れ、
 * 光を受ける右の面は明るく、下ほど暗い。根と鎖が下がり、先に結晶が灯る。縁からは星屑が滝のように零れ落ちる。
 * detail が大きい島には、折れた柱やアーチの残骸、小さな結晶の群れを載せる
 */
function floatingIsle(x: number, y: number, w: number, i: number, accent: string, detail: number) {
  const id = gradId("isle", accent);
  const depth = w * 0.62;
  const p = (px: number, py: number) => `${px.toFixed(1)},${py.toFixed(1)}`;
  // 上面: わずかな起伏
  const top = range(9)
    .map((k) => {
      const t = k / 8;
      return p(x + w * t, y - Math.sin(t * Math.PI) * 2.5 - (rand(i * 13 + k, 80) - 0.5) * 2.4);
    })
    .join(" L");
  // 下面: 岩の層が重なって先細りに垂れる
  const strata = [1, 0.72, 0.46].map((scale, layer) => {
    const lw = w * (1 - layer * 0.16);
    const lx = x + (w - lw) / 2 + (layer % 2 ? w * 0.05 : -w * 0.03);
    const ly = y + 4 + layer * depth * 0.18;
    const pts = range(9)
      .map((k) => {
        const t = 1 - k / 8;
        const dip = Math.sin(t * Math.PI) ** 0.8 * depth * scale * (0.6 + rand(i * 17 + k + layer * 5, 81) * 0.4);
        return p(lx + lw * t, ly + dip);
      })
      .join(" L");
    return `M${p(lx, ly)} L${p(lx + lw, ly)} L${pts} Z`;
  });
  const tipX = x + w * (0.45 + rand(i, 82) * 0.1);
  return (
    <g key={i}>
      {/* 島の下に滲む光 */}
      <ellipse cx={x + w / 2} cy={y + depth * 0.7} rx={w * 0.6} ry={depth * 0.55} fill={`url(#${id}-glow)`} />
      {/* 縁から零れ落ちる星屑の滝 */}
      {detail > 0 && (
        <g>
          <rect x={x + w * 0.86} y={y} width={1.6} height={depth * 1.6} fill={`url(#${id}-fall)`} />
          {range(5).map((k) => (
            <circle key={k} cx={x + w * 0.86 + 0.8 + (rand(i * 7 + k, 83) - 0.5) * 3} cy={y + 8 + k * depth * 0.28} r={0.5} fill="#ffffff" opacity={0.8 - k * 0.14} />
          ))}
        </g>
      )}
      {strata.map((d, k) => (
        <path key={k} d={d} />
      ))}
      <path d={`M${p(x, y + 4)} L${top} L${p(x + w, y + 4)} Z`} />
      {/* 光を受ける右の面と、下ほど暗い陰 */}
      {strata.map((d, k) => (
        <path key={k} d={d} fill={`url(#${id}-light)`} />
      ))}
      {strata.map((d, k) => (
        <path key={k} d={d} fill={`url(#${id}-shade)`} />
      ))}
      {/* 岩の層の境目 */}
      <path d={`M${p(x + w * 0.1, y + depth * 0.2)} Q${p(x + w * 0.5, y + depth * 0.26)} ${p(x + w * 0.88, y + depth * 0.18)} M${p(x + w * 0.22, y + depth * 0.42)} Q${p(x + w * 0.5, y + depth * 0.48)} ${p(x + w * 0.76, y + depth * 0.4)}`} fill="none" stroke={accent} strokeWidth={0.4} opacity={0.16} />
      {/* 灯を受ける上の縁 */}
      <path d={`M${top}`} fill="none" stroke={accent} strokeWidth={0.8} opacity={0.55} />
      {/* 下がる根と、鎖の先の結晶 */}
      <path d={`M${p(tipX - 6, y + depth * 0.6)} C${p(tipX - 9, y + depth * 0.85)} ${p(tipX - 3, y + depth)} ${p(tipX - 6, y + depth * 1.2)}`} fill="none" stroke="currentColor" strokeWidth={0.7} />
      <path d={`M${p(tipX + 4, y + depth * 0.7)} V${(y + depth * 0.7 + 14).toFixed(1)}`} stroke="currentColor" strokeWidth={0.7} strokeDasharray="1.6 1" />
      <path d={`M${p(tipX + 4, y + depth * 0.7 + 14)} l2.2,3.6 l-2.2,4.6 l-2.2,-4.6 Z`} fill={accent} opacity={0.85} />
      <circle cx={tipX + 4} cy={y + depth * 0.7 + 18} r={4} fill={accent} opacity={0.15} />
      {/* 上に載る残骸と結晶 */}
      {detail > 1 && (
        <g>
          <path d={`M${p(x + w * 0.2, y - 1)} V${(y - w * 0.32).toFixed(1)} L${p(x + w * 0.23, y - w * 0.36)} L${p(x + w * 0.26, y - w * 0.3)} L${p(x + w * 0.28, y - w * 0.34)} V${(y - 1).toFixed(1)} Z`} />
          {/* 崩れたアーチ: 外の弧と内の弧のあいだの石 */}
          <path
            d={`M${p(x + w * 0.5, y - 1)} V${(y - w * 0.26).toFixed(1)} A${(w * 0.1).toFixed(1)},${(w * 0.1).toFixed(1)} 0 0,1 ${p(x + w * 0.7, y - w * 0.26)} V${(y - 1).toFixed(1)} L${p(x + w * 0.66, y - 1)} V${(y - w * 0.24).toFixed(1)} A${(w * 0.06).toFixed(1)},${(w * 0.06).toFixed(1)} 0 0,0 ${p(x + w * 0.54, y - w * 0.24)} V${(y - 1).toFixed(1)} Z`}
          />
          <path d={`M${p(x + w * 0.2, y - w * 0.32)} V${(y - 1).toFixed(1)}`} stroke={accent} strokeWidth={0.4} opacity={0.3} />
        </g>
      )}
      {detail > 0 &&
        [[0.78, 9], [0.83, 13], [0.88, 7]].map(([t, h], k) => (
          <g key={k}>
            <path d={`M${p(x + w * t - 2, y)} L${p(x + w * t, y - h)} L${p(x + w * t + 2, y)} Z`} fill={accent} opacity={0.55} />
            <path d={`M${p(x + w * t, y)} L${p(x + w * t, y - h)}`} stroke="#ffffff" strokeWidth={0.3} opacity={0.5} />
          </g>
        ))}
    </g>
  );
}
function isleDefs(accent: string) {
  const id = gradId("isle", accent);
  return (
    <defs>
      <radialGradient id={`${id}-glow`} cx="0.5" cy="0.3" r="0.5">
        <stop offset="0" stopColor={accent} stopOpacity="0.2" />
        <stop offset="1" stopColor={accent} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-light`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0.45" stopColor={accent} stopOpacity="0" />
        <stop offset="1" stopColor={accent} stopOpacity="0.22" />
      </linearGradient>
      <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000000" stopOpacity="0" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.5" />
      </linearGradient>
      <linearGradient id={`${id}-fall`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.75" />
        <stop offset="0.3" stopColor={accent} stopOpacity="0.45" />
        <stop offset="1" stopColor={accent} stopOpacity="0" />
      </linearGradient>
    </defs>
  );
}
/** 手前の浮島: 大きな島に残骸と結晶、宙に浮かぶ階段の欠片 */
function fragments(accent: string) {
  return (
    <>
      {isleDefs(accent)}
      {floatingIsle(16, 108, 96, 0, accent, 2)}
      {floatingIsle(176, 64, 58, 1, accent, 1)}
      {floatingIsle(290, 128, 104, 2, accent, 2)}
      {/* 宙に浮かぶ階段の欠片（段の下にも岩が残る） */}
      {range(5).map((i) => (
        <g key={i}>
          <path d={`M${238 + i * 12},${150 - i * 12} h13 v3.4 l-3.4,5.6 h-6.4 l-3.2,-5.6 Z`} />
          <path d={`M${238 + i * 12},${150 - i * 12} h13`} stroke={accent} strokeWidth={0.5} opacity={0.45} />
        </g>
      ))}
    </>
  );
}
/** 遠くの浮島: 小さく霞んだ島が散らばる */
function farIsles(accent: string) {
  return (
    <>
      {isleDefs(accent)}
      {floatingIsle(30, 70, 40, 10, accent, 0)}
      {floatingIsle(140, 120, 28, 11, accent, 0)}
      {floatingIsle(230, 50, 54, 12, accent, 1)}
      {floatingIsle(360, 100, 34, 13, accent, 0)}
      {floatingIsle(440, 140, 24, 14, accent, 0)}
    </>
  );
}


export const ART: Record<ExpeditionArt, Art> = {
  constellations: { width: 500, height: 200, render: constellations },
  domes: { width: 480, height: 220, render: domes },
  balustrade: { width: 200, height: 64, render: balustrade },
  clocktower: { width: 420, height: 260, render: clocktower },
  icepillars: { width: 360, height: 220, render: icepillars },
  alchemy: { width: 420, height: 220, render: alchemy },
  skyisles: { width: 500, height: 200, render: skyisles },
  belfry: { width: 360, height: 220, render: belfry },
  cloudsea: { width: 500, height: 120, render: cloudSea },
  sanctumfore: { width: 600, height: 100, render: sanctumFore },
  fragments: { width: 420, height: 220, render: fragments },
  farisles: { width: 500, height: 200, render: farIsles },
  starglass: {
    width: 400,
    height: 64,
    render: starglass,
  },
  pines: { width: 400, height: 200, render: () => <path d={PINE_D} /> },
  trunks: { width: 400, height: 200, render: trunks },
  undergrowth: { width: 600, height: 120, render: undergrowth },
  cathedral: { width: 360, height: 240, render: cathedral },
  desk: { width: 900, height: 120, render: readingDesk },
  stars: {
    width: 400,
    height: 200,
    render: starfield,
  },
  arches: {
    width: 300,
    height: 200,
    render: () => <path d={archesPath} fillRule="evenodd" />,
  },
  // 書架の上に燭台を立てる分だけ、上に余白を取る
  shelves: {
    width: 360,
    height: 224,
    render: (accent) => <g transform="translate(0 24)">{[bookcase(10, 0, accent), bookcase(190, 1, accent)]}</g>,
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
  // 煙を描く分だけ、上に余白を取る
  foundry: { width: 480, height: 300, render: (accent) => <g transform="translate(0 80)">{foundry(accent)}</g> },
  foundryfar: { width: 520, height: 200, render: foundryFar },
  embers: { width: 600, height: 100, render: embers },
  crystals: { width: 400, height: 200, render: crystalField },
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
  clouds: { width: 500, height: 100, render: cloudBank },
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
  // 大聖堂の床: 磨いた大理石の板に、星冠の光が映る。淡い石目と、金の象嵌の帯と菱形
  marble: {
    width: 400,
    height: 64,
    render: (accent) => (
      <>
        <defs>
          <linearGradient id={gradId("marble", accent)} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={accent} stopOpacity="0.2" />
            <stop offset="0.5" stopColor={accent} stopOpacity="0.05" />
            <stop offset="1" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x={0} y={GROUND} width={400} height={64 - GROUND} />
        <rect x={0} y={GROUND} width={400} height={64 - GROUND} fill={`url(#${gradId("marble", accent)})`} />
        <rect x={0} y={GROUND} width={400} height={0.8} fill={accent} opacity={0.45} />
        <path d="M0,30 H400 M0,50 H400 M100,6 V30 M300,6 V30 M0,30 V50 M200,30 V50 M400,30 V50 M100,50 V64 M300,50 V64" stroke={accent} strokeWidth={0.5} opacity={0.12} fill="none" />
        <path
          d="M8,22 C30,18 52,26 80,20 M130,14 C160,20 186,12 230,18 M246,26 C270,22 290,28 320,24 M330,12 C350,16 372,10 396,15 M20,42 C60,38 90,46 140,40 M220,44 C260,40 300,47 360,41 M60,58 C100,55 140,60 190,56"
          stroke="#ffffff"
          strokeWidth={0.4}
          opacity={0.06}
          fill="none"
        />
        <rect x={0} y={11} width={400} height={0.6} fill={accent} opacity={0.3} />
        <rect x={0} y={13} width={400} height={0.3} fill={accent} opacity={0.18} />
        {[0, 200, 400].map((x) => (
          <path key={x} d={`M${x},34 L${x + 6},40 L${x},46 L${x - 6},40 Z`} fill="none" stroke={accent} strokeWidth={0.5} opacity={0.3} />
        ))}
      </>
    ),
  },
  // 魔導炉の床: 黒い石を敷き、炉の火がぼんやり映る。ひびは枝分かれしながら走り、奥で熾火が光る（芯は細く明るく、まわりに淡い滲み）
  magma: {
    width: 400,
    height: 64,
    render: (accent) => (
      <>
        <defs>
          <linearGradient id={gradId("magma", accent)} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={accent} stopOpacity="0.2" />
            <stop offset="0.5" stopColor={accent} stopOpacity="0.05" />
            <stop offset="1" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x={0} y={GROUND} width={400} height={64 - GROUND} />
        <rect x={0} y={GROUND} width={400} height={64 - GROUND} fill={`url(#${gradId("magma", accent)})`} />
        <rect x={0} y={GROUND} width={400} height={0.8} fill={accent} opacity={0.45} />
        <path
          d="M0,24 H400 M0,44 H400 M70,6 V24 M190,6 V24 M310,6 V24 M130,24 V44 M250,24 V44 M370,24 V44 M20,44 V64 M160,44 V64 M290,44 V64"
          stroke={accent}
          strokeWidth={0.6}
          opacity={0.1}
          fill="none"
        />
        <g className="expedition-flame" fill="none" strokeLinejoin="round" strokeLinecap="round">
          <path d={MAGMA_CRACKS.main} stroke={accent} strokeWidth={3} opacity={0.12} />
          <path d={MAGMA_CRACKS.main} stroke={accent} strokeWidth={0.9} opacity={0.5} />
          <path d={MAGMA_CRACKS.main} stroke="#ffd9a0" strokeWidth={0.35} opacity={0.7} />
          <path d={MAGMA_CRACKS.branches} stroke={accent} strokeWidth={0.5} opacity={0.35} />
        </g>
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
        // 塗りだけをずらして敷く（stroke を付けると、塗った形すべてに輪郭線が付いてしまう）
        <g transform="translate(0 -1.2)" fill={accent} opacity={rim} style={{ color: accent }}>
          {art.render(accent)}
        </g>
      )}
      {art.render(accent)}
    </svg>
  );
}
