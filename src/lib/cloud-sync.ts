"use client";

// 端末の保存データ（user-store）を Supabase に預けるクラウド同期。預け先は2通り:
// - Google でログインしていれば、そのアカウント（account_saves）。他の人は読み書きできない
// - ログインしていなければ、観測者ID（ML-XXXX-XXXX）と復元キー。別の端末では両方を入力して復元する（observer_saves）
//   観測者IDは名札で、記録を開く鍵は復元キー（長いランダムな文字列。見られても困るのは復元キーだけ）
// 同期のしかたはどちらも同じ:
// - 端末で保存データが変わったら、少し待ってまとめて預ける（画面を離れるときはすぐに）
// - 画面に戻ったときや起動時にクラウドを確かめ、別の端末で進んでいれば取り込む
// - 両方で進んでいたら、累積MP（同じなら詠唱の記録の数）が多い方を残す
// ログインして初めてアカウントと揃えるときだけは、両方に記録があれば「どちらで続けるか」を本人に選んでもらう
import { useSyncExternalStore } from "react";
import { createClient } from "./supabase/client";
import { isCloudSyncEnabled } from "./supabase/config";
import { getUserData, onLocalChange, replaceUserData, userActions, type UserData } from "./user-store";

const META_KEY = "maholog_observer";
/** 変更をまとめて預けるまでの待ち時間 */
const PUSH_DELAY_MS = 4000;

/** 見間違えやすい文字（0/O, 1/I）を除いた 32 文字 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

type Account = { userId: string; email: string | null };

type Meta = {
  /** この端末の観測者ID（ログイン中も、ログアウト後の預け先として持っておく） */
  id: string;
  /** 観測者IDの記録を開く復元キー（XXXX-XXXX-XXXX-XXXX-XXXX） */
  key: string;
  /** Google でログインしているアカウント。あればこちらに預ける */
  account: Account | null;
  /** 最後にクラウドと揃えたときの保存の更新時刻（DB の値をそのまま持つ。初回は null） */
  syncedAt: string | null;
  /** クラウドにまだ預けていない変更があるか */
  dirty: boolean;
  /** 次の同期では、どちらが進んでいるかを比べずにこの端末の保存で上書きする（バックアップの読み込みなど） */
  force?: boolean;
  /** ログインしたばかりで、まだアカウントの記録と突き合わせていない */
  linking?: boolean;
  /** いまの復元キーを本人が控えたか（コピー・画像で保存・「控えました」） */
  keySaved?: boolean;
  /** 控えていなければ、詠唱の記録がこの数に達したら保存を促す（「あとで」で先へ延ばす） */
  keyReminderAt?: number;
};

/**
 * limited: 観測者IDの試行が多すぎて、星界がしばらく受け付けていない（総当たり対策）
 * locked: 別の端末で復元キーが作り直され、この端末のキーでは開けなくなった
 */
export type SyncStatus = "disabled" | "idle" | "syncing" | "synced" | "offline" | "error" | "limited" | "locked";

export type ObserverState = {
  id: string;
  /** 復元キー（設定画面で見せる） */
  key: string;
  status: SyncStatus;
  syncedAt: string | null;
  /** ログイン中のアカウント（ログインしていなければ null） */
  account: { email: string | null } | null;
  /** いまの復元キーを控えたか */
  keySaved: boolean;
  /** 詠唱の記録がこの数に達したら、復元キーの保存を促す */
  keyReminderAt: number;
};

/** 記録の大きさの目安（どちらで続けるかを選ぶときに見せる） */
export type SaveSummary = { mp: number; chants: number };

/** ログインしたとき、端末とアカウントの両方に記録があった: どちらで続けるかの選択待ち */
export type LinkChoice = { device: SaveSummary; account: SaveSummary };

