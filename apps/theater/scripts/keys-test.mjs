// Smoke test for the player's keyboard shortcuts and deep links.
import { launchChrome, openPage, sleep } from './cdp.mjs';

const base = process.env.THEATER_URL || 'http://localhost:4320/';
const chrome = await launchChrome();
let failed = 0;
const check = (name, ok, extra = '') => {
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name} ${extra}`);
};
try {
  const p = await openPage(chrome.endpoint, { width: 1440, height: 900 });
  const state = () => p.evaluate(`JSON.stringify({ t: __theater.clock.get().t, playing: __theater.clock.get().playing, speed: __theater.clock.get().speed, ch: (__theater.show.chapters.find(c => __theater.clock.get().t >= c.start && __theater.clock.get().t < c.end) ?? __theater.show.chapters.at(-1)).id, url: location.search })`).then(JSON.parse);
  await p.goto(`${base}?run=sample-run&t=verdict%2B2`);
  await sleep(1200);
  let s = await state();
  check('deep link ?t=verdict+2', s.ch === 'verdict', JSON.stringify(s));
  await p.key('ArrowRight');
  await sleep(100);
  const s2 = await state();
  check('ArrowRight seeks +5s', Math.abs(s2.t - s.t - 5000) < 50);
  await p.key('3');
  await sleep(100);
  check('digit 3 jumps to chapter 3', (await state()).ch === 'verdict');
  await p.key(']');
  await sleep(100);
  check('] next chapter', (await state()).ch === 'fix');
  await p.key(' ');
  await sleep(600);
  s = await state();
  check('Space plays', s.playing, JSON.stringify(s));
  await p.key(' ');
  await sleep(200);
  s = await state();
  check('Space pauses and writes ?t=', !s.playing && /t=fix/.test(s.url), s.url);
  await p.key('=');
  await sleep(100);
  check('= speeds up', (await state()).speed === 1.5);
  await p.key('?');
  await sleep(300);
  check('? opens help dialog', await p.evaluate(`document.querySelector('dialog').open`));
  await p.key('Escape');
  await sleep(300);
  check('Esc closes help dialog', !(await p.evaluate(`document.querySelector('dialog').open`)));
  await p.key('r');
  await sleep(100);
  check('R toggles reveal', await p.evaluate(`[...document.querySelectorAll('button[aria-pressed]')].find(b => b.textContent.includes('Reveal'))?.getAttribute('aria-pressed') === 'true'`));
  await p.key('End');
  await sleep(100);
  check('End jumps to result', (await state()).ch === 'result');
} finally {
  chrome.close();
}
process.exit(failed ? 1 : 0);
