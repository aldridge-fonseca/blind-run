// Builds apps/theater/fixtures/sample-run: a FIXTURE run directory in the runs/<id> artifact format.
// The two blind kane.ndjson files are the real proof-of-concept Kane output, copied verbatim.
// Everything else (sighted lane NDJSON, frames, announcements, audio, diff) is generated here from a
// local mock page so the Theater can be built before real runs exist. It is never presented as real.
//
//   node scripts/make-fixture.mjs            # frames + announcements (no keys needed)
//   ELEVENLABS_API_KEY=... node scripts/make-fixture.mjs --audio   # also synthesize screen-reader audio
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChrome, openPage, sleep } from './cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const src = path.join(root, 'fixtures/_src');
const out = path.join(root, 'fixtures/sample-run');
const withAudio = process.argv.includes('--audio');
const VIEWPORT = { width: 1280, height: 800 };

const readNdjson = (file) => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const ms = (iso) => Date.parse(iso);

// Sighted lane: no PoC NDJSON exists, so synthesize one in Kane's shape, explicitly flagged as fixture.
function sightedNdjson() {
  const start = ms('2026-11-18T08:38:20.000Z');
  const at = (s) => new Date(start + s * 1000).toISOString();
  const lines = [
    { type: 'stream_start', cli_version: '0.10.6', surface: 'run', fixture: true, note: 'synthetic fixture line, not real Kane output', v: 1, ts: at(0) },
    { step: 2, status: 'running', remark: 'Step 1', v: 1, ts: at(7.6) },
    { step: 2, status: 'done', remark: 'navigate: Navigate to http://127.0.0.1:8765/', v: 1, ts: at(7.7) },
    { step: 3, status: 'running', remark: 'Step 2', v: 1, ts: at(8.4) },
    { step: 3, status: 'done', remark: 'click: PRIMARY: Select seat 14C; role=clickable; text="C"', v: 1, ts: at(12.9) },
    { step: 4, status: 'running', remark: 'Step 3', v: 1, ts: at(13.5) },
    { step: 4, status: 'done', remark: 'click: PRIMARY: Book seat; role=button; text="Book seat"', v: 1, ts: at(17.2) },
    { step: 5, status: 'running', remark: 'Step 4', v: 1, ts: at(17.8) },
    { step: 5, status: 'done', remark: 'analyze: the page says "Booked 14C"', v: 1, ts: at(23.1) },
    { step: 6, status: 'running', remark: 'Step 5', v: 1, ts: at(23.6) },
    { step: 6, status: 'done', remark: 'assert: the page says "Booked 14C"', v: 1, ts: at(23.7) },
  ];
  lines.push({
    type: 'run_end', status: 'passed', fixture: true,
    summary: 'Selected seat 14C with the mouse.\nBooked seat 14C.\nThe page confirmed the booking with the message “Booked 14C.”',
    one_liner: 'booked seat 14C on the seat booking page', reason: 'Objective completed', duration: 31.4,
    credits_consumed: 12.4, result_code: 100, reason_code: 'success.complete', v: 1, ts: at(31.4),
  });
  return lines;
}

// Turns Kane step events into the actions we replay against the mock page.
function stepsOf(events, t0) {
  return events.filter((e) => e.step && e.status !== 'running').map((e) => ({ t: ms(e.ts) - t0, remark: e.remark, status: e.status }));
}

async function axAnnouncement(page) {
  const { result } = await page.send('Runtime.evaluate', { expression: 'document.activeElement' });
  const info = await page.evaluate(`(() => { const a = document.activeElement; const r = a.getBoundingClientRect();
    return { body: a === document.body, title: document.title, rect: { x: r.x, y: r.y, w: r.width, h: r.height } }; })()`);
  if (info.body) return { text: `${info.title}, document`, role: 'document', name: info.title, states: [], rect: null };
  const { nodes } = await page.send('Accessibility.getPartialAXTree', { objectId: result.objectId, fetchRelatives: false });
  const n = nodes[0];
  const role = n.role?.value === 'button' && (n.properties || []).some((p) => p.name === 'pressed') ? 'toggle button' : n.role?.value;
  const name = n.name?.value || '';
  const states = [];
  for (const p of n.properties || []) {
    if (p.name === 'pressed' && p.value.value === 'true') states.push('pressed');
    if (p.name === 'disabled' && p.value.value) states.push('unavailable');
  }
  const r = info.rect;
  return { text: [name, role, ...states].filter(Boolean).join(', '), role, name, states, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) } };
}

