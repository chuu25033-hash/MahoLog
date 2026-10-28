import { cn } from "@/lib/utils";

export function MpBar({ ratio, variant = "mp" }: { ratio: number; variant?: "mp" | "stage" }) {
  const percent = Math.min(100, Math.max(0, ratio * 100));
  return (
    <div
      className="relative h-1.5 w-full overflow-visible rounded-full bg-white/[0.06] ring-1 ring-white/10"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      <div
        className={cn(
          "relative h-full rounded-full transition-[width] duration-1000",
          variant === "mp"
            ? "bg-gradient-to-r from-amethyst/70 via-aqua/80 to-starlight shadow-[0_0_10px_rgba(113,226,239,0.45)]"
            : "bg-gradient-to-r from-aqua/50 to-aqua shadow-[0_0_10px_rgba(113,226,239,0.45)]",
        )}
        style={{ width: `${percent}%` }}
      >
        {/* 先端の星の輝き */}
        <span className="absolute top-1/2 right-0 size-1.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_8px_2px_rgba(226,235,255,0.8)]" />
      </div>
    </div>
  );
}
