"use client";

// 観測者ID（ML-XXXX-XXXX）による簡易クラウド同期。
// 端末の保存データ（user-store）をそのまま Supabase の observer_saves に預け、別の端末では ID を入力して復元する。
// - 端末で保存データが変わったら、少し待ってまとめて預ける（画面を離れるときはすぐに）
// - 画面に戻ったときや起動時にクラウドを確かめ、別の端末で進んでいれば取り込む
// - 両方で進んでいたら、累積MP（同じなら詠唱の記録の数）が多い方を残す
import { useSyncExternalStore } from "react";
import { createClient } from "./supabase/client";
import { isCloudSyncEnabled } from "./supabase/config";
import { getUserData, onLocalChange, replaceUserData, type UserData } from "./user-store";

const META_KEY = "maholog_observer";
/** 変更をまとめて預けるまでの待ち時間 */
const PUSH_DELAY_MS = 4000;

/** 見間違えやすい文字（0/O, 1/I）を除いた 32 文字 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

type Meta = {
  /** この端末の観測者ID */
  id: string;
  /** 最後にクラウドと揃えたときの保存の更新時刻（DB の値をそのまま持つ。初回は null） */
  syncedAt: string | null;
  /** クラウドにまだ預けていない変更があるか */
  dirty: boolean;
  /** 次の同期では、どちらが進んでいるかを比べずにこの端末の保存で上書きする（バックアップの読み込みなど） */
  force?: boolean;
};

export type SyncStatus = "disabled" | "idle" | "syncing" | "synced" | "offline" | "error";

export type ObserverState = { id: string; status: SyncStatus; syncedAt: string | null };

