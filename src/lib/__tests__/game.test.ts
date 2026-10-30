import { describe, expect, it } from "vitest";
import { calcLevel, levelProgress, levelThreshold } from "../game";

/** supabase/migrations/20261028000000_init.sql の public.calc_level を写したもの（整数の割り算は切り捨て） */
function sqlCalcLevel(total: number) {
  if (total < 600) return Math.max(1, Math.trunc(total / 60));
  if (total < 3000) return 10 + Math.trunc((total - 600) / 120);
  return 30 + Math.trunc((total - 3000) / 180);
}

describe("レベル計算", () => {
  it("DB の calc_level と同じ値を返す", () => {
    for (let mp = 0; mp <= 20_000; mp++) expect(calcLevel(mp)).toBe(sqlCalcLevel(mp));
  });

  it("各レベルに必要な累積MPちょうどで、そのレベルに上がる", () => {
    for (let level = 2; level <= 200; level++) {
      expect(calcLevel(levelThreshold(level))).toBe(level);
      expect(calcLevel(levelThreshold(level) - 1)).toBe(level - 1);
    }
  });

  it("次のレベルまでの進み具合は 0 以上 1 未満", () => {
    for (let mp = 0; mp <= 10_000; mp += 7) {
      const p = levelProgress(mp);
      expect(p.ratio).toBeGreaterThanOrEqual(0);
      expect(p.ratio).toBeLessThan(1);
      expect(p.current + p.remaining).toBe(p.required);
    }
  });
});
