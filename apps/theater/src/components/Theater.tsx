import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../App';
import { AudioEngine } from '../lib/audio';
import { Clock, SPEEDS, useClock } from '../lib/clock';
import { loadRun } from '../lib/load';
import { buildShow, chapterAt, formatMoment, parseMoment } from '../lib/show';
import type { Run } from '../lib/types';
import { Controls } from './Controls';
import { HelpDialog } from './HelpDialog';
import { Back, Mark } from './Icons';
import { LENSES, type LensId } from './Race';
import { ShowView } from './ShowView';
import { Stage } from './Stage';

export function Theater({ runId, present }: { runId: string; present: boolean }) {
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadRun(runId).then(setRun, (e) => setError(String(e.message ?? e)));
  }, [runId]);
  if (error) {
    return (
      <main className="grid h-full place-items-center p-8 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Can’t play this run</h1>
          <p className="mt-3 text-dim">{error}</p>
          <button className="mt-6 rounded-full bg-fg px-5 py-2.5 font-semibold text-ink" onClick={() => navigate('')}>All runs</button>
        </div>
      </main>
    );
  }
  if (!run) {
    return (
      <main className="grid h-full place-items-center" aria-busy="true">
        <p className="flex items-center gap-3 text-dim"><Mark size={22} /> Loading run…</p>
      </main>
    );
  }
  return <Player run={run} present={present} />;
}

const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(`theater.${k}`);
      return v == null ? d : (JSON.parse(v) as T);
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(`theater.${k}`, JSON.stringify(v));
    } catch {
      /* private mode */
    }
  },
};

