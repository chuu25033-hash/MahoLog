import { COMBO_GRACE_MINUTES, COMBO_MIN_MINUTES } from "@/lib/combo";
import { CLEAR_HOURS, ZENITH_MINUTES_PER_FLOOR } from "@/lib/cycles";
import { DAILY_LIMIT_MINUTES } from "@/lib/game";
import { WORLDLINES_OPEN } from "@/lib/worldline-store";
import type { GuideStep } from "./guide-tour";

// 各画面の案内の頁。長いと読まれないので、一頁に語ることは一つにして、本文は一、二文に留める。
// 細かな数字は画面の中に書いてあるので、ここでは「何をするところか」「どうすると得か」を伝える

/** 書庫（ホーム）。各ボタンを、一つずつ照らして語る */
export const LIBRARY_STEPS: GuideStep[] = [
  {
    title: "魔術書庫へようこそ",
    label: "WELCOME TO THE LIBRARY",
    plain: "ホーム画面",
    body: "ここが旅の拠点です。勉強した時間を記録すると、旅が少しずつ進みます。書庫の扉を巡ってみましょう。",
  },
  {
    target: "profile",
    title: "探究者の記録",
    plain: "プロフィール・レベル",
    label: "SCHOLAR",
    body: "勉強した時間が魔力（MP）になります。貯まるほど探求度（レベル）が上がり、階級も昇ります。",
  },
  {
    target: "profile",
    title: "称号を掲げる",
    plain: "名前に触れると称号を選べる",
    label: "TITLES",
    body: "詠唱を続けたり各地を巡ったりして授かった称号を、名前の前に掲げられます。",
  },
  {
    target: "chant",
    title: "詠唱を開始する",
    plain: "勉強タイマーを始める",
    label: "BEGIN THE CHANT",
    body: "科目を選んで勉強を始めます。25分続けるごとに流れ星が降り、遺物（アイテム）が届きます。",
  },
  {
    target: "stage",
    title: "滞在するエリア",
    plain: "ステージ選択",
    label: "AREA",
    body: "「エリア選択」で、旅の滞在地を選べます。地ごとに魔力が増える科目と、降る遺物が違います。",
  },
  {
    target: "stage",
    title: "奥地への道",
    plain: "累計の勉強時間でステージが開く",
    label: "THE PATH AHEAD",
    body: "勉強した時間が積もるほど、奥のステージが開きます。下の帯が、次のステージまでの道のりです。",
  },
  {
    target: "totals",
    title: "今宵・七夜・月巡り",
    plain: "今日・今週・今月の勉強時間",
    label: "TONIGHT / WEEK / MONTH",
    body: "この夜、この週、この月に詠唱した時間です。",
  },
  {
    target: "trials",
    title: "星の試練",
    plain: "ログインボーナス・デイリー／ウィークリーミッション",
    label: "TRIALS",
    body: "毎日の受け取りと、日ごと・週ごとの目標です。報酬を受け取れるときは、数字が灯ります。",
  },
  {
    target: "history",
    title: "魔導の軌跡",
    plain: "月ごとの勉強カレンダー",
    label: "CHRONICLE",
    body: "詠唱した夜が星になり、ひと月で星座を描きます。過去の勉強を日ごとに振り返れます。",
  },
  ...(WORLDLINES_OPEN
    ? [
        {
          target: "worldlines",
          title: "結びし世界線",
          plain: "ほかの利用者とのつながり",
          label: "BOUND WORLDLINES",
          body: "遠くで学ぶ観測者の気配を感じられます。言葉は交わせず、届くのは灯の気配だけです。",
        },
      ]
    : []),
  {
    target: "settings",
    title: "設定",
    plain: "名前・科目・音・記録の引き継ぎ",
    label: "SETTINGS",
    body: "詠唱に使う科目や音を整えます。別の端末へ記録を移すときも、ここから。",
  },
  {
    target: "radar",
    title: "魔法陣",
    plain: "科目ごとの勉強時間のグラフ",
    label: "ARCANE CIRCLE",
    body: "よく学んだ科目ほど陣が広がります。右上から画像にして共有できます。",
  },
  {
    target: "codex",
    title: "魔導図鑑",
    plain: "アイテム図鑑・アイテムの合成",
    label: "CODEX",
    body: "流れ星で届いた遺物や古代文書が収められます。集めた遺物から、新たな遺物も錬成できます。",
  },
  {
    target: "memory",
    title: "詠唱の記憶",
    plain: "最近の勉強記録",
    label: "OBSERVATIONAL MEMORY",
    body: "近ごろの詠唱と、得た魔力が並びます。科目を選び忘れたときは、最近の詠唱に触れると選び直せます。",
  },
  {
    title: "準備は整いました",
    label: "READY TO OBSERVE",
    body: "学びの時が来たら「詠唱を開始する」から。各画面にも案内があり、見出しの隣の「案内」から見返せます。この案内は設定から。",
  },
];

