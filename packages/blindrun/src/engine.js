import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { createServer } from 'node:net';
import { performance } from 'node:perf_hooks';
import { CdpConnection } from './cdp.js';
import { axNodeToAnnouncement, parseKaneNdjson, summarizeKane } from './parsers.js';

const LOCK_PATH = '/home/aldridge/kane-cli-hackathon/build/kane.lock';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function launch(command, args, options = {}) {
  return spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForChrome(baseUrl, process) {
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    if (process.exitCode !== null) throw new Error(`Chrome exited with code ${process.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/json/version`);
      if (response.ok) return response.json();
    } catch { /* Chrome is still starting. */ }
    await sleep(100);
  }
  throw new Error('Timed out waiting for Chrome DevTools endpoint');
}

async function withChrome(url, laneDir, { blind, chromePath = process.env.CHROME_PATH ?? 'google-chrome' }, run) {
  await mkdir(join(laneDir, 'frames'), { recursive: true });
  const profile = await mkdtemp(join(tmpdir(), 'blindrun-chrome-'));
  const port = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const chrome = launch(chromePath, [
    '--headless=new', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--window-size=1280,900', `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`, 'about:blank',
  ]);
  let cdp;
  let frameNo = 0;
  let frameQueue = Promise.resolve();
  let startedAt;
  const announcements = [];
  try {
    const version = await waitForChrome(baseUrl, chrome);
    cdp = await CdpConnection.connect(version.webSocketDebuggerUrl);
    const { targetId } = await cdp.call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.call('Target.attachToTarget', { targetId, flatten: true });
    await cdp.call('Page.enable', {}, sessionId);
    await cdp.call('DOM.enable', {}, sessionId);
    await cdp.call('Runtime.enable', {}, sessionId);
    await cdp.call('Accessibility.enable', {}, sessionId);
    await cdp.call('Runtime.addBinding', { name: '__blindrunAnnounce' }, sessionId);
    const script = `(() => {
      const send = (kind, node) => { try { window.__blindrunAnnounce(JSON.stringify({kind, text:(node?.innerText||node?.textContent||'').trim().slice(0,240), label:node?.getAttribute?.('aria-label')||node?.getAttribute?.('title')||'', tag:node?.tagName||''})); } catch {} };
      addEventListener('focusin', e => send('focus', e.target), true);
      let timer;
      new MutationObserver(records => {
        for (const r of records) { const node = r.target.nodeType === 1 ? r.target : r.target.parentElement; const live = node?.closest?.('[aria-live], [role="alert"], [role="status"]'); if (live) { clearTimeout(timer); timer=setTimeout(() => send('live', live), 60); } }
      }).observe(document, {subtree:true, childList:true, characterData:true});
    })();`;
    await cdp.call('Page.addScriptToEvaluateOnNewDocument', { source: script }, sessionId);
    await cdp.call('Runtime.evaluate', { expression: script }, sessionId);
    if (blind) {
      const blindfold = `(() => {
        const block = e => { if (e.isTrusted && (e.type !== 'click' || e.detail > 0)) { e.stopImmediatePropagation(); e.preventDefault(); } };
        for (const type of ['pointerdown','pointerup','mousedown','mouseup','click','dblclick','contextmenu']) addEventListener(type, block, true);
        const add = () => { if (!document.documentElement || document.getElementById('__blindrun_blindfold')) return; const style=document.createElement('style'); style.id='__blindrun_blindfold'; style.textContent='html::after{content:"";position:fixed;inset:0;background:#000;z-index:2147483647;pointer-events:none}'; document.documentElement.appendChild(style); };
        add(); new MutationObserver(add).observe(document,{childList:true,subtree:true});
      })();`;
      await cdp.call('Page.addScriptToEvaluateOnNewDocument', { source: blindfold }, sessionId);
      await cdp.call('Runtime.evaluate', { expression: blindfold }, sessionId);
    }
    cdp.on('Page.screencastFrame', ({ data, sessionId: frameSession, metadata }) => {
      const frame = String(frameNo++).padStart(5, '0');
      const file = `${frame}.jpg`;
      const t = startedAt === undefined ? 0 : Math.round(performance.now() - startedAt);
      frameQueue = frameQueue.then(() => writeFile(join(laneDir, 'frames', file), Buffer.from(data, 'base64'))).catch(() => {});
      cdp.call('Page.screencastFrameAck', { sessionId: metadata?.sessionId }, frameSession).catch(() => {});
      frames.push({ file, t });
    });
    cdp.on('Runtime.bindingCalled', async ({ name, payload }, eventSession) => {
      if (name !== '__blindrunAnnounce' || !eventSession) return;
      try {
        const event = JSON.parse(payload);
        const evaluated = await cdp.call('Runtime.evaluate', {
          expression: `(() => { const n=${event.kind === 'focus' ? 'document.activeElement' : 'document.querySelector("[aria-live], [role=alert], [role=status]")'}; return n; })()`,
          returnByValue: false,
        }, eventSession);
        const objectId = evaluated.result?.objectId;
        const desc = objectId ? await cdp.call('DOM.describeNode', { objectId }, eventSession) : {};
        const backendNodeId = desc.node?.backendNodeId;
        const ax = backendNodeId ? await cdp.call('Accessibility.getPartialAXTree', { backendNodeId, fetchRelatives: false }, eventSession) : {};
        const node = ax.nodes?.[0] ?? {};
        const fallbackName = event.label || event.text;
        const formatted = axNodeToAnnouncement(node, { fallbackName, source: event.kind });
        const text = formatted.text || fallbackName || (event.kind === 'focus' ? 'focused item' : 'page update');
        const entry = { t: startedAt === undefined ? 0 : Math.round(performance.now() - startedAt), text, role: formatted.role || event.tag.toLowerCase(), name: formatted.name || fallbackName, states: formatted.states, source: event.kind };
        if (!announcements.length || announcements.at(-1).text !== entry.text || announcements.at(-1).source !== entry.source) announcements.push(entry);
      } catch { /* An AX snapshot can race a page navigation; later events remain useful. */ }
    });
    const frames = [];
    await cdp.call('Page.startScreencast', { format: 'jpeg', quality: 65, maxWidth: 1280, maxHeight: 900, everyNthFrame: 1 }, sessionId);
    await cdp.call('Page.navigate', { url }, sessionId);
    await sleep(600);
    startedAt = performance.now();
    const result = await run({ endpoint: baseUrl, cdp, sessionId, announcements });
    await cdp.call('Page.stopScreencast', {}, sessionId).catch(() => {});
    await frameQueue;
    await writeFile(join(laneDir, 'frames.json'), `${JSON.stringify(frames, null, 2)}\n`);
    await writeFile(join(laneDir, 'announcements.jsonl'), announcements.map((item) => JSON.stringify(item)).join('\n') + (announcements.length ? '\n' : ''));
    return result;
  } finally {
    cdp?.close();
    if (chrome.exitCode === null) {
      chrome.kill('SIGTERM');
      await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)), sleep(2500)]);
      if (chrome.exitCode === null) chrome.kill('SIGKILL');
    }
    await rm(profile, { recursive: true, force: true });
  }
}

