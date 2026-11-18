// The closed loop: Kane's blind verdict -> a fix brief -> headless Claude Code edits the app's src only ->
// rebuild -> Kane reruns the same task blind. Only a green blind run ends the loop.
import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { collectProcess, runLane, saveJson } from './engine.js';
import { parseKaneNdjson } from './parsers.js';

const run = (cmd, args, opts = {}) => collectProcess(spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts }), opts);
const git = (cwd, ...args) => run('git', args, { cwd });

async function readLines(path) {
  try { return (await readFile(path, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line)); } catch { return []; }
}

async function kaneSteps(laneDir) {
  try {
    const { records } = parseKaneNdjson(await readFile(join(laneDir, 'kane.ndjson'), 'utf8'));
    return records.filter((r) => Number.isFinite(r.step) && r.status !== 'running').map((r) => `${r.step}. [${r.status}] ${String(r.remark ?? '').split(' | HINTS')[0]}`);
  } catch { return []; }
}

export async function writeBrief({ attempt, task, expect, laneDir, lane, history }) {
  const v = lane.verdict ?? {};
  const said = (await readLines(join(laneDir, 'announcements.jsonl'))).map((a) => `- ${(a.t / 1000).toFixed(1)}s ${a.source === 'live' ? '(live) ' : ''}"${a.text}"`);
  const steps = await kaneSteps(laneDir);
  const lines = [
    `# Blind Run fix brief · attempt ${attempt}`,
    '',
    'Kane CLI ran this task as a blind user: keyboard only (Tab, Shift+Tab, Enter, Space, arrow keys), mouse disabled, screen black.',
    '',
    `**Task:** ${task}`,
    `**Must end with:** ${expect}`,
    '',
    `## Kane verdict (result ${lane.resultCode ?? 'unknown'}${lane.reasonCode ? `, ${lane.reasonCode}` : ''})`,
    '',
    v.bug_title ? `**${v.bug_title}**` : '',
    '',
    lane.reason ? `> ${lane.reason}` : '',
    '',
    v.root_cause ? `Root cause: ${v.root_cause}` : '',
    '',
    v.suggestion ? `Kane's suggestion: ${v.suggestion}` : '',
    '',
    '## What Kane did',
    '',
    ...steps.map((s) => `- ${s}`),
    '',
    '## What the screen reader said',
    '',
    ...(said.length ? said : ['- (nothing: focus never reached a control)']),
  ];
  if (history.length) {
    lines.push('', '## Earlier attempts in this loop', '');
    for (const h of history) lines.push(`- Attempt ${h.attempt}: ${h.summary}`);
  }
  return lines.filter((line, i, all) => !(line === '' && all[i - 1] === '')).join('\n') + '\n';
}

const RULES = `Rules:
- Edit only files inside the current directory (the app's src). Do not add tests or test hooks, and do not change the task, the confirmation copy, or the visual design beyond what the fix needs.
- Use standard accessible patterns: native <button>/<input>/<label> elements, or correct ARIA roles with tabIndex and Enter/Space handling; an accessible name for every icon-only control; a programmatic label for every form field (placeholders are not labels); dialogs with role="dialog", aria-modal and a name, that move focus inside when they open, keep Tab inside, close on Escape and return focus; aria-live for status changes such as a quantity or a selection.
- For a large collection of items (a grid, a long list), keep keyboard use efficient: one Tab stop with arrow keys (roving tabindex), and give every item a descriptive name and its selected or unavailable state.
- Fix the defect Kane reported first. Kane reruns the whole task blind, so then check the rest of the task's steps for the same kinds of keyboard and screen-reader barriers and fix those too.
- You cannot run commands. Make careful, type-correct TypeScript edits; the app is rebuilt with Vite after you finish.
- Finish with a short plain-text summary of what you changed and why.`;

