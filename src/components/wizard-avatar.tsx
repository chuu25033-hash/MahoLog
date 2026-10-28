import { cn } from "@/lib/utils";

// プロフィールの avatar_url にはプリセットID（wizard-1 など）を保存する
export const WIZARD_AVATARS: Record<string, { emoji: string; bg: string }> = {
  "wizard-1": { emoji: "🧙", bg: "from-violet-500 to-indigo-700" },
  "wizard-2": { emoji: "🧙‍♀️", bg: "from-pink-500 to-fuchsia-700" },
  "wizard-3": { emoji: "🦉", bg: "from-amber-500 to-orange-700" },
  "wizard-4": { emoji: "🐈‍⬛", bg: "from-slate-500 to-slate-800" },
  "wizard-5": { emoji: "🐉", bg: "from-emerald-500 to-teal-700" },
};

export function WizardAvatar({ avatar, className }: { avatar: string; className?: string }) {
  const preset = WIZARD_AVATARS[avatar] ?? WIZARD_AVATARS["wizard-1"];
  return (
    <div
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-2xl ring-2 ring-primary/60",
        preset.bg,
        className,
      )}
      aria-hidden
    >
      {preset.emoji}
    </div>
  );
}
