// 大ステージ内の小ステージ（滞在エリア）。
// 滞在エリアごとに属性魔力ブースト・降る品・背景の雰囲気が切り替わる（流れ星の確率は詠唱時間で決まる: lib/drops.ts）。
import { STAGES, type Stage } from "./game";

export type Rarity = "C" | "B" | "A" | "S";

/** 背景に漂う粒子の雰囲気 */
export type AmbienceKind = "dust" | "firefly" | "stardust" | "snow" | "ember" | "halo" | "zenith";

export type Area = {
  /** "1-1" 形式 */
  id: string;
  stageId: number;
  name: string;
  description: string;
  /** 解放に必要な累計時間（時間） */
  requiredHours: number;
  /** 属性魔力ブースト（科目名で指定） */
  boost: { subjects: string[]; multiplier: number };
  /** 原点のエリア。全属性にブースト（原点回帰）がかかり、蝋燭の灯の背景になる */
  origin?: boolean;
  /** 星天の塔。全属性にブーストがかかり、詠唱した時間で階層を昇る */
  zenith?: boolean;
  /** 通り名（例: はじまりの小屋） */
  alias?: string;
  /** 滞在時に添える一節 */
  epigraph?: string;
  ambience: {
    kind: AmbienceKind;
    /** 粒子と背景グラデーションの色 */
    colors: [string, string];
  };
};

const a = (
  id: string,
  name: string,
  description: string,
  requiredHours: number,
  boostSubjects: string[],
  multiplier: number,
  ambience: Area["ambience"],
): Area => ({
  id,
  stageId: Number(id.split("-")[0]),
  name,
  description,
  requiredHours,
  boost: { subjects: boostSubjects, multiplier },
  ambience,
});

export const AREAS: Area[] = [
  {
    ...a("1-1", "灯火の机", "蝋燭の明かりだけが頼りの、質素な小屋の机", 0, [], 1.1, { kind: "dust", colors: ["#e8b86a", "#f4d9a0"] }),
    origin: true,
    alias: "はじまりの小屋",
    epigraph: "ここから探求の旅が始まった",
  },
  a("1-2", "埃かぶりの書架", "誰も読まなくなった語学書が並ぶ棚", 3, ["国語", "英語"], 1.2, { kind: "dust", colors: ["#e7c48f", "#cfa877"] }),
  a("1-3", "秘密の地下書庫", "封じられた古文書が眠る地下の一室", 6, ["社会"], 1.2, { kind: "dust", colors: ["#b9a2f7", "#e2c974"] }),

  a("2-1", "苔むした入口", "月明かりが書架を照らす森の入口", 10, ["理科"], 1.2, { kind: "firefly", colors: ["#8fdcc4", "#d7f5a8"] }),
  a("2-2", "囁く大樹の閲覧席", "大樹の洞に設えられた静かな席", 15, ["国語", "英語"], 1.2, { kind: "firefly", colors: ["#a8e6b8", "#71e2ef"] }),
  a("2-3", "妖精の写本室", "妖精たちが去り、綴りかけの写本だけが残る部屋", 20, ["英語"], 1.3, { kind: "firefly", colors: ["#d7f5a8", "#e7a9c6"] }),
  a("2-4", "根の迷宮書庫", "絡み合う根が書架を成す迷宮", 25, ["数学"], 1.3, { kind: "firefly", colors: ["#8fdcc4", "#b9a2f7"] }),

  a("3-1", "螺旋階段", "星へと続く果てしない階段", 30, ["数学"], 1.2, { kind: "stardust", colors: ["#8db7f2", "#e2c974"] }),
  a("3-2", "天文盤の間", "巨大な天文盤が時を刻む大広間", 38, ["数学", "理科"], 1.25, { kind: "stardust", colors: ["#a882fb", "#8db7f2"] }),
  a("3-3", "星読みの露台", "夜空に最も近い吹きさらしの露台", 46, ["理科"], 1.3, { kind: "stardust", colors: ["#71e2ef", "#a882fb"] }),
  a("3-4", "望遠鏡の頂", "塔の頂に据えられた水晶の望遠鏡", 54, ["数学", "理科"], 1.35, { kind: "stardust", colors: ["#e2c974", "#a882fb"] }),

  a("4-1", "霜の回廊", "足音さえ凍りつく静かな回廊", 60, ["英語"], 1.25, { kind: "snow", colors: ["#cfe9ff", "#71e2ef"] }),
  a("4-2", "氷晶の書見台", "氷の中に文字が浮かぶ書見台", 73, ["国語", "社会"], 1.3, { kind: "snow", colors: ["#e6f4ff", "#8db7f2"] }),
  a("4-3", "凍れる時計塔", "針の止まった時計が並ぶ静寂の塔", 86, ["数学"], 1.4, { kind: "snow", colors: ["#cfe9ff", "#b9a2f7"] }),

  a("5-1", "熾火の工房", "落ちた星の熱で、今も熾火が燃え続ける工房", 100, ["理科"], 1.3, { kind: "ember", colors: ["#f2a38d", "#e2c974"] }),
  a("5-2", "溶岩の錬成槽", "魔力を溶かし込む溶岩の槽", 125, ["数学", "理科"], 1.35, { kind: "ember", colors: ["#f19a9a", "#f2c27a"] }),
  a("5-3", "火竜の封印殿", "永い眠りについた火竜のほか、誰も訪れなくなった神殿", 150, ["社会"], 1.4, { kind: "ember", colors: ["#e7a9c6", "#f2a38d"] }),
  a("5-4", "紅蓮の心臓部", "炉の核。呑み込んだ星々の光が渦巻く場所", 175, ["数学", "英語"], 1.45, { kind: "ember", colors: ["#f2c27a", "#f19a9a"] }),

  a("6-1", "雲海の参道", "雲の上に続く白亜の参道", 200, ["国語", "社会"], 1.4, { kind: "halo", colors: ["#f4f1e6", "#e2c974"] }),
  a("6-2", "聖歌の身廊", "歌い手の去った今も、聖歌の残響だけが漂う身廊", 250, ["英語", "国語"], 1.45, { kind: "halo", colors: ["#fbf3d4", "#b9a2f7"] }),
  a("6-3", "星冠の祭壇", "世界の奥地に眠る秘術の深奥が明かされる祭壇", 300, ["数学", "理科", "社会"], 1.5, { kind: "halo", colors: ["#e2c974", "#71e2ef"] }),
];

