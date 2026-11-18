import { useEffect, useState, type ReactNode } from 'react';
import { laneTimeAt, warpRate, type LaneView } from '../lib/show';
import type { Announcement, KaneStep, Lane } from '../lib/types';
import { clamp, easeOutBack, fmtClock, lastAt, reveal, rise } from '../lib/util';
import { Check, Cross, Eye, EyeOff, FastForward, Speaker } from './Icons';
import { Waveform } from './Waveform';

export type LensId = 'none' | 'blur' | 'lowvision' | 'tunnel';
export const LENSES: { id: LensId; label: string }[] = [
  { id: 'none', label: 'No lens' },
  { id: 'blur', label: 'Blur' },
  { id: 'lowvision', label: 'Low vision' },
  { id: 'tunnel', label: 'Tunnel vision' },
];

export const PANEL_W = 860;
const SCREEN_H = 538;

type RaceProps = {
  sighted: LaneView | null;
  blind: LaneView | null;
  local: number;
  round: number;
  expect?: string;
  lens: LensId;
  revealPage: boolean;
  analyser: AnalyserNode | null;
};

export function Race({ sighted, blind, local, round, expect, lens, revealPage, analyser }: RaceProps) {
  return (
    <div className="absolute inset-x-0 top-[100px] bottom-[96px] flex items-center justify-center gap-[56px]">
      {sighted ? <SightedPanel view={sighted} local={local} lens={lens} expect={expect} replay={round > 1} /> : <MissingPanel label="Sighted" />}
      {blind ? <BlindPanel view={blind} local={local} revealPage={revealPage} analyser={analyser} expect={expect} round={round} sighted={sighted?.lane ?? null} /> : <MissingPanel label="Blind" />}
    </div>
  );
}

function laneState(view: LaneView, local: number) {
  const laneT = Math.min(laneTimeAt(view.warp, Math.max(0, local)), view.lane.durationMs);
  const ended = laneT >= view.lane.durationMs;
  const rate = ended ? 1 : warpRate(view.warp, local);
  return { laneT, ended, rate, sinceEnd: local - view.warp.duration };
}

function MissingPanel({ label }: { label: string }) {
  return (
    <div className="grid place-items-center rounded-[28px] border border-dashed border-line-strong text-dim" style={{ width: PANEL_W, height: SCREEN_H + 230 }}>
      No {label.toLowerCase()} lane in this run.
    </div>
  );
}

