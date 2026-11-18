// One headless Chrome per lane. The recorder attaches to every page target (including any page Kane opens),
// injects the blindfold and the screen-reader hooks before page scripts run, and records a throttled
// screencast plus NVDA-style announcements read from Chrome's accessibility tree.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { CdpConnection } from './cdp.js';
import { axNodeToAnnouncement } from './parsers.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const debug = (message) => { if (process.env.BLINDRUN_DEBUG) process.stderr.write(`[chrome] ${message}\n`); };

// Blocks real pointer input (keyboard-initiated clicks have detail === 0 and still pass) and paints the
// whole page black. Kane's screenshots therefore really are black during a blind lane.
export const BLINDFOLD = `(() => {
  if (window.__blindrunBlindfold) return; window.__blindrunBlindfold = true;
  const block = (e) => { if (e.isTrusted && (e.type !== 'click' || e.detail > 0)) { e.stopImmediatePropagation(); e.preventDefault(); } };
  for (const t of ['pointerdown','pointerup','mousedown','mouseup','click','dblclick','contextmenu','wheel']) window.addEventListener(t, block, { capture: true, passive: false });
  const s = document.createElement('style');
  s.textContent = 'html::after{content:"";position:fixed;inset:0;background:#000;z-index:2147483647;pointer-events:none}';
  const add = () => { const root = document.head || document.documentElement; if (!root) return false; if (!s.isConnected) root.appendChild(s); return true; };
  if (!add()) new MutationObserver((_, o) => { if (add()) o.disconnect(); }).observe(document, { childList: true, subtree: true });
})();`;

// Reports focus changes (with the element's bounding box) and live-region updates to the recorder.
// It never mutates the page's DOM: focused nodes are parked in a Map so the recorder can resolve them.
const HOOKS = `(() => {
  if (window.__blindrunHooks) return; window.__blindrunHooks = true;
  const nodes = window.__blindrunNodes = new Map();
  let seq = 0;
  const send = (o) => { try { window.__blindrunAnnounce(JSON.stringify(o)); } catch {} };
  const box = (n) => { const r = n.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  addEventListener('focusin', (e) => {
    const n = e.target; if (!(n instanceof Element)) return;
    const id = ++seq; nodes.set(id, n); if (nodes.size > 50) nodes.delete(nodes.keys().next().value);
    send({ kind: 'focus', id, rect: box(n), viewport: { width: innerWidth, height: innerHeight } });
  }, true);
  const LIVE = '[aria-live]:not([aria-live="off"]), [role="status"], [role="alert"], [role="log"]';
  const last = new WeakMap(); const timers = new WeakMap();
  const start = () => new MutationObserver((records) => {
    for (const r of records) {
      const el = r.target.nodeType === 1 ? r.target : r.target.parentElement;
      const region = el && el.closest && el.closest(LIVE); if (!region) continue;
      clearTimeout(timers.get(region));
      timers.set(region, setTimeout(() => {
        const text = (region.innerText || region.textContent || '').replace(/\\s+/g, ' ').trim();
        if (!text || last.get(region) === text) return; last.set(region, text);
        send({ kind: 'live', text: text.slice(0, 240), role: region.getAttribute('role') || 'status', rect: box(region) });
      }, 150));
    }
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
  addEventListener('load', () => send({ kind: 'load', title: document.title }), { once: true });
})();`;

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForChrome(baseUrl, proc) {
  const until = Date.now() + 20000;
  while (Date.now() < until) {
    if (proc.exitCode !== null) throw new Error(`Chrome exited with code ${proc.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/json/version`);
      if (response.ok) return response.json();
    } catch { /* still starting */ }
    await sleep(100);
  }
  throw new Error('Timed out waiting for the Chrome DevTools endpoint');
}

/**
 * Launches Chrome, attaches the recorder and calls `body({ endpoint, recorder })`.
 * Frames and announcements carry absolute epoch ms (`at`); the caller rebases them onto the lane clock.
 */
