// The showcase profile: Encore (apps/encore), its demo task, and a probe for its planted barriers.
// The probe reads Chrome's accessibility tree through stable data-testids; it does not use Kane.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { CdpConnection } from './cdp.js';

export const ENCORE = {
  name: 'Encore',
  tag: 'encore-baseline',
  appPath: 'apps/encore',
  task: "Book 2 seats in row F for Friday's show.\nAt checkout use the name Alex Rivera, the email alex@example.com and the test card 4242 4242 4242 4242 with expiry 12/30 and CVC 123.",
  expect: "You're going! Order #ENC-4821 · Row F · Seats 14–15",
  barriers: [
    { id: 'B1', wcag: '2.1.1', title: 'Seat map seats are click-only <div>s', words: /seats?\b.{0,60}(focus|keyboard|tab|div|reach)|(focus|keyboard|tab|reach).{0,60}\bseats?\b/i },
    { id: 'B2', wcag: '4.1.2', title: 'Ticket quantity − / + buttons have no accessible name', words: /(quantity|ticket|plus|minus|\+|−).{0,40}(no|missing|without|unlabel{1,2}ed).{0,20}(name|label)|unlabel{1,2}ed (quantity|plus|minus|\+)/i },
    { id: 'B3', wcag: '2.1.1', title: 'Date picker is a mouse-only carousel of <div>s', words: /(date|friday|night|show|carousel).{0,60}(focus|keyboard|tab|div|reach)|(focus|keyboard|tab|reach).{0,60}(date|friday|night|carousel)/i },
    { id: 'B4', wcag: '2.4.3', title: 'Checkout modal does not take focus; close button unlabeled', words: /modal|dialog|checkout (window|overlay)|focus (did not|does not) move/i },
    { id: 'B5', wcag: '1.3.1', title: 'Card fields are labelled by placeholder only', words: /card (number|field)|expiry|cvc|placeholder|label/i },
    { id: 'B6', wcag: '1.4.3', title: 'Tier prices are low-contrast text', words: /contrast/i },
  ],
};

// Runs inside the page: drives the booking flow with synthetic clicks (no blindfold) and inspects the DOM.
const PROBE = `(async () => {
  const $ = (id) => document.querySelector('[data-testid="' + id + '"]');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const lum = (c) => { const m = c.match(/[\\d.]+/g).map(Number); const [r, g, b] = m.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const bgOf = (el) => { for (let n = el; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; const a = c.match(/[\\d.]+/g); if (a && (a.length < 4 || Number(a[3]) > 0.9)) return c; } return 'rgb(7, 6, 13)'; };
  const price = document.querySelector('[data-testid^="tier-price-"]');
  if (price) { const L1 = lum(getComputedStyle(price).color), L2 = lum(bgOf(price)); out.priceContrast = Math.round(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)) * 100) / 100; }
  ($('date-fri-21') || {}).click?.(); await wait(300);
  ($('qty-plus') || {}).click?.(); await wait(150);
  for (const s of ['F14', 'F15']) { const el = $('seat-' + s); el && el.click(); await wait(150); }
  const checkout = $('checkout-button'); checkout && checkout.focus(); checkout && checkout.click(); await wait(500);
  const modal = $('checkout-modal');
  out.modalOpen = !!modal;
  out.focusInModal = !!(modal && modal.contains(document.activeElement));
  out.activeTag = document.activeElement && document.activeElement.tagName;
  return out;
})()`;

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

/** Returns [{id, wcag, title, present, detail}] for the planted barriers at `url`. */
export async function auditEncore(url, options = {}) {
  // Headless Chrome occasionally stalls on the first navigation; a fresh browser fixes it.
  for (let attempt = 1; ; attempt++) {
    try { return await auditOnce(url, options); } catch (error) { if (attempt >= 3) throw error; }
  }
}

