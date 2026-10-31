"use client";

// アプリ全体のローカル永続データ（localStorage の maholog_user_data に JSON で保存）。
// プロフィール・詠唱履歴・星天の導きの受取状況・所持アイテム・解放済みステージ・設定・試練の進捗を保持する。
import { useSyncExternalStore } from "react";
import { AREAS, isAreaUnlocked, resolveArea } from "./areas";
import { jstDateKey, startOfJstDay } from "./date";
import { demoProfile } from "./demo";
import { DAILY_LIMIT_MINUTES, calcLevel, rankOf } from "./game";
import { CLEAR_MP, chapterOf, milestonesBetween, zenithFloor, type Chapter, type ChapterTheme } from "./cycles";
import { canCraft, canRestore, dissolveValue, fragmentsOf, memoryOf, surplusCount } from "./crafting";
import {
  ALL_ITEMS,
  DEFAULT_SKIN,
  FRAGMENTS,
  MEMORIES,
  MYTHICS,
  STARDUST_ORE,
  findItem,
  type CatalystItem,
  type Item,
  type MemoryItem,
  type RelicItem,
  type Skin,
} from "./items";
import { mockObservedNights } from "./star-memory";
import { activeSubjectsOf } from "./subjects";
import { TASKS, drawCatalyst, measureTask, periodKey, type TaskBoard, type TaskScope } from "./tasks";
import { generateWorldlineCode } from "./worldlines";
import type { Profile, StudyLog, StudyMode, Subject } from "./types";

export const STORAGE_KEY = "maholog_user_data";
const DAY = 24 * 60 * 60 * 1000;

export type UserProfile = {
  username: string;
  /** 紋章のプリセットID（wizard-1 など） */
  avatar: string;
  /** 魔術階級の数字（I〜X） */
  rank: string;
  /** 累積MP */
  totalMp: number;
  /** 滞在中のステージ（エリア）ID */
  currentStageId: string;
  /** 主軸カテゴリ（主科目 ID）。詠唱画面で最初に選ばれる */
  subject: string | null;
  /** 詳細科目（カスタムは自由記述） */
  subSubject: string | null;
  /** 詠唱に使う科目 ID（3つ以上）。null ならすべての科目 */
  activeSubjects: string[] | null;
};

export type ChantRecord = {
  id: string;
  /** 詠唱を終えた日時（ISO 8601） */
  date: string;
  /** 集中時間（分） */
  minutes: number;
  subjectId: string;
  /** 詳細科目（この項目より前の記録には無い） */
  subSubject?: string | null;
  /** 獲得MP */
  mp: number;
  /** 実施ステージ（エリア）ID */
  stageId: string;
  mode: StudyMode;
  /** 使った触媒 */
  catalystId: string | null;
  /** 見つけたアイテム（流れ星が1つだった頃の記録） */
  dropId: string | null;
  /** 降った流れ星の品（この項目より前の記録は dropId だけ） */
  dropIds?: string[];
  /** 詠唱の間で計らず、後から書き留めた記録。魔力だけを授け、試練には数えない */
  manual?: boolean;
};

/** 後から書き留められる日数（今日を含む） */
export const MANUAL_CHANT_DAYS = 7;

export type DailyReward = {
  /** 最後に星天の導きを受け取った日（JST, YYYY-MM-DD） */
  lastClaimedDate: string | null;
  /** 連続日数 */
  streak: number;
};

export const FOCUS_MINUTE_OPTIONS = [15, 25, 45, 60] as const;

export type UserSettings = {
  /** 律動の詠唱の初期集中時間（分） */
  defaultFocusMinutes: number;
  /** 背景の粒子・重いアニメーションを抑える */
  liteMode: boolean;
  /** 詠唱完了時のベル音・振動 */
  chime: boolean;
  /** 音声全般（環境音・効果音）の ON / OFF */
  sound: boolean;
  /** 環境音の音量（0〜1） */
  bgmVolume: number;
  /** 効果音の音量（0〜1） */
  seVolume: number;
  /** UI の 1px ライン描画色（周天の章で開く） */
  chapterTheme: ChapterTheme;
};

