import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** 戻り先は同じサイトの中だけ（外部のサイトへ飛ばされないようにする） */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

/**
 * Google でのログインから戻ってきたところ。受け取ったコードをログインの情報（cookie）に換えて、元の画面へ戻す。
 * 端末の記録とアカウントの記録の突き合わせは、戻った先の画面でクラウド同期が行う
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  // 途中でやめた・期限が切れたなど: 元の画面へ戻し、ログインできなかったことを知らせる
  const url = new URL(next, origin);
  url.searchParams.set("login", "failed");
  return NextResponse.redirect(url);
}
