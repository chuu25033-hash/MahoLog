// 探索の景色: 詠唱の間、魔法使いの少女が滞在中のエリアを歩む横スクロールの舞台。
// ここには舞台の「定義」（空の色・重ねる層・漂う粒子）だけを置き、層に描く絵（SVG）や画像の読み込みは
// components/expedition/backdrop-art.tsx が受け持つ。新しい舞台は EXPEDITION_SCENES に足し、
// どのエリアで使うかを SCENE_OF_AMBIENCE（または SCENE_OF_AREA）に書けばよい
import type { AmbienceKind, Area } from "./areas";

/** 層に描く絵の名前（components/expedition/backdrop-art.tsx の ART に対応） */
export type ExpeditionArt =
  | "stars"
  | "arches"
  | "shelves"
  | "trees"
  | "spires"
  | "crystals"
  | "icicles"
  | "forge"
  | "clouds"
  | "floor"
  | "grass";

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
  layers: ExpeditionLayer[];
};

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

export const EXPEDITION_SCENES = {
  library: {
    id: "library",
    name: "古い書庫",
    sky: ["#0b0a14", "#1a1424", "#2b1f22"],
    glow: "#e8b86a",
    motes: { kind: "float", color: "#f4d9a0" },
    layers: [
      { source: { art: "arches" }, height: 0.92, bottom: EXPEDITION_FLOOR - 0.02, speed: 0.22, color: "#261d2c", opacity: 0.85 },
      { source: { art: "shelves" }, height: 0.62, bottom: EXPEDITION_FLOOR - 0.01, speed: 0.55, color: "#120d16", accent: "#e8b86a" },
      floor("#07060a", "#e8b86a"),
    ],
  },
  forest: {
    id: "forest",
    name: "月明かりの森",
    sky: ["#050d0d", "#0c201d", "#16362c"],
    glow: "#8fdcc4",
    motes: { kind: "float", color: "#d7f5a8" },
    layers: [
      { source: { art: "stars" }, height: 0.6, bottom: 0.4, speed: 0.04, color: "#d7f5a8", opacity: 0.5 },
      { source: { art: "trees" }, height: 0.55, bottom: EXPEDITION_FLOOR + 0.04, speed: 0.2, color: "#13302a", opacity: 0.9 },
      { source: { art: "trees" }, height: 0.78, bottom: EXPEDITION_FLOOR - 0.02, speed: 0.55, color: "#07130f" },
      floor("#040907", "#d7f5a8", "grass"),
    ],
  },
  observatory: {
    id: "observatory",
    name: "星空の塔",
    sky: ["#04051a", "#0d1336", "#1c204c"],
    glow: "#8db7f2",
    motes: { kind: "float", color: "#e2c974" },
    layers: [
      { source: { art: "stars" }, height: 0.75, bottom: 0.25, speed: 0.04, color: "#e6eeff", opacity: 0.8 },
      { source: { art: "spires" }, height: 0.7, bottom: EXPEDITION_FLOOR - 0.02, speed: 0.22, color: "#141a3a", accent: "#e2c974" },
      { source: { art: "arches" }, height: 0.5, bottom: EXPEDITION_FLOOR - 0.01, speed: 0.55, color: "#080b1e", opacity: 0.95 },
      floor("#05061a", "#8db7f2"),
    ],
  },
  frost: {
    id: "frost",
    name: "蒼氷の回廊",
    sky: ["#060c18", "#0f2034", "#1b3550"],
    glow: "#cfe9ff",
    motes: { kind: "fall", color: "#e6f4ff" },
    layers: [
      { source: { art: "arches" }, height: 0.9, bottom: EXPEDITION_FLOOR - 0.02, speed: 0.2, color: "#17304a", opacity: 0.8 },
      { source: { art: "crystals" }, height: 0.42, bottom: EXPEDITION_FLOOR - 0.01, speed: 0.55, color: "#0b1a2c", accent: "#71e2ef" },
      { source: { art: "icicles" }, height: 0.2, bottom: 0.8, speed: 0.55, color: "#0a1624", accent: "#cfe9ff" },
      floor("#050c16", "#cfe9ff"),
    ],
  },
  forge: {
    id: "forge",
    name: "紅蓮の工房",
    sky: ["#110505", "#270d09", "#3d190f"],
    glow: "#f2a38d",
    motes: { kind: "rise", color: "#f2c27a" },
    layers: [
      { source: { art: "spires" }, height: 0.6, bottom: EXPEDITION_FLOOR, speed: 0.15, color: "#2a110d", accent: "#f2a38d", opacity: 0.8 },
      { source: { art: "forge" }, height: 0.6, bottom: EXPEDITION_FLOOR - 0.01, speed: 0.5, color: "#120706", accent: "#f2c27a" },
      floor("#0b0404", "#f2a38d"),
    ],
  },
  sanctum: {
    id: "sanctum",
    name: "天空の聖堂",
    sky: ["#0d0c1a", "#221f36", "#3a3348"],
    glow: "#fbf3d4",
    motes: { kind: "float", color: "#fbf3d4" },
    layers: [
      { source: { art: "clouds" }, height: 0.4, bottom: 0.3, speed: 0.08, color: "#4a4462", opacity: 0.55 },
      { source: { art: "arches" }, height: 0.86, bottom: EXPEDITION_FLOOR - 0.02, speed: 0.4, color: "#16141f", opacity: 0.95 },
      { source: { art: "clouds" }, height: 0.18, bottom: 0.02, speed: 0.75, color: "#2c2840", opacity: 0.7 },
      floor("#0b0a14", "#e2c974"),
    ],
  },
  zenith: {
    id: "zenith",
    name: "星天の塔",
    sky: ["#04030c", "#110a28", "#1e1340"],
    glow: "#a882fb",
    motes: { kind: "float", color: "#71e2ef" },
    layers: [
      { source: { art: "stars" }, height: 1, bottom: 0, speed: 0.04, color: "#e6eeff", opacity: 0.9 },
      { source: { art: "clouds" }, height: 0.3, bottom: 0.05, speed: 0.15, color: "#2a2050", opacity: 0.6 },
      { source: { art: "spires" }, height: 0.55, bottom: EXPEDITION_FLOOR - 0.02, speed: 0.3, color: "#0c0820", accent: "#71e2ef" },
      floor("#06041a", "#a882fb"),
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
