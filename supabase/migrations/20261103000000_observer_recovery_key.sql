-- =====================================================================
-- 観測者IDの「復元キー」
--   観測者ID（ML-XXXX-XXXX）は名札にして、記録を開く鍵は別の長いランダムな復元キー
--   （XXXX-XXXX-XXXX-XXXX-XXXX。32 文字 × 20 桁 ≒ 2^100 通り）にする。
--   - 復元キーはアプリが自動で作る（人が考えた文字列ではないので、使い回しの心配が無い）
--   - DB には観測者IDと組み合わせた SHA-256 のハッシュだけを持つ（推測できないほど長いので、遅いハッシュは要らない）
--   - 取り出し・預け入れには観測者IDと復元キーの両方が要る。違えば「外れ」として試行回数に数える
--   - 復元キーは作り直せる（古いキーは使えなくなる）
--   - 復元キーができる前に預けた記録（key_hash が空）は、最初に復元キーを添えて触れた端末のキーで閉じる
-- Supabase SQL Editor にそのまま貼り付けて実行できます（20261102000000_observer_rate_limit.sql の後に）。
-- =====================================================================

alter table public.observer_saves add column key_hash text;

-- 復元キー: 見間違えやすい文字（0/O, 1/I）を除いた 32 文字 × 4 桁 × 5
create or replace function public.observer_key_hash(code text, secret text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if secret is null or secret !~ '^[2-9A-HJ-NP-Z]{4}(-[2-9A-HJ-NP-Z]{4}){4}$' then
    raise exception 'invalid recovery key' using errcode = '22023';
  end if;
  return encode(extensions.digest(public.observer_code_hash(code) || ':' || secret, 'sha256'), 'hex');
end;
$$;

revoke execute on function public.observer_key_hash(text, text) from public, anon, authenticated;

-- 観測者IDだけで開けた古い入口は閉じる
drop function if exists public.observer_pull(text);
drop function if exists public.observer_push(text, jsonb, timestamptz);

-- 預けた保存データを取り出す。観測者IDと復元キーが合わなければ 0 行（どちらが違うかは明かさない）
create or replace function public.observer_pull(code text, secret text)
returns table (data jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  key text;
  kh text;
  hits integer;
begin
  perform public.observer_guard();
  key := public.observer_code_hash(code);
  kh := public.observer_key_hash(code, secret);
  -- 復元キーができる前の記録は、ここで差し出された復元キーで閉じる
  update public.observer_saves s set key_hash = kh where s.code_hash = key and s.key_hash is null;
  return query
    select s.data, s.updated_at
    from public.observer_saves s
    where s.code_hash = key and s.key_hash = kh;
  get diagnostics hits = row_count;
  if hits = 0 then
    perform public.observer_note_miss();
  end if;
end;
$$;

-- 保存データを預ける。base_updated_at は端末が最後に見た更新時刻（初回は null）。
-- 復元キーが違えば forbidden、それより新しい保存が既にあれば conflict を返し（どちらも外れとして数える）、何もしない
create or replace function public.observer_push(code text, secret text, payload jsonb, base_updated_at timestamptz)
returns table (status text, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  key text;
  kh text;
  current_at timestamptz;
  current_kh text;
begin
  perform public.observer_guard();
  key := public.observer_code_hash(code);
  kh := public.observer_key_hash(code, secret);
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'invalid payload' using errcode = '22023';
  end if;
  -- 1 つの保存は 2MB まで
  if pg_column_size(payload) > 2 * 1024 * 1024 then
    raise exception 'payload too large' using errcode = '54000';
  end if;

  select s.updated_at, s.key_hash into current_at, current_kh
  from public.observer_saves s where s.code_hash = key for update;

  if current_at is not null and current_kh is not null and current_kh <> kh then
    perform public.observer_note_miss();
    return query select 'forbidden'::text, null::timestamptz;
    return;
  end if;
  if current_at is not null and (base_updated_at is null or current_at > base_updated_at) then
    perform public.observer_note_miss();
    return query select 'conflict'::text, current_at;
    return;
  end if;

  insert into public.observer_saves as s (code_hash, key_hash, data, updated_at)
  values (key, kh, payload, now())
  on conflict (code_hash) do update set key_hash = excluded.key_hash, data = excluded.data, updated_at = excluded.updated_at;

  return query select 'ok'::text, now();
end;
$$;

-- 復元キーを作り直す。いまの復元キーが合えば新しいキーに替えて true（古いキーは使えなくなる）
create or replace function public.observer_rotate_key(code text, secret text, new_secret text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  key text;
  kh text;
  new_kh text;
  hits integer;
begin
  perform public.observer_guard();
  key := public.observer_code_hash(code);
  kh := public.observer_key_hash(code, secret);
  new_kh := public.observer_key_hash(code, new_secret);
  update public.observer_saves s set key_hash = new_kh
  where s.code_hash = key and (s.key_hash = kh or s.key_hash is null);
  get diagnostics hits = row_count;
  if hits = 0 then
    perform public.observer_note_miss();
    return false;
  end if;
  return true;
end;
$$;

revoke execute on function public.observer_pull(text, text) from public;
revoke execute on function public.observer_push(text, text, jsonb, timestamptz) from public;
revoke execute on function public.observer_rotate_key(text, text, text) from public;
grant execute on function public.observer_pull(text, text) to anon, authenticated;
grant execute on function public.observer_push(text, text, jsonb, timestamptz) to anon, authenticated;
grant execute on function public.observer_rotate_key(text, text, text) to anon, authenticated;
