"use client";

import { useEffect } from "react";
import { unlockedThemes } from "@/lib/cycles";
import { useStoredUserData } from "@/lib/user-store";

/** 設定の「UI の色調」（周天の章で開く）を <html data-chapter> に映し、globals.css で光の線の色を切り替える */
export function ChapterThemeSync() {
  const data = useStoredUserData();
  const theme = data?.settings.chapterTheme ?? "default";
  // 開いていない章の色調は使わない（バックアップの読み込みなどで食い違ったとき）
  const usable = data && unlockedThemes(data.cycle.count).includes(theme) ? theme : "default";

  useEffect(() => {
    if (usable === "default") document.documentElement.removeAttribute("data-chapter");
    else document.documentElement.setAttribute("data-chapter", usable);
  }, [usable]);

  return null;
}
