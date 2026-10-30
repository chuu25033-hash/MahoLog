import { describe, expect, it } from "vitest";
import {
  generateObserverId,
  generateRecoveryKey,
  normalizeObserverId,
  normalizeRecoveryKey,
  preferRemote,
} from "../cloud-sync";
import { initialUserData, type UserData } from "../user-store";

function save(totalMp: number, chants: number): UserData {
  const data = initialUserData();
  return {
    ...data,
    userProfile: { ...data.userProfile, totalMp },
    chantHistory: Array.from({ length: chants }, (_, i) => ({
      id: `c-${i}`,
      date: new Date(0).toISOString(),
      minutes: 1,
      subjectId: "s",
      mp: 1,
      stageId: "1",
      mode: "pomodoro" as const,
      catalystId: null,
      dropId: null,
    })),
  };
}

describe("両方の端末で進んでいたときの選び方", () => {
  it("累積MPが多い方を残す", () => {
    expect(preferRemote(save(100, 5), save(200, 1))).toBe(true);
    expect(preferRemote(save(200, 1), save(100, 5))).toBe(false);
  });

  it("累積MPが同じなら、詠唱の記録が多い方を残す", () => {
    expect(preferRemote(save(100, 2), save(100, 3))).toBe(true);
    expect(preferRemote(save(100, 3), save(100, 2))).toBe(false);
  });

  it("どちらも同じならクラウドを残す", () => {
    expect(preferRemote(save(100, 3), save(100, 3))).toBe(true);
  });

  it("形の崩れたクラウドの記録は空として扱う", () => {
    expect(preferRemote(save(1, 0), null)).toBe(false);
  });
});

describe("観測者IDと復元キーの入力", () => {
  it("小文字・区切りの有無・ML の有無を問わず読める", () => {
    expect(normalizeObserverId("ml-abcd-efgh")).toBe("ML-ABCD-EFGH");
    expect(normalizeObserverId("abcdefgh")).toBe("ML-ABCD-EFGH");
    expect(normalizeObserverId(" ML ABCD EFGH ")).toBe("ML-ABCD-EFGH");
    expect(normalizeRecoveryKey("abcd efgh jkmn pqrs tuvw")).toBe("ABCD-EFGH-JKMN-PQRS-TUVW");
  });

  it("使わない文字（0 / 1 / O / I）や長さ違いは弾く", () => {
    expect(normalizeObserverId("ML-ABCD-EFG0")).toBeNull();
    expect(normalizeObserverId("ML-ABCD-EFG")).toBeNull();
    expect(normalizeRecoveryKey("ABCD-EFGH-JKMN-PQRS-TUVI")).toBeNull();
  });

  it("発行したIDとキーは、そのまま読み直せる", () => {
    for (let i = 0; i < 100; i++) {
      const id = generateObserverId();
      const key = generateRecoveryKey();
      expect(normalizeObserverId(id)).toBe(id);
      expect(normalizeRecoveryKey(key)).toBe(key);
    }
  });
});
