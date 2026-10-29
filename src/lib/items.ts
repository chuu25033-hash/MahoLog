// アイテム定義とドロップ抽選。
// ビジュアルは components/item-art.tsx の幾何学ラインアート（glyph）で描く。
import { AREAS, type Area, type Rarity } from "./areas";

export type Glyph =
  | "hourglass"
  | "vial"
  | "quill"
  | "prism"
  | "compass"
  | "starmap"
  | "scroll"
  | "key"
  | "leaf"
  | "crystal"
  | "flame"
  | "ring"
  | "lantern"
  | "feather"
  | "bell";

type ItemBase = {
  id: string;
  name: string;
  glyph: Glyph;
  /** 発光色 */
  color: string;
};

/** レアC: 次回計測時の MP を補正する消耗品 */
export type CatalystItem = ItemBase & {
  rarity: "C";
  kind: "catalyst";
  multiplier: number;
  effect: string;
  /** 同レア度内の出やすさ */
  weight: number;
};

/** レアB: エリア固有の伝承テキスト付きコレクション */
export type LoreItem = ItemBase & {
  rarity: "B";
  kind: "lore";
  areaId: string;
  lore: string;
};

/** レアA: 魔法陣の発光色・背景を変える永続スキン */
export type SkinItem = ItemBase & {
  rarity: "A";
  kind: "skin";
  stageId: number;
  effect: string;
  skin: Skin;
};

export type Item = CatalystItem | LoreItem | SkinItem;

export type Skin = {
  /** 魔法陣の線 */
  lineColor: string;
  /** 集束する光の粒子 */
  particleColor: string;
  /** 背景に重ねる淡い光 */
  aura: string;
};

export const DEFAULT_SKIN: Skin = { lineColor: "#71e2ef", particleColor: "#e2c974", aura: "rgba(113,226,239,0.10)" };

export const CATALYSTS: CatalystItem[] = [
  { id: "c-hourglass", rarity: "C", kind: "catalyst", name: "星屑の砂時計", glyph: "hourglass", color: "#e2c974", multiplier: 1.5, weight: 3, effect: "次回の詠唱で獲得MP ×1.5" },
  { id: "c-catalyst", rarity: "C", kind: "catalyst", name: "月光の触媒", glyph: "vial", color: "#cfe9ff", multiplier: 1.25, weight: 5, effect: "次回の詠唱で獲得MP ×1.25" },
  { id: "c-prism", rarity: "C", kind: "catalyst", name: "蒼晶のプリズム", glyph: "prism", color: "#71e2ef", multiplier: 1.3, weight: 4, effect: "次回の詠唱で獲得MP ×1.3" },
  { id: "c-quill", rarity: "C", kind: "catalyst", name: "彗星の羽根ペン", glyph: "quill", color: "#e2c974", multiplier: 2, weight: 1, effect: "次回の詠唱で獲得MP ×2.0" },
];

const LORE_GLYPHS: Glyph[] = ["starmap", "scroll", "key", "compass", "leaf", "feather", "bell", "lantern"];

const LORE_TEXT: Record<string, [string, string]> = {
  "1-1": ["溶けかけた蝋燭", "最初の夜、探究者はこの灯りの下で一行だけ文字を覚えた。灯は今も、その一行を覚えている。"],
  "1-2": ["古びた星図の切れ端", "書架の隙間から見つかった星図の断片。描かれた星座は、まだ誰も見たことのない空のものだ。"],
  "1-3": ["封蝋の欠片", "地下書庫の扉を閉ざしていた封蝋。刻まれた紋章は、遥か昔に滅んだ学院のものとされる。"],
  "2-1": ["光る苔の標本", "夜になると淡く光る苔。読書家の足跡にだけ根を張るという。"],
  "2-2": ["大樹の囁き葉", "耳に当てると、大樹がこれまでに聞いた朗読の声がかすかに聞こえる。"],
  "2-3": ["妖精の写本頁", "妖精が書き損じた一頁。文字が少しずつ紙の上を歩き回っている。"],
  "2-4": ["迷宮の根の鍵", "根の迷宮の奥で拾った木の鍵。どの扉に合うのかは、迷宮自身も忘れてしまった。"],
  "3-1": ["螺旋階段の一段", "数えた者は一人もいない階段の、たった一段だけを切り出したもの。"],
  "3-2": ["天文盤の歯車", "天文盤から外れ落ちた小さな歯車。手のひらで今も一年分ゆっくりと回る。"],
  "3-3": ["星読みの手記", "露台に残された手記。最後の頁には『明日の星は、今日より一つ多い』とだけある。"],
  "3-4": ["水晶レンズの破片", "覗き込むと、自分がいつか辿り着く場所の星空が映るという。"],
  "4-1": ["凍った足音", "回廊に閉じ込められた誰かの足音。耳を澄ますと、規則正しく前へ進んでいる。"],
  "4-2": ["氷文字の栞", "氷の中に浮かぶ一文を写し取った栞。溶けることなく、ひんやりと冷たい。"],
  "4-3": ["止まった秒針", "時計塔の秒針。集中している者の傍でだけ、再び時を刻み始める。"],
  "5-1": ["熾火の欠片", "工房の熾火から零れた欠片。消えることのない、小さく静かな熱。"],
  "5-2": ["錬成の配合表", "溶岩槽の縁に刻まれていた配合表。最後の材料の欄は、なぜか空白のままだ。"],
  "5-3": ["火竜の逆鱗", "封印殿に落ちていた一枚の鱗。触れると、遠い寝息が伝わってくる。"],
  "5-4": ["炉心の灯", "紅蓮の心臓部で灯された火。持ち主の魔力に合わせて色を変える。"],
  "6-1": ["雲海の羽根", "参道に舞い落ちた白い羽根。誰の翼から落ちたのか、知る者はいない。"],
  "6-2": ["聖歌の譜面", "身廊に響く聖歌の譜面。音符の代わりに、星の位置が記されている。"],
  "6-3": ["星冠の鈴", "祭壇に供えられていた鈴。鳴らすと、これまでの全ての詠唱がひとつの和音になる。"],
};

