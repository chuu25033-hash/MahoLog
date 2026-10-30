import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isCloudSyncEnabled, isEmailAuthMode, supabaseKey, supabaseUrl } from "./config";

// "/" はタイトル画面（誰でも閲覧可）
const LANDING_PATH = "/";
const AUTH_PATHS = ["/login"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Supabase 未接続（デモモード）では何もしない
  if (!isEmailAuthMode && !isCloudSyncEnabled) return response;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // ログインの期限が近ければここで更新する（cookie の書き換えは setAll が担う）
  const { data } = await supabase.auth.getClaims();
  // Google ログイン（クラウド同期）はログインしなくても使えるので、画面の行き来は制限しない
  if (!isEmailAuthMode) return response;
  const { pathname } = request.nextUrl;
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  if (!data?.claims && !isAuthPage && pathname !== LANDING_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (data?.claims && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
