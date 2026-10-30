// アイテム定義とドロップ抽選。
// ビジュアルは svgIcon（lib/glyphs.ts の幾何学ラインアート）を components/item-art.tsx で描く。
import { AREAS, type Area, type Rarity } from "./areas";
import { chapterOf } from "./cycles";
import { GLYPHS } from "./glyphs";

/** 図鑑での分類 */
export type ItemType = "触媒" | "伝承" | "装置";

export const ITEM_TYPES: ItemType[] = ["触媒", "伝承", "装置"];

/** アイテムのレア度。SS（神話）は錬成でのみ生まれ、宝箱からは出ない */
export type ItemRarity = Rarity | "SS";

type ItemBase = {
  id: string;
  name: string;
  rarity: ItemRarity;
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

/** エリア固有の伝承の品（効果なしのコレクション）。2周目以降は周回限定版（影/蒼炎アナザー）に変わる */
export type LoreItem = ItemBase & {
  rarity: "B";
  kind: "lore";
  areaId: string;
  /** 周回限定版の章（影の章 / 蒼炎の章） */
  variant?: "shadow" | "azure";
  effect?: undefined;
};

/** 魔法陣の発光色・背景を変える永続スキン */
export type SkinItem = ItemBase & {
  rarity: "A";
  kind: "skin";
  stageId: number;
  effect: string;
  skin: Skin;
  /** 周天の章で授かるスキン（何周目か）。宝箱からは出ない */
  cycle?: number;
};

/** 所持しているだけで加護を与える秘宝（SS は錬成で生まれる神話遺物） */
export type RelicItem = ItemBase & {
  rarity: "A" | "S" | "SS";
  kind: "relic";
  /** このステージ以降の宝箱で見つかる（神話遺物は錬成の目安） */
  stageId: number;
  effect: string;
  blessing: Blessing;
  /** 神話遺物の錬成に要るもの */
  recipe?: Recipe;
  /** 星天の塔のこの階層で授かる天界遺物 */
  zenithFloor?: number;
};

/** 錬成の材料: 星屑の原石の数と、捧げる秘宝 */
export type Recipe = { ore: number; relics: string[] };

/** 古代文書の断片（I〜IV）。同じ文書の4葉が揃うと復元できる */
export type FragmentItem = ItemBase & {
  rarity: "B";
  kind: "fragment";
  documentId: string;
  /** 何葉目か（1〜4） */
  part: number;
  stageId: number;
  effect?: undefined;
};

/** 復元した古代文書（星脈の記憶）。1冊ごとに全属性の獲得MPがわずかに高まる */
export type MemoryItem = ItemBase & {
  rarity: "S";
  kind: "memory";
  documentId: string;
  stageId: number;
  /** 復元して読める古代の記憶 */
  memory: string[];
  effect: string;
  blessing: Blessing;
};

/** 星天の塔の節目で授かる称号。図鑑に登録され、プロフィールに掲げられる */
export type TitleItem = ItemBase & {
  rarity: "S" | "SS";
  kind: "title";
  zenithFloor: number;
  effect: string;
};

/** 錬成の素材（星屑の原石） */
export type MaterialItem = ItemBase & {
  rarity: "C";
  kind: "material";
  effect?: undefined;
};

/** 秘宝の加護 */
export type Blessing = {
  /** 獲得MPの加算率（0.15 = +15%）。subjects 未指定なら全属性 */
  mp?: { rate: number; subjects?: string[] };
  /** 宝箱のドロップ率の加算率（0.1 = +10%） */
  drop?: number;
};

export type Item = CatalystItem | LoreItem | SkinItem | RelicItem | FragmentItem | MemoryItem | MaterialItem | TitleItem;

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

/** 伝承の品の絵柄（品の名前に合わせる） */
const LORE_GLYPHS: Record<string, keyof typeof GLYPHS> = {
  "1-1": "candle",
  "1-2": "starmap",
  "1-3": "waxseal",
  "2-1": "vial",
  "2-2": "leaf",
  "2-3": "scroll",
  "2-4": "key",
  "3-1": "stair",
  "3-2": "gear",
  "3-3": "tome",
  "3-4": "lens",
  "4-1": "footprint",
  "4-2": "bookmark",
  "4-3": "clock",
  "5-1": "flame",
  "5-2": "tablet",
  "5-3": "scale",
  "5-4": "core",
  "6-1": "feather",
  "6-2": "score",
  "6-3": "bell",
};

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
  "6-2": ["聖歌の譜面", "身廊に残されていた聖歌の譜面。音符の代わりに、星の位置が記されている。"],
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
  svgIcon: GLYPHS[LORE_GLYPHS[area.id]],
  color: LORE_COLORS[i % 2],
}));

