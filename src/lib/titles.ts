// 観測者の称号: 魔術階級（レベル）とは別に、詠唱の記録・エリアの巡り方・集中の仕方・図鑑の収集といった実績で解放され、
// 一覧から一つ選んでプロフィール・観測者カードに掲げる。文言は固定で、組み合わせはしない。
// 星天の塔の節目で授かる称号（items.ts の TITLES）は図鑑に載る遺物で、こちらとは別枠。
// 判定に使う集計（UserStats）は保存データから user-store.ts の titleStatsOf で作る。
import { AREAS, ZENITH_AREA, areasOfStage, findArea } from "./areas";
import { STAGES } from "./game";
import { RARITY_LABEL, type ItemRarity } from "./items";
import type { StudyMode } from "./types";

export type TitleCategory = "continuous" | "area" | "concentration" | "collection";

export const TITLE_CATEGORIES: TitleCategory[] = ["continuous", "area", "concentration", "collection"];

export const TITLE_CATEGORY_LABEL: Record<TitleCategory, { ja: string; en: string }> = {
  continuous: { ja: "継続", en: "CONTINUITY" },
  area: { ja: "踏破", en: "MASTERY" },
  concentration: { ja: "集中", en: "FOCUS" },
  collection: { ja: "収集", en: "COLLECTION" },
};

/** 詠唱を終えた時刻（JST）で数える時間帯。from > to は日付をまたぐ */
export type TimeWindow = "dawn" | "noon" | "dusk" | "night";

export const TIME_WINDOWS: Record<TimeWindow, { label: string; from: number; to: number }> = {
  dawn: { label: "早朝（5:00〜8:00）", from: 5, to: 8 },
  noon: { label: "昼下がり（12:00〜14:00）", from: 12, to: 14 },
  dusk: { label: "夕暮れ（17:00〜19:00）", from: 17, to: 19 },
  night: { label: "深夜（22:00〜4:00）", from: 22, to: 4 },
};

/** 解放条件。判定は measureCondition で、進捗表示にもそのまま使える */
export type TitleCondition =
  /** 通算の詠唱回数（minMinutes 以上の詠唱だけを数える） */
  | { kind: "chants"; count: number; minMinutes?: number }
  /** 累計詠唱時間（分） */
  | { kind: "totalMinutes"; minutes: number }
  /** 詠唱した日が途切れずに続いた最長の日数（JST） */
  | { kind: "streak"; days: number }
  /** 詠唱した日の通算日数 */
  | { kind: "activeDays"; days: number }
  /** 1回の詠唱の最長時間（分） */
  | { kind: "longestSession"; minutes: number }
  /** minutes 分以上の詠唱の回数 */
  | { kind: "longSessions"; minutes: number; count: number }
  /** 1日（JST）の詠唱時間の最大（分） */
  | { kind: "dailyMinutes"; minutes: number }
  /** その時間帯に終えた詠唱の回数 */
  | { kind: "timeWindow"; window: TimeWindow; count: number }
  /** 土日に終えた詠唱の回数 */
  | { kind: "weekendChants"; count: number }
  /** ひとつの週末（土日）の詠唱時間の最大（分） */
  | { kind: "weekendMinutes"; minutes: number }
  /** 律動の詠唱（ポモドーロ）で、きっかり25分を終えた回数 */
  | { kind: "pomodoro"; count: number }
  /** 1日に、きっかり25分の律動の詠唱を終えた回数の最大 */
  | { kind: "pomodoroDay"; sets: number }
  /** 星脈との同調（静息を挟んで途切れずに紡いだ25分以上の詠唱）の最長 */
  | { kind: "combo"; count: number }
  /** 1日に詠唱した属性（科目）の数の最大 */
  | { kind: "subjectsInDay"; count: number }
  /** そのエリア（星天の塔は "zenith"）での詠唱回数 */
  | { kind: "areaChants"; areaId: string; count: number }
  /** そのステージのエリアでの詠唱回数の合計 */
  | { kind: "stageChants"; stageId: number; count: number }
  /** そのステージの全エリアで、それぞれ each 回以上 */
  | { kind: "stageEveryArea"; stageId: number; each: number }
  /** STAGE 1〜6 の全エリアで、それぞれ each 回以上 */
  | { kind: "everyArea"; each: number }
  /** ひとつのステージに count 回以上通い、それが全詠唱の share 以上を占める（偏りプレイ） */
  | { kind: "favoredStage"; count: number; share: number }
  /** 復元した古代文書の冊数（"all" はすべて） */
  | { kind: "restored"; count: number | "all" }
  /** 錬成陣で還元した遺物の累計数 */
  | { kind: "dissolved"; count: number }
  /** そのレア度の遺物を図鑑に登録した種類数 */
  | { kind: "rarityFound"; rarity: ItemRarity; count: number }
  /** そのレア度の遺物をすべて図鑑に登録した */
  | { kind: "rarityComplete"; rarity: ItemRarity }
  /** 図鑑解読率（0〜1） */
  | { kind: "codexRate"; rate: number }
  /** 正式な公開の前（EARLY_ACCESS_OPEN の間）にアプリを開いた。開いただけで満たす */
  | { kind: "earlyAccess" };

