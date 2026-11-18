// Serves recorded run directories as static files under /runs/ (dev) and copies them into dist/runs (build).
// Sources: the repo's committed runs/ directory, plus the Theater's own fixtures (always labelled "fixture").
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const theaterRoot = path.resolve(import.meta.dirname, '..');
// THEATER_RUNS=/path/a:/path/b adds more run directories (e.g. runs recorded elsewhere).
const sources = [
  ...(process.env.THEATER_RUNS ?? '').split(':').filter(Boolean).map((p) => path.resolve(p)),
  path.resolve(theaterRoot, '../../runs'),
  path.resolve(theaterRoot, 'fixtures'),
];

function runDirs(): Map<string, string> {
  const found = new Map<string, string>();
  for (const base of sources) {
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base)) {
      if (name.startsWith('_') || name.startsWith('.')) continue;
      const dir = path.join(base, name);
      if (!found.has(name) && fs.existsSync(path.join(dir, 'run.json'))) found.set(name, dir);
    }
  }
  return found;
}

function summarize(id: string, dir: string) {
  try {
    const run = JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf8'));
    const fixture = Boolean(run.fixture || run.label === 'fixture' || dir.startsWith(path.join(theaterRoot, 'fixtures')));
    const sighted = run.sequence?.find((s: { lane?: string }) => s.lane === 'sighted')?.dir;
    const thumb = sighted && fs.existsSync(path.join(dir, sighted, 'frames.json'))
      ? JSON.parse(fs.readFileSync(path.join(dir, sighted, 'frames.json'), 'utf8')).at(-1)?.file : null;
    // Lane facts for the index cards, read from each lane.json the sequence points at.
    const lane = (dir: string) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, 'lane.json'), 'utf8'));
      } catch {
        return null;
      }
    };
    const blinds: { status?: string; durationMs?: number }[] = [];
    let credits = 0;
    for (const s of run.sequence ?? []) {
      const l = lane(path.join(dir, s.dir));
      if (!l) continue;
      credits += Number(l.credits) || 0;
      if (s.lane === 'blind' || s.kind === 'fix') blinds.push(l);
    }
    const sightedLane = sighted ? lane(path.join(dir, sighted)) : null;
    const stats = {
      sightedMs: sightedLane?.durationMs ?? null,
      before: blinds[0] ? { status: blinds[0].status, ms: blinds[0].durationMs } : null,
      after: blinds.length > 1 ? { status: blinds.at(-1)!.status, ms: blinds.at(-1)!.durationMs } : null,
      credits: Math.round(credits * 10) / 10,
    };
    return { ...run, id, fixture, thumb: thumb ? `${sighted}/${thumb}` : null, stats };
  } catch (err) {
    return { id, broken: String(err) };
  }
}

function index() {
  return [...runDirs()].map(([id, dir]) => summarize(id, dir));
}

export function runsPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'blind-run-runs',
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir); },
    configureServer(server) {
      for (const base of sources) if (fs.existsSync(base)) server.watcher.add(base);
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url || '').split('?')[0]);
        const m = url.match(/^\/runs\/(.*)$/);
        if (!m) return next();
        if (m[1] === 'index.json') {
          res.setHeader('content-type', 'application/json');
          res.setHeader('cache-control', 'no-store');
          return res.end(JSON.stringify(index()));
        }
        const [id, ...rest] = m[1].split('/');
        const dir = runDirs().get(id);
        const file = dir && path.resolve(dir, rest.join('/'));
        if (!file || !file.startsWith(dir + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
          res.statusCode = 404;
          return res.end('not found');
        }
        const types: Record<string, string> = { '.json': 'application/json', '.jsonl': 'text/plain', '.ndjson': 'text/plain', '.md': 'text/plain', '.patch': 'text/plain', '.log': 'text/plain', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.webm': 'video/webm', '.mp4': 'video/mp4' };
        res.setHeader('content-type', `${types[path.extname(file)] || 'application/octet-stream'}; charset=utf-8`.replace(/(image|audio|video)\/(\w+); charset=utf-8/, '$1/$2'));
        fs.createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      const dest = path.join(outDir, 'runs');
      fs.rmSync(dest, { recursive: true, force: true });
      for (const [id, dir] of runDirs()) fs.cpSync(dir, path.join(dest, id), { recursive: true });
      fs.mkdirSync(dest, { recursive: true });
      fs.writeFileSync(path.join(dest, 'index.json'), JSON.stringify(index()));
    },
  };
}