export async function runLane({ url, task, expect, lane, outDir, timeout = 400, maxSteps = 15, chromePath }) {
  const laneDir = resolve(outDir, lane);
  await mkdir(laneDir, { recursive: true });
  const blind = lane.startsWith('blind');
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const objective = blind
    ? `You are a blind user who navigates with the keyboard only (Tab, Shift+Tab, Enter, Space, arrow keys). The mouse does not work and the screen is black.\n${task}\nVerify ${JSON.stringify(expect)}.`
    : `${task}\nVerify ${JSON.stringify(expect)}.`;
  const summary = await withChrome(url, laneDir, { blind, chromePath }, async ({ endpoint }) => {
    const proc = launch('flock', [LOCK_PATH, 'kane-cli', 'run', objective, '--url', url, '--cdp-endpoint', endpoint, '--agent', '--bug-detection', 'continue', '--max-steps', String(maxSteps), '--timeout', String(timeout)]);
    let stdout = '';
    let stderr = '';
    proc.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    proc.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    const exitCode = await new Promise((resolve, reject) => {
      proc.once('error', reject);
      proc.once('close', (code) => resolve(code ?? 1));
    });
    await writeFile(join(laneDir, 'kane.ndjson'), stdout);
    if (stderr.trim()) await writeFile(join(laneDir, 'kane.stderr.txt'), stderr);
    const parsed = parseKaneNdjson(stdout);
    if (parsed.malformed.length) await writeFile(join(laneDir, 'kane.parse-warnings.json'), `${JSON.stringify(parsed.malformed, null, 2)}\n`);
    return { ...summarizeKane(parsed.records, exitCode), exitCode };
  });
  const laneData = {
    lane: blind ? 'blind' : 'sighted', status: summary.status, resultCode: summary.resultCode,
    durationMs: summary.durationMs ?? Date.now() - t0, steps: summary.steps, credits: summary.credits,
    verdict: summary.verdict, startedAt,
  };
  await writeFile(join(laneDir, 'lane.json'), `${JSON.stringify(laneData, null, 2)}\n`);
  return laneData;
}