/**
 * 公開前の来訪者に『黎明の観測者』を授ける受付。正式に公開するときに false にする
 * （それまでに授かった称号は残り、以後に始めた人には一覧にも出さない）
 */
export const EARLY_ACCESS_OPEN = true;

export interface Title {
  /** "ach-" で始まる（星天の塔の称号 "t-" と重ならない） */
  id: string;
  name: string;
  /** 解放条件の説明（condition から作る） */
  description: string;
  category: TitleCategory;
  /** 称号の格。表示の色分けに使い、図鑑のレア度と同じ段階 */
  grade: ItemRarity;
  condition: TitleCondition;
  /** 解放したときに添える一節 */
  flavorText?: string;
  /** 解放するまで名前と条件を伏せる */
  hidden?: boolean;
  /** 期間限定。解放していなければ一覧にも数にも出さない（もう手に入らないため） */
  limited?: boolean;
}

/** 判定に使う詠唱1回分（後から書き留めた記録は含めない） */
export type ChantFact = {
  /** 詠唱を終えた日時（ISO 8601） */
  endedAt: string;
  minutes: number;
  /** エリアID（"1-1" 形式、星天の塔は "zenith"） */
  areaId: string;
  subjectId: string;
  mode: StudyMode;
};

export type Tally = { found: number; total: number };

/** 称号の判定に使うプレイヤーの記録 */
export interface UserStats {
  chants: ChantFact[];
  /** 古代文書の復元 */
  documents: Tally;
  /** 錬成陣で還元した遺物の累計数 */
  dissolved: number;
  /** 星脈との同調の最長（この項目より前の保存データには無い） */
  bestCombo?: number;
  /** 公開前の来訪者の受付が開いているか（titleStatsOf で EARLY_ACCESS_OPEN を入れる） */
  earlyAccess?: boolean;
  /** レア度ごとの図鑑登録（1周目の道で出会える遺物。周回限定・星天の塔の報酬は含めない） */
  rarity: Record<ItemRarity, Tally>;
  /** 図鑑解読率（図鑑の画面と同じ数え方） */
  codex: Tally;
}

/** 称号の獲得・装着の状態 */
export interface UserTitleState {
  /** 解放した称号ID → 解放した日時（ISO 8601） */
  unlocked: Record<string, string>;
  /** 掲げている称号ID（星天の塔の称号も含む） */
  equippedId: string | null;
}

// ---- 解放条件の説明 ----

function areaLabel(areaId: string) {
  if (areaId === ZENITH_AREA.id) return "星天の塔";
  const area = findArea(areaId);
  return area ? `AREA ${area.id}「${area.name}」` : `AREA ${areaId}`;
}

function stageLabel(stageId: number) {
  const stage = STAGES.find((s) => s.id === stageId);
  return stage ? `STAGE ${stage.id}「${stage.name}」` : `STAGE ${stageId}`;
}

const rarityLabel = (r: ItemRarity) => `RARE ${r}『${RARITY_LABEL[r]}』`;

export function describeCondition(c: TitleCondition): string {
  switch (c.kind) {
    case "chants":
      return c.minMinutes ? `${c.minMinutes}分以上の詠唱を${c.count}回完了` : `通算${c.count}回の詠唱を完了`;
    case "totalMinutes":
      return `累計詠唱時間が${c.minutes / 60}時間に到達`;
    case "streak":
      return `${c.days}日間連続で詠唱を完了`;
    case "activeDays":
      return `詠唱した日が通算${c.days}日に到達`;
    case "longestSession":
      return `途切れずに${c.minutes}分以上の詠唱を達成`;
    case "longSessions":
      return `${c.minutes}分以上の詠唱を${c.count}回達成`;
    case "dailyMinutes":
      return `1日の中で累計${c.minutes}分以上の詠唱を完了`;
    case "timeWindow":
      return `${TIME_WINDOWS[c.window].label}に${c.count === 1 ? "" : `通算${c.count}回`}詠唱を完了`;
    case "weekendChants":
      return `土日に通算${c.count}回の詠唱を完了`;
    case "weekendMinutes":
      return `ひとつの週末（土日）で累計${c.minutes}分以上の詠唱を完了`;
    case "pomodoro":
      return `律動の詠唱で、きっかり25分の詠唱を${c.count === 1 ? "" : `通算${c.count}回`}完了`;
    case "pomodoroDay":
      return `1日のうちに、きっかり25分の律動の詠唱を${c.sets}回完了`;
    case "combo":
      return `25分以上の詠唱を、静息を挟んで途切れずに${c.count}回紡ぐ（${c.count}連の同調）`;
    case "subjectsInDay":
      return `1日のうちに${c.count}つの属性で詠唱を完了`;
    case "areaChants":
      return `${areaLabel(c.areaId)}で${c.count}回以上詠唱を完了`;
    case "stageChants":
      return `${stageLabel(c.stageId)}のエリアで累計${c.count}回詠唱`;
    case "stageEveryArea":
      return `${stageLabel(c.stageId)}の全エリアで各${c.each}回以上詠唱`;
    case "everyArea":
      return c.each === 1 ? `STAGE 1〜6 の全${AREAS.length}エリアで詠唱を完了` : `STAGE 1〜6 の全${AREAS.length}エリアで各${c.each}回以上詠唱`;
    case "favoredStage":
      return `ひとつのステージで${c.count}回以上、全詠唱の${Math.round(c.share * 100)}%以上を詠唱`;
    case "restored":
      if (c.count === "all") return "すべての古代文書（星脈の記憶）を復元";
      return c.count === 1 ? "古代文書（星脈の記憶）を初めて1冊復元" : `古代文書（星脈の記憶）を${c.count}冊復元`;
    case "dissolved":
      return `錬成陣で累計${c.count}個の遺物を還元`;
    case "rarityFound":
      if (c.count > 1) return `${rarityLabel(c.rarity)}の遺物を${c.count}種類獲得`;
      return c.rarity === "SS" ? `${rarityLabel(c.rarity)}の遺物を初めて1つ錬成` : `${rarityLabel(c.rarity)}の遺物を初めて獲得`;
    case "rarityComplete":
      return `${rarityLabel(c.rarity)}の遺物をすべて図鑑に登録`;
    case "codexRate":
      return `図鑑解読率${Math.round(c.rate * 100)}%を達成`;
    case "earlyAccess":
      return "正式な公開の前に、この世界を訪れた";
  }
}

