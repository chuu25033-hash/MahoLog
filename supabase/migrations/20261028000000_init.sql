-- =====================================================================
-- マホログ 初期スキーマ
--   profiles / subjects / study_logs / friends
--   + 新規登録時の初期データ生成、レベル計算、1日12時間上限、RLS
-- Supabase SQL Editor にそのまま貼り付けて実行できます。
-- =====================================================================

-- ---------------------------------------------------------------------
-- レベル計算（src/lib/game.ts の calcLevel と同じ式）
--   Lv.1〜10 : 60 MP ごとに +1（600 MP = 10h で Lv.10）
--   Lv.11〜30: 120 MP ごとに +1（3000 MP = 50h で Lv.30）
--   Lv.31〜  : 180 MP ごとに +1
-- ---------------------------------------------------------------------
create or replace function public.calc_level(total_minutes integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when total_minutes < 600  then greatest(1, total_minutes / 60)
    when total_minutes < 3000 then 10 + (total_minutes - 600) / 120
    else                           30 + (total_minutes - 3000) / 180
  end;
$$;

-- ---------------------------------------------------------------------
-- テーブル
-- ---------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  username         text not null check (char_length(username) between 1 and 30),
  avatar_url       text not null default 'wizard-1',
  total_study_time integer not null default 0 check (total_study_time >= 0),
  current_level    integer not null default 1 check (current_level >= 1),
  created_at       timestamptz not null default now()
);

create table public.subjects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 20),
  -- 要件外の追加カラム: タイマー魔法陣・チャートの科目カラー
  color      text not null default '#a78bfa' check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create index subjects_user_sort_idx on public.subjects (user_id, sort_order);

create table public.study_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  -- 記録のある科目は削除不可（オフ切り替えで非表示にする運用）
  subject_id       uuid not null references public.subjects (id) on delete restrict,
  duration_minutes integer not null check (duration_minutes between 1 and 720),
  mode             text not null check (mode in ('pomodoro', 'stopwatch')),
  created_at       timestamptz not null default now()
);
create index study_logs_user_created_idx on public.study_logs (user_id, created_at desc);

create table public.friends (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,  -- 申請者
  friend_id  uuid not null references public.profiles (id) on delete cascade,  -- 申請先
  status     text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (user_id <> friend_id),
  unique (user_id, friend_id)
);
create index friends_friend_idx on public.friends (friend_id);

-- ---------------------------------------------------------------------
-- 新規登録時: プロフィール + 初期科目（国語・数学・英語）を生成
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
                  split_part(new.email, '@', 1)), 30),
    coalesce(nullif(new.raw_user_meta_data ->> 'avatar_url', ''), 'wizard-1')
  );

  insert into public.subjects (user_id, name, color, is_active, sort_order) values
    (new.id, '国語', '#f472b6', true, 1),
    (new.id, '数学', '#60a5fa', true, 2),
    (new.id, '英語', '#34d399', true, 3);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 科目: 有効なマイ科目は最大10件 / sort_order の自動採番
-- ---------------------------------------------------------------------
create or replace function public.enforce_subject_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.sort_order = 0 then
    select coalesce(max(sort_order), 0) + 1 into new.sort_order
    from public.subjects where user_id = new.user_id;
  end if;

  if new.is_active and (tg_op = 'INSERT' or not old.is_active) then
    if (select count(*) from public.subjects
        where user_id = new.user_id and is_active and id <> new.id) >= 10 then
      raise exception '有効にできるマイ科目は最大10科目です'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger subjects_enforce_rules
  before insert or update on public.subjects
  for each row execute function public.enforce_subject_rules();

-- ---------------------------------------------------------------------
-- 学習ログ: 不正対策（1日=日本時間で 12時間 = 720分 上限）
--   - created_at はサーバー時刻で上書き（クライアントの日時改ざん防止）
--   - 上限超過分は切り捨て、残り0分なら記録しない
-- ---------------------------------------------------------------------
create or replace function public.enforce_study_log_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  day_start timestamptz;
  used      integer;
  remaining integer;