/** 観測者IDを新しく作る（32 文字 × 8 桁 ≒ 1 兆通り） */
export function generateObserverId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `ML-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** 復元キーを新しく作る（32 文字 × 20 桁 ≒ 2^100 通り。推測も総当たりもできない長さ） */
export function generateRecoveryKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return chars.match(/.{4}/g)!.join("-");
}

/** 入力された復元キーを XXXX-XXXX-XXXX-XXXX-XXXX の形に整える（小文字・区切りや空白の有無は問わない）。読めなければ null */
export function normalizeRecoveryKey(input: string) {
  const body = input.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (body.length !== 20 || [...body].some((c) => !ALPHABET.includes(c))) return null;
  return body.match(/.{4}/g)!.join("-");
}

/** 新しい観測者ID と復元キーの組（まだ控えていないので、最初の詠唱のあとに保存を促す） */
function newObserver() {
  return { id: generateObserverId(), key: generateRecoveryKey(), keySaved: false, keyReminderAt: 1 };
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
/** どちらの記録で続けるかの選択待ち（クラウド側の記録も持っておく） */
let pendingLink: { choice: LinkChoice; remote: Remote } | null = null;
const listeners = new Set<() => void>();

function loadMeta(): Meta {
  if (meta) return meta;
  try {
    const saved = JSON.parse(window.localStorage.getItem(META_KEY) ?? "null") as Partial<Meta> | null;
    if (saved?.id && normalizeObserverId(saved.id) === saved.id) {
      meta = {
        id: saved.id,
        // 復元キーができる前の端末: キーを作る（最初に預けたときに、星界の記録もこのキーで閉じる）
        key: saved.key && normalizeRecoveryKey(saved.key) === saved.key ? saved.key : generateRecoveryKey(),
        account: saved.account?.userId ? { userId: saved.account.userId, email: saved.account.email ?? null } : null,
        syncedAt: saved.syncedAt ?? null,
        dirty: saved.dirty ?? true,
        force: saved.force ?? false,
        linking: saved.linking ?? false,
        keySaved: saved.keySaved ?? false,
        keyReminderAt: saved.keyReminderAt ?? 1,
      };
      return meta;
    }
  } catch {}
  // 初回アクセス: 観測者IDを発行する（いまの保存データは、まだ預けていない変更として扱う）
  meta = { ...newObserver(), account: null, syncedAt: null, dirty: true };
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
    snapshot = {
      id: m.id,
      key: m.key,
      status,
      syncedAt: m.syncedAt,
      account: m.account ? { email: m.account.email } : null,
      keySaved: m.keySaved ?? false,
      keyReminderAt: m.keyReminderAt ?? 1,
    };
  }
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 観測者ID・ログイン中のアカウントと同期の状態。サーバー描画中は null */
export function useObserver(): ObserverState | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

/** どちらの記録で続けるかの選択待ち（無ければ null） */
export function useLinkChoice(): LinkChoice | null {
  return useSyncExternalStore(
    subscribe,
    () => pendingLink?.choice ?? null,
    () => null,
  );
}

// ---- クラウドとのやりとり ----

type Remote = { data: unknown; updatedAt: string };

/** 観測者IDの試行回数の制限に掛かった（DB が HTTP 429 / PT429 で断った） */
function isRateLimited(error: unknown) {
  return (error as { code?: string } | null)?.code === "PT429";
}
/** forbidden: 観測者IDの記録が別の復元キーで閉じられていた */
type PushResult = { status: "ok" | "conflict" | "forbidden"; updatedAt: string };

async function pull(m: Meta): Promise<Remote | null> {
  const client = createClient();
  const { data, error } = m.account ? await client.rpc("account_pull") : await client.rpc("observer_pull", { code: m.id, secret: m.key });
  if (error) throw error;
  const row = (data as { data: unknown; updated_at: string }[] | null)?.[0];
  return row ? { data: row.data, updatedAt: row.updated_at } : null;
}

async function push(m: Meta, payload: UserData, base: string | null): Promise<PushResult> {
  const client = createClient();
  const { data, error } = m.account
    ? await client.rpc("account_push", { payload, base_updated_at: base })
    : await client.rpc("observer_push", { code: m.id, secret: m.key, payload, base_updated_at: base });
  if (error) throw error;
  const row = (data as { status: PushResult["status"]; updated_at: string }[])[0];
  return { status: row.status, updatedAt: row.updated_at };
}

function summarize(data: unknown): SaveSummary {
  const d = data as Partial<UserData>;
  return { mp: d.userProfile?.totalMp ?? 0, chants: d.chantHistory?.length ?? 0 };
}

/** まだ何も始めていない記録か（ログインしたとき、アカウントの記録をそのまま取り込んでよい） */
function isFresh(data: UserData) {
  return data.userProfile.totalMp === 0 && data.chantHistory.length === 0;
}

/** 両方で進んでいたとき、クラウドの方を残すか: 累積MP、同じなら詠唱の記録の数が多い方。それも同じならクラウド */
function preferRemote(local: UserData, remote: unknown) {
  const r = summarize(remote);
  if (r.mp !== local.userProfile.totalMp) return r.mp > local.userProfile.totalMp;
  return r.chants >= local.chantHistory.length;
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
  // どちらの記録で続けるかを本人が選ぶまでは、どちらにも書かない
  if (pendingLink) return;
  const m = loadMeta();
  setStatus("syncing");
  try {
    if (!m.account && m.syncedAt === null) {
      // まだ一度も預けていない観測者ID: 取り出さずにいきなり預ける（取り出すと「外れ」として試行回数に数えられるため）
      const version = localVersion;
      const result = await push(m, getUserData(), null);
      if (result.status !== "ok") {
        // 既に使われていた ID だった（ごくまれな重複）: 新しい ID と復元キーを発行し直す
        saveMeta({ ...loadMeta(), ...newObserver(), syncedAt: null, dirty: true });
        return reconcile();
      }
      saveMeta({ ...loadMeta(), syncedAt: result.updatedAt, dirty: version !== localVersion, force: false });
      setStatus("synced");
      return;
    }

    const remote = await pull(m);

    if (m.account && m.linking) {
      // ログインして初めてアカウントと揃える
      if (remote && !isFresh(getUserData())) {
        // 端末にもアカウントにも記録がある: どちらで続けるかを選んでもらう
        pendingLink = { choice: { device: summarize(getUserData()), account: summarize(remote.data) }, remote };
        setStatus("idle");
        emit();
        return;
      }
      if (remote) {
        // 端末はまだ何も始めていない: アカウントの記録をそのまま取り込む
        if (!replaceUserData(remote.data)) throw new Error("invalid remote data");
        saveMeta({ ...m, syncedAt: remote.updatedAt, dirty: false, linking: false });
        setStatus("synced");
        return;
      }
      // アカウントに記録がまだ無い: この端末の記録（観測者IDで預けていたもの）をアカウントへ引き継ぐ
      saveMeta({ ...m, linking: false, dirty: true, syncedAt: null });
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
      const result = await push(m, getUserData(), remote?.updatedAt ?? m.syncedAt);
      if (result.status === "forbidden") {
        // 別の端末で復元キーが作り直された: この端末のキーでは開けない。新しい復元キーでの復元を待つ
        setStatus("locked");
        return;
      }
      if (result.status === "conflict") {
        // 確かめてから預けるまでに別の端末が書いた: 少し待ってから揃え直す
        setStatus("idle");
        return reconcileLater();
      }
      saveMeta({ ...loadMeta(), syncedAt: result.updatedAt, dirty: version !== localVersion, force: false });
    }
    setStatus("synced");
  } catch (error) {
    setStatus(isRateLimited(error) ? "limited" : navigator.onLine ? "error" : "offline");
  }
}

function reconcileLater() {
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => void syncNow(), PUSH_DELAY_MS);
}

/**
 * ログインしたとき、端末とアカウントのどちらの記録で続けるかを決める。
 * account: アカウントの記録をこの端末に取り込む / device: この端末の記録でアカウントを上書きする
 */
export async function resolveLinkChoice(pick: "account" | "device") {
  if (!pendingLink) return;
  const { remote } = pendingLink;
  const m = loadMeta();
  pendingLink = null;
  if (pick === "account") {
    if (!replaceUserData(remote.data)) {
      setStatus("error");
      return;
    }
    saveMeta({ ...m, syncedAt: remote.updatedAt, dirty: false, linking: false, force: false });
    setStatus("synced");
    return;
  }
  saveMeta({ ...m, syncedAt: remote.updatedAt, dirty: true, linking: false, force: true });
  await syncNow();
}

/**
 * 別の端末の記録を、観測者IDと復元キーで復元する。この端末の保存データはクラウドの記録に置き換わり、
 * 以後はその観測者IDと復元キーで同期する（ログイン中は使わない）。
 * 観測者IDか復元キーが違えば not-found（どちらが違うかは星界も明かさない）
 */
export async function restoreFromObserverId(
  idInput: string,
  keyInput: string,
): Promise<"ok" | "invalid" | "invalid-key" | "not-found" | "same" | "limited" | "error"> {
  const code = normalizeObserverId(idInput);
  if (!code) return "invalid";
  const key = normalizeRecoveryKey(keyInput);
  if (!key) return "invalid-key";
  if (!isCloudSyncEnabled || loadMeta().account) return "error";
  // 鍵が締め出されている（locked）ときは、同じ観測者IDでも新しい復元キーで復元できる
  if (code === loadMeta().id && key === loadMeta().key) return "same";
  try {
    if (running) await running;
    const remote = await pull({ ...loadMeta(), id: code, key });
    if (!remote) return "not-found";
    if (!replaceUserData(remote.data)) return "error";
    // 入力できた復元キーは、本人が控えているもの
    saveMeta({ ...loadMeta(), id: code, key, syncedAt: remote.updatedAt, dirty: false, keySaved: true });
    setStatus("synced");
    return "ok";
  } catch (error) {
    return isRateLimited(error) ? "limited" : "error";
  }
}

/**
 * 復元キーを作り直す。古い復元キーは使えなくなり、同じ観測者IDを使っている他の端末は新しいキーで復元し直す必要がある
 */
export async function rotateRecoveryKey(): Promise<"ok" | "unsynced" | "limited" | "error"> {
  const m = loadMeta();
  if (!isCloudSyncEnabled || m.account) return "error";
  // 星界にまだ一度も預けていなければ、作り直すものが無い（先に預ける）
  await syncNow();
  if (loadMeta().syncedAt === null) return "unsynced";
  const next = generateRecoveryKey();
  try {
    const { data, error } = await createClient().rpc("observer_rotate_key", { code: m.id, secret: loadMeta().key, new_secret: next });
    if (error) throw error;
    if (data !== true) return "error";
    saveMeta({ ...loadMeta(), key: next, keySaved: false });
    return "ok";
  } catch (error) {
    return isRateLimited(error) ? "limited" : "error";
  }
}

/** 本人がいまの復元キーを控えた（コピー・画像で保存・「控えました」） */
export function markKeySaved() {
  const m = loadMeta();
  if (!m.keySaved) saveMeta({ ...m, keySaved: true });
}

/** 「あとで」: 詠唱を重ねたころにもう一度促す（1 → 4 → 8 → 16 …回目） */
export function snoozeKeyReminder(chants: number) {
  saveMeta({ ...loadMeta(), keyReminderAt: Math.max(chants + 3, chants * 2) });
}

/** バックアップの読み込みなど、意図して記録を書き換えたとき: 次の同期でクラウドもこの端末の記録で上書きする */
export function overrideCloud() {
  if (!isCloudSyncEnabled) return;
  saveMeta({ ...loadMeta(), dirty: true, force: true });
}

/**
 * 初期化して旅をやり直すとき。
 * ログインしていなければ新しい観測者IDに切り替える（これまでの記録は元の ID のまま星界に残る）。
 * ログイン中はアカウントの記録をやり直した記録で上書きする
 */
export function startNewObserver() {
  const m = loadMeta();
  if (m.account) {
    saveMeta({ ...m, dirty: true, force: true });
    return;
  }
  saveMeta({ ...m, ...newObserver(), syncedAt: null, dirty: true });
}

// ---- Google ログイン ----

/** Google でログインする。Google の画面へ移り、戻ってきたら /auth/callback でログインが完了する */
export async function signInWithGoogle(next = window.location.pathname): Promise<"redirecting" | "error"> {
  if (!isCloudSyncEnabled) return "error";
  // 移る前に、この端末の変更を観測者IDへ預けておく（ログイン後にアカウントへ引き継ぐ）
  await syncNow().catch(() => {});
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  return error ? "error" : "redirecting";
}

/**
 * ログアウトする。記録はアカウントに預けたまま、この端末からは消して新しい観測者IDで始め直す
 * （共用の端末に記録を残さないため）。預け終えていない変更があれば "unsynced" を返して何もしない（force で無視）
 */
export async function signOutAccount({ force = false } = {}): Promise<"ok" | "unsynced"> {
  await syncNow();
  const m = loadMeta();
  if (!force && (m.dirty || status !== "synced")) return "unsynced";
  await createClient()
    .auth.signOut()
    .catch(() => {});
  pendingLink = null;
  saveMeta({ ...newObserver(), account: null, syncedAt: null, dirty: true });
  userActions.reset();
  return "ok";
}

/** ログインの状態が変わったとき、預け先を合わせる */
function applySession(user: { id: string; email?: string | null } | null) {
  const m = loadMeta();
  if (user) {
    if (m.account?.userId === user.id) {
      if (m.account.email !== (user.email ?? null)) saveMeta({ ...m, account: { userId: user.id, email: user.email ?? null } });
      return;
    }
    // 新しくログインした（または別のアカウントに切り替わった）: アカウントの記録と突き合わせる
    pendingLink = null;
    saveMeta({ ...m, account: { userId: user.id, email: user.email ?? null }, syncedAt: null, dirty: true, force: false, linking: true });
    void syncNow();
    return;
  }
  if (m.account) {
    // ログインが切れていた（期限切れなど）: 記録は端末に残したまま、新しい観測者IDでの同期に戻す
    // （前の観測者IDの記録の更新時刻は分からないので、同じ ID に戻すと衝突して試行回数に数えられる）
    pendingLink = null;
    saveMeta({ ...m, ...newObserver(), account: null, syncedAt: null, dirty: true, force: false, linking: false });
    void syncNow();
  }
}

let started = false;

/** アプリ全体で一度だけ: 起動時に揃え、以後は変更・画面の出入り・回線の復帰・ログインのたびに揃える */
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

  // ログインの状態を確かめてから最初の同期をする（ログイン中ならアカウントへ、そうでなければ観測者IDへ）
  const auth = createClient().auth;
  let first = true;
  auth.onAuthStateChange((event, session) => {
    if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
    const user = session?.user ?? null;
    // この中で Supabase を呼ぶと認証の処理と競合するので、一拍おいてから揃える
    window.setTimeout(() => {
      const before = loadMeta().account?.userId ?? null;
      applySession(user);
      const after = loadMeta().account?.userId ?? null;
      // 預け先が変わらなかった初回は、ここで最初の同期をする
      if (first && before === after) void syncNow();
      first = false;
    }, 0);
  });
}