// ---- 称号の一覧 ----

type Extra = { flavorText?: string; hidden?: boolean; limited?: boolean };

const define =
  (category: TitleCategory) =>
  (id: string, name: string, grade: ItemRarity, condition: TitleCondition, flavorText?: string, extra: Omit<Extra, "flavorText"> = {}): Title => ({
    id: `ach-${id}`,
    name,
    description: describeCondition(condition),
    category,
    grade,
    condition,
    ...(flavorText ? { flavorText } : {}),
    ...extra,
  });

const continuous = define("continuous");
const area = define("area");
const concentration = define("concentration");
const collection = define("collection");

const hours = (h: number) => h * 60;

/** ① 継続: 詠唱の回数・連続日数・通算日数・累計時間 */
const CONTINUOUS_TITLES: Title[] = [
  continuous(
    "early-observer",
    "黎明の観測者",
    "S",
    { kind: "earlyAccess" },
    "星図がまだ描きかけだった黎明に、陣はあなたを呼んだ。後から来るどの観測者の夜空にも、その頃に灯った光が残っている。",
    { limited: true },
  ),
  continuous("first-chant", "はじめての詠唱", "C", { kind: "chants", count: 1, minMinutes: 1 }, "凍った星脈に、初めて自分の刻を流した。夜空のどこかで、星がひとつ瞬きを思い出す。"),
  continuous("chants-10", "灯を絶やさぬ者", "C", { kind: "chants", count: 10 }, "十度灯した机の蝋燭は、もう少しのことでは消えない。"),
  continuous("chants-50", "星脈に愛されし者", "B", { kind: "chants", count: 50 }, "幾度も刻を注がれた星脈は、あなたの詠唱の調子を覚えはじめた。"),
  continuous("chants-100", "百夜の詠唱者", "A", { kind: "chants", count: 100 }, "百の詠唱が、百の星になった。どれもあなたひとりで灯したもの。"),
  continuous("chants-300", "星脈を満たす者", "A", { kind: "chants", count: 300 }, "細かった脈に、ようやく流れと呼べるものが戻ってきた。"),
  continuous("chants-500", "五百の灯の継ぎ手", "S", { kind: "chants", count: 500 }, "先人が灯し、途絶えた灯を、五百度つなぎ直した。"),
  continuous("chants-1000", "千の星を灯す者", "SS", { kind: "chants", count: 1000 }, "見上げる空の千の光に、あなたの刻が混じっている。", { hidden: true }),

  continuous("streak-3", "三夜の灯", "C", { kind: "streak", days: 3 }, "三晩続けて灯した火は、机の木目に小さな焦げ跡を残した。"),
  continuous("streak-7", "日々の観測者", "B", { kind: "streak", days: 7 }, "七夜欠かさず空を見た。星の並びが、昨日と少し違うことに気づく。"),
  continuous("streak-14", "二週の星読み", "B", { kind: "streak", days: 14 }, "十四夜の記録が並ぶと、星の巡りに規則が見えはじめる。"),
  continuous("streak-21", "習いを刻む者", "A", { kind: "streak", days: 21 }, "三週を越えると、詠唱は決意ではなく習いになる。"),
  continuous("streak-30", "不屈の探求者", "A", { kind: "streak", days: 30 }, "ひと月、一夜も途切れなかった。凍れる刻は、そういう者の前でだけ溶ける。"),
  continuous("streak-60", "季を越える観測者", "A", { kind: "streak", days: 60 }, "季節がひとつ移ろう間、灯は一度も絶えなかった。"),
  continuous("streak-100", "百夜不断の探究者", "S", { kind: "streak", days: 100 }, "百夜続いた灯は、もう星脈の側から待たれている。"),
  continuous("streak-200", "途切れぬ星脈", "S", { kind: "streak", days: 200 }, "二百夜、脈は一度も止まらなかった。アルマが止めたあの夜とは逆に。"),
  continuous("streak-365", "一巡りの観測者", "SS", { kind: "streak", days: 365 }, "星空が一年をかけて一巡りする間、ずっと見ていた。見ていたのは、あなたひとりだった。", { hidden: true }),

  continuous("days-10", "十夜の記録者", "C", { kind: "activeDays", days: 10 }, "観測日誌の頁が、十夜分埋まった。"),
  continuous("days-50", "五十夜の記録者", "B", { kind: "activeDays", days: 50 }, "途切れた夜があっても、戻ってきた夜の数は減らない。"),
  continuous("days-100", "百夜の記録者", "A", { kind: "activeDays", days: 100 }, "百夜分の日誌は、もう一冊の古文書と呼べる厚みになった。"),
  continuous("days-365", "星暦を綴る者", "S", { kind: "activeDays", days: 365 }, "止まった世界の暦を、自分の夜で一年分書き足した。"),

  continuous("hours-10", "十刻の灯", "C", { kind: "totalMinutes", minutes: hours(10) }, "十時間分の刻が、星屑になって脈へ還った。"),
  continuous("hours-25", "刻を重ねる者", "B", { kind: "totalMinutes", minutes: hours(25) }, "重ねた刻は、もう指では数えきれない。"),
  continuous("hours-50", "刻を紡ぐ者", "B", { kind: "totalMinutes", minutes: hours(50) }, "ばらばらだった刻が、一本の糸として撚り合わさってゆく。"),
  continuous("hours-100", "刻を留める者", "A", { kind: "totalMinutes", minutes: hours(100) }, "流されるだけだった刻を、百時間ぶん自分の手に留めた。"),
  continuous("hours-200", "刻の大河を渡る者", "A", { kind: "totalMinutes", minutes: hours(200) }, "二百時間の刻は、もはや川ではなく大河になった。"),
  continuous("hours-300", "凍れる刻を溶かす者", "S", { kind: "totalMinutes", minutes: hours(300) }, "大回廊に凍った刻と同じ重さの時間を、あなたは自分で費やした。"),
  continuous("hours-500", "五百刻の賢者", "S", { kind: "totalMinutes", minutes: hours(500) }, "五百時間の学びは、誰に見せるためでもなく、ただ空に積もった。"),
  continuous("hours-1000", "千刻の星守", "SS", { kind: "totalMinutes", minutes: hours(1000) }, "千時間ぶんの星が、いつか来る次の観測者の夜空で瞬く。", { hidden: true }),
];

