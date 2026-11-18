import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const MODEL = 'eleven_flash_v2_5';

async function requestJson(url, apiKey) {
  const response = await fetch(url, { headers: { 'xi-api-key': apiKey } });
  if (!response.ok) throw new Error(`ElevenLabs request failed (${response.status})`);
  return response.json();
}

async function resolveVoice(apiKey, choices) {
  const catalog = await requestJson('https://api.elevenlabs.io/v1/voices', apiKey);
  const voices = catalog.voices ?? [];
  for (const choice of choices) {
    const voice = voices.find((item) => item.name?.toLowerCase() === choice.toLowerCase());
    if (voice) return voice;
  }
  throw new Error(`No matching ElevenLabs voice found (${choices.join(' or ')})`);
}

function clipId(text, voiceId, model = MODEL) {
  return createHash('sha256').update(`${model}\0${voiceId}\0${text}`).digest('hex');
}

async function synthesize(text, voice, apiKey, audioDir, speed) {
  const hash = clipId(text, voice.voice_id);
  const file = `${hash}.mp3`;
  const path = join(audioDir, file);
  try {
    await readFile(path);
    return { file: `audio/${file}`, cached: true };
  } catch { /* Create the missing clip. */ }
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.voice_id)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: { stability: 0.42, similarity_boost: 0.75, style: 0.12, use_speaker_boost: true, speed },
    }),
  });
  if (!response.ok) throw new Error(`ElevenLabs speech request failed (${response.status})`);
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
  return { file: `audio/${file}`, cached: false };
}

async function readLineJson(path) {
  try {
    const source = await readFile(path, 'utf8');
    return source.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch { return []; }
}

export async function synthesizeRun(runDir, { apiKey }) {
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is required for voice synthesis');
  const audioDir = join(runDir, 'audio');
  await mkdir(audioDir, { recursive: true });
  const run = JSON.parse(await readFile(join(runDir, 'run.json'), 'utf8'));
  const announcements = [];
  for (const entry of run.sequence ?? []) {
    if (entry.kind !== 'lane') continue;
    const items = await readLineJson(join(runDir, entry.dir, 'announcements.jsonl'));
    for (const item of items) announcements.push({ ...item, lane: entry.dir });
  }
  const narration = [];
  for (const entry of run.sequence ?? []) {
    if (entry.kind === 'lane') continue;
    const attempt = JSON.parse(await readFile(join(runDir, entry.dir, 'result.json'), 'utf8').catch(() => '{}'));
    narration.push({ t: entry.t0 ?? 0, lane: entry.dir, source: 'narration', text: `Agent fix attempt ${entry.attempt} completed with a ${attempt.status ?? 'recorded'} blind replay.` });
  }
  const screenVoice = await resolveVoice(apiKey, ['River', 'Roger']);
  let narratorVoice = screenVoice;
  try { narratorVoice = await resolveVoice(apiKey, ['George', 'Alice', 'Matilda']); } catch { /* Use the screen-reader voice if a narrator voice is not available. */ }
  const clips = [];
  for (const item of [...announcements, ...narration]) {
    const voice = item.source === 'narration' ? narratorVoice : screenVoice;
    const clip = await synthesize(item.text, voice, apiKey, audioDir, item.source === 'narration' ? 1 : 1.06);
    clips.push({ t: item.t ?? 0, file: clip.file, text: item.text, lane: item.lane, source: item.source ?? 'announcement', voice: voice.name, cached: clip.cached });
  }
  await writeFile(join(runDir, 'audio.json'), `${JSON.stringify(clips, null, 2)}\n`);
  return clips;
}