function summarizeAgentStream(stdout) {
  const log = [];
  let result = null;
  for (const line of stdout.split('\n')) {
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.type === 'system' && event.subtype === 'init') log.push(`[init] model=${event.model} tools=${(event.tools ?? []).join(',')} permissionMode=${event.permissionMode}`);
    if (event.type === 'assistant') {
      for (const part of event.message?.content ?? []) {
        if (part.type === 'text' && part.text.trim()) log.push(`[claude] ${part.text.trim()}`);
        if (part.type === 'tool_use') {
          const target = part.input?.file_path ?? part.input?.pattern ?? part.input?.path ?? '';
          log.push(`[tool] ${part.name} ${String(target).replace(/^.*?\/apps\//, 'apps/')}`);
        }
      }
    }
    if (event.type === 'user') {
      for (const part of event.message?.content ?? []) {
        if (part.type === 'tool_result' && part.is_error) log.push(`[tool error] ${String(typeof part.content === 'string' ? part.content : JSON.stringify(part.content)).slice(0, 300)}`);
      }
    }
    if (event.type === 'result') result = event;
  }
  if (result) log.push(`[result] ${result.subtype} turns=${result.num_turns} duration=${Math.round((result.duration_ms ?? 0) / 1000)}s cost=$${(result.total_cost_usd ?? 0).toFixed(2)}`);
  return { log: log.join('\n') + '\n', result };
}

/**
 * @param {object} o
 * @param {string} o.runDir      run directory
 * @param {string} o.repoRoot    git checkout that holds the app (a throwaway worktree of the baseline)
 * @param {string} o.srcDir      the only directory the agent may edit
 * @param {object} o.failed      { dir, lane } of the failing blind lane
 * @param {() => Promise<void>} o.rebuild  rebuilds and restarts the app; throws with build output on failure
 */
