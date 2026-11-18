import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withRecordedChrome } from './chrome.js';
import { parseKaneNdjson, summarizeKane } from './parsers.js';

// Every Kane call on a machine is serialized through one lock file (override with BLINDRUN_KANE_LOCK).
export const LOCK_PATH = process.env.BLINDRUN_KANE_LOCK ?? '/home/aldridge/kane-cli-hackathon/build/kane.lock';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const saveJson = (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`);

export function kaneCommand(args) {
  return process.env.BLINDRUN_NO_LOCK ? ['kane-cli', args] : ['flock', [LOCK_PATH, 'kane-cli', ...args]];
}

export function blindObjective(task, expect) {
  // The final check must read the page's text, as a screen reader does: a visual check of a black screen always fails.
  return `You are a blind user who navigates with the keyboard only (Tab, Shift+Tab, Enter, Space, arrow keys).\nThe mouse does not work and the screen is black.\n${task}\nVerify, by reading the page text as a screen reader would, that the page says ${JSON.stringify(expect)}.`;
}

export function sightedObjective(task, expect) {
  return `${task}\nVerify the page says ${JSON.stringify(expect)}.`;
}

export async function collectProcess(proc, { onStdout, timeoutMs } = {}) {
  let stdout = '';
  let stderr = '';
  proc.stdout?.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; onStdout?.(chunk); });
  proc.stderr?.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  let timer;
  if (timeoutMs) timer = setTimeout(() => { stderr += `\n[blindrun] killed after ${timeoutMs} ms\n`; proc.kill('SIGTERM'); }, timeoutMs);
  const exitCode = await new Promise((resolve) => {
    proc.once('error', (error) => { stderr += String(error); resolve(127); });
    proc.once('close', (code) => resolve(code ?? 1));
  });
  clearTimeout(timer);
  return { stdout, stderr, exitCode };
}

const rebase = (items, origin) => {
  const kept = items.filter((item) => item.at >= origin).map(({ at, ...rest }) => ({ ...rest, t: at - origin }));
  return kept;
};

/** Keeps frames at least `gap` ms apart (always the first and the last). */
export function thin(frames, gap) {
  const out = [];
  for (const [i, frame] of frames.entries()) {
    if (!out.length || frame.t - out.at(-1).t >= gap || i === frames.length - 1) out.push(frame);
  }
  return out;
}

/** Runs one Kane lane (sighted or blind) in a fresh recorded Chrome and writes the lane directory. */
// A keyboard user needs far more key presses than a mouse user needs clicks, so blind lanes get a larger step budget.
export const STEPS = { sighted: 40, blind: 100 };

export async function runLane({ url, task, expect, laneDir, blind, timeout = 900, maxSteps = blind ? STEPS.blind : STEPS.sighted, chromePath, frameIntervalMs, log = () => {} }) {
  await mkdir(laneDir, { recursive: true });
  const objective = blind ? blindObjective(task, expect) : sightedObjective(task, expect);
  const lane = await withRecordedChrome({ url, laneDir, blind, chromePath, frameIntervalMs: frameIntervalMs ?? (blind ? 1000 : 900) }, async ({ endpoint, recorder }) => {
    const args = ['run', objective, '--url', url, '--cdp-endpoint', endpoint, '--agent', '--bug-detection', 'continue', '--assertion-mode', 'dom', '--max-steps', String(maxSteps), '--timeout', String(timeout)];
    const [cmd, cmdArgs] = kaneCommand(args);
    log(`kane ${blind ? 'blind' : 'sighted'} lane: waiting for the Kane lock, then running (max ${maxSteps} steps)`);
    const spawnedAt = Date.now();
    let firstOutputAt = null;
    const proc = spawn(cmd, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out = await collectProcess(proc, {
      timeoutMs: (timeout + 900) * 1000,
      onStdout: (chunk) => {
        firstOutputAt ??= Date.now();
        for (const line of chunk.split('\n')) {
          const m = line.match(/"step":(\d+),"status":"(done|failed)","remark":"([^"]{0,90})/);
          if (m) log(`  step ${m[1]} ${m[2]}: ${m[3]}`);
        }
      },
    });
    await sleep(800); // let the last frames and announcements land
    return { ...out, spawnedAt, firstOutputAt, recorder };
  });
  await writeFile(join(laneDir, 'kane.ndjson'), lane.stdout);
  if (lane.stderr.trim()) await writeFile(join(laneDir, 'kane.stderr.txt'), lane.stderr);
  const parsed = parseKaneNdjson(lane.stdout);
  if (parsed.malformed.length) await saveJson(join(laneDir, 'kane.parse-warnings.json'), parsed.malformed);
  const summary = summarizeKane(parsed.records, lane.exitCode);
  const start = parsed.records.find((record) => record.type === 'stream_start');
  const origin = start?.ts ? Date.parse(start.ts) : lane.firstOutputAt ?? lane.spawnedAt;
  // The lane ends shortly after Kane's last step; Kane's upload and verdict tail is not user time.
  const stepTs = parsed.records.filter((record) => Number.isFinite(record.step)).map((record) => Date.parse(record.ts)).filter(Number.isFinite);
  const lastTs = (stepTs.at(-1) ?? origin) + 2500;
  const { recorder } = lane;
  // The frame showing the page at t=0 is the newest one captured before Kane started.
  const before = recorder.frames.filter((frame) => frame.at < origin).at(-1);
  const laneEnd = Math.max(summary.durationMs ?? 0, lastTs - origin);
  const frames = thin([...(before ? [{ file: before.file, t: 0 }] : []), ...rebase(recorder.frames, origin)].filter((frame) => frame.t <= laneEnd + 1000), blind ? 1000 : 1200);
  const announcements = rebase(recorder.announcements, origin);
  await saveJson(join(laneDir, 'frames.json'), frames);
  await writeFile(join(laneDir, 'announcements.jsonl'), announcements.map((item) => JSON.stringify(item)).join('\n') + (announcements.length ? '\n' : ''));
  const data = {
    lane: blind ? 'blind' : 'sighted',
    status: summary.status,
    resultCode: summary.resultCode,
    reasonCode: summary.reasonCode,
    durationMs: Math.max(summary.durationMs ?? 0, lastTs - origin),
    kaneDurationMs: summary.durationMs,
    steps: summary.steps,
    credits: summary.credits,
    verdict: summary.verdict,
    reason: summary.reason,
    oneLiner: summary.oneLiner,
    testUrl: summary.testUrl,
    startedAt: new Date(origin).toISOString(),
    viewport: recorder.viewport,
    objective,
    exitCode: lane.exitCode,
    kaneVersion: start?.cli_version ?? null,
  };
  await saveJson(join(laneDir, 'lane.json'), data);
  // Frames captured while waiting for the Kane lock are not part of the lane; drop them.
  const used = new Set(frames.map((frame) => frame.file));
  await Promise.all(recorder.frames.filter((frame) => !used.has(frame.file)).map((frame) => unlink(join(laneDir, frame.file)).catch(() => {})));
  return data;
}

/** `kane-cli explore` on this machine (read-only, one lease). Records the stream verbatim and what it found. */
export async function runExplore({ url, outDir, prompt = 'Explore the booking flow with the keyboard and note accessibility problems', maxLeases = 3, project, log = () => {} }) {
  await mkdir(outDir, { recursive: true });
  const args = ['explore', 'run', '--url', url, '--prompt', prompt, '--max-leases', String(maxLeases), '--local-orchestration', '--browser', 'local', '--headless', '--policy', 'read_only', '--no-recheck', '--agent', ...(project ? ['--project', project] : [])];
  const [cmd, cmdArgs] = kaneCommand(args);
  log(`kane explore: ${args.join(' ')}`);
  const started = Date.now();
  // explore writes step_*.json and run_summary.json into its working directory; keep those out of the caller's tree.
  const cwd = await mkdtemp(join(tmpdir(), 'blindrun-explore-'));
  const out = await collectProcess(spawn(cmd, cmdArgs, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }), { timeoutMs: 20 * 60 * 1000 });
  await writeFile(join(outDir, 'explore.ndjson'), out.stdout);
  if (out.stderr.trim()) await writeFile(join(outDir, 'explore.stderr.txt'), out.stderr);
  const { records } = parseKaneNdjson(out.stdout);
  const done = records.findLast((record) => record.type === 'done') ?? null;
  // Findings (including Kane's axe-core accessibility checks) are committed to the local exploration map,
  // not streamed; read them from the run directory Kane reports.
  const findings = done?.run_dir ? await readExploreFindings(done.run_dir) : [];
  const credits = Number(done?.credits?.total ?? 0);
  const result = { mode: 'explore', url, prompt, args, exitCode: out.exitCode, durationMs: Date.now() - started, done, findings, credits, recordTypes: [...new Set(records.map((record) => record.type))] };
  await saveJson(join(outDir, 'findings.json'), result);
  return result;
}

async function readExploreFindings(runDir) {
  let text = '';
  try { text = await readFile(join(runDir, 'pending-deltas.ndjson'), 'utf8'); } catch { return []; }
  const byId = new Map();
  for (const record of parseKaneNdjson(text).records) {
    for (const f of (record.delta ?? record).findings ?? []) {
      const rule = String(f.recommendation ?? '').match(/rules\/axe\/[\d.]+\/([a-z0-9-]+)/)?.[1] ?? null;
      byId.set(f.id, { id: f.id, kind: f.kind, severity: f.severity, title: f.title, description: f.description, axeRule: rule, recommendation: f.recommendation, confirmed: f.confirmed });
    }
  }
  return [...byId.values()];
}
