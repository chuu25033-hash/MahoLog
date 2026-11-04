// 探索の景色: 詠唱の間、魔法使いの少女が滞在中のエリアを歩む横スクロールの舞台。
// ここには舞台の「定義」（空の色・重ねる層・漂う粒子）だけを置き、層に描く絵（SVG）や画像の読み込みは
// components/expedition/backdrop-art.tsx が受け持つ。新しい舞台は EXPEDITION_SCENES に足し、
// どのエリアで使うかを SCENE_OF_AMBIENCE（または SCENE_OF_AREA）に書けばよい
import type { AmbienceKind, Area } from "./areas";

/** 層に描く絵の名前（components/expedition/backdrop-art.tsx の ART に対応） */
export type ExpeditionArt =
  | "stars"
  | "arches"
  | "cathedral"
  | "desk"
  | "shelves"
  | "trees"
  | "pines"
  | "trunks"
  | "undergrowth"
  | "foundry"
  | "foundryfar"
  | "embers"
  | "crystals"
  | "icicles"
  | "forge"
  | "clouds"
  | "floor"
  | "grass"
  | "magma"
  | "marble"
  | "constellations"
  | "domes"
  | "balustrade"
  | "clocktower"
  | "icepillars"
  | "alchemy"
  | "skyisles"
  | "belfry"
  | "cloudsea"
  | "sanctumfore"
  | "fragments"
  | "farisles"
  | "starglass";

/** 層の絵の出どころ。描く絵か、public に置いた画像（横に継ぎ目なく繋がるもの） */
export type ExpeditionSource = { art: ExpeditionArt } | { image: string; /** 幅 ÷ 高さ */ aspect: number };

export type ExpeditionLayer = {
  source: ExpeditionSource;
  /** 層の高さ（舞台の高さに対する割合） */
  height: number;
  /** 層の下端の位置（舞台の高さに対する割合。0 で床の高さ） */
  bottom: number;
  /** 流れる速さ（少女の足元の床 = 1。遠い層ほど小さく） */
  speed: number;
  /** 影絵の色 */
  color: string;
  /** 窓の灯・熾火など、影絵に添える光の色 */
  accent?: string;
  opacity?: number;
  /** 影絵の上の縁に差す光（accent の色）の強さ。0〜1 */
  rim?: number;
};

/** 層と層の間に漂う霞。遠い層ほど霞んで見え、奥行きが出る */
export type ExpeditionHaze = {
  haze: string;
  /** 霞の帯の下端と高さ（舞台の高さに対する割合） */
  bottom: number;
  height: number;
  opacity: number;
};

/** 舞台に漂う粒子の動き */
export type ExpeditionMote = "fall" | "rise" | "float";

export type ExpeditionScene = {
  id: string;
  name: string;
  /** 空のグラデーション（上 → 地平） */
  sky: [string, string, string];
  /** 地平に滲む光の色 */
  glow: string;
  motes: { kind: ExpeditionMote; color: string };
  /** 奥から手前の順に重ねる */
  layers: (ExpeditionLayer | ExpeditionHaze)[];
  /** 空に掛かる、流れない大きな物（components/expedition/sky-objects.tsx） */
  celestial?: ExpeditionCelestial[];
  /** 景色全体を沈める暗さ（0〜1）。どの舞台も、書庫と同じ薄暗さにそろえる（少女は沈めない） */
  dim?: number;
  /** 窓や月から差し込む光の筋 */
  rays?: { color: string; opacity: number; from: "left" | "right" };
};

/**
 * 空に掛かる物。写真のような星空・月・天文盤（観測塔）・オーロラ（大回廊）・炉心（魔導炉）・星冠（大聖堂）・星雲と瞬く星と塔と流れ星（星天の塔）。
 * x・y は舞台に対する割合（塔は下端）、size は舞台の高さに対する割合（オーロラ・星雲・瞬く星・流れ星は空の帯の高さ）
 */
