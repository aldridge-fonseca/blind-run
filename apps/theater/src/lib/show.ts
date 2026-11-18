// Turns a loaded run into a "show": one global timeline of chapters, each with its own local clock.
import type { Fix, Lane, Run } from './types';

/** Piecewise-linear map between show time and lane time; idle gaps play fast-forwarded. */
export type Warp = { lane: number[]; show: number[]; duration: number };

const HOLD = 2200; // ms of every idle gap that still plays in real time (lets the voice finish)
const FF = 8; // fast-forward factor for the rest of a gap

export function buildWarp(lane: Lane, trim: boolean): Warp {
  const end = lane.durationMs;
  if (!trim) return { lane: [0, end], show: [0, end], duration: end };
  const events = new Set<number>([0, end]);
  for (const s of lane.steps) {
    events.add(s.t);
    if (s.tStart != null) events.add(s.tStart);
  }
  for (const f of lane.frames) events.add(f.t);
  for (const a of lane.announcements) events.add(a.t);
  const times = [...events].filter((t) => t >= 0 && t <= end).sort((a, b) => a - b);
  const L = [0];
  const S = [0];
  for (let i = 1; i < times.length; i++) {
    const a = times[i - 1];
    const b = times[i];
    const g = b - a;
    const s = S.at(-1)!;
    if (g > HOLD) {
      L.push(a + HOLD);
      S.push(s + HOLD);
      L.push(b);
      S.push(s + HOLD + (g - HOLD) / FF);
    } else {
      L.push(b);
      S.push(s + g);
    }
  }
  return { lane: L, show: S, duration: S.at(-1)! };
}

function interp(xs: number[], ys: number[], x: number): number {
  if (x <= xs[0]) return ys[0] + (x - xs[0]);
  if (x >= xs.at(-1)!) return ys.at(-1)! + (x - xs.at(-1)!);
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const span = xs[hi] - xs[lo];
  return span === 0 ? ys[hi] : ys[lo] + ((x - xs[lo]) / span) * (ys[hi] - ys[lo]);
}

export const laneTimeAt = (w: Warp, showLocal: number) => interp(w.show, w.lane, showLocal);
export const showTimeAt = (w: Warp, laneT: number) => interp(w.lane, w.show, laneT);
/** Lane-ms per show-ms at this point: 1 in real time, FF while skipping idle time. */
export function warpRate(w: Warp, showLocal: number): number {
  const a = laneTimeAt(w, showLocal);
  const b = laneTimeAt(w, showLocal + 1);
  return Math.max(1, Math.round(b - a));
}

export type LaneView = { lane: Lane; warp: Warp };

type Base = { id: string; title: string; short: string; start: number; end: number };
export type Chapter =
  | (Base & { kind: 'intro' })
  | (Base & { kind: 'race'; round: number; sighted: LaneView | null; blind: LaneView | null })
  | (Base & { kind: 'verdict'; lane: Lane; attempt: number })
  | (Base & { kind: 'fix'; fix: Fix; typingMs: number })
  | (Base & { kind: 'end' });

export type Show = { chapters: Chapter[]; duration: number; trim: boolean };

const INTRO = 6500;
const VERDICT = 15000;
const END = 18000;
const RACE_TAIL = 3000;

export function fixTypingMs(fix: Fix): number {
  const chars = fix.files.reduce((n, f) => n + f.hunks.reduce((m, h) => m + h.lines.filter((l) => l.kind === 'add').reduce((k, l) => k + l.text.trim().length, 0), 0), 0);
  return Math.min(16000, Math.max(5000, (chars / 55) * 1000));
}

