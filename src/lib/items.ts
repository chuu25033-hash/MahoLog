// アイテム定義とドロップ抽選。
// ビジュアルは svgIcon（lib/glyphs.ts の幾何学ラインアート）を components/item-art.tsx で描く。
import { AREAS, type Area, type Rarity } from "./areas";
import { chapterOf } from "./cycles";
import { formatMinutes } from "./game";
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
  /** 星天の塔のこの階層で授かる（流れ星からは降らない） */
  zenithFloor?: number;
  effect?: undefined;
};

/** 復元した古代文書（星脈の記憶）。1冊ごとに全属性の獲得MPがわずかに高まる */
export type MemoryItem = ItemBase & {
  rarity: "S";
  kind: "memory";
  documentId: string;
  stageId: number;
  /** 復元して読める古代の記憶（断片 I〜IV の本文） */
  memory: string[];
  /** 復元したときだけ現れる秘された結び */
  coda: string;
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
  /** 稀品以上の流れ星が降る確率の加算率（0.1 = +10%）。lib/drops.ts の boostedRates で効く */
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
  catalyst("c-hourglass", "星屑の砂時計", "hourglass", "#e2c974", 1.5, 3, "沈黙の前夜、学院の誰かが最後に返した砂時計。落ちる砂は、沈黙の前に学院で費やされた刻のひと粒ずつで、返すたびに世界は少しだけ時を思い出す。"),
  catalyst("c-catalyst", "月光の触媒", "vial", "#cfe9ff", 1.25, 5, "星が黙った夜にも、月だけは光を返し続けた。瓶に汲んだその光は、刻を失った世界にかすかに流れ残っていた時の名残り。"),
  catalyst("c-prism", "蒼晶のプリズム", "prism", "#71e2ef", 1.3, 4, "言葉が溶けはじめた頃、学院の者は散らばる思考をこの結晶で一本の光に束ねた。覗けば、溶けかけた言葉の筋がまだ七色に分かれて見える。"),
  catalyst("c-quill", "彗星の羽根ペン", "quill", "#e2c974", 2, 1, "沈黙の夜に一筋だけ空を横切った彗星の羽根。原典の最後の一行はこのペンで書かれたという。書いた文字は、書き手より先に意味を思い出す。"),
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
  "1-1": ["溶けかけた蝋燭", "アルマが最初の一行を覚えた夜の灯。今の星脈はこの小さな火から始まり、沈黙の夜にも、この灯だけは消えなかった。"],
  "1-2": ["古びた星図の切れ端", "学院の黄金期に描かれた星図。星のひとつひとつに、そこで学んだ者の名と夜の数が小さく書き添えられている。"],
  "1-3": ["封蝋の欠片", "地下書庫を閉ざしていた封蝋。紋章は星詠みの学院のもの。封じたのは外の誰かではなく、沈黙の前夜の学院自身だった。"],
  "2-1": ["光る苔の標本", "読まれた言葉の上にだけ育つ苔。樹海の光が年ごとに弱まったのは、言葉が読まれず、ただ眺められるようになったからだ。"],
  "2-2": ["大樹の囁き葉", "大樹が聞いてきた朗読の声が眠る葉。終わりに近い頃の声ほど早口で、意味を置き去りにしたまま流れていく。"],
  "2-3": ["妖精の写本頁", "写本の妖精が去る前に残した一頁。文字が紙の上を歩き回るのは、意味を失って居場所を探しているから。"],
  "2-4": ["迷宮の根の鍵", "まだ重さを持つ言葉を守るため、アルマが根の奥に書庫を隠して築いた迷宮の鍵。迷わせたかったのは、言葉を軽く扱う者たちの足だった。"],
  "3-1": ["螺旋階段の一段", "星へ続く階段の一段。一夜学んだ者が昇るたびに一段ずつ増えたが、いつからか、段はほとんど増えなくなった。"],
  "3-2": ["天文盤の歯車", "世界の暦を刻む天文盤から外れた歯車。人が刻を費やさず流すようになって、歯は一枚ずつ欠けていった。"],
  "3-3": ["星読みの手記", "露台に残された星読みの手記。最後の頁は『明日の星は、今日より一つ少ない』と結ばれ、その下に別の筆跡で『多い』と書き直されている。"],
  "3-4": ["水晶レンズの破片", "星脈を覗く望遠鏡の破片。最後に映したのは、星がひとつずつ瞬きをやめていく空と、それを見上げる一人の背中だった。"],
  "4-1": ["凍った足音", "沈黙の夜、回廊を時計塔へ急いだ誰かの足音。世界が凍りついても、この足音だけは前へ進むことをやめなかった。"],
  "4-2": ["氷文字の栞", "氷に閉じ込められた一文を写した栞。沈黙のときに世界から抜き取られた言葉は、こうして氷の中で宛先を待っている。"],
  "4-3": ["止まった秒針", "大沈黙の瞬間に止まった時計塔の秒針。刻が失われた一秒を抱えたまま、集中する者の傍でだけ、再びかすかに震える。"],
  "5-1": ["熾火の欠片", "沈黙の後、落ちた星を集めて灯した最初の熾火の欠片。凍った世界で、刻を生み直すための熱はここから始まった。"],
  "5-2": ["錬成の配合表", "詠唱の儀式の配合表。錬金術師たちの刻、わずかに残った言葉、炉の火。最後の材料の欄だけが空白で、隅に小さく『後から来る者の刻』とある。"],
  "5-3": ["火竜の逆鱗", "魔導炉の番を託された火竜の鱗。竜は、刻を注ぎ尽くした錬金術師たちの代わりに夢を見続け、炉の火が絶えぬよう息を吐いている。"],
  "5-4": ["炉心の灯", "儀式の炉心に灯された火。注がれた刻の色に染まり、詠唱する者の魔力を星屑に変えて星脈へ送り出す。"],
  "6-1": ["雲海の羽根", "雲上の参道に落ちていた白い羽根。儀式を見届けたアルマが、最後に祭壇へ向かった道に一枚だけ残したもの。"],
  "6-2": ["聖歌の譜面", "身廊に残された聖歌の譜面。音符の代わりに星の位置が記され、歌い手が去った今も、詠唱のたびに譜面の星座がひとつずつ灯っていく。"],
  "6-3": ["星冠の鈴", "祭壇に供えられた鈴。アルマは自らの刻と名をこの鈴に溶かした。鳴らせば、これまでの詠唱が星脈の中でひとつの和音になる。"],
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
  "1-1": ["蝋燭の影は、灯よりも先にこの机にいた。前の周にここで詠唱を始めた者の一行を、影だけが覚えている。読めば、それはあなたの筆跡だ。", "幾度も夜を越えた蝋燭は、蒼く冷たく燃える。アルマが残した灯に、あなたの刻が重なった色だ。"],
  "1-2": ["裏返すと、描かれていたのは瞬きをやめた星の位置だった。大沈黙の夜、星になった人々の数だけ黒い点が打たれている。", "蒼炎にかざすと、黒い点のひとつが光を取り戻す。前の周のあなたが灯した星だ。そこに名は書かれていない。"],
  "1-3": ["紋章の裏に、アルマの印が重ねて押されていた。学院を封じたのは、言葉を原典へ回収する前夜のアルマ自身だった。", "封蝋は蒼い炎で溶け、扉の内側の一文が読めるようになる。『戻ってきた者にだけ、続きを託す』。"],
  "2-1": ["光る苔の下には、光らない苔が広く根を張っている。眺められただけで読まれなかった言葉の数だけ、影の苔は育った。", "巡り直して訪れた者の足跡にだけ、苔は蒼く光る。この森で光る足跡は、あなたのものしかない。"],
  "2-2": ["早口の朗読の合間に、ため息が混じっている。言葉が軽くなっていくことに、読み手たち自身も気づいていた。", "蒼く透けた葉は、もう誰も声に出さない一節を囁く。聞き手はあなた一人で、それで足りている。"],
  "2-3": ["歩き回る文字の中に、一文字だけ動かないものがある。妖精が去る前、最後まで意味を手放さなかった一画だ。", "蒼炎に照らすと、書き損じは書き直されていた。写し手のいない部屋で、文字たちは自分で意味を思い出したのだ。"],
  "2-4": ["この鍵が合う扉はひとつしかない。迷宮の最も深い書架、アルマが一冊を収めるはずだった空の棚の扉だ。", "蒼く燃える鍵は、迷宮の外ではなく内側へ開く扉に合う。迷った道のすべてが、空の書架へとつながっていた。"],
  "3-1": ["階段の影は、上ではなく下へ伸びている。星にならずに流された夜の数だけ、影の段は続いている。", "この一段は、何度でも踏み直せる。巡るたびに足音は軽くなり、段はひとつ、確かに増えた。"],
  "3-2": ["欠けた歯が一枚ある。天文盤は、刻が流されただけの夜を数えずに回り、その一枚分ずつ軋んでいった。", "蒼い火を入れると、欠けた歯の跡に光が満ちる。あなたが費やした夜の数だけ、暦はまた数えはじめた。"],
  "3-3": ["『多い』の下に、同じ言葉がもう一度書き足されていた。前の周のあなたの筆跡だ。先の誰かの一言に、あなたが応えたのだ。", "最後の頁の続きが、蒼い文字で浮かび上がる。『数えることをやめなかった者の一夜が、明日の星になる』。"],
  "3-4": ["星空を見上げる背中は、アルマのものではなかった。名も知らぬ先の観測者の背中だ。その隣に、前の周のあなたの背中が並んでいる。", "蒼く曇ったレンズの奥に、遥か高く続く塔が見える。誰も待っていないその上層にも、灯すべき星がある。"],
  "4-1": ["時計塔へ急いだ足音の主は、調律器を抱えたアルマだった。凍った足音の間に、一度だけ立ち止まった跡がある。", "蒼く燃える足音が、氷の中で再び歩き出す。今この回廊を進む足音は、あなたのものだけだ。"],
  "4-2": ["栞の一文には続きがあった。原典へ回収されるとき、言葉は自ら最後の一節だけを氷に残していった。", "蒼炎に触れても栞は溶けず、文字だけが温かくなる。宛先を待っていた一文が、あなたを宛先に選んだ。"],
  "4-3": ["秒針が止まったのは、アルマが調律器を回しきった瞬間だった。時計塔は、その一秒をずっと抱えている。", "巡りを重ねた集中の傍で、秒針は蒼く光りながら動き出す。止まっていた一秒は、無駄ではなかった。"],
  "5-1": ["熾火の芯には灰が詰まっている。炉に刻を注ぎ尽くした錬金術師たちが、星になる前に残していった熱だ。", "赤い熾火が蒼く変わるのは、冷めたからではない。芯の温度が上がった証だ。巡り直した炉は、先人の熱にあなたの刻を重ねて燃えている。"],
  "5-2": ["空白の欄の下に、かすれた線が何本も引かれていた。錬金術師たちは自分たちの刻で埋めようとして、果たせなかった。", "蒼い炎で炙ると、空白の欄に文字が浮かぶ。前の周のあなたの名だ。その下には、もう一行分の余白が空けてある。"],
  "5-3": ["火竜が見続けている夢は、星になった人々がかつて学んでいた夜の夢だ。竜はそれを一夜も忘れていない。", "蒼く冷えた鱗の向こうで、火竜が片目を開ける。何度も戻ってきた者だけを、竜は覚えている。言葉は交わさない。"],
  "5-4": ["炉心の灯は、注ぐ者の迷いに合わせて色を落とす。黒く沈んだ灯もまた、刻の一つの形だ。", "巡りを重ねた刻に応えて、炉心は蒼い炎に変わった。これ以上熱くなれない炎だけが、この色になる。"],
  "6-1": ["白い羽根の根元だけが黒く染まっている。祭壇へ向かう途中、アルマは一度だけ振り返った。", "蒼く縁取られた羽根は、上へと舞い上がる。参道の先、雲の上にもまだ道が続いている。"],
  "6-2": ["譜面の裏には、歌われなかった旋律が書かれている。星になった人々の声は、この沈黙の小節に眠っている。", "蒼い光で読むと、星の位置が一つずつ高くなっている。この聖歌は、塔の上でひとり詠唱する者のためのものだった。"],
  "6-3": ["鈴の内側に、小さく名前が刻まれている。アルマの名の隣に並ぶのは、前の周にこの祭壇へ辿り着いた、あなた自身の名だ。", "蒼炎の鈴を鳴らすと、和音は天頂へ昇っていく。祭壇は終点ではなく、星天の塔の入口だった。"],
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
  skin("a-lantern", 1, "琥珀のランタン", "lantern", "#f2c27a", "魔法陣が琥珀色に灯る", "黄金期、夜通し学ぶ者の書斎を照らしたランタン。火を灯せば、魔法陣の線までもが星脈の盛んだった頃の夕暮れ色に染まる。", { lineColor: "#f2c27a", particleColor: "#fbf3d4", aura: "rgba(242,194,122,0.10)" }),
  skin("a-leaf", 2, "翠玉の葉脈", "leaf", "#8fdcc4", "魔法陣が翠玉色の葉脈に変わる", "言葉が溶ける前の、最も古い樹の一葉。葉脈は星脈の写しで、なぞるように魔力が緑の光となって巡る。", { lineColor: "#8fdcc4", particleColor: "#d7f5a8", aura: "rgba(143,220,196,0.10)" }),
  skin("a-aurora", 3, "極光の水晶瓶", "vial", "#9ef0c9", "魔法陣と背景がオーロラ色に揺らめく", "刻が止まる直前、観測塔の頂で星読みが封じた最後の極光。この瓶の中でだけ、空はまだ移ろい続けている。", { lineColor: "#9ef0c9", particleColor: "#c9b6ff", aura: "rgba(168,130,251,0.14)" }),
  skin("a-frost", 4, "氷華の結晶", "crystal", "#cfe9ff", "魔法陣が氷の白光をまとう", "大沈黙の中心で生まれた結晶。世界を眠らせた静寂そのもので、触れた魔法陣は張り詰めた白い光をまとう。", { lineColor: "#e6f4ff", particleColor: "#8db7f2", aura: "rgba(207,233,255,0.10)" }),
  skin("a-flame", 5, "紅蓮の火種", "flame", "#f2a38d", "魔法陣が紅蓮の炎色に燃える", "詠唱の儀式のため、魔導炉の最初の熾火から分けた種火。魔法陣に灯せば、線は観測者の刻を受けて紅く脈打つ。", { lineColor: "#f2a38d", particleColor: "#f2c27a", aura: "rgba(241,154,154,0.10)" }),
  skin("a-crown", 6, "天冠の円環", "ring", "#fbf3d4", "魔法陣が天上の白金に輝く", "星冠の祭壇で、継ぐ者を待っていた白金の環。アルマはこれを戴かず、後から来る観測者のために置いていった。", { lineColor: "#fbf3d4", particleColor: "#e2c974", aura: "rgba(251,243,212,0.12)" }),
];