export type UserData = {
  userProfile: UserProfile;
  chantHistory: ChantRecord[];
  dailyReward: DailyReward;
  /** 獲得したアイテムの個数。キーがあれば図鑑登録済み（触媒は使うと減り、0 になっても登録は残る） */
  inventory: Record<string, number>;
  unlockedStages: string[];
  /** 装備中の触媒・テーマスキン・掲げる称号 */
  equipment: { catalystId: string | null; skinId: string | null; titleId: string | null };
  settings: UserSettings;
  /** 試練（日課の儀式・週間の大誓約）の進捗と受取状況 */
  tasks: Record<TaskScope, TaskBoard>;
  /** 結びし世界線（デモモード用。Supabase 接続時は DB に持つ）: 自分の世界線IDと、結んだ相手の世界線ID */
  worldlines: { code: string; bonds: { code: string; boundAt: string }[] };
  /** 周天: 何周目か と、その周を始めた時点の累積MP（エリアの解放はここからの MP で測る） */
  cycle: { count: number; startMp: number };
  /** 星天の塔: 塔で詠唱した累積時間（分） */
  zenith: { minutes: number };
  /** 星の余韻: 25分の区切りに届かなかった端数（分、0〜24）。次の詠唱に足して流れ星を数える（lib/drops.ts） */
  starEcho: number;
};

const unlockedAt = (totalMp: number) => AREAS.filter((a) => isAreaUnlocked(a, totalMp)).map((a) => a.id);

/** 初回起動時の状態: Rank I「門前の解読者」、はじまりの小屋から */
export function initialUserData(): UserData {
  return {
    userProfile: { username: demoProfile.username, avatar: demoProfile.avatar_url, rank: rankOf(calcLevel(0)).numeral, totalMp: 0, currentStageId: "1-1", subject: null, subSubject: null, activeSubjects: null },
    chantHistory: [],
    dailyReward: { lastClaimedDate: null, streak: 0 },
    inventory: {},
    unlockedStages: unlockedAt(0),
    equipment: { catalystId: null, skinId: null, titleId: null },
    settings: { defaultFocusMinutes: 25, liteMode: false, chime: true, sound: true, bgmVolume: 0.4, seVolume: 0.7, chapterTheme: "default" },
    tasks: { daily: { periodKey: "", items: {} }, weekly: { periodKey: "", items: {} } },
    worldlines: { code: generateWorldlineCode(), bonds: [] },
    cycle: { count: 1, startMp: 0 },
    zenith: { minutes: 0 },
    starEcho: 0,
  };
}

/** 保存データ（古い形式を含む）に初期値を補って読み込める形にする */
function normalize(saved: Partial<UserData>): UserData {
  const base = initialUserData();
  // 旧形式: 主軸科目は settings.mainSubjectId に持っていた
  const { mainSubjectId, ...settings } = (saved.settings ?? {}) as Partial<UserSettings> & { mainSubjectId?: string | null };
  const userProfile = { ...base.userProfile, ...saved.userProfile };
  userProfile.subject ??= mainSubjectId ?? null;
  return {
    ...base,
    ...saved,
    userProfile,
    dailyReward: { ...base.dailyReward, ...saved.dailyReward },
    equipment: { ...base.equipment, ...saved.equipment },
    settings: { ...base.settings, ...settings },
    tasks: { ...base.tasks, ...saved.tasks },
    worldlines: { ...base.worldlines, ...saved.worldlines },
    cycle: { ...base.cycle, ...saved.cycle },
    zenith: { ...base.zenith, ...saved.zenith },
  };
}

