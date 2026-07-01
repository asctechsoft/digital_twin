// Thang màu mật độ — giống demo gốc. d ∈ [0,1].
export const DIRS = ['NS', 'EW', 'NE', 'SW'];

export const COLOR_MAP = [
  { max: 0.28, hex: '#22c55e', name: 'Xanh', emoji: '🟢', label: 'Thông thoáng' },
  { max: 0.48, hex: '#eab308', name: 'Vàng', emoji: '🟡', label: 'Bình thường' },
  { max: 0.68, hex: '#f97316', name: 'Cam', emoji: '🟠', label: 'Hơi đông' },
  { max: 0.82, hex: '#ef4444', name: 'Đỏ', emoji: '🔴', label: 'Đông đúc' },
  { max: 0.93, hex: '#a855f7', name: 'Tím', emoji: '🟣', label: 'Rất đông' },
  { max: 1.01, hex: '#92400e', name: 'Nâu', emoji: '🟤', label: 'Tắc hoàn toàn' },
];

export function getColor(d) {
  for (const c of COLOR_MAP) if (d <= c.max) return c;
  return COLOR_MAP[COLOR_MAP.length - 1];
}

export function phaseColor(state) {
  if (state === 'green') return '#22c55e';
  if (state === 'yellow') return '#fbbf24';
  return '#ef4444';
}