const LORE_COLORS = ["#e2c974", "#71e2ef"];

export const LORES: LoreItem[] = AREAS.map((area, i) => ({
  id: `b-${area.id}`,
  rarity: "B",
  kind: "lore",
  name: LORE_TEXT[area.id][0],
  lore: LORE_TEXT[area.id][1],
  areaId: area.id,
  glyph: LORE_GLYPHS[i % LORE_GLYPHS.length],
  color: LORE_COLORS[i % 2],
}));

const skin = (lineColor: string, particleColor: string, aura: string): Skin => ({ lineColor, particleColor, aura });

export const SKINS: SkinItem[] = [
  { id: "a-lantern", rarity: "A", kind: "skin", stageId: 1, name: "琥珀のランタン", glyph: "lantern", color: "#f2c27a", effect: "魔法陣が琥珀色に灯る", skin: skin("#f2c27a", "#fbf3d4", "rgba(242,194,122,0.10)") },
  { id: "a-leaf", rarity: "A", kind: "skin", stageId: 2, name: "翠玉の葉脈", glyph: "leaf", color: "#8fdcc4", effect: "魔法陣が翠玉色の葉脈に変わる", skin: skin("#8fdcc4", "#d7f5a8", "rgba(143,220,196,0.10)") },
  { id: "a-aurora", rarity: "A", kind: "skin", stageId: 3, name: "極光の水晶瓶", glyph: "vial", color: "#9ef0c9", effect: "魔法陣と背景がオーロラ色に揺らめく", skin: skin("#9ef0c9", "#c9b6ff", "rgba(168,130,251,0.14)") },
  { id: "a-frost", rarity: "A", kind: "skin", stageId: 4, name: "氷華の結晶", glyph: "crystal", color: "#cfe9ff", effect: "魔法陣が氷の白光をまとう", skin: skin("#e6f4ff", "#8db7f2", "rgba(207,233,255,0.10)") },
  { id: "a-flame", rarity: "A", kind: "skin", stageId: 5, name: "紅蓮の火種", glyph: "flame", color: "#f2a38d", effect: "魔法陣が紅蓮の炎色に燃える", skin: skin("#f2a38d", "#f2c27a", "rgba(241,154,154,0.10)") },
  { id: "a-crown", rarity: "A", kind: "skin", stageId: 6, name: "天冠の円環", glyph: "ring", color: "#fbf3d4", effect: "魔法陣が天上の白金に輝く", skin: skin("#fbf3d4", "#e2c974", "rgba(251,243,212,0.12)") },
];

/** 星天の導き（1日1回の授かり物）でのみ得られる触媒。宝箱の抽選には含めない */
export const GUIDANCE_CATALYSTS: CatalystItem[] = [
  { id: "g-stardust", rarity: "C", kind: "catalyst", name: "星屑の触媒", glyph: "vial", color: "#f6e9bd", multiplier: 1.2, weight: 0, effect: "次回の詠唱で獲得MP ×1.2" },
  { id: "g-aurora", rarity: "C", kind: "catalyst", name: "極光の輝石", glyph: "crystal", color: "#9ef0c9", multiplier: 1.8, weight: 0, effect: "次回の詠唱で獲得MP ×1.8" },
];

export const ALL_ITEMS: Item[] = [...CATALYSTS, ...GUIDANCE_CATALYSTS, ...LORES, ...SKINS];

export function findItem(id: string | null | undefined): Item | undefined {
  return ALL_ITEMS.find((item) => item.id === id);
}

export const RARITY_LABEL: Record<Rarity, string> = {
  C: "魔法具・触媒",
  B: "伝承の品",
  A: "テーマスキン",
};

/** エリアで抽選対象になるアイテム */
export function dropPool(area: Area): Record<Rarity, Item[]> {
  return {
    C: CATALYSTS,
    B: LORES.filter((l) => l.areaId === area.id),
    A: SKINS.filter((s) => s.stageId <= area.stageId),
  };
}

function pickWeighted<T>(list: T[], weight: (t: T) => number, random: () => number): T {
  const total = list.reduce((acc, t) => acc + weight(t), 0);
  let r = random() * total;
  for (const t of list) {
    r -= weight(t);
    if (r < 0) return t;
  }
  return list[list.length - 1];
}

/**
 * タイマー完了時のドロップ抽選。
 * 1. エリアの確率テーブル（A → B → C の順に区間を割り当て）でレア度を決める
 * 2. そのレア度のプールから1つ選ぶ（触媒は weight、それ以外は等確率）
 */
export function rollDrop(area: Area, random: () => number = Math.random): Item | null {
  const pool = dropPool(area);
  const r = random() * 100;
  let edge = 0;
  for (const rarity of ["A", "B", "C"] as const) {
    edge += area.drops[rarity];
    if (r < edge && pool[rarity].length > 0) {
      return pickWeighted<Item>(pool[rarity], (i) => (i.kind === "catalyst" ? i.weight : 1), random);
    }
  }
  return null;
}
