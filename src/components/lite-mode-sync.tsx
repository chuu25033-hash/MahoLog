"use client";

import { useEffect } from "react";
import { useStoredUserData } from "@/lib/user-store";

/** 設定の「演出の軽量化」を <html data-lite> に映し、globals.css で粒子・アニメーションを抑える */
export function LiteModeSync() {
  const liteMode = useStoredUserData()?.settings.liteMode ?? false;

  useEffect(() => {
    document.documentElement.toggleAttribute("data-lite", liteMode);
  }, [liteMode]);

  return null;
}
