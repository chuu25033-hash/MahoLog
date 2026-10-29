import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { MagicCircle } from "@/components/magic-circle";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AuthForm } from "./auth-form";

export default function LoginPage() {
  if (!isSupabaseConfigured) redirect("/dashboard");

  return (
    <div className="grid h-dvh grid-cols-2 items-center gap-6 overflow-y-auto p-6">
      <div className="relative flex h-full items-center justify-center">
        <MagicCircle color="#a882fb" running intensity={0.4} className="absolute h-[90%] max-h-full opacity-80" />
        <div className="relative text-center">
          <BookOpen className="mx-auto size-10 text-starlight" strokeWidth={1} />
          <h1 className="mt-2 text-4xl tracking-[0.3em] text-starlight-gradient">マホログ</h1>
          <p className="font-display text-xs tracking-[0.5em] text-starlight/60">MAHOLOG</p>
          <p className="mt-3 text-sm tracking-wider text-muted-foreground">孤独な世界の奥地に眠る秘術を解き明かし、己の実力を高める旅へ</p>
        </div>
      </div>
      <AuthForm />
    </div>
  );
}
