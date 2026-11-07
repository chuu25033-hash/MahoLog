import { notFound } from "next/navigation";
import { EyecatchShort } from "@/components/trailer/eyecatch-short";

/** YouTube のブロックの合間に差し込むアイキャッチ「星見の湖」（撮影用、16:9・約5秒・「少女勉強中」、?text=rest で「少女休憩中」）。開発サーバーでだけ開ける */
export default function EyecatchShortPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <EyecatchShort />;
}