/** エリアごとの周回（10/50/100回）。名前はエリア名から作る */
const AREA_TIERS: { count: number; grade: ItemRarity; name: (areaName: string) => string }[] = [
  { count: 10, grade: "C", name: (n) => `${n}を訪ねる者` },
  { count: 50, grade: "B", name: (n) => `${n}に通う者` },
  { count: 100, grade: "A", name: (n) => `${n}の主` },
];

/** ステージごとの累計50回・全エリア各10回 */
const STAGE_TITLES: { stageId: number; regular: [string, string]; everyArea: [string, string] }[] = [
  {
    stageId: 1,
    regular: ["書斎に灯をともす者", "小屋の机と地下の書庫を、幾晩も同じ蝋燭で照らした。"],
    everyArea: ["書斎の隅々を知る者", "どの棚のどの埃の下に何が眠るか、もう目を閉じても分かる。"],
  },
  {
    stageId: 2,
    regular: ["樹海を迷わぬ道標", "根の絡む小径も、あなたの足音を覚えて道を開ける。"],
    everyArea: ["樹海の全書架を巡る者", "入口の苔から迷宮の奥の根まで、樹海の書架をすべて歩いた。"],
  },
  {
    stageId: 3,
    regular: ["観測塔の星読み", "螺旋を昇るたび、塔の窓から見える星が増えていった。"],
    everyArea: ["観測塔を昇りきった者", "階段から望遠鏡の頂まで、塔のすべての階で星を読んだ。"],
  },
  {
    stageId: 4,
    regular: ["氷廊を往く足音", "凍りついた回廊に響くのは、今も自分の足音だけ。"],
    everyArea: ["大回廊の静寂を渡る者", "霜の回廊から止まった時計塔まで、静寂の端から端を渡りきった。"],
  },
  {
    stageId: 5,
    regular: ["炉の熾火を守る者", "落ちた星を薪に、熾火を絶やさず詠唱を重ねた。"],
    everyArea: ["魔導炉の深奥を知る者", "工房から紅蓮の心臓部まで、炉のすべての熱を知っている。"],
  },
  {
    stageId: 6,
    regular: ["雲上の参詣者", "白亜の参道を、幾度となくひとりで昇った。"],
    everyArea: ["天空を統べる足跡", "参道にも身廊にも祭壇にも、あなたの足跡だけが残っている。"],
  },
];