/**
 * STAGE 6 を制覇した先に続く無限の階層「星天の塔（Astra Zenith）」。
 * ステージの一本道（AREAS）には含めず、制覇した探究者だけが滞在先に選べる
 */
export const ZENITH_AREA: Area = {
  ...a("zenith", "星天の塔", "天空の大聖堂の先、雲を貫いて星々の間へ続く無限の塔", 300, [], 1.5, { kind: "zenith", colors: ["#a882fb", "#71e2ef"] }),
  stageId: 7,
  zenith: true,
  alias: "ASTRA ZENITH",
  epigraph: "十時間の詠唱ごとに、一層ずつ天へ近づく",
};

/** どれだけ先へ進んでも帰還できる原点「灯火の机（はじまりの小屋）」 */
export const ORIGIN_AREA = AREAS.find((area) => area.origin)!;

export function areasOfStage(stageId: number) {
  return AREAS.filter((area) => area.stageId === stageId);
}

export function findArea(id: string | null | undefined) {
  return id === ZENITH_AREA.id ? ZENITH_AREA : AREAS.find((area) => area.id === id);
}

/** エリアの属するステージ（星天の塔はどのステージにも属さない） */
export function stageOfArea(area: Area): Stage | undefined {
  return STAGES.find((s) => s.id === area.stageId);
}

export function isAreaUnlocked(area: Area, totalMp: number) {
  return totalMp / 60 >= area.requiredHours;
}

/**
 * 選択中のエリア。未選択・未解放なら最も奥の解放済みエリア。
 * totalMp はこの周天での累積MP。星天の塔は zenithOpen（STAGE 6 を一度でも制覇した）なら選べる
 */
export function resolveArea(selectedId: string | null | undefined, totalMp: number, zenithOpen = false): Area {
  if (selectedId === ZENITH_AREA.id && zenithOpen) return ZENITH_AREA;
  const selected = AREAS.find((area) => area.id === selectedId);
  if (selected && isAreaUnlocked(selected, totalMp)) return selected;
  return [...AREAS].reverse().find((area) => isAreaUnlocked(area, totalMp)) ?? AREAS[0];
}

/** 科目に対するエリアの属性ブースト倍率 */
export function areaMultiplier(area: Area, subjectName: string) {
  return area.origin || area.zenith || area.boost.subjects.includes(subjectName) ? area.boost.multiplier : 1;
}

/** ブースト対象の表示名 */
export function boostLabel(area: Area) {
  if (area.zenith) return "天頂・全属性";
  return area.origin ? "原点回帰・全属性" : area.boost.subjects.join("・");
}
