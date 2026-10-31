import { beforeEach, describe, expect, it } from "vitest";
import { AREAS } from "../areas";
import { ACHIEVEMENT_TITLES, checkUnlockedTitles, titleProgressMap, type ChantFact, type UserStats, type UserTitleState } from "../titles";
import { equippedTitle, getUserData, initialUserData, replaceUserData, titleStatsOf, userActions } from "../user-store";

const tally = { found: 0, total: 10 };
const EMPTY: UserStats = {
  chants: [],
  documents: { found: 0, total: 6 },
  dissolved: 0,
  rarity: { SS: tally, S: tally, A: tally, B: tally, C: tally },
  codex: { found: 0, total: 100 },
};
const NONE: UserTitleState = { unlocked: {}, equippedId: null };

/** JST の日時（"2026-10-30T23:00"）に終えた詠唱 */
function chant(jst: string, minutes = 30, extra: Partial<ChantFact> = {}): ChantFact {
  return { endedAt: new Date(`${jst}:00+09:00`).toISOString(), minutes, areaId: "1-1", subjectId: "math", mode: "stopwatch", ...extra };
}

const unlocked = (stats: Partial<UserStats>, state = NONE) => checkUnlockedTitles({ ...EMPTY, ...stats }, state);

describe("称号の一覧", () => {
  it("IDが重ならず、星天の塔の称号とも重ならない", () => {
    const ids = ACHIEVEMENT_TITLES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("ach-"))).toBe(true);
  });

  it("各カテゴリーに数十の称号がある", () => {
    expect(ACHIEVEMENT_TITLES.length).toBeGreaterThanOrEqual(100);
    for (const category of ["continuous", "area", "concentration", "collection"]) {
      expect(ACHIEVEMENT_TITLES.filter((t) => t.category === category).length).toBeGreaterThanOrEqual(15);
    }
  });

  it("すべてのエリアに 10/50/100 回の周回の称号がある", () => {
    for (const area of AREAS) {
      for (const count of [10, 50, 100]) expect(ACHIEVEMENT_TITLES.some((t) => t.id === `ach-area-${area.id}-${count}`)).toBe(true);
    }
  });
});

