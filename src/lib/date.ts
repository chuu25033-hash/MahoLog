// 集計は日本時間で区切る（DB 側の1日上限判定も Asia/Tokyo）
const JST_OFFSET = 9 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

export function startOfJstDay(date = new Date()): Date {
  const jst = date.getTime() + JST_OFFSET;
  return new Date(jst - (jst % DAY) - JST_OFFSET);
}

/** 月曜始まり */
export function startOfJstWeek(date = new Date()): Date {
  const day = startOfJstDay(date);
  const weekday = new Date(day.getTime() + JST_OFFSET).getUTCDay();
  return new Date(day.getTime() - ((weekday + 6) % 7) * DAY);
}

export function startOfJstMonth(date = new Date()): Date {
  const jst = new Date(date.getTime() + JST_OFFSET);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1) - JST_OFFSET);
}