export type ExpeditionCelestial = {
  kind: "starsky" | "moon" | "astrolabe" | "aurora" | "core" | "crown" | "twinkles" | "spire" | "nebula" | "meteor";
  x: number;
  y: number;
  size: number;
  color: string;
  /** 星空（starsky）: 星の並びを決める種・星の多さ（1 が標準）・天の川の傾き（度。無ければ描かない）と明るさ */
  seed?: number;
  density?: number;
  milkyWay?: number;
  milkyGlow?: number;
};

export const isHaze = (layer: ExpeditionLayer | ExpeditionHaze): layer is ExpeditionHaze => "haze" in layer;

/** 少女の足元の床。どの舞台でもこの高さを歩く */
export const EXPEDITION_FLOOR = 0.16;

const floor = (color: string, accent: string, art: ExpeditionArt = "floor"): ExpeditionLayer => ({
  source: { art },
  height: EXPEDITION_FLOOR,
  bottom: 0,
  speed: 1,
  color,
  accent,
});

/** 床の地面の線の高さ。下端に据えた器具などは、層の下端をここに合わせて床に立たせる */
const ON_FLOOR = EXPEDITION_FLOOR * (1 - 6 / 64);

const haze = (color: string, bottom: number, height: number, opacity: number): ExpeditionHaze => ({ haze: color, bottom, height, opacity });

