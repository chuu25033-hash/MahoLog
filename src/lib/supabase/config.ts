export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const hasSupabase = Boolean(supabaseUrl && supabaseKey);

/**
 * メール認証で DB に勉強記録を持つモード（NEXT_PUBLIC_AUTH_MODE=email のときだけ）。
 * それ以外は端末の保存データで動かす（Supabase があれば観測者IDでクラウドへ同期する）
 */
export const isEmailAuthMode = hasSupabase && process.env.NEXT_PUBLIC_AUTH_MODE === "email";

/** 観測者IDで端末の保存データをクラウドへ同期できるか */
export const isCloudSyncEnabled = hasSupabase && !isEmailAuthMode;
