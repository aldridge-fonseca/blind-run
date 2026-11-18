import { useMemo, useState, type CSSProperties } from 'react';
import { AISLES_AFTER, ROWS, SEATS_PER_ROW, TIERS, money, sectionForSeat, type Seat } from '../lib/event';

// Layout in abstract "seat units"; everything is positioned in percentages so the map scales fluidly.
const AISLE = 1.15;
const LABEL = 2.2;
const STAGE_H = 4.6;
const ROW_PITCH = 1.42;
const SEAT_SIZE = 0.8;
const CURVE = 1.25;

const colX = (n: number) => n - 1 + AISLES_AFTER.filter((a) => n > a).length * AISLE;
const SPAN = colX(SEATS_PER_ROW);
const W = SPAN + 1 + LABEL * 2;
const H = STAGE_H + ROWS.length * ROW_PITCH + 0.6;
const CX = LABEL + 0.5 + SPAN / 2;

function place(rowIndex: number, n: number) {
  const fan = 1 + rowIndex * 0.012;
  const u = (colX(n) - SPAN / 2) / (SPAN / 2);
  const x = CX + u * (SPAN / 2) * fan;
  const y = STAGE_H + rowIndex * ROW_PITCH + 0.5 + CURVE * (1 - u * u);
  const rot = Math.atan((2 * CURVE * u) / ((SPAN / 2) * fan)) * (180 / Math.PI);
  return { x, y, rot: -rot };
}

const pctX = (v: number) => `${(v / W) * 100}%`;
const pctY = (v: number) => `${(v / H) * 100}%`;

interface Props {
  seats: Seat[];
  selected: string[];
  locked: boolean;
  onToggle: (seat: Seat) => void;
}

