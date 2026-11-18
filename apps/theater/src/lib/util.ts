export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const easeOut = (p: number) => 1 - Math.pow(1 - clamp(p), 3);
export const easeOutExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(p)));
export const easeInOut = (p: number) => {
  const x = clamp(p);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
/** Overshooting ease for "pop" entrances. */
export const easeOutBack = (p: number) => {
  const x = clamp(p);
  const c1 = 1.4;
  return 1 + (c1 + 1) * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
/** 0→1 progress of an entrance that starts at `at` ms and lasts `dur` ms. */
export const reveal = (t: number, at: number, dur = 600, ease = easeOut) => ease((t - at) / dur);

/** Style for a time-driven rise-and-fade entrance. */
export function rise(t: number, at: number, dur = 700, dist = 18) {
  const p = reveal(t, at, dur);
  return { opacity: p, transform: `translate3d(0, ${(1 - p) * dist}px, 0)` };
}

export function fmtClock(ms: number) {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}
export function fmtShort(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export const fmtSeconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

export function lastAt<T extends { t: number }>(items: T[], t: number): number {
  let lo = 0;
  let hi = items.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (items[mid].t <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

export const WCAG: Record<string, string> = {
  '1.1.1': 'Non-text Content',
  '1.3.1': 'Info and Relationships',
  '1.4.3': 'Contrast (Minimum)',
  '2.1.1': 'Keyboard',
  '2.1.2': 'No Keyboard Trap',
  '2.4.3': 'Focus Order',
  '2.4.7': 'Focus Visible',
  '3.3.2': 'Labels or Instructions',
  '4.1.2': 'Name, Role, Value',
  '4.1.3': 'Status Messages',
};
