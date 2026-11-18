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
            {runs?.map((r) => <RunCard key={r.id} run={r} />)}
          </ul>
        </section>
      </main>
    </div>
  );
}

function RunCard({ run }: { run: RunSummary }) {
  const before = run.outcome?.blindBefore;
  const after = run.outcome?.blindAfter;
  const barriers = run.outcome?.barriers?.length ?? 0;
  const href = `?run=${encodeURIComponent(run.id)}`;
  const date = run.createdAt ? new Date(run.createdAt) : null;
  return (
    <li className="group relative overflow-hidden rounded-[24px] border border-line bg-panel transition hover:border-line-strong">
      <div className="relative aspect-[16/9] overflow-hidden bg-black">
        {run.thumb ? (
          <img src={`runs/${encodeURIComponent(run.id)}/${run.thumb}`} alt="" className="size-full object-cover opacity-80 transition duration-500 group-hover:scale-[1.02] group-hover:opacity-100" />
        ) : (
          <div className="grid size-full place-items-center text-faint">No preview</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-panel via-transparent to-transparent" />
        {run.fixture && (
          <span className="absolute left-4 top-4 rounded-full border border-focus/40 bg-black/70 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-focus backdrop-blur">
            Fixture · not a real run
          </span>
        )}
      </div>
      <div className="p-6">
        <h3 className="text-[22px] font-semibold leading-snug tracking-tight">
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
        <div className="mt-5 flex flex-wrap items-center gap-2 text-[13px] font-medium">
          {before && <Badge tone={before === 'passed' ? 'pass' : 'fail'}>Blind before fix: {before}</Badge>}
          {after && <Badge tone={after === 'passed' ? 'pass' : 'fail'}>after: {after}</Badge>}
          {barriers > 0 && <Badge tone="dim">{barriers} barrier{barriers > 1 ? 's' : ''}</Badge>}
          {run.broken && <Badge tone="fail">run.json unreadable</Badge>}
        </div>
        <div className="relative z-10 mt-6 flex items-center gap-3">
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
