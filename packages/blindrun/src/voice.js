// ElevenLabs speech for a run's screen-reader announcements, cached by text hash in <run>/audio/.
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const MODEL = 'eleven_flash_v2_5';
// ElevenLabs premade voices, used when the key cannot list voices. Screen reader first, then narrator.
const KNOWN = { Roger: 'CwhRBWXzGAHq8TQ4Fs17', River: 'SAz9YHcvj6GT2YYXdXww', George: 'JBFqnCBsd6RMkjVDRZzb', Alice: 'Xb7hH8MSUJpSbSDYk0k2', Matilda: 'XrExE9yKIg1WjnnlVkGX' };

async function resolveVoice(apiKey, choices) {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': apiKey } });
    if (response.ok) {
      const voices = (await response.json()).voices ?? [];
      for (const choice of choices) {
        const voice = voices.find((item) => item.name?.toLowerCase().startsWith(choice.toLowerCase()));
        if (voice) return { name: choice, id: voice.voice_id };
      }
    }
  } catch { /* fall back to the premade ids */ }
  const name = choices.find((choice) => KNOWN[choice]);
  return { name, id: KNOWN[name] };
}

async function exists(path) { try { await stat(path); return true; } catch { return false; } }

async function synthesize(text, voice, apiKey, audioDir, speed) {
  const hash = createHash('sha256').update(`${MODEL}\0${voice.id}\0${speed}\0${text}`).digest('hex').slice(0, 24);
  const file = `audio/${hash}.mp3`;
  if (await exists(join(audioDir, '..', file))) return { file, cached: true };
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.id)}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.85, similarity_boost: 0.6, style: 0, use_speaker_boost: false, speed } }),
  });
  if (!response.ok) throw new Error(`ElevenLabs speech request failed (${response.status})`);
  await writeFile(join(audioDir, '..', file), Buffer.from(await response.arrayBuffer()));
  return { file, cached: false };
}

async function readLineJson(path) {
  try { return (await readFile(path, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line)); } catch { return []; }
}

/** Writes <run>/audio.json: [{t, file, text, lane, source, voice}] with `lane` = the lane's directory. */
export async function synthesizeRun(runDir, { apiKey, log = () => {} }) {
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is required for voice synthesis');
  const audioDir = join(runDir, 'audio');
  await mkdir(audioDir, { recursive: true });
  const run = JSON.parse(await readFile(join(runDir, 'run.json'), 'utf8'));
  const screenVoice = await resolveVoice(apiKey, ['Roger', 'River']);
  const clips = [];
  let made = 0;
  // Blind lanes only: that is where the screen reader is the user's only output. Reruns live in fix-N/.
  const dirs = (run.sequence ?? []).filter((s) => (s.kind === 'lane' && s.lane === 'blind') || s.kind === 'fix').map((s) => s.dir);
  for (const dir of dirs) {
    for (const item of await readLineJson(join(runDir, dir, 'announcements.jsonl'))) {
      const clip = await synthesize(item.text, screenVoice, apiKey, audioDir, 1.15);
      if (!clip.cached) made++;
      clips.push({ t: item.t, file: clip.file, text: item.text, lane: dir, source: item.source, voice: screenVoice.name });
    }
  }
  await writeFile(join(runDir, 'audio.json'), `${JSON.stringify(clips, null, 2)}\n`);
  log(`voice: ${clips.length} clip(s), ${made} new, voice ${screenVoice.name} (${MODEL})`);
  return clips;
}
