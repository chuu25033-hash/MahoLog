-- 星空ファンタジーのリデザインに合わせ、初期科目の色を蛍光色から淡い水晶色へ変更
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
    (new.id, '国語', '#e7a9c6', true, 1),
    (new.id, '数学', '#8db7f2', true, 2),
    (new.id, '英語', '#8fdcc4', true, 3);

  return new;
end;
$$;

alter table public.subjects alter column color set default '#b9a2f7';

-- 既存ユーザーのうち、初期色のままの科目だけを置き換える
update public.subjects set color = '#e7a9c6' where color = '#f472b6';
update public.subjects set color = '#8db7f2' where color = '#60a5fa';
update public.subjects set color = '#8fdcc4' where color = '#34d399';
