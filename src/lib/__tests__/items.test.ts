import { describe, expect, it } from "vitest";
import { GLYPHS } from "../glyphs";
import { AREAS, ZENITH_AREA } from "../areas";
import { ZENITH_MILESTONES } from "../cycles";
import { ALL_ITEMS, DOCUMENTS, FRAGMENTS, LORES, MEMORIES, STARDUST_ORE, dropPool, fillCoda, type FragmentItem } from "../items";

const glyphOf = new Map<string, string>(Object.entries(GLYPHS).map(([name, path]) => [path, name]));

describe("アイテムの絵柄", () => {
  it("すべてのアイテムに、用意された絵柄が付いている", () => {
    for (const item of [...ALL_ITEMS, ...FRAGMENTS, ...MEMORIES, STARDUST_ORE]) {
      expect(glyphOf.has(item.svgIcon), `${item.name} の絵柄`).toBe(true);
    }
  });

  it("伝承の品は、エリアごとに違う絵柄で描かれる", () => {
    const glyphs = LORES.map((lore) => glyphOf.get(lore.svgIcon));
    expect(new Set(glyphs).size).toBe(LORES.length);
  });
});

describe("星天の塔の古代文書『余白の原典』", () => {
  const zenithFragments = FRAGMENTS.filter((f) => f.zenithFloor !== undefined);

  it("4葉とも塔の節目で授かり、流れ星からは降らない", () => {
    expect(zenithFragments.map((f) => f.zenithFloor)).toEqual([25, 50, 75, 100]);
    for (const f of zenithFragments) {
      expect(ZENITH_MILESTONES.find((m) => m.floor === f.zenithFloor)?.rewards).toContain(f.id);
    }
    for (const area of [...AREAS, ZENITH_AREA]) {
      expect(dropPool(area).B.some((item) => zenithFragments.includes(item as FragmentItem))).toBe(false);
    }
  });

  it("秘された結びに、読む人の名前と累計詠唱時間が入る", () => {
    const doc = DOCUMENTS.find((d) => d.zenithFloors)!;
    const coda = fillCoda(doc.coda, "ユウ", 1000 * 60 + 5);
    expect(coda).toContain("観測者 ユウ、1000時間5分の刻");
    expect(coda).not.toMatch(/\{\w+\}/);
  });
});
