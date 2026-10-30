-- =====================================================================
-- 観測者IDの試行回数の制限（総当たり対策）
--   観測者IDは知っていれば記録を開ける「鍵」なので、存在しない ID を次々に試す行為を IP アドレスごとに止める。
--   - 数えるのは「外れ」だけ: 存在しない ID の取り出し（observer_pull が 0 行）と、
--     預ける前に既に別の保存があった（observer_push の conflict。ID の有無を探る使い方を防ぐ）
--   - 正しい使い方では外れない: 自分の ID での同期は当たり、新しい端末は取り出さずにいきなり預ける（アプリ側）
--     外れるのは、復元で実在しない ID を入れたときと、別の端末とほぼ同時に預けて衝突したときくらい
--   - 1時間に5回外れた IP は、その1時間が終わるまで観測者IDの操作をすべて断る（HTTP 429）
-- Supabase SQL Editor にそのまま貼り付けて実行できます（20261031000000_observer_saves.sql の後に）。
-- =====================================================================

create table public.observer_attempts (
  ip      text not null,
  -- 1時間ごとの区切り（その時間に外れた回数を数える）
  bucket  timestamptz not null,
  misses  integer not null default 0,
  primary key (ip, bucket)
);

alter table public.observer_attempts enable row level security;
-- ポリシーは作らない（anon / authenticated からの直接アクセスはすべて拒否）

-- 呼び出し元の IP アドレス（Supabase の API が付ける転送ヘッダーの先頭）。取れなければ 'unknown'
create or replace function public.observer_client_ip()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(trim(split_part(coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-forwarded-for', ',', 1)), ''),
    nullif(coalesce(current_setting('request.headers', true), '{}')::json ->> 'cf-connecting-ip', ''),
    'unknown'
  );
$$;

-- この IP がこの1時間に外れすぎていれば断る
create or replace function public.observer_guard()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- 1時間に許す外れの回数
  miss_limit constant integer := 5;
  used integer;
begin
  select a.misses into used
  from public.observer_attempts a
  where a.ip = public.observer_client_ip() and a.bucket = date_trunc('hour', now());
  if coalesce(used, 0) >= miss_limit then
    -- PostgREST は PT + 3桁の SQLSTATE をそのまま HTTP の状態コードにする（429 Too Many Requests）
    raise exception 'too many observer attempts' using errcode = 'PT429', hint = 'retry after the current hour';
  end if;
end;
$$;

-- 外れを1回数える（古い区切りはついでに片づける）
create or replace function public.observer_note_miss()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.observer_attempts as a (ip, bucket, misses)
  values (public.observer_client_ip(), date_trunc('hour', now()), 1)
  on conflict (ip, bucket) do update set misses = a.misses + 1;
  delete from public.observer_attempts a where a.bucket < now() - interval '1 day';
end;
$$;

revoke execute on function public.observer_client_ip() from public, anon, authenticated;
revoke execute on function public.observer_guard() from public, anon, authenticated;
revoke execute on function public.observer_note_miss() from public, anon, authenticated;

-- 預けた保存データを取り出す（無ければ 0 行）。外れは数え、外れすぎた IP は断る
create or replace function public.observer_pull(code text)
returns table (data jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  hits integer;
begin
  perform public.observer_guard();
  return query
    select s.data, s.updated_at
    from public.observer_saves s
    where s.code_hash = public.observer_code_hash(code);
  get diagnostics hits = row_count;
  if hits = 0 then
    perform public.observer_note_miss();
  end if;
end;
$$;

-- 保存データを預ける。base_updated_at は端末が最後に見た更新時刻（初回は null）。
-- それより新しい保存が既にあれば（別端末が先に書いた／ID が重複した）何もせず conflict を返し、外れとして数える
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
  perform public.observer_guard();
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'invalid payload' using errcode = '22023';
  end if;
  -- 1 つの保存は 2MB まで
  if pg_column_size(payload) > 2 * 1024 * 1024 then
    raise exception 'payload too large' using errcode = '54000';
  end if;

  select s.updated_at into current_at from public.observer_saves s where s.code_hash = key for update;

  if current_at is not null and (base_updated_at is null or current_at > base_updated_at) then
    perform public.observer_note_miss();
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