export const EXPEDITION_SCENES = {
  // STAGE 1 始まりの書斎: 外からの冷たい月明かりと、内の温かな蝋燭の灯。尖頭窓の向こうに星空と月が透け、
  // 燭台の灯る書架の前を、ときおり灯火の机が通り過ぎる
  library: {
    id: "library",
    name: "古い書庫",
    sky: ["#04060f", "#0b0d1e", "#1c1626"],
    glow: "#e8b86a",
    motes: { kind: "float", color: "#f4d9a0" },
    celestial: [
      { kind: "starsky", x: 0, y: 0, size: 1, color: "#ffffff", seed: 11, density: 0.9, milkyWay: 34, milkyGlow: 0.5 },
      { kind: "moon", x: 0.78, y: 0.24, size: 0.12, color: "#eef1ff" },
    ],
    rays: { color: "#cfdcff", opacity: 0.12, from: "right" },
    layers: [
      { source: { art: "cathedral" }, height: 0.95, bottom: EXPEDITION_FLOOR - 0.02, speed: 0.18, color: "#140e15", accent: "#bcd0ff", rim: 0.14 },
      haze("#3a2618", EXPEDITION_FLOOR, 0.42, 0.5),
      { source: { art: "shelves" }, height: 0.62, bottom: EXPEDITION_FLOOR - 0.01, speed: 0.55, color: "#0d090f", accent: "#e8b86a", rim: 0.18 },
      haze("#2a1c1c", EXPEDITION_FLOOR - 0.02, 0.1, 0.45),
      { source: { art: "desk" }, height: 0.2, bottom: ON_FLOOR, speed: 0.85, color: "#08060a", accent: "#f2c27a", rim: 0.15 },
      floor("#07060a", "#e8b86a"),
    ],
  },
  forest: {
    id: "forest",
    dim: 0.12,
    name: "月明かりの森",
    sky: ["#040a0c", "#0b1c1c", "#153229"],
    glow: "#8fdcc4",
    motes: { kind: "float", color: "#d7f5a8" },
    celestial: [{ kind: "starsky", x: 0, y: 0, size: 1, color: "#ffffff", seed: 5, density: 0.55 }, { kind: "moon", x: 0.74, y: 0.2, size: 0.13, color: "#e6f6dc" }],
    rays: { color: "#d7f5e8", opacity: 0.1, from: "right" },
    layers: [
      { source: { art: "pines" }, height: 0.5, bottom: EXPEDITION_FLOOR + 0.06, speed: 0.12, color: "#1a3a33", opacity: 0.7 },
      haze("#2c5a4a", EXPEDITION_FLOOR + 0.04, 0.32, 0.45),
      { source: { art: "pines" }, height: 0.66, bottom: EXPEDITION_FLOOR + 0.01, speed: 0.25, color: "#0f241e", opacity: 0.95, accent: "#a8e6c8", rim: 0.14 },
      haze("#1d4034", EXPEDITION_FLOOR, 0.22, 0.55),
      { source: { art: "trunks" }, height: 1.02, bottom: EXPEDITION_FLOOR - 0.03, speed: 0.6, color: "#040a08", accent: "#d7f5a8", rim: 0.16 },
      haze("#1d4034", EXPEDITION_FLOOR - 0.02, 0.1, 0.35),
      { source: { art: "undergrowth" }, height: 0.28, bottom: ON_FLOOR - 0.004, speed: 0.88, color: "#030806", accent: "#d7f5a8", rim: 0.18 },
      floor("#030806", "#d7f5a8", "grass"),
    ],
  },
  // STAGE 3 星空の観測塔（刻の崩壊）: 歯の欠けた天文盤が空に掛かり、星座の線が星（誰かの一夜）を結ぶ
  observatory: {
    id: "observatory",
    dim: 0.3,
    name: "星空の観測塔",
    sky: ["#02031a", "#0a1036", "#1b1e4e"],
    glow: "#8db7f2",
    motes: { kind: "float", color: "#e2c974" },
    celestial: [{ kind: "starsky", x: 0, y: 0, size: 1, color: "#ffffff", seed: 3, density: 1, milkyWay: 28, milkyGlow: 0.45 }, { kind: "astrolabe", x: 0.68, y: 0.34, size: 0.78, color: "#e2c974" }],
    layers: [
      { source: { art: "constellations" }, height: 0.78, bottom: 0.22, speed: 0.05, color: "#e6eeff", accent: "#e2c974" },
      haze("#2a3270", 0.1, 0.36, 0.55),
      { source: { art: "domes" }, height: 0.56, bottom: EXPEDITION_FLOOR - 0.02, speed: 0.24, color: "#0f1434", accent: "#e2c974", rim: 0.2 },
      haze("#1b1e4e", EXPEDITION_FLOOR - 0.02, 0.16, 0.55),
      { source: { art: "balustrade" }, height: 0.12, bottom: EXPEDITION_FLOOR - 0.005, speed: 0.92, color: "#060818", accent: "#8db7f2", rim: 0.2 },
      floor("#05061a", "#8db7f2"),
    ],
  },
  // STAGE 4 蒼氷の大回廊（大沈黙）: 凍った星脈のオーロラ、針の止まった時計塔、誰かの一時間が凍った氷の柱
  frost: {
    id: "frost",
    dim: 0.3,
    name: "蒼氷の大回廊",
    sky: ["#030914", "#0a1a2e", "#173049"],
    glow: "#cfe9ff",
    motes: { kind: "fall", color: "#e6f4ff" },
    celestial: [{ kind: "starsky", x: 0, y: 0, size: 1, color: "#ffffff", seed: 9, density: 0.8 }, { kind: "aurora", x: 0, y: 0, size: 0.96, color: "#7af0d0" }],
    layers: [
      { source: { art: "clocktower" }, height: 0.74, bottom: EXPEDITION_FLOOR, speed: 0.14, color: "#0e2034", accent: "#bfe3ff", opacity: 0.95, rim: 0.16 },
      haze("#3a6488", EXPEDITION_FLOOR, 0.46, 0.42),
      { source: { art: "icepillars" }, height: 0.72, bottom: EXPEDITION_FLOOR - 0.02, speed: 0.42, color: "#0a1828", accent: "#9be8f5", rim: 0.2 },
      { source: { art: "crystals" }, height: 0.3, bottom: EXPEDITION_FLOOR - 0.01, speed: 0.7, color: "#07131f", accent: "#71e2ef", rim: 0.2 },
      haze("#173049", EXPEDITION_FLOOR - 0.02, 0.08, 0.5),
      floor("#040b14", "#cfe9ff"),
    ],
  },
  // STAGE 5 紅蓮の魔導炉（詠唱の儀式）: 落ちた星が炉心で白く燃え、鉄の環が抱き、ルーンと七芒星の陣が巡る。
  // 奥に煙を上げる煙突と炉の館・溶けた星の流れる水道橋・錬金炉の塔、手前に蒸留器と坩堝・銅の釜、足元に石炭の熾火
  forge: {
    id: "forge",
    dim: 0.3,
    name: "紅蓮の魔導炉",
    sky: ["#0c0303", "#200907", "#3a150c"],
    glow: "#f2a38d",
    motes: { kind: "rise", color: "#f2c27a" },
    celestial: [{ kind: "core", x: 0.64, y: 0.32, size: 0.56, color: "#f2a35d" }],
    rays: { color: "#f2a38d", opacity: 0.06, from: "right" },
    layers: [
      { source: { art: "foundryfar" }, height: 0.5, bottom: EXPEDITION_FLOOR + 0.02, speed: 0.07, color: "#4a2218", accent: "#f0a070", opacity: 0.85, rim: 0.1 },
      haze("#5a2412", EXPEDITION_FLOOR + 0.02, 0.3, 0.4),
      { source: { art: "foundry" }, height: 0.82, bottom: EXPEDITION_FLOOR - 0.01, speed: 0.16, color: "#220c09", accent: "#f0a070", opacity: 0.92, rim: 0.16 },
      haze("#4a1c0e", EXPEDITION_FLOOR - 0.01, 0.22, 0.5),
      { source: { art: "alchemy" }, height: 0.56, bottom: ON_FLOOR, speed: 0.5, color: "#0e0505", accent: "#f2c27a", rim: 0.18 },
      haze("#3a150c", EXPEDITION_FLOOR - 0.02, 0.08, 0.4),
      { source: { art: "embers" }, height: 0.17, bottom: ON_FLOOR - 0.004, speed: 0.88, color: "#070202", accent: "#f2a35d", rim: 0.2 },
      floor("#0a0303", "#f2a35d", "magma"),
    ],
  },
  // STAGE 6 天空の大聖堂（継承）: 夕暮れの雲海の上、金の星冠が光輪をまとって天に掛かり、白い星から光の柱が降りる。
  // 雲に浮かぶ島には大聖堂・礼拝堂・糸杉が立ち、手前は鈴の下がる大理石の尖頭アーチの回廊。足元に燭台と白い羽根、磨いた大理石の床
  sanctum: {
    id: "sanctum",
    dim: 0.32,
    name: "天空の大聖堂",
    sky: ["#100d26", "#38294f", "#7a5a6a"],
    glow: "#fbf3d4",
    motes: { kind: "float", color: "#fbf3d4" },
    celestial: [
      { kind: "starsky", x: 0, y: 0, size: 1, color: "#ffffff", seed: 13, density: 0.4 },
      { kind: "crown", x: 0.66, y: 0.2, size: 0.3, color: "#fbe8b0" },
    ],
    rays: { color: "#fff3c8", opacity: 0.12, from: "right" },
    layers: [
      { source: { art: "cloudsea" }, height: 0.2, bottom: 0.3, speed: 0.04, color: "#6c5a80", accent: "#fde6c4", opacity: 0.55, rim: 0.3 },
      { source: { art: "skyisles" }, height: 0.46, bottom: 0.22, speed: 0.08, color: "#2e2644", accent: "#fbe8b0", opacity: 0.92, rim: 0.22 },
      haze("#8a7088", 0.14, 0.28, 0.42),
      { source: { art: "cloudsea" }, height: 0.26, bottom: 0.06, speed: 0.16, color: "#55476e", accent: "#fde6c4", opacity: 0.9, rim: 0.35 },
      { source: { art: "belfry" }, height: 0.56, bottom: EXPEDITION_FLOOR - 0.02, speed: 0.4, color: "#1e1a2c", accent: "#fbe8b0", rim: 0.22 },
      haze("#6a5868", EXPEDITION_FLOOR - 0.02, 0.08, 0.4),
      { source: { art: "sanctumfore" }, height: 0.2, bottom: ON_FLOOR - 0.004, speed: 0.88, color: "#0f0c18", accent: "#fbe8b0", rim: 0.2 },
      floor("#120f1c", "#fbe8b0", "marble"),
    ],
  },
  // 星天の塔（再創生）: 星雲の漂う空に銀河が渡り、ときおり流れ星が横切る。雲海から星々の間へ巨きな塔が立ち上がり、
  // 岩の層を垂らした浮島から星屑が零れ落ちる。床は星空を映す硝子
  zenith: {
    id: "zenith",
    dim: 0.12,
    name: "星天の塔",
    sky: ["#010008", "#070420", "#1a0f3e"],
    glow: "#a882fb",
    motes: { kind: "float", color: "#cfe2ff" },
    celestial: [
      { kind: "nebula", x: 0, y: 0, size: 0.8, color: "#a882fb" },
      { kind: "starsky", x: 0, y: 0, size: 1, color: "#ffffff", seed: 7, density: 1.4, milkyWay: -22, milkyGlow: 1 },
      { kind: "twinkles", x: 0, y: 0, size: 0.6, color: "#ffffff" },
      { kind: "meteor", x: 0, y: 0, size: 0.6, color: "#ffffff" },
      { kind: "spire", x: 0.8, y: 0.1, size: 1.05, color: "#9fd8ff" },
    ],
    layers: [
      { source: { art: "farisles" }, height: 0.36, bottom: 0.36, speed: 0.07, color: "#241a4c", accent: "#b9a2f7", opacity: 0.75 },
      haze("#3a2a6a", 0.08, 0.36, 0.42),
      { source: { art: "cloudsea" }, height: 0.24, bottom: 0.04, speed: 0.12, color: "#3e3070", accent: "#cfe2ff", opacity: 0.85, rim: 0.3 },
      { source: { art: "fragments" }, height: 0.52, bottom: EXPEDITION_FLOOR + 0.06, speed: 0.22, color: "#130b2e", accent: "#9fd8ff" },
      haze("#1a0f3e", EXPEDITION_FLOOR - 0.02, 0.12, 0.5),
      floor("#07041a", "#b9a2f7", "starglass"),
    ],
  },
} satisfies Record<string, ExpeditionScene>;

export type ExpeditionSceneId = keyof typeof EXPEDITION_SCENES;

/** エリアの雰囲気ごとの舞台 */
const SCENE_OF_AMBIENCE: Record<AmbienceKind, ExpeditionSceneId> = {
  dust: "library",
  firefly: "forest",
  stardust: "observatory",
  snow: "frost",
  ember: "forge",
  halo: "sanctum",
  zenith: "zenith",
};

/** 雰囲気とは別の舞台を使うエリア（エリア ID → 舞台）。特別な景色を用意したエリアはここに足す */
const SCENE_OF_AREA: Partial<Record<string, ExpeditionSceneId>> = {};

/**
 * 滞在中のエリアで歩む舞台。地平の光と粒子は、エリアごとの雰囲気の色（area.ambience.colors）に合わせる
 */
export function expeditionSceneOf(area: Area): ExpeditionScene {
  const scene: ExpeditionScene = EXPEDITION_SCENES[SCENE_OF_AREA[area.id] ?? SCENE_OF_AMBIENCE[area.ambience.kind]];
  const [glow, mote] = area.ambience.colors;
  return { ...scene, glow, motes: { ...scene.motes, color: mote } };
}
