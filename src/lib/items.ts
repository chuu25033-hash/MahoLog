// アイテム定義とドロップ抽選。
// ビジュアルは svgIcon（lib/glyphs.ts の幾何学ラインアート）を components/item-art.tsx で描く。
import { AREAS, type Area, type Rarity } from "./areas";
import { GLYPHS } from "./glyphs";

/** 図鑑での分類 */
export type ItemType = "触媒" | "伝承" | "装置";

export const ITEM_TYPES: ItemType[] = ["触媒", "伝承", "装置"];

type ItemBase = {
  id: string;
  name: string;
  rarity: Rarity;
  type: ItemType;
  /** 図鑑に記される解読文 */
  flavorText: string;
  /** 1px の幾何学ラインアート（SVG パス） */
  svgIcon: string;
  /** 発光色 */
  color: string;
};

/** 次回の詠唱で MP を補正する消耗品 */
export type CatalystItem = ItemBase & {
  rarity: "C";
  kind: "catalyst";
  multiplier: number;
  effect: string;
  /** 同レア度内の出やすさ */
  weight: number;
};

/** エリア固有の伝承の品（効果なしのコレクション） */
export type LoreItem = ItemBase & {
  rarity: "B";
  kind: "lore";
  areaId: string;
  effect?: undefined;
};

/** 魔法陣の発光色・背景を変える永続スキン */
export type SkinItem = ItemBase & {
  rarity: "A";
  kind: "skin";
  stageId: number;
  effect: string;
  skin: Skin;
};

/** 所持しているだけで加護を与える秘宝 */
export type RelicItem = ItemBase & {
  rarity: "A" | "S";
  kind: "relic";
  /** このステージ以降の宝箱で見つかる */
  stageId: number;
  effect: string;
  blessing: Blessing;
};

/** 秘宝の加護 */
export type Blessing = {
  /** 獲得MPの加算率（0.15 = +15%）。subjects 未指定なら全属性 */
  mp?: { rate: number; subjects?: string[] };
  /** 宝箱のドロップ率の加算率（0.1 = +10%） */
  drop?: number;
};

export type Item = CatalystItem | LoreItem | SkinItem | RelicItem;

export type Skin = {
  /** 魔法陣の線 */
  lineColor: string;
  /** 集束する光の粒子 */
  particleColor: string;
  /** 背景に重ねる淡い光 */
  aura: string;
};

export const DEFAULT_SKIN: Skin = { lineColor: "#71e2ef", particleColor: "#e2c974", aura: "rgba(113,226,239,0.10)" };

const catalyst = (
  id: string,
  name: string,
  icon: keyof typeof GLYPHS,
  color: string,
  multiplier: number,
  weight: number,
  flavorText: string,
): CatalystItem => ({
  id,
  rarity: "C",
  kind: "catalyst",
  type: "触媒",
  name,
  svgIcon: GLYPHS[icon],
  color,
  multiplier,
  weight,
  flavorText,
  effect: `次回の詠唱で獲得MP ×${multiplier.toFixed(multiplier * 10 === Math.round(multiplier * 10) ? 1 : 2)}`,
});

export const CATALYSTS: CatalystItem[] = [
  catalyst("c-hourglass", "星屑の砂時計", "hourglass", "#e2c974", 1.5, 3, "落ちる砂のひと粒ひと粒が、かつて誰かが費やした一分間だという。返すたびに、時は少しだけ濃くなる。"),
  catalyst("c-catalyst", "月光の触媒", "vial", "#cfe9ff", 1.25, 5, "満月の夜にだけ瓶へ汲める月の光。栓を抜くと、静かな集中が部屋を満たしていく。"),
  catalyst("c-prism", "蒼晶のプリズム", "prism", "#71e2ef", 1.3, 4, "散らばった思考を一本の光へ束ねる蒼い結晶。覗けば、学びの道筋が七色に分かれて見える。"),
  catalyst("c-quill", "彗星の羽根ペン", "quill", "#e2c974", 2, 1, "百年に一度、尾を引いて落ちる彗星の羽根。書いた文字は、書き手より先に意味を理解する。"),
];

const LORE_GLYPHS = ["starmap", "scroll", "key", "compass", "leaf", "feather", "bell", "lantern"] as const;

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
  type: "伝承",
  name: LORE_TEXT[area.id][0],
  flavorText: LORE_TEXT[area.id][1],
  areaId: area.id,
  svgIcon: GLYPHS[LORE_GLYPHS[i % LORE_GLYPHS.length]],
  color: LORE_COLORS[i % 2],
}));

const skin = (
  id: string,
  stageId: number,
  name: string,
  icon: keyof typeof GLYPHS,
  color: string,
  effect: string,
  flavorText: string,
  look: Skin,
): SkinItem => ({ id, rarity: "A", kind: "skin", type: "装置", stageId, name, svgIcon: GLYPHS[icon], color, effect, flavorText, skin: look });

