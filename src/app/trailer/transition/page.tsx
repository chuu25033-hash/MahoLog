import { notFound } from "next/navigation";
import { TransitionShort } from "@/components/trailer/transition-short";

/** YouTube 用の画面転換素材「星の帳」（撮影用、16:9・約5秒）。?text=start / girl で文字入り。開発サーバーでだけ開ける */
export default function TransitionShortPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <TransitionShort />;
}
