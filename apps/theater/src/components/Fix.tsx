import { useMemo } from 'react';
import { Prism, normalizeTokens, type Token } from 'prism-react-renderer';
import { languageFor } from '../lib/diff';
import type { DiffFile, DiffLine, Fix as FixData, KaneVerdict } from '../lib/types';
import { clamp, easeOut, fmtSeconds, rise } from '../lib/util';
import { Check, File } from './Icons';

const TOKEN_COLOR: [RegExp, string][] = [
  [/comment|prolog|doctype|cdata/, '#6e6e7a'],
  [/keyword|important|atrule/, '#ff8fbf'],
  [/string|char|attr-value|template-string|regex/, '#ffd38a'],
  [/function|method/, '#7cc4ff'],
  [/class-name|maybe-class-name|builtin/, '#7ee0d4'],
  [/tag/, '#7cc4ff'],
  [/attr-name|property/, '#c3a6ff'],
  [/number|boolean|constant/, '#ffb86b'],
  [/punctuation|operator/, '#9a9aa6'],
];
const colorOf = (types: string[]) => {
  const key = types.join(' ');
  for (const [re, c] of TOKEN_COLOR) if (re.test(key)) return c;
  return '#e8e8ee';
};

type Row = DiffLine & { tokens: Token[]; file: number };

function useRows(files: DiffFile[]): Row[] {
  return useMemo(() => {
    const rows: Row[] = [];
    files.forEach((f, fi) => {
      const lang = languageFor(f.path);
      const grammar = Prism.languages[lang] ?? Prism.languages.jsx;
      for (const h of f.hunks) {
        const lines = h.lines.filter((l) => l.kind !== 'meta');
        const text = lines.map((l) => l.text).join('\n');
        const toks = normalizeTokens(Prism.tokenize(text, grammar));
        rows.push({ kind: 'meta', text: h.header.replace(/^@@.*?@@\s?/, '') || '…', oldNo: null, newNo: null, tokens: [], file: fi });
        lines.forEach((l, k) => rows.push({ ...l, tokens: toks[k] ?? [{ types: ['plain'], content: l.text }], file: fi }));
      }
    });
    return rows;
  }, [files]);
}

/** Splits rows into a typing schedule: removed/context lines appear at once, added lines type out. */
function schedule(rows: Row[], typingMs: number) {
  const addChars = rows.reduce((n, r) => n + (r.kind === 'add' ? r.text.trimStart().length : 0), 0) || 1;
  const perChar = typingMs / (addChars + rows.length * 3);
  let t = 0;
  return rows.map((r) => {
    const start = t;
    t += r.kind === 'add' ? (r.text.trimStart().length + 3) * perChar : 3 * perChar;
    return { start, end: t };
  });
}

const INTRO = 1600;

