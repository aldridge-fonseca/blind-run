import { useState, type FormEvent } from 'react';
import PosterArt from './PosterArt';
import { totals } from './BookingSummary';
import { EVENT, describeSeats, money, type Seat, type ShowDate } from '../lib/event';

export interface Buyer {
  name: string;
  email: string;
}

interface Props {
  date: ShowDate;
  seats: Seat[];
  onClose: () => void;
  onPaid: (buyer: Buyer) => void;
}

const digits = (v: string) => v.replace(/\D/g, '');
const formatCard = (v: string) => digits(v).slice(0, 16).replace(/(.{4})(?=.)/g, '$1 ');
const formatExpiry = (v: string) => {
  const d = digits(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d;
};

function validate(f: Record<string, string>) {
  const e: Record<string, string> = {};
  if (!f.name.trim()) e.name = 'Enter the name for the tickets';
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email address';
  if (digits(f.card).length !== 16) e.card = 'Card number should be 16 digits';
  const [mm, yy] = [digits(f.expiry).slice(0, 2), digits(f.expiry).slice(2, 4)];
  if (!(Number(mm) >= 1 && Number(mm) <= 12 && yy.length === 2 && Number(yy) >= 26)) e.expiry = 'Use a future date, MM / YY';
  if (!/^\d{3,4}$/.test(digits(f.cvc))) e.cvc = 'CVC is 3 or 4 digits';
  return e;
}

// PLANTED BARRIER B4: the modal is a plain overlay. It never moves focus inside, does not trap focus,
// has no dialog role, and its close button is an unlabeled icon.
export default function CheckoutModal({ date, seats, onClose, onPaid }: Props) {
  const [form, setForm] = useState({ name: '', email: '', card: '', expiry: '', cvc: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paying, setPaying] = useState(false);
  const { subtotal, fees, total } = totals(seats);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setPaying(true);
    setTimeout(() => onPaid({ name: form.name.trim(), email: form.email.trim() }), 1100);
  };

  const err = (k: string) =>
    errors[k] ? (
      <p className="mt-1.5 text-[12.5px] text-[#ff8fa3]" data-testid={`error-${k}`}>
        {errors[k]}
      </p>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" data-testid="checkout-modal">
      <div className="fade-in absolute inset-0 bg-[#05040a]/75 backdrop-blur-md" onClick={onClose} />
      <div className="modal-in relative grid max-h-[100dvh] w-full max-w-[920px] overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#100d1a] shadow-[0_60px_160px_-40px_rgba(139,92,246,0.55)] sm:max-h-[92vh] sm:rounded-[28px] md:grid-cols-[340px_1fr]">
        {/* order recap */}
        <div className="relative hidden overflow-hidden md:block">
          <PosterArt className="absolute inset-0 h-full w-full" showText={false} />
          <div className="absolute inset-0 bg-gradient-to-b from-[#100d1a]/10 via-[#100d1a]/55 to-[#100d1a]" />
          <div className="relative flex h-full flex-col justify-end p-7">
            <p className="eyebrow text-[#ffd1e8]">{EVENT.tour}</p>
            <h3 className="mt-2 font-display text-[30px] font-extrabold leading-[0.95] tracking-tight">AURORA VALE</h3>
            <p className="mt-3 text-[14px] text-white/80">
              {date.weekdayLong} {date.day} {date.month} · Doors {EVENT.doors}
              <br />
              {EVENT.venue}, {EVENT.city}
            </p>
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur">
              <div className="text-[14px] font-medium">{describeSeats(seats)}</div>
              <div className="text-[12.5px] text-white/60">
                {seats.length} × {seats[0]?.tier.name} · {money(seats[0]?.tier.price ?? 0)}
              </div>
              <dl className="mt-3 space-y-1 border-t border-white/10 pt-3 text-[13px] text-white/70">
                <div className="flex justify-between">
                  <dt>Tickets</dt>
                  <dd>{money(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Service fees</dt>
                  <dd>{money(fees)}</dd>
                </div>
                <div className="flex justify-between pt-1 text-[15px] font-semibold text-white">
                  <dt>Total</dt>
                  <dd>{money(total)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* form */}
        <form className="relative p-6 sm:p-8" onSubmit={submit} noValidate data-testid="checkout-form">
          <button
            type="button"
            className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-mist transition hover:border-white/25 hover:text-white"
            onClick={onClose}
            data-testid="checkout-close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>

          <p className="eyebrow text-haze">Secure checkout</p>
          <h2 className="mt-2 font-display text-[26px] font-semibold tracking-tight">Almost there</h2>
          <p className="mt-1 text-[14px] text-mist md:hidden">
            {describeSeats(seats)} · {money(total)}
          </p>

          <div className="mt-7 space-y-4">
            <div>
              <label htmlFor="buyer-name" className="mb-1.5 block text-[13px] font-medium text-white/80">
                Full name
              </label>
              <input id="buyer-name" className={`field ${errors.name ? 'has-error' : ''}`} autoComplete="name" value={form.name} onChange={(e) => set('name')(e.target.value)} data-testid="input-name" />
              {err('name')}
            </div>
            <div>
              <label htmlFor="buyer-email" className="mb-1.5 block text-[13px] font-medium text-white/80">
                Email for your tickets
              </label>
              <input id="buyer-email" type="email" className={`field ${errors.email ? 'has-error' : ''}`} autoComplete="email" value={form.email} onChange={(e) => set('email')(e.target.value)} data-testid="input-email" />
              {err('email')}
            </div>
          </div>

          <div className="mt-7 flex items-center justify-between">
            <span className="text-[13px] font-medium text-white/80">Payment</span>
            <span className="flex items-center gap-1.5 rounded-full border border-amber/25 bg-amber/10 px-2.5 py-1 font-mono text-[10.5px] text-amber">
              TEST MODE · 4242 4242 4242 4242
            </span>
          </div>

          {/* PLANTED BARRIER B5: card fields rely on placeholder text only; there is no <label> or accessible name. */}
          <div className="mt-2.5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="relative">
              <input
                className="field rounded-none border-0 border-b border-white/10 bg-transparent pr-16 font-mono tracking-wider focus:shadow-none"
                placeholder="Card number"
                inputMode="numeric"
                autoComplete="cc-number"
                value={form.card}
                onChange={(e) => set('card')(formatCard(e.target.value))}
                data-testid="input-card"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 flex -translate-y-1/2 items-center">
                <span className="h-5 w-5 rounded-full bg-[#ff4fa3]/85" />
                <span className="-ml-2 h-5 w-5 rounded-full bg-[#ffb547]/85 mix-blend-screen" />
              </span>
            </div>
            <div className="grid grid-cols-2">
              <input
                className="field rounded-none border-0 border-r border-white/10 bg-transparent font-mono focus:shadow-none"
                placeholder="MM / YY"
                inputMode="numeric"
                autoComplete="cc-exp"
                value={form.expiry}
                onChange={(e) => set('expiry')(formatExpiry(e.target.value))}
                data-testid="input-expiry"
              />
              <input
                className="field rounded-none border-0 bg-transparent font-mono focus:shadow-none"
                placeholder="CVC"
                inputMode="numeric"
                autoComplete="cc-csc"
                maxLength={4}
                value={form.cvc}
                onChange={(e) => set('cvc')(digits(e.target.value))}
                data-testid="input-cvc"
              />
            </div>
          </div>
          {err('card')}
          {err('expiry')}
          {err('cvc')}

          <button type="submit" className="btn-glow mt-7 flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-[16px] font-semibold text-white" disabled={paying} data-testid="pay-button">
            {paying ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Processing…
              </>
            ) : (
              `Pay ${money(total)}`
            )}
          </button>
          <p className="mt-3.5 flex items-center justify-center gap-1.5 text-[12px] text-haze">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
              <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
            </svg>
            Payments are simulated. No real card is charged.
          </p>
        </form>
      </div>
    </div>
  );
}
