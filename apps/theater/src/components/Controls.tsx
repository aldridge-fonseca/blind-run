import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { SPEEDS } from '../lib/clock';
import { chapterAt, type Show } from '../lib/show';
import { clamp, fmtShort } from '../lib/util';
import { Expand, Eye, FastForward, Link, Pause, Play, Speaker, SpeakerOff } from './Icons';
import { LENSES, type LensId } from './Race';

type Props = {
  id: string;
  show: Show;
  t: number;
  playing: boolean;
  speed: number;
  lens: LensId;
  revealPage: boolean;
  muted: boolean;
  trim: boolean;
  hasAudio: boolean;
  onToggle: () => void;
  onSeek: (t: number) => void;
  onSpeed: (s: number) => void;
  onLens: (l: LensId) => void;
  onReveal: () => void;
  onMute: () => void;
  onTrim: () => void;
  onCopy: () => void;
  onPresent: () => void;
  onHelp: () => void;
};

export function Controls(p: Props) {
  return (
    <section id={p.id} tabIndex={-1} aria-label="Player controls" className="border-t border-line bg-panel/80 px-5 pb-4 pt-3 backdrop-blur">
      <Timeline show={p.show} t={p.t} onSeek={p.onSeek} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={p.onToggle}
          aria-label={p.playing ? 'Pause' : 'Play'}
          aria-keyshortcuts="Space K"
          className="grid size-11 place-items-center rounded-full bg-fg text-ink transition hover:scale-105 active:scale-95"
        >
          {p.playing ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <p className="ml-1 min-w-[112px] font-mono text-[14px] text-dim tabular" aria-label={`${fmtShort(p.t)} of ${fmtShort(p.show.duration)}`}>
          <span className="text-fg">{fmtShort(p.t)}</span> / {fmtShort(p.show.duration)}
        </p>
        <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
        <Labeled label="Speed">
          <select value={p.speed} onChange={(e) => p.onSpeed(Number(e.target.value))} className={selectCls} aria-keyshortcuts="- =">
            {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
          </select>
        </Labeled>
        <Labeled label="Vision lens">
          <select value={p.lens} onChange={(e) => p.onLens(e.target.value as LensId)} className={selectCls} aria-keyshortcuts="V">
            {LENSES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </Labeled>
        <Toggle pressed={p.revealPage} onClick={p.onReveal} shortcut="R" icon={<Eye size={17} />}>Reveal page</Toggle>
        <Toggle pressed={p.trim} onClick={p.onTrim} shortcut="T" icon={<FastForward size={15} />}>Skip idle time</Toggle>
        <Toggle pressed={p.muted} onClick={p.onMute} shortcut="M" icon={p.muted ? <SpeakerOff size={17} /> : <Speaker size={17} />} disabled={!p.hasAudio} title={p.hasAudio ? undefined : 'This run has no recorded audio'}>
          Mute
        </Toggle>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={p.onCopy} className={btnCls} aria-keyshortcuts="C"><Link size={16} /> Copy link to moment</button>
          <button onClick={p.onPresent} className={btnCls} aria-keyshortcuts="P"><Expand size={16} /> Present</button>
          <button onClick={p.onHelp} className={btnCls} aria-keyshortcuts="?" aria-haspopup="dialog">Shortcuts</button>
        </div>
      </div>
    </section>
  );
}

const btnCls = 'flex h-10 items-center gap-2 rounded-full border border-line-strong px-4 text-[14px] font-medium text-fg hover:bg-white/5';
const selectCls = 'h-10 rounded-full border border-line-strong bg-raised px-3 text-[14px] text-fg';

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-dim">
      {label}
      {children}
    </label>
  );
}

function Toggle({ pressed, onClick, children, icon, shortcut, disabled, title }: { pressed: boolean; onClick: () => void; children: ReactNode; icon: ReactNode; shortcut: string; disabled?: boolean; title?: string }) {
  return (
    <button
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-keyshortcuts={shortcut}
      className={`flex h-10 items-center gap-2 rounded-full border px-4 text-[14px] font-medium transition disabled:opacity-40 ${pressed ? 'border-fg bg-fg text-ink' : 'border-line-strong text-fg hover:bg-white/5'}`}
    >
      {icon}
      {children}
    </button>
  );
}

function Timeline({ show, t, onSeek }: { show: Show; t: number; onSeek: (t: number) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const ch = chapterAt(show, t);
  const toTime = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return clamp((clientX - r.left) / r.width) * show.duration;
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    onSeek(toTime(e.clientX));
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) onSeek(toTime(e.clientX));
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = show.chapters.indexOf(ch);
    const map: Record<string, number> = {
      ArrowLeft: t - 5000, ArrowDown: t - 5000, ArrowRight: t + 5000, ArrowUp: t + 5000, Home: 0, End: show.duration,
      PageUp: show.chapters[Math.max(0, t - ch.start > 1500 ? i : i - 1)].start, PageDown: show.chapters[Math.min(show.chapters.length - 1, i + 1)].start,
    };
    if (e.key in map) {
      e.preventDefault();
      onSeek(map[e.key]);
    }
  };
  const pct = (x: number) => `${(x / show.duration) * 100}%`;
  return (
    <div>
      <nav aria-label="Chapters" className="relative mb-1.5 h-7">
        <ol>
          {show.chapters.map((c, i) => {
            const active = c === ch;
            return (
              <li key={c.id} className="absolute top-0" style={{ left: pct(c.start), width: pct(c.end - c.start) }}>
                <button
                  onClick={() => onSeek(c.start)}
                  aria-current={active ? 'step' : undefined}
                  className={`max-w-full truncate rounded-md px-1.5 py-0.5 text-left text-[12px] font-semibold uppercase tracking-[0.12em] hover:text-fg ${active ? 'text-fg' : 'text-faint'}`}
                >
                  <span className="mr-1.5 font-mono text-faint">{i + 1}<span className="sr-only"> </span></span>
                  {c.short}
                  <span className="sr-only">: {c.title}, starts at {fmtShort(c.start)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Timeline"
        aria-valuemin={0}
        aria-valuemax={Math.round(show.duration / 1000)}
        aria-valuenow={Math.round(t / 1000)}
        aria-valuetext={`${fmtShort(t)} of ${fmtShort(show.duration)}, chapter ${ch.title}`}
        onPointerDown={down}
        onPointerMove={move}
        onKeyDown={key}
        className="group relative flex h-6 cursor-pointer items-center"
      >
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          {show.chapters.map((c) => (
            <div key={c.id} className={`absolute inset-y-0 ${c.kind === 'verdict' ? 'bg-fail/35' : c.kind === 'race' && c.round > 1 ? 'bg-pass/30' : ''}`} style={{ left: pct(c.start), width: pct(c.end - c.start) }} />
          ))}
          <div className="absolute inset-y-0 left-0 bg-fg" style={{ width: pct(t) }} />
        </div>
        {show.chapters.slice(1).map((c) => (
          <span key={c.id} aria-hidden="true" className="absolute top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-full bg-ink" style={{ left: pct(c.start) }} />
        ))}
        <span aria-hidden="true" className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg shadow-[0_0_0_4px_rgb(0_0_0_/_.5)] transition-transform group-hover:scale-110" style={{ left: pct(t) }} />
      </div>
    </div>
  );
}