function Player({ run, present }: { run: Run; present: boolean }) {
  const [trim, setTrim] = useState(() => store.get('trim', true));
  const [lens, setLens] = useState<LensId>(() => store.get('lens', 'none'));
  const [revealPage, setRevealPage] = useState(() => store.get('reveal', false));
  const [muted, setMuted] = useState(() => store.get('muted', false));
  const [keys, setKeys] = useState(() => store.get('keys', true));
  const [helpOpen, setHelpOpen] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [announce, setAnnounce] = useState('');

  const show = useMemo(() => buildShow(run, trim), [run, trim]);
  const showRef = useRef(show);
  const clock = useMemo(() => new Clock(), []);
  const audio = useMemo(() => new AudioEngine(clock, () => showRef.current), [clock]);

  // Keep the playhead in the same chapter (at the same fraction) when idle-skipping is toggled.
  useEffect(() => {
    const old = showRef.current;
    const t = clock.get().t;
    showRef.current = show;
    clock.setDuration(show.duration);
    if (old !== show) {
      const c = chapterAt(old, t);
      const n = show.chapters.find((x) => x.id === c.id);
      if (n) clock.seek(n.start + ((t - c.start) / (c.end - c.start)) * (n.end - n.start));
    }
  }, [show, clock]);

  // Initial deep link.
  useEffect(() => {
    const t = parseMoment(show, new URLSearchParams(location.search).get('t'));
    if (t != null) clock.seek(t);
    const speed = Number(new URLSearchParams(location.search).get('speed'));
    if (SPEEDS.includes(speed)) clock.setSpeed(speed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    audio.preload([...run.lanes.values()].flatMap((l) => l.audio));
    const sync = () => setAnalyser(audio.analyser);
    audio.listeners.add(sync);
    const unlock = () => audio.unlock();
    addEventListener('pointerdown', unlock, { once: true });
    addEventListener('keydown', unlock, { once: true });
    if (present) audio.unlock();
    return () => {
      audio.listeners.delete(sync);
      removeEventListener('pointerdown', unlock);
      removeEventListener('keydown', unlock);
    };
  }, [audio, run, present]);
  useEffect(() => () => {
    audio.dispose();
    clock.dispose();
  }, [audio, clock]);
  useEffect(() => audio.setMuted(muted), [audio, muted]);

  useEffect(() => store.set('trim', trim), [trim]);
  useEffect(() => store.set('lens', lens), [lens]);
  useEffect(() => store.set('reveal', revealPage), [revealPage]);
  useEffect(() => store.set('muted', muted), [muted]);
  useEffect(() => store.set('keys', keys), [keys]);

  const t = useClock(clock, (s) => s.t);
  const playing = useClock(clock, (s) => s.playing);
  const speed = useClock(clock, (s) => s.speed);
  const chapter = chapterAt(show, t);

  // Presentation mode: autoplay from the deep-linked moment, hide the cursor when idle.
  useEffect(() => {
    if (!present || new URLSearchParams(location.search).get('autoplay') === '0') return;
    const id = setTimeout(() => clock.play(), 1200);
    return () => clearTimeout(id);
  }, [present, clock]);
  const [cursorHidden, setCursorHidden] = useState(false);
  useEffect(() => {
    if (!present) return;
    let id = setTimeout(() => setCursorHidden(true), 1500);
    const move = () => {
      setCursorHidden(false);
      clearTimeout(id);
      id = setTimeout(() => setCursorHidden(true), 1500);
    };
    addEventListener('pointermove', move);
    return () => {
      clearTimeout(id);
      removeEventListener('pointermove', move);
    };
  }, [present]);

  // Announce chapter changes to assistive tech.
  const lastChapter = useRef(chapter.id);
  useEffect(() => {
    if (lastChapter.current === chapter.id) return;
    lastChapter.current = chapter.id;
    setAnnounce(`Chapter: ${chapter.title}`);
  }, [chapter]);

  // Deep link to the current moment whenever playback rests.
  useEffect(() => {
    if (playing) return;
    const p = new URLSearchParams(location.search);
    if (t > 0) p.set('t', formatMoment(show, t));
    else p.delete('t');
    history.replaceState(null, '', `?${p.toString()}`);
  }, [playing, t, show]);

  const actions = {
    toggle: () => {
      audio.unlock();
      clock.toggle();
    },
    seekBy: (ms: number) => clock.seek(clock.get().t + ms),
    seek: (ms: number) => clock.seek(ms),
    chapter: (dir: -1 | 1) => {
      const i = show.chapters.indexOf(chapterAt(show, clock.get().t));
      const c = show.chapters[Math.min(show.chapters.length - 1, Math.max(0, i + dir))];
      if (dir < 0 && clock.get().t - show.chapters[i].start > 1500) clock.seek(show.chapters[i].start);
      else clock.seek(c.start);
    },
    speed: (dir: -1 | 1) => {
      const i = SPEEDS.indexOf(clock.get().speed);
      const next = SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, i + dir))];
      clock.setSpeed(next);
      setAnnounce(`Speed ${next}×`);
    },
    setSpeed: (s: number) => clock.setSpeed(s),
    cycleLens: () => setLens((l) => {
      const next = LENSES[(LENSES.findIndex((x) => x.id === l) + 1) % LENSES.length];
      setAnnounce(`Vision lens: ${next.label}`);
      return next.id;
    }),
    copyLink: async () => {
      const p = new URLSearchParams(location.search);
      p.delete('present');
      p.set('t', formatMoment(show, clock.get().t));
      const url = `${location.origin}${location.pathname}?${p}`;
      try {
        await navigator.clipboard.writeText(url);
        setAnnounce('Link to this moment copied');
      } catch {
        setAnnounce(`Link: ${url}`);
      }
    },
    present: (on: boolean) => {
      const p = new URLSearchParams(location.search);
      if (on) p.set('present', '1');
      else p.delete('present');
      p.set('t', formatMoment(show, clock.get().t));
      if (on) document.documentElement.requestFullscreen?.().catch(() => {});
      else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      navigate(`?${p}`);
    },
  };
  const act = useRef(actions);
  act.current = actions;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest('input, select, textarea, dialog, [role="slider"]')) return;
      const a = act.current;
      const onButton = el.closest('button, a');
      const k = e.key;
      if (k === 'Escape' && present) return a.present(false);
      if (k === ' ' && !onButton) { e.preventDefault(); return a.toggle(); }
      if (k === 'ArrowLeft') { e.preventDefault(); return a.seekBy(e.shiftKey ? -1000 : -5000); }
      if (k === 'ArrowRight') { e.preventDefault(); return a.seekBy(e.shiftKey ? 1000 : 5000); }
      if (k === 'PageUp') { e.preventDefault(); return a.chapter(-1); }
      if (k === 'PageDown') { e.preventDefault(); return a.chapter(1); }
      if (k === 'Home') { e.preventDefault(); return a.seek(0); }
      if (k === 'End') { e.preventDefault(); return a.seek(show.duration); }
      if (k === '?') return setHelpOpen(true);
      if (!keys) return; // single-character shortcuts can be switched off (WCAG 2.1.4)
      const lower = k.toLowerCase();
      if (lower === 'k') return a.toggle();
      if (lower === 'j') return a.seekBy(-10000);
      if (lower === 'l') return a.seekBy(10000);
      if (k === '[') return a.chapter(-1);
      if (k === ']') return a.chapter(1);
      if (k === '-' || k === '<') return a.speed(-1);
      if (k === '=' || k === '+' || k === '>') return a.speed(1);
      if (/^[1-9]$/.test(k)) {
        const c = show.chapters[Number(k) - 1];
        if (c) a.seek(c.start);
        return;
      }
      if (lower === 'r') return setRevealPage((v) => { setAnnounce(v ? 'Page reveal off' : 'Page reveal on'); return !v; });
      if (lower === 'v') return a.cycleLens();
      if (lower === 'm') return setMuted((v) => { setAnnounce(v ? 'Sound on' : 'Muted'); return !v; });
      if (lower === 't') return setTrim((v) => { setAnnounce(v ? 'Real time' : 'Skipping idle time'); return !v; });
      if (lower === 'c') return void a.copyLink();
      if (lower === 'p' || lower === 'f') return a.present(!present);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [keys, present, show]);

  const settings = { lens, revealPage, analyser };
  const stageLabel = `Replay of run ${run.id}${run.fixture ? ' (fixture, not a real run)' : ''}`;

  if (present) {
    return (
      <main className={`h-full bg-black ${cursorHidden ? 'cursor-hidden' : ''}`}>
        <h1 className="sr-only">Blind Run Theater, presentation mode. Press Escape to exit, question mark for shortcuts.</h1>
        <Stage label={stageLabel}>
          <ShowView run={run} show={show} t={t} settings={settings} />
        </Stage>
        <div role="status" aria-live="polite" className="sr-only">{announce}</div>
        <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} keys={keys} setKeys={setKeys} />
      </main>
    );
  }

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] bg-ink">
      <a href="#controls" className="skip-link">Skip to player controls</a>
      <header className="flex h-14 items-center gap-4 border-b border-line px-5">
        <button onClick={() => navigate('')} className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[14px] text-dim hover:bg-white/5 hover:text-fg">
          <Back size={16} /> All runs
        </button>
        <h1 className="min-w-0 truncate text-[15px] font-medium">
          {run.meta.title ?? run.meta.task ?? run.id}
          <span className="ml-2 font-mono text-[13px] text-faint">{run.id}</span>
        </h1>
        {run.fixture && <span className="rounded-full border border-focus/40 bg-focus/10 px-2.5 py-0.5 text-[12px] font-semibold uppercase tracking-wider text-focus">Fixture</span>}
      </header>
      <main className="min-h-0 p-3">
        <Stage label={stageLabel}>
          <ShowView run={run} show={show} t={t} settings={settings} />
        </Stage>
      </main>
      <Controls
        id="controls"
        show={show}
        t={t}
        playing={playing}
        speed={speed}
        lens={lens}
        revealPage={revealPage}
        muted={muted}
        trim={trim}
        hasAudio={[...run.lanes.values()].some((l) => l.audio.length > 0)}
        onToggle={actions.toggle}
        onSeek={actions.seek}
        onSpeed={actions.setSpeed}
        onLens={setLens}
        onReveal={() => setRevealPage((v) => !v)}
        onMute={() => setMuted((v) => !v)}
        onTrim={() => setTrim((v) => !v)}
        onCopy={() => void actions.copyLink()}
        onPresent={() => actions.present(true)}
        onHelp={() => setHelpOpen(true)}
      />
      <div role="status" aria-live="polite" className="sr-only">{announce}</div>
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} keys={keys} setKeys={setKeys} />
    </div>
  );
}
