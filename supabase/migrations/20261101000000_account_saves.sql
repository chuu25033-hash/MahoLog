-- =====================================================================
-- Google ログインしたアカウントによるクラウド同期
--   端末の保存データ（localStorage の maholog_user_data）を、ログインしたアカウント（auth.users）に紐づけて預ける。
--   - 観測者ID（observer_saves）と同じく、テーブルは RLS で直接の読み書きをすべて閉じ、下の関数だけを入口にする
--   - 関数は auth.uid() の行だけを読み書きするので、他の人の記録には触れられない
--   - 書き込みは楽観的排他: 端末が最後に見た更新時刻より新しい保存があれば conflict を返す
--   - アカウントを消すと、預けた記録も一緒に消える
-- Supabase SQL Editor にそのまま貼り付けて実行できます。
-- =====================================================================

create table public.account_saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.account_saves enable row level security;
-- ポリシーは作らない（anon / authenticated からの直接アクセスはすべて拒否）

-- ログイン中のアカウントの保存データを取り出す（無ければ 0 行）
create or replace function public.account_pull()
returns table (data jsonb, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  return query
    select s.data, s.updated_at
    from public.account_saves s
    where s.user_id = auth.uid();
end;
$$;

-- ログイン中のアカウントに保存データを預ける。base_updated_at は端末が最後に見た更新時刻（初回は null）。
-- それより新しい保存が既にあれば（別の端末が先に書いた）何もせず conflict を返す
create or replace function public.account_push(payload jsonb, base_updated_at timestamptz)
returns table (status text, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  current_at timestamptz;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'invalid payload' using errcode = '22023';
  end if;
  -- 1 つの保存は 2MB まで
  if pg_column_size(payload) > 2 * 1024 * 1024 then
    raise exception 'payload too large' using errcode = '54000';
  end if;

  select s.updated_at into current_at from public.account_saves s where s.user_id = uid for update;

  if current_at is not null and (base_updated_at is null or current_at > base_updated_at) then
    return query select 'conflict'::text, current_at;
    return;
  end if;

  insert into public.account_saves as s (user_id, data, updated_at)
  values (uid, payload, now())
  on conflict (user_id) do update set data = excluded.data, updated_at = excluded.updated_at;

  return query select 'ok'::text, now();
end;
$$;

revoke execute on function public.account_pull() from public, anon;
revoke execute on function public.account_push(jsonb, timestamptz) from public, anon;
grant execute on function public.account_pull() to authenticated;
grant execute on function public.account_push(jsonb, timestamptz) to authenticated;