async function recordLane({ dir, pageFile, kane, mode }) {
  const laneDir = path.join(out, dir);
  fs.rmSync(laneDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(laneDir, 'frames'), { recursive: true });
  fs.writeFileSync(path.join(laneDir, 'kane.ndjson'), kane.map((l) => JSON.stringify(l)).join('\n') + '\n');
  const t0 = ms(kane[0].ts);
  const end = kane.find((e) => e.type === 'run_end');
  const steps = stepsOf(kane, t0);

  const page = await openPage(chrome.endpoint, VIEWPORT);
  await page.send('Accessibility.enable');
  const frames = [];
  const announcements = [];
  const frame = async (t) => {
    const file = `frames/${String(frames.length).padStart(5, '0')}.jpg`;
    await page.screenshot(path.join(laneDir, file), { quality: 72 });
    frames.push({ file, t: Math.round(t) });
  };
  const announce = (t, a, source = 'focus') => announcements.push({ t: Math.round(t), text: a.text, role: a.role, name: a.name, states: a.states, source, ...(a.rect ? { rect: a.rect } : {}) });
  const center = (sel) => page.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  const liveText = () => page.evaluate(`document.getElementById('done').textContent`);

  for (const s of steps) {
    const act = s.t - 450; // the key press lands a beat before Kane reports the step done
    const [verb] = s.remark.split(':');
    if (verb === 'navigate') {
      await page.goto(pathToFileURL(path.join(src, pageFile)).href);
      await sleep(150);
      await frame(act);
      if (mode === 'blind') announce(act + 120, await axAnnouncement(page));
    } else if (verb === 'press_key') {
      const isTab = /Tab key/.test(s.remark);
      const before = await liveText();
      await page.key(isTab ? 'Tab' : 'Enter');
      await sleep(120);
      await frame(act);
      const a = await axAnnouncement(page);
      const prev = announcements.at(-1);
      // NVDA re-announces on focus moves and on state changes of the focused control.
      if (isTab || (prev && prev.text !== a.text && a.role !== 'document')) announce(act + 140, a);
      const after = await liveText();
      if (after && after !== before) announce(act + 900, { text: after, role: 'status', name: after, states: [] }, 'live');
    } else if (verb === 'click') {
      const sel = /Book seat/.test(s.remark) ? '#book' : '[data-seat="14C"]';
      const [x, y] = await center(sel);
      await page.click(x, y);
      await sleep(120);
      await frame(act);
    } else {
      await sleep(80);
      await frame(s.t);
    }
  }
  page.close();

  fs.writeFileSync(path.join(laneDir, 'frames.json'), JSON.stringify(frames, null, 1));
  if (mode === 'blind') fs.writeFileSync(path.join(laneDir, 'announcements.jsonl'), announcements.map((a) => JSON.stringify(a)).join('\n') + '\n');
  const lane = {
    lane: mode, status: end.status, resultCode: end.result_code, durationMs: Math.round(end.duration * 1000),
    steps: steps.length, credits: Math.round(end.credits_consumed * 100) / 100, verdict: end.verdict ?? null,
    startedAt: kane[0].ts, viewport: VIEWPORT, fixture: true,
  };
  fs.writeFileSync(path.join(laneDir, 'lane.json'), JSON.stringify(lane, null, 2));
  return { dir, announcements, lane };
}

async function tts(text) {
  const voice = process.env.SR_VOICE_ID || 'CwhRBWXzGAHq8TQ4Fs17'; // "Roger"
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_flash_v2_5', voice_settings: { stability: 0.9, similarity_boost: 0.6, speed: 1.15 } }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function voiceLane({ dir, announcements }) {
  const audioDir = path.join(out, dir, 'audio');
  fs.mkdirSync(audioDir, { recursive: true });
  const index = [];
  for (const a of announcements) {
    const file = `audio/${crypto.createHash('sha1').update(a.text).digest('hex').slice(0, 12)}.mp3`;
    const abs = path.join(out, dir, file);
    if (!fs.existsSync(abs)) fs.writeFileSync(abs, await tts(a.text));
    index.push({ t: a.t, file, text: a.text });
  }
  fs.writeFileSync(path.join(out, dir, 'audio.json'), JSON.stringify(index, null, 1));
}

