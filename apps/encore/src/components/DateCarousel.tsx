import { useEffect, useRef } from 'react';
import { DATES, type ShowDate } from '../lib/event';

const badge: Record<ShowDate['availability'], { label: string; cls: string }> = {
  available: { label: 'Available', cls: 'text-cyan' },
  selling: { label: 'Selling fast', cls: 'text-amber' },
  few: { label: 'Few left', cls: 'text-[#ff8cc4]' },
  soldout: { label: 'Sold out', cls: 'text-haze' },
};

interface Props {
  value: string | null;
  onChange: (id: string) => void;
}

// PLANTED BARRIER B3: a mouse-driven carousel built from <div>s.
// Cards and arrows only respond to pointer clicks and drags; none of them can take keyboard focus.
export default function DateCarousel({ value, onChange }: Props) {
  const strip = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, x: 0, left: 0, moved: false });

  useEffect(() => {
    const el = strip.current;
    const card = el?.querySelector<HTMLElement>(`[data-date="${value}"]`);
    if (!el || !card) return;
    const a = el.getBoundingClientRect();
    const b = card.getBoundingClientRect();
    el.scrollBy({ left: b.left + b.width / 2 - (a.left + a.width / 2), behavior: 'smooth' });
  }, [value]);

  const nudge = (dir: number) => strip.current?.scrollBy({ left: dir * 340, behavior: 'smooth' });

  return (
    <div className="relative" data-testid="date-carousel">
      <div
        className="absolute -left-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-white/10 bg-[#14111f]/90 text-mist shadow-xl backdrop-blur transition hover:border-white/25 hover:text-white md:grid"
        onClick={() => nudge(-1)}
        data-testid="date-prev"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="m15 6-6 6 6 6" />
        </svg>
      </div>
      <div
        className="absolute -right-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-white/10 bg-[#14111f]/90 text-mist shadow-xl backdrop-blur transition hover:border-white/25 hover:text-white md:grid"
        onClick={() => nudge(1)}
        data-testid="date-next"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </div>

      <div
        ref={strip}
        className="date-strip flex cursor-grab gap-3 overflow-x-auto px-4 py-4 md:px-16 active:cursor-grabbing"
        onPointerDown={(e) => {
          if (e.pointerType !== 'mouse') return;
          drag.current = { down: true, x: e.clientX, left: strip.current!.scrollLeft, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d.down) return;
          const dx = e.clientX - d.x;
          if (Math.abs(dx) > 5) d.moved = true;
          strip.current!.scrollLeft = d.left - dx;
        }}
        onPointerUp={() => (drag.current.down = false)}
        onPointerLeave={() => (drag.current.down = false)}
      >
        {DATES.map((d) => {
          const active = d.id === value;
          const soldOut = d.availability === 'soldout';
          return (
            <div
              key={d.id}
              data-testid={`date-${d.id}`}
              data-date={d.id}
              className={`date-card relative flex w-[132px] shrink-0 cursor-pointer flex-col rounded-[20px] border border-white/[0.09] bg-white/[0.025] px-4 pb-4 pt-3.5 sm:w-[148px] ${
                active ? 'is-active' : ''
              } ${soldOut ? 'is-soldout cursor-not-allowed opacity-45' : ''}`}
              onClick={() => {
                if (drag.current.moved || soldOut) return;
                onChange(d.id);
              }}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className={`eyebrow text-[10.5px] ${active ? 'text-white' : 'text-haze'}`}>{d.weekday}</span>
                  {d.note && !soldOut && (
                    <span className="rounded-full bg-gradient-to-r from-violet to-magenta px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider">{d.note}</span>
                  )}
                </span>
                {active && (
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[#1b0f2e]">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className={`font-display text-[38px] font-bold leading-none tracking-tight ${soldOut ? 'line-through decoration-1' : ''}`}>{d.day}</span>
                <span className="text-[14px] text-mist">{d.month}</span>
              </div>
              <div className="mt-3 text-[12.5px] text-mist">{d.time}</div>
              <div className={`mt-0.5 text-[12px] font-medium ${badge[d.availability].cls}`}>{badge[d.availability].label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