export async function withRecordedChrome({ url, laneDir, blind, chromePath, frameIntervalMs = 900, frameWidth = 1152, quality = 52, window = '1280,860' }, body) {
  await mkdir(join(laneDir, 'frames'), { recursive: true });
  const profile = await mkdtemp(join(tmpdir(), 'blindrun-chrome-'));
  const port = await availablePort();
  const endpoint = `http://127.0.0.1:${port}`;
  const chrome = spawn(chromePath ?? process.env.CHROME_PATH ?? 'google-chrome', [
    '--headless=new', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--password-store=basic', '--disable-extensions', '--disable-component-update', '--disable-sync', '--disable-default-apps', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
    '--hide-scrollbars', '--mute-audio', `--window-size=${window}`, `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });
  const recorder = { frames: [], announcements: [], viewport: null, chromePid: chrome.pid };
  const sessions = new Map(); // sessionId -> { url }
  let cdp;
  let frameNo = 0;
  let lastKept = 0;
  let pendingFrame = null;
  let writes = Promise.resolve();
  const keepFrame = (data, at) => {
    const file = `frames/${String(frameNo++).padStart(5, '0')}.jpg`;
    recorder.frames.push({ file, at });
    writes = writes.then(() => writeFile(join(laneDir, file), Buffer.from(data, 'base64'))).catch(() => {});
    lastKept = at;
  };
  try {
    const version = await waitForChrome(endpoint, chrome);
    cdp = await CdpConnection.connect(version.webSocketDebuggerUrl);

    const prime = async (sessionId) => {
      if (sessions.has(sessionId)) return;
      sessions.set(sessionId, { url: '' });
      const call = (method, params = {}) => cdp.call(method, params, sessionId).catch((error) => { debug(`prime ${method}: ${error.message}`); return {}; });
      debug(`prime ${sessionId}`);
      await Promise.all([call('Page.enable'), call('Runtime.enable'), call('DOM.enable'), call('Accessibility.enable')]);
      await call('Runtime.addBinding', { name: '__blindrunAnnounce' });
      const sources = blind ? [BLINDFOLD, HOOKS] : [HOOKS];
      for (const source of sources) await call('Page.addScriptToEvaluateOnNewDocument', { source, runImmediately: true });
      await call('Page.startScreencast', { format: 'jpeg', quality, maxWidth: frameWidth, maxHeight: 1200, everyNthFrame: 1 });
      // Resume a target that auto-attach paused before evaluating anything in it: evaluate cannot finish on a paused page.
      await call('Runtime.runIfWaitingForDebugger');
      for (const source of sources) await call('Runtime.evaluate', { expression: source });
    };

    cdp.on('Target.attachedToTarget', ({ sessionId, targetInfo }) => {
      if (targetInfo.type === 'page') prime(sessionId);
      else cdp.call('Runtime.runIfWaitingForDebugger', {}, sessionId).catch(() => {});
    });
    cdp.on('Page.frameNavigated', ({ frame }, sessionId) => {
      if (!frame.parentId && sessions.has(sessionId)) sessions.get(sessionId).url = frame.url;
      debug(`navigated ${sessionId} ${frame.parentId ? '(child) ' : ''}${frame.url}`);
    });
    cdp.on('Page.screencastFrame', ({ data, metadata, sessionId: ackId }, sessionId) => {
      cdp.call('Page.screencastFrameAck', { sessionId: ackId }, sessionId).catch(() => {});
      const page = sessions.get(sessionId);
      if (!page || !/^https?:/.test(page.url)) return; // ignore about:blank and other idle tabs
      const at = Math.round((metadata?.timestamp ?? Date.now() / 1000) * 1000);
      if (at - lastKept >= frameIntervalMs) { keepFrame(data, at); pendingFrame = null; }
      else pendingFrame = { data, at };
      if (metadata?.deviceWidth) recorder.viewport = { width: Math.round(metadata.deviceWidth), height: Math.round(metadata.deviceHeight) };
    });
    cdp.on('Runtime.bindingCalled', async ({ name, payload }, sessionId) => {
      if (name !== '__blindrunAnnounce') return;
      const at = Date.now();
      let event;
      try { event = JSON.parse(payload); } catch { return; }
      try {
        const entry = await describe(cdp, sessionId, event);
        if (!entry) return;
        if (event.viewport) recorder.viewport = event.viewport;
        const prev = recorder.announcements.at(-1);
        if (prev && prev.text === entry.text && prev.source === entry.source && at - prev.at < 250) return;
        // Entering a dialog is announced once, before the focused control (as NVDA does).
        const { context, ...rest } = entry;
        if (context && context !== recorder.context) rest.text = `${context}. ${rest.text}`;
        if (entry.source === 'focus') recorder.context = context ?? null;
        recorder.announcements.push({ at, ...rest });
      } catch { /* the node can vanish during a navigation; later events still count */ }
    });

    await cdp.call('Target.setDiscoverTargets', { discover: true });
    await cdp.call('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
    const { targetInfos } = await cdp.call('Target.getTargets');
    for (const info of targetInfos.filter((t) => t.type === 'page' && !t.attached)) {
      const { sessionId } = await cdp.call('Target.attachToTarget', { targetId: info.targetId, flatten: true });
      await prime(sessionId);
    }
    // Load the app in the existing tab so the recording starts with the real page; Kane navigates again itself.
    const [first] = sessions.keys();
    // Not awaited: headless Chrome occasionally never answers a first navigation, and Kane navigates anyway.
    if (first && url) cdp.call('Page.navigate', { url }, first, 10000).then((r) => debug(`navigate ${JSON.stringify(r)}`), (error) => debug(`navigate: ${error.message}`));

    const result = await body({ endpoint, recorder });
    if (pendingFrame) keepFrame(pendingFrame.data, pendingFrame.at);
    await writes;
    return result;
  } finally {
    cdp?.close();
    if (chrome.exitCode === null) {
      chrome.kill('SIGTERM');
      await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)), sleep(3000)]);
      if (chrome.exitCode === null) chrome.kill('SIGKILL');
    }
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}

async function describe(cdp, sessionId, event) {
  if (event.kind === 'live') return { text: event.text, role: event.role, name: event.text, states: [], source: 'live', rect: event.rect };
  if (event.kind === 'load') return event.title ? { text: `${event.title}, document`, role: 'document', name: event.title, states: [], source: 'focus' } : null;
  const { result } = await cdp.call('Runtime.evaluate', { expression: `window.__blindrunNodes.get(${Number(event.id)})` }, sessionId);
  if (!result?.objectId) return null;
  const { node } = await cdp.call('DOM.describeNode', { objectId: result.objectId }, sessionId);
  const ax = await cdp.call('Accessibility.getPartialAXTree', { backendNodeId: node.backendNodeId, fetchRelatives: true }, sessionId);
  const nodes = ax.nodes ?? [];
  const self = nodes.find((n) => n.backendDOMNodeId === node.backendNodeId) ?? nodes.at(-1);
  // The nearest named dialog ancestor is announced first, as NVDA does on entering a dialog.
  const dialog = nodes.find((n) => n !== self && ['dialog', 'alertdialog'].includes(n.role?.value) && n.name?.value);
  const formatted = axNodeToAnnouncement(self, { tag: node.localName });
  return { ...formatted, source: 'focus', rect: event.rect, ...(dialog ? { context: `${dialog.name.value}, dialog` } : {}) };
}
