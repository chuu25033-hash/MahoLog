-- =====================================================================
-- 結びし世界線（BOUND WORLDLINES）
--   全体公開・順位づけをやめ、世界線IDで結ばれた相手の「気配」だけを観測する。
--   - 世界線ID（LN-XXXXXX）と気配（詠唱中か・最後の探求・滞在エリア）を profiles に持つ
--   - 接続は相互: 片方が ID を入力すると申し出（pending）、もう片方が応じると結ばれる（accepted）
--   - profiles は本人と、結ばれた相手の行だけを参照できる
-- Supabase SQL Editor にそのまま貼り付けて実行できます。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 不特定多数・順位づけの機能を廃止
-- ---------------------------------------------------------------------
drop function if exists public.get_global_ranking(integer);
drop function if exists public.get_friend_ranking();

-- ---------------------------------------------------------------------
-- 世界線ID: 見間違えやすい文字（0/O, 1/I）を除いた 32 文字 × 6 桁
-- ---------------------------------------------------------------------
create or replace function public.generate_worldline_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  code text;
begin
  loop
    code := 'LN-';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where worldline_code = code);
  end loop;
  return code;
end;
$$;

revoke execute on function public.generate_worldline_code() from public, anon, authenticated;

alter table public.profiles
  add column worldline_code   text,
  -- 詠唱中なら開始時刻（終えたら null）
  add column chanting_since   timestamptz,
  -- 最後に詠唱を終えて記録した時刻
  add column last_chant_at    timestamptz,
  -- 滞在中のエリア ID（例: 2-1）
  add column current_stage_id text check (current_stage_id ~ '^[0-9]+-[0-9]+$');

update public.profiles set worldline_code = public.generate_worldline_code() where worldline_code is null;

alter table public.profiles
  alter column worldline_code set default public.generate_worldline_code(),
  alter column worldline_code set not null,
  add constraint profiles_worldline_code_key unique (worldline_code);

-- 詠唱を記録したら、最後の探求時刻を刻み、詠唱中の印を外す
create or replace function public.apply_study_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set total_study_time = total_study_time + new.duration_minutes,
      current_level    = public.calc_level(total_study_time + new.duration_minutes),
      last_chant_at    = now(),
      chanting_since   = null
  where id = new.user_id;
  return new;
end;
$$;

-- 詠唱の開始・中断を気配として残す（本人の行のみ）
create or replace function public.set_chant_presence(chanting boolean, stage_id text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set chanting_since   = case when chanting then now() end,
      current_stage_id = coalesce(stage_id, current_stage_id)
  where id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------
-- profiles: 全員分の参照をやめ、本人と結ばれた相手だけにする
-- ---------------------------------------------------------------------
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_self_or_bound" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.friends f
      where f.status = 'accepted'
        and (
          (f.user_id = (select auth.uid()) and f.friend_id = profiles.id)
          or (f.friend_id = (select auth.uid()) and f.user_id = profiles.id)
        )
    )
  );

-- ---------------------------------------------------------------------
-- 世界線の接続
-- ---------------------------------------------------------------------
-- 相手の世界線IDで結ぶ。相手からの申し出があれば結ばれ、なければ申し出を送る。
-- 戻り値: accepted / pending / exists / self / not_found
create or replace function public.bind_worldline(target_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  target uuid;
begin
  if me is null then
    raise exception 'ログインが必要です' using errcode = 'insufficient_privilege';
  end if;

  select id into target from public.profiles where worldline_code = upper(trim(target_code));
  if target is null then return 'not_found'; end if;
  if target = me then return 'self'; end if;

  update public.friends set status = 'accepted'
  where user_id = target and friend_id = me and status = 'pending';
  if found then return 'accepted'; end if;

  if exists (
    select 1 from public.friends
    where (user_id = me and friend_id = target) or (user_id = target and friend_id = me)
  ) then
    return 'exists';
  end if;

  insert into public.friends (user_id, friend_id) values (me, target);
  return 'pending';
end;
$$;

-- 自分の世界線の一覧。気配は結ばれた相手のものだけを返し、
-- 応答のない申し出先の名前は伏せる（ID を当て推量して名前を知られないように）
create or replace function public.get_worldline_bonds()
returns table (
  bond_id          uuid,
  direction        text,
  status           text,
  partner_id       uuid,
  username         text,
  worldline_code   text,
  chanting_since   timestamptz,
  last_chant_at    timestamptz,
  current_stage_id text,
  bound_at         timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id,
         case when f.user_id = (select auth.uid()) then 'outgoing' else 'incoming' end,
         f.status,
         case when f.status = 'accepted' then p.id end,
         case when f.status = 'accepted' or f.friend_id = (select auth.uid()) then p.username end,
         p.worldline_code,
         case when f.status = 'accepted' then p.chanting_since end,
         case when f.status = 'accepted' then p.last_chant_at end,
         case when f.status = 'accepted' then p.current_stage_id end,
         f.created_at
  from public.friends f
  join public.profiles p
    on p.id = case when f.user_id = (select auth.uid()) then f.friend_id else f.user_id end
  where (select auth.uid()) in (f.user_id, f.friend_id)
  order by f.created_at;
$$;

revoke execute on function public.set_chant_presence(boolean, text) from public, anon;
revoke execute on function public.bind_worldline(text) from public, anon;
revoke execute on function public.get_worldline_bonds() from public, anon;
grant execute on function public.set_chant_presence(boolean, text) to authenticated;
grant execute on function public.bind_worldline(text) to authenticated;
grant execute on function public.get_worldline_bonds() to authenticated;

-- 結ばれた相手の詠唱の開始・完了を、画面の光のパルスで知らせるために配信する（RLS に従う）
alter publication supabase_realtime add table public.profiles;
