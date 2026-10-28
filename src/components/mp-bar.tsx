import { cn } from "@/lib/utils";

export function MpBar({ ratio, variant = "mp" }: { ratio: number; variant?: "mp" | "stage" }) {
  const percent = Math.min(100, Math.max(0, ratio * 100));
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-black/40 ring-1 ring-primary/20"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-1000",
          variant === "mp"
            ? "bg-gradient-to-r from-violet-500 via-fuchsia-400 to-amber-300"
            : "bg-gradient-to-r from-sky-400 to-emerald-300",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
