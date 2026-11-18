import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { runExplore, runLane, runLanes, collectProcess, waitForUrl } from './engine.js';
import { parseKaneNdjson, summarizeKane } from './parsers.js';
import { synthesizeRun } from './voice.js';

const help = `blindrun — accessibility checks with recorded Kane evidence

Usage:
  blindrun run <url> <task> --expect <text> [--out runs/<id>] [--lanes sighted,blind]
  blindrun fix <runDir> --app <path> [--max-attempts 3]
  blindrun explore <url> [--out runs/<id>/explore]
  blindrun voice <runDir>
  blindrun demo [--out runs/<id>] [--base-url http://127.0.0.1:4310]
`;

function parseArgs(args) {
  const positional = [];
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const value = args[i];
    if (!value.startsWith('--')) { positional.push(value); continue; }
    const key = value.slice(2);
    if (i + 1 >= args.length || args[i + 1].startsWith('--')) options[key] = true;
    else options[key] = args[++i];
  }
  return { positional, options };
}

const runId = () => new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const iso = () => new Date().toISOString();
const saveJson = (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const command = async (cmd, args, { cwd, env } = {}) => {
  const proc = spawn(cmd, args, { cwd, env: env ?? process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  const result = await collectProcess(proc);
  return result;
};
const git = (cwd, ...args) => command('git', args, { cwd });

function errorOn(result, label) {
  if (result.exitCode !== 0) throw new Error(`${label} failed (${result.exitCode}): ${result.stderr.trim() || result.stdout.trim()}`);
  return result.stdout.trim();
}

function extractVerdict(summary) {
  const v = summary?.verdict ?? {};
  return {
    error_message: v.error_message ?? v.reason ?? '',
    summary: v.summary ?? summary?.summary ?? '',
    suggestion: v.suggestion ?? '',
    relevant_steps: v.relevant_steps ?? [],
    bug_title: v.bug_title ?? '',
    family: v.family ?? '',
    result_code: summary?.resultCode ?? null,
  };
}

function stripKeyValues(source, names) {
  const wanted = new Set(names);
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(/^(?:export\s+)?([A-Z0-9_]+)=(.*)$/);
    if (!match || !wanted.has(match[1])) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (value) process.env[match[1]] = value;
  }
}

async function loadVoiceKey() {
  if (process.env.ELEVENLABS_API_KEY) return;
  const envPath = '/home/aldridge/kane-cli-hackathon/.env';
  let source;
  try { source = await readFile(envPath, 'utf8'); }
  catch { throw new Error(`ELEVENLABS_API_KEY is unset and ${envPath} is unavailable`); }
  stripKeyValues(source, ['ELEVENLABS_API_KEY']);
  if (!process.env.ELEVENLABS_API_KEY) throw new Error(`ELEVENLABS_API_KEY was not found in ${envPath}`);
}

async function runCommand({ positional, options }) {
  const [url, task] = positional;
  const expect = options.expect;
  if (!url || !task || typeof expect !== 'string') throw new Error('run needs <url> <task> and --expect <text>');
  const id = runId();
  const outDir = resolve(options.out ?? join('runs', id));
  await mkdir(outDir, { recursive: true });
  const lanes = String(options.lanes ?? 'sighted,blind').split(',').map((lane) => lane.trim()).filter(Boolean);
  if (lanes.some((lane) => !['sighted', 'blind'].includes(lane))) throw new Error('--lanes accepts sighted and blind');
  const t0 = Date.now();
  const results = await runLanes({ url, task, expect, outDir, lanes, timeout: Number(options.timeout ?? 400), maxSteps: Number(options['max-steps'] ?? 15), chromePath: options.chrome });
  const sequence = lanes.map((lane) => ({ kind: 'lane', lane, dir: lane, t0: 0, t1: Date.now() - t0 }));
  const firstEnd = Object.values(results)[0];
  const records = parseKaneNdjson(await readFile(join(outDir, lanes[0], 'kane.ndjson'), 'utf8')).records;
  const run = {
    id, createdAt: iso(), url, task, expect, app: options.app ? { name: options.app, commit: options.commit ?? null } : undefined,
    kaneVersion: records.find((record) => record.type === 'stream_start')?.cli_version ?? 'unknown', sequence,
    outcome: { blindBefore: results.blind?.status ?? null, blindAfter: results.blind?.status ?? null, barriers: [] },
  };
  await saveJson(join(outDir, 'run.json'), run);
  process.stdout.write(`${outDir}\n`);
  if (firstEnd?.status === 'unknown') process.exitCode = 1;
}

async function runFixLoop({ runDir, appDir, maxAttempts, runData, startSequence = 0, sequence = [] }) {
  let blindResult = await readJson(join(runDir, startSequence ? 'blind/lane.json' : 'blind/lane.json'));
  let latest = blindResult;
  const appRoot = resolve(appDir);
  const repoRoot = errorOn(await git(appRoot, 'rev-parse', '--show-toplevel'), 'git root lookup');
  const srcDir = join(appRoot, 'src');
  const initialParsed = parseKaneNdjson(await readFile(join(runDir, 'blind/kane.ndjson'), 'utf8'));
  let currentSummary = summarizeKane(initialParsed.records, 1);
  for (let attempt = 1; attempt <= maxAttempts && latest.status !== 'passed'; attempt += 1) {
    const attemptName = `fix-${attempt}`;
    const attemptDir = join(runDir, attemptName);
    await mkdir(attemptDir, { recursive: true });
    const verdict = extractVerdict(currentSummary);
    let announcements = '';
    try { announcements = await readFile(join(runDir, 'blind/announcements.jsonl'), 'utf8'); } catch { /* optional */ }
    const brief = `# Blind Run fix brief — attempt ${attempt}\n\n## Kane verdict\n- Result code: ${verdict.result_code}\n- Bug: ${verdict.bug_title}\n- Error: ${verdict.error_message}\n\n${verdict.summary}\n\n## Suggested fix\n${verdict.suggestion}\n\n## Relevant Kane steps\n${JSON.stringify(verdict.relevant_steps)}\n\n## Screen-reader announcements\n\n\`\`\`jsonl\n${announcements.trim()}\n\`\`\`\n\nFix the confirmed issue in this app's src files only. Do not edit tests, the task/objective, Blind Run, or files outside this src directory. Preserve the intended app behavior and accessibility. Run no tests.`;
    await writeFile(join(attemptDir, 'brief.md'), brief);
    const prompt = `Read the fix brief below and inspect this application source. Make the smallest real code change that addresses Kane's confirmed user-facing defect. You may edit files only in the current src directory. Do not edit tests or objectives.\n\n${brief}`;
    const agent = spawn('claude', [
      '-p', '--restricted', '--safe-mode', '--permission-mode', 'acceptEdits', '--permission-prompts', 'none',
      '--tools', 'Read,Edit,Write', '--add-dir', srcDir, '--output-format', 'text', prompt,
    ], { cwd: srcDir, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    const agentOutput = await collectProcess(agent);
    const agentLog = `${agentOutput.stdout}${agentOutput.stderr ? `\n[stderr]\n${agentOutput.stderr}` : ''}`;
    await writeFile(join(attemptDir, 'agent.log'), agentLog);
    if (agentOutput.exitCode !== 0) {
      await saveJson(join(attemptDir, 'result.json'), { attempt, status: 'agent_failed', exitCode: agentOutput.exitCode });
      break;
    }
    const changedPaths = errorOn(await git(repoRoot, 'status', '--short'), 'git status').split(/\r?\n/).filter(Boolean).map((line) => line.slice(3));
    const outsideSource = changedPaths.filter((path) => !path.startsWith(relative(repoRoot, srcDir) + '/'));
    if (outsideSource.length) {
      await saveJson(join(attemptDir, 'result.json'), { attempt, status: 'out_of_scope_edit', files: outsideSource });
      throw new Error(`Claude edited files outside app/src: ${outsideSource.join(', ')}`);
    }
    const patch = await git(repoRoot, 'diff', '--', relative(repoRoot, srcDir));
    await writeFile(join(attemptDir, 'diff.patch'), patch.stdout);
    const build = await command('pnpm', ['--filter', 'encore', 'build'], { cwd: repoRoot });
    if (build.exitCode !== 0) {
      await writeFile(join(attemptDir, 'build.log'), `${build.stdout}${build.stderr}`);
      await saveJson(join(attemptDir, 'result.json'), { attempt, status: 'build_failed', exitCode: build.exitCode });
      break;
    }
    const priorLaneData = runData;
    const rerun = await runLane({ url: priorLaneData.url, task: priorLaneData.task, expect: priorLaneData.expect, lane: 'blind', outDir: attemptDir, timeout: 400, maxSteps: 15 });
    for (const file of ['kane.ndjson', 'lane.json', 'frames.json', 'announcements.jsonl']) {
      try { await rename(join(attemptDir, 'blind', file), join(attemptDir, file)); } catch { /* optional */ }
    }
    try { await rename(join(attemptDir, 'blind', 'frames'), join(attemptDir, 'frames')); } catch { /* optional */ }
    try { await rm(join(attemptDir, 'blind'), { recursive: true, force: true }); } catch { /* optional */ }
    latest = rerun;
    const records = parseKaneNdjson(await readFile(join(attemptDir, 'kane.ndjson'), 'utf8')).records;
    currentSummary = summarizeKane(records, rerun.status === 'passed' ? 0 : 1);
    await saveJson(join(attemptDir, 'result.json'), { attempt, status: rerun.status, resultCode: rerun.resultCode, credits: rerun.credits, verdict: rerun.verdict });
    sequence.push({ kind: 'fix', attempt, dir: attemptName, t0: Date.now(), t1: Date.now() });
    process.stdout.write(`attempt ${attempt}: ${rerun.status} (result ${rerun.resultCode ?? 'unknown'})\n`);
  }
  if (latest.status !== 'passed') await writeFile(join(runDir, 'BLOCKED_NEEDS_HUMAN'), `Blind verification did not pass within ${maxAttempts} attempt(s). Review the attempt briefs, diffs, agent logs, build logs, and Kane evidence.\n`);
  else await rm(join(runDir, 'BLOCKED_NEEDS_HUMAN'), { force: true });
  return latest;
}

async function fixCommand({ positional, options }) {
  const runDir = resolve(positional[0] ?? '');
  const appDir = options.app;
  if (!options.app) throw new Error('fix needs --app <path>');
  const runData = await readJson(join(runDir, 'run.json'));
  const sequence = runData.sequence ?? [];
  const result = await runFixLoop({ runDir, appDir, maxAttempts: Math.min(3, Math.max(1, Number(options['max-attempts'] ?? 3))), runData, sequence });
  runData.sequence = sequence;
  runData.outcome ??= {};
  runData.outcome.blindAfter = result.status;
  await saveJson(join(runDir, 'run.json'), runData);
}

async function demoCommand({ options }) {
  const id = runId();
  const runDir = resolve(options.out ?? join('runs', id));
  const repoRoot = process.cwd();
  const worktree = resolve(tmpdir(), `blindrun-encore-${id}`);
  const url = options['base-url'] ?? 'http://127.0.0.1:4310/';
  const task = 'Book two adjacent seats in row F, seats 14–15, for the Friday 21 November show. Complete checkout using the provided demo form data.';
  const expect = "You're going! Order #ENC-4821, Row F · Seats 14–15";
  await mkdir(runDir, { recursive: true });
  const fetch = await git(repoRoot, 'fetch', 'origin');
  if (fetch.exitCode !== 0) throw new Error(`Could not refresh origin/main: ${fetch.stderr.trim()}`);
  const tag = await git(repoRoot, 'rev-parse', '--verify', 'encore-baseline^{commit}');
  if (tag.exitCode !== 0) throw new Error('encore-baseline tag is not available yet; demo needs the Encore baseline from origin');
  errorOn(await git(repoRoot, 'worktree', 'add', '--detach', worktree, 'encore-baseline'), 'baseline worktree creation');
  const appDir = join(worktree, 'apps', 'encore');
  const commit = errorOn(await git(worktree, 'rev-parse', 'HEAD'), 'baseline commit lookup');
  const server = spawn('pnpm', ['--filter', 'encore', 'dev', '--port', '4310', '--host', '127.0.0.1'], { cwd: worktree, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  let serverLog = '';
  server.stdout.setEncoding('utf8').on('data', (chunk) => { serverLog += chunk; });
  server.stderr.setEncoding('utf8').on('data', (chunk) => { serverLog += chunk; });
  const started = Date.now();
  const sequence = [];
  let blindBefore = null;
  let blindAfter = null;
  let kaneVersion = 'unknown';
  try {
    await waitForUrl(url);
    const sighted = await runLane({ url, task, expect, lane: 'sighted', outDir: runDir });
    sequence.push({ kind: 'lane', lane: 'sighted', dir: 'sighted', t0: 0, t1: Date.now() - started });
    const blind = await runLane({ url, task, expect, lane: 'blind', outDir: runDir });
    blindBefore = blind.status;
    sequence.push({ kind: 'lane', lane: 'blind', dir: 'blind', t0: 0, t1: Date.now() - started });
    const startRecords = parseKaneNdjson(await readFile(join(runDir, 'blind/kane.ndjson'), 'utf8')).records;
    kaneVersion = startRecords.find((record) => record.type === 'stream_start')?.cli_version ?? 'unknown';
    const runData = { url, task, expect };
    const fixStart = Date.now() - started;
    blindAfter = await runFixLoop({ runDir, appDir, maxAttempts: Math.min(3, Math.max(1, Number(options['max-attempts'] ?? 3))), runData, sequence });
    sequence.forEach((entry) => { if (entry.kind === 'fix') { entry.t0 = fixStart; entry.t1 = Date.now() - started; } });
    const finalBlind = await runLane({ url, task, expect, lane: 'blind-after', outDir: runDir });
    blindAfter = finalBlind;
    sequence.push({ kind: 'lane', lane: 'blind', dir: 'blind-after', t0: Date.now() - started, t1: Date.now() - started });
    const barriers = blindBefore === 'failed' ? [{ id: 'B1', wcag: '2.1.1', title: blind.verdict?.bug_title ?? 'Keyboard access barrier', foundBy: 'blind' }] : [];
    const run = {
      id, createdAt: iso(), url, task, expect, app: { name: 'Encore', commit }, kaneVersion, sequence,
      outcome: { blindBefore, blindAfter: blindAfter.status, barriers },
    };
    await saveJson(join(runDir, 'run.json'), run);
    await writeFile(join(runDir, 'demo-server.log'), serverLog);
    process.stdout.write(`${runDir}\n`);
  } finally {
    if (server.exitCode === null) {
      server.kill('SIGTERM');
      await Promise.race([new Promise((resolve) => server.once('exit', resolve)), new Promise((resolve) => setTimeout(resolve, 2000))]);
      if (server.exitCode === null) server.kill('SIGKILL');
    }
    await git(repoRoot, 'worktree', 'remove', '--force', worktree);
  }
}

async function main(args = process.argv.slice(2)) {
  const [commandName, ...rest] = args;
  if (!commandName || ['--help', '-h', 'help'].includes(commandName)) { process.stdout.write(help); return; }
  const parsed = parseArgs(rest);
  if (commandName === 'run') return runCommand(parsed);
  if (commandName === 'fix') return fixCommand(parsed);
  if (commandName === 'explore') {
    const url = parsed.positional[0];
    if (!url) throw new Error('explore needs <url>');
    const out = resolve(parsed.options.out ?? join('runs', runId(), 'explore'));
    const result = await runExplore({ url, outDir: out, prompt: parsed.options.prompt });
    process.stdout.write(`${out} (${result.mode})\n`);
    return;
  }
  if (commandName === 'voice') {
    const runDir = resolve(parsed.positional[0] ?? '');
    if (!parsed.positional[0]) throw new Error('voice needs <runDir>');
    await loadVoiceKey();
    const result = await synthesizeRun(runDir, { apiKey: process.env.ELEVENLABS_API_KEY });
    process.stdout.write(`Generated ${result.length} audio clip(s)\n`);
    return;
  }
  if (commandName === 'demo') return demoCommand(parsed);
  throw new Error(`Unknown command: ${commandName}\n\n${help}`);
}

export { main };
