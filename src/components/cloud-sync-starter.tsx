"use client";

import { useEffect } from "react";
import { startCloudSync } from "@/lib/cloud-sync";

/** 観測者IDでのクラウド同期を、アプリを開いたときに一度だけ始める */
export function CloudSyncStarter() {
  useEffect(() => startCloudSync(), []);
  return null;
}