/** 周回限定版（アナザー）の伝承の品に記された裏ストーリー: [影の章, 蒼炎の章] */
const ANOTHER_TEXT: Record<string, [string, string]> = {
  "1-1": ["蝋燭の影は、灯よりも先にこの机にいた。前の周に誰かが書きかけた一行を、影だけが覚えている。", "二度目の夜を越えた蝋燭は、蒼く冷たく燃える。溶けることなく、ただ次の問いを待っている。"],
  "1-2": ["裏返すと、描かれていたのは星ではなく、消えた灯の位置だった。諦めた夜の数だけ、黒い点が打たれている。", "蒼炎にかざすと、星図に新しい星がひとつ浮かぶ。それは、前の周のあなたが最後に灯した星だ。"],
  "1-3": ["滅んだ学院の紋章の裏に、もう一つの紋章が隠れていた。学院を閉ざしたのは、学ぶことを恐れた者たち自身だった。", "封蝋は蒼い炎で溶け、扉の向こうの言葉が読めるようになる。『戻ってきた者にだけ、続きを託す』。"],
  "2-1": ["光る苔の下には、光らない苔が広く根を張っている。読まれずに閉じられた本の数だけ、影の苔は育つ。", "二度目に訪れた者の足跡には、苔が蒼く光る。同じ道を辿り直すことも、また新しい歩みなのだと。"],
  "2-2": ["耳を澄ますと、朗読の声の合間にため息が混じっている。大樹はそれも、等しく養分にしてきた。", "蒼く透けた葉は、まだ誰も読んでいない本の一節を囁く。大樹は、あなたが次に開く頁を知っている。"],
  "2-3": ["歩き回る文字の中に、一文字だけ動かないものがある。写本を途中で投げ出した妖精の、最後の一画だ。", "蒼炎に照らすと、書き損じは書き直されていた。妖精は、もう一度最初から写すことを選んだのだ。"],
  "2-4": ["この鍵が合う扉はひとつしかない。迷宮を作ったのは、出口を忘れたかった探究者だったという。", "蒼く燃える鍵は、迷宮の外ではなく内側へ開く扉に合う。迷った道のすべてが、根の奥でつながっていた。"],
  "3-1": ["階段の影は、上ではなく下へ伸びている。降りていった者たちが、今も一段ずつ数え続けている。", "この一段は、何度でも踏み直せる。二周目の足音は、一周目より少しだけ軽い。"],
  "3-2": ["欠けた歯が一枚ある。天文盤は、その一枚分の夜を数えずに回り続けてきた。", "蒼い火を入れると、歯車は逆向きに一度だけ回る。巻き戻されるのは時ではなく、迷いの方だ。"],
  "3-3": ["手記の余白に、別の筆跡でこう書かれている。『明日の星は、今日より一つ少ないかもしれない』。", "最後の頁の続きが、蒼い文字で浮かび上がる。『それでも数えることをやめなかった者が、星になった』。"],
  "3-4": ["覗き込んだ星空の隅に、見覚えのある背中が映る。あなたより先に、この道を歩いた誰かだ。", "蒼く曇ったレンズの奥に、遥か高く続く塔が見える。星空の先にも、まだ階層がある。"],
  "4-1": ["足音の主は、一度も振り返らなかった。けれど凍った足音の間には、立ち止まった跡がいくつも残っている。", "蒼く燃える足音が、氷の中で再び歩き出す。前へ進む音は、二度目のほうが確かに響く。"],
  "4-2": ["栞に写された一文には続きがあった。凍らせたのは、読みたくなかった結末の方だった。", "蒼炎に触れても栞は溶けず、文字だけが温かくなる。凍らせた時間は、いつか誰かを温めるためにある。"],
  "4-3": ["秒針が止まったのは、持ち主が諦めた瞬間だった。時計塔は、その一秒をずっと抱えている。", "二周目の集中の傍で、秒針は蒼く光りながら動き出す。止まっていた一秒は、無駄ではなかった。"],
  "5-1": ["熾火の芯には、燃え尽きた灰が詰まっている。消えた炎も、次の炎のための熱を残していった。", "赤い熾火が蒼く変わるのは、温度が上がった証だ。二度目の炉は、より深く燃えている。"],
  "5-2": ["空白の欄に、かすれた文字が残っていた。『恐れ』。最後の材料を、誰もが入れられずにいた。", "蒼い炎で炙ると、空白の欄に文字が浮かぶ。『もう一度』。最後の材料は、それだけだった。"],
  "5-3": ["火竜は眠っているのではない。学ぶことをやめた者の夢を、代わりに見続けている。", "蒼く冷えた鱗の向こうで、火竜が片目を開ける。二度目に来た者だけを、竜は覚えている。"],
  "5-4": ["炉心の灯は、持ち主の迷いに合わせて色を落とす。黒く沈んだ灯もまた、魔力の一つの形だ。", "二周目の魔力に応えて、炉心は蒼い炎に変わった。これ以上熱くなれない炎だけが、この色になる。"],
  "6-1": ["白い羽根の根元だけが、黒く染まっている。この参道を引き返した者の翼から落ちたものだ。", "蒼く縁取られた羽根は、上へと舞い上がる。参道の先、雲の上にもまだ道が続いている。"],
  "6-2": ["譜面の裏には、歌われなかった旋律が書かれている。聖歌は、沈黙した声も含めて完成する。", "蒼い光で読むと、星の位置が一つずつ高くなっている。この聖歌は、塔の上で歌われるためのものだった。"],
  "6-3": ["鈴の内側に、小さく名前が刻まれている。前の周にこの祭壇へ辿り着いた、あなた自身の名だ。", "蒼炎の鈴を鳴らすと、和音は天頂へ昇っていく。祭壇は終点ではなく、星天の塔の入口だった。"],
};

