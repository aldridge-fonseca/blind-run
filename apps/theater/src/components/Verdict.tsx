import type { Lane } from '../lib/types';
import { clamp, easeOutExpo, reveal, rise } from '../lib/util';
import { Cross } from './Icons';

/** The red moment: Kane's run_end verdict, every field quoted verbatim from kane.ndjson. */
export function Verdict({ lane, local, fixture }: { lane: Lane; local: number; fixture?: boolean }) {
  const end = lane.runEnd;
  const v = end?.verdict ?? lane.meta?.verdict ?? {};
  const error = end?.per_flow_metadata?.find((m) => m.error_message)?.error_message ?? end?.reason ?? null;
  const confidence = typeof v.confidence === 'number' ? v.confidence : null;
  const flash = local < 900 ? Math.sin(clamp(local / 900) * Math.PI) : 0;
  const card = easeOutExpo(reveal(local, 150, 900, (x) => x));

  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 70% at 50% 45%, rgb(255 69 58 / .28), transparent 75%)', opacity: clamp(local / 500) }} />
      <div className="pointer-events-none absolute inset-0 bg-fail mix-blend-screen" style={{ opacity: flash * 0.22 }} />
      <div
        role="group"
        aria-label="Kane verdict"
        className="absolute left-1/2 top-[112px] w-[1560px] overflow-hidden rounded-[32px] border-[1.5px] border-fail/75 bg-[#0e0607]/95 shadow-[0_60px_160px_-30px_rgb(255_69_58_/_.45)] backdrop-blur-2xl"
        style={{ opacity: card, transform: `translate(-50%, ${(1 - card) * 40}px) scale(${0.96 + 0.04 * card})` }}
      >
        <div className="h-1 bg-gradient-to-r from-fail via-fail/60 to-transparent" />
        <div className="px-14 pb-12 pt-10">
          <div className="flex items-center gap-4" style={rise(local, 100, 400)}>
            <span className="grid size-11 place-items-center rounded-full bg-fail text-black"><Cross size={22} /></span>
            <span className="text-[15px] font-semibold uppercase tracking-[0.24em] text-fail">Kane CLI verdict · blind run</span>
            <span className="ml-auto flex gap-2 font-mono text-[15px]">
              {fixture && <span className="rounded-full border border-focus/40 bg-focus/10 px-3 py-1 font-sans text-[13px] font-semibold uppercase tracking-[0.14em] text-focus">Fixture · not a real run</span>}
              {end?.result_code != null && <Tag strong>result_code {end.result_code}</Tag>}
              {end?.reason_code && <Tag strong>{end.reason_code}</Tag>}
            </span>
          </div>

          <Field label="verdict.bug_title" at={200} local={local}>
            <h2 className="text-[68px] font-semibold leading-[1.05] tracking-[-0.025em] text-white" style={{ textWrap: 'balance' }}>{v.bug_title ?? end?.one_liner ?? 'Blind run failed'}</h2>
          </Field>

          {v.one_liner && (
            <Field label="verdict.one_liner" at={700} local={local}>
              <p className="font-serif text-[30px] italic leading-[1.25] text-[#ffd9d6]">“{v.one_liner}”</p>
            </Field>
          )}

          <div className="mt-9 grid grid-cols-[1fr_1fr_200px] gap-6">
            <Box label="per_flow_metadata.error_message" at={1100} local={local}>
              <p className="font-mono text-[21px] leading-[1.5] text-[#ffb4ae]">{error ?? '—'}</p>
            </Box>
            <Box label="verdict.suggestion" at={1500} local={local}>
              <p className="text-[21px] leading-[1.5] text-fg">{v.suggestion ?? '—'}</p>
            </Box>
            <Box label="verdict.confidence" at={1900} local={local}>
              <p className="text-[64px] font-semibold leading-none tracking-tight tabular text-white">{confidence ?? '—'}</p>
              {v.severity && <p className="mt-4 font-mono text-[15px] text-dim">severity: {v.severity}</p>}
            </Box>
          </div>

          <div className="mt-7 flex items-center gap-3 text-[16px] text-dim" style={rise(local, 2400)}>
            {v.family && <Tag>family: {v.family}</Tag>}
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
      <p className="mb-2 font-mono text-[13px] tracking-[0.06em] text-[#ff8a80]">{label}</p>
      {children}
    </div>
  );
}

function Box({ label, at, local, children }: { label: string; at: number; local: number; children: React.ReactNode }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-6" style={rise(local, at, 800, 22)}>
      <p className="mb-3 font-mono text-[13px] tracking-[0.06em] text-[#ff8a80]">{label}</p>
      {children}
    </div>
  );
}
