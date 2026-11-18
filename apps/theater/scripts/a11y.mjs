// Accessibility check: runs axe-core against the index, the player at each chapter, and the help dialog,
// then walks the Tab order of the player. Exits non-zero on any violation.
//   node scripts/a11y.mjs [runId]      (dev or preview server on THEATER_URL, default http://localhost:4320/)
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { launchChrome, openPage, sleep } from './cdp.mjs';

const require = createRequire(import.meta.url);
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const base = process.env.THEATER_URL || 'http://localhost:4320/';
const runId = process.argv[2] || 'sample-run';
const pages = [
  ['index', ''],
  ...['intro+3', 'race+12', 'verdict+9', 'fix+12', 'rerun+20', 'result+10'].map((t) => [`player ${t}`, `?run=${runId}&t=${encodeURIComponent(t)}`]),
  ['present', `?run=${runId}&present=1&autoplay=0&t=race%2B12`],
];

const chrome = await launchChrome({ port: 9337 });
let failures = 0;
try {
  const page = await openPage(chrome.endpoint, { width: 1440, height: 900 });
  const audit = async (label) => {
    await page.evaluate(axeSource);
    const res = await page.evaluate(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }).then(r => r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map(n => n.target.join(' ') + ' :: ' + n.failureSummary.split('\\n').slice(1, 2).join('')) })))`);
    failures += res.length;
    console.log(`${res.length ? '✗' : '✓'} ${label}${res.length ? '' : ' — no violations'}`);
    for (const v of res) console.log(`   [${v.impact}] ${v.id}: ${v.help}\n      ${v.nodes.join('\n      ')}`);
  };
  for (const [label, q] of pages) {
    await page.goto(base + q);
    await sleep(1500);
    await audit(label);
  }
  // Help dialog open.
  await page.goto(`${base}?run=${runId}&t=race%2B5`);
  await sleep(1200);
  await page.evaluate(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))`);
  await sleep(400);
  await audit('help dialog');
  // Keyboard walk.
  await page.goto(`${base}?run=${runId}&t=result%2B10`);
  await sleep(1200);
  const seen = [];
  for (let i = 0; i < 40; i++) {
    await page.key('Tab');
    const d = await page.evaluate(`(() => { const a = document.activeElement; if (!a || a === document.body) return null;
      const name = a.getAttribute('aria-label') || a.textContent.trim().slice(0, 40); const r = a.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0; return (a.getAttribute('role') || a.tagName.toLowerCase()) + ': ' + name + (visible ? '' : ' (INVISIBLE)'); })()`);
    if (!d || seen.includes(d)) break;
    seen.push(d);
  }
  console.log(`\nTab order (${seen.length} stops):\n  ${seen.join('\n  ')}`);
} finally {
  chrome.close();
}
process.exit(failures ? 1 : 0);
