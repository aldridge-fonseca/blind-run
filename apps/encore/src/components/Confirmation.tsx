import PosterArt from './PosterArt';
import { totals } from './BookingSummary';
import type { Buyer } from './CheckoutModal';
import { EVENT, describeSeats, money, type Seat, type ShowDate } from '../lib/event';

interface Props {
  date: ShowDate;
  seats: Seat[];
  buyer: Buyer;
  onDone: () => void;
}

const SPARKS = Array.from({ length: 18 }, (_, i) => ({
  left: `${8 + ((i * 37) % 84)}%`,
  top: `${20 + ((i * 53) % 50)}%`,
  dx: `${((i * 29) % 80) - 40}px`,
  dy: `${-60 - ((i * 17) % 80)}px`,
  delay: `${(i * 0.23) % 2.6}s`,
  color: ['#3ee6d6', '#a78bfa', '#ff4fa3', '#ffb547'][i % 4],
}));

// Deterministic barcode bars derived from the order number.
const BARS = Array.from({ length: 46 }, (_, i) => 1 + ((i * 7 + EVENT.orderNumber.charCodeAt(i % 8)) % 4));

export default function Confirmation({ date, seats, buyer, onDone }: Props) {
  const { total } = totals(seats);
  const seatLine = describeSeats(seats);

  return (
    <main className="relative mx-auto max-w-[1100px] px-4 pb-24 pt-8 sm:px-8 sm:pt-14" data-testid="confirmation">
      <div className="pointer-events-none absolute inset-0">
        {SPARKS.map((s, i) => (
          <span key={i} className="spark" style={{ left: s.left, top: s.top, background: s.color, boxShadow: `0 0 12px ${s.color}`, animationDelay: s.delay, ['--dx' as string]: s.dx, ['--dy' as string]: s.dy }} />
        ))}
      </div>

      <div className="rise relative text-center">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-cyan via-violet to-magenta p-[2px] shadow-[0_0_60px_-5px_rgba(167,139,250,0.9)]">
          <div className="grid h-full w-full place-items-center rounded-full bg-[#100d1a]">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </div>
        </div>
        <h1 className="font-display text-[clamp(40px,7vw,84px)] font-extrabold leading-[0.95] tracking-[-0.04em]" data-testid="confirmation-title">
          You're going!
        </h1>
        <p className="mt-5 font-mono text-[clamp(14px,1.6vw,18px)] tracking-wide text-white/90" data-testid="order-line">
          Order #{EVENT.orderNumber} · {seatLine}
        </p>
        <p className="mt-3 text-[15px] text-mist">
          Tickets are on their way to <span className="text-white">{buyer.email}</span>
        </p>
      </div>

      {/* ticket */}
      <div className="rise relative mx-auto mt-12 max-w-[860px]" style={{ animationDelay: '150ms' }}>
        <div className="absolute -inset-8 rounded-[48px] bg-[radial-gradient(closest-side,rgba(139,92,246,0.35),transparent)] blur-2xl" />
        <div className="relative grid overflow-hidden rounded-[30px] border border-white/10 bg-[#120f1d] shadow-[0_50px_140px_-40px_rgba(255,79,163,0.5)] md:grid-cols-[260px_1fr_150px]">
          <div className="relative h-48 md:h-auto">
            <PosterArt className="absolute inset-0 h-full w-full" showText={false} />
          </div>
          <div className="p-7">
            <p className="eyebrow text-cyan/90">Admit {seats.length}</p>
            <h2 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-tight">
              Aurora Vale <span className="font-serif text-[30px] font-normal italic text-[#ffb3d6]">{EVENT.tour}</span>
            </h2>
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-[14px] sm:grid-cols-3">
              {[
                ['Date', `${date.weekday} ${date.day} ${date.month}`],
                ['Doors', EVENT.doors],
                ['Venue', EVENT.venue],
                ['Section', `${seats[0]?.tier.name}`],
                ['Seats', seats.map((s) => s.id).join(' · ')],
                ['Paid', money(total)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="eyebrow text-[10px] text-haze">{k}</dt>
                  <dd className="mt-1 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-[13px] text-haze">Booked for {buyer.name}</p>
          </div>
          <div className="relative flex flex-col items-center justify-center gap-4 border-t border-dashed border-white/15 p-6 md:border-l md:border-t-0">
            <span className="absolute -left-3 -top-3 hidden h-6 w-6 rounded-full bg-ink md:block" />
            <span className="absolute -bottom-3 -left-3 hidden h-6 w-6 rounded-full bg-ink md:block" />
            <div className="flex h-24 items-stretch gap-[2px] md:h-28">
              {BARS.slice(0, 30).map((w, i) => (
                <span key={i} className="bg-white/90" style={{ width: w }} />
              ))}
            </div>
            <span className="font-mono text-[12px] tracking-widest text-white/70">#{EVENT.orderNumber}</span>
          </div>
        </div>
      </div>

      <div className="rise mt-10 flex flex-wrap justify-center gap-3" style={{ animationDelay: '250ms' }}>
        <button type="button" className="btn-glow rounded-full px-6 py-3 text-[14px] font-semibold text-white">
          Add to Wallet
        </button>
        <button type="button" className="rounded-full border border-white/15 bg-white/[0.04] px-6 py-3 text-[14px] font-medium transition hover:border-white/30" onClick={onDone} data-testid="back-to-event">
          Back to event
        </button>
      </div>
    </main>
  );
}