function PanelHeader({ icon, label, sub, status, laneT, rate, tone }: {
  icon: ReactNode; label: string; sub: string; status: ReactNode; laneT: number; rate: number; tone: 'run' | 'pass' | 'fail';
}) {
  const color = tone === 'pass' ? 'text-pass' : tone === 'fail' ? 'text-fail' : 'text-fg';
  return (
    <div className="mb-5 flex items-end justify-between px-1">
      <div className="flex items-center gap-4">
        <div className="grid size-12 place-items-center rounded-full border border-line-strong bg-raised text-fg">{icon}</div>
        <div>
          <h2 className="text-[15px] font-semibold uppercase tracking-[0.22em] text-fg">{label}</h2>
          <p className="mt-1 text-[17px] text-dim">{sub}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {status}
        <div className={`relative text-[46px] font-medium leading-none tracking-[-0.02em] tabular ${color}`} aria-hidden="true">
          {fmtClock(laneT)}
          {rate > 1 && (
            <span className="absolute -top-6 right-0 flex items-center gap-1 text-[13px] font-semibold tracking-wider text-faint">
              <FastForward size={13} /> {rate}× idle skipped
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ tone, children }: { tone: 'run' | 'pass' | 'fail' | 'wait'; children: ReactNode }) {
  const cls = {
    run: 'border-line-strong text-fg',
    wait: 'border-line text-faint',
    pass: 'border-pass/40 bg-pass-soft text-pass',
    fail: 'border-fail/40 bg-fail-soft text-fail',
  }[tone];
  return (
    <span className={`flex h-9 items-center gap-2 rounded-full border px-4 text-[15px] font-semibold ${cls}`}>
      {tone === 'run' && <span className="size-2 animate-pulse rounded-full bg-fg" />}
      {children}
    </span>
  );
}

function laneStatus(lane: Lane, laneT: number, ended: boolean) {
  if (!ended) return laneT < (lane.steps[0]?.tStart ?? lane.frames[0]?.t ?? 0) ? { tone: 'wait' as const, text: 'Starting' } : { tone: 'run' as const, text: 'Running' };
  if (lane.status === 'passed') return { tone: 'pass' as const, text: 'Passed' };
  if (lane.status === 'failed') return { tone: 'fail' as const, text: lane.runEnd?.result_code ? `Failed · ${lane.runEnd.result_code}` : 'Failed' };
  return { tone: 'wait' as const, text: 'Ended' };
}

const ACTION_LABEL: Record<string, string> = {
  navigate: 'Open page', click: 'Click', press_key: 'Key', type: 'Type', fill: 'Type', scroll: 'Scroll',
  wait: 'Wait', analyze: 'Check', assert: 'Assert', hover: 'Hover', select: 'Select',
};
const KEY_GLYPH: Record<string, string> = { tab: '⇥', enter: '⏎', return: '⏎', space: '␣', escape: 'esc', 'shift+tab': '⇤', arrowdown: '↓', arrowup: '↑', arrowleft: '←', arrowright: '→', 'arrow down': '↓', 'arrow up': '↑' };

function stepLabel(s: KaneStep) {
  if (s.key) return { glyph: KEY_GLYPH[s.key.toLowerCase()] ?? '⌨', label: s.key, detail: '' };
  if (s.action === 'press_key') return { glyph: '⌨', label: 'Key', detail: s.text };
  return { glyph: '', label: ACTION_LABEL[s.action] ?? s.action, detail: s.action === 'navigate' ? '' : s.text };
}

/** Which Kane step is on screen: the one in flight, else the last finished. */
function currentStep(lane: Lane, laneT: number) {
  const done = lane.steps.filter((s) => s.t <= laneT);
  const running = lane.steps.find((s) => s.tStart != null && s.tStart <= laneT && s.t > laneT) ?? null;
  return { done, running, last: done.at(-1) ?? null };
}

function Screen({ lane, children, className = '', style }: { lane: Lane; children: ReactNode; className?: string; style?: React.CSSProperties }) {
  const ratio = lane.viewport ? lane.viewport.width / lane.viewport.height : 16 / 10;
  return (
    <div className={`relative overflow-hidden rounded-[22px] ${className}`} style={{ width: PANEL_W, height: SCREEN_H, ...style }}>
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative" style={{ width: Math.min(PANEL_W, SCREEN_H * ratio), height: Math.min(SCREEN_H, PANEL_W / ratio) }}>{children}</div>
      </div>
    </div>
  );
}

/** Two stacked images cross-fading between consecutive frames. */
function Frames({ lane, laneT, style }: { lane: Lane; laneT: number; style?: React.CSSProperties }) {
  const i = lastAt(lane.frames, laneT);
  if (i < 0) return null;
  const cur = lane.frames[i];
  const prev = i > 0 ? lane.frames[i - 1] : null;
  const p = clamp((laneT - cur.t) / 220);
  return (
    <div className="absolute inset-0" style={style}>
      {prev && p < 1 && <img src={prev.url} alt="" className="absolute inset-0 size-full object-cover" />}
      <img src={cur.url} alt="" className="absolute inset-0 size-full object-cover" style={{ opacity: prev ? p : 1 }} />
    </div>
  );
}

function lensStyle(lens: LensId): React.CSSProperties {
  switch (lens) {
    case 'blur': return { filter: 'blur(7px)' };
    case 'lowvision': return { filter: 'blur(3.5px) contrast(0.55) brightness(1.15) saturate(0.5)' };
    case 'tunnel': {
      const mask = 'radial-gradient(ellipse 22% 26% at 62% 44%, #000 55%, transparent 100%)';
      return { WebkitMaskImage: mask, maskImage: mask };
    }
    default: return {};
  }
}

function SightedPanel({ view, local, lens, expect, replay }: { view: LaneView; local: number; lens: LensId; expect?: string; replay: boolean }) {
  const { lane } = view;
  const { laneT, ended, rate, sinceEnd } = laneState(view, local);
  const st = laneStatus(lane, laneT, ended);
  const { running, last } = currentStep(lane, laneT);
  const step = running && (!last || laneT - last.t > 1600) ? null : last;
  const lensName = LENSES.find((l) => l.id === lens)!.label;
  const passed = ended && lane.status === 'passed';
  const pop = easeOutBack((sinceEnd - 150) / 650);

  return (
    <article aria-label="Sighted lane" style={{ width: PANEL_W }}>
      <PanelHeader icon={<Eye size={22} />} label={replay ? 'Sighted · replay' : 'Sighted'} sub="Sees the screen · uses the mouse" laneT={laneT} rate={rate} tone={passed ? 'pass' : ended ? 'fail' : 'run'} status={<StatusPill tone={st.tone}>{st.tone === 'pass' && <Check size={16} />}{st.text}</StatusPill>} />
      <Screen lane={lane} className={`border bg-[#0d0d12] ${passed ? 'border-pass/50' : 'border-line-strong'}`} style={{ boxShadow: passed ? '0 0 0 1px rgb(48 209 88 / .25), 0 30px 80px -20px rgb(48 209 88 / .25)' : '0 30px 80px -30px rgb(0 0 0 / .8)' }}>
        <div className="absolute inset-0 bg-black" style={lens === 'tunnel' ? {} : undefined}>
          <Frames lane={lane} laneT={laneT} style={lensStyle(lens)} />
        </div>
        {lane.frames.length === 0 && <Waiting text="No screen recording in this lane" />}
        {lane.frames.length > 0 && laneT < lane.frames[0].t && <Waiting text="Launching Chrome · Kane is planning" />}
        {lens !== 'none' && (
          <span className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1.5 text-[13px] font-semibold uppercase tracking-wider text-fg backdrop-blur">
            Lens · {lensName} (simulated)
          </span>
        )}
        {passed && (
          <div className="absolute right-5 top-5" style={{ opacity: clamp(pop * 1.5), transform: `scale(${0.85 + 0.15 * pop})`, transformOrigin: 'top right' }}>
            <div className="flex items-center gap-3 rounded-full border border-pass/40 bg-black/85 py-2 pl-2 pr-5 text-[18px] font-semibold text-fg shadow-[0_10px_40px_-8px_rgb(0_0_0_/_.8)] backdrop-blur-xl">
              <span className="grid size-8 place-items-center rounded-full bg-pass text-black"><Check size={18} /></span>
              {expect ? <>Verified “{expect}”</> : 'Task complete'}
            </div>
          </div>
        )}
      </Screen>
      <div className="mt-5 flex h-[74px] items-center gap-4 rounded-[18px] border border-line bg-panel px-5">
        <StepCaption step={step} running={running} laneT={laneT} />
      </div>
    </article>
  );
}

function Waiting({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="flex items-center gap-3 text-[17px] text-faint">
        <span className="size-2 animate-pulse rounded-full bg-faint" />
        {text}
      </div>
    </div>
  );
}

function StepCaption({ step, running, laneT }: { step: KaneStep | null; running: KaneStep | null; laneT: number }) {
  if (!step && !running) return <span className="text-[18px] text-faint">Waiting for Kane’s first step…</span>;
  if (!step && running) {
    return (
      <span className="flex items-center gap-3 text-[18px] text-dim">
        <Dots /> Kane is deciding step {running.n - 1}…
      </span>
    );
  }
  const s = step!;
  const { glyph, label, detail } = stepLabel(s);
  const style = rise(laneT, s.t, 450, 10);
  return (
    <div className="flex min-w-0 items-center gap-4" style={style}>
      <span className="shrink-0 font-mono text-[14px] uppercase tracking-wider text-faint">Step {s.n - 1}</span>
      <span className={`flex h-9 shrink-0 items-center gap-2 rounded-[10px] border px-3 font-mono text-[16px] font-medium ${s.status === 'failed' ? 'border-fail/50 text-fail' : 'border-line-strong text-fg'}`}>
        {glyph && <span className="text-dim">{glyph}</span>}
        {label}
      </span>
      <span className="truncate text-[19px] text-fg">{detail || s.text}</span>
      {running && <span className="ml-auto shrink-0"><Dots /></span>}
    </div>
  );
}

function Dots() {
  return (
    <span className="inline-flex gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-pulse rounded-full bg-dim" style={{ animationDelay: `${i * 160}ms` }} />)}
    </span>
  );
}

