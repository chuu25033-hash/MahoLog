import { notFound } from "next/navigation";
import { Trailer } from "@/components/trailer/trailer";

/** SNS 用の予告編（撮影用）。開発サーバーでだけ開ける */
export default function TrailerPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Trailer />;
}
