// Screenshots the Theater at given moments in presentation mode (1920×1080).
//   node scripts/shoot.mjs <outDir> <runId> <moment...>     e.g. intro+3 race+20 verdict+8
//   THEATER_URL=http://localhost:4320/ (default)   EXTRA='&lens=blur'
import fs from 'node:fs';
import path from 'node:path';
import { launchChrome, openPage, sleep } from './cdp.mjs';

const [outDir, runId, ...moments] = process.argv.slice(2);
const base = process.env.THEATER_URL || 'http://localhost:4320/';
const extra = process.env.EXTRA || '';
fs.mkdirSync(outDir, { recursive: true });
const chrome = await launchChrome({ port: 9335 });
try {
  const page = await openPage(chrome.endpoint, { width: 1920, height: 1080 });
  for (const m of moments) {
    const url = m.startsWith('?') ? `${base}${m}` : `${base}?run=${encodeURIComponent(runId)}&present=1&autoplay=0&t=${encodeURIComponent(m)}${extra}`;
    await page.goto(url);
    await sleep(Number(process.env.WAIT || 1400));
    const file = path.join(outDir, `${m.replace(/[^a-z0-9+.-]+/gi, '_')}.png`);
    await page.screenshot(file);
    console.log(file);
  }
} finally {
  chrome.close();
}