/** 詠唱の間（勉強タイマー）。スマホでは科目やエリアは「詠唱の支度」の中にあるので、そちらを照らす */
export const CHANT_STEPS: GuideStep[] = [
  {
    title: "詠唱の間",
    label: "CHANT CHAMBER",
    plain: "勉強タイマー",
    body: "ここで勉強の時間を計ります。計った時間が魔力になり、旅が進みます。",
  },
  {
    target: "chant-mode",
    title: "詠唱の型",
    plain: "ポモドーロ／ストップウォッチ",
    label: "CHANT STYLE",
    body: "律動の詠唱は決めた時間で区切り、無窮の詠唱は止めるまで計り続けます。",
  },
  {
    target: ["chant-subject", "chant-prep"],
    title: "属性を選ぶ",
    plain: "勉強する科目を選ぶ",
    label: "ATTRIBUTE",
    body: "科目と、その詳細（単元など）を選びます。選んだ科目の魔力として刻まれます。",
  },
  {
    target: "chant-length",
    title: "詠唱と静息の長さ",
    plain: "集中時間・休憩時間",
    label: "DURATION",
    body: "律動の詠唱で集中する長さと、そのあとに取る休憩の長さを選びます。",
  },
  {
    target: ["chant-area", "chant-prep"],
    title: "滞在中のエリア",
    plain: "ボーナスのかかる科目・アイテムの使用",
    label: "AREA & CATALYST",
    body: "滞在地に合う科目なら魔力が増えます。手持ちの触媒を選ぶと、次の詠唱の魔力が高まります。",
  },
  {
    target: "chant-clock",
    title: "詠唱を始める",
    plain: "スタート・一時停止・終了",
    label: "BEGIN",
    body: "「詠唱開始」で計り始め、「終了して記録」で刻みます。途中で画面を閉じても、続きから再開できます。",
  },
  {
    target: "chant-clock",
    title: "流れ星",
    plain: "25分ごとにアイテムが届く",
    label: "SHOOTING STARS",
    body: `${COMBO_MIN_MINUTES}分続けるごとに流れ星が一つ降ります（1回で4つまで）。長く続けるほど、稀な遺物が届きやすくなります。`,
  },
  {
    target: "chant-clock",
    title: "星脈との同調",
    plain: "連続ボーナス",
    label: "ATTUNEMENT",
    body: `${COMBO_MIN_MINUTES}分以上の詠唱を、休憩明けから${COMBO_GRACE_MINUTES}分のうちに次へつなぐと同調が高まり、魔力が上乗せされます。`,
  },
  {
    target: "chant-view",
    title: "映す景色",
    plain: "背景の切り替え",
    label: "VIEW",
    body: "魔法陣と、少女が旅する探索の景色を切り替えられます。詠唱の途中でも変えられます。",
  },
  {
    title: "詠唱の支度は整いました",
    label: "READY TO CHANT",
    body: `1日に刻める詠唱は${DAILY_LIMIT_MINUTES / 60}時間までです。案内は左上の「案内」から見返せます。`,
  },
];

