import { ArcaneLogo } from "@/components/arcane-icons";

export function PageLoading() {
  return (
    <div className="flex h-full min-h-60 items-center justify-center gap-2 text-sm tracking-widest text-muted-foreground">
      <ArcaneLogo className="glimmer size-5 text-aqua" />
      星の記憶を読み込み中…
    </div>
  );
}