/** 周天の章で授かる魔法陣スキン（宝箱からは出ない） */
export const CYCLE_SKINS: SkinItem[] = [
  {
    ...skin("a-eclipse", 6, "黒曜の蝕環", "eclipse", "#b9b2d4", "魔法陣が光を呑む漆黒の蝕に沈む", "一度灯した星脈がまた細ってゆく夜、祭壇の灯が一度だけ蝕まれて生まれた環。光の輪郭だけを銀に残し、魔法陣を大沈黙の頃の闇へ沈める。", { lineColor: "#b9b2d4", particleColor: "#7a68b0", aura: "rgba(6,4,18,0.5)" }),
    cycle: 2,
  },
  {
    ...skin("a-azureflame", 6, "蒼炎の聖火", "flame", "#6fb6ff", "魔法陣が青白い蒼炎に燃え上がる", "三度目の周天で、先人の熱にあなたの刻が重なって灯った聖火。燃やすものを持たず、ひとりで詠唱を続ける意志だけを糧に、蒼く澄んで燃え続ける。", { lineColor: "#6fb6ff", particleColor: "#bfe6ff", aura: "rgba(70,140,255,0.14)" }),
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
    drop && `稀品以上の流れ星が降る確率 +${Math.round(drop * 100)}%`,
  ]
    .filter(Boolean)
    .join(" / ");
}

