import type { Announcement, AudioClip, Fix, KaneRunEnd, KaneStep, Lane, LaneJson, Run, RunJson, RunSequenceItem, RunSummary } from './types';
import { parseDiff } from './diff';

const RUNS = 'runs';

async function getText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    // Dev servers answer unknown paths with index.html; never mistake that for data.
    if (type.includes('text/html')) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function getJson<T>(url: string): Promise<T | null> {
  const text = await getText(url);
  if (text == null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function parseLines<T>(text: string | null): T[] {
  if (!text) return [];
  const out: T[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* tolerate a torn last line */
    }
  }
  return out;
}

export async function loadIndex(): Promise<RunSummary[]> {
  const runs = (await getJson<RunSummary[]>(`${RUNS}/index.json`)) ?? [];
  return runs.sort((a, b) => Number(a.fixture) - Number(b.fixture) || String(b.createdAt).localeCompare(String(a.createdAt)));
}

/** Cleans a Kane step remark like `press_key: PRIMARY: Select seat 14C; role=button; text="…" | HINTS: …`. */
export function parseRemark(remark: string): { action: string; text: string; key: string | null } {
  const m = remark.match(/^([a-z_]+):\s*(.*)$/s);
  const action = m ? m[1] : 'step';
  let text = (m ? m[2] : remark).replace(/^PRIMARY:\s*/, '');
  text = text.split(' | HINTS')[0].split(/;\s*(role|text|HINTS)=/)[0].trim();
  const keyMatch = text.match(/press the (.+?) key/i);
  const key = keyMatch ? keyMatch[1] : null;
  if (keyMatch && /^press the .+ key$/i.test(text)) text = key!;
  return { action, text, key };
}

export function parseKane(events: Record<string, unknown>[], origin: number): { steps: KaneStep[]; runEnd: KaneRunEnd | null } {
  const byStep = new Map<number, KaneStep>();
  let runEnd: KaneRunEnd | null = null;
  for (const e of events) {
    const ts = typeof e.ts === 'string' ? Date.parse(e.ts) - origin : NaN;
    if (e.type === 'run_end') runEnd = e as unknown as KaneRunEnd;
    if (typeof e.step !== 'number') continue;
    const n = e.step;
    const existing = byStep.get(n);
    if (e.status === 'running') {
      if (existing) existing.tStart = ts;
      else byStep.set(n, { n, tStart: ts, t: ts, status: 'running', action: '', text: '', key: null, raw: String(e.remark ?? '') });
      continue;
    }
    const parsed = parseRemark(String(e.remark ?? ''));
    byStep.set(n, { n, tStart: existing?.tStart ?? null, t: ts, status: String(e.status), raw: String(e.remark ?? ''), ...parsed });
  }
  const steps = [...byStep.values()].filter((s) => s.action).sort((a, b) => a.t - b.t);
  return { steps, runEnd };
}

type RunAudio = { t: number; file: string; text: string; lane?: string; source?: string };

async function loadLane(base: string, dir: string, kind: 'sighted' | 'blind', runAudio: RunAudio[] = []): Promise<Lane | null> {
  const laneBase = `${base}/${dir}`;
  const [meta, kaneText, frames, annText, audio] = await Promise.all([
    getJson<LaneJson>(`${laneBase}/lane.json`),
    getText(`${laneBase}/kane.ndjson`),
    getJson<{ file: string; t: number }[]>(`${laneBase}/frames.json`),
    getText(`${laneBase}/announcements.jsonl`),
    getJson<{ t: number; file: string; text: string }[]>(`${laneBase}/audio.json`),
  ]);
  if (!meta && !kaneText && !frames) return null;
  const events = parseLines<Record<string, unknown>>(kaneText);
  const start = events.find((e) => e.type === 'stream_start')?.ts ?? events[0]?.ts;
  const origin = meta?.startedAt ? Date.parse(meta.startedAt) : typeof start === 'string' ? Date.parse(start) : 0;
  const { steps, runEnd } = parseKane(events, origin);
  const announcements = parseLines<Announcement>(annText).filter((a) => typeof a.t === 'number' && a.text).sort((a, b) => a.t - b.t);
  const frameList = (frames ?? []).filter((f) => f && f.file).map((f) => ({ t: f.t, url: `${laneBase}/${f.file}` })).sort((a, b) => a.t - b.t);
  const durationMs =
    meta?.durationMs ??
    (runEnd?.duration ? runEnd.duration * 1000 : Math.max(steps.at(-1)?.t ?? 0, frameList.at(-1)?.t ?? 0, announcements.at(-1)?.t ?? 0) + 1000);
  const rawStatus = String(meta?.status ?? runEnd?.status ?? 'unknown');
  const status = rawStatus === 'passed' ? 'passed' : rawStatus === 'failed' ? 'failed' : 'unknown';
  // Audio lives either beside the lane or in the run-level audio.json, tagged with the lane dir.
  const audioClips: AudioClip[] = audio?.length
    ? audio.filter((a) => a.file).map((a) => ({ ...a, url: `${laneBase}/${a.file}` }))
    : runAudio.filter((a) => a.lane === dir && a.file && a.source !== 'narration').map((a) => ({ t: a.t, file: a.file, text: a.text, url: `${base}/${a.file}` }));
  audioClips.sort((a, b) => a.t - b.t);
  const video = meta?.video ? `${laneBase}/${meta.video}` : !frameList.length ? await probeVideo(laneBase) : null;
  return {
    dir, kind, meta, steps, runEnd, frames: frameList, video, announcements, audio: audioClips, durationMs, status,
    viewport: meta?.viewport ?? null, base: laneBase,
  };
}

async function probeVideo(laneBase: string): Promise<string | null> {
  for (const name of ['video.webm', 'video.mp4']) {
    try {
      const res = await fetch(`${laneBase}/${name}`, { method: 'HEAD' });
      if (res.ok && /video/.test(res.headers.get('content-type') || '')) return `${laneBase}/${name}`;
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function loadFix(base: string, dir: string, attempt: number, runAudio: RunAudio[]): Promise<Fix> {
  const fixBase = `${base}/${dir}`;
  const [diffText, brief, result, lane] = await Promise.all([
    getText(`${fixBase}/diff.patch`),
    getText(`${fixBase}/brief.md`),
    getJson<Record<string, unknown>>(`${fixBase}/result.json`),
    loadLane(base, dir, 'blind', runAudio),
  ]);
  return { dir, attempt, diffText, files: diffText ? parseDiff(diffText) : [], brief, result, base: fixBase, lane };
}

/** Without a sequence in run.json, probe the conventional directory names. */
async function guessSequence(base: string): Promise<RunSequenceItem[]> {
  const seq: RunSequenceItem[] = [];
  const exists = async (p: string) => (await getText(`${base}/${p}`)) != null;
  if ((await exists('sighted/lane.json')) || (await exists('sighted/kane.ndjson'))) seq.push({ kind: 'lane', lane: 'sighted', dir: 'sighted' });
  if ((await exists('blind/lane.json')) || (await exists('blind/kane.ndjson'))) seq.push({ kind: 'lane', lane: 'blind', dir: 'blind' });
  for (let i = 0; i < 6; i++) {
    if (i > 0 && (await exists(`fix-${i}/diff.patch`))) seq.push({ kind: 'fix', attempt: i, dir: `fix-${i}` });
    if ((await exists(`blind-${i}/lane.json`)) || (await exists(`blind-${i}/kane.ndjson`))) seq.push({ kind: 'lane', lane: 'blind', dir: `blind-${i}` });
    else if (i > 0 && !(await exists(`fix-${i}/diff.patch`))) break;
  }
  if ((await exists('blind-after/lane.json')) || (await exists('blind-after/kane.ndjson'))) seq.push({ kind: 'lane', lane: 'blind', dir: 'blind-after' });
  return seq;
}

export async function loadRun(id: string): Promise<Run> {
  const base = `${RUNS}/${encodeURIComponent(id)}`;
  const meta = await getJson<RunJson>(`${base}/run.json`);
  if (!meta) throw new Error(`Run “${id}” was not found (no ${base}/run.json).`);
  const sequence = meta.sequence?.length ? meta.sequence : await guessSequence(base);
  const runAudio = (await getJson<RunAudio[]>(`${base}/audio.json`)) ?? [];
  const lanes = new Map<string, Lane>();
  const fixes = new Map<string, Fix>();
  await Promise.all(
    sequence.map(async (item) => {
      if (item.kind === 'lane') {
        const lane = await loadLane(base, item.dir, item.lane, runAudio);
        if (lane) lanes.set(item.dir, lane);
      } else if (item.kind === 'fix') {
        const fix = await loadFix(base, item.dir, item.attempt, runAudio);
        fixes.set(item.dir, fix);
        if (fix.lane) lanes.set(item.dir, fix.lane);
      }
    }),
  );
  const fixture = Boolean(meta.fixture || meta.label === 'fixture');
  return { id, base, meta, fixture, lanes, fixes, sequence: sequence.filter((s) => (s.kind === 'lane' ? lanes.has(s.dir) : true)) };
}
