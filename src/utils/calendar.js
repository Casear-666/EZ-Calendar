/**
 * 日历工具函数 — 纯算法，零外部依赖
 */

/**
 * 扫线算法计算重叠数 O(n log n)
 * 输入：全部事件数组 + 目标事件的起止时间
 * 输出：该目标事件的最大重叠数（含自身，≥ 1）
 *
 * @param {Array} events — 全部事件
 * @param {Date|string} targetStart
 * @param {Date|string} targetEnd
 * @param {number} excludeId — 排除的事件 ID（自身）
 * @returns {number}
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

  // 时间优先 → 同时间 -1 先于 +1（重叠计数的正确语义）
  points.sort((a, b) => a.t - b.t || a.d - b.d);

  let cur = 0, max = 0;
  for (const p of points) {
    cur += p.d;
    max = Math.max(max, cur);
  }
  return max + 1;  // +1 = 含自身
}
