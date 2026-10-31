import { redirect } from "next/navigation";
import { ArcaneLogo } from "@/components/arcane-icons";
import { MagicCircle } from "@/components/magic-circle";
import { isEmailAuthMode } from "@/lib/supabase/config";
import { AuthForm } from "./auth-form";

export default function LoginPage() {
  if (!isEmailAuthMode) redirect("/dashboard");

  return (
    <div className="grid h-full grid-cols-2 items-center gap-6 scroll-area overflow-x-hidden p-6 portrait:grid-cols-1 portrait:content-start">
      <div className="relative flex h-full items-center justify-center portrait:h-72">
        <MagicCircle color="#a882fb" running intensity={0.4} className="absolute h-[90%] max-h-full opacity-80" />
        <div className="relative text-center">
          <ArcaneLogo className="mx-auto size-12 text-starlight drop-shadow-[0_0_8px_rgba(226,201,116,0.45)]" />
          <h1 className="mt-2 text-4xl tracking-[0.3em] text-starlight-gradient">マホログ</h1>
          <p className="font-display text-xs tracking-[0.5em] text-starlight/60">MAHOLOG</p>
          {/* iOS Safari は auto-phrase を解さないので、keep-all と <wbr> で文節の切れ目だけを折り返し点にする */}
          <p className="mt-3 text-sm tracking-wider text-balance text-muted-foreground [word-break:keep-all]">
            孤独な<wbr />世界の<wbr />奥地に<wbr />眠る<wbr />秘術を<wbr />解き明かし、<wbr />己の<wbr />実力を<wbr />高める<wbr />旅へ
          </p>
        </div>
      </div>
      <AuthForm />
    </div>
  );
}