/** 宝箱の奥に眠る秘宝。所持しているだけで加護が働く */
export const RELICS: RelicItem[] = [
  relic("r-observer", "A", "伝承", 1, "観測者の羊皮紙", "parchment", "#e2c974", { mp: { rate: 0.15, subjects: ["数学"] } }, "アルマが星脈の流れを数式で書き留めた羊皮紙。星の動きと魔力の収束点が刻まれ、余白の染みは沈黙を越えてなお乾いていない。"),
  relic("r-kotodama", "A", "伝承", 2, "言霊の古文書", "tome", "#e7a9c6", { mp: { rate: 0.15, subjects: ["国語"] } }, "原典に回収されずに残った、数少ない言葉の写し。声に出して読むと、頁の奥で預けられた言葉が小さく頷く。"),
  relic("r-epigraph", "A", "伝承", 2, "異邦の碑文写本", "tablet", "#8fdcc4", { mp: { rate: 0.15, subjects: ["英語"] } }, "海の向こうの学院が残した碑文の写し。星脈は一つの国のものではなかった。読めない文字ほど、こちらを読もうとしてくる。"),
  relic("r-alchemist", "A", "伝承", 3, "錬金術師の覚え書き", "scroll", "#e2c974", { mp: { rate: 0.15, subjects: ["理科"] } }, "魔導炉で詠唱の儀式を試した者の手帳。失敗ばかりが几帳面に綴られ、最後の頁にだけ、星屑が一粒生まれた印がある。"),
  relic("r-chronicle", "A", "伝承", 4, "王朝年代記の断簡", "scroll", "#b9a2f7", { mp: { rate: 0.15, subjects: ["社会"] } }, "星脈とともに栄え、言葉の溶解とともに滅んだ王朝の年代記。並べ直すたびに、崩壊へ至る道筋が少しずつ違って見える。"),
  relic("r-starstone", "A", "触媒", 1, "星詠みの輝石", "gem", "#cfe9ff", { mp: { rate: 0.05 } }, "大沈黙の夜明け前、最後に瞬いた一番星を閉じ込めた輝石。黙った星脈の中で、持ち主の魔力だけをほんの少し澄ませ続ける。"),
  relic("r-compass", "A", "装置", 3, "渡り鳥の羅針儀", "compass", "#71e2ef", { drop: 0.1 }, "星脈から零れる流れ星を追って飛ぶ、渡り鳥の羅針儀。針は北ではなく、刻の欠片が落ちる場所を指す。"),
  relic("r-armillary", "S", "装置", 3, "天球の調律器", "armillary", "#a882fb", { mp: { rate: 0.2, subjects: ["数学", "理科"] } }, "天球の運行を整えてきた学院の至宝。沈黙の夜、アルマはこの環を逆に回して星脈を止めた。真鍮には、そのとき握りしめた指の跡が残る。"),
  relic("r-sandtray", "S", "装置", 4, "黄昏の砂盤", "sandtray", "#f2c27a", { drop: 0.2 }, "大沈黙の行く末を占った砂盤。最後に描かれた模様は、世界が凍る一瞬前の空の形と、いつか再び星が降る日の在処。"),
  relic("r-codex", "S", "伝承", 5, "万象の写本", "tome", "#fbf3d4", { mp: { rate: 0.2, subjects: ["国語", "英語", "社会"] } }, "沈黙のとき世界中から抜き取られた言葉の目録。原典に封じた言葉は消えたのではない、預けたのだと、末尾にアルマの筆跡で記されている。"),
  relic("r-starcore", "S", "触媒", 6, "始原の星核", "core", "#9ef0c9", { mp: { rate: 0.15 } }, "星脈を止めたとき、すべての星が瞬きをやめるなかで、ただ一つ芯の熱を失わなかった星の核。世界にまだ火を戻せる余地があることを、たった一つで証し続けている。"),
];

