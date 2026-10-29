"use client";

// Supabase 未接続のローカルモック用ストア（localStorage に保存）。
// 滞在エリア・所持アイテム・図鑑・装備中のスキン/触媒を保持する。
import { useSyncExternalStore } from "react";
import { DEFAULT_SKIN, findItem, type CatalystItem, type Item, type Skin } from "./items";

export type MockState = {
  /** 選択中の滞在エリア（null は最も奥の解放済みエリア） */
  areaId: string | null;
  /** 触媒（消耗品）の所持数 */
  inventory: Record<string, number>;
  /** 一度でも獲得したアイテム（図鑑登録） */
  discovered: string[];
  /** 次回の詠唱で使う触媒 */
  armedCatalystId: string | null;
  /** 適用中のテーマスキン */
  skinId: string | null;
};

const STORAGE_KEY = "maholog:mock:v1";
const INITIAL: MockState = { areaId: null, inventory: {}, discovered: [], armedCatalystId: null, skinId: null };

let state: MockState = INITIAL;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...INITIAL, ...JSON.parse(raw) };
  } catch {}
}

function update(next: (s: MockState) => MockState) {
  load();
  state = next(state);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // 別タブでの変更も反映する
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    loaded = false;
    load();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  load();
  return state;
}

export function useMockState() {
  return useSyncExternalStore(subscribe, getSnapshot, () => INITIAL);
}

export function activeSkin(s: MockState): Skin {
  const item = findItem(s.skinId);
  return item?.kind === "skin" ? item.skin : DEFAULT_SKIN;
}

export function armedCatalyst(s: MockState): CatalystItem | null {
  const item = findItem(s.armedCatalystId);
  return item?.kind === "catalyst" && (s.inventory[item.id] ?? 0) > 0 ? item : null;
}

export const mockActions = {
  setArea(areaId: string) {
    update((s) => ({ ...s, areaId }));
  },

  /** ドロップしたアイテムを登録。初獲得なら true */
  addItem(item: Item): boolean {
    const isNew = !getSnapshot().discovered.includes(item.id);
    update((s) => ({
      ...s,
      discovered: isNew ? [...s.discovered, item.id] : s.discovered,
      inventory: item.kind === "catalyst" ? { ...s.inventory, [item.id]: (s.inventory[item.id] ?? 0) + 1 } : s.inventory,
    }));
    return isNew;
  },

  armCatalyst(id: string | null) {
    update((s) => ({ ...s, armedCatalystId: id }));
  },

  /** 装備中の触媒を1つ消費して返す */
  consumeCatalyst(): CatalystItem | null {
    const item = armedCatalyst(getSnapshot());
    if (!item) return null;
    update((s) => {
      const left = (s.inventory[item.id] ?? 0) - 1;
      return {
        ...s,
        inventory: { ...s.inventory, [item.id]: left },
        armedCatalystId: left > 0 ? s.armedCatalystId : null,
      };
    });
    return item;
  },

  setSkin(id: string | null) {
    update((s) => ({ ...s, skinId: id }));
  },
};
