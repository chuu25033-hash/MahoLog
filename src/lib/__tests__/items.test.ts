import { describe, expect, it } from "vitest";
import { GLYPHS } from "../glyphs";
import { ALL_ITEMS, FRAGMENTS, LORES, MEMORIES, STARDUST_ORE } from "../items";

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
