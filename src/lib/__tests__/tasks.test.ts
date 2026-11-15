import { describe, expect, it } from "vitest";
import { TASKS, measureTask } from "../tasks";
import type { ChantRecord } from "../user-store";

const task = (id: string) => TASKS.find((t) => t.id === id)!;

function chant(date: string, minutes: number): ChantRecord {
  return { id: date, date, minutes, subjectId: "s", mp: minutes, stageId: "1-1", mode: "pomodoro", catalystId: null, dropId: null };
}

// 2026-11-16（月）の JST 夜
const now = new Date("2026-11-16T12:00:00Z");
const context = (history: ChantRecord[]) => ({ history, activeSubjectIds: ["s"], mainSubjectId: "s", guidanceClaimed: true, now });

describe("試練の魔力", () => {
  it("1日25分の詠唱で満たせる魔力の試練は、その週の詠唱の MP より大きくなりすぎない", () => {
    // 毎日25分の詠唱で、日課（訪れ・集束）を7日、週の試練（積鑽・継続の印）を1度ずつ満たしたとき
    const mp = (id: string) => {
      const reward = task(id).reward;
      return reward.kind === "mp" ? reward.mp : 0;
    };
    const trialMp = (mp("d-visit") + mp("d-focus")) * 7 + mp("w-total") + mp("w-days");
    expect(trialMp).toBeLessThanOrEqual(25 * 7 * 2);
  });

  it("秘術の集束は、その日の詠唱の合計で測る", () => {
    const state = measureTask(task("d-focus"), context([chant("2026-11-16T10:00:00Z", 10), chant("2026-11-16T11:00:00Z", 15)]));
    expect(state.progress).toBe(25);
  });

  it("前の日の詠唱は日課に数えない", () => {
    const state = measureTask(task("d-focus"), context([chant("2026-11-15T10:00:00Z", 60)]));
    expect(state.progress).toBe(0);
  });
});
