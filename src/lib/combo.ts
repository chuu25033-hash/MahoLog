// 星脈との同調（コンボ）: 25分以上の詠唱を、静息を挟みながら途切れずに紡ぐほど高まる。
// 判定はすべて時刻（ms）の差で行うので、画面を閉じていた間や端末が休止していた間も正しく数えられる。
//
// 続く条件: 前の詠唱を終えた時刻 + 静息時間 + 猶予（10分）までに、次の詠唱を始める。
// 途切れる条件: 猶予を過ぎて始めた、または25分未満で詠唱を終えた。

/** 同調が1つ高まる詠唱の長さ（分） */
export const COMBO_MIN_MINUTES = 25;

/** 静息が明けてから、次の詠唱を始めれば同調が続く猶予（分） */
export const COMBO_GRACE_MINUTES = 10;

/** 魔力に倍率が乗り始める同調数 */
export const COMBO_MP_FROM = 2;
/** 同調1つあたりの魔力の上乗せ（+10%）と、その上限（+50%） */
export const COMBO_MP_STEP = 0.1;
export const COMBO_MP_MAX = 0.5;

/** 流れ星の稀品以上の確率に補正が乗り始める同調数 */
export const COMBO_DROP_FROM = 3;
/** 同調1つあたりの、稀品以上の確率の上乗せ（+5%）と、その上限（+15%） */
export const COMBO_DROP_STEP = 0.05;
export const COMBO_DROP_MAX = 0.15;

/** 「星脈の調律師」の称号を授かる同調数 */
export const COMBO_TITLE_COUNT = 5;

export type ComboState = {
  /** いまの同調数（0 = 同調していない） */
  count: number;
  /** 同調を高めた最後の詠唱を終えた時刻（ms）。null なら同調していない */
  lastEndAt: number | null;
  /** その詠唱の後に取る静息の長さ（分） */
  breakMin: number;
  /** これまでの最長の同調数（称号の判定に使う） */
  best: number;
};

export const initialCombo = (): ComboState => ({ count: 0, lastEndAt: null, breakMin: 5, best: 0 });

const MINUTE = 60_000;

/** 静息が明ける時刻（ms）。同調していなければ null */
export function restEndsAt(state: ComboState): number | null {
  return state.lastEndAt === null ? null : state.lastEndAt + state.breakMin * MINUTE;
}

/** 次の詠唱をこの時刻までに始めれば同調が続く（ms）。同調していなければ null */
export function comboDeadline(state: ComboState): number | null {
  const end = restEndsAt(state);
  return end === null ? null : end + COMBO_GRACE_MINUTES * MINUTE;
}

/** いま詠唱を始めれば同調が続くか */
export function isComboAlive(state: ComboState, now = Date.now()): boolean {
  const deadline = comboDeadline(state);
  return state.count > 0 && deadline !== null && now <= deadline;
}

/** 詠唱を始めたとき: 猶予を過ぎていれば同調をほどく（最長記録は残す） */
export function comboOnStart(state: ComboState, now = Date.now()): ComboState {
  return isComboAlive(state, now) ? state : { ...state, count: 0, lastEndAt: null };
}

/**
 * 詠唱を終えたとき: 25分以上なら同調を1つ高め、静息の起点を終えた時刻にする。25分未満なら同調はほどける。
 * 始めたときに comboOnStart を通してあるので、ここでは猶予を見直さない
 */
export function comboOnFinish(
  state: ComboState,
  { minutes, endedAt, breakMin }: { minutes: number; endedAt: number; breakMin: number },
): ComboState {
  if (minutes < COMBO_MIN_MINUTES) return { ...state, count: 0, lastEndAt: null };
  const count = state.count + 1;
  return { count, lastEndAt: endedAt, breakMin, best: Math.max(state.best, count) };
}

/** 同調による魔力の倍率（2同調から +10% × 同調数、最大 +50%） */
export function comboMpMultiplier(count: number): number {
  if (count < COMBO_MP_FROM) return 1;
  return 1 + Math.min(COMBO_MP_MAX, COMBO_MP_STEP * count);
}

/** 同調による、流れ星の稀品以上（B/A/S）の確率の倍率（3同調から +5% ずつ、最大 +15%） */
export function comboDropBoost(count: number): number {
  if (count < COMBO_DROP_FROM) return 1;
  return 1 + Math.min(COMBO_DROP_MAX, COMBO_DROP_STEP * (count - COMBO_DROP_FROM + 1));
}

// ---- 静息の間の表示 ----

/**
 * 詠唱の間に出す同調の状態。
 * resting: 静息中（明けるまで）/ grace: 静息が明け、猶予のうち / none: 同調していない
 */
export type ComboView =
  | { kind: "none" }
  | { kind: "resting"; count: number; restLeftMs: number; graceLeftMs: number }
  | { kind: "grace"; count: number; graceLeftMs: number };

export function comboView(state: ComboState, now = Date.now()): ComboView {
  const restEnd = restEndsAt(state);
  const deadline = comboDeadline(state);
  if (!isComboAlive(state, now) || restEnd === null || deadline === null) return { kind: "none" };
  if (now < restEnd) return { kind: "resting", count: state.count, restLeftMs: restEnd - now, graceLeftMs: deadline - now };
  return { kind: "grace", count: state.count, graceLeftMs: deadline - now };
}

/** 残りの ms を「あと◯分」の分（切り上げ）にする */
export const minutesLeft = (ms: number) => Math.max(0, Math.ceil(ms / MINUTE));

// ---- 報せ ----

/** 静息が明けたときの報せ。端末の通知と、詠唱の間の一言に使う */
export type RestEndNotice = {
  kind: "restEnd";
  /** いまの同調数 */
  combo: number;
  /** 同調が続く期限（ms） */
  deadline: number;
  title: string;
  body: string;
};

/** 静息が明けた報せ。同調していない、または画面を閉じている間に猶予まで過ぎていたら null */
export function restEndNotice(state: ComboState, now = Date.now()): RestEndNotice | null {
  const deadline = comboDeadline(state);
  if (deadline === null || !isComboAlive(state, now)) return null;
  return {
    kind: "restEnd",
    combo: state.count,
    deadline,
    title: "静息が明けた",
    body: `あと${minutesLeft(deadline - now)}分のうちに次の詠唱を始めれば、星脈との同調（${state.count}連）が続く`,
  };
}