const chrome = await launchChrome({ ...VIEWPORT, port: 9334 });
try {
  fs.mkdirSync(out, { recursive: true });
  const sighted = await recordLane({ dir: 'sighted', pageFile: 'seat-page.broken.html', kane: sightedNdjson(), mode: 'sighted' });
  const before = await recordLane({ dir: 'blind-0', pageFile: 'seat-page.broken.html', kane: readNdjson(path.join(src, 'kane/blind-broken.ndjson')), mode: 'blind' });
  const after = await recordLane({ dir: 'blind-1', pageFile: 'seat-page.fixed.html', kane: readNdjson(path.join(src, 'kane/blind-fixed.ndjson')), mode: 'blind' });

  // fix-1: a real diff between the two mock pages, plus the brief an agent would get.
  const fixDir = path.join(out, 'fix-1');
  fs.mkdirSync(fixDir, { recursive: true });
  let diff = '';
  try { execFileSync('git', ['diff', '--no-index', '--no-color', 'seat-page.broken.html', 'seat-page.fixed.html'], { cwd: src }); }
  catch (e) { diff = e.stdout.toString(); }
  diff = diff.replace(/a\/seat-page\.broken\.html/g, 'a/src/seat-page.html').replace(/b\/seat-page\.fixed\.html/g, 'b/src/seat-page.html');
  fs.writeFileSync(path.join(fixDir, 'diff.patch'), diff);
  const v = before.lane.verdict;
  fs.writeFileSync(path.join(fixDir, 'brief.md'), `# Fix brief (attempt 1)\n\nKane CLI ran the task as a blind, keyboard-only user and reported a confirmed product bug.\n\n- **Bug:** ${v.bug_title}\n- **Evidence:** ${before.lane.verdict.signals[0].excerpt}\n- **Suggestion:** ${v.suggestion}\n\nScreen reader heard:\n${before.announcements.map((a) => `- ${a.text}`).join('\n')}\n\nRules: edit only \`src/**\`. Do not touch tests, objectives, or the runner.\n`);
  fs.writeFileSync(path.join(fixDir, 'agent.log'), 'FIXTURE: no agent ran. This diff was written by hand to exercise the Theater.\n');
  fs.writeFileSync(path.join(fixDir, 'result.json'), JSON.stringify({ attempt: 1, status: 'applied', agent: 'fixture (hand-written diff)', filesChanged: ['src/seat-page.html'], durationMs: 41000, fixture: true }, null, 2));

  if (withAudio) for (const lane of [before, after]) await voiceLane(lane);

  const lanes = { sighted, before, after };
  const run = {
    id: 'sample-run',
    label: 'fixture',
    fixture: true,
    title: 'Fixture · seat picker (not a real run)',
    createdAt: '2026-11-18T08:38:20.000Z',
    url: 'http://127.0.0.1:8765/',
    task: 'Select seat 14C and book it.',
    expect: 'Booked 14C',
    app: { name: 'mock seat page (fixture)', commit: null },
    kaneVersion: '0.10.6',
    sequence: [
      { kind: 'lane', lane: 'sighted', dir: 'sighted', t0: 0, t1: lanes.sighted.lane.durationMs },
      { kind: 'lane', lane: 'blind', dir: 'blind-0', t0: 0, t1: lanes.before.lane.durationMs },
      { kind: 'fix', attempt: 1, dir: 'fix-1', t0: lanes.before.lane.durationMs, t1: lanes.before.lane.durationMs + 41000 },
      { kind: 'lane', lane: 'blind', dir: 'blind-1', t0: lanes.before.lane.durationMs + 41000, t1: lanes.before.lane.durationMs + 41000 + lanes.after.lane.durationMs },
    ],
    outcome: {
      blindBefore: 'failed', blindAfter: 'passed',
      barriers: [{ id: 'B1', wcag: '2.1.1', title: 'Seats are click-only <div>s, unreachable by keyboard', foundBy: 'blind', planted: true }],
    },
  };
  fs.writeFileSync(path.join(out, 'run.json'), JSON.stringify(run, null, 2));
  fs.writeFileSync(path.join(out, 'README.md'), `# sample-run (FIXTURE)\n\nNot a real Blind Run. Built by \`apps/theater/scripts/make-fixture.mjs\` so the Theater can be developed before real runs exist.\n\n- \`blind-0/kane.ndjson\` and \`blind-1/kane.ndjson\` are real Kane CLI 0.10.6 output from the proof of concept, verbatim.\n- \`sighted/kane.ndjson\` is synthetic (flagged \`"fixture": true\`).\n- Frames, announcements and audio come from replaying the step timings against a local mock page.\n- \`fix-1/diff.patch\` is a hand-written diff between the two mock pages, not agent output.\n`);
  console.log('fixture written to', path.relative(process.cwd(), out));
} finally {
  chrome.close();
}
