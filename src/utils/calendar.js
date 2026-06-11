/**
 * 日历工具函数 — 纯算法，零外部依赖
 */

/** 本地日期键 "2026-06-04"（不受时区偏移影响） */
function dayKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 扫线算法计算重叠数 O(n log n)
 */
export function calcOverlap(events, targetStart, targetEnd, excludeId) {
  const t0 = new Date(targetStart).getTime();
  const t1 = new Date(targetEnd).getTime();
  if (t0 >= t1) return 1;

  const points = [];
  for (const e of events) {
    if (e.id === excludeId) continue;
    const s = new Date(e.start).getTime();
    const en = new Date(e.end).getTime();
    if (s < t1 && en > t0) {
      points.push({ t: Math.max(s, t0), d: 1 });
      points.push({ t: Math.min(en, t1), d: -1 });
    }
  }
  if (points.length === 0) return 1;

  points.sort((a, b) => a.t - b.t || a.d - b.d);

  let cur = 0, max = 0;
  for (const p of points) {
    cur += p.d;
    max = Math.max(max, cur);
  }
  return max + 1;
}

/**
 * 日历日密度 — 统计每个日历日有多少事件
 * 输入：全部事件数组
 * 输出：Map<"2026-06-04", count>
 */
export function calcDayDensity(events) {
  const map = new Map();

  for (const ev of events) {
    const start = new Date(ev.start);
    const end = new Date(ev.end);

    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    while (cursor <= endDay) {
      map.set(dayKey(cursor), (map.get(dayKey(cursor)) || 0) + 1);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return map;
}

export { dayKey };