export async function fixLoop({ runDir, repoRoot, srcDir, url, task, expect, failed, maxAttempts = 3, rebuild, runStart, sequence, log = () => {}, claudeModel }) {
  const history = [];
  const srcRel = relative(repoRoot, srcDir);
  let current = failed;
  let last = failed.lane;
  for (let attempt = 1; attempt <= maxAttempts && last.status !== 'passed'; attempt++) {
    const dir = `fix-${attempt}`;
    const fixDir = join(runDir, dir);
    await mkdir(fixDir, { recursive: true });
    const t0 = Date.now() - runStart;
    const brief = await writeBrief({ attempt, task, expect, laneDir: join(runDir, current.dir), lane: current.lane, history });
    await writeFile(join(fixDir, 'brief.md'), brief);
    const prompt = `You are fixing a web app so a blind keyboard and screen-reader user can complete a task. An automated blind user (Kane CLI) failed; its evidence is below. Your fix only counts if Kane's blind rerun of the same task passes.\n\n${RULES}\n\n${brief}`;
    const args = ['-p', prompt, '--restricted', '--safe-mode', '--no-session-persistence', '--permission-mode', 'acceptEdits', '--permission-prompts', 'none',
      '--tools', 'Read,Edit,Write,Glob,Grep', '--output-format', 'stream-json', '--verbose', '--max-budget-usd', '6', ...(claudeModel ? ['--model', claudeModel] : [])];
    log(`fix ${attempt}: claude -p (Read/Edit/Write/Glob/Grep, cwd ${srcRel})`);
    const agent = await run('claude', args, { cwd: srcDir, timeoutMs: 25 * 60 * 1000 });
    const { log: agentLog, result } = summarizeAgentStream(agent.stdout);
    await writeFile(join(fixDir, 'agent.log'), `$ claude ${args.filter((a) => a !== prompt).map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')} "<brief.md + rules>"\n# cwd: ${srcRel}\n\n${agentLog}${agent.exitCode ? `\n[exit ${agent.exitCode}] ${agent.stderr.slice(-800)}\n` : ''}`);
    const agentInfo = { exitCode: agent.exitCode, turns: result?.num_turns ?? null, durationMs: result?.duration_ms ?? null, costUsd: result?.total_cost_usd ?? null, summary: result?.result ?? null };

    // Scope gate: anything the agent touched outside src is reverted and the attempt is void.
    const status = (await git(repoRoot, 'status', '--porcelain', '--untracked-files=all')).stdout.split('\n').filter(Boolean).map((l) => l.slice(3));
    const outside = status.filter((p) => !p.startsWith(`${srcRel}/`));
    await git(repoRoot, 'add', '--intent-to-add', '--', srcRel);
    const diff = (await git(repoRoot, 'diff', '--', srcRel)).stdout;
    await writeFile(join(fixDir, 'diff.patch'), diff);
    await git(repoRoot, 'add', '--', srcRel);
    const files = [...diff.matchAll(/^diff --git a\/(\S+)/gm)].map((m) => m[1]);
    const finish = async (extra) => {
      const res = { attempt, agent: agentInfo, files, ...extra };
      await saveJson(join(fixDir, 'result.json'), res);
      sequence.push({ kind: 'fix', attempt, dir, t0, t1: Date.now() - runStart });
      return res;
    };
    if (outside.length) {
      await finish({ status: 'out_of_scope_edit', outside });
      throw new Error(`agent edited files outside ${srcRel}: ${outside.join(', ')}`);
    }
    if (agent.exitCode !== 0 || !diff.trim()) {
      await finish({ status: agent.exitCode ? 'agent_failed' : 'no_change' });
      history.push({ attempt, summary: agent.exitCode ? 'the agent run failed' : 'the agent made no change' });
      continue;
    }
    try {
      log(`fix ${attempt}: ${files.length} file(s) changed; rebuilding`);
      await rebuild();
    } catch (error) {
      await writeFile(join(fixDir, 'build.log'), String(error.message ?? error));
      await finish({ status: 'build_failed' });
      history.push({ attempt, summary: `the build failed after the change: ${String(error.message).slice(-400)}` });
      continue;
    }
    log(`fix ${attempt}: blind rerun`);
    last = await runLane({ url, task, expect, laneDir: fixDir, blind: true, log });
    let recheck;
    // Kane can blame its own run (family automation_bug, not confirmed). That is not evidence against the app,
    // so verify once more before involving the agent. The discarded try stays on disk as evidence.
    if (last.status !== 'passed' && last.verdict && last.verdict.family !== 'application_issue' && last.verdict.confirmed !== true) {
      const discarded = join(fixDir, 'discarded-try');
      await mkdir(discarded, { recursive: true });
      for (const file of ['kane.ndjson', 'lane.json', 'announcements.jsonl']) await rename(join(fixDir, file), join(discarded, file)).catch(() => {});
      await rm(join(fixDir, 'frames'), { recursive: true, force: true }); // frames of the discarded try are not kept
      recheck = { reason: `Kane classified the failure as ${last.verdict.family} (confirmed: ${last.verdict.confirmed}), not a product bug`, first: { resultCode: last.resultCode, credits: last.credits, reason: last.reason } };
      log(`fix ${attempt}: ${recheck.reason}; re-verifying once`);
      const extra = last.credits;
      last = await runLane({ url, task, expect, laneDir: fixDir, blind: true, log });
      recheck.extraCredits = extra;
    }
    await finish({ status: last.status, resultCode: last.resultCode, credits: last.credits, durationMs: last.durationMs, ...(recheck ? { recheck } : {}) });
    log(`fix ${attempt}: blind rerun ${last.status} (${last.resultCode})`);
    history.push({ attempt, summary: `changed ${files.join(', ')}; Kane's blind rerun ${last.status}${last.reason ? `: ${last.reason}` : ''}` });
    current = { dir, lane: last };
  }
  if (last.status !== 'passed') await writeFile(join(runDir, 'BLOCKED_NEEDS_HUMAN'), `The blind run did not pass within ${maxAttempts} attempt(s). See fix-*/brief.md, diff.patch, agent.log and the Kane evidence.\n`);
  return last;
}