/** 魔導の軌跡（勉強カレンダー） */
export const TRACES_STEPS: GuideStep[] = [
  {
    title: "魔導の軌跡",
    label: "ARCANE TRACES",
    plain: "勉強の記録・カレンダー",
    body: "これまでの詠唱を、月ごとの星空として振り返る場所です。",
  },
  {
    target: "traces-chart",
    title: "天球図盤",
    plain: "月のカレンダー",
    label: "CELESTIAL CHART",
    body: "詠唱した夜が星として灯ります。長く学んだ夜ほど大きく輝き、星に触れるとその夜の記録が開きます。",
  },
  {
    target: "traces-night",
    title: "その夜の記録",
    plain: "日ごとの詳細",
    label: "THE NIGHT",
    body: "その日に学んだ科目と時間、流れ星が遺した品を確かめられます。最近の詠唱なら、ここからも科目を選び直せます。",
  },
  {
    target: "traces-constellations",
    title: "星座",
    plain: "週ごとの達成",
    label: "CONSTELLATIONS",
    body: "7夜をひとまとまりに、そのすべての夜に詠唱すると星座が結ばれます。",
  },
  {
    target: "traces-month",
    title: "月をめくる",
    plain: "前の月・次の月",
    label: "MONTHS",
    body: "前の月の星空にも戻れます。脇の数字は、その月と通算の歩みです。",
  },
  {
    title: "軌跡は続いていきます",
    label: "KEEP OBSERVING",
    body: "詠唱を重ねるほど、夜空がにぎやかになります。案内は見出しの隣の「案内」から見返せます。",
  },
];

/** 魔導図鑑（アイテム図鑑・合成） */
export const CODEX_STEPS: GuideStep[] = [
  {
    title: "古代の秘術図鑑",
    label: "ARCANE CODEX",
    plain: "アイテム図鑑",
    body: "流れ星や星の試練で授かった遺物が、ここに収められます。",
  },
  {
    target: "codex-rate",
    title: "秘術解読率",
    plain: "図鑑の埋まり具合",
    label: "DECIPHERED",
    body: "見つけた遺物の割合です。",
  },
  {
    target: "codex-filter",
    title: "遺物の種類",
    plain: "消耗品・コレクション・装備",
    label: "CATEGORIES",
    body: "触媒は詠唱に使う消耗品、伝承は各地の品、装置は持つだけで加護（ボーナス）を授けます。",
  },
  {
    target: "codex-items",
    title: "遺物を解読する",
    plain: "タップで詳しく見る",
    label: "DECIPHER",
    body: "触れると、品の物語と効果が読めます。まだ見ぬ品は影のまま。魔法陣の装いや称号もここで身につけます。",
  },
  {
    target: "codex-tabs",
    title: "星脈の記憶",
    plain: "ストーリー（古代文書）",
    label: "STELLAR MEMORIES",
    body: "流れ星に混じる文書の断片を4葉集めると、一冊が復元されて物語が読めます。復元するほど魔力も増えます。",
  },
  {
    target: "codex-tabs",
    title: "錬成陣",
    plain: "アイテムの合成",
    label: "TRANSMUTATION",
    body: "星屑の原石と指定の遺物を捧げると、流れ星では届かない神話の遺物を生み出せます。",
  },
  {
    title: "解読を進めましょう",
    label: "KEEP DECIPHERING",
    body: "長く詠唱するほど、稀な品が届きやすくなります。案内は見出しの隣の「案内」から見返せます。",
  },
];