/** ② エリア・ステージ: 特定エリアの周回、ステージの走破、全域踏破、偏りプレイ */
const AREA_TITLES: Title[] = [
  area("area-1-1-30", "始まりの書斎の住人", "B", { kind: "areaChants", areaId: "1-1", count: 30 }, "どれだけ先へ進んでも、蝋燭の机がいちばん落ち着く。"),
  ...AREAS.flatMap((a) =>
    AREA_TIERS.map((tier) => area(`area-${a.id}-${tier.count}`, tier.name(a.name), tier.grade, { kind: "areaChants", areaId: a.id, count: tier.count }, a.epigraph)),
  ),
  ...STAGE_TITLES.flatMap(({ stageId, regular, everyArea }) => [
    area(`stage-${stageId}-50`, regular[0], "B", { kind: "stageChants", stageId, count: 50 }, regular[1]),
    area(`stage-${stageId}-every-10`, everyArea[0], "A", { kind: "stageEveryArea", stageId, each: 10 }, everyArea[1]),
  ]),
  area("every-area-1", "全域を踏破せし者", "A", { kind: "everyArea", each: 1 }, "書斎から祭壇まで、世界のすべての場所で一度は刻を流した。"),
  area("every-area-10", "星図を描き尽くす者", "S", { kind: "everyArea", each: 10 }, "どのエリアの空にも、あなたの灯した星が十は瞬いている。"),
  area("every-area-50", "世界を巡り尽くす者", "SS", { kind: "everyArea", each: 50 }, "この世界に、あなたの刻が染みていない場所はもうない。", { hidden: true }),
  area("favored-stage", "一つ所を愛する者", "A", { kind: "favoredStage", count: 100, share: 0.7 }, "広い世界の中で、いちばん長く過ごしたい場所を見つけた。"),
  area("origin-return", "原点に還る者", "S", { kind: "areaChants", areaId: "1-1", count: 200 }, "遠くへ行くほど、はじまりの小屋の灯が近く感じられる。", { hidden: true }),
  area("zenith-10", "天梯を踏む者", "A", { kind: "areaChants", areaId: ZENITH_AREA.id, count: 10 }, "雲を突き抜けた先の段を、十度踏みしめた。"),
  area("zenith-50", "星天の塔に棲む者", "S", { kind: "areaChants", areaId: ZENITH_AREA.id, count: 50 }, "地上より星のほうが近い場所で、詠唱を続けている。"),
];