/** 星天の導き（1日1回の授かり物）でのみ得られる触媒。宝箱の抽選には含めない */
export const GUIDANCE_CATALYSTS: CatalystItem[] = [
  catalyst("g-stardust", "星屑の触媒", "vial", "#f6e9bd", 1.2, 0, "星脈から零れ戻った星屑。これまでに灯した刻が、ほのかな温もりのまま小瓶に返ってきたもの。"),
  catalyst("g-aurora", "極光の輝石", "crystal", "#9ef0c9", 1.8, 0, "七夜続けて空を見上げた者の前で、凍った空の縁が一度だけ極光に揺らぐ。その揺らぎを固めた欠片で、ひと晩の詠唱を星座の一角まで届かせるほどの力を秘める。"),
];

/** 古代文書: 各ステージに1冊。4葉それぞれに一場面ずつ記され、揃えて復元すると秘された結びが現れる */
export type AncientDocument = {
  id: string;
  stageId: number;
  title: string;
  /** 文書が書かれた時代 */
  era: string;
  /** 時代の英語名（通して読む頁で、時代の下に小さく添える） */
  eraEn: string;
  /** 記した者 */
  author: string;
  color: string;
  /** 断片 I〜IV の本文。手に入れた葉から読める */
  fragments: [string, string, string, string];
  /** 4葉が揃って復元したときだけ現れる結び。{name}・{time} は読む人の名前と累計詠唱時間に置き換える */
  coda: string;
  /** 断片 I〜IV を星天の塔のこの階層で授ける（ステージの流れ星からは降らない） */
  zenithFloors?: [number, number, number, number];
};

