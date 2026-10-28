export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** 環境変数が未設定ならデモモード（認証なし・サンプルデータ）で動かす */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