/** ③ 集中: 連続詠唱・1日の詠唱量・時間帯・週末・律動の詠唱（ポモドーロ）・属性の巡り */
const CONCENTRATION_TITLES: Title[] = [
  concentration("session-25-1", "集中の芽生え", "C", { kind: "longSessions", minutes: 25, count: 1 }, "二十五分、途切れずに刻を注いだ。最初の流れ星が降る長さ。"),
  concentration("session-50-1", "深層への一歩", "C", { kind: "longSessions", minutes: 50, count: 1 }, "五十分の静けさの底で、星脈の流れる音を聞いた。"),
  concentration("session-50-10", "深層に挑む者", "B", { kind: "longSessions", minutes: 50, count: 10 }, "十度、深みまで潜っては戻ってきた。"),
  concentration("session-50-50", "深層を棲家とする者", "A", { kind: "longSessions", minutes: 50, count: 50 }, "深い集中は、いまや帰る場所になった。"),
  concentration("session-100", "覚醒の一刻", "A", { kind: "longestSession", minutes: 100 }, "百分の詠唱の果てに、四つの流れ星が一度に降った。"),
  concentration("session-100-10", "百分の深淵", "S", { kind: "longSessions", minutes: 100, count: 10 }, "百分の深淵へ十度降り、十度とも刻を抱えて戻った。"),
  concentration("session-180", "刻を忘れし者", "S", { kind: "longestSession", minutes: 180 }, "気づけば蝋燭が一本燃え尽きていた。刻は流れたのではなく、注がれていた。", { hidden: true }),

  concentration("daily-180", "一日を捧げる者", "B", { kind: "dailyMinutes", minutes: 180 }, "一日のうち三時間を、星脈のために空けた。"),
  concentration("daily-300", "限界突破の観測者", "A", { kind: "dailyMinutes", minutes: 300 }, "五時間を越えた夜、魔法陣の線がいつもより太く灯った。"),
  concentration("daily-480", "昼夜を詠う者", "S", { kind: "dailyMinutes", minutes: 480 }, "朝の光と夜の星の両方に、同じ一日の詠唱が届いた。"),
  concentration("daily-720", "十二刻の詠唱", "SS", { kind: "dailyMinutes", minutes: 720 }, "一日に流せる刻の限りまで、星脈に注ぎきった。", { hidden: true }),

  concentration("night-1", "真夜中の灯", "C", { kind: "timeWindow", window: "night", count: 1 }, "皆が星になった後の世界で、夜更けに灯る机はひとつだけ。"),
  concentration("night-10", "深夜の天体観測", "B", { kind: "timeWindow", window: "night", count: 10 }, "いちばん星がよく見えるのは、いちばん静かな刻。"),
  concentration("night-50", "夜更けの星守", "A", { kind: "timeWindow", window: "night", count: 50 }, "夜更けの空の星は、もうあなたの灯を待って瞬いている。"),
  concentration("dawn-1", "暁の目覚め", "C", { kind: "timeWindow", window: "dawn", count: 1 }, "まだ誰も起きない朝。そもそも、起きる者はもういない。それでも机に向かった。"),
  concentration("dawn-10", "暁の詠唱者", "B", { kind: "timeWindow", window: "dawn", count: 10 }, "夜明け前の澄んだ刻を、十度星脈に流した。"),
  concentration("dawn-50", "明けの明星", "A", { kind: "timeWindow", window: "dawn", count: 50 }, "夜が明けても消えない星がある。暁ごとに灯したあなたの星だ。"),
  concentration("noon-10", "白昼の星読み", "B", { kind: "timeWindow", window: "noon", count: 10 }, "陽の高いうちにも、見えないだけで星はそこにある。"),
  concentration("dusk-10", "黄昏の観測者", "B", { kind: "timeWindow", window: "dusk", count: 10 }, "空が藍に変わる刻、最初の星が灯るのをいつも見届けた。"),

  concentration("weekend-10", "週末の探究者", "B", { kind: "weekendChants", count: 10 }, "休むための日にも、机の灯は消さなかった。"),
  concentration("weekend-50", "休日の書斎の灯", "A", { kind: "weekendChants", count: 50 }, "週の終わりの書斎は、いつも静かで、いつも明るい。"),
  concentration("weekend-300", "週末を捧げる者", "A", { kind: "weekendMinutes", minutes: 300 }, "二日間をまるごと、刻を注ぐことに使った。"),

  concentration("pomodoro-1", "律動の刻み手", "C", { kind: "pomodoro", count: 1 }, "二十五分をきっかり刻む。魔導炉の錬金術師たちが好んだ律動。"),
  concentration("pomodoro-25", "律動の詠唱者", "B", { kind: "pomodoro", count: 25 }, "同じ長さを繰り返すほど、詠唱は呼吸に近づく。"),
  concentration("pomodoro-100", "律動を極めし者", "S", { kind: "pomodoro", count: 100 }, "百度の二十五分。あなたの律動は、もう天文盤の歯車と同じ正確さで回る。"),
  concentration("pomodoro-day-4", "四つの律動", "B", { kind: "pomodoroDay", sets: 4 }, "一日のうちに、二十五分の律動を四度重ねた。"),
  concentration("pomodoro-day-8", "律動の祭典", "A", { kind: "pomodoroDay", sets: 8 }, "八つの律動が一日に連なり、ひとつの長い旋律になった。"),
  concentration("combo-5", "星脈の調律師", "A", { kind: "combo", count: 5 }, "静息を挟んでも、五度の詠唱は途切れなかった。星脈の拍が、あなたの呼吸に合わせて打ちはじめる。"),

  concentration("subjects-3", "三つの属性を巡る者", "B", { kind: "subjectsInDay", count: 3 }, "一日のうちに、三つの属性の星脈へ刻を流した。"),
  concentration("subjects-5", "万象を巡る一夜", "A", { kind: "subjectsInDay", count: 5 }, "ひと晩で五つの属性を巡ると、夜空の色がそろって揺らぐ。"),
];