/** 設定（書斎） */
export const SETTINGS_STEPS: GuideStep[] = [
  {
    title: "秘術探究者の書斎",
    label: "SETTINGS",
    plain: "設定",
    body: "名前や科目、音、記録の守り方を整える場所です。",
  },
  {
    target: "settings-scholar",
    title: "探究者と演出",
    plain: "名前・アイコン・引き継ぎ用のID",
    label: "SCHOLAR",
    body: "探究者名と紋章、いつもの詠唱時間を決めます。別の端末へ記録を移すための観測者IDも、ここにあります。",
  },
  {
    target: "settings-domains",
    title: "詠唱の領域",
    plain: "勉強する科目",
    label: "DOMAINS",
    body: "詠唱に使う科目を選びます。選んだ数だけ、魔法陣の角が増えます。",
  },
  {
    target: "settings-sound",
    title: "音と記録",
    plain: "音量・記録のバックアップ",
    label: "SOUND & ARCHIVE",
    body: "音の大きさを整えます。記録をファイルに書き出して、手元に守っておくこともできます。",
  },
  {
    title: "書斎の扉はいつでも開いています",
    label: "ANYTIME",
    body: "どの画面の案内も、見出しの隣の「案内」から見返せます。書庫の案内は、下の「はじまりの記録」から。",
  },
];

/** 星天の塔（STAGE 6 制覇後） */
export const ZENITH_STEPS: GuideStep[] = [
  {
    title: "星天の塔",
    label: "ASTRA ZENITH",
    plain: "クリア後のやり込み",
    body: `この周天の旅（${CLEAR_HOURS}時間）を終えた者だけが昇れる、果てのない塔です。`,
  },
  {
    target: "zenith-floor",
    title: "塔を昇る",
    plain: "階層",
    label: "CURRENT FLOOR",
    body: `「塔に滞在する」を選んで詠唱すると、${ZENITH_MINUTES_PER_FLOOR / 60}時間ごとに1層昇ります。滞在中はどの科目も魔力が増えます。`,
  },
  {
    target: "zenith-milestones",
    title: "節目の階層",
    plain: "到達報酬",
    label: "MILESTONES",
    body: "節目の層に届くと、天界の遺物や称号、最後の古代文書の断片を授かります。",
  },
  {
    target: "zenith-cycle",
    title: "周天の儀式",
    plain: "周回（2周目以降）",
    label: "CYCLE",
    body: "はじまりの小屋から旅を辿り直します。階級や図鑑、所持品は引き継がれ、周を重ねるごとに魔力が永久に増えます。",
  },
  {
    title: "旅に終わりはありません",
    label: "ENDLESS ASCENT",
    body: "案内は見出しの隣の「案内」から見返せます。",
  },
];

/** 星の試練（ダイアログ） */
export const TRIALS_STEPS: GuideStep[] = [
  {
    title: "星天の導き",
    label: "CELESTIAL GUIDANCE",
    plain: "ログインボーナス",
    body: "1日に1回、「導きを受け取る」で品を授かれます。7夜続けて受け取ると、最後の夜に特別な品が届きます。",
  },
  {
    title: "日課と週間の試練",
    label: "DAILY / WEEKLY",
    plain: "デイリー／ウィークリーミッション",
    body: "詠唱を重ねると達成します。上の札で日課と週間を切り替えられ、期限が来ると新しい試練に替わります。",
  },
  {
    title: "報酬を受け取る",
    label: "CLAIM",
    plain: "達成したら受け取りを押す",
    body: "達成した試練は「魔力を回収する」で報酬に変わります。受け取れるものがあると、書庫の札に数字が灯ります。",
  },
];

/** エリア選択（ダイアログ） */
export const AREAS_STEPS: GuideStep[] = [
  {
    title: "エリアの地図",
    label: "AREA MAP",
    plain: "ステージ選択",
    body: "原点の小屋から上へ、旅の道が続きます。点（ノード）に触れると、その地の詳細が開きます。",
  },
  {
    title: "属性ブースト",
    label: "BOOST",
    plain: "科目ごとのボーナス",
    body: "地ごとに魔力が増える科目が違います。いま学ぶ科目に合う地に滞在すると、魔力が多く貯まります。",
  },
  {
    title: "奥地を開く",
    label: "UNLOCK",
    plain: "累計の勉強時間で解放",
    body: "勉強した時間が積もるほど、奥の地が開きます。降る遺物や景色も、地ごとに変わります。",
  },
];