export default function SeatMap({ seats, selected, locked, onToggle }: Props) {
  const [hover, setHover] = useState<Seat | null>(null);
  const laid = useMemo(
    () => seats.map((s) => ({ seat: s, ...place(ROWS.indexOf(s.row), s.number) })),
    [seats],
  );
  const hoverPos = hover ? place(ROWS.indexOf(hover.row), hover.number) : null;

  return (
    <div className="relative">
      <div
        className={`seat-map relative w-full select-none ${locked ? 'is-locked' : ''}`}
        style={{ aspectRatio: `${W} / ${H}` }}
        data-testid="seat-map"
        onMouseLeave={() => setHover(null)}
      >
        {/* stage */}
        <div className="stage-beam" />
        <svg className="absolute inset-x-0 top-0 w-full" viewBox={`0 0 ${W} ${STAGE_H}`} preserveAspectRatio="none" style={{ height: pctY(STAGE_H) }}>
          <defs>
            <linearGradient id="stage-fill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#3ee6d6" stopOpacity="0.15" />
              <stop offset="0.5" stopColor="#a78bfa" stopOpacity="0.5" />
              <stop offset="1" stopColor="#ff4fa3" stopOpacity="0.15" />
            </linearGradient>
            <linearGradient id="stage-edge" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#3ee6d6" />
              <stop offset="0.5" stopColor="#ffffff" />
              <stop offset="1" stopColor="#ff4fa3" />
            </linearGradient>
          </defs>
          <path d={`M ${W * 0.22} 0.3 L ${W * 0.78} 0.3 Q ${W * 0.78} 2.4 ${W * 0.5} 2.7 Q ${W * 0.22} 2.4 ${W * 0.22} 0.3 Z`} fill="url(#stage-fill)" />
          <path d={`M ${W * 0.22} 0.3 Q ${W * 0.22} 2.4 ${W * 0.5} 2.7 Q ${W * 0.78} 2.4 ${W * 0.78} 0.3`} fill="none" stroke="url(#stage-edge)" strokeWidth="0.06" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 2 }} />
        </svg>
        <div className="absolute left-1/2 -translate-x-1/2 text-center" style={{ top: pctY(0.85) }}>
          <div className="eyebrow text-[clamp(8px,1cqw,12px)] font-semibold tracking-[0.5em] text-white/85">Stage</div>
        </div>

        {/* tier zones */}
        {TIERS.map((t) => {
          const first = place(ROWS.indexOf(t.rows[0]), 1).y;
          const last = place(ROWS.indexOf(t.rows[t.rows.length - 1]), 1).y;
          return (
            <div
              key={t.id}
              className="pointer-events-none absolute"
              style={{
                left: pctX(LABEL - 0.6),
                right: pctX(LABEL - 0.6),
                top: pctY(first - 0.75),
                height: pctY(last - first + 1.5 + CURVE),
                background: `radial-gradient(ellipse 60% 70% at 50% 45%, ${t.color}17, ${t.color}06 70%, transparent)`,
              }}
            />
          );
        })}

        {/* row labels */}
        {ROWS.map((r, i) => {
          const left = place(i, 1);
          const right = place(i, SEATS_PER_ROW);
          const style = (x: number): CSSProperties => ({ left: pctX(x), top: pctY(left.y) });
          return (
            <div key={r}>
              <span className="absolute -translate-x-1/2 -translate-y-1/2 font-mono text-[clamp(7px,1.1cqw,13px)] font-semibold text-white/40" style={style(left.x - 1.5)}>
                {r}
              </span>
              <span className="absolute -translate-x-1/2 -translate-y-1/2 font-mono text-[clamp(7px,1.1cqw,13px)] font-semibold text-white/40" style={style(right.x + 1.5)}>
                {r}
              </span>
            </div>
          );
        })}

        {/* PLANTED BARRIER B1: seats are plain <div>s with a click handler only (no role, no tabIndex, no key handling). */}
        {laid.map(({ seat, x, y, rot }) => {
          const isSel = selected.includes(seat.id);
          const cls = seat.sold ? 'is-sold' : isSel ? 'is-selected' : 'is-open';
          return (
            <div
              key={seat.id}
              data-testid={`seat-${seat.id}`}
              data-seat={seat.id}
              className={`seat ${cls}`}
              style={{ left: pctX(x), top: pctY(y), width: pctX(SEAT_SIZE), ['--tier' as string]: seat.tier.color, ['--rot' as string]: `${rot}deg` }}
              onClick={() => !seat.sold && !locked && onToggle(seat)}
              onMouseEnter={() => setHover(seat)}
            >
              {seat.number}
            </div>
          );
        })}

        {/* hover tooltip */}
        {hover && hoverPos && !locked && (
          <div
            className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full pb-[1.6cqw]"
            style={{ left: pctX(hoverPos.x), top: pctY(hoverPos.y - SEAT_SIZE / 2) }}
          >
            <div className="fade-in whitespace-nowrap rounded-xl border border-white/12 bg-[#151221]/95 px-3 py-2 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-2 text-[13px] font-semibold">
                <span className="h-2 w-2 rounded-full" style={{ background: hover.tier.color, boxShadow: `0 0 10px ${hover.tier.color}` }} />
                Row {hover.row} · Seat {hover.number}
              </div>
              <div className="mt-0.5 text-[11.5px] text-mist">
                {hover.sold ? 'Unavailable' : `${hover.tier.name} · ${sectionForSeat(hover.number)} · ${money(hover.tier.price)}`}
              </div>
            </div>
          </div>
        )}

        {locked && (
          <div className="absolute inset-0 z-20 grid place-items-center" data-testid="seat-map-locked">
            <div className="glass fade-in flex items-center gap-3 rounded-2xl px-5 py-3.5 text-[14px]">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3.5" y="5" width="17" height="15" rx="3" />
                  <path d="M3.5 10h17M8 3v4M16 3v4" />
                </svg>
              </span>
              Choose a night above to see available seats
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SeatLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-3" data-testid="seat-legend">
      {TIERS.map((t) => (
        <div key={t.id} className="flex items-center gap-2.5">
          <span className="h-3.5 w-3.5 rounded-[5px]" style={{ background: `${t.color}33`, boxShadow: `inset 0 0 0 1.5px ${t.color}` }} />
          <span className="text-[13px] font-medium text-white/90">{t.name}</span>
          {/* PLANTED BARRIER B6: tier prices are low-contrast text (about 2.3:1 on the panel background). */}
          <span className="text-[13px] text-[#4f4b63]" data-testid={`tier-price-${t.id}`}>
            {money(t.price)}
          </span>
        </div>
      ))}
      <div className="flex items-center gap-2.5">
        <span className="h-3.5 w-3.5 rounded-[5px] bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
        <span className="text-[13px] text-white/90">Selected</span>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="h-3.5 w-3.5 rounded-[5px] bg-white/[0.06]" />
        <span className="text-[13px] text-white/90">Sold</span>
      </div>
    </div>
  );
}
