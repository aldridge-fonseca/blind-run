import { outcome } from '../lib/show';
import type { Run } from '../lib/types';
import { clamp, easeOutBack, easeOutExpo, fmtSeconds, rise, WCAG } from '../lib/util';
import { Check, External, Eye, EyeOff, File, Mark } from './Icons';

export function Intro({ run, local }: { run: Run; local: number }) {
  const m = run.meta;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(60% 50% at 50% 42%, rgb(255 255 255 / .06), transparent 70%)' }} />
      <div className="flex items-center gap-3" style={rise(local, 100)}>
        <Mark size={34} />
        <span className="text-[17px] font-semibold uppercase tracking-[0.32em] text-dim">Blind Run</span>
      </div>
      <h1 className="mt-10 text-[104px] font-semibold leading-[0.98] tracking-[-0.045em]" style={rise(local, 450, 900, 30)}>
        Same task. Two users.
      </h1>
      <p className="mt-4 font-serif text-[88px] italic leading-none text-dim" style={rise(local, 1100, 900, 30)}>
        One of them can’t see the screen.
      </p>
      <div className="mt-16 flex items-stretch gap-4" style={rise(local, 2000, 900, 20)}>
        <div className="rounded-[22px] border border-line-strong bg-panel px-8 py-6 text-left">
          <p className="font-mono text-[14px] uppercase tracking-[0.18em] text-faint">Task for Kane CLI</p>
          <p className="mt-2 max-w-[760px] text-[30px] font-medium leading-tight">“{m.task ?? 'Unknown task'}”</p>
          {m.expect && <p className="mt-2 text-[19px] text-dim">Pass when the page says <span className="text-fg">“{m.expect}”</span></p>}
        </div>
        <div className="flex flex-col justify-center gap-3 rounded-[22px] border border-line bg-panel px-7 py-6 text-left text-[18px]">
          <span className="flex items-center gap-3"><Eye size={20} /> Sighted: mouse and screen</span>
          <span className="flex items-center gap-3"><EyeOff size={20} /> Blind: keyboard, black screen, screen reader</span>
        </div>
      </div>
      {m.url && <p className="mt-8 font-mono text-[16px] text-faint" style={rise(local, 2600)}>{m.url}{m.app?.commit ? ` · ${String(m.app.commit).slice(0, 7)}` : ''}{m.kaneVersion ? ` · kane-cli ${m.kaneVersion}` : ''}</p>}
    </div>
  );
}

