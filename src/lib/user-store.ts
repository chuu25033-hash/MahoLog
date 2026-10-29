"use client";

// アプリ全体のローカル永続データ（localStorage の maholog_user_data に JSON で保存）。
// プロフィール・詠唱履歴・星天の導きの受取状況・所持アイテム・解放済みステージ・設定・試練の進捗を保持する。
import { useSyncExternalStore } from "react";
import { AREAS, isAreaUnlocked, resolveArea } from "./areas";
import { jstDateKey, startOfJstDay } from "./date";
import { demoProfile } from "./demo";
import { calcLevel, rankOf } from "./game";
import { DEFAULT_SKIN, findItem, type CatalystItem, type Item, type Skin } from "./items";
import { mockObservedNights } from "./star-memory";
import { activeSubjectsOf } from "./subjects";
import { TASKS, drawCatalyst, measureTask, periodKey, type TaskBoard, type TaskScope } from "./tasks";
import { generateWorldlineCode } from "./worldlines";
import type { Profile, StudyLog, StudyMode, Subject } from "./types";

export const STORAGE_KEY = "maholog_user_data";
const DAY = 24 * 60 * 60 * 1000;

export type UserProfile = {
  username: string;
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
  /** 見つけたアイテム */
  dropId: string | null;
};

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
};

export type UserData = {
  userProfile: UserProfile;
  chantHistory: ChantRecord[];
  dailyReward: DailyReward;
  /** 獲得したアイテムの個数。キーがあれば図鑑登録済み（触媒は使うと減り、0 になっても登録は残る） */
  inventory: Record<string, number>;
  unlockedStages: string[];
  /** 装備中の触媒・テーマスキン */
  equipment: { catalystId: string | null; skinId: string | null };
  settings: UserSettings;
  /** 試練（日課の儀式・週間の大誓約）の進捗と受取状況 */
  tasks: Record<TaskScope, TaskBoard>;
  /** 結びし世界線（デモモード用。Supabase 接続時は DB に持つ）: 自分の世界線IDと、結んだ相手の世界線ID */
  worldlines: { code: string; bonds: { code: string; boundAt: string }[] };
};

const unlockedAt = (totalMp: number) => AREAS.filter((a) => isAreaUnlocked(a, totalMp)).map((a) => a.id);

/** 初回起動時の状態: Rank I「門前の解読者」、はじまりの小屋から */
export function initialUserData(): UserData {
  return {
    userProfile: { username: demoProfile.username, rank: rankOf(calcLevel(0)).numeral, totalMp: 0, currentStageId: "1-1", subject: null, subSubject: null, activeSubjects: null },
    chantHistory: [],
    dailyReward: { lastClaimedDate: null, streak: 0 },
    inventory: {},
    unlockedStages: unlockedAt(0),
    equipment: { catalystId: null, skinId: null },
    settings: { defaultFocusMinutes: 25, liteMode: false, chime: true },
    tasks: { daily: { periodKey: "", items: {} }, weekly: { periodKey: "", items: {} } },
    worldlines: { code: generateWorldlineCode(), bonds: [] },
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
  };
}

/** 試練の進捗を詠唱履歴から測り直す。期間が変わっていれば受取状況も巡り直す */
function syncedTasks(data: UserData, subjects: Pick<Subject, "id">[], now: Date): UserData["tasks"] {
  const context = {
    history: data.chantHistory,
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

/** 累積MPから階級・解放済みステージを導き直す */
function withProgress(data: UserData, totalMp: number): UserData {
  return {
    ...data,
    userProfile: { ...data.userProfile, totalMp, rank: rankOf(calcLevel(totalMp)).numeral },
    unlockedStages: unlockedAt(totalMp),
  };
}

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
      data.equipment = { catalystId: mock.armedCatalystId ?? null, skinId: mock.skinId ?? null };
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

function update(next: (s: UserData) => UserData) {
  state = next(load());
  persist();
  listeners.forEach((l) => l());
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
  const { username, totalMp } = data.userProfile;
  return { ...demoProfile, id: "local", username, total_study_time: totalMp, current_level: calcLevel(totalMp) };
}

/** 詠唱履歴を勉強記録の形にする */
export function localStudyLogs(data: UserData): StudyLog[] {
  return data.chantHistory.map((r) => ({
    id: r.id,
    subject_id: r.subjectId,
    duration_minutes: r.minutes,
    mode: r.mode,
    created_at: r.date,
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

  /** ドロップ・授かり物を登録。初獲得なら true */
  addItem(item: Item): boolean {
    const isNew = !isDiscovered(load(), item.id);
    update((s) => ({ ...s, inventory: { ...s.inventory, [item.id]: (s.inventory[item.id] ?? 0) + 1 } }));
    return isNew;
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

  /** 詠唱完了: 履歴に刻み、累積MP・階級・解放済みステージを更新する */
  recordChant(record: Omit<ChantRecord, "id" | "date">, now = new Date()) {
    update((s) =>
      withProgress(
        { ...s, chantHistory: [...s.chantHistory, { ...record, id: `c-${now.getTime()}`, date: now.toISOString() }] },
        s.userProfile.totalMp + record.mp,
      ),
    );
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
      if (typeof saved !== "object" || saved === null || typeof saved.userProfile !== "object" || !Array.isArray(saved.chantHistory)) {
        return false;
      }
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

  /** 観測データの初期化 */
  reset() {
    update(() => initialUserData());
  },

  /** 動作確認用のサンプルデータを読み込む */
  loadSample() {
    update(() => sampleUserData());
  },
};
