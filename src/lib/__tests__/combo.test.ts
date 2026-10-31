import { describe, expect, it } from "vitest";
import { AREAS } from "../areas";
import {
  comboDeadline,
  comboDropBoost,
  comboMpMultiplier,
  comboOnFinish,
  comboOnStart,
  comboView,
  initialCombo,
  isComboAlive,
  restEndNotice,
  type ComboState,
} from "../combo";
import { calculateFinalReward, METEOR_ORE_MAX, METEOR_ORE_MIN } from "../reward";

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 1, 10, 0);

/** 25分の詠唱を終え、静息 breakMin 分のあと wait 分たってから次を始める、を繰り返す */
function chain(times: number, { breakMin = 5, wait = 0, minutes = 25 } = {}) {
  let state: ComboState = initialCombo();
  let now = T0;
  for (let i = 0; i < times; i++) {
    state = comboOnStart(state, now);
    now += minutes * MIN;
    state = comboOnFinish(state, { minutes, endedAt: now, breakMin });
    now += (breakMin + wait) * MIN;
  }
  return { state, now };
}

describe("星脈との同調", () => {
  it("25分以上の詠唱を終えるごとに1つ高まる", () => {
    expect(chain(1).state.count).toBe(1);
    expect(chain(5).state.count).toBe(5);
    expect(chain(5).state.best).toBe(5);
  });

  it("静息が明けて10分のうちに始めれば続き、過ぎればほどける", () => {
    expect(chain(3, { wait: 10 }).state.count).toBe(3);
    expect(chain(3, { wait: 11 }).state.count).toBe(1);
  });

  it("静息を早めに切り上げて始めても続く", () => {
    const { state } = chain(1);
    const end = state.lastEndAt!;
    expect(comboOnStart(state, end + MIN).count).toBe(1);
  });

  it("25分未満で終えるとほどけるが、最長記録は残る", () => {
    const { state, now } = chain(4);
    const short = comboOnFinish(comboOnStart(state, now), { minutes: 24, endedAt: now + 24 * MIN, breakMin: 5 });
    expect(short.count).toBe(0);
    expect(short.lastEndAt).toBeNull();
    expect(short.best).toBe(4);
  });

  it("期限は 終えた時刻 + 静息 + 猶予10分", () => {
    const state = comboOnFinish(initialCombo(), { minutes: 25, endedAt: T0, breakMin: 10 });
    expect(comboDeadline(state)).toBe(T0 + 20 * MIN);
    expect(isComboAlive(state, T0 + 20 * MIN)).toBe(true);
    expect(isComboAlive(state, T0 + 20 * MIN + 1)).toBe(false);
  });

  it("画面を閉じていた間も時刻で測る（戻ったときに期限を過ぎていればほどける）", () => {
    const state = comboOnFinish(initialCombo(), { minutes: 50, endedAt: T0, breakMin: 5 });
    expect(comboOnStart(state, T0 + 3 * 60 * MIN).count).toBe(0);
  });

  it("静息中・猶予中の表示", () => {
    const state = comboOnFinish(initialCombo(), { minutes: 25, endedAt: T0, breakMin: 5 });
    expect(comboView(state, T0 + 2 * MIN)).toEqual({ kind: "resting", count: 1, restLeftMs: 3 * MIN, graceLeftMs: 13 * MIN });
    expect(comboView(state, T0 + 7 * MIN)).toEqual({ kind: "grace", count: 1, graceLeftMs: 8 * MIN });
    expect(comboView(state, T0 + 16 * MIN)).toEqual({ kind: "none" });
    expect(restEndNotice(state, T0 + 5 * MIN)?.deadline).toBe(T0 + 15 * MIN);
    expect(restEndNotice(state, T0 + 5 * MIN)?.body).toContain("あと10分");
    // 戻ったときに猶予まで過ぎていれば報せない
    expect(restEndNotice(state, T0 + 16 * MIN)).toBeNull();
    expect(restEndNotice(initialCombo(), T0)).toBeNull();
  });

  it("魔力の倍率: 2同調から +10% × 同調数、最大 +50%", () => {
    expect(comboMpMultiplier(0)).toBe(1);
    expect(comboMpMultiplier(1)).toBe(1);
    expect(comboMpMultiplier(2)).toBeCloseTo(1.2);
    expect(comboMpMultiplier(4)).toBeCloseTo(1.4);
    expect(comboMpMultiplier(5)).toBeCloseTo(1.5);
    expect(comboMpMultiplier(9)).toBeCloseTo(1.5);
  });

  it("稀品以上の確率の補正: 3同調から乗る", () => {
    expect(comboDropBoost(2)).toBe(1);
    expect(comboDropBoost(3)).toBeCloseTo(1.05);
    expect(comboDropBoost(5)).toBeCloseTo(1.15);
    expect(comboDropBoost(10)).toBeCloseTo(1.15);
  });
});

const area = AREAS.find((a) => a.id === "3-3")!;

describe("流星群の接近と最終的な授かり物", () => {
  it("30分未満では流星群は来ない", () => {
    const r = calculateFinalReward({ minutes: 29, baseMp: 29, combo: 1, area, random: () => 0 });
    expect(r.meteor).toBeNull();
    expect(r.ore).toBe(0);
  });

  it("30分以上で原石 2〜5 個が添えられ、流れ星の1つが秘宝以上になる", () => {
    for (const x of [0, 0.3, 0.6, 0.999]) {
      // 常品が引かれる乱数でも、流星群が秘宝以上へ引き上げる
      const r = calculateFinalReward({ minutes: 30, baseMp: 30, combo: 1, area, random: () => x });
      expect(r.meteor).not.toBeNull();
      expect(r.meteor!.ore).toBeGreaterThanOrEqual(METEOR_ORE_MIN);
      expect(r.meteor!.ore).toBeLessThanOrEqual(METEOR_ORE_MAX);
      expect(r.fall.items.some((i) => i.rarity === "A" || i.rarity === "S")).toBe(true);
      expect(r.fall.items).toHaveLength(1);
      expect(r.fall.byRarity.A + r.fall.byRarity.S).toBeGreaterThanOrEqual(1);
    }
  });

  it("流星群の原石は、区切りの原石に足される", () => {
    const r = calculateFinalReward({ minutes: 100, baseMp: 100, combo: 1, area, random: () => 0 });
    expect(r.ore).toBe(3 + r.meteor!.ore);
  });

  it("同調の倍率が魔力に乗り、5同調で称号に届く", () => {
    const r = calculateFinalReward({ minutes: 25, baseMp: 100, combo: 5, area });
    expect(r.mp).toBe(150);
    expect(r.comboTitle).toBe(true);
    expect(calculateFinalReward({ minutes: 25, baseMp: 100, combo: 4, area }).comboTitle).toBe(false);
  });
});