async function auditOnce(url, { chromePath } = {}) {
  const profile = await mkdtemp(join(tmpdir(), 'blindrun-audit-'));
  const port = await freePort();
  const chrome = spawn(chromePath ?? process.env.CHROME_PATH ?? 'google-chrome', ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--password-store=basic', '--disable-extensions', '--disable-component-update', '--disable-sync', '--disable-default-apps', '--window-size=1280,860', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let cdp;
  try {
    let version;
    for (let i = 0; i < 100 && !version; i++) {
      try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await new Promise((r) => setTimeout(r, 100)); }
    }
    cdp = await CdpConnection.connect(version.webSocketDebuggerUrl);
    const { targetInfos } = await cdp.call('Target.getTargets');
    const { sessionId: s } = await cdp.call('Target.attachToTarget', { targetId: targetInfos.find((t) => t.type === 'page').targetId, flatten: true });
    const call = (m, p = {}) => cdp.call(m, p, s, 15000);
    await call('Page.enable'); await call('DOM.enable'); await call('Accessibility.enable');
    const loaded = new Promise((resolve) => { const off = cdp.on('Page.loadEventFired', () => { off(); resolve(); }); });
    await call('Page.navigate', { url });
    await Promise.race([loaded, new Promise((_, reject) => setTimeout(() => reject(new Error('page load timed out')), 15000))]);
    await new Promise((r) => setTimeout(r, 800));
    const ax = async (selector) => {
      const { root } = await call('DOM.getDocument', { depth: 0 });
      const { nodeId } = await call('DOM.querySelector', { nodeId: root.nodeId, selector });
      if (!nodeId) return null;
      const { nodes } = await call('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
      const n = nodes[0] ?? {};
      const props = Object.fromEntries((n.properties ?? []).map((p) => [p.name, p.value?.value]));
      const sources = n.name?.sources ?? [];
      return { role: n.role?.value ?? null, name: n.name?.value ?? '', focusable: !!props.focusable, nameFrom: sources.find((x) => x.value?.value === n.name?.value && n.name?.value)?.attribute ?? sources.find((x) => x.value)?.type ?? null, ignored: !!n.ignored };
    };
    const interactive = (a) => a && a.focusable && !['generic', 'none', 'StaticText', null].includes(a.role) && a.name.trim().length > 0;
    const date = await ax('[data-testid="date-fri-21"]');
    const plus = await ax('[data-testid="qty-plus"]');
    const minus = await ax('[data-testid="qty-minus"]');
    const seat = await ax('[data-testid="seat-F14"]');
    const { result } = await call('Runtime.evaluate', { expression: PROBE, awaitPromise: true, returnByValue: true });
    const flow = result?.value ?? {};
    const modal = await ax('[data-testid="checkout-modal"]');
    const dialogInside = flow.modalOpen ? (await call('Runtime.evaluate', { expression: `!!document.querySelector('[data-testid="checkout-modal"]').closest('[role=dialog],[role=alertdialog],dialog') || !!document.querySelector('[data-testid="checkout-modal"] [role=dialog], [data-testid="checkout-modal"] [role=alertdialog], [data-testid="checkout-modal"] dialog')`, returnByValue: true })).result.value : false;
    const close = await ax('[data-testid="checkout-close"]');
    const fields = {};
    for (const f of ['card', 'expiry', 'cvc']) fields[f] = await ax(`[data-testid="input-${f}"]`);
    const checks = {
      B1: { present: !interactive(seat), detail: seat },
      B2: { present: !(plus?.name?.trim() && minus?.name?.trim()), detail: { plus, minus } },
      B3: { present: !interactive(date), detail: date },
      B4: { present: !(flow.modalOpen && dialogInside && flow.focusInModal && close?.name?.trim()), detail: { modalOpen: flow.modalOpen, dialogRole: dialogInside, focusMovedIn: flow.focusInModal, close, modal } },
      B5: { present: !Object.values(fields).every((a) => a && a.name.trim() && a.nameFrom !== 'placeholder'), detail: fields },
      B6: { present: !(flow.priceContrast >= 4.5), detail: { contrast: flow.priceContrast } },
    };
    return ENCORE.barriers.map(({ words, ...b }) => ({ ...b, ...checks[b.id] }));
  } finally {
    cdp?.close();
    chrome.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
    if (chrome.exitCode === null) chrome.kill('SIGKILL');
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}

/** Barrier list for run.json: planted barriers, who found them, and whether the fix removed them. */
export function encoreBarriers({ before, after, blindLanes, exploreText = '' }) {
  return ENCORE.barriers.map((b) => {
    const was = before.find((x) => x.id === b.id);
    const now = after?.find((x) => x.id === b.id);
    const named = blindLanes.some((lane) => lane.status === 'failed' && b.words.test(String(lane.reason ?? '')));
    const foundBy = named ? 'blind' : b.words.test(exploreText) ? 'explore' : 'audit';
    return { id: b.id, wcag: b.wcag, title: b.title, planted: true, foundBy, presentBefore: was?.present ?? null, ...(now ? { fixed: was?.present === true && now.present === false } : {}) };
  });
}
