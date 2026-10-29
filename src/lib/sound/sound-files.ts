// 外部音声ファイルの登録表。public/sounds/ に置いたファイルのパスをここに書くと、そのファイルを再生する。
// 登録の無い音、読み込めなかった音は Web Audio API で生成した音で代わりに鳴らす。
// 例: ambience: { hearth: "/sounds/ambience/hearth.mp3" }, se: { tap: "/sounds/se/tap.mp3" }

/** 環境音（title はタイトルの曲、prelude は星天の導きなど魔術書庫に入る前の画面、ほかは滞在ステージごと） */
export type AmbienceKey = "title" | "prelude" | "hearth" | "forest" | "stars" | "frost" | "forge" | "sanctum";

/** 操作・演出の効果音 */
export type SeKey = "begin" | "tap" | "chantStart" | "chantComplete" | "reward" | "levelUp" | "rankUp" | "restore" | "dissolve" | "craft";

export const SOUND_FILES: {
  ambience: Partial<Record<AmbienceKey, string>>;
  se: Partial<Record<SeKey, string>>;
} = {
  ambience: {},
  se: {},
};

/** 大ステージ → 環境音（1: 小屋、2: 樹海・図書室、3: 観測塔・星空、4: 氷の回廊、5: 魔導炉、6: 大聖堂） */
export const AMBIENCE_BY_STAGE: Record<number, AmbienceKey> = {
  1: "hearth",
  2: "forest",
  3: "stars",
  4: "frost",
  5: "forge",
  6: "sanctum",
};
