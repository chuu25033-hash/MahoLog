import { Sparkles } from "lucide-react";

export function PageLoading() {
  return (
    <div className="flex h-full min-h-60 items-center justify-center gap-2 text-sm text-muted-foreground">
      <Sparkles className="size-4 animate-pulse text-primary" />
      魔力を読み込み中…
    </div>
  );
}
