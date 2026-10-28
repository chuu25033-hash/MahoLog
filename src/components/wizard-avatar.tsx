import { cn } from "@/lib/utils";

// プロフィールの avatar_url にはプリセットID（wizard-1 など）を保存する
export const WIZARD_AVATARS: Record<string, { emoji: string; tint: string }> = {
  "wizard-1": { emoji: "🧙", tint: "rgba(113, 226, 239, 0.28)" },
  "wizard-2": { emoji: "🧙‍♀️", tint: "rgba(168, 130, 251, 0.3)" },
  "wizard-3": { emoji: "🦉", tint: "rgba(226, 201, 116, 0.28)" },
  "wizard-4": { emoji: "🐈‍⬛", tint: "rgba(148, 163, 184, 0.25)" },
  "wizard-5": { emoji: "🐉", tint: "rgba(110, 200, 170, 0.28)" },
};

export function WizardAvatar({ avatar, className }: { avatar: string; className?: string }) {
  const preset = WIZARD_AVATARS[avatar] ?? WIZARD_AVATARS["wizard-1"];
  return (
    <div
      className={cn(
        "relative flex size-12 shrink-0 items-center justify-center rounded-full text-2xl ring-1 ring-starlight/50 shadow-[0_0_16px_-4px_rgba(226,201,116,0.5)]",
        className,
      )}
      style={{ background: `radial-gradient(circle at 35% 30%, ${preset.tint}, rgba(10, 15, 30, 0.9) 75%)` }}
      aria-hidden
    >
      {/* 外周の天球リング */}
      <span className="absolute -inset-1 rounded-full border border-dashed border-starlight/25" />
      {preset.emoji}
    </div>
  );
}
