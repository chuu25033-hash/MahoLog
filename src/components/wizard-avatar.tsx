import { AvatarGlyph, AvatarHalo } from "@/components/arcane-icons";
import { cn } from "@/lib/utils";

// プロフィールの avatar_url にはプリセットID（wizard-1 など）を保存する。紋章は arcane-icons のラインアートで描く
export const WIZARD_AVATARS: Record<string, { name: string; tint: string }> = {
  "wizard-1": { name: "星詠みの帽子", tint: "rgba(113, 226, 239, 0.28)" },
  "wizard-2": { name: "三日月と星", tint: "rgba(168, 130, 251, 0.3)" },
  "wizard-3": { name: "梟", tint: "rgba(226, 201, 116, 0.28)" },
  "wizard-4": { name: "黒猫", tint: "rgba(148, 163, 184, 0.25)" },
  "wizard-5": { name: "竜の瞳", tint: "rgba(110, 200, 170, 0.28)" },
};

export function WizardAvatar({ avatar, className }: { avatar: string; className?: string }) {
  const key = avatar in WIZARD_AVATARS ? avatar : "wizard-1";
  const preset = WIZARD_AVATARS[key];
  return (
    <div
      className={cn(
        "relative flex size-12 shrink-0 items-center justify-center rounded-full text-starlight ring-1 ring-starlight/50 shadow-[0_0_18px_-3px_rgba(226,201,116,0.55),inset_0_0_10px_-2px_rgba(226,201,116,0.35)]",
        className,
      )}
      style={{
        // 上から差す後光を、紋章の色味の上に重ねる
        background: `radial-gradient(ellipse 60% 45% at 50% 18%, rgba(255, 236, 170, 0.22), transparent 70%), radial-gradient(circle at 35% 30%, ${preset.tint}, rgba(10, 15, 30, 0.9) 75%)`,
      }}
      aria-hidden
    >
      {/* 外周の天球の後光 */}
      <span className="pointer-events-none absolute -inset-1.5">
        <AvatarHalo className="size-full" />
      </span>
      <AvatarGlyph avatar={key} className="size-[58%] drop-shadow-[0_0_5px_rgba(255,226,140,0.6)]" />
    </div>
  );
}
