/**
 * 动态渐变重叠着色系统 + 标签色板
 * 纯函数引擎 — 零外部依赖
 */

const STOPS = [
  { n: 1, h: 120, s: 55, l: 43 },
  { n: 2, h: 48,  s: 80, l: 48 },
  { n: 3, h: 28,  s: 85, l: 48 },
  { n: 5, h: 8,   s: 80, l: 44 },
  { n: 8, h: 2,   s: 78, l: 38 },
];

function lerp(a, b, t) { return a + (b - a) * t; }

function lerpHue(h1, h2, t) {
  let d = h2 - h1;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return ((h1 + d * t) % 360 + 360) % 360;
}

export function colorForOverlap(n) {
  if (n <= 1) {
    const s = STOPS[0];
    return { bg: `hsl(${s.h},${s.s}%,${s.l}%)`, text: '#fff', h: s.h, s: s.s, l: s.l };
  }
  let lower = STOPS[0], upper = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (n >= STOPS[i].n && n <= STOPS[i + 1].n) { lower = STOPS[i]; upper = STOPS[i + 1]; break; }
  }
  if (n >= upper.n) {
    return { bg: `hsl(${upper.h},${upper.s}%,${upper.l}%)`, text: '#fff', h: upper.h, s: upper.s, l: upper.l };
  }
  const t = (n - lower.n) / (upper.n - lower.n);
  const h = Math.round(lerpHue(lower.h, upper.h, t));
  const s = Math.round(lerp(lower.s, upper.s, t));
  const l = Math.round(lerp(lower.l, upper.l, t));
  const textColor = (h > 38 && h < 70 && l > 44) ? '#1a1a1a' : '#fff';
  return { bg: `hsl(${h},${s}%,${l}%)`, text: textColor, h, s, l };
}

export function eventGradient(c) {
  const top = `hsl(${c.h},${c.s}%,${c.l}%)`;
  const bottom = `hsl(${c.h},${c.s}%,${Math.max(0, c.l - 8)}%)`;
  return `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`;
}

export function legendGradient() {
  const stops = [1, 2, 3, 5, 8];
  return `linear-gradient(90deg, ${stops.map(n => colorForOverlap(n).bg).join(', ')})`;
}

export const TAG_PALETTE = {
  work:     { bg: '#e3f2fd', dot: '#42a5f5', text: '#1565c0', label: '工作' },
  meeting:  { bg: '#fff3e0', dot: '#ff9800', text: '#e65100', label: '会议' },
  urgent:   { bg: '#ffebee', dot: '#ef5350', text: '#c62828', label: '紧急' },
  personal: { bg: '#e8f5e9', dot: '#66bb6a', text: '#2e7d32', label: '个人' },
  other:    { bg: '#f5f5f5', dot: '#9e9e9e', text: '#616161', label: '其他' },
};

export const TAG_OPTIONS = Object.entries(TAG_PALETTE).map(([key, val]) => ({ key, ...val }));
