import { useEffect, useState } from 'react';
import { navigate } from '../App';
import { loadIndex } from '../lib/load';
import type { RunSummary } from '../lib/types';
import { Arrow, Expand, Mark } from './Icons';

export function RunIndex() {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  useEffect(() => {
    loadIndex().then(setRuns, () => setRuns([]));
    document.title = 'Blind Run Theater';
  }, []);

  return (
    <div className="min-h-full bg-ink">
      <a href="#runs" className="skip-link">Skip to runs</a>
      <header className="mx-auto flex max-w-[1240px] items-center gap-3 px-6 pt-10">
        <Mark size={30} />
        <span className="text-[18px] font-semibold tracking-tight">Blind Run</span>
        <span className="text-[18px] text-faint">Theater</span>
      </header>
      <main className="mx-auto max-w-[1240px] px-6 pb-24">
        <section className="pb-14 pt-20">
          <h1 className="max-w-[900px] text-[clamp(40px,6vw,76px)] font-semibold leading-[1.0] tracking-[-0.04em]">
            Your app works when you can see it.{' '}
            <span className="font-serif font-normal italic text-dim">Does it work with your eyes closed?</span>
          </h1>
          <p className="mt-6 max-w-[680px] text-[19px] leading-relaxed text-dim">
            Each run below is a recording: Kane CLI does the same task twice, once sighted and once blind (black screen, keyboard only,
            screen-reader voice). When the blind run fails, a coding agent fixes the app and Kane proves the fix. Everything plays from
            committed files; no keys or network needed.
          </p>
        </section>

        <section id="runs" tabIndex={-1} aria-labelledby="runs-title">
          <h2 id="runs-title" className="mb-5 text-[13px] font-semibold uppercase tracking-[0.22em] text-faint">Recorded runs</h2>
          {runs == null && <p className="text-dim" aria-busy="true">Loading runs…</p>}
          {runs?.length === 0 && (
            <p className="rounded-[20px] border border-dashed border-line-strong p-8 text-dim">
              No runs found. Record one with <code className="font-mono text-fg">blindrun demo</code>, or add a directory under <code className="font-mono text-fg">runs/</code>.
            </p>
          )}
          <ul className="grid gap-5 md:grid-cols-2">
            {runs?.map((r, i) => <RunCard key={r.id} run={r} featured={i === 0} />)}
          </ul>
        </section>
      </main>
    </div>
  );
}

function RunCard({ run, featured }: { run: RunSummary; featured: boolean }) {
  const before = run.outcome?.blindBefore;
  const after = run.outcome?.blindAfter;
  const barriers = run.outcome?.barriers?.length ?? 0;
  const href = `?run=${encodeURIComponent(run.id)}`;
  const date = run.createdAt ? new Date(run.createdAt) : null;
  const st = run.stats;
  const secs = (ms?: number | null) => (ms != null ? `${(ms / 1000).toFixed(1)} s` : '—');
  return (
    <li className={`group relative overflow-hidden rounded-[24px] border border-line bg-panel transition hover:border-line-strong ${featured ? 'md:col-span-2 md:grid md:grid-cols-[1.35fr_1fr]' : ''}`}>
      <div className={`relative overflow-hidden bg-black ${featured ? 'aspect-[16/10] md:aspect-auto md:min-h-[400px]' : 'aspect-[16/9]'}`}>
        {run.thumb ? (
          <img src={`runs/${encodeURIComponent(run.id)}/${run.thumb}`} alt="" className="absolute inset-0 size-full object-cover opacity-80 transition duration-500 group-hover:scale-[1.02] group-hover:opacity-100" />
        ) : (
          <div className="grid size-full place-items-center text-faint">No preview</div>
        )}
        <div className={`absolute inset-0 ${featured ? 'bg-gradient-to-r from-transparent via-transparent to-panel/60' : 'bg-gradient-to-t from-panel via-transparent to-transparent'}`} />
        {run.fixture && (
          <span className="absolute left-4 top-4 rounded-full border border-focus/40 bg-black/70 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-focus backdrop-blur">
            Fixture · not a real run
          </span>
        )}
      </div>
      <div className={featured ? 'flex flex-col p-8' : 'p-6'}>
        <h3 className={`${featured ? 'text-[28px]' : 'text-[22px]'} font-semibold leading-snug tracking-tight`}>
          <a
            href={href}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return;
              e.preventDefault();
              navigate(href);
            }}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {run.task ?? run.title ?? run.id}
          </a>
        </h3>
        <p className="mt-1.5 truncate font-mono text-[13px] text-faint">
          {run.url ?? ''} {date && !isNaN(+date) ? `· ${date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
        </p>
        {st?.before && (
          <dl className="mt-6 grid grid-cols-3 gap-4">
            <div>
              <dt className="text-[12px] font-semibold uppercase tracking-[0.16em] text-faint">Sighted</dt>
              <dd className="mt-1 text-[22px] font-semibold tabular">{secs(st.sightedMs)}</dd>
            </div>
            <div>
              <dt className="text-[12px] font-semibold uppercase tracking-[0.16em] text-faint">Blind before</dt>
              <dd className={`mt-1 text-[22px] font-semibold tabular ${st.before.status === 'failed' ? 'text-fail' : ''}`}>{st.before.status === 'failed' ? <><span aria-hidden="true">∞</span><span className="sr-only">did not finish</span></> : secs(st.before.ms)}</dd>
            </div>
            <div>
              <dt className="text-[12px] font-semibold uppercase tracking-[0.16em] text-faint">Blind after</dt>
              <dd className={`mt-1 text-[22px] font-semibold tabular ${st.after?.status === 'passed' ? 'text-pass' : st.after?.status === 'failed' ? 'text-fail' : ''}`}>{st.after ? (st.after.status === 'passed' ? secs(st.after.ms) : st.after.status) : '—'}</dd>
            </div>
          </dl>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-2 text-[13px] font-medium">
          {before && <Badge tone={before === 'passed' ? 'pass' : 'fail'}>Blind before fix: {before}</Badge>}
          {after && <Badge tone={after === 'passed' ? 'pass' : 'fail'}>after: {after}</Badge>}
          {barriers > 0 && <Badge tone="dim">{barriers} barrier{barriers > 1 ? 's' : ''}</Badge>}
          {st && st.credits > 0 && <Badge tone="dim">{st.credits} credits</Badge>}
          {run.broken && <Badge tone="fail">run.json unreadable</Badge>}
        </div>
        <div className={`relative z-10 flex items-center gap-3 ${featured ? 'mt-auto pt-8' : 'mt-6'}`}>
          <span className="flex items-center gap-2 text-[15px] font-semibold text-fg" aria-hidden="true">
            Watch <Arrow size={16} className="transition group-hover:translate-x-0.5" />
          </span>
          <a
            href={`${href}&present=1`}
            className="ml-auto flex items-center gap-2 rounded-full border border-line-strong px-3.5 py-1.5 text-[13px] text-dim hover:text-fg"
            aria-label={`Present “${run.task ?? run.id}” full screen`}
          >
            <Expand size={14} /> Present
          </a>
        </div>
      </div>
    </li>
  );
}

function Badge({ tone, children }: { tone: 'pass' | 'fail' | 'dim'; children: React.ReactNode }) {
  const cls = { pass: 'bg-pass-soft text-pass', fail: 'bg-fail-soft text-fail', dim: 'bg-white/5 text-dim' }[tone];
  return <span className={`rounded-full px-3 py-1 ${cls}`}>{children}</span>;
}