export function Fix({ fix, local, typingMs, verdict, agentName }: { fix: FixData; local: number; typingMs: number; verdict?: KaneVerdict | null; agentName: string }) {
  const rows = useRows(fix.files);
  const times = useMemo(() => schedule(rows, typingMs), [rows, typingMs]);
  const typeT = local - INTRO;
  const done = typeT >= typingMs;
  const visible = rows.map((r, i) => ({ r, i, s: times[i] })).filter(({ s }) => typeT >= s.start);
  const caret = visible.at(-1);
  const added = fix.files.reduce((n, f) => n + f.added, 0);
  const removed = fix.files.reduce((n, f) => n + f.removed, 0);
  const activeFile = caret?.r.file ?? 0;
  const LINE_H = 34;
  const VIEW_H = 780;
  const scroll = Math.max(0, visible.length * LINE_H - VIEW_H + 200);
  const result = fix.result ?? {};
  const files = fix.files.length ? fix.files : [];
  const brief = briefPoints(fix.brief, verdict);

  return (
    <div className="absolute inset-x-16 top-[112px] bottom-[110px]">
      <div className="grid h-full grid-cols-[460px_1fr] gap-10">
        <aside className="flex min-h-0 flex-col gap-5" aria-label="Agent brief">
          <div style={rise(local, 100)}>
            <p className="text-[14px] font-semibold uppercase tracking-[0.22em] text-dim">Attempt {fix.attempt}</p>
            <h2 className="mt-2 text-[42px] font-semibold leading-[1.05] tracking-[-0.025em]">{agentName}</h2>
            <p className="mt-2 text-[18px] leading-snug text-dim">Gets Kane’s verdict and what the screen reader said. Edits app source only.</p>
          </div>
          <div className="rounded-[22px] border border-line bg-panel px-6 py-5" style={rise(local, 450)}>
            <p className="mb-3 font-mono text-[14px] tracking-wide text-faint">{fix.dir}/brief.md</p>
            <ul className="space-y-2.5 text-[16px] leading-snug text-fg">
              {brief.map((b, i) => (
                <li key={i} className="flex gap-3" style={rise(local, 700 + i * 220, 600, 10)}>
                  <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-dim" />
                  <span className={i === 0 ? 'text-[19px] font-medium' : 'text-dim'}>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[22px] border border-line bg-panel px-6 py-5" style={rise(local, 900)}>
            <p className="font-mono text-[14px] tracking-wide text-faint">Files changed · <span className="text-pass">+{added}</span> <span className="text-fail">−{removed}</span></p>
            <ul className="mt-3 space-y-2">
              {files.map((f, i) => (
                <li key={f.path + i} className={`flex items-center gap-3 font-mono text-[16px] ${i === activeFile && !done ? 'text-fg' : 'text-dim'}`}>
                  <File size={17} /> <span className="truncate">{f.path}</span>
                  <span className="ml-auto shrink-0 text-[14px]"><span className="text-pass">+{f.added}</span> <span className="text-fail">−{f.removed}</span></span>
                </li>
              ))}
              {!files.length && <li className="text-dim">No diff.patch in this attempt.</li>}
            </ul>
          </div>
          <Status local={local} typingMs={typingMs} result={result} />
        </aside>

        <section aria-label="The agent’s diff" className="overflow-hidden rounded-[24px] border border-line-strong bg-[#08080b] shadow-[0_40px_120px_-40px_rgb(0_0_0_/_.9)]" style={rise(local, 250, 800, 30)}>
          <div className="flex h-14 items-center gap-2 border-b border-line bg-panel px-5">
            <div className="flex gap-1">
              {files.map((f, i) => (
                <span key={i} className={`rounded-[9px] px-3 py-1.5 font-mono text-[14px] ${i === activeFile ? 'bg-white/10 text-fg' : 'text-faint'}`}>{f.path.split('/').pop()}</span>
              ))}
            </div>
            <span className="ml-auto font-mono text-[13px] text-faint">{fix.dir}/diff.patch</span>
          </div>
          <div className="relative h-[calc(100%-56px)] overflow-hidden">
            <div className="absolute inset-x-0 top-0 py-5 font-mono text-[18px]" style={{ transform: `translateY(${-scroll}px)`, transition: 'transform 300ms ease-out' }}>
              {visible.map(({ r, i, s }) => <DiffRow key={i} row={r} progress={clamp((typeT - s.start) / Math.max(1, s.end - s.start))} isCaret={!done && caret?.i === i} />)}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#08080b] to-transparent" />
          </div>
        </section>
      </div>
    </div>
  );
}

function DiffRow({ row, progress, isCaret }: { row: Row; progress: number; isCaret: boolean }) {
  if (row.kind === 'meta') {
    return <div className="flex h-[34px] items-center bg-info/[0.06] px-6 text-[15px] text-info/80">@@ {row.text}</div>;
  }
  const add = row.kind === 'add';
  const del = row.kind === 'del';
  const indent = row.text.length - row.text.trimStart().length;
  const shown = add ? indent + Math.floor((row.text.length - indent) * progress) : row.text.length;
  let left = shown;
  return (
    <div className={`relative flex h-[34px] items-center whitespace-pre ${add ? 'bg-pass/[0.18]' : del ? 'bg-fail/[0.12]' : ''}`}>
      {(add || del) && <span className={`absolute inset-y-0 left-0 w-[3px] ${add ? 'bg-pass' : 'bg-fail'}`} />}
      <span className="w-16 shrink-0 pr-4 text-right text-[14px] text-white/25 tabular">{row.newNo ?? row.oldNo ?? ''}</span>
      <span className={`w-7 shrink-0 text-center ${add ? 'text-pass' : del ? 'text-fail' : 'text-white/20'}`}>{add ? '+' : del ? '−' : ' '}</span>
      <span className={del ? 'line-through decoration-fail/70' : ''}>
        {row.tokens.map((tok, k) => {
          if (left <= 0) return null;
          const text = tok.content.slice(0, left);
          left -= tok.content.length;
          return <span key={k} style={{ color: colorOf(tok.types) }}>{text}</span>;
        })}
        {isCaret && <span className="ml-px inline-block h-[22px] w-[2px] translate-y-[4px] animate-pulse bg-fg" />}
      </span>
    </div>
  );
}

function Status({ local, typingMs, result }: { local: number; typingMs: number; result: Record<string, unknown> }) {
  const typeEnd = INTRO + typingMs;
  const stages = [
    { at: INTRO, label: 'Editing source' },
    { at: typeEnd + 600, label: 'Patch applied, app rebuilt' },
    { at: typeEnd + 2200, label: 'Handing back to Kane for a blind rerun' },
  ];
  // The engine nests the agent's own timing under result.agent; result.durationMs is the blind rerun's.
  const agent = (result.agent ?? null) as { durationMs?: number; costUsd?: number; turns?: number } | null;
  const ms = agent ? agent.durationMs : result.durationMs;
  const dur = typeof ms === 'number' ? fmtSeconds(ms) : null;
  const cost = typeof agent?.costUsd === 'number' ? ` · ${agent.turns ?? '?'} turns · $${agent.costUsd.toFixed(2)}` : '';
  return (
    <div className="rounded-[22px] border border-line bg-panel px-6 py-5" style={rise(local, 1100)}>
      <ul className="space-y-2.5">
        {stages.map((s, i) => {
          const on = local >= s.at;
          const next = stages[i + 1];
          const complete = next ? local >= next.at : on && local >= s.at + 900;
          return (
            <li key={i} className="flex items-center gap-3 text-[16px]" style={{ opacity: on ? 1 : 0.3, transition: 'opacity .3s' }}>
              <span className={`grid size-6 place-items-center rounded-full ${complete ? 'bg-pass text-black' : on ? 'border-2 border-fg/70' : 'border border-white/20'}`} style={{ transform: `scale(${complete ? 1 : 0.9 + 0.1 * easeOut((local - s.at) / 300)})` }}>
                {complete && <Check size={14} />}
              </span>
              {s.label}
            </li>
          );
        })}
      </ul>
      {dur && <p className="mt-3 text-[14px] text-faint">Agent wall time: {dur}{cost}</p>}
    </div>
  );
}

function briefPoints(brief: string | null, verdict?: KaneVerdict | null): string[] {
  const pts: string[] = [];
  if (verdict?.suggestion) pts.push(`Kane suggests: ${verdict.suggestion.split(/(?<=\.)\s/)[0]}`);
  const rules = brief?.match(/^Rules?:\s*(.+)$/im)?.[1];
  const r = rules ? rules.replace(/`/g, '') : 'May edit app source only. Tests, objectives and the runner are off-limits.';
  pts.push(r.charAt(0).toUpperCase() + r.slice(1));
  pts.push('Done only when Kane’s blind rerun passes.');
  return pts;
}
