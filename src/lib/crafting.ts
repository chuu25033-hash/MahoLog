// 古代文書の復元と、遺物の錬成（還元・神話遺物の錬成）の判定。
// 所持数は保存データの inventory に持つ（星屑の原石・断片・復元した文書もアイテムとして数える）。
import {
  ALL_ITEMS,
  DOCUMENTS,
  FRAGMENTS,
  MEMORIES,
  STARDUST_ORE,
  findItem,
  type FragmentItem,
  type Item,
  type MemoryItem,
  type RelicItem,
} from "./items";
import type { UserData } from "./user-store";

const countOf = (data: UserData, id: string) => data.inventory[id] ?? 0;

export function fragmentsOf(documentId: string): FragmentItem[] {
  return FRAGMENTS.filter((f) => f.documentId === documentId);
}

export function memoryOf(documentId: string): MemoryItem {
  return MEMORIES.find((m) => m.documentId === documentId)!;
}

export function isRestored(data: UserData, documentId: string) {
  return countOf(data, memoryOf(documentId).id) > 0;
}

/** 4葉の断片がすべて手元にあり、まだ復元していなければ復元できる */
export function canRestore(data: UserData, documentId: string) {
  return !isRestored(data, documentId) && fragmentsOf(documentId).every((f) => countOf(data, f.id) > 0);
}

export function restoredCount(data: UserData) {
  return DOCUMENTS.filter((d) => isRestored(data, d.id)).length;
}

export function oreCount(data: UserData) {
  return countOf(data, STARDUST_ORE.id);
}

/** 1つ還元したときに得る星屑の原石の数（還元できないものは 0） */
export function dissolveValue(item: Item): number {
  switch (item.kind) {
    case "catalyst":
      // 触媒は倍率が高いほど多くの原石になる
      if (item.multiplier >= 2) return 6;
      if (item.multiplier >= 1.8) return 5;
      if (item.multiplier >= 1.5) return 3;
      if (item.multiplier >= 1.3) return 2;
      return 1;
    case "fragment":
      return 2;
    case "lore":
      return 1;
    case "skin":
      return 6;
    case "relic":
      return item.rarity === "S" ? 20 : item.rarity === "A" ? 8 : 0;
    default:
      return 0;
  }
}

/**
 * 還元できる数。触媒は消耗品なのですべて、ほかは図鑑に残す1つを除いた余剰だけ。
 * 断片は、まだ復元していない文書なら1葉ずつ手元に残す
 */
export function surplusCount(data: UserData, item: Item): number {
  if (dissolveValue(item) === 0) return 0;
  const count = countOf(data, item.id);
  if (item.kind === "catalyst") return count;
  if (item.kind === "fragment" && isRestored(data, item.documentId)) return count;
  return Math.max(0, count - 1);
}

/** 還元できるものの一覧（余剰があるものだけ） */
export function dissolvables(data: UserData): { item: Item; count: number; value: number }[] {
  return [...ALL_ITEMS, ...FRAGMENTS]
    .map((item) => ({ item, count: surplusCount(data, item), value: dissolveValue(item) }))
    .filter((d) => d.count > 0);
}

/** 錬成に捧げる秘宝 */
export function recipeRelics(mythic: RelicItem): RelicItem[] {
  return (mythic.recipe?.relics ?? []).map((id) => findItem(id)).filter((i): i is RelicItem => i?.kind === "relic");
}

/** 原石が足り、捧げる秘宝をすべて所持していて、まだ錬成していなければ錬成できる */
export function canCraft(data: UserData, mythic: RelicItem) {
  if (!mythic.recipe || countOf(data, mythic.id) > 0) return false;
  return oreCount(data) >= mythic.recipe.ore && mythic.recipe.relics.every((id) => countOf(data, id) > 0);
}
