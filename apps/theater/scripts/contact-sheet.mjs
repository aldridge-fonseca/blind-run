// Renders a grid of sampled frames from a record.mjs directory into one PNG for quick review.
//   node scripts/contact-sheet.mjs <framesDir> <out.png> [count=12]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchChrome, openPage, sleep } from './cdp.mjs';

const [dir, out, count = '12'] = process.argv.slice(2);
const frames = JSON.parse(fs.readFileSync(path.join(dir, 'frames.json'), 'utf8'));
const n = Number(count);
const picks = Array.from({ length: n }, (_, i) => frames[Math.round((i * (frames.length - 1)) / (n - 1))]);
const html = `<!doctype html><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(3,640px);gap:4px;font:14px system-ui;color:#fff">${picks
  .map((f) => `<div style="position:relative"><img src="${pathToFileURL(path.join(dir, f.file))}" style="width:640px;display:block"><span style="position:absolute;left:6px;top:4px;background:#000a;padding:2px 6px">${(f.t / 1000).toFixed(1)}s</span></div>`)
  .join('')}</body>`;
const file = path.join(dir, 'sheet.html');
fs.writeFileSync(file, html);
const chrome = await launchChrome();
try {
  const rows = Math.ceil(n / 3);
  const page = await openPage(chrome.endpoint, { width: 1928, height: rows * 364 });
  await page.goto(pathToFileURL(file).href);
  await sleep(500);
  await page.screenshot(out);
  console.log(out);
} finally {
  chrome.close();
}
