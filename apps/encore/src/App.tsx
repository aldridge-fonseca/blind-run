import { useMemo, useState } from 'react';
import { Hero, TopBar } from './components/Hero';
import DateCarousel from './components/DateCarousel';
import SeatMap, { SeatLegend } from './components/SeatMap';
import BookingSummary, { totals } from './components/BookingSummary';
import CheckoutModal, { type Buyer } from './components/CheckoutModal';
import Confirmation from './components/Confirmation';
import { DATES, EVENT, money, seatsFor, type Seat } from './lib/event';

function Atmosphere() {
  return (
    <div className="grain pointer-events-none fixed inset-0 overflow-hidden">
      <div className="aurora-blob left-[-10%] top-[-20%] h-[60vw] w-[60vw] bg-[#5b21b6]" />
      <div className="aurora-blob right-[-15%] top-[5%] h-[45vw] w-[45vw] bg-[#be185d]" style={{ animationDelay: '-6s', opacity: 0.35 }} />
      <div className="aurora-blob bottom-[-25%] left-[20%] h-[50vw] w-[50vw] bg-[#0f766e]" style={{ animationDelay: '-11s', opacity: 0.3 }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,#07060d_75%)]" />
    </div>
  );
}

function Step({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-4">
        <span className="w-5 font-mono text-[12px] text-haze">{n}</span>
        <h2 className="font-display text-[clamp(22px,2.2vw,30px)] font-semibold tracking-tight">{title}</h2>
      </div>
      {sub && <p className="mt-1 pl-9 text-[13px] text-haze">{sub}</p>}
    </div>
  );
}

export default function App() {
  const [dateId, setDateId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [checkout, setCheckout] = useState(false);
  const [buyer, setBuyer] = useState<Buyer | null>(null);

  const date = DATES.find((d) => d.id === dateId) ?? null;
  const seats = useMemo(() => seatsFor(dateId ?? 'fri-21'), [dateId]);
  const chosen = selected.map((id) => seats.find((s) => s.id === id)!).filter(Boolean);

  const pickDate = (id: string) => {
    if (id !== dateId) setSelected([]);
    setDateId(id);
  };
  const changeQty = (n: number) => {
    setQty(n);
    setSelected((s) => s.slice(0, n));
  };
  const toggle = (seat: Seat) =>
    setSelected((s) => {
      if (s.includes(seat.id)) return s.filter((x) => x !== seat.id);
      const next = [...s, seat.id];
      return next.length > qty ? next.slice(next.length - qty) : next;
    });
  const reset = () => {
    setBuyer(null);
    setSelected([]);
    setDateId(null);
    setQty(1);
    window.scrollTo({ top: 0 });
  };

  if (buyer && date) {
    return (
      <div className="relative min-h-screen overflow-x-hidden">
        <Atmosphere />
        <div className="relative">
          <TopBar />
          <Confirmation date={date} seats={chosen} buyer={buyer} onDone={reset} />
        </div>
      </div>
    );
  }

  const ready = !!date && chosen.length === qty;

  return (
    <div className="relative min-h-screen overflow-x-hidden pb-28 lg:pb-0">
      <Atmosphere />
      <div className="relative">
        <TopBar />
        <Hero />

        <main className="mx-auto max-w-[1360px] px-4 sm:px-8">
          <section id="dates" className="scroll-mt-6">
            <Step n="01" title="Choose your night" sub={`9 shows · ${EVENT.venue}, ${EVENT.city}`} />
            <div className="-mx-4 sm:mx-0">
              <DateCarousel value={dateId} onChange={pickDate} />
            </div>
          </section>

          <section className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
            <div>
              <Step n="02" title="Pick your seats" />
              <div className="mb-5 pl-9">
                <SeatLegend />
              </div>
              <div className="glass relative overflow-hidden rounded-[28px] px-3 pb-6 pt-2 sm:px-8 sm:pb-8">
                <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-[70%] -translate-x-1/2 rounded-full bg-violet/25 blur-3xl" />
                <SeatMap seats={seats} selected={selected} locked={!date} onToggle={toggle} />
                <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-5 text-[12.5px] text-haze">
                  <span>All seats face the stage · Mezzanine has a 2 ft riser</span>
                  <span className="font-mono">{seats.filter((s) => !s.sold).length} seats left</span>
                </div>
              </div>
            </div>

            <div className="lg:sticky lg:top-6 lg:pt-[96px]">
              <BookingSummary date={date} qty={qty} onQty={changeQty} seats={chosen} onRemove={(id) => setSelected((s) => s.filter((x) => x !== id))} onCheckout={() => setCheckout(true)} />
            </div>
          </section>

          <footer className="mt-24 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] py-10 text-[13px] text-haze">
            <span className="font-display text-white/80">encore</span>
            <span>Aurora Vale, the Neon Tides Tour and Encore are fictional, made for a demo.</span>
          </footer>
        </main>
      </div>

      {/* mobile checkout dock */}
      {date && (
      <div className="fade-in fixed inset-x-3 bottom-3 z-40 rounded-3xl border border-white/10 bg-[#120f1d]/85 py-3 pl-5 pr-3 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)] backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[12px] text-haze">
              {qty} ticket{qty === 1 ? '' : 's'} · {chosen.length} selected
            </div>
            <div className="font-display text-[20px] font-semibold">{money(totals(chosen).total)}</div>
          </div>
          <button type="button" className="btn-glow rounded-2xl px-7 py-3.5 text-[15px] font-semibold text-white" disabled={!ready} onClick={() => setCheckout(true)}>
            Checkout
          </button>
        </div>
      </div>
      )}

      {checkout && date && <CheckoutModal date={date} seats={chosen} onClose={() => setCheckout(false)} onPaid={(b) => { setCheckout(false); setBuyer(b); window.scrollTo({ top: 0 }); }} />}
    </div>
  );
}