export const SKINS: SkinItem[] = [
  skin("a-lantern", 1, "琥珀のランタン", "lantern", "#f2c27a", "魔法陣が琥珀色に灯る", "小屋の梁に吊るされていた古いランタン。火を灯せば、魔法陣の線までもが夕暮れの色に染まる。", { lineColor: "#f2c27a", particleColor: "#fbf3d4", aura: "rgba(242,194,122,0.10)" }),
  skin("a-leaf", 2, "翠玉の葉脈", "leaf", "#8fdcc4", "魔法陣が翠玉色の葉脈に変わる", "樹海の図書室で最も古い樹から落ちた一葉。葉脈をなぞるように、魔力が緑の光となって巡る。", { lineColor: "#8fdcc4", particleColor: "#d7f5a8", aura: "rgba(143,220,196,0.10)" }),
  skin("a-aurora", 3, "極光の水晶瓶", "vial", "#9ef0c9", "魔法陣と背景がオーロラ色に揺らめく", "観測塔の頂で一晩かけて極光を封じ込めた瓶。揺らすたびに、夜空の色が少しずつ移ろう。", { lineColor: "#9ef0c9", particleColor: "#c9b6ff", aura: "rgba(168,130,251,0.14)" }),
  skin("a-frost", 4, "氷華の結晶", "crystal", "#cfe9ff", "魔法陣が氷の白光をまとう", "大回廊の静寂が凍りついて生まれた結晶。触れた魔法陣は、張り詰めた白い光をまとう。", { lineColor: "#e6f4ff", particleColor: "#8db7f2", aura: "rgba(207,233,255,0.10)" }),
  skin("a-flame", 5, "紅蓮の火種", "flame", "#f2a38d", "魔法陣が紅蓮の炎色に燃える", "魔導炉の奥で千年燃え続ける火から分けた種火。魔法陣に灯せば、線は熱を帯びて紅く脈打つ。", { lineColor: "#f2a38d", particleColor: "#f2c27a", aura: "rgba(241,154,154,0.10)" }),
  skin("a-crown", 6, "天冠の円環", "ring", "#fbf3d4", "魔法陣が天上の白金に輝く", "雲上の大聖堂で戴冠を待つ白金の環。秘術を極めた者の魔法陣だけが、この輝きに応える。", { lineColor: "#fbf3d4", particleColor: "#e2c974", aura: "rgba(251,243,212,0.12)" }),
];

const relic = (
  id: string,
  rarity: RelicItem["rarity"],
  type: ItemType,
  stageId: number,
  name: string,
  icon: keyof typeof GLYPHS,
  color: string,
  blessing: Blessing,
  flavorText: string,
): RelicItem => ({ id, rarity, kind: "relic", type, stageId, name, svgIcon: GLYPHS[icon], color, blessing, effect: blessingLabel(blessing), flavorText });

/** 加護の説明文（例: 数学属性の獲得MP +15%） */
function blessingLabel({ mp, drop }: Blessing) {
  return [
    mp && `${mp.subjects ? `${mp.subjects.join("・")}属性` : "全属性"}の獲得MP +${Math.round(mp.rate * 100)}%`,
    drop && `宝箱ドロップ率 +${Math.round(drop * 100)}%`,
  ]
    .filter(Boolean)
    .join(" / ");
}

