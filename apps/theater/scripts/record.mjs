// Records presentation-mode playback as a JPEG frame sequence (CDP screencast) for review or video editing.
//   node scripts/record.mjs <outDir> <runId> [fromMoment=intro] [seconds=12] [speed=1]
// Writes <outDir>/NNNNN.jpg plus frames.json [{file, t}] (t = ms since recording start).
// Encode elsewhere, e.g.: ffmpeg -framerate 30 -pattern_type glob -i '*.jpg' -c:v libx264 out.mp4
import fs from 'node:fs';
import path from 'node:path';
import { launchChrome, openPage, sleep } from './cdp.mjs';

const [outDir, runId, from = 'intro', seconds = '12', speed = '1'] = process.argv.slice(2);
const base = process.env.THEATER_URL || 'http://localhost:4320/';
fs.mkdirSync(outDir, { recursive: true });
const chrome = await launchChrome({ port: 9339 });
try {
  const page = await openPage(chrome.endpoint, { width: 1920, height: 1080 });
  await page.goto(`${base}?run=${encodeURIComponent(runId)}&present=1&autoplay=0&speed=${speed}&t=${encodeURIComponent(from)}`);
  await sleep(1500);
  const frames = [];
  let t0 = 0;
  page.on('Page.screencastFrame', ({ data, sessionId }) => {
    const file = `${String(frames.length).padStart(5, '0')}.jpg`;
    fs.writeFileSync(path.join(outDir, file), Buffer.from(data, 'base64'));
    frames.push({ file, t: Math.round(performance.now() - t0) });
    page.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await page.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: 1920, maxHeight: 1080 });
  t0 = performance.now();
  await page.evaluate('__theater.clock.play()');
  await sleep(Number(seconds) * 1000);
  await page.send('Page.stopScreencast');
  fs.writeFileSync(path.join(outDir, 'frames.json'), JSON.stringify(frames));
  console.log(`${frames.length} frames → ${outDir}`);
} finally {
  chrome.close();
}
