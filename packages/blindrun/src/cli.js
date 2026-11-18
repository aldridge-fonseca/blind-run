import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { collectProcess, runExplore, runLane, saveJson } from './engine.js';
import { fixLoop } from './fix.js';
import { ENCORE, auditEncore, encoreBarriers } from './encore.js';
import { synthesizeRun } from './voice.js';

const help = `blindrun: does your app work with your eyes closed? Kane CLI finds out.

Usage:
  blindrun run <url> <task> --expect <text> [--out runs/<id>] [--lanes sighted,blind]
  blindrun fix <runDir> --app <dir> [--build "pnpm build"] [--serve "pnpm preview"] [--max-attempts 3]
  blindrun explore <url> [--out <dir>] [--prompt <text>]
  blindrun voice <runDir>
  blindrun demo [--out runs/<id>] [--port 4310] [--max-attempts 3] [--no-voice] [--keep-worktree]

Every Kane call is serialized with flock on $BLINDRUN_KANE_LOCK. Runs are plain files (see ARTIFACTS.md).
`;

function parseArgs(args) {
  const positional = [];
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const value = args[i];
    if (!value.startsWith('--')) { positional.push(value); continue; }
    const key = value.slice(2);
    if (key.startsWith('no-')) options[key.slice(3)] = false;
    else if (i + 1 >= args.length || args[i + 1].startsWith('--')) options[key] = true;
    else options[key] = args[++i];
  }
  return { positional, options };
}

const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
const log = (message) => process.stderr.write(`[blindrun ${new Date().toISOString().slice(11, 19)}] ${message}\n`);
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const run = (cmd, args, opts = {}) => collectProcess(spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts }), opts);
const must = async (promise, label) => {
  const result = await promise;
  if (result.exitCode !== 0) throw new Error(`${label} failed (${result.exitCode}): ${(result.stderr || result.stdout).trim().slice(-1500)}`);
  return result.stdout.trim();
};

