import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { MagicCircle } from "@/components/magic-circle";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AuthForm } from "./auth-form";

export default function LoginPage() {
  if (!isSupabaseConfigured) redirect("/");

  return (
    <div className="grid h-dvh grid-cols-2 items-center gap-6 overflow-y-auto p-6">
      <div className="relative flex h-full items-center justify-center">
        <MagicCircle color="#c4b5fd" running intensity={0.4} className="absolute h-[90%] max-h-full" />
        <div className="relative text-center">
          <BookOpen className="mx-auto size-12 text-primary" />
          <h1 className="text-4xl font-extrabold tracking-wider text-primary">マホログ</h1>
          <p className="mt-2 text-sm text-muted-foreground">勉強時間を魔力に変えて、大魔法使いを目指そう</p>
        </div>
      </div>
      <AuthForm />
    </div>
  );
}
