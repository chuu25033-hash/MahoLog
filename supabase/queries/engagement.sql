-- 反響の目安を測る集計（Supabase の SQL Editor で実行する。マイグレーションではない）
-- 端末から預かった保存データ（観測者IDとアカウントの両方）の詠唱の記録 chantHistory を数える。
--
-- アプリ化を考える目安:
--   ・継続者: 直近7日のうち3日以上詠唱した人 … 公開から1か月で 30人
--   ・定着率: 始めて2週以上たった人のうち、2週目（8〜14日目）にも詠唱した人の割合 … 20% 以上
-- 訪問数（SNS からの流入）は Vercel Analytics で見る。ここでは「使い続けているか」だけを見る
-- Google でログインした人は、ログイン前の観測者IDの記録も残るため、二重に数えることがある（目安としては十分）
-- 後から書き留めた記録（manual: true）は、その日に開いて詠唱したことにはならないので数えない
with saves as (
  select data from public.observer_saves
  union all
  select data from public.account_saves
),
numbered as (
  select
    row_number() over () as saver,
    s.data
  from saves s
),
days as (
  select
    c.saver,
    ((r ->> 'date')::timestamptz at time zone 'Asia/Tokyo')::date as day
  from numbered c
  cross join lateral jsonb_array_elements(coalesce(c.data -> 'chantHistory', '[]'::jsonb)) as r
  where coalesce((r ->> 'manual')::boolean, false) = false
),
per_saver as (
  select
    saver,
    min(day) as first_day,
    count(distinct day) filter (where day > (now() at time zone 'Asia/Tokyo')::date - 7) as days_last_7,
    bool_or(day between min_day + 7 and min_day + 13) as came_back_week2
  from (select *, min(day) over (partition by saver) as min_day from days) d
  group by saver
)
select
  count(*)                                                        as "詠唱したことのある人",
  count(*) filter (where days_last_7 > 0)                         as "直近7日に詠唱した人",
  count(*) filter (where days_last_7 >= 3)                        as "継続者（直近7日で3日以上）",
  count(*) filter (where first_day <= (now() at time zone 'Asia/Tokyo')::date - 14) as "始めて2週以上たった人",
  round(
    100.0 * count(*) filter (where came_back_week2 and first_day <= (now() at time zone 'Asia/Tokyo')::date - 14)
    / nullif(count(*) filter (where first_day <= (now() at time zone 'Asia/Tokyo')::date - 14), 0),
    1
  )                                                               as "定着率（2週目にも詠唱, %）"
from per_saver;