describe("称号の解放判定", () => {
  it("記録が無ければ何も解放されない", () => {
    expect(unlocked({})).toEqual([]);
  });

  it("1分以上の詠唱を1回終えると『はじめての詠唱』", () => {
    expect(unlocked({ chants: [chant("2026-10-30T12:30", 1)] })).toContain("ach-first-chant");
    expect(unlocked({ chants: [chant("2026-10-30T12:30", 0)] })).not.toContain("ach-first-chant");
  });

  it("解放済みの称号は返さない", () => {
    const stats = { chants: [chant("2026-10-30T12:30")] };
    expect(unlocked(stats, { unlocked: { "ach-first-chant": "2026-10-30T03:30:00.000Z" }, equippedId: null })).not.toContain("ach-first-chant");
  });

  it("連続日数は日本時間の日付で数え、途切れたら数え直す", () => {
    // 0:30 JST は前日の UTC だが、日本時間では翌日
    const week = ["2026-10-01T00:30", "2026-10-02T23:30", "2026-10-03T12:00", "2026-10-04T12:00", "2026-10-05T12:00", "2026-10-06T12:00", "2026-10-07T12:00"];
    expect(unlocked({ chants: week.map((d) => chant(d)) })).toContain("ach-streak-7");
    const broken = week.filter((d) => !d.startsWith("2026-10-04"));
    expect(unlocked({ chants: broken.map((d) => chant(d)) })).not.toContain("ach-streak-7");
  });

  it("深夜（22:00〜4:00）に10回終えると『深夜の天体観測』", () => {
    const nights = Array.from({ length: 10 }, (_, i) => chant(`2026-10-${String(i + 1).padStart(2, "0")}T${i % 2 ? "23:30" : "03:30"}`));
    expect(unlocked({ chants: nights })).toContain("ach-night-10");
    const evenings = nights.map((c) => ({ ...c, endedAt: new Date(new Date(c.endedAt).getTime() - 5 * 3600_000).toISOString() }));
    expect(unlocked({ chants: evenings })).not.toContain("ach-night-10");
  });

  it("律動の詠唱できっかり25分を4回終えた日があると『四つの律動』", () => {
    const sets = ["09:00", "10:00", "11:00", "12:00"].map((t) => chant(`2026-10-30T${t}`, 25, { mode: "pomodoro" }));
    expect(unlocked({ chants: sets })).toContain("ach-pomodoro-day-4");
    expect(unlocked({ chants: sets.map((c) => ({ ...c, minutes: 26 })) })).not.toContain("ach-pomodoro-day-4");
  });

  it("STAGE 6 の全エリアで各10回詠唱すると『天空を統べる足跡』", () => {
    const chants = ["6-1", "6-2", "6-3"].flatMap((areaId) => Array.from({ length: 10 }, () => chant("2026-10-30T20:00", 30, { areaId })));
    expect(unlocked({ chants })).toContain("ach-stage-6-every-10");
    expect(unlocked({ chants: chants.slice(1) })).not.toContain("ach-stage-6-every-10");
  });

  it("ひとつのステージに偏って通うと『一つ所を愛する者』", () => {
    const home = Array.from({ length: 100 }, () => chant("2026-10-30T20:00", 30, { areaId: "2-3" }));
    const away = Array.from({ length: 50 }, () => chant("2026-10-30T20:00", 30, { areaId: "4-1" }));
    expect(unlocked({ chants: home })).toContain("ach-favored-stage");
    expect(unlocked({ chants: [...home, ...away] })).not.toContain("ach-favored-stage");
  });

  it("図鑑・錬成の記録で解放される", () => {
    const ids = unlocked({
      documents: { found: 6, total: 6 },
      dissolved: 50,
      rarity: { ...EMPTY.rarity, S: { found: 1, total: 4 }, C: { found: 10, total: 10 } },
      codex: { found: 100, total: 100 },
    });
    expect(ids).toEqual(
      expect.arrayContaining(["ach-restored-1", "ach-restored-all", "ach-dissolved-50", "ach-found-s-1", "ach-complete-c", "ach-codex-100"]),
    );
    expect(ids).not.toContain("ach-complete-s");
  });

  it("進捗は目標で頭打ちになる", () => {
    const progress = titleProgressMap({ ...EMPTY, dissolved: 70 });
    expect(progress.get("ach-dissolved-50")).toEqual({ current: 50, target: 50, met: true });
    expect(progress.get("ach-dissolved-100")).toEqual({ current: 70, target: 100, met: false });
  });
});

describe("保存データとの連携", () => {
  beforeEach(() => {
    replaceUserData(initialUserData());
  });

  const record = { minutes: 30, subjectId: "math", mp: 30, stageId: "1-1", mode: "stopwatch" as const, catalystId: null, dropId: null };

  it("詠唱を終えると称号が解放され、掲げられる", () => {
    userActions.recordChant(record);
    expect(getUserData().titles.unlocked).toHaveProperty("ach-first-chant");
    userActions.setTitle("ach-first-chant");
    expect(equippedTitle(getUserData())?.name).toBe("はじめての詠唱");
  });

  it("解放した称号は告げるまで未告知に残り、告げたら外れる", () => {
    userActions.recordChant(record);
    expect(getUserData().titles.unseen).toContain("ach-first-chant");
    userActions.markTitlesSeen(["ach-first-chant"]);
    expect(getUserData().titles.unseen).not.toContain("ach-first-chant");
    // 一度告げた称号は、次の詠唱で告げ直さない
    userActions.recordChant(record);
    expect(getUserData().titles.unseen).not.toContain("ach-first-chant");
  });

  it("まだ解放していない称号は掲げても表示されない", () => {
    userActions.setTitle("ach-chants-1000");
    expect(equippedTitle(getUserData())).toBeNull();
  });

  it("後から書き留めた記録は称号に数えない", () => {
    userActions.recordPastChant({ minutes: 30, subjectId: "math", subSubject: null, daysAgo: 0 });
    expect(titleStatsOf(getUserData()).chants).toHaveLength(0);
    expect(getUserData().titles.unlocked).not.toHaveProperty("ach-first-chant");
  });
});
