-- 紋章（avatar_url）はプリセットIDだけを保存する。Google ログインでは画像の URL が届くため、
-- 知らない値は wizard-1 にする
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  avatar text := new.raw_user_meta_data ->> 'avatar_url';
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
                  split_part(new.email, '@', 1)), 30),
    case when avatar ~ '^wizard-[1-5]$' then avatar else 'wizard-1' end
  );

  insert into public.subjects (user_id, name, color, is_active, sort_order) values
    (new.id, '国語', '#e7a9c6', true, 1),
    (new.id, '数学', '#8db7f2', true, 2),
    (new.id, '英語', '#8fdcc4', true, 3);

  return new;
end;
$$;

-- すでに URL が入ってしまったプロフィールを戻す
update public.profiles set avatar_url = 'wizard-1' where avatar_url !~ '^wizard-[1-5]$';