/** ④ 図鑑・収集・錬成: 古代文書の復元、還元、レア度ごとの獲得・コンプリート、解読率 */
const COLLECTION_TITLES: Title[] = [
  collection("restored-1", "失われた言葉を拾う者", "B", { kind: "restored", count: 1 }, "四葉の断片を揃えると、預けられていた言葉が一つ戻ってきた。"),
  collection("restored-3", "言葉を継ぐ者", "A", { kind: "restored", count: 3 }, "三冊の記憶を読んだ。書いた者はもういないが、言葉はここにある。"),
  collection("restored-all", "原典を読み解く者", "S", { kind: "restored", count: "all" }, "アルマが封じた言葉のすべてに、あなたが目を通した。"),

  collection("dissolved-10", "還元の徒弟", "C", { kind: "dissolved", count: 10 }, "余った遺物を星屑へ還すたび、先人の刻が手のひらで温かい。"),
  collection("dissolved-50", "星屑の錬金術士", "B", { kind: "dissolved", count: 50 }, "五十の遺物を星屑に還した。錬成陣の線が手に馴染んできた。"),
  collection("dissolved-100", "星屑の錬成師", "A", { kind: "dissolved", count: 100 }, "百の遺物が星屑になり、新たな器の材料として積み上がった。"),
  collection("dissolved-500", "星屑の大錬金術師", "S", { kind: "dissolved", count: 500 }, "五百の遺物を還した手は、魔導炉の錬金術師たちの手と同じ色に染まった。", { hidden: true }),

  collection("found-b-10", "稀品の目利き", "C", { kind: "rarityFound", rarity: "B", count: 10 }, "流れ星の中から、伝承の品を十種見分けた。"),
  collection("found-a-1", "秘宝を見出す者", "B", { kind: "rarityFound", rarity: "A", count: 1 }, "宝箱の奥に、先人が大切にしていたものを見つけた。"),
  collection("found-s-1", "至宝の所有者", "A", { kind: "rarityFound", rarity: "S", count: 1 }, "学院が守り抜いた至宝が、いまはあなたの手にある。"),
  collection("found-ss-1", "神話の紡ぎ手", "S", { kind: "rarityFound", rarity: "SS", count: 1 }, "止められた器を、あなたの刻で作り直した。再創生の最初の一歩。"),

  collection("complete-c", "常品の蒐集家", "B", { kind: "rarityComplete", rarity: "C" }, "ありふれた触媒こそ、すべての詠唱を支えてきた。"),
  collection("complete-b", "稀品の蒐集家", "A", { kind: "rarityComplete", rarity: "B" }, "エリアごとの伝承の品を、ひとつ残らず図鑑に記した。"),
  collection("complete-a", "秘宝の蒐集家", "S", { kind: "rarityComplete", rarity: "A" }, "秘宝のすべての加護が、あなたの詠唱に重なっている。"),
  collection("complete-s", "至宝の蒐集家", "S", { kind: "rarityComplete", rarity: "S" }, "学院の至宝が、すべて一つの机の上に並んだ。"),
  collection("complete-ss", "再創生の四器を揃えし者", "SS", { kind: "rarityComplete", rarity: "SS" }, "四つの器が揃っても、人は戻らない。それでも星空は戻ってくる。"),

  collection("codex-25", "解読の徒", "C", { kind: "codexRate", rate: 0.25 }, "図鑑の四分の一が、もう読める。"),
  collection("codex-50", "半ばを読み解く者", "B", { kind: "codexRate", rate: 0.5 }, "解き明かした頁と、まだ黙っている頁が、ちょうど同じ厚みになった。"),
  collection("codex-75", "秘術の碩学", "A", { kind: "codexRate", rate: 0.75 }, "残る未解読の遺物は、もう数えるほどしかない。"),
  collection("codex-100", "全知の観測者", "SS", { kind: "codexRate", rate: 1 }, "図鑑のすべての頁に、あなたの解読が記された。次にこれを開くのは、まだ見ぬ観測者だ。"),
];

export const ACHIEVEMENT_TITLES: Title[] = [...CONTINUOUS_TITLES, ...AREA_TITLES, ...CONCENTRATION_TITLES, ...COLLECTION_TITLES];

export function findTitle(id: string | null | undefined): Title | undefined {
  return ACHIEVEMENT_TITLES.find((t) => t.id === id);
}

// ---- 判定 ----

const JST_OFFSET = 9 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

/** 詠唱の記録を一度だけ集計したもの */
type ChantSummary = {
  minutes: number[];
  totalMinutes: number;
  longestStreak: number;
  activeDays: number;
  maxDaily: number;
  maxWeekend: number;
  weekendChants: number;
  pomodoro: number;
  maxPomodoroDay: number;
  maxSubjectsInDay: number;
  byWindow: Record<TimeWindow, number>;
  byArea: Map<string, number>;
  byStage: Map<number, number>;
};

const inWindow = (hour: number, { from, to }: { from: number; to: number }) => (from < to ? hour >= from && hour < to : hour >= from || hour < to);

