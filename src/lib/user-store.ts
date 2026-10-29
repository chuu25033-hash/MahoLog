"use client";

// アプリ全体のローカル永続データ（localStorage の maholog_user_data に JSON で保存）。
// プロフィール・詠唱履歴・星天の導きの受取状況・所持アイテム・解放済みステージを保持する。
import { useSyncExternalStore } from "react";
import { AREAS, isAreaUnlocked, resolveArea } from "./areas";
import { jstDateKey, startOfJstDay } from "./date";
import { demoProfile } from "./demo";
import { calcLevel, rankOf } from "./game";
import { DEFAULT_SKIN, findItem, type CatalystItem, type Item, type Skin } from "./items";
import { mockObservedNights } from "./star-memory";
import type { Profile, StudyLog, StudyMode } from "./types";

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
};

export type ChantRecord = {
  id: string;
  /** 詠唱を終えた日時（ISO 8601） */
  date: string;
  /** 集中時間（分） */
  minutes: number;
  subjectId: string;
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
  /** 主軸科目。詠唱画面で最初に選ばれる */
  mainSubjectId: string | null;
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
};

const unlockedAt = (totalMp: number) => AREAS.filter((a) => isAreaUnlocked(a, totalMp)).map((a) => a.id);

/** 初回起動時の状態: Rank I「門前の解読者」、はじまりの小屋から */
export function initialUserData(): UserData {
  return {
    userProfile: { username: demoProfile.username, rank: rankOf(calcLevel(0)).numeral, totalMp: 0, currentStageId: "1-1" },
    chantHistory: [],
    dailyReward: { lastClaimedDate: null, streak: 0 },
    inventory: {},
    unlockedStages: unlockedAt(0),
    equipment: { catalystId: null, skinId: null },
    settings: { mainSubjectId: null, defaultFocusMinutes: 25, liteMode: false, chime: true },
  };
}

/** 保存データ（古い形式を含む）に初期値を補って読み込める形にする */
function normalize(saved: Partial<UserData>): UserData {
  const base = initialUserData();
  return {
    ...base,
    ...saved,
    userProfile: { ...base.userProfile, ...saved.userProfile },
    dailyReward: { ...base.dailyReward, ...saved.dailyReward },
    equipment: { ...base.equipment, ...saved.equipment },
    settings: { ...base.settings, ...saved.settings },
  };
}

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
      state = normalize(JSON.parse(raw) as Partial<UserData>);
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

  /** 観測データの初期化 */
  reset() {
    update(() => initialUserData());
  },

  /** 動作確認用のサンプルデータを読み込む */
  loadSample() {
    update(() => sampleUserData());
  },
};