const VARIANTS = [
  { key: "shadow", suffix: "〈影〉", color: "#b9b2d4" },
  { key: "azure", suffix: "〈蒼炎〉", color: "#6fb6ff" },
] as const;

/** 周回限定版（アナザー）の伝承の品: 2周目は影、3周目以降は蒼炎。宝箱で元の品に代わって見つかる */
export const ANOTHER_LORES: LoreItem[] = VARIANTS.flatMap((v, vi) =>
  LORES.map((lore) => ({
    ...lore,
    id: `${lore.id}-${v.key}`,
    name: `${lore.name}${v.suffix}`,
    flavorText: ANOTHER_TEXT[lore.areaId][vi],
    color: v.color,
    variant: v.key,
  })),
);

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

/** 周天の章で授かる魔法陣スキン（宝箱からは出ない） */
export const CYCLE_SKINS: SkinItem[] = [
  {
    ...skin("a-eclipse", 6, "黒曜の蝕環", "eclipse", "#b9b2d4", "魔法陣が光を呑む漆黒の蝕に沈む", "影の章の始まりに、祭壇の灯が一度だけ蝕まれて生まれた環。光の輪郭だけを銀に残し、魔法陣を深い闇へ沈める。", { lineColor: "#b9b2d4", particleColor: "#7a68b0", aura: "rgba(6,4,18,0.5)" }),
    cycle: 2,
  },
  {
    ...skin("a-azureflame", 6, "蒼炎の聖火", "flame", "#6fb6ff", "魔法陣が青白い蒼炎に燃え上がる", "三度目の祈りで灯った、熱を超えて蒼く澄んだ聖火。燃やすものを持たず、探究者の意志だけを糧に燃え続ける。", { lineColor: "#6fb6ff", particleColor: "#bfe6ff", aura: "rgba(70,140,255,0.14)" }),
    cycle: 3,
  },
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
    drop && `流れ星の降る確率 +${Math.round(drop * 100)}%`,
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
  relic("r-chronicle", "A", "伝承", 4, "王朝年代記の断簡", "scroll", "#b9a2f7", { mp: { rate: 0.15, subjects: ["社会"] } }, "滅んだ王朝の年代記から破り取られた数頁。並べ直すたびに、歴史は少しだけ違う顔を見せる。"),
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

/** 古代文書: 各ステージに1冊。4葉の断片を集めて復元すると、世界の核心に触れる記憶が読める */
export const DOCUMENTS: { id: string; stageId: number; title: string; color: string; memory: string[] }[] = [
  {
    id: "doc-1",
    stageId: 1,
    title: "灯火の誓約",
    color: "#e2c974",
    memory: [
      "はじめに、世界には灯がひとつしかなかった。",
      "それは誰かが知ろうとした、その瞬間にだけ生まれる小さな光だった。問いを抱いた者の机の上にだけ、灯はともる。",
      "だから我らは誓う。灯を絶やさぬために、今宵もひとつ、まだ知らぬことを知ろうと。",
      "――この誓いを読む者よ。あなたの机の灯もまた、最初の灯から分かたれたものである。",
    ],
  },
  {
    id: "doc-2",
    stageId: 2,
    title: "樹海の言の葉",
    color: "#8fdcc4",
    memory: [
      "樹海の木々は、読まれた言葉を養分にして育つ。",
      "声に出して読まれた一文は根となり、黙って考え抜かれた一文は幹となる。忘れられた言葉は落ち葉となって、次の誰かの足もとを柔らかくする。",
      "迷ったときは耳を澄ませ。森はいつも、あなたがかつて読んだ言葉で道を囁いている。",
    ],
  },
  {
    id: "doc-3",
    stageId: 3,
    title: "星読みの手稿",
    color: "#a882fb",
    memory: [
      "空の星は、かつてこの地で学んだ者たちの灯である。",
      "ひとりが一夜を費やして理を解くたび、夜空にはひとつ星が増える。星読みたちが数えていたのは天体ではなく、先人たちの夜の数だった。",
      "明日の星が今日より一つ多いのは、今夜、誰かが学ぶことを諦めなかったからだ。",
    ],
  },
  {
    id: "doc-4",
    stageId: 4,
    title: "凍れる時の碑文",
    color: "#cfe9ff",
    memory: [
      "時は誰にも等しく流れる。けれど、深く集中した者の時だけは凍りつき、結晶となって残る。",
      "大回廊を満たす氷は、すべて誰かの一時間である。触れれば冷たいが、決して溶けることはない。",
      "費やした時は失われない。それは形を変えて、あなたの内に積もっていく。",
    ],
  },
  {
    id: "doc-5",
    stageId: 5,
    title: "熾火の錬成録",
    color: "#f2a38d",
    memory: [
      "知識は錬成に似ている。ばらばらの素材も、熱を加え続ければいつか一つの理に溶け合う。",
      "炉の火を絶やすな。たとえ今日の成果が灰に見えても、その灰はまだ温かい。",
      "熾火はやがて炎となる。錬成録の最後の頁は、あなたが書き加えるために空けてある。",
    ],
  },
  {
    id: "doc-6",
    stageId: 6,
    title: "星冠の聖典",
    color: "#fbf3d4",
    memory: [
      "世界の奥地に眠る秘術とは、特別な呪文ではなかった。",
      "それは一夜一夜の学びを、一度も無駄と思わずに積み重ねること。最初の灯から始まり、樹海で言葉を拾い、星を数え、時を凍らせ、熾火を絶やさなかった者だけが、この祭壇に辿り着く。",
      "ここに至ったあなたこそが、次の誰かにとっての最初の灯である。",
    ],
  },
];

const ROMAN_PARTS = ["I", "II", "III", "IV"];

const FRAGMENT_TEXT = [
  "表題と書き出しが残る、最初の一葉。",
  "文の半ばで途切れた二葉目。滲んだインクの奥に、星の名がいくつか読み取れる。",
  "焦げ跡の残る三葉目。誰かの手で何度も読み返された跡がある。",
  "結びの一節が記された最後の葉。署名だけが、光にかざすと浮かび上がる。",
];

/** 古代文書の断片（各文書 I〜IV の4葉）。そのステージの宝箱で、伝承の品と同じ枠から見つかる */
export const FRAGMENTS: FragmentItem[] = DOCUMENTS.flatMap((doc) =>
  ROMAN_PARTS.map((numeral, i) => ({
    id: `frag-${doc.stageId}-${i + 1}`,
    rarity: "B" as const,
    kind: "fragment" as const,
    type: "伝承" as const,
    name: `『${doc.title}』断片 ${numeral}`,
    flavorText: `『${doc.title}』の断片。${FRAGMENT_TEXT[i]}`,
    svgIcon: GLYPHS.parchment,
    color: doc.color,
    documentId: doc.id,
    part: i + 1,
    stageId: doc.stageId,
  })),
);

/** 復元した古代文書。1冊につき全属性の獲得MP +1%（永久） */
export const MEMORIES: MemoryItem[] = DOCUMENTS.map((doc) => ({
  id: `mem-${doc.stageId}`,
  rarity: "S",
  kind: "memory",
  type: "伝承",
  name: `『${doc.title}』`,
  flavorText: doc.memory[0],
  svgIcon: GLYPHS.tome,
  color: doc.color,
  documentId: doc.id,
  stageId: doc.stageId,
  memory: doc.memory,
  blessing: { mp: { rate: 0.01 } },
  effect: blessingLabel({ mp: { rate: 0.01 } }),
}));

/** 錬成の素材。余った遺物を還元して得る */
export const STARDUST_ORE: MaterialItem = {
  id: "ore-stardust",
  rarity: "C",
  kind: "material",
  type: "触媒",
  name: "星屑の原石",
  flavorText: "還元された遺物の魔力が、星屑となって凝り固まった原石。錬成陣に捧げれば、新たな形を得る。",
  svgIcon: GLYPHS.crystal,
  color: "#cfe9ff",
};

/** 神話遺物（SS）: 宝箱からは出ず、星屑の原石と秘宝を捧げる錬成でのみ生まれる */
export const MYTHICS: RelicItem[] = [
  {
    ...relic(
      "ss-sphere",
      "SS",
      "装置",
      3,
      "真理を象る天球儀",
      "armillary",
      "#c9b6ff",
      { mp: { rate: 0.45, subjects: ["数学", "理科"] }, drop: 0.05 },
      "調律器の環と観測者の数式がひとつに溶け合った天球儀。回せば世界の理がそのまま形を取り、見る者に答えではなく問いの美しさを示す。",
    ),
    recipe: { ore: 80, relics: ["r-armillary", "r-observer"] },
  },
  {
    ...relic(
      "ss-origin",
      "SS",
      "伝承",
      5,
      "万語を綴る原典",
      "tome",
      "#fbf3d4",
      { mp: { rate: 0.45, subjects: ["国語", "英語", "社会"] } },
      "あらゆる言葉の写本が、ただ一冊の原典へと還った姿。頁を開くたびに、読む者の母語でまだ誰も書いていない一節が浮かぶ。",
    ),
    recipe: { ore: 100, relics: ["r-codex", "r-kotodama", "r-epigraph"] },
  },
  {
    ...relic(
      "ss-astrolabe",
      "SS",
      "装置",
      4,
      "星海を巡る羅盤",
      "compass",
      "#9ef0c9",
      { drop: 0.4 },
      "羅針儀の針と黄昏の砂が錬り合わされた羅盤。針は宝の在処ではなく、まだ誰も辿り着いていない星の海を指し続ける。",
    ),
    recipe: { ore: 60, relics: ["r-sandtray", "r-compass"] },
  },
  {
    ...relic(
      "ss-starfire",
      "SS",
      "触媒",
      6,
      "始まりの星火",
      "core",
      "#f6e9bd",
      { mp: { rate: 0.3 } },
      "最初の星の芯と夜明けの輝石が重なり、ふたたび灯った始まりの火。この火の前では、あらゆる学びが一夜目の新しさを取り戻す。",
    ),
    recipe: { ore: 120, relics: ["r-starcore", "r-starstone"] },
  },
];

/** 天界遺物（SS）: 星天の塔の節目の階層でのみ授かる */
export const CELESTIAL_RELICS: RelicItem[] = [
  { ...relic("ss-zenith-lantern", "SS", "装置", 6, "天梯の星灯", "lantern", "#cfe9ff", { mp: { rate: 0.1 }, drop: 0.1 }, "塔の二十五層の窓辺に吊るされていた灯。下から昇ってくる者の足もとを、一段先だけ照らし続ける。"), zenithFloor: 25 },
  { ...relic("ss-zenith-spire", "SS", "装置", 6, "星天の尖塔儀", "tower", "#a882fb", { mp: { rate: 0.2 } }, "星天の塔そのものを掌に収めた縮尺の模型。覗き込むと、まだ誰も辿り着いていない上層が淡く灯っている。"), zenithFloor: 50 },
  { ...relic("ss-zenith-crown", "SS", "伝承", 6, "天頂の冠星", "ring", "#fbf3d4", { mp: { rate: 0.25 }, drop: 0.2 }, "百層の天頂で、星々が自ら輪を成して生まれた冠。戴く者の頭上ではなく、これから学ぶ誰かの頭上で輝く。"), zenithFloor: 100 },
  { ...relic("ss-zenith-halo", "SS", "触媒", 6, "無窮の天環", "armillary", "#9ef0c9", { mp: { rate: 0.3 } }, "二百層を越えた先で、天球の環がほどけて一本の光になったもの。終わりのない学びの形を、ただ静かに回り続ける。"), zenithFloor: 200 },
];

const title = (id: string, rarity: TitleItem["rarity"], zenithFloor: number, name: string, color: string, flavorText: string): TitleItem => ({
  id,
  rarity,
  kind: "title",
  type: "伝承",
  zenithFloor,
  name,
  svgIcon: GLYPHS.seal,
  color,
  effect: `称号【${name}】をプロフィールに掲げられる`,
  flavorText,
});

/** 星天の塔の節目で授かる称号 */
export const TITLES: TitleItem[] = [
  title("t-wayfarer", "S", 10, "天梯の旅人", "#cfe9ff", "星天の塔の十層に至った者の称号。足もとの雲は、もう遥か下に見える。"),
  title("t-observer", "SS", 50, "星界の観測者", "#a882fb", "五十層の観測窓から、星界のすべてを見渡した者の称号。星は見上げるものから、見守るものに変わった。"),
  title("t-apex", "SS", 100, "天頂に至る者", "#fbf3d4", "百層の天頂に立った者の称号。ここより上は、もう誰の地図にも描かれていない。"),
  title("t-boundless", "SS", 200, "無窮を昇る者", "#9ef0c9", "二百層を越えてなお昇り続ける者の称号。塔に終わりがないことを知って、それでも一段を踏む。"),
];

/** 図鑑（秘術図鑑の一覧）に並ぶ遺物。断片・記憶・素材はそれぞれ専用の場所で扱う */
export const ALL_ITEMS: Item[] = [
  ...MYTHICS,
  ...CELESTIAL_RELICS,
  ...TITLES,
  ...RELICS,
  ...SKINS,
  ...CYCLE_SKINS,
  ...LORES,
  ...ANOTHER_LORES,
  ...CATALYSTS,
  ...GUIDANCE_CATALYSTS,
];

const EVERY_ITEM: Item[] = [...ALL_ITEMS, ...FRAGMENTS, ...MEMORIES, STARDUST_ORE];

export function findItem(id: string | null | undefined): Item | undefined {
  return EVERY_ITEM.find((item) => item.id === id);
}

/** 星天の塔の節目で授かるもの（天界遺物・称号）。所持するまで正体を伏せる */
export function isZenithReward(item: Item) {
  return item.kind === "title" || (item.kind === "relic" && item.zenithFloor !== undefined);
}

/** 何周目から現れるか（周回限定版の伝承の品・章の魔法陣スキン）。それ以外は 1 */
export function cycleOfItem(item: Item) {
  if (item.kind === "lore" && item.variant) return item.variant === "shadow" ? 2 : 3;
  if (item.kind === "skin" && item.cycle) return item.cycle;
  return 1;
}

/** 宝箱の抽選に使うレア度 */
export const RARITIES: Rarity[] = ["S", "A", "B", "C"];

/** 図鑑に並べるレア度（神話を含む） */
export const CODEX_RARITIES: ItemRarity[] = ["SS", ...RARITIES];

export const RARITY_LABEL: Record<ItemRarity, string> = {
  SS: "神話",
  S: "至宝",
  A: "秘宝",
  B: "稀品",
  C: "常品",
};

/** 加護を持つもの（秘宝・神話遺物・天界遺物・復元した古代文書） */
const BLESSED: (RelicItem | MemoryItem)[] = [...RELICS, ...MYTHICS, ...CELESTIAL_RELICS, ...MEMORIES];

/** 所持している秘宝・神話遺物・古代文書の加護による獲得MPの倍率 */
export function blessingMultiplier(owned: (id: string) => boolean, subjectName: string) {
  return BLESSED.filter((r) => owned(r.id) && r.blessing.mp && (!r.blessing.mp.subjects || r.blessing.mp.subjects.includes(subjectName)))
    .reduce((acc, r) => acc + r.blessing.mp!.rate, 1);
}

/** 所持している秘宝・神話遺物の加護による宝箱ドロップ率の倍率 */
export function dropMultiplier(owned: (id: string) => boolean) {
  return BLESSED.filter((r) => owned(r.id)).reduce((acc, r) => acc + (r.blessing.drop ?? 0), 1);
}

/** 稀品（B）の枠での伝承の品の重み。断片はそれぞれ 1（伝承の品 50%・断片 4葉で 50%） */
const LORE_WEIGHT = 4;

/** エリアで抽選対象になるアイテム。伝承の品は周天の章に応じて周回限定版（アナザー）に変わる */
export function dropPool(area: Area, cycle = 1): Record<Rarity, Item[]> {
  const relics = RELICS.filter((r) => r.stageId <= area.stageId);
  const variant = chapterOf(cycle).loreVariant;
  const lores = variant ? ANOTHER_LORES.filter((l) => l.variant === variant) : LORES;
  return {
    C: CATALYSTS,
    B: [...lores.filter((l) => l.areaId === area.id), ...FRAGMENTS.filter((f) => f.stageId === area.stageId)],
    A: [...SKINS.filter((s) => s.stageId <= area.stageId), ...relics.filter((r) => r.rarity === "A")],
    S: relics.filter((r) => r.rarity === "S"),
  };
}

/** 抽選の重み: 触媒は種類ごとの weight、伝承の品は LORE_WEIGHT、それ以外は等しく 1 */
function dropWeight(item: Item) {
  if (item.kind === "catalyst") return item.weight;
  if (item.kind === "lore") return LORE_WEIGHT;
  return 1;
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
 * 2. そのレア度のプールから1つ選ぶ（dropWeight の重み付き。触媒は weight、稀品は伝承の品 4・断片 各1）
 */
export function rollDrop(area: Area, random: () => number = Math.random, boost = 1, cycle = 1): Item | null {
  const pool = dropPool(area, cycle);
  const r = random() * 100;
  let edge = 0;
  for (const rarity of RARITIES) {
    edge += area.drops[rarity] * boost;
    if (r < edge && pool[rarity].length > 0) {
      return pickWeighted<Item>(pool[rarity], dropWeight, random);
    }
  }
  return null;
}