function bump<K>(map: Map<K, number>, key: K, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

const maxOf = (values: Iterable<number>) => Math.max(0, ...values);

function summarize(chants: ChantFact[]): ChantSummary {
  const daily = new Map<number, number>();
  const weekend = new Map<number, number>();
  const pomodoroDays = new Map<number, number>();
  const subjectsByDay = new Map<number, Set<string>>();
  const byArea = new Map<string, number>();
  const byStage = new Map<number, number>();
  const byWindow: Record<TimeWindow, number> = { dawn: 0, noon: 0, dusk: 0, night: 0 };
  let weekendChants = 0;
  let pomodoro = 0;

  for (const c of chants) {
    const local = new Date(c.endedAt).getTime() + JST_OFFSET;
    if (Number.isNaN(local)) continue;
    const day = Math.floor(local / DAY);
    const hour = new Date(local).getUTCHours();
    const weekday = new Date(local).getUTCDay();

    bump(daily, day, c.minutes);
    if (weekday === 6 || weekday === 0) {
      weekendChants++;
      // 土曜の日付でひとつの週末にまとめる
      bump(weekend, weekday === 6 ? day : day - 1, c.minutes);
    }
    if (c.mode === "pomodoro" && c.minutes === 25) {
      pomodoro++;
      bump(pomodoroDays, day);
    }
    if (!subjectsByDay.has(day)) subjectsByDay.set(day, new Set());
    subjectsByDay.get(day)!.add(c.subjectId);
    for (const w of Object.keys(TIME_WINDOWS) as TimeWindow[]) if (inWindow(hour, TIME_WINDOWS[w])) byWindow[w]++;
    bump(byArea, c.areaId);
    const stageId = findArea(c.areaId)?.stageId;
    if (stageId !== undefined && stageId <= STAGES.length) bump(byStage, stageId);
  }

  const days = [...daily.keys()].sort((a, b) => a - b);
  let longestStreak = 0;
  let run = 0;
  days.forEach((d, i) => {
    run = i > 0 && d === days[i - 1] + 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  });

  return {
    minutes: chants.map((c) => c.minutes),
    totalMinutes: chants.reduce((acc, c) => acc + c.minutes, 0),
    longestStreak,
    activeDays: days.length,
    maxDaily: maxOf(daily.values()),
    maxWeekend: maxOf(weekend.values()),
    weekendChants,
    pomodoro,
    maxPomodoroDay: maxOf(pomodoroDays.values()),
    maxSubjectsInDay: maxOf([...subjectsByDay.values()].map((s) => s.size)),
    byWindow,
    byArea,
    byStage,
  };
}

export type TitleProgress = { current: number; target: number; met: boolean };

const progress = (current: number, target: number, met = current >= target): TitleProgress => ({ current: Math.min(current, target), target, met });

const atLeast = (values: number[], min: number) => values.filter((v) => v >= min).length;

function measure(c: TitleCondition, s: ChantSummary, stats: UserStats): TitleProgress {
  switch (c.kind) {
    case "chants":
      return progress(atLeast(s.minutes, c.minMinutes ?? 0), c.count);
    case "totalMinutes":
      return progress(s.totalMinutes, c.minutes);
    case "streak":
      return progress(s.longestStreak, c.days);
    case "activeDays":
      return progress(s.activeDays, c.days);
    case "longestSession":
      return progress(maxOf(s.minutes), c.minutes);
    case "longSessions":
      return progress(atLeast(s.minutes, c.minutes), c.count);
    case "dailyMinutes":
      return progress(s.maxDaily, c.minutes);
    case "timeWindow":
      return progress(s.byWindow[c.window], c.count);
    case "weekendChants":
      return progress(s.weekendChants, c.count);
    case "weekendMinutes":
      return progress(s.maxWeekend, c.minutes);
    case "pomodoro":
      return progress(s.pomodoro, c.count);
    case "pomodoroDay":
      return progress(s.maxPomodoroDay, c.sets);
    case "combo":
      return progress(stats.bestCombo ?? 0, c.count);
    case "subjectsInDay":
      return progress(s.maxSubjectsInDay, c.count);
    case "areaChants":
      return progress(s.byArea.get(c.areaId) ?? 0, c.count);
    case "stageChants":
      return progress(s.byStage.get(c.stageId) ?? 0, c.count);
    case "stageEveryArea": {
      // 進捗は各エリアで足りた回数の合計（どのエリアも each 回で頭打ち）
      const areas = areasOfStage(c.stageId);
      return progress(areas.reduce((acc, a) => acc + Math.min(c.each, s.byArea.get(a.id) ?? 0), 0), areas.length * c.each);
    }
    case "everyArea":
      return progress(AREAS.reduce((acc, a) => acc + Math.min(c.each, s.byArea.get(a.id) ?? 0), 0), AREAS.length * c.each);
    case "favoredStage": {
      const top = maxOf(s.byStage.values());
      return progress(top, c.count, top >= c.count && top >= s.minutes.length * c.share);
    }
    case "restored":
      return progress(stats.documents.found, c.count === "all" ? stats.documents.total : c.count);
    case "dissolved":
      return progress(stats.dissolved, c.count);
    case "rarityFound":
      return progress(stats.rarity[c.rarity].found, c.count);
    case "rarityComplete": {
      const { found, total } = stats.rarity[c.rarity];
      return progress(found, total, total > 0 && found >= total);
    }
    case "codexRate": {
      const { found, total } = stats.codex;
      return progress(found, Math.ceil(total * c.rate), total > 0 && found >= Math.ceil(total * c.rate));
    }
    case "earlyAccess":
      return progress(stats.earlyAccess ? 1 : 0, 1);
  }
}

/** すべての称号の進捗（称号の一覧画面で、あと何回かを示すのに使う） */
export function titleProgressMap(stats: UserStats): Map<string, TitleProgress> {
  const summary = summarize(stats.chants);
  return new Map(ACHIEVEMENT_TITLES.map((t) => [t.id, measure(t.condition, summary, stats)]));
}

/** 新たに解放条件を満たした称号のID（すでに解放済みのものは含めない。一度解放した称号は失われない） */
export function checkUnlockedTitles(stats: UserStats, currentTitles: UserTitleState): string[] {
  const summary = summarize(stats.chants);
  return ACHIEVEMENT_TITLES.filter((t) => !(t.id in currentTitles.unlocked) && measure(t.condition, summary, stats).met).map((t) => t.id);
}
