import { EVENT, describeSeats, money, sectionForSeat, type Seat, type ShowDate } from '../lib/event';

export const MAX_TICKETS = 8;

interface StepperProps {
  value: number;
  onChange: (n: number) => void;
}

// PLANTED BARRIER B2: icon-only +/− buttons with no accessible name (a screen reader just says "button").
export function QuantityStepper({ value, onChange }: StepperProps) {
  const btn =
    'grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/[0.04] text-white transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30';
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 p-1" data-testid="qty-stepper">
      <button type="button" className={btn} disabled={value <= 1} onClick={() => onChange(value - 1)} data-testid="qty-minus">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M5 12h14" />
        </svg>
      </button>
      <span className="w-9 text-center font-display text-[19px] font-semibold tabular-nums" data-testid="qty-value">
        {value}
      </span>
      <button type="button" className={btn} disabled={value >= MAX_TICKETS} onClick={() => onChange(value + 1)} data-testid="qty-plus">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}

interface Props {
  date: ShowDate | null;
  qty: number;
  onQty: (n: number) => void;
  seats: Seat[];
  onRemove: (id: string) => void;
  onCheckout: () => void;
}

export function totals(seats: Seat[]) {
  const subtotal = seats.reduce((s, x) => s + x.tier.price, 0);
  const fees = seats.length * EVENT.feePerTicket;
  return { subtotal, fees, total: subtotal + fees };
}

export default function BookingSummary({ date, qty, onQty, seats, onRemove, onCheckout }: Props) {
  const { subtotal, fees, total } = totals(seats);
  const remaining = qty - seats.length;
  const ready = !!date && remaining === 0;
  const hint = !date
    ? 'Choose a night to continue'
    : remaining > 0
      ? `Select ${remaining} more seat${remaining === 1 ? '' : 's'} on the map`
      : 'Seats held for 10 minutes at checkout';

  return (
    <aside className="glass relative overflow-hidden rounded-[28px] p-6" data-testid="booking-summary">
      <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-violet/25 blur-3xl" />
      <p className="eyebrow text-haze">Your booking</p>
      <h3 className="mt-2 font-display text-[22px] font-semibold tracking-tight">
        {EVENT.artist} <span className="font-serif text-[24px] font-normal italic text-[#ffb3d6]">live</span>
      </h3>
      <div className="mt-1.5 text-[14px] text-mist" data-testid="summary-date">
        {date ? `${date.weekdayLong} ${date.day} ${date.month} · ${date.time}` : 'No night selected yet'}
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-white/[0.07] pt-5">
        <div>
          <div className="text-[15px] font-medium">Tickets</div>
          <div className="text-[12.5px] text-haze">Up to {MAX_TICKETS} per order</div>
        </div>
        <QuantityStepper value={qty} onChange={onQty} />
      </div>

      <div className="mt-5 border-t border-white/[0.07] pt-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[15px] font-medium">Seats</span>
          {seats.length > 0 && <span className="text-[12.5px] text-mist">{describeSeats(seats)}</span>}
        </div>
        <div className="flex flex-col gap-2" data-testid="selected-seats">
          {Array.from({ length: qty }, (_, i) => {
            const s = seats[i];
            if (!s)
              return (
                <div key={`empty-${i}`} className="rounded-2xl border border-dashed border-white/12 px-4 py-3 text-[13px] text-haze">
                  Seat {i + 1} · pick on the map
                </div>
              );
            return (
              <div key={s.id} className="fade-in flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5" data-testid={`selected-${s.id}`}>
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl font-mono text-[13px] font-bold text-[#120a1f]"
                  style={{ background: `linear-gradient(160deg, #fff, ${s.tier.color})`, boxShadow: `0 0 18px -2px ${s.tier.color}` }}
                >
                  {s.id}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium">
                    Row {s.row} · Seat {s.number}
                  </div>
                  <div className="text-[12px] text-haze">
                    {s.tier.name} · {sectionForSeat(s.number)}
                  </div>
                </div>
                <span className="text-[14px] font-medium tabular-nums">{money(s.tier.price)}</span>
                <button type="button" className="rounded-full p-1.5 text-haze transition hover:bg-white/10 hover:text-white" onClick={() => onRemove(s.id)} data-testid={`remove-${s.id}`}>
                  <span className="sr-only">Remove seat {s.id}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <dl className="mt-5 space-y-2 border-t border-white/[0.07] pt-5 text-[14px]">
        <div className="flex justify-between text-mist">
          <dt>Tickets</dt>
          <dd className="tabular-nums">{money(subtotal)}</dd>
        </div>
        <div className="flex justify-between text-mist">
          <dt>Service fees</dt>
          <dd className="tabular-nums">{money(fees)}</dd>
        </div>
        <div className="flex items-baseline justify-between pt-2">
          <dt className="text-[15px] font-medium">Total</dt>
          <dd className="font-display text-[26px] font-semibold tabular-nums tracking-tight" data-testid="summary-total">
            {money(total)}
          </dd>
        </div>
      </dl>

      <button type="button" className="btn-glow mt-5 w-full rounded-2xl py-4 text-[16px] font-semibold text-white" disabled={!ready} onClick={onCheckout} data-testid="checkout-button">
        Checkout
      </button>
      <p className="mt-3 text-center text-[12.5px] text-haze" data-testid="summary-hint">
        {hint}
      </p>
    </aside>
  );
}