const WORD_MS = 150;

function BlindPanel({ view, local, revealPage, analyser, expect, round, sighted }: { view: LaneView; local: number; revealPage: boolean; analyser: AnalyserNode | null; expect?: string; round: number; sighted: Lane | null }) {
  const { lane } = view;
  const { laneT, ended, rate, sinceEnd } = laneState(view, local);
  const st = laneStatus(lane, laneT, ended);
  const anns = lane.announcements;
  const i = lastAt(anns, laneT);
  const cur = i >= 0 ? anns[i] : null;
  const history = anns.slice(Math.max(0, i - 2), Math.max(0, i)).reverse();
  let repeats = 0;
  for (let k = i; k >= 0 && cur && anns[k].text === cur.text; k--) repeats++;
  const age = cur ? laneT - cur.t : 0;
  const speakingMs = cur ? cur.text.split(/\s+/).length * WORD_MS + 900 : 0;
  const speaking = cur && age < speakingMs ? 1 - age / speakingMs : 0;
  const silence = cur ? age : laneT;
  const passed = ended && lane.status === 'passed';
  const failed = ended && lane.status === 'failed';
  const pop = easeOutBack((sinceEnd - 150) / 650);
  const failGlow = failed ? clamp(sinceEnd / 500) : 0;

  return (
    <article aria-label={round > 1 ? 'Blind lane, rerun after the fix' : 'Blind lane'} style={{ width: PANEL_W }}>
      <PanelHeader
        icon={<EyeOff size={22} />}
        label={round > 1 ? 'Blind · after fix' : 'Blind'}
        sub="Screen is black · keyboard only · screen reader"
        laneT={laneT}
        rate={rate}
        tone={passed ? 'pass' : failed ? 'fail' : 'run'}
        status={<StatusPill tone={st.tone}>{st.tone === 'pass' && <Check size={16} />}{st.tone === 'fail' && <Cross size={15} />}{st.text}</StatusPill>}
      />
      <Screen
        lane={lane}
        className="border bg-black"
        style={{
          borderColor: passed ? 'rgb(48 209 88 / .5)' : failed ? `rgb(255 69 58 / ${0.2 + failGlow * 0.4})` : 'rgb(255 255 255 / .16)',
          boxShadow: passed ? '0 0 0 1px rgb(48 209 88 / .25), 0 30px 80px -20px rgb(48 209 88 / .25)' : failed ? `0 0 0 1px rgb(255 69 58 / ${failGlow * 0.3}), 0 30px 90px -20px rgb(255 69 58 / ${failGlow * 0.35})` : '0 30px 80px -30px rgb(0 0 0 / .8)',
        }}
      >
        {revealPage && <RevealLayer lane={lane} laneT={laneT} sighted={sighted} />}
      </Screen>
      {revealPage && <div className="pointer-events-none relative rounded-b-[22px] bg-gradient-to-t from-black via-black/85 to-transparent" style={{ width: PANEL_W, height: 330, marginTop: -330 }} />}
      {/* Captions and waveform sit over the whole black screen, not just the page box. */}
      <div className="pointer-events-none relative" style={{ width: PANEL_W, height: SCREEN_H, marginTop: -SCREEN_H }}>
        <div className="absolute left-7 top-6 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.2em] text-faint">
          <Speaker size={16} /> Screen reader
        </div>
        <KeyFlash lane={lane} laneT={laneT} />
        <div className="absolute inset-x-10 bottom-[118px]" style={{ opacity: failed ? 1 - 0.45 * clamp(sinceEnd / 600) : 1 }}>
          {history.map((a, k) => (
            <p key={`${a.t}-${k}`} className="mb-3 line-clamp-1 text-[26px] font-medium leading-tight text-white" style={{ opacity: k === 0 ? 0.32 : 0.14 }}>
              {a.text}
            </p>
          ))}
          {cur ? <Caption a={cur} age={age} repeats={repeats} /> : <p className="text-[26px] text-faint">{laneT < (lane.steps[0]?.t ?? 0) ? 'Waiting for the page…' : 'Silence.'}</p>}
          <div className="mt-3 h-6 text-[16px] font-medium text-faint tabular">
            {!ended && cur && silence > 4500 && <span>Silence · {(silence / 1000).toFixed(0)} s</span>}
          </div>
        </div>
        <div className="absolute inset-x-8 bottom-6 flex items-center gap-4">
          <Waveform analyser={analyser} fallback={speaking * 0.9} width={PANEL_W - 64} height={64} />
        </div>
        {failed && (
          <div className="absolute inset-x-0 top-5 flex justify-center" style={{ opacity: clamp(pop * 1.5), transform: `scale(${0.9 + 0.1 * pop})` }}>
            <div className="flex items-center gap-4 rounded-full border border-fail/50 bg-[#1a0606]/90 py-3 pl-3 pr-7 text-[24px] font-semibold text-white shadow-[0_20px_60px_-10px_rgb(255_69_58_/_.5)] backdrop-blur-xl">
              <span className="grid size-11 place-items-center rounded-full bg-fail text-black"><Cross size={22} /></span>
              Blocked · Kane stopped after {(lane.durationMs / 1000).toFixed(1)} s
            </div>
          </div>
        )}
        {passed && (
          <div className="absolute right-6 top-5" style={{ opacity: clamp(pop * 1.5), transform: `scale(${0.85 + 0.15 * pop})` }}>
            <div className="flex items-center gap-3 rounded-full border border-pass/40 bg-black/80 py-2 pl-2 pr-5 text-[18px] font-semibold backdrop-blur-xl">
              <span className="grid size-8 place-items-center rounded-full bg-pass text-black"><Check size={18} /></span>
              {expect ? <>Verified “{expect}”</> : 'Task complete'}
            </div>
          </div>
        )}
      </div>
      <StepChips lane={lane} laneT={laneT} />
    </article>
  );
}

