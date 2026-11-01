"use client";

import { useObserver } from "./cloud-sync";

/**
 * 管理者の観測者ID。本番でも開発者ツール（全解放・サンプル・元に戻す）と、曲の試聴・書き出し（/music）を使える。
 * 観測者IDは名札で、記録を開く鍵（復元キー）はここに置かない。
 * 判定は端末の中だけで行い、変わるのはその端末の保存データと、見られる画面だけ（他の観測者の記録には触れない）
 */
const ADMIN_OBSERVER_IDS = new Set(["ML-ALAK-VH2H"]);

/**
 * この端末の観測者が管理者か（サーバー描画中・読み込み前は false）。
 * ID が一致するだけでなく、星界と一度でも同期できた端末に限る。新しい端末が偶然同じ ID を引いても、
 * 初めて預けるときに星界が「既にある記録」として断り（本当の持ち主の復元キーが要る）、ID を作り直すので、管理者にはならない。
 * 復元キーが作り直されて締め出された端末（locked）も外す
 */
export function useIsAdmin() {
  const observer = useObserver();
  return observer !== null && ADMIN_OBSERVER_IDS.has(observer.id) && observer.syncedAt !== null && observer.status !== "locked";
}