export function End({ run, local }: { run: Run; local: number }) {
  const o = outcome(run);
  const beforeFailed = o.before?.status === 'failed';
  const afterMs = o.after?.status === 'passed' ? o.after.durationMs : null;
  const p = easeOutExpo(clamp((local - 900) / 1200));
  const arrow = clamp((local - 1700) / 500);
  const num = easeOutBack(clamp((local - 2000) / 700));
  const groups = groupBarriers(run);
  const fixed = o.blindFixed;
  const evidence = evidenceLinks(run);

  return (
    <div className="absolute inset-0 px-24 pt-[128px]">
      <div className="absolute inset-0" style={{ background: `radial-gradient(60% 50% at 30% 30%, rgb(48 209 88 / ${0.1 * p}), transparent 70%)` }} />
      <p className="relative text-[17px] font-semibold uppercase tracking-[0.28em] text-dim" style={rise(local, 100)}>Blind completion time</p>
      <TimeBars run={run} local={local} />
      <div className="relative mt-4 flex items-center gap-10" aria-label={`Blind completion: ${beforeFailed ? 'did not finish' : o.before ? fmtSeconds(o.before.durationMs) : 'unknown'} before the fix${afterMs ? `, ${fmtSeconds(afterMs)} after` : ''}`}>
        <span className="relative text-[220px] font-light leading-none tracking-[-0.05em] text-fail" style={rise(local, 300, 900, 30)}>
          {beforeFailed ? '∞' : o.before ? (o.before.durationMs / 1000).toFixed(1) : '—'}
        </span>
        <svg width="160" height="40" viewBox="0 0 160 40" aria-hidden="true" style={{ opacity: arrow }}>
          <path d={`M4 20 H${4 + 140 * arrow}`} stroke="#71717a" strokeWidth="4" strokeLinecap="round" />
          {arrow > 0.9 && <path d="M130 6 L150 20 L130 34" fill="none" stroke="#71717a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
        <span className="flex items-baseline gap-4 text-[220px] font-semibold leading-none tracking-[-0.03em] text-pass tabular" style={{ opacity: clamp(num * 1.3), transform: `scale(${0.85 + 0.15 * num})`, transformOrigin: 'left center' }}>
          {afterMs != null ? (afterMs / 1000).toFixed(1) : '—'}
          <span className="text-[72px] font-medium tracking-tight">s</span>
        </span>
      </div>
      <p className="relative mt-2 text-[24px] text-dim" style={rise(local, 2400)}>
        {beforeFailed ? 'Before the fix, a blind user could not finish at all.' : 'Blind run before the fix.'}
        {o.sighted && o.sighted.status === 'passed' && <> Sighted user: <span className="text-fg">{fmtSeconds(o.sighted.durationMs)}</span>.</>}
      </p>

      <div className="relative mt-14 grid grid-cols-[1.35fr_1fr] gap-8">
        <section aria-label="Barriers found and fixed" className="rounded-[26px] border border-line bg-panel p-8" style={rise(local, 3000)}>
          <h2 className="text-[15px] font-semibold uppercase tracking-[0.22em] text-dim">Barriers found{fixed ? ' and fixed' : ''} · by WCAG criterion</h2>
          <ul className="mt-5 space-y-4">
            {groups.map((g, gi) => (
              <li key={g.wcag} className="flex gap-5" style={rise(local, 3400 + gi * 250, 600, 12)}>
                <span className="w-[86px] shrink-0 font-mono text-[26px] font-medium text-fg">{g.wcag}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[19px] font-medium text-dim">{WCAG[g.wcag] ?? 'WCAG'}</p>
                  {g.items.map((b) => (
                    <div key={b.id} className="mt-1.5">
                      <p className="line-clamp-2 text-[20px] leading-snug">{b.title}</p>
                      <p className="mt-1 flex items-center gap-2 text-[14px] text-faint">
                        {b.planted && <span className="rounded-full border border-white/12 px-2 py-px">planted</span>}
                        {b.foundBy && <span>found by {b.foundBy === 'blind' ? 'the blind run' : b.foundBy === 'explore' ? 'kane-cli explore' : b.foundBy}</span>}
                      </p>
                    </div>
                  ))}
                </div>
                <span className={`flex h-9 shrink-0 items-center gap-2 self-start rounded-full px-4 text-[15px] font-semibold ${g.fixed ? 'bg-pass-soft text-pass' : 'bg-white/5 text-dim'}`}>
                  {g.fixed ? <><Check size={15} /> Fixed</> : 'Open'}
                </span>
              </li>
            ))}
            {!groups.length && <li className="text-[19px] text-dim">No barriers recorded in run.json.</li>}
          </ul>
        </section>
        <div className="flex flex-col gap-8">
          <section aria-label="Run cost" className="grid grid-cols-3 gap-px overflow-hidden rounded-[26px] border border-line bg-line" style={rise(local, 3300)}>
            <Stat label="Kane runs" value={String(o.kaneRuns)} />
            <Stat label="Fix attempts" value={String(o.attempts)} />
            <Stat label="Credits used" value={o.credits ? o.credits.toFixed(1) : '—'} />
          </section>
          <section aria-label="Raw evidence" className="rounded-[26px] border border-line bg-panel p-7" style={rise(local, 3700)}>
            <h2 className="text-[15px] font-semibold uppercase tracking-[0.22em] text-dim">Raw evidence</h2>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5">
              {evidence.map((e) => (
                <li key={e.href}>
                  <a href={e.href} target="_blank" rel="noreferrer" className="flex min-h-10 items-center gap-2.5 font-mono text-[16px] text-dim underline decoration-white/15 underline-offset-4 hover:text-fg">
                    {e.external ? <External size={16} /> : <File size={16} />}
                    {e.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Horizontal bars comparing how long each lane took; a failed lane trails off to infinity. */
function TimeBars({ run, local }: { run: Run; local: number }) {
  const o = outcome(run);
  const rows = [
    o.sighted && { label: 'Sighted', lane: o.sighted },
    o.before && { label: 'Blind, before fix', lane: o.before },
    o.after && { label: 'Blind, after fix', lane: o.after },
  ].filter(Boolean) as { label: string; lane: NonNullable<typeof o.before> }[];
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.lane.durationMs)) * 1.25;
  const W = 560;
  return (
    <div className="absolute right-24 top-[190px] w-[640px] space-y-6" aria-hidden="true">
      {rows.map((r, i) => {
        const p = easeOutExpo(clamp((local - 1000 - i * 350) / 1300));
        const failed = r.lane.status === 'failed';
        const w = (r.lane.durationMs / max) * W * p;
        const color = failed ? '#ff453a' : r.lane.kind === 'sighted' ? '#f5f5f7' : '#30d158';
        return (
          <div key={r.label} style={{ opacity: clamp(p * 2) }}>
            <div className="mb-2 flex items-baseline justify-between text-[17px]">
              <span className="text-dim">{r.label}</span>
              <span className="font-medium tabular" style={{ color }}>{failed ? `gave up at ${fmtSeconds(r.lane.durationMs)}` : fmtSeconds(r.lane.durationMs)}</span>
            </div>
            <div className="relative h-3 rounded-full bg-white/[0.06]">
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: w, background: color }} />
              {failed && <div className="absolute inset-y-0 rounded-r-full" style={{ left: w, right: 0, opacity: p, background: 'repeating-linear-gradient(90deg, rgb(255 69 58 / .55) 0 6px, transparent 6px 12px)', maskImage: 'linear-gradient(90deg, #000, transparent)' }} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-panel px-7 py-6">
      <p className="text-[52px] font-semibold leading-none tracking-tight tabular">{value}</p>
      <p className="mt-3 text-[15px] font-medium uppercase tracking-[0.18em] text-faint">{label}</p>
    </div>
  );
}

function groupBarriers(run: Run) {
  const o = outcome(run);
  const map = new Map<string, { wcag: string; items: typeof o.barriers; fixed: boolean }>();
  for (const b of o.barriers) {
    const g = map.get(b.wcag) ?? { wcag: b.wcag, items: [], fixed: true };
    g.items.push(b);
    g.fixed = g.fixed && (b.fixed ?? o.blindFixed);
    map.set(b.wcag, g);
  }
  return [...map.values()];
}

export function evidenceLinks(run: Run) {
  const links: { label: string; href: string; external?: boolean }[] = [{ label: 'run.json', href: `${run.base}/run.json` }];
  for (const s of run.sequence) {
    if (s.kind === 'lane') {
      const lane = run.lanes.get(s.dir);
      if (!lane) continue;
      links.push({ label: `${s.dir}/kane.ndjson`, href: `${lane.base}/kane.ndjson` });
      if (lane.runEnd?.test_url) links.push({ label: `${s.dir} · Kane report`, href: lane.runEnd.test_url, external: true });
    } else {
      const fix = run.fixes.get(s.dir);
      if (fix?.diffText) links.push({ label: `${s.dir}/diff.patch`, href: `${fix.base}/diff.patch` });
      if (fix?.brief) links.push({ label: `${s.dir}/brief.md`, href: `${fix.base}/brief.md` });
      if (fix?.lane) links.push({ label: `${s.dir}/kane.ndjson`, href: `${fix.base}/kane.ndjson` });
      if (fix?.lane?.runEnd?.test_url) links.push({ label: `${s.dir} · Kane report`, href: fix.lane.runEnd.test_url, external: true });
    }
  }
  return links;
}