export async function runLanes(options) {
  const lanes = options.lanes ?? ['sighted', 'blind'];
  const results = {};
  for (const lane of lanes) results[lane] = await runLane({ ...options, lane });
  return results;
}

export async function runExplore({ url, outDir, prompt = 'Explore keyboard accessibility and controls' }) {
  await mkdir(outDir, { recursive: true });
  const base = ['--url', url, '--prompt', prompt, '--max-leases', '1', '--local-orchestration', '--browser', 'local', '--headless', '--policy', 'read_only', '--no-context', '--no-recheck', '--agent'];
  const explore = launch('flock', [LOCK_PATH, 'kane-cli', 'explore', 'run', ...base]);
  const { stdout, stderr, exitCode } = await collectProcess(explore);
  let parsed = parseKaneNdjson(stdout);
  let mode = 'explore';
  let combined = stdout;
  if (exitCode !== 0 || !parsed.records.some((record) => record.type === 'done')) {
    mode = 'analyzer-only';
    const conditions = [
      'The page has keyboard-focusable interactive controls.',
      'Every interactive control has an accessible name.',
      'The page has no low-contrast text.',
    ];
    const args = ['--url', url, '--agent', '--analyzer-only', ...conditions.flatMap((condition) => ['--condition', condition])];
    const fallback = launch('flock', [LOCK_PATH, 'kane-cli', 'run', ...args]);
    const result = await collectProcess(fallback);
    combined += `\n--- analyzer-only fallback ---\n${result.stdout}`;
    parsed = parseKaneNdjson(result.stdout);
  }
  await writeFile(join(outDir, 'explore.ndjson'), combined);
  await writeFile(join(outDir, 'findings.json'), `${JSON.stringify({ mode, url, prompt, records: parsed.records, malformed: parsed.malformed, stderr: stderr.trim() || undefined }, null, 2)}\n`);
  return { mode, records: parsed.records };
}

export async function collectProcess(proc) {
  let stdout = '';
  let stderr = '';
  proc.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  proc.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  const exitCode = await new Promise((resolve, reject) => {
    proc.once('error', reject);
    proc.once('close', (code) => resolve(code ?? 1));
  });
  return { stdout, stderr, exitCode };
}

export async function waitForUrl(url, timeoutMs = 30000) {
  const end = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < end) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) { lastError = error; }
    await sleep(250);
  }
  throw new Error(`App did not become ready at ${url}: ${lastError?.message ?? 'timeout'}`);
}