/** 観測者IDを新しく作る（32 文字 × 8 桁 ≒ 1 兆通り） */
export function generateObserverId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `ML-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** 入力された観測者IDを ML-XXXX-XXXX の形に整える（小文字・区切りや空白の有無は問わない）。読めなければ null */
export function normalizeObserverId(input: string) {
  const body = input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/^ML/, "");
  // 0 / 1 / O / I は ID に使わない文字なので、打ち間違いとして弾く
  if (body.length !== 8 || [...body].some((c) => !ALPHABET.includes(c))) return null;
  return `ML-${body.slice(0, 4)}-${body.slice(4)}`;
}

// ---- 端末に持つ同期の記録 ----

let meta: Meta | null = null;
let status: SyncStatus = isCloudSyncEnabled ? "idle" : "disabled";
let snapshot: ObserverState | null = null;
const listeners = new Set<() => void>();

function loadMeta(): Meta {
  if (meta) return meta;
  try {
    const saved = JSON.parse(window.localStorage.getItem(META_KEY) ?? "null") as Partial<Meta> | null;
    if (saved?.id && normalizeObserverId(saved.id) === saved.id) {
      meta = { id: saved.id, syncedAt: saved.syncedAt ?? null, dirty: saved.dirty ?? true, force: saved.force ?? false };
      return meta;
    }
  } catch {}
  // 初回アクセス: 観測者IDを発行する（いまの保存データは、まだ預けていない変更として扱う）
  meta = { id: generateObserverId(), syncedAt: null, dirty: true };
  saveMeta(meta);
  return meta;
}

function saveMeta(next: Meta) {
  meta = next;
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(next));
  } catch {}
  emit();
}

function setStatus(next: SyncStatus) {
  if (status === next) return;
  status = next;
  emit();
}

function emit() {
  snapshot = null;
  listeners.forEach((l) => l());
}

function getSnapshot(): ObserverState {
  if (!snapshot) {
    const m = loadMeta();
    snapshot = { id: m.id, status, syncedAt: m.syncedAt };
  }
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 観測者IDと同期の状態。サーバー描画中は null */
export function useObserver(): ObserverState | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

// ---- クラウドとのやりとり ----

type Remote = { data: unknown; updatedAt: string };

async function pull(code: string): Promise<Remote | null> {
  const { data, error } = await createClient().rpc("observer_pull", { code });
  if (error) throw error;
  const row = (data as { data: unknown; updated_at: string }[] | null)?.[0];
  return row ? { data: row.data, updatedAt: row.updated_at } : null;
}

async function push(code: string, payload: UserData, base: string | null): Promise<{ status: "ok" | "conflict"; updatedAt: string }> {
  const { data, error } = await createClient().rpc("observer_push", { code, payload, base_updated_at: base });
  if (error) throw error;
  const row = (data as { status: "ok" | "conflict"; updated_at: string }[])[0];
  return { status: row.status, updatedAt: row.updated_at };
}

/** 両方で進んでいたとき、クラウドの方を残すか: 累積MP、同じなら詠唱の記録の数が多い方。それも同じならクラウド */
function preferRemote(local: UserData, remote: unknown) {
  const r = remote as Partial<UserData>;
  const remoteMp = r.userProfile?.totalMp ?? 0;
  if (remoteMp !== local.userProfile.totalMp) return remoteMp > local.userProfile.totalMp;
  return (r.chantHistory?.length ?? 0) >= local.chantHistory.length;
}

/** 預ける途中で端末の変更が入ったら、預け終えても dirty を下ろさない */
let localVersion = 0;
let running: Promise<void> | null = null;
let pushTimer: number | undefined;

/** クラウドと揃える: 別の端末で進んでいれば取り込み、この端末の変更があれば預ける */
export function syncNow(): Promise<void> {
  if (!isCloudSyncEnabled) return Promise.resolve();
  // 重ねて走らせず、走っている同期が終わってからもう一度揃える
  if (running) return running.then(() => syncNow());
  running = reconcile().finally(() => {
    running = null;
  });
  return running;
}

async function reconcile() {
  window.clearTimeout(pushTimer);
  const m = loadMeta();
  setStatus("syncing");
  try {
    const remote = await pull(m.id);
    if (remote && m.syncedAt === null) {
      // まだ一度も預けていない ID が既に使われていた（ごくまれな重複）: 新しい ID を発行し直す
      saveMeta({ id: generateObserverId(), syncedAt: null, dirty: true });
      return reconcile();
    }
    const remoteChanged = remote !== null && remote.updatedAt !== m.syncedAt;

    if (remote && remoteChanged && !m.force && (!m.dirty || preferRemote(getUserData(), remote.data))) {
      // 別の端末で進んでいた: クラウドの保存を取り込む
      if (!replaceUserData(remote.data)) throw new Error("invalid remote data");
      saveMeta({ ...m, syncedAt: remote.updatedAt, dirty: false });
    } else if (m.dirty || !remote) {
      // この端末の変更を預ける（クラウドが進んでいても、この端末の方が進んでいれば上書きする）
      const version = localVersion;
      const result = await push(m.id, getUserData(), remote?.updatedAt ?? m.syncedAt);
      if (result.status === "conflict") {
        // 確かめてから預けるまでに別の端末が書いた: 少し待ってから揃え直す
        setStatus("idle");
        return reconcileLater();
      }
      saveMeta({ ...m, syncedAt: result.updatedAt, dirty: version !== localVersion, force: false });
    }
    setStatus("synced");
  } catch {
    setStatus(navigator.onLine ? "error" : "offline");
  }
}

function reconcileLater() {
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => void syncNow(), PUSH_DELAY_MS);
}

/**
 * 別の端末の記録を、観測者IDで復元する。この端末の保存データはクラウドの記録に置き換わり、
 * 以後はその観測者IDで同期する
 */
export async function restoreFromObserverId(input: string): Promise<"ok" | "invalid" | "not-found" | "same" | "error"> {
  const code = normalizeObserverId(input);
  if (!code) return "invalid";
  if (!isCloudSyncEnabled) return "error";
  if (code === loadMeta().id) return "same";
  try {
    if (running) await running;
    const remote = await pull(code);
    if (!remote) return "not-found";
    if (!replaceUserData(remote.data)) return "error";
    saveMeta({ id: code, syncedAt: remote.updatedAt, dirty: false });
    setStatus("synced");
    return "ok";
  } catch {
    return "error";
  }
}

/** バックアップの読み込みなど、意図して記録を書き換えたとき: 次の同期でクラウドもこの端末の記録で上書きする */
export function overrideCloud() {
  if (!isCloudSyncEnabled) return;
  saveMeta({ ...loadMeta(), dirty: true, force: true });
}

/**
 * 初期化して旅をやり直すとき: 新しい観測者IDに切り替える。
 * これまでの記録はクラウドに元の ID のまま残るので、その ID で復元すれば戻れる
 */
export function startNewObserver() {
  saveMeta({ id: generateObserverId(), syncedAt: null, dirty: true });
}

let started = false;

/** アプリ全体で一度だけ: 起動時に揃え、以後は変更・画面の出入り・回線の復帰のたびに揃える */
export function startCloudSync() {
  if (started || !isCloudSyncEnabled) return;
  started = true;
  loadMeta();
  onLocalChange(() => {
    localVersion += 1;
    const m = loadMeta();
    if (!m.dirty) saveMeta({ ...m, dirty: true });
    reconcileLater();
  });
  // 画面を離れるときはすぐに預け、戻ってきたら別の端末での進みを確かめる
  document.addEventListener("visibilitychange", () => void syncNow());
  window.addEventListener("online", () => void syncNow());
  void syncNow();
}
