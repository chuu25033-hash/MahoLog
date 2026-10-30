-- =====================================================================
-- 観測者ID（OBSERVER ID）による簡易クラウド同期
--   端末の保存データ（localStorage の maholog_user_data）を、観測者ID（ML-XXXX-XXXX）に紐づけて預ける。
--   - ID そのものは保存せず、SHA-256 のハッシュだけを鍵にする（DB が漏れても ID は分からない）
--   - テーブルは RLS で直接の読み書きをすべて閉じ、下の関数（security definer）だけを入口にする
--   - 書き込みは楽観的排他: 端末が最後に見た更新時刻より新しい保存があれば conflict を返す
-- Supabase SQL Editor にそのまま貼り付けて実行できます。
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create table public.observer_saves (
  code_hash  text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.observer_saves enable row level security;
-- ポリシーは作らない（anon / authenticated からの直接アクセスはすべて拒否）

-- 観測者ID: ML- + 見間違えやすい文字（0/O, 1/I）を除いた 32 文字 × 4 桁 × 2
create or replace function public.observer_code_hash(code text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if code is null or code !~ '^ML-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$' then
    raise exception 'invalid observer code' using errcode = '22023';
  end if;
  return encode(extensions.digest(code, 'sha256'), 'hex');
end;
$$;

revoke execute on function public.observer_code_hash(text) from public, anon, authenticated;

-- 預けた保存データを取り出す（無ければ 0 行）
create or replace function public.observer_pull(code text)
returns table (data jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.data, s.updated_at
  from public.observer_saves s
  where s.code_hash = public.observer_code_hash(code);
$$;

-- 保存データを預ける。base_updated_at は端末が最後に見た更新時刻（初回は null）。
-- それより新しい保存が既にあれば（別端末が先に書いた／ID が重複した）何もせず conflict を返す
create or replace function public.observer_push(code text, payload jsonb, base_updated_at timestamptz)
returns table (status text, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  key text := public.observer_code_hash(code);
  current_at timestamptz;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'invalid payload' using errcode = '22023';
  end if;
  -- 1 つの保存は 2MB まで
  if pg_column_size(payload) > 2 * 1024 * 1024 then
    raise exception 'payload too large' using errcode = '54000';
  end if;

  select s.updated_at into current_at from public.observer_saves s where s.code_hash = key for update;

  if current_at is not null and (base_updated_at is null or current_at > base_updated_at) then
    return query select 'conflict'::text, current_at;
    return;
  end if;

  insert into public.observer_saves as s (code_hash, data, updated_at)
  values (key, payload, now())
  on conflict (code_hash) do update set data = excluded.data, updated_at = excluded.updated_at;

  return query select 'ok'::text, now();
end;
$$;

revoke execute on function public.observer_pull(text) from public;
revoke execute on function public.observer_push(text, jsonb, timestamptz) from public;
grant execute on function public.observer_pull(text) to anon, authenticated;
grant execute on function public.observer_push(text, jsonb, timestamptz) to anon, authenticated;