/** 星天の塔の奥で読む文書（STAGE 1〜6 のあとに置く） */
export const ZENITH_DOCUMENT_STAGE = 7;

export const DOCUMENTS: AncientDocument[] = [
  {
    id: "doc-1",
    stageId: 1,
    title: "灯火の誓約",
    era: "黄金期",
    eraEn: "GOLDEN AGE",
    author: "学院の祖アルマ",
    color: "#e2c974",
    fragments: [
      "はじめに、世界には灯がひとつしか残っていなかった。誰がともしたとも知れない小屋の机の上、問いを抱いた者の前にだけともる、小さな光だった。",
      "灯の下で覚えた一行は、灯から細く立ちのぼり、空をめぐる光の脈になった。人はそれを星脈と呼んだ。知ろうとして費やした刻と、それを綴った言葉は、星脈を昇って夜空に星を灯す。",
      "やがて机は書斎になり、書斎は学院になった。星詠みの学院。夜ごと星は増え、空は誰かの一夜で埋め尽くされていった。言葉はまだ重く、刻はまだ濃かった。",
      "だから我らは誓う。灯を絶やさぬために、今宵もひとつ、まだ知らぬことを知ろうと。――学院の祖、アルマ",
    ],
    coda: "追記。この誓いを守れなくなる日が来たら、灯だけは、この机に残していく。",
  },
  {
    id: "doc-2",
    stageId: 2,
    title: "樹海の言の葉",
    era: "言葉の溶解",
    eraEn: "DISSOLUTION",
    author: "樹海の司書",
    color: "#8fdcc4",
    fragments: [
      "樹海の木々は、読まれた言葉を養分にして育つ。声に出して読まれた一文は根となり、考え抜かれた一文は幹となる。",
      "いつからか、人は言葉を読まずに眺めるようになった。速く、多く、軽く。根を張れない言葉は樹海に溢れ、葉の上で溶けて流れていった。",
      "溶けた言葉は星脈に流れ込み、中身のない光で脈を濁らせた。写本の妖精たちは綴る意味を失って去り、大樹の囁きは日ごとに早口になった。",
      "アルマは残った言葉を根の奥へ隠し、迷宮で囲った。『守れるのは、まだ重さを持つ言葉だけだ』と。――樹海の司書の記録",
    ],
    coda: "迷宮の最も深い書架は空だった。そこに収めるはずの一冊を、アルマはまだ書いていなかった。",
  },
  {
    id: "doc-3",
    stageId: 3,
    title: "星読みの手稿",
    era: "刻の崩壊",
    eraEn: "COLLAPSE",
    author: "観測塔の星読み",
    color: "#a882fb",
    fragments: [
      "空の星は、かつてこの地で学んだ者たちの灯である。ひとりが一夜を費やして理を解くたび、夜空にはひとつ星が増える。",
      "我々が数えていたのは天体ではなく、先人たちの夜の数だった。だがここ幾年か、星はほとんど増えていない。人は刻を費やさず、ただ流すようになった。",
      "流されただけの刻は星にならない。天文盤の歯は一枚、また一枚と欠け、世界の暦は数えられない夜を抱えたまま軋みはじめた。",
      "今夜、また一つ星が瞬きをやめた。明日の星は、今日より一つ少ない。――観測塔の星読み",
    ],
    coda: "最後の夜、アルマが塔に来て、調律器を持ち出していった。止めるつもりなのだと、私は気づいていた。",
  },
  {
    id: "doc-4",
    stageId: 4,
    title: "凍れる時の碑文",
    era: "大沈黙",
    eraEn: "GREAT SILENCE",
    author: "名を削られた者",
    color: "#cfe9ff",
    fragments: [
      "その夜、星脈は沈黙した。空の星はすべて瞬きをやめ、時計塔の針は一斉に止まった。",
      "刻が止まると、言葉もまた世界から抜け落ちた。名を呼べず、問いを持てなくなった人々は、凍った星脈に溶けて、瞬きをやめた星になった。これを大沈黙と呼ぶ。",
      "けれど、すべてが失われたのではない。深く集中した者の一時間だけは、凍りついて結晶となり、この回廊に残った。大回廊の氷は、すべて誰かの一時間である。",
      "費やした刻は失われない。形を変えて、いつか解かれる日を待っている。――碑文を刻んだ者の名は、削り取られている",
    ],
    coda: "止めた手は震えていた。世界を壊すためではなく、壊れる前に眠らせるための手だった。",
  },
  {
    id: "doc-5",
    stageId: 5,
    title: "熾火の錬成録",
    era: "詠唱の儀式",
    eraEn: "THE RITE",
    author: "魔導炉の錬金術師たち",
    color: "#f2a38d",
    fragments: [
      "沈黙の後、我々は凍えて空から落ちた星を拾い集め、炉に焼べた。凍った世界で、刻を生み直す熱が要った。",
      "刻は奪っても、移しても生まれない。ひとりが集中して費やした分だけが、炉の中で星屑に変わる。我々はその手順を詠唱と名付けた。",
      "刻を積み、わずかに残った言葉を添え、炉の火で練る。集積が満ちれば星屑は星脈へ還り、凍った星をひとつ灯す。だが、我々の刻だけでは足りなかった。",
      "配合表の最後の欄は空けておく。後から来る者の刻でしか、この儀式は完成しない。――魔導炉の錬金術師たち",
    ],
    coda: "我々の刻は、もうじき尽きる。尽きた者から星脈へ還り、空に灯る。炉の番は火竜に託した。いつか誰かが来るまで、竜は我々の代わりに夢を見続ける。",
  },
  {
    id: "doc-6",
    stageId: 6,
    title: "星冠の聖典",
    era: "継承",
    eraEn: "SUCCESSION",
    author: "アルマ",
    color: "#fbf3d4",
    fragments: [
      "この聖典を読む者よ。あなたが辿ってきた道は、世界が失ったものを、失った順にもう一度拾い直す道だった。",
      "灯の机で問いを持ち、樹海で言葉の重さを知り、星を数え、凍った刻に触れ、炉で詠唱の由来を知った。それは世界が手放していったものの順番で、私が世界に返せなかったものの順番だ。",
      "私もかつて、名も知らぬ誰かの遺した陣に呼ばれた一人だった。だから自分の刻と名を星冠の鈴に溶かし、陣を遺す。いつか誰かが、その陣の前で詠唱を始めるように。私たちが会うことはない。",
      "観測者よ。あなたの一夜は、錬金術師たちの後に続いて、凍った空にふたたび灯る星になる。次の誰かにとって、あなたが最初の灯になる。――アルマ",
    ],
    coda: "けれど一度灯しただけでは、星脈はすぐにまた細くなる。巡りなさい。周天の先で、私が封じたものが待っている。見上げた空の星はどれも、あなたより先にこの道を歩いた者の光だ。あなたは一人だが、独りではない。",
  },
  {
    id: "doc-7",
    stageId: ZENITH_DOCUMENT_STAGE,
    title: "余白の原典",
    era: "再創生",
    eraEn: "REGENESIS",
    author: "名を持たない者たち",
    color: "#d9d2f5",
    fragments: [
      "原典の封は、鍵でも呪文でも解けない。最後の頁が空白のまま閉じられているからだ。言葉たちは、続きを綴る者が現れるまで眠ることを選んだ。",
      "沈黙の夜、すぐには凍らなかった者たちがいた。刻を流さず、最後まで炉の前で費やしていた者たちだ。彼らが残ったのは、選ばれたからではない。手を止めなかったからだ。",
      "アルマとは、ひとりの名ではない。机に灯をともした者、その灯の下で陣を描いた者、陣に呼ばれて灯を継いだ者。星冠の祭壇に至った者は、みな鈴に自分の名を刻み、やがてその名を継いできた。最初のアルマが誰だったかは、もう誰も知らない。",
      "陣は、世界の外から人を呼ぶのではない。今夜ひとつ知ろうとして、ひとり灯の前に座った者の前に開く。だから観測者は、呼ばれたときにはもう一人きりでいる。",
    ],
    coda: "原典の最後の頁は、まだ空いている。そこに綴られるのは、あなたの名と、あなたが費やした刻。あなたが、次のアルマになる。――観測者 {name}、{time}の刻をここに預ける",
    zenithFloors: [25, 50, 75, 100],
  },
];

