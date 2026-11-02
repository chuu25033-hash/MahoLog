import { describe, expect, it } from "vitest";
import { demoSubjects } from "../demo";
import { isCustomSubject, radarAxesOf, resolveSubSubject, ruleNameOf, subSubjectsOf, withCustomNames } from "../subjects";

describe("カスタム科目の名前", () => {
  it("付けた名前をカスタム科目にだけ当て、空ならカスタム1〜3のまま", () => {
    const named = withCustomNames(demoSubjects, { s7: " 行政書士 ", s8: "  ", s2: "上書きしない" });
    const nameOf = (id: string) => named.find((s) => s.id === id)?.name;
    expect(nameOf("s7")).toBe("行政書士");
    expect(nameOf("s8")).toBe("カスタム2");
    expect(nameOf("s9")).toBe("カスタム3");
    expect(nameOf("s2")).toBe("数学");
  });

  it("詠唱に使う科目を選ぶ前は、カスタム2・3を魔法陣の頂点にしない", () => {
    expect(radarAxesOf(demoSubjects, null).map((a) => a.key)).toEqual(["s1", "s2", "s3", "s4", "s5", "s6", "s7"]);
    expect(radarAxesOf(demoSubjects, ["s1", "s8", "s9"]).map((a) => a.key)).toEqual(["s1", "s8", "s9"]);
  });

  it("既存の科目と同じ名前を付けても、その科目の詳細科目や加護は引き継がない", () => {
    const [math] = withCustomNames(demoSubjects, { s7: "数学" }).filter((s) => s.id === "s7");
    expect(isCustomSubject(math)).toBe(true);
    expect(subSubjectsOf(math)).toEqual([]);
    expect(ruleNameOf(math)).toBe("カスタム");
    // カスタム科目は詳細科目を持たない（前に書いた詳細科目が残っていても外す）
    expect(resolveSubSubject(math, " 微分 ")).toBeNull();
  });
});