/** 試練の進捗を詠唱履歴から測り直す。期間が変わっていれば受取状況も巡り直す */
function syncedTasks(data: UserData, subjects: Pick<Subject, "id">[], now: Date): UserData["tasks"] {
  const context = {
    // 後から書き留めた記録で試練を満たせると、詠唱を重ねる励みにならないので数えない
    history: data.chantHistory.filter((r) => !r.manual),
    activeSubjectIds: activeSubjectsOf(subjects, data.userProfile.activeSubjects).map((s) => s.id),
    mainSubjectId: data.userProfile.subject,
    guidanceClaimed: data.dailyReward.lastClaimedDate === jstDateKey(now),
    now,
  };
  const board = (scope: TaskScope): TaskBoard => {
    const key = periodKey(scope, now);
    const prev = data.tasks[scope];
    const items = Object.fromEntries(
      TASKS.filter((t) => t.scope === scope).map((t) => [
        t.id,
        { ...measureTask(t, context), isClaimed: prev.periodKey === key && (prev.items[t.id]?.isClaimed ?? false) },
      ]),
    );
    return { periodKey: key, items };
  };
  return { daily: board("daily"), weekly: board("weekly") };
}

export type TaskClaim = { mp: number; item: CatalystItem | null };

/** 累積MPから階級・解放済みステージを導き直す（ステージはこの周天での MP で測る） */
function withProgress(data: UserData, totalMp: number): UserData {
  return {
    ...data,
    userProfile: { ...data.userProfile, totalMp, rank: rankOf(calcLevel(totalMp)).numeral },
    unlockedStages: unlockedAt(Math.max(0, totalMp - data.cycle.startMp)),
  };
}

/** この周天での累積MP（エリア・ステージの解放に使う） */
export function cycleMp(data: UserData, totalMp: number) {
  return Math.max(0, totalMp - data.cycle.startMp);
}

/** 星天の塔へ入れるか: STAGE 6 を一度でも制覇した（2周目以降、またはこの周で 300 時間に届いた） */
export function isZenithOpen(data: UserData, totalMp: number) {
  return data.cycle.count > 1 || cycleMp(data, totalMp) >= CLEAR_MP;
}

/** この周天を制覇したか（次なる周天へ進める） */
export function isCycleCleared(data: UserData, totalMp: number) {
  return cycleMp(data, totalMp) >= CLEAR_MP;
}

export function equippedTitle(data: UserData) {
  const item = findItem(data.equipment.titleId);
  return item?.kind === "title" && isDiscovered(data, item.id) ? item : null;
}

/**
 * 星天の塔の存在を知っているか（図鑑に塔の報酬を載せるか）。
 * 端末の累積MPで制覇を判定し、Supabase 接続時のように端末の MP が無くても、塔に入ったことがあれば知っている
 */
export function knowsZenith(data: UserData) {
  return isZenithOpen(data, data.userProfile.totalMp) || data.zenith.minutes > 0 || data.userProfile.currentStageId === "zenith";
}

/** 星天の塔での登頂: 昇る前後の階層と、越えた節目で授かったもの */
export type ZenithClimb = { beforeFloor: number; afterFloor: number; rewards: { item: Item; isNew: boolean }[] };

const SAMPLE_RELICS = ["r-observer", "r-starstone", "r-compass", "r-armillary"];

/** 動作確認用: 直近4週間の詠唱を重ねたサンプルデータ */
export function sampleUserData(now = new Date()): UserData {
  const history: ChantRecord[] = [];
  const inventory: Record<string, number> = {};
  let totalMp = 0;
  for (const night of mockObservedNights(now)) {
    night.sessions.forEach((s, i) => {
      const multiplier = i === 0 ? (night.catalyst?.multiplier ?? 1) : 1;
      const mp = Math.round(s.minutes * multiplier);
      const drop = night.drops[i] ?? null;
      if (drop) inventory[drop.id] = (inventory[drop.id] ?? 0) + 1;
      if (night.catalyst && i === 0) inventory[night.catalyst.id] ??= 0;
      history.push({
        id: `sample-${night.date.getTime()}-${i}`,
        date: new Date(night.date.getTime() + (19 + i) * 60 * 60 * 1000).toISOString(),
        minutes: s.minutes,
        subjectId: s.subjectId,
        mp,
        stageId: resolveArea(null, totalMp).id,
        mode: i % 2 === 0 ? "pomodoro" : "stopwatch",
        catalystId: i === 0 ? (night.catalyst?.id ?? null) : null,
        dropId: drop?.id ?? null,
      });
      totalMp += mp;
    });
  }
  // 所持・未所持の秘宝が図鑑で見比べられるよう、いくつかを授けておく
  for (const id of SAMPLE_RELICS) inventory[id] = 1;
  const base = initialUserData();
  return withProgress(
    { ...base, chantHistory: history, inventory, userProfile: { ...base.userProfile, currentStageId: resolveArea(null, totalMp).id } },
    totalMp,
  );
}