/** 宝箱の奥に眠る秘宝。所持しているだけで加護が働く */
export const RELICS: RelicItem[] = [
  relic("r-observer", "A", "伝承", 1, "観測者の羊皮紙", "parchment", "#e2c974", { mp: { rate: 0.15, subjects: ["数学"] } }, "古代の観測者が残した羊皮紙。星の動きと魔力の収束点が刻まれている…。数式の余白には、まだ乾かぬインクの染みがある。"),
  relic("r-kotodama", "A", "伝承", 2, "言霊の古文書", "tome", "#e7a9c6", { mp: { rate: 0.15, subjects: ["国語"] } }, "一文字ごとに魂が宿るとされた古文書。声に出して読むと、頁の奥で誰かが小さく頷く。"),
  relic("r-epigraph", "A", "伝承", 2, "異邦の碑文写本", "tablet", "#8fdcc4", { mp: { rate: 0.15, subjects: ["英語"] } }, "海の向こうの碑文を写し取った石板。読めない文字ほど、こちらを読もうとしてくる。"),
  relic("r-alchemist", "A", "伝承", 3, "錬金術師の覚え書き", "scroll", "#e2c974", { mp: { rate: 0.15, subjects: ["理科"] } }, "失敗した錬成の記録ばかりが几帳面に綴られた手帳。最後の頁にだけ、成功の印が小さく描かれている。"),
  relic("r-chronicle", "A", "伝承", 4, "王朝年代記の断簡", "starmap", "#b9a2f7", { mp: { rate: 0.15, subjects: ["社会"] } }, "滅んだ王朝の年代記から破り取られた数頁。並べ直すたびに、歴史は少しだけ違う顔を見せる。"),
  relic("r-starstone", "A", "触媒", 1, "星詠みの輝石", "gem", "#cfe9ff", { mp: { rate: 0.05 } }, "夜明け前の一番星を閉じ込めた輝石。尽きることなく、持ち主の魔力をほんの少しだけ澄ませ続ける。"),
  relic("r-compass", "A", "装置", 3, "渡り鳥の羅針儀", "compass", "#71e2ef", { drop: 0.1 }, "針は北ではなく、まだ見ぬ宝の在処を指す。渡り鳥たちは皆、この羅針儀の写しを胸に宿しているという。"),
  relic("r-armillary", "S", "装置", 3, "天球の調律器", "armillary", "#a882fb", { mp: { rate: 0.2, subjects: ["数学", "理科"] } }, "天球の運行を寸分違わず写す真鍮の環。回せば星々の和音が整い、理の言葉が澄んで響く。"),
  relic("r-sandtray", "S", "装置", 4, "黄昏の砂盤", "sandtray", "#f2c27a", { drop: 0.2 }, "黄昏の砂を敷き詰めた占いの盤。指でなぞった模様の先に、埋もれた宝の気配が浮かび上がる。"),
  relic("r-codex", "S", "伝承", 5, "万象の写本", "tome", "#fbf3d4", { mp: { rate: 0.2, subjects: ["国語", "英語", "社会"] } }, "世界中の言葉で同じ一節が書かれた写本。読み比べるうちに、言葉の向こうにある一つの意味が見えてくる。"),
  relic("r-starcore", "S", "触媒", 6, "始原の星核", "core", "#9ef0c9", { mp: { rate: 0.15 } }, "世界で最初に灯った星の芯とされる結晶。掌に載せると、あらゆる学びが同じ光から生まれたことを思い出す。"),
];

/** 星天の導き（1日1回の授かり物）でのみ得られる触媒。宝箱の抽選には含めない */
export const GUIDANCE_CATALYSTS: CatalystItem[] = [
  catalyst("g-stardust", "星屑の触媒", "vial", "#f6e9bd", 1.2, 0, "星天の導きとともに降る星屑を集めた小瓶。ほのかに温かく、夜ごとの歩みをそっと後押しする。"),
  catalyst("g-aurora", "極光の輝石", "crystal", "#9ef0c9", 1.8, 0, "七夜を欠かさず歩んだ者にだけ授けられる極光の欠片。秘めた魔力は、ひと晩で星座ひとつを描くほど。"),
];

export const ALL_ITEMS: Item[] = [...RELICS, ...SKINS, ...LORES, ...CATALYSTS, ...GUIDANCE_CATALYSTS];

export function findItem(id: string | null | undefined): Item | undefined {
  return ALL_ITEMS.find((item) => item.id === id);
}

export const RARITIES: Rarity[] = ["S", "A", "B", "C"];

export const RARITY_LABEL: Record<Rarity, string> = {
  S: "至宝",
  A: "秘宝",
  B: "稀品",
  C: "常品",
};

/** 所持している秘宝の加護による獲得MPの倍率 */
export function blessingMultiplier(owned: (id: string) => boolean, subjectName: string) {
  return RELICS.filter((r) => owned(r.id) && r.blessing.mp && (!r.blessing.mp.subjects || r.blessing.mp.subjects.includes(subjectName)))
    .reduce((acc, r) => acc + r.blessing.mp!.rate, 1);
}

/** 所持している秘宝の加護による宝箱ドロップ率の倍率 */
export function dropMultiplier(owned: (id: string) => boolean) {
  return RELICS.filter((r) => owned(r.id)).reduce((acc, r) => acc + (r.blessing.drop ?? 0), 1);
}

/** エリアで抽選対象になるアイテム */
export function dropPool(area: Area): Record<Rarity, Item[]> {
  const relics = RELICS.filter((r) => r.stageId <= area.stageId);
  return {
    C: CATALYSTS,
    B: LORES.filter((l) => l.areaId === area.id),
    A: [...SKINS.filter((s) => s.stageId <= area.stageId), ...relics.filter((r) => r.rarity === "A")],
    S: relics.filter((r) => r.rarity === "S"),
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
 * 1. エリアの確率テーブル（S → A → B → C の順に区間を割り当て）でレア度を決める。秘宝の加護で各確率が上がる
 * 2. そのレア度のプールから1つ選ぶ（触媒は weight、それ以外は等確率）
 */
export function rollDrop(area: Area, random: () => number = Math.random, boost = 1): Item | null {
  const pool = dropPool(area);
  const r = random() * 100;
  let edge = 0;
  for (const rarity of RARITIES) {
    edge += area.drops[rarity] * boost;
    if (r < edge && pool[rarity].length > 0) {
      return pickWeighted<Item>(pool[rarity], (i) => (i.kind === "catalyst" ? i.weight : 1), random);
    }
  }
  return null;
}
