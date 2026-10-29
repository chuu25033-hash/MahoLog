import { redirect } from "next/navigation";
import { ArcaneLogo } from "@/components/arcane-icons";
import { MagicCircle } from "@/components/magic-circle";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AuthForm } from "./auth-form";

export default function LoginPage() {
  if (!isSupabaseConfigured) redirect("/dashboard");

  return (
    <div className="grid h-dvh grid-cols-2 items-center gap-6 scroll-area overflow-x-hidden p-6">
      <div className="relative flex h-full items-center justify-center">
        <MagicCircle color="#a882fb" running intensity={0.4} className="absolute h-[90%] max-h-full opacity-80" />
        <div className="relative text-center">
          <ArcaneLogo className="mx-auto size-12 text-starlight drop-shadow-[0_0_8px_rgba(226,201,116,0.45)]" />
          <h1 className="mt-2 text-4xl tracking-[0.3em] text-starlight-gradient">マホログ</h1>
          <p className="font-display text-xs tracking-[0.5em] text-starlight/60">MAHOLOG</p>
          <p className="mt-3 text-sm tracking-wider text-muted-foreground">孤独な世界の奥地に眠る秘術を解き明かし、己の実力を高める旅へ</p>
        </div>
      </div>
      <AuthForm />
    </div>
  );
}