begin
  new.created_at := now();
  day_start := date_trunc('day', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo';

  -- 同一ユーザーの同時保存で上限をすり抜けないよう行ロック
  perform 1 from public.profiles where id = new.user_id for update;

  select coalesce(sum(duration_minutes), 0) into used
  from public.study_logs
  where user_id = new.user_id and created_at >= day_start;

  remaining := 720 - used;
  if remaining <= 0 then
    return null;  -- 挿入をスキップ
  end if;

  new.duration_minutes := least(new.duration_minutes, remaining);
  return new;
end;
$$;

create trigger study_logs_enforce_rules
  before insert on public.study_logs
  for each row execute function public.enforce_study_log_rules();

-- 記録後に累積MPとレベルを更新
create or replace function public.apply_study_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set total_study_time = total_study_time + new.duration_minutes,
      current_level    = public.calc_level(total_study_time + new.duration_minutes)
  where id = new.user_id;
  return new;
end;
$$;

create trigger study_logs_apply
  after insert on public.study_logs
  for each row execute function public.apply_study_log();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.subjects   enable row level security;
alter table public.study_logs enable row level security;
alter table public.friends    enable row level security;

-- profiles: ランキング表示のためログインユーザーは全員分を参照可、更新は本人のみ
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- 累積MP・レベルはトリガー経由でのみ変更できるよう列単位で制限
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;

-- subjects: 本人のみ
create policy "subjects_select_own" on public.subjects
  for select to authenticated using (user_id = (select auth.uid()));
create policy "subjects_insert_own" on public.subjects
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "subjects_update_own" on public.subjects
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "subjects_delete_own" on public.subjects
  for delete to authenticated using (user_id = (select auth.uid()));

-- study_logs: 本人のみ参照・追加（更新・削除は不可）
create policy "study_logs_select_own" on public.study_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "study_logs_insert_own" on public.study_logs
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.subjects s
      where s.id = subject_id and s.user_id = (select auth.uid())
    )
  );
revoke update, delete on public.study_logs from anon, authenticated;

-- friends: 当事者のみ参照。申請は pending のみ、承認は申請先のみ
create policy "friends_select_party" on public.friends
  for select to authenticated
  using ((select auth.uid()) in (user_id, friend_id));
create policy "friends_insert_request" on public.friends
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');
create policy "friends_update_accept" on public.friends
  for update to authenticated
  using (friend_id = (select auth.uid())) with check (friend_id = (select auth.uid()));
create policy "friends_delete_party" on public.friends
  for delete to authenticated
  using ((select auth.uid()) in (user_id, friend_id));

revoke update on public.friends from anon, authenticated;
grant update (status) on public.friends to authenticated;

-- ---------------------------------------------------------------------
-- ランキング
-- ---------------------------------------------------------------------
create or replace function public.get_global_ranking(limit_count integer default 50)
returns table (
  rank bigint, user_id uuid, username text, avatar_url text,
  total_study_time integer, current_level integer
)
language sql
stable
set search_path = ''
as $$
  select rank() over (order by p.total_study_time desc),
         p.id, p.username, p.avatar_url, p.total_study_time, p.current_level
  from public.profiles p
  order by p.total_study_time desc, p.created_at
  limit limit_count;
$$;

create or replace function public.get_friend_ranking()
returns table (
  rank bigint, user_id uuid, username text, avatar_url text,
  total_study_time integer, current_level integer
)
language sql
stable
set search_path = ''
as $$
  with members as (
    select (select auth.uid()) as id
    union
    select case when f.user_id = (select auth.uid()) then f.friend_id else f.user_id end
    from public.friends f
    where f.status = 'accepted'
      and (select auth.uid()) in (f.user_id, f.friend_id)
  )
  select rank() over (order by p.total_study_time desc),
         p.id, p.username, p.avatar_url, p.total_study_time, p.current_level
  from public.profiles p
  join members m on m.id = p.id
  order by p.total_study_time desc, p.created_at;
$$;

revoke execute on function public.get_global_ranking(integer) from public, anon;
revoke execute on function public.get_friend_ranking() from public, anon;
grant execute on function public.get_global_ranking(integer) to authenticated;
grant execute on function public.get_friend_ranking() to authenticated;
