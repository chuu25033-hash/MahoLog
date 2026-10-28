import { Sparkles } from "lucide-react";

export function PageLoading() {
  return (
    <div className="flex h-full min-h-60 items-center justify-center gap-2 text-sm tracking-widest text-muted-foreground">
      <Sparkles className="glimmer size-4 text-aqua" strokeWidth={1.25} />
      星の記憶を読み込み中…
    </div>
  );
}
