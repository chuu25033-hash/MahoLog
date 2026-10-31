// 外部音声ファイルの登録表。public/sounds/ に置いたファイルのパスをここに書くと、そのファイルを再生する。
// 登録の無い音、読み込めなかった音は Web Audio API で生成した音で代わりに鳴らす。
// 例: ambience: { hearth: "/sounds/ambience/hearth.mp3" }, se: { tap: "/sounds/se/tap.mp3" }

/** 環境音（title はタイトルの曲、prelude は星天の導きなど魔術書庫に入る前の画面、ほかは滞在ステージごと） */
export type AmbienceKey = "title" | "prelude" | "hearth" | "forest" | "stars" | "frost" | "forge" | "sanctum";

/** 操作・演出の効果音 */
export type SeKey =
  | "begin"
  | "tap"
  | "chantStart"
  | "chantComplete"
  | "reward"
  | "levelUp"
  | "rankUp"
  | "dropNormal"
  | "dropRare"
  | "titleUnlock"
  | "restore"
  | "dissolve"
  | "craft"
  | "prologueOpen"
  | "prologueLine"
  | "mannaCharge"
  | "mannaAbsorb"
  | "memoryUnlock";

export const SOUND_FILES: {
  ambience: Partial<Record<AmbienceKey, string>>;
  se: Partial<Record<SeKey, string>>;
} = {
  ambience: {},
  // 音声ファイルに差し替えるときは、public/sounds/se/ にファイルを置き、該当する行のコメントを外す。
  // 行末は演出の設計での SE ID と、鳴らす場面
  se: {
    // tap: "/sounds/se/tap.mp3",                           // se_tap_default      ボタン・各種タップ: 控えめな水晶の短音
    // dropNormal: "/sounds/se/drop-normal.mp3",            // se_drop_normal      流れ星の品（常品・稀品）: 小さな水晶が触れ合う澄んだ単音
    // dropRare: "/sounds/se/drop-rare.mp3",                // se_drop_rare        流れ星の品（秘宝・至宝）: 深い残響の鐘と、広がる和音
    // titleUnlock: "/sounds/se/title-unlock.mp3",          // se_title_unlock     称号の解放の告知: 星の砂が零れ落ちる静かなシャワー
    // restore: "/sounds/se/document-decode.mp3",           // se_document_decode  古代文書の復元: 羊皮紙の開く音と、低い魔力の共鳴
    // craft: "/sounds/se/transmutation-ss.mp3",            // se_transmutation_ss 神話遺物（SS）の錬成: 空間が共鳴する低音と、星屑のきらめき
    // dissolve: "/sounds/se/dissolve.mp3",                 //                     遺物の還元
    // reward: "/sounds/se/reward.mp3",                     //                     試練・星天の導きの報酬
    // chantStart: "/sounds/se/chant-start.mp3",            //                     詠唱の開始
    // chantComplete: "/sounds/se/chant-complete.mp3",      //                     詠唱の完了
    // levelUp: "/sounds/se/level-up.mp3",                  //                     探求度の上昇
    // rankUp: "/sounds/se/rank-up.mp3",                    //                     魔術階級の昇格
    // begin: "/sounds/se/begin.mp3",                       //                     旅立ち・新しい地の解放
    // prologueOpen: "/sounds/se/prologue-open.mp3",        //                     プロローグの幕開け
    // prologueLine: "/sounds/se/prologue-line.mp3",        //                     プロローグの一節
    // mannaCharge: "/sounds/se/manna-charge.mp3",          //                     結果: 授かった魔力が数え上がる（静かな共鳴のクレッシェンド）
    // mannaAbsorb: "/sounds/se/manna-absorb.mp3",          //                     結果: 魔力の粒子が魔法陣（星脈）へ吸い込まれる（深い吸入の風）
    // memoryUnlock: "/sounds/se/memory-unlock.mp3",        //                     結果: 流れ星がほどけ、観測した品が現れる（澄んだ水晶の鐘）
  },
};

/** 大ステージ → 環境音（1: 小屋、2: 樹海・図書室、3: 観測塔・星空、4: 氷の回廊、5: 魔導炉、6: 大聖堂、7: 星天の塔） */
export const AMBIENCE_BY_STAGE: Record<number, AmbienceKey> = {
  1: "hearth",
  2: "forest",
  3: "stars",
  4: "frost",
  5: "forge",
  6: "sanctum",
  7: "stars",
};