function Caption({ a, age, repeats }: { a: Announcement; age: number; repeats: number }) {
  const words = a.text.split(/\s+/);
  const live = a.source === 'live';
  const enter = reveal(age, 0, 260);
  return (
    <div style={{ opacity: enter }}>
      <div className="mb-3 flex items-center gap-3 font-mono text-[14px] font-medium uppercase tracking-[0.16em]">
        <span className={live ? 'text-info' : 'text-focus'}>{live ? 'Live region' : 'Focus'}</span>
        {a.role && <span className="text-faint">· {a.role}</span>}
        {repeats > 1 && <span className="rounded-full bg-focus/15 px-2.5 py-0.5 text-focus">heard {repeats}×</span>}
      </div>
      <p className="text-[60px] font-semibold leading-[1.04] tracking-[-0.02em] text-white" style={{ textWrap: 'balance' }}>
        {words.map((w, k) => {
          const p = clamp((age - k * WORD_MS) / 160);
          return (
            <span key={k} style={{ opacity: 0.15 + 0.85 * p }}>
              {w}{k < words.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </p>
    </div>
  );
}

function KeyFlash({ lane, laneT }: { lane: Lane; laneT: number }) {
  const keys = lane.steps.filter((s) => s.action === 'press_key' && s.t <= laneT);
  const last = keys.at(-1);
  if (!last) return null;
  const age = laneT - last.t;
  if (age > 1500) return null;
  const { glyph, label, detail } = stepLabel(last);
  const p = easeOutBack(age / 380);
  const out = clamp((age - 1000) / 500);
  return (
    <div className="absolute right-7 top-5 flex items-center gap-3" style={{ opacity: (1 - out) * clamp(p), transform: `scale(${0.7 + 0.3 * p})`, transformOrigin: 'top right' }}>
      <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-faint">Kane pressed</span>
      <span className="flex h-12 min-w-12 items-center justify-center gap-2 rounded-[12px] border border-white/25 bg-white/10 px-4 font-mono text-[20px] font-semibold text-white shadow-[inset_0_-3px_0_rgb(255_255_255_/_.12)]">
        <span className="text-dim">{glyph}</span>{label}
        {detail && <span className="max-w-[300px] truncate font-sans text-[17px] font-normal text-dim">{detail}</span>}
      </span>
    </div>
  );
}

const occlusion = new Map<string, Promise<boolean>>();
/** True when a lane's frames are the black blindfold Kane saw (mean luminance near zero). */
function useOccluded(lane: Lane): boolean | null {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => {
    const f = lane.frames[Math.floor(lane.frames.length * 0.6)];
    if (!f) return setV(null);
    let p = occlusion.get(lane.base);
    if (!p) {
      p = new Promise<boolean>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = 32;
          c.height = 20;
          const g = c.getContext('2d')!;
          g.drawImage(img, 0, 0, 32, 20);
          const d = g.getImageData(0, 0, 32, 20).data;
          let sum = 0;
          for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
          resolve(sum / (d.length / 4) / 3 < 6);
        };
        img.onerror = () => resolve(false);
        img.src = f.url;
      });
      occlusion.set(lane.base, p);
    }
    let live = true;
    p.then((x) => live && setV(x));
    return () => {
      live = false;
    };
  }, [lane]);
  return v;
}

function RevealLayer({ lane, laneT, sighted }: { lane: Lane; laneT: number; sighted: Lane | null }) {
  const occluded = useOccluded(lane);
  const vp = lane.viewport ?? sighted?.viewport ?? { width: 1280, height: 800 };
  const pts = lane.announcements.filter((a) => a.rect && a.t <= laneT).map((a) => ({ ...a.rect!, t: a.t }));
  const cur = pts.at(-1);
  // Kane's own blind frames are black. Then the page layout comes from the sighted run, and says so.
  const useSighted = occluded && sighted && sighted.frames.length > 0;
  const layout = useSighted ? sighted.frames[Math.min(sighted.frames.length - 1, 1)] : null;
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {layout ? (
        <img src={layout.url} alt="" className="absolute inset-0 size-full object-cover" style={{ opacity: 0.3, filter: 'grayscale(1) brightness(1.1)' }} />
      ) : (
        !occluded && <Frames lane={lane} laneT={laneT} style={{ opacity: 0.3, filter: 'grayscale(1) brightness(1.1)' }} />
      )}
      {layout && <span className="absolute bottom-3 right-4 text-[12px] font-medium uppercase tracking-[0.14em] text-white/50">Layout from the sighted run · Kane saw black</span>}
      <svg viewBox={`0 0 ${vp.width} ${vp.height}`} className="absolute inset-0 size-full">
        {pts.length > 1 && (
          <polyline points={pts.map((p) => `${p.x + p.w / 2},${p.y + p.h / 2}`).join(' ')} fill="none" stroke="#ffd60a" strokeOpacity="0.55" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />
        )}
        {pts.map((p, k) => <circle key={k} cx={p.x + p.w / 2} cy={p.y + p.h / 2} r={7} fill="#ffd60a" fillOpacity={k === pts.length - 1 ? 1 : 0.45} />)}
        {cur && <rect x={cur.x - 6} y={cur.y - 6} width={cur.w + 12} height={cur.h + 12} rx={14} fill="none" stroke="#ffd60a" strokeWidth={4} style={{ filter: 'drop-shadow(0 0 12px rgb(255 214 10 / .6))' }} />}
      </svg>
      {!lane.frames.length && !layout && <Waiting text="No page capture for this lane" />}
      {!pts.length && <span className="absolute left-1/2 top-4 -translate-x-1/2 text-[13px] text-white/45">No focus positions recorded</span>}
    </div>
  );
}

