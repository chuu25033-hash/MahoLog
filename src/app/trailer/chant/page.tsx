import { notFound } from "next/navigation";
import { ChantShort } from "@/components/trailer/chant-short";

/** TikTok T02「25分勉強すると、こうなる。」（撮影用）。開発サーバーでだけ開ける */
export default function ChantShortPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ChantShort />;
}