/** 秘された結びに、読む人の名前と累計詠唱時間（分）を差し込む */
export function fillCoda(coda: string, name: string, minutes: number) {
  return coda.replaceAll("{name}", name).replaceAll("{time}", formatMinutes(minutes));
}

const ROMAN_PARTS = ["I", "II", "III", "IV"];

/** 古代文書の断片（各文書 I〜IV の4葉）。そのステージの宝箱で、伝承の品と同じ枠から見つかる */
export const FRAGMENTS: FragmentItem[] = DOCUMENTS.flatMap((doc) =>
  ROMAN_PARTS.map((numeral, i) => ({
    id: `frag-${doc.stageId}-${i + 1}`,
    rarity: "B" as const,
    kind: "fragment" as const,
    type: "伝承" as const,
    name: `『${doc.title}』断片 ${numeral}`,
    flavorText: doc.fragments[i],
    svgIcon: GLYPHS.parchment,
    color: doc.color,
    documentId: doc.id,
    part: i + 1,
    stageId: doc.stageId,
    zenithFloor: doc.zenithFloors?.[i],
  })),
);

/** 復元した古代文書。4葉の本文に秘された結びを添えて読める。1冊につき全属性の獲得MP +1%（永久） */
export const MEMORIES: MemoryItem[] = DOCUMENTS.map((doc) => ({
  id: `mem-${doc.stageId}`,
  rarity: "S",
  kind: "memory",
  type: "伝承",
  name: `『${doc.title}』`,
  flavorText: doc.fragments[0],
  svgIcon: GLYPHS.tome,
  color: doc.color,
  documentId: doc.id,
  stageId: doc.stageId,
  memory: doc.fragments,
  coda: doc.coda,
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
  flavorText: "還元された遺物に宿っていた先人たちの刻が、星屑となって凝り固まった原石。観測者の刻と重ねて錬成陣に捧げれば、新たな器の形を得る。",
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
      "止めるために回された調律器と、流れを記した羊皮紙がひとつに溶けた天球儀。凍った星座を一つずつ描き直し、世界に理を思い出させる。再創生の第一の器。",
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
      "アルマが沈黙の夜に言葉を封じた原典の、封がほどけた姿。頁を開くたび、預けられていた言葉が一つずつ世界へ還っていく。再創生の第二の器。",
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
      "星の降る日を占った砂と、流れ星を追う針が錬り合わされた羅盤。針が指すのは宝ではなく次の周天、まだ灯っていない星の海。再創生の第三の器。",
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
      "最後の星の芯と最後の一番星が重なって灯った火。アルマの机の灯と同じ色で燃え、詠唱の刻を、凍った星脈の芯まで届かせる。再創生の最後の器。",
    ),
    recipe: { ore: 120, relics: ["r-starcore", "r-starstone"] },
  },
];

