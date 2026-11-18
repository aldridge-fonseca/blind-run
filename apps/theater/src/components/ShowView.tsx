import type { Chapter, Show } from '../lib/show';
import type { Run } from '../lib/types';
import { clamp, easeInOut } from '../lib/util';
import { End, Intro } from './Cards';
import { Fix } from './Fix';
import { Mark } from './Icons';
import { Race, type LensId } from './Race';
import { Verdict } from './Verdict';

export type ViewSettings = { lens: LensId; revealPage: boolean; analyser: AnalyserNode | null };

const FADE = 700;

/** Renders the stage at show time `t`: the current chapter, cross-faded with the previous one. */
export function ShowView({ run, show, t, settings }: { run: Run; show: Show; t: number; settings: ViewSettings }) {
  const idx = Math.max(0, show.chapters.findIndex((c) => t >= c.start && t < c.end));
  const ch = show.chapters[t >= show.duration ? show.chapters.length - 1 : idx];
  const local = t - ch.start;
  const prev = show.chapters[show.chapters.indexOf(ch) - 1];
  const fadeIn = easeInOut(clamp(local / FADE));
  return (
    <>
      <StageHeader run={run} chapter={ch} />
      {prev && fadeIn < 1 && !continues(prev, ch) && (
        <div className="absolute inset-0" style={{ opacity: 1 - fadeIn }} aria-hidden="true">
          <ChapterBody run={run} show={show} chapter={prev} local={prev.end - prev.start} settings={settings} />
        </div>
      )}
      <div className="absolute inset-0" style={{ opacity: prev && !continues(prev, ch) ? fadeIn : 1 }}>
        <ChapterBody run={run} show={show} chapter={ch} local={local} settings={settings} />
      </div>
      <ChapterRail show={show} t={t} />
    </>
  );
}

/** The verdict lands on top of the frozen race it judges, so no cross-fade between them. */
const continues = (a: Chapter, b: Chapter) => a.kind === 'race' && b.kind === 'verdict';

function ChapterBody({ run, show, chapter, local, settings }: { run: Run; show: Show; chapter: Chapter; local: number; settings: ViewSettings }) {
  switch (chapter.kind) {
    case 'intro':
      return <Intro run={run} local={local} />;
    case 'race':
      return <Race sighted={chapter.sighted} blind={chapter.blind} local={local} round={chapter.round} expect={run.meta.expect} lens={settings.lens} revealPage={settings.revealPage} analyser={settings.analyser} />;
    case 'verdict': {
      return <VerdictOverRace run={run} show={show} chapter={chapter} local={local} settings={settings} />;
    }
    case 'fix': {
      const prevVerdict = [...run.lanes.values()].filter((l) => l.status === 'failed' && l.kind === 'blind').at(chapter.fix.attempt - 1);
      const agent = typeof chapter.fix.result?.agent === 'string' ? (chapter.fix.result.agent as string) : 'Claude Code';
      return <Fix fix={chapter.fix} local={local} typingMs={chapter.typingMs} verdict={prevVerdict?.runEnd?.verdict ?? prevVerdict?.meta?.verdict} agentName={agent} />;
    }
    case 'end':
      return <End run={run} local={local} />;
  }
}

function VerdictOverRace({ run, show, chapter, local, settings }: { run: Run; show: Show; chapter: Extract<Chapter, { kind: 'verdict' }>; local: number; settings: ViewSettings }) {
  // The race this verdict judges stays underneath, frozen on its last frame.
  const prev = show.chapters[show.chapters.indexOf(chapter) - 1];
  const race = prev?.kind === 'race' ? prev : null;
  const dim = easeInOut(clamp(local / 900));
  return (
    <>
      {race && (
        <div className="absolute inset-0" aria-hidden="true" style={{ opacity: 1 - dim * 0.75, filter: `blur(${dim * 10}px)`, transform: `scale(${1 - dim * 0.03})` }}>
          <Race sighted={race.sighted} blind={race.blind} local={race.end - race.start} round={race.round} expect={run.meta.expect} lens={settings.lens} revealPage={settings.revealPage} analyser={null} />
        </div>
      )}
      <Verdict lane={chapter.lane} local={local} />
    </>
  );
}

function StageHeader({ run, chapter }: { run: Run; chapter: Chapter }) {
  const eyebrow = chapter.kind === 'race' ? (chapter.round === 1 ? 'Round 1 · same task, two users' : `Round ${chapter.round} · after the agent’s fix`) : chapter.title;
  return (
    <header className="absolute inset-x-0 top-0 flex h-[100px] items-center justify-between px-16">
      <div className="flex items-center gap-3">
        <Mark size={30} />
        <span className="text-[19px] font-semibold tracking-[-0.01em]">Blind Run</span>
        {run.fixture && (
          <span className="ml-3 rounded-full border border-focus/40 bg-focus/10 px-3 py-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-focus">Fixture · not a real run</span>
        )}
      </div>
      {chapter.kind !== 'intro' && (
        <p className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[15px] font-semibold uppercase tracking-[0.24em] text-dim">{eyebrow}</p>
      )}
      {chapter.kind !== 'intro' && run.meta.task && (
        <p className="max-w-[520px] truncate text-right text-[17px] text-dim">
          Task: <span className="text-fg">“{run.meta.task}”</span>
        </p>
      )}
    </header>
  );
}

function ChapterRail({ show, t }: { show: Show; t: number }) {
  return (
    <div className="absolute inset-x-16 bottom-9 flex gap-2" aria-hidden="true">
      {show.chapters.map((c) => {
        const p = clamp((t - c.start) / (c.end - c.start));
        const active = t >= c.start && t < c.end;
        const tone = c.kind === 'verdict' ? 'bg-fail' : c.kind === 'race' && c.round > 1 ? 'bg-pass' : 'bg-fg';
        return (
          <div key={c.id} className="min-w-0" style={{ flex: `${Math.max(c.end - c.start, 6000)} 1 0` }}>
            <div className="h-[3px] overflow-hidden rounded-full bg-white/10">
              <div className={`h-full ${tone}`} style={{ width: `${p * 100}%`, opacity: active ? 1 : 0.5 }} />
            </div>
            <p className={`mt-2.5 truncate text-[13px] font-semibold uppercase tracking-[0.18em] ${active ? 'text-fg' : 'text-faint'}`}>{c.short}</p>
          </div>
        );
      })}
    </div>
  );
}
