// Minimal Chrome DevTools Protocol helper: launch headless Chrome, open a page, send commands.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME_BIN || '/usr/bin/google-chrome';

export async function launchChrome({ width = 1920, height = 1080, port = 9333, extraArgs = [] } = {}) {
  // Chrome's singleton socket path must stay short, so keep the profile under /tmp.
  const userDir = fs.mkdtempSync(path.join('/tmp', 'theater-chrome-'));
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`,
    `--window-size=${width},${height}`, '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required', '--disable-gpu', '--mute-audio', ...extraArgs, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, TMPDIR: '/tmp' } });
  let errLog = ''; proc.stderr.on('data', (d) => { errLog += d; });
  const endpoint = `http://127.0.0.1:${port}`;
  let up = false;
  for (let i = 0; i < 300 && !up; i++) {
    try { await (await fetch(`${endpoint}/json/version`)).json(); up = true; } catch { await sleep(100); }
  }
  if (!up) { proc.kill('SIGTERM'); throw new Error(`Chrome did not start on port ${port}: ${errLog.slice(-800)}`); }
  const close = () => { try { proc.kill('SIGTERM'); } catch {} try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {} };
  process.on('exit', close);
  return { endpoint, close, pid: proc.pid };
}

export async function openPage(endpoint, { width = 1920, height = 1080 } = {}) {
  const target = await (await fetch(`${endpoint}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) (listeners.get(msg.method) || []).forEach((fn) => fn(msg.params));
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params }));
  });
  const on = (method, fn) => { listeners.set(method, [...(listeners.get(method) || []), fn]); };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const goto = async (url) => {
    const loaded = new Promise((r) => on('Page.loadEventFired', r));
    await send('Page.navigate', { url });
    await loaded;
  };
  const screenshot = async (file, { quality, format = quality ? 'jpeg' : 'png' } = {}) => {
    const r = await send('Page.captureScreenshot', { format, quality });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  };
  const key = async (keyName) => {
    const map = { Tab: [9, 'Tab'], Enter: [13, 'Enter', '\r'], ' ': [32, 'Space', ' '], Escape: [27, 'Escape'], ArrowRight: [39, 'ArrowRight'], ArrowLeft: [37, 'ArrowLeft'] };
    const [code, c, text] = map[keyName] || [0, keyName, keyName];
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code: c, windowsVirtualKeyCode: code, text });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code: c, windowsVirtualKeyCode: code });
  };
  const click = async (x, y) => {
    for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  };
  return { send, on, evaluate, goto, screenshot, key, click, close: () => ws.close() };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