/** 天界遺物（SS）: 星天の塔の節目の階層でのみ授かる */
export const CELESTIAL_RELICS: RelicItem[] = [
  { ...relic("ss-zenith-lantern", "SS", "装置", 6, "天梯の星灯", "lantern", "#cfe9ff", { mp: { rate: 0.1 }, drop: 0.1 }, "塔の二十五層の窓辺に吊るされていた灯。前に昇った観測者が置いていったもので、これから昇る者の足もとを一段先だけ照らし続ける。"), zenithFloor: 25 },
  { ...relic("ss-zenith-spire", "SS", "装置", 6, "星天の尖塔儀", "tower", "#a882fb", { mp: { rate: 0.2 } }, "星天の塔を掌に収めた縮尺の模型。層の一つひとつが星になった人々の光で組まれ、覗き込むと、まだ誰も灯していない上層が暗く口を開けている。"), zenithFloor: 50 },
  { ...relic("ss-zenith-crown", "SS", "伝承", 6, "天頂の冠星", "ring", "#fbf3d4", { mp: { rate: 0.25 }, drop: 0.2 }, "アルマが天頂と記した百層で、灯し直した星々が自ら輪を成して生まれた冠。戴く者の頭上ではなく、いつかこの塔を昇る次の観測者の夜空で輝く。"), zenithFloor: 100 },
  { ...relic("ss-zenith-halo", "SS", "触媒", 6, "無窮の天環", "armillary", "#9ef0c9", { mp: { rate: 0.3 } }, "沈黙の夜、調律器が逆に回されたとき、弾け飛んだ最後の環。アルマの地図の外、二百層の先まで飛ばされてほどけ、一本の光になった。終わりのない学びの形を、ただ静かに回り続ける。"), zenithFloor: 200 },
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
  title("t-wayfarer", "S", 10, "天梯の旅人", "#cfe9ff", "星天の塔の十層に至った者の称号。足もとの雲は遥か下にあり、この高さまで届く足音は、もう自分のものだけだ。"),
  title("t-observer", "SS", 50, "星界の観測者", "#a882fb", "五十層の観測窓から、灯し直した星界を見渡した者の称号。星は見上げるものから見守るものに変わった。そのどれもが、かつて誰かだった光だ。"),
  title("t-apex", "SS", 100, "天頂に至る者", "#fbf3d4", "アルマが天頂と記した百層に立った者の称号。けれど塔は終わらず、アルマの地図だけがここで途切れ、余白に一行だけ『この先は、あなたが描く』とある。"),
  title("t-boundless", "SS", 200, "無窮を昇る者", "#9ef0c9", "二百層を越えてなお昇り続ける者の称号。塔に終わりがないことを知って、それでも一段を踏む。その一段が、次の誰かの最初の段になる。"),
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
  return item.kind === "title" || ((item.kind === "relic" || item.kind === "fragment") && item.zenithFloor !== undefined);
}

/** 星天の塔の節目で授かるものの種類の呼び名 */
export function zenithRewardKind(item: Item) {
  if (item.kind === "title") return "称号";
  if (item.kind === "fragment") return "古代文書";
  return "天界遺物";
}

/** 星天の塔の節目で授かるものの表記（称号は【】、断片は名前に『』を含むのでそのまま） */
export function zenithRewardName(item: Item) {
  if (item.kind === "title") return `【${item.name}】`;
  if (item.kind === "fragment") return item.name;
  return `『${item.name}』`;
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

/** 所持している秘宝・神話遺物の加護による、稀品以上の流れ星が降る確率の倍率 */
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
    B: [...lores.filter((l) => l.areaId === area.id), ...FRAGMENTS.filter((f) => f.stageId === area.stageId && f.zenithFloor === undefined)],
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

/** そのレア度のプールから1つ選ぶ（dropWeight の重み付き。触媒は weight、稀品は伝承の品 4・断片 各1）。判定の枠は lib/drops.ts */
export function pickDropItem(pool: Record<Rarity, Item[]>, rarity: Rarity, random: () => number = Math.random): Item {
  return pickWeighted<Item>(pool[rarity], dropWeight, random);
}