// 旧ストア（mock-store / celestial-guidance）からの引き継ぎ
const LEGACY_MOCK_KEY = "maholog:mock:v1";
const LEGACY_GUIDANCE_KEY = "maholog:guidance:v1";

function migrateLegacy(): UserData {
  const data = initialUserData();
  try {
    const mock = JSON.parse(window.localStorage.getItem(LEGACY_MOCK_KEY) ?? "null");
    if (mock) {
      for (const id of mock.discovered ?? []) data.inventory[id] = 1;
      Object.assign(data.inventory, mock.inventory ?? {});
      data.equipment = { catalystId: mock.armedCatalystId ?? null, skinId: mock.skinId ?? null, titleId: null };
    }
    const guidance = JSON.parse(window.localStorage.getItem(LEGACY_GUIDANCE_KEY) ?? "null");
    if (guidance?.claimedDay) {
      data.dailyReward = { lastClaimedDate: jstDateKey(new Date(guidance.claimedDay)), streak: guidance.night ?? 1 };
    }
  } catch {}
  return data;
}

let state: UserData | null = null;
const listeners = new Set<() => void>();

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function load(): UserData {
  if (state) return state;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<UserData>;
      state = normalize(saved);
      // 世界線IDは一度発行したら変えない
      if (!saved.worldlines) persist();
      return state;
    }
  } catch {}
  // 未保存（初回起動）なら初期値で永続化を始める
  state = migrateLegacy();
  persist();
  return state;
}

/** この端末で保存データを書き換えたときの通知先（クラウド同期が預け直しの合図に使う） */
const localChangeHooks = new Set<() => void>();

export function onLocalChange(hook: () => void) {
  localChangeHooks.add(hook);
  return () => {
    localChangeHooks.delete(hook);
  };
}

/** local: この端末での変更か（クラウドから取り込んだときは false にして、預け直しの合図を出さない） */
function update(next: (s: UserData) => UserData, local = true) {
  state = next(load());
  persist();
  listeners.forEach((l) => l());
  if (local) localChangeHooks.forEach((h) => h());
}

/** 保存データとして読み込める形か（バックアップ・クラウドの保存データの検査） */
function isUserDataLike(saved: unknown): saved is Partial<UserData> {
  if (typeof saved !== "object" || saved === null) return false;
  const s = saved as Partial<UserData>;
  return typeof s.userProfile === "object" && s.userProfile !== null && Array.isArray(s.chantHistory);
}

