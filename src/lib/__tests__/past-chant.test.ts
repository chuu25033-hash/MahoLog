import { beforeEach, describe, expect, it } from "vitest";
import { DAILY_LIMIT_MINUTES } from "../game";
import { jstDateKey } from "../date";
import { getUserData, initialUserData, replaceUserData, todayChantMinutes, userActions } from "../user-store";

// 2026-10-30 15:00 JST
const NOW = new Date("2026-10-30T06:00:00Z");
const subjects = [{ id: "math" }, { id: "eng" }, { id: "sci" }];

beforeEach(() => {
  replaceUserData(initialUserData());
});

function recordPast(minutes: number, daysAgo: number) {
  return userActions.recordPastChant({ minutes, subjectId: "math", subSubject: null, daysAgo }, NOW);
}

describe("計り忘れた詠唱を書き留める", () => {
  it("学んだ分だけ魔力が増え、書き留めた印が付く", () => {
    expect(recordPast(30, 0)).toBe(30);
    const data = getUserData();
    expect(data.userProfile.totalMp).toBe(30);
    expect(data.chantHistory).toHaveLength(1);
    expect(data.chantHistory[0]).toMatchObject({ minutes: 30, mp: 30, manual: true, dropId: null, catalystId: null });
  });

  it("過ぎた日は、その日の夜の記録として刻む", () => {
    recordPast(45, 2);
    const [record] = getUserData().chantHistory;
    expect(jstDateKey(new Date(record.date))).toBe("2026-10-28");
  });

  it("書き留められるのは6日前まで", () => {
    recordPast(10, 30);
    const [record] = getUserData().chantHistory;
    expect(jstDateKey(new Date(record.date))).toBe("2026-10-24");
  });

  it("その日の上限（12時間）を超える分は切り詰め、満ちていれば刻まない", () => {
    expect(recordPast(DAILY_LIMIT_MINUTES - 60, 1)).toBe(DAILY_LIMIT_MINUTES - 60);
    expect(recordPast(120, 1)).toBe(60);
    expect(recordPast(30, 1)).toBe(0);
    expect(todayChantMinutes(getUserData(), new Date("2026-10-29T12:00:00Z"))).toBe(DAILY_LIMIT_MINUTES);
    // 別の日には響かない
    expect(recordPast(30, 0)).toBe(30);
  });

  it("記録は日時の順に並ぶ", () => {
    recordPast(10, 0);
    recordPast(10, 3);
    const dates = getUserData().chantHistory.map((r) => r.date);
    expect(dates).toEqual([...dates].sort());
  });

  it("試練の達成には数えない", () => {
    recordPast(120, 0);
    userActions.syncTasks(subjects, NOW);
    const daily = getUserData().tasks.daily.items;
    expect(daily["d-focus"].progress).toBe(0);
  });
});