export function buildShow(run: Run, trim: boolean): Show {
  const chapters: Chapter[] = [];
  let t = 0;
  type Draft = Chapter extends infer C ? (C extends Chapter ? Omit<C, 'start' | 'end'> : never) : never;
  const push = (c: Draft, duration: number) => {
    chapters.push({ ...c, start: t, end: t + duration } as Chapter);
    t += duration;
  };
  const view = (lane: Lane | undefined | null): LaneView | null => (lane ? { lane, warp: buildWarp(lane, trim) } : null);

  const items = run.sequence;
  const sightedItem = items.find((s) => s.kind === 'lane' && s.lane === 'sighted');
  const sighted = sightedItem ? run.lanes.get(sightedItem.dir) ?? null : null;
  const blindItems = items.filter((s) => s.kind === 'lane' && s.lane === 'blind');

  push({ kind: 'intro', id: 'intro', title: 'The task', short: 'Task' }, INTRO);

  let round = 0;
  let fixCount = 0;
  for (const item of items) {
    if (item.kind === 'fix') {
      const fix = run.fixes.get(item.dir);
      if (!fix) continue;
      fixCount++;
      const typingMs = fixTypingMs(fix);
      push({ kind: 'fix', id: fixCount > 1 ? `fix-${fixCount}` : 'fix', title: `Agent fixing${fix.attempt > 1 ? ` · attempt ${fix.attempt}` : ''}`, short: 'Fix', fix, typingMs }, typingMs + 7000);
      continue;
    }
    if (item.lane !== 'blind') continue;
    const blind = run.lanes.get(item.dir);
    if (!blind) continue;
    round++;
    const s = view(sighted);
    const b = view(blind);
    const dur = Math.max(s?.warp.duration ?? 0, b!.warp.duration) + RACE_TAIL;
    const first = round === 1;
    push(
      { kind: 'race', id: first ? 'race' : round === 2 ? 'rerun' : `rerun-${round - 1}`, title: first ? 'Sighted vs. blind' : 'Blind rerun', short: first ? 'Race' : 'Rerun', round, sighted: s, blind: b },
      dur,
    );
    if (blind.status === 'failed') {
      push({ kind: 'verdict', id: round === 1 ? 'verdict' : `verdict-${round}`, title: 'Kane verdict', short: 'Verdict', lane: blind, attempt: round }, VERDICT);
    }
  }
  if (!blindItems.length && sighted) {
    push({ kind: 'race', id: 'race', title: 'Sighted run', short: 'Run', round: 1, sighted: view(sighted), blind: null }, view(sighted)!.warp.duration + RACE_TAIL);
  }
  push({ kind: 'end', id: 'result', title: 'Result', short: 'Result' }, END);
  return { chapters, duration: t, trim };
}

export function chapterAt(show: Show, t: number): Chapter {
  return show.chapters.find((c) => t >= c.start && t < c.end) ?? show.chapters.at(-1)!;
}

/** `?t=` accepts seconds (`83.5`), a chapter id (`verdict`), or both (`verdict+2.5`). */
export function parseMoment(show: Show, value: string | null): number | null {
  if (!value) return null;
  const m = value.trim().match(/^([a-z][a-z0-9-]*)?(?:[+ ]?(-?\d+(?:\.\d+)?)s?)?$/i);
  if (!m || (!m[1] && !m[2])) return null;
  let t = 0;
  if (m[1]) {
    const c = show.chapters.find((ch) => ch.id === m[1].toLowerCase());
    if (!c) return null;
    t = c.start;
  }
  if (m[2]) t += Number(m[2]) * 1000;
  return Math.min(Math.max(0, t), show.duration);
}

export function formatMoment(show: Show, t: number): string {
  const c = chapterAt(show, t);
  const off = (t - c.start) / 1000;
  return off < 0.05 ? c.id : `${c.id}+${off.toFixed(1)}`;
}

/** Facts for the end card. */
export function outcome(run: Run) {
  const blinds = run.sequence.filter((s) => s.kind === 'lane' && s.lane === 'blind').map((s) => run.lanes.get(s.dir)!).filter(Boolean);
  const sightedItem = run.sequence.find((s) => s.kind === 'lane' && s.lane === 'sighted');
  const sighted = sightedItem ? run.lanes.get(sightedItem.dir) ?? null : null;
  const first = blinds[0] ?? null;
  const last = blinds.at(-1) ?? null;
  const lanes = [...run.lanes.values()];
  const credits = lanes.reduce((n, l) => n + (l.meta?.credits ?? l.runEnd?.credits_consumed ?? 0), 0);
  return {
    sighted,
    before: first,
    after: blinds.length > 1 ? last : null,
    blindFixed: blinds.length > 1 && last?.status === 'passed',
    credits,
    kaneRuns: lanes.length,
    attempts: run.fixes.size,
    barriers: run.meta.outcome?.barriers ?? [],
  };
}