async function loadKey(name) {
  if (process.env[name]) return process.env[name];
  const envPath = process.env.BLINDRUN_ENV_FILE ?? '/home/aldridge/kane-cli-hackathon/.env';
  try {
    for (const line of (await readFile(envPath, 'utf8')).split(/\r?\n/)) {
      const m = line.trim().match(/^(?:export\s+)?([A-Z0-9_]+)=(.*)$/);
      if (m && m[1] === name) return m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch { /* no env file */ }
  return null;
}

async function waitForUrl(url, timeoutMs = 30000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`app did not come up at ${url}`);
}

/** A long-running server in its own process group, so stopping it also stops its children. */
function startServer(command, cwd) {
  const proc = spawn('sh', ['-c', command], { cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  proc.stdout.on('data', (d) => { output += d; });
  proc.stderr.on('data', (d) => { output += d; });
  return {
    output: () => output,
    async stop() {
      if (proc.exitCode !== null) return;
      try { process.kill(-proc.pid, 'SIGTERM'); } catch { /* gone */ }
      await Promise.race([new Promise((r) => proc.once('exit', r)), new Promise((r) => setTimeout(r, 3000))]);
      if (proc.exitCode === null) try { process.kill(-proc.pid, 'SIGKILL'); } catch { /* gone */ }
    },
  };
}

function laneEntry(lane, dir, t0, runStart) {
  return { kind: 'lane', lane, dir, t0, t1: Date.now() - runStart };
}

async function runCommand({ positional, options }) {
  const [url, task] = positional;
  if (!url || !task || typeof options.expect !== 'string') throw new Error('run needs <url> <task> --expect <text>');
  const id = options.id ?? stamp();
  const runDir = resolve(options.out ?? join('runs', id));
  await mkdir(runDir, { recursive: true });
  const lanes = String(options.lanes ?? 'sighted,blind').split(',').map((s) => s.trim()).filter(Boolean);
  const runStart = Date.now();
  const sequence = [];
  const results = {};
  for (const lane of lanes) {
    if (!['sighted', 'blind'].includes(lane)) throw new Error('--lanes accepts sighted and blind');
    const t0 = Date.now() - runStart;
    results[lane] = await runLane({ url, task, expect: options.expect, laneDir: join(runDir, lane), blind: lane === 'blind', maxSteps: Number(options['max-steps'] ?? 60), log });
    sequence.push(laneEntry(lane, lane, t0, runStart));
    log(`${lane}: ${results[lane].status} (${results[lane].resultCode})`);
  }
  await saveJson(join(runDir, 'run.json'), {
    id, createdAt: new Date(runStart).toISOString(), url, task, expect: options.expect, app: { name: options.app ?? new URL(url).host, commit: null },
    kaneVersion: Object.values(results)[0]?.kaneVersion ?? null, sequence,
    outcome: { blindBefore: results.blind?.status ?? null, blindAfter: null, barriers: [] },
  });
  process.stdout.write(`${runDir}\n`);
  if (results.blind?.status === 'failed') process.exitCode = 2;
}

async function fixCommand({ positional, options }) {
  const runDir = resolve(positional[0] ?? '');
  if (!options.app) throw new Error('fix needs --app <dir> (the app directory; its src/ is the only thing the agent may edit)');
  const appDir = resolve(options.app);
  const runData = await readJson(join(runDir, 'run.json'));
  const blindItem = [...runData.sequence].reverse().find((s) => s.kind === 'lane' && s.lane === 'blind');
  if (!blindItem) throw new Error('run has no blind lane');
  const lane = await readJson(join(runDir, blindItem.dir, 'lane.json'));
  const repoRoot = await must(run('git', ['rev-parse', '--show-toplevel'], { cwd: appDir }), 'git root');
  let server = null;
  const serve = options.serve ?? 'pnpm preview';
  const rebuild = async () => {
    await server?.stop();
    await must(run('sh', ['-c', options.build ?? 'pnpm build'], { cwd: appDir }), 'build');
    server = startServer(serve, appDir);
    await waitForUrl(runData.url);
  };
  const runStart = Date.parse(runData.createdAt) || Date.now();
  try {
    const last = await fixLoop({ runDir, repoRoot, srcDir: join(appDir, 'src'), url: runData.url, task: runData.task, expect: runData.expect, failed: { dir: blindItem.dir, lane }, maxAttempts: Math.min(3, Number(options['max-attempts'] ?? 3)), rebuild, runStart, sequence: runData.sequence, log });
    runData.outcome = { ...runData.outcome, blindAfter: last.status };
    await saveJson(join(runDir, 'run.json'), runData);
    log(`blind after fix: ${last.status}`);
  } finally {
    await server?.stop();
  }
}

/** The showcase: Encore baseline -> sighted -> blind -> fix loop -> green blind rerun -> voice. */
async function demoCommand({ options }) {
  const repoRoot = await must(run('git', ['rev-parse', '--show-toplevel']), 'git root');
  const id = options.id ?? `encore-${stamp()}`;
  const runDir = resolve(repoRoot, options.out ?? join('runs', id));
  const port = Number(options.port ?? 4310);
  const url = `http://127.0.0.1:${port}/`;
  const worktree = join(process.env.BLINDRUN_TMP ?? tmpdir(), `blindrun-${id}`);
  await mkdir(runDir, { recursive: true });
  const baseline = await must(run('git', ['rev-parse', `${ENCORE.tag}^{commit}`], { cwd: repoRoot }), `the ${ENCORE.tag} tag`);
  log(`baseline ${ENCORE.tag} = ${baseline.slice(0, 7)}; checking out a throwaway worktree at ${worktree}`);
  await must(run('git', ['worktree', 'add', '--detach', worktree, baseline], { cwd: repoRoot }), 'git worktree add');
  const appDir = join(worktree, ENCORE.appPath);
  let server = null;
  const rebuild = async () => {
    await server?.stop();
    await must(run('pnpm', ['--filter', 'encore', 'build'], { cwd: worktree }), 'encore build');
    server = startServer(`pnpm --filter encore exec vite preview --port ${port} --strictPort --host 127.0.0.1`, worktree);
    await waitForUrl(url);
  };
  const runStart = Date.now();
  const sequence = [];
  const writeRun = async (extra = {}) => saveJson(join(runDir, 'run.json'), {
    id, title: 'Encore · book two seats, eyes closed', createdAt: new Date(runStart).toISOString(), url, task: ENCORE.task, expect: ENCORE.expect,
    app: { name: ENCORE.name, path: ENCORE.appPath, baseline: ENCORE.tag, commit: baseline }, kaneVersion: sighted?.kaneVersion ?? null, sequence, ...extra,
  });
  let sighted = null;
  try {
    await must(run('pnpm', ['install', '--frozen-lockfile', '--offline', '--filter', 'encore...'], { cwd: worktree }), 'pnpm install (worktree)');
    await rebuild();
    const auditBefore = await auditEncore(url);
    await mkdir(join(runDir, 'audit'), { recursive: true });
    await saveJson(join(runDir, 'audit', 'before.json'), auditBefore);
    log(`audit (baseline): ${auditBefore.filter((b) => b.present).map((b) => b.id).join(' ') || 'no planted barriers present'}`);

    let t0 = Date.now() - runStart;
    sighted = await runLane({ url, task: ENCORE.task, expect: ENCORE.expect, laneDir: join(runDir, 'sighted'), blind: false, maxSteps: 40, log });
    sequence.push(laneEntry('sighted', 'sighted', t0, runStart));
    log(`sighted: ${sighted.status} (${sighted.resultCode}), ${Math.round(sighted.durationMs / 1000)} s, ${sighted.credits} credits`);
    await writeRun();

    t0 = Date.now() - runStart;
    const blind = await runLane({ url, task: ENCORE.task, expect: ENCORE.expect, laneDir: join(runDir, 'blind'), blind: true, maxSteps: 60, log });
    sequence.push(laneEntry('blind', 'blind', t0, runStart));
    log(`blind: ${blind.status} (${blind.resultCode}) ${blind.reason ?? ''}`);
    await writeRun();

    const blindLanes = [blind];
    let last = blind;
    if (blind.status !== 'passed') {
      last = await fixLoop({
        runDir, repoRoot: worktree, srcDir: join(appDir, 'src'), url, task: ENCORE.task, expect: ENCORE.expect, failed: { dir: 'blind', lane: blind },
        maxAttempts: Math.min(3, Number(options['max-attempts'] ?? 3)), rebuild, runStart, sequence, log,
        claudeModel: options.model,
      });
      for (const item of sequence.filter((s) => s.kind === 'fix')) {
        try { blindLanes.push(await readJson(join(runDir, item.dir, 'lane.json'))); } catch { /* attempt had no rerun */ }
      }
    }
    const auditAfter = await auditEncore(url);
    await saveJson(join(runDir, 'audit', 'after.json'), auditAfter);
    log(`audit (after): ${auditAfter.filter((b) => b.present).map((b) => b.id).join(' ') || 'no planted barriers present'}`);
    const fixedDiff = (await run('git', ['diff', baseline, '--', ENCORE.appPath + '/src'], { cwd: worktree })).stdout;
    if (fixedDiff.trim()) await writeFile(join(runDir, 'fix.patch'), fixedDiff);
    await writeRun({ outcome: { blindBefore: blind.status, blindAfter: last.status, barriers: encoreBarriers({ before: auditBefore, after: auditAfter, blindLanes }) } });
    if (options.voice !== false) {
      const apiKey = await loadKey('ELEVENLABS_API_KEY');
      if (apiKey) await synthesizeRun(runDir, { apiKey, log }).catch((error) => log(`voice skipped: ${error.message}`));
      else log('voice skipped: ELEVENLABS_API_KEY not set');
    }
    process.stdout.write(`${runDir}\n`);
  } finally {
    await server?.stop();
    if (!options['keep-worktree']) await run('git', ['worktree', 'remove', '--force', worktree], { cwd: repoRoot });
    else log(`fixed app kept at ${worktree}`);
  }
}

export async function main(args = process.argv.slice(2)) {
  const [name, ...rest] = args;
  if (!name || ['--help', '-h', 'help'].includes(name)) { process.stdout.write(help); return; }
  const parsed = parseArgs(rest);
  if (name === 'run') return runCommand(parsed);
  if (name === 'fix') return fixCommand(parsed);
  if (name === 'demo') return demoCommand(parsed);
  if (name === 'explore') {
    const url = parsed.positional[0];
    if (!url) throw new Error('explore needs <url>');
    const outDir = resolve(parsed.options.out ?? join('runs', `explore-${stamp()}`));
    const result = await runExplore({ url, outDir, prompt: parsed.options.prompt, maxLeases: Number(parsed.options['max-leases'] ?? 3), log });
    log(`explore exit ${result.exitCode}; ${result.findings.length} finding record(s)`);
    process.stdout.write(`${outDir}\n`);
    return;
  }
  if (name === 'voice') {
    if (!parsed.positional[0]) throw new Error('voice needs <runDir>');
    const apiKey = await loadKey('ELEVENLABS_API_KEY');
    await synthesizeRun(resolve(parsed.positional[0]), { apiKey, log });
    return;
  }
  throw new Error(`unknown command: ${name}\n\n${help}`);
}
