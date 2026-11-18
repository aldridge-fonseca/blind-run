import type { Lane } from '../lib/types';
import { clamp, easeOutExpo, reveal, rise } from '../lib/util';
import { Cross } from './Icons';

/** The red moment: Kane's run_end verdict, every field quoted verbatim from kane.ndjson. */
export function Verdict({ lane, local }: { lane: Lane; local: number }) {
  const end = lane.runEnd;
  const v = end?.verdict ?? lane.meta?.verdict ?? {};
  const error = end?.per_flow_metadata?.find((m) => m.error_message)?.error_message ?? end?.reason ?? null;
  const confidence = typeof v.confidence === 'number' ? v.confidence : null;
  const flash = local < 900 ? Math.sin(clamp(local / 900) * Math.PI) : 0;
  const card = easeOutExpo(reveal(local, 150, 900, (x) => x));
  const gauge = easeOutExpo(clamp((local - 4200) / 1400));

  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 70% at 50% 45%, rgb(255 69 58 / .16), transparent 70%)', opacity: clamp(local / 600) }} />
      <div className="pointer-events-none absolute inset-0 bg-fail mix-blend-screen" style={{ opacity: flash * 0.22 }} />
      <div
        role="group"
        aria-label="Kane verdict"
        className="absolute left-1/2 top-[150px] w-[1240px] overflow-hidden rounded-[32px] border border-fail/35 bg-[#0e0607]/95 shadow-[0_60px_160px_-30px_rgb(255_69_58_/_.45)] backdrop-blur-2xl"
        style={{ opacity: card, transform: `translate(-50%, ${(1 - card) * 40}px) scale(${0.96 + 0.04 * card})` }}
      >
        <div className="h-1 bg-gradient-to-r from-fail via-fail/60 to-transparent" />
        <div className="px-14 pb-12 pt-10">
          <div className="flex items-center gap-4" style={rise(local, 450)}>
            <span className="grid size-11 place-items-center rounded-full bg-fail text-black"><Cross size={22} /></span>
            <span className="text-[15px] font-semibold uppercase tracking-[0.24em] text-fail">Kane CLI verdict · blind run</span>
            <span className="ml-auto flex gap-2 font-mono text-[15px]">
              {end?.result_code != null && <Tag strong>result_code {end.result_code}</Tag>}
              {end?.reason_code && <Tag>{end.reason_code}</Tag>}
            </span>
          </div>

          <Field label="verdict.bug_title" at={900} local={local}>
            <h2 className="text-[54px] font-semibold leading-[1.05] tracking-[-0.025em] text-white" style={{ textWrap: 'balance' }}>{v.bug_title ?? end?.one_liner ?? 'Blind run failed'}</h2>
          </Field>

          {v.one_liner && (
            <Field label="verdict.one_liner" at={1700} local={local}>
              <p className="font-serif text-[36px] italic leading-[1.2] text-[#ffd9d6]">“{v.one_liner}”</p>
            </Field>
          )}

          <div className="mt-9 grid grid-cols-[1fr_1fr_220px] gap-6">
            <Box label="per_flow_metadata.error_message" at={2600} local={local}>
              <p className="font-mono text-[18px] leading-[1.5] text-[#ffb4ae]">{error ?? '—'}</p>
            </Box>
            <Box label="verdict.suggestion" at={3300} local={local}>
              <p className="text-[18px] leading-[1.5] text-fg">{v.suggestion ?? '—'}</p>
            </Box>
            <Box label="verdict.confidence" at={4000} local={local}>
              {confidence != null ? (
                <div className="flex flex-col items-center">
                  <Gauge value={confidence * gauge} />
                  <p className="mt-2 font-mono text-[15px] text-dim">{confidence}</p>
                </div>
              ) : <p className="text-dim">—</p>}
            </Box>
          </div>

          <div className="mt-7 flex items-center gap-3 text-[15px] text-faint" style={rise(local, 5200)}>
            {v.family && <Tag>family: {v.family}</Tag>}
            {v.severity && <Tag>severity: {v.severity}</Tag>}
            {v.category && <Tag>category: {v.category}</Tag>}
            <span className="ml-auto">
              Quoted verbatim from <a className="pointer-events-auto font-mono text-dim underline decoration-white/20 underline-offset-4 hover:text-fg" href={`${lane.base}/kane.ndjson`} target="_blank" rel="noreferrer">{lane.dir}/kane.ndjson</a> · run_end
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tag({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return <span className={`rounded-full border px-3 py-1 font-mono text-[14px] ${strong ? 'border-fail/50 bg-fail-soft text-fail' : 'border-white/12 text-dim'}`}>{children}</span>;
}

function Field({ label, at, local, children }: { label: string; at: number; local: number; children: React.ReactNode }) {
  return (
    <div className="mt-8" style={rise(local, at, 800, 22)}>
      <p className="mb-2 font-mono text-[14px] tracking-wide text-fail/70">{label}</p>
      {children}
    </div>
  );
}

function Box({ label, at, local, children }: { label: string; at: number; local: number; children: React.ReactNode }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-6" style={rise(local, at, 800, 22)}>
      <p className="mb-3 font-mono text-[14px] tracking-wide text-fail/70">{label}</p>
      {children}
    </div>
  );
}

function Gauge({ value }: { value: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
      <circle cx="66" cy="66" r={r} fill="none" stroke="rgb(255 255 255 / .08)" strokeWidth="10" />
      <circle cx="66" cy="66" r={r} fill="none" stroke="#ff453a" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${c * value} ${c}`} transform="rotate(-90 66 66)" />
      <text x="66" y="74" textAnchor="middle" fill="#fff" fontSize="30" fontWeight="600" fontFamily="Geist Variable">{Math.round(value * 100)}%</text>
    </svg>
  );
}