function StepChips({ lane, laneT }: { lane: Lane; laneT: number }) {
  const { done, running } = currentStep(lane, laneT);
  const shown = done.slice(-5);
  return (
    <div className="mt-5 flex h-[74px] items-center gap-2.5 overflow-hidden rounded-[18px] border border-line bg-panel px-4" aria-hidden="true">
      <span className="mr-1 shrink-0 font-mono text-[13px] uppercase tracking-wider text-faint">Kane</span>
      {shown.length === 0 && !running && <span className="text-[17px] text-faint">No steps yet</span>}
      {shown.map((s) => {
        const { glyph, label, detail } = stepLabel(s);
        const p = easeOutBack((laneT - s.t) / 420);
        const failed = s.status === 'failed';
        return (
          <span
            key={s.n}
            className={`flex h-10 max-w-[230px] shrink-0 items-center gap-2 rounded-[11px] border px-3 font-mono text-[15px] font-medium ${failed ? 'border-fail/60 bg-fail-soft text-fail' : 'border-white/15 bg-white/[0.06] text-fg'}`}
            style={{ opacity: clamp(p * 1.4), transform: `scale(${0.8 + 0.2 * p})` }}
          >
            {failed ? <Cross size={14} /> : glyph && <span className="text-dim">{glyph}</span>}
            {label}
            {detail && <span className="truncate font-sans text-[14px] font-normal text-dim">{detail}</span>}
          </span>
        );
      })}
      {running && (
        <span className="flex h-10 shrink-0 items-center gap-2 rounded-[11px] border border-dashed border-white/20 px-3 text-[14px] text-dim">
          <Dots />
        </span>
      )}
    </div>
  );
}
