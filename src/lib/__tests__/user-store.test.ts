import { describe, expect, it } from "vitest";
import { EDITABLE_CHANT_COUNT, editableChantIds, initialUserData, type UserData } from "../user-store";

function withChants(dates: string[]): UserData {
  const data = initialUserData();
  return {
    ...data,
    chantHistory: dates.map((date, i) => ({
      id: `c-${i}`,
      date,
      minutes: 25,
      subjectId: "s",
      mp: 25,
      stageId: "1-1",
      mode: "pomodoro" as const,
      catalystId: null,
      dropId: null,
    })),
  };
}

describe("科目を付け替えられる詠唱", () => {
  it("新しい方から決まった回数だけ", () => {
    // 履歴の並びではなく、詠唱を終えた日時で新しい方を選ぶ
    const data = withChants(["2026-11-10T10:00:00Z", "2026-11-14T10:00:00Z", "2026-11-12T10:00:00Z", "2026-11-13T10:00:00Z", "2026-11-11T10:00:00Z"]);
    const ids = editableChantIds(data);
    expect(ids.size).toBe(EDITABLE_CHANT_COUNT);
    expect([...ids].sort()).toEqual(["c-1", "c-2", "c-3"]);
  });

  it("詠唱が少なければそのすべて", () => {
    expect(editableChantIds(withChants(["2026-11-14T10:00:00Z"])).size).toBe(1);
  });
});
