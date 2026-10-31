import { describe, expect, it } from "vitest";
import { AREAS, ZENITH_AREA } from "../areas";
import { boostedRates, calculateItemDrops, dropTierOf, DROP_TIERS } from "../drops";

const area = AREAS.find((a) => a.id === "3-3")!;

/** 決まった値を順に返す乱数 */
function sequence(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("流れ星の区切り", () => {
  it.each([
    [0, 0],
    [24, 0],
    [25, 1],
    [49, 1],
    [50, 2],
    [74, 2],
    [75, 3],
    [99, 3],
    [100, 4],
    [120, 4],
    [600, 4],
  ])("%i分の詠唱では %i つ降る", (minutes, slots) => {
    expect(dropTierOf(minutes)?.slots ?? 0).toBe(slots);
    expect(calculateItemDrops(minutes, { area }).items).toHaveLength(slots);
  });

  it("25分未満は何も降らず、原石も添えられない", () => {
    expect(calculateItemDrops(24, { area })).toEqual({ tier: null, items: [], byRarity: { C: 0, B: 0, A: 0, S: 0 }, ore: 0, echo: 0 });
  });

  it("75分で原石1つ、100分以降で原石3つが添えられる", () => {
    expect(calculateItemDrops(50, { area }).ore).toBe(0);
    expect(calculateItemDrops(75, { area }).ore).toBe(1);
    expect(calculateItemDrops(100, { area }).ore).toBe(3);
    expect(calculateItemDrops(180, { area }).ore).toBe(3);
  });

  it("どの区切りも確率の合計は 100%", () => {
    for (const tier of DROP_TIERS) {
      expect(Object.values(tier.rates).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    }
  });
});

describe("星の余韻", () => {
  it("端数は余韻として残り、次の詠唱に足される", () => {
    const first = calculateItemDrops(60, { area });
    expect([first.items.length, first.echo]).toEqual([2, 10]);
    const second = calculateItemDrops(60, { area, echo: first.echo });
    expect([second.items.length, second.echo]).toEqual([2, 20]);
    const third = calculateItemDrops(60, { area, echo: second.echo });
    expect([third.items.length, third.echo]).toEqual([3, 5]);
  });

  it("60分を5回続けると、25分を12回続けたのと同じ数が降る", () => {
    let echo = 0;
    let total = 0;
    for (let i = 0; i < 5; i++) {
      const r = calculateItemDrops(60, { area, echo });
      echo = r.echo;
      total += r.items.length;
    }
    expect(total).toBe(12);
  });

  it("25分未満の詠唱は余韻を増やさず、減らしもしない", () => {
    expect(calculateItemDrops(24, { area, echo: 20 }).echo).toBe(20);
    expect(calculateItemDrops(24, { area, echo: 20 }).items).toHaveLength(0);
  });

  it("余韻で枠が増えても、確率・原石は詠唱時間の区切りのまま", () => {
    const r = calculateItemDrops(60, { area, echo: 20 });
    expect(r.items).toHaveLength(3);
    expect(r.tier?.minMinutes).toBe(50);
    expect(r.ore).toBe(0);
  });

  it("4つを越える分は降らず、余韻も24分までしか残らない", () => {
    const r = calculateItemDrops(200, { area, echo: 24 });
    expect(r.items).toHaveLength(4);
    expect(r.echo).toBe(24);
  });
});

describe("レア度の抽選", () => {
  it("乱数が小さいほど常品、大きいほど至宝になる", () => {
    expect(calculateItemDrops(25, { area, random: () => 0 }).byRarity.C).toBe(1);
    expect(calculateItemDrops(25, { area, random: () => 0.9999 }).byRarity.S).toBe(1);
  });

  it("100分以降は、常品を引く乱数でも最後の1枠が稀品以上になる", () => {
    const { items, byRarity } = calculateItemDrops(100, { area, random: () => 0 });
    expect(byRarity).toEqual({ C: 3, B: 1, A: 0, S: 0 });
    expect(items[3].rarity).toBe("B");
  });

  it("確定枠を何度引いても常品は出ない", () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 500; i++) {
      expect(calculateItemDrops(100, { area, random }).items[3].rarity).not.toBe("C");
    }
  });

  it("品の無いレア度は引かれない（星天の塔には稀品が無い）", () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 200; i++) {
      expect(calculateItemDrops(100, { area: ZENITH_AREA, random }).byRarity.B).toBe(0);
    }
  });

  it("降る品は引いたレア度のもの", () => {
    const { items, byRarity } = calculateItemDrops(100, { area, random: sequence(0.5, 0.3, 0.95, 0.1, 0.7, 0.2, 0.99, 0.4) });
    for (const r of ["C", "B", "A", "S"] as const) {
      expect(items.filter((item) => item.rarity === r)).toHaveLength(byRarity[r]);
    }
  });
});

describe("秘宝の加護", () => {
  it("稀品以上を倍率どおりに上げ、その分だけ常品を減らす", () => {
    const rates = boostedRates({ C: 85, B: 12, A: 2.9, S: 0.1 }, 1.4);
    expect(rates.B).toBeCloseTo(16.8);
    expect(rates.A).toBeCloseTo(4.06);
    expect(rates.S).toBeCloseTo(0.14);
    expect(rates.C).toBeCloseTo(79);
  });

  it("稀品以上が 100% を超えるときは比を保って縮め、常品は 0 になる", () => {
    const rates = boostedRates({ C: 40, B: 30, A: 20, S: 10 }, 2);
    expect(rates.C).toBe(0);
    expect(rates.B + rates.A + rates.S).toBeCloseTo(100);
    expect(rates.B / rates.S).toBeCloseTo(3);
  });
});