/** クラウドに預けた保存データで、この端末の保存データを置き換える。形式が違えば false */
export function replaceUserData(saved: unknown): boolean {
  if (!isUserDataLike(saved)) return false;
  update(() => normalize(saved), false);
  return true;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // 別タブでの変更も反映する
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    state = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getUserData() {
  return load();
}

/** 保存データ。サーバー描画中・ハイドレーション中は null */
export function useStoredUserData(): UserData | null {
  return useSyncExternalStore(subscribe, load, () => null);
}

const SERVER_SNAPSHOT = initialUserData();

/** 保存データ（読み込み前は初期値） */
export function useUserData(): UserData {
  return useSyncExternalStore(subscribe, load, () => SERVER_SNAPSHOT);
}

/** 図鑑に登録済みか */
export function isDiscovered(data: UserData, id: string) {
  return id in data.inventory;
}

/** いま手元にあるか（触媒を使い切ったり、秘宝を錬成に捧げたりすると図鑑には残るが手元からは消える） */
export function hasItem(data: UserData, id: string) {
  return (data.inventory[id] ?? 0) > 0;
}

export function activeSkin(data: UserData): Skin {
  const item = findItem(data.equipment.skinId);
  return item?.kind === "skin" ? item.skin : DEFAULT_SKIN;
}

export function armedCatalyst(data: UserData): CatalystItem | null {
  const item = findItem(data.equipment.catalystId);
  return item?.kind === "catalyst" && (data.inventory[item.id] ?? 0) > 0 ? item : null;
}

/** 保存データをプロフィールの形にする */
export function localProfile(data: UserData): Profile {
  const { username, avatar, totalMp } = data.userProfile;
  return { ...demoProfile, id: "local", username, avatar_url: avatar, total_study_time: totalMp, current_level: calcLevel(totalMp) };
}

/** 詠唱履歴を勉強記録の形にする */
export function localStudyLogs(data: UserData): StudyLog[] {
  return data.chantHistory.map((r) => ({
    id: r.id,
    subject_id: r.subjectId,
    duration_minutes: r.minutes,
    mode: r.mode,
    created_at: r.date,
    manual: r.manual,
  }));
}

/** 本日（JST）の詠唱時間の合計（分） */
export function todayChantMinutes(data: UserData, now = new Date()) {
  const today = startOfJstDay(now).getTime();
  return data.chantHistory
    .filter((r) => new Date(r.date).getTime() >= today && new Date(r.date).getTime() < today + DAY)
    .reduce((acc, r) => acc + r.minutes, 0);
}

export const userActions = {
  /** ステージ（エリア）選択 */
  setCurrentStage(stageId: string) {
    update((s) => ({ ...s, userProfile: { ...s.userProfile, currentStageId: stageId } }));
  },

  /** ドロップ・授かり物を count 個登録。初獲得なら true */
  addItem(item: Item, count = 1): boolean {
    const isNew = !isDiscovered(load(), item.id);
    update((s) => ({ ...s, inventory: { ...s.inventory, [item.id]: (s.inventory[item.id] ?? 0) + count } }));
    return isNew;
  },

  /** 星の余韻（流れ星の区切りに届かなかった端数）を書き留める */
  setStarEcho(minutes: number) {
    update((s) => ({ ...s, starEcho: minutes }));
  },

  armCatalyst(id: string | null) {
    update((s) => ({ ...s, equipment: { ...s.equipment, catalystId: id } }));
  },

  /** 装備中の触媒を1つ消費して返す */
  consumeCatalyst(): CatalystItem | null {
    const item = armedCatalyst(load());
    if (!item) return null;
    update((s) => {
      const left = (s.inventory[item.id] ?? 0) - 1;
      return {
        ...s,
        inventory: { ...s.inventory, [item.id]: left },
        equipment: { ...s.equipment, catalystId: left > 0 ? s.equipment.catalystId : null },
      };
    });
    return item;
  },

  setSkin(id: string | null) {
    update((s) => ({ ...s, equipment: { ...s.equipment, skinId: id } }));
  },

  /** プロフィールに掲げる称号 */
  setTitle(id: string | null) {
    update((s) => ({ ...s, equipment: { ...s.equipment, titleId: id } }));
  },

  /** 星天の塔で詠唱した時間を刻み、階層を昇る。節目を越えたら天界遺物・称号を授ける */
  climbZenith(minutes: number): ZenithClimb {
    const before = load().zenith.minutes;
    const beforeFloor = zenithFloor(before);
    const afterFloor = zenithFloor(before + minutes);
    const rewards = milestonesBetween(beforeFloor, afterFloor)
      .flatMap((m) => m.rewards)
      .map((id) => findItem(id))
      .filter((item): item is Item => !!item)
      .map((item) => ({ item, isNew: !isDiscovered(load(), item.id) }));
    update((s) => {
      const inventory = { ...s.inventory };
      for (const { item } of rewards) inventory[item.id] = Math.max(1, inventory[item.id] ?? 0);
      return { ...s, inventory, zenith: { minutes: s.zenith.minutes + minutes } };
    });
    return { beforeFloor, afterFloor, rewards };
  },

  /**
   * 次なる周天へ進む: いまの累積MPを新しい周の始まりにし、はじまりの小屋へ還る。
   * 階級・図鑑・所持品・塔の階層は引き継ぎ、章の魔法陣スキンを授けて UI の色調を章のものにする
   */
  advanceCycle(totalMp: number): Chapter | null {
    const current = load();
    if (!isCycleCleared(current, totalMp)) return null;
    const chapter = chapterOf(current.cycle.count + 1);
    update((s) => ({
      ...s,
      cycle: { count: s.cycle.count + 1, startMp: totalMp },
      userProfile: { ...s.userProfile, currentStageId: "1-1" },
      unlockedStages: unlockedAt(0),
      inventory: chapter.skinId ? { ...s.inventory, [chapter.skinId]: Math.max(1, s.inventory[chapter.skinId] ?? 0) } : s.inventory,
      equipment: { ...s.equipment, skinId: chapter.skinId ?? s.equipment.skinId },
      settings: { ...s.settings, chapterTheme: chapter.theme },
    }));
    return chapter;
  },

  /** 詠唱完了: 履歴に刻み、累積MP・階級・解放済みステージを更新する */
  recordChant(record: Omit<ChantRecord, "id" | "date">, now = new Date()) {
    update((s) =>
      withProgress(
        { ...s, chantHistory: [...s.chantHistory, { ...record, id: `c-${now.getTime()}`, date: now.toISOString() }] },
        s.userProfile.totalMp + record.mp,
      ),
    );
  },

  /**
   * 詠唱の間で計り忘れた学びを、後から書き留める。daysAgo 日前（0 = 今日）の記録として刻み、
   * 得る魔力は学んだ分そのまま（エリアの属性・加護・触媒・周天の刻印は乗らず、遺物も見つからない）。
   * その日の上限を超える分は切り詰め、刻めた分数を返す
   */
  recordPastChant(
    { minutes, subjectId, subSubject, daysAgo }: { minutes: number; subjectId: string; subSubject: string | null; daysAgo: number },
    now = new Date(),
  ): number {
    const days = Math.min(MANUAL_CHANT_DAYS - 1, Math.max(0, Math.floor(daysAgo)));
    // 過ぎた日は、その日の夜（JST 21時）に詠唱したものとして刻む
    const date = days === 0 ? now : new Date(startOfJstDay(now).getTime() - days * DAY + 21 * 60 * 60 * 1000);
    const data = load();
    const saved = Math.min(Math.floor(minutes), DAILY_LIMIT_MINUTES - todayChantMinutes(data, date));
    if (saved < 1) return 0;
    const record: ChantRecord = {
      id: `m-${now.getTime()}`,
      date: date.toISOString(),
      minutes: saved,
      subjectId,
      subSubject,
      mp: saved,
      stageId: data.userProfile.currentStageId,
      mode: "stopwatch",
      catalystId: null,
      dropId: null,
      manual: true,
    };
    // 詠唱の記録は日時の順に並べておく
    update((s) =>
      withProgress(
        { ...s, chantHistory: [...s.chantHistory, record].sort((a, b) => a.date.localeCompare(b.date)) },
        s.userProfile.totalMp + saved,
      ),
    );
    return saved;
  },

  /** 星天の導きを受け取る: 前日から続いていれば連続日数を加算、途切れていれば1日目から */
  claimDailyReward(now = new Date()) {
    update((s) => {
      const yesterday = jstDateKey(new Date(now.getTime() - DAY));
      const continued = s.dailyReward.lastClaimedDate === yesterday;
      return { ...s, dailyReward: { lastClaimedDate: jstDateKey(now), streak: continued ? s.dailyReward.streak + 1 : 1 } };
    });
  },

  setUsername(username: string) {
    update((s) => ({ ...s, userProfile: { ...s.userProfile, username } }));
  },

  setAvatar(avatar: string) {
    update((s) => ({ ...s, userProfile: { ...s.userProfile, avatar } }));
  },

  /** 主軸カテゴリと詳細科目 */
  setSubject(subject: string | null, subSubject: string | null) {
    update((s) => ({ ...s, userProfile: { ...s.userProfile, subject, subSubject } }));
  },

  /** 詠唱に使う科目。主軸カテゴリが外れたら主軸の指定も外す */
  setActiveSubjects(ids: string[]) {
    update((s) => {
      const keepMain = s.userProfile.subject !== null && ids.includes(s.userProfile.subject);
      return {
        ...s,
        userProfile: {
          ...s.userProfile,
          activeSubjects: ids,
          ...(keepMain ? {} : { subject: null, subSubject: null }),
        },
      };
    });
  },

  updateSettings(patch: Partial<UserSettings>) {
    update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },

  /** バックアップ用に保存データを JSON で書き出す */
  exportData(): string {
    return JSON.stringify(load(), null, 2);
  },

  /** バックアップの JSON で保存データを上書きする。形式が違えば false */
  importData(json: string): boolean {
    try {
      const saved = JSON.parse(json);
      if (!isUserDataLike(saved)) return false;
      update(() => normalize(saved));
      return true;
    } catch {
      return false;
    }
  },

  /** デモモード: 世界線IDで結ぶ（模擬の相手なので申し出を待たずに結ばれる） */
  bindWorldline(code: string): "accepted" | "exists" | "self" {
    const { worldlines } = load();
    if (code === worldlines.code) return "self";
    if (worldlines.bonds.some((b) => b.code === code)) return "exists";
    update((s) => ({
      ...s,
      worldlines: { ...s.worldlines, bonds: [...s.worldlines.bonds, { code, boundAt: new Date().toISOString() }] },
    }));
    return "accepted";
  },

  unbindWorldline(code: string) {
    update((s) => ({ ...s, worldlines: { ...s.worldlines, bonds: s.worldlines.bonds.filter((b) => b.code !== code) } }));
  },

  /** 試練の進捗を最新にする（変化がなければ保存も通知もしない） */
  syncTasks(subjects: Pick<Subject, "id">[], now = new Date()) {
    const current = load();
    const tasks = syncedTasks(current, subjects, now);
    if (JSON.stringify(tasks) === JSON.stringify(current.tasks)) return;
    update((s) => ({ ...s, tasks }));
  },

  /** 達成した試練の報酬を受け取る: MP は累積魔力・階級へ、触媒は所持品へ。受け取れなければ null */
  claimTask(taskId: string, subjects: Pick<Subject, "id">[], now = new Date()): TaskClaim | null {
    const def = TASKS.find((t) => t.id === taskId);
    if (!def) return null;
    const tasks = syncedTasks(load(), subjects, now);
    const task = tasks[def.scope].items[taskId];
    if (!task || task.isClaimed || task.progress < task.maxProgress) return null;
    const claim: TaskClaim =
      def.reward.kind === "mp" ? { mp: def.reward.mp, item: null } : { mp: 0, item: drawCatalyst(def.reward.rare) };
    update((s) => {
      const claimed = {
        ...tasks,
        [def.scope]: { ...tasks[def.scope], items: { ...tasks[def.scope].items, [taskId]: { ...task, isClaimed: true } } },
      };
      const inventory = claim.item ? { ...s.inventory, [claim.item.id]: (s.inventory[claim.item.id] ?? 0) + 1 } : s.inventory;
      return withProgress({ ...s, tasks: claimed, inventory }, s.userProfile.totalMp + claim.mp);
    });
    return claim;
  },

  /** 古代文書の復元: 4葉の断片を1つずつ使い、星脈の記憶として登録する。復元できなければ null */
  restoreDocument(documentId: string): MemoryItem | null {
    if (!canRestore(load(), documentId)) return null;
    const memory = memoryOf(documentId);
    update((s) => {
      const inventory = { ...s.inventory, [memory.id]: 1 };
      for (const f of fragmentsOf(documentId)) inventory[f.id] = (inventory[f.id] ?? 0) - 1;
      return { ...s, inventory };
    });
    return memory;
  },

  /** 余剰の遺物を星屑の原石へ還元する。得た原石の数を返す */
  dissolve(itemId: string, amount: number): number {
    const item = findItem(itemId);
    if (!item) return 0;
    const n = Math.min(amount, surplusCount(load(), item));
    if (n <= 0) return 0;
    const ore = n * dissolveValue(item);
    update((s) => {
      const left = (s.inventory[item.id] ?? 0) - n;
      return {
        ...s,
        inventory: { ...s.inventory, [item.id]: left, [STARDUST_ORE.id]: (s.inventory[STARDUST_ORE.id] ?? 0) + ore },
        // 装備中の触媒を使い切ったら装備も外す
        equipment: { ...s.equipment, catalystId: s.equipment.catalystId === item.id && left <= 0 ? null : s.equipment.catalystId },
      };
    });
    return ore;
  },

  /** 神話遺物の錬成: 星屑の原石と指定の秘宝を捧げて生み出す。錬成できなければ null */
  craft(mythicId: string): RelicItem | null {
    const mythic = MYTHICS.find((m) => m.id === mythicId);
    if (!mythic?.recipe || !canCraft(load(), mythic)) return null;
    const { ore, relics } = mythic.recipe;
    update((s) => {
      const inventory = { ...s.inventory, [mythic.id]: 1, [STARDUST_ORE.id]: (s.inventory[STARDUST_ORE.id] ?? 0) - ore };
      for (const id of relics) inventory[id] = (inventory[id] ?? 0) - 1;
      return { ...s, inventory };
    });
    return mythic;
  },

  /** 観測データの初期化 */
  reset() {
    update(() => initialUserData());
  },

  /** 開発者ツール: いまのデータを退避してから、動作確認用のサンプルデータに切り替える */
  loadSample() {
    backupForDev(load());
    update(() => sampleUserData());
  },

  /**
   * 開発者ツール: いまのデータを退避してから、すべてを解放したデータに切り替える。
   * 既に退避があれば（全解放中に押し直した場合）、元のデータの退避は上書きしない
   */
  unlockAll() {
    const current = load();
    backupForDev(current);
    update(() => fullyUnlockedData(current));
  },

  /** 開発者ツール: 全解放・サンプル読み込みの前に退避したデータへ戻す。退避が無ければ false */
  restoreDevBackup(): boolean {
    try {
      const raw = window.localStorage.getItem(DEV_BACKUP_KEY);
      if (!raw) return false;
      update(() => normalize(JSON.parse(raw)));
      window.localStorage.removeItem(DEV_BACKUP_KEY);
      return true;
    } catch {
      return false;
    }
  },
};

/** 開発者ツールで全解放・サンプル読み込みをする前のデータの退避先 */
const DEV_BACKUP_KEY = "maholog_user_data_dev_backup";

/** 元のデータを退避する。既に退避があれば（切り替え中に押し直した場合）上書きしない */
function backupForDev(current: UserData) {
  try {
    if (!window.localStorage.getItem(DEV_BACKUP_KEY)) window.localStorage.setItem(DEV_BACKUP_KEY, JSON.stringify(current));
  } catch {}
}

/** 全解放の前に退避したデータがあるか */
export function hasDevBackup() {
  try {
    return window.localStorage.getItem(DEV_BACKUP_KEY) !== null;
  } catch {
    return false;
  }
}

/** 最奥の祭壇（6-3: 300時間）まで届く累積MP。魔術階級も最高位 X になる */
const UNLOCK_ALL_MP = 300 * 60;

/**
 * すべてを解放したデータ: 全ステージ・最高階級、図鑑の全遺物（神話遺物を含む）、全文書の復元、
 * 断片と星屑の原石も試せるだけ持たせる。名前・設定・世界線と、滞在中のエリアは引き継ぐ。
 * 魔導の軌跡や魔法陣が描けるよう、詠唱履歴はサンプルを使う
 */
function fullyUnlockedData(base: UserData): UserData {
  const sample = sampleUserData();
  const inventory: Record<string, number> = { [STARDUST_ORE.id]: 500 };
  for (const item of ALL_ITEMS) inventory[item.id] = item.kind === "catalyst" ? 5 : 1;
  for (const f of FRAGMENTS) inventory[f.id] = 2;
  for (const m of MEMORIES) inventory[m.id] = 1;
  return withProgress(
    {
      ...base,
      // 2周目以降でもすべてのエリアが開くよう、周天の始まりは 0 に戻す
      cycle: { ...base.cycle, startMp: 0 },
      chantHistory: sample.chantHistory,
      inventory,
      equipment: { ...base.equipment, catalystId: null },
    },
    UNLOCK_ALL_MP,
  );
}
