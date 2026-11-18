import PosterArt from './PosterArt';
import { EVENT } from '../lib/event';

export function TopBar() {
  return (
    <header className="relative z-20 mx-auto flex max-w-[1360px] items-center justify-between px-4 py-5 sm:px-8">
      <a href="#" className="flex items-center gap-2.5" data-testid="brand">
        <span className="relative grid h-8 w-8 place-items-center rounded-[10px] bg-white/5 ring-1 ring-white/10">
          <span className="h-4 w-4 rounded-full border-[3px] border-transparent [background:linear-gradient(#0d0b16,#0d0b16)_padding-box,linear-gradient(135deg,#3ee6d6,#8b5cf6,#ff4fa3)_border-box]" />
        </span>
        <span className="font-display text-[17px] font-semibold tracking-tight">encore</span>
      </a>
      <nav className="hidden items-center gap-8 text-[14px] text-mist md:flex">
        <a href="#" className="transition hover:text-white">Discover</a>
        <a href="#" className="transition hover:text-white">Venues</a>
        <a href="#" className="transition hover:text-white">Artists</a>
        <a href="#" className="transition hover:text-white">My tickets</a>
      </nav>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[13px] text-haze lg:flex">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          Search artists, venues
          <kbd className="ml-6 rounded-md border border-white/10 px-1.5 font-mono text-[10px]">⌘K</kbd>
        </div>
        <div className="h-9 w-9 rounded-full bg-[conic-gradient(from_200deg,#3ee6d6,#8b5cf6,#ff4fa3,#ffb547,#3ee6d6)] p-[2px]">
          <div className="grid h-full w-full place-items-center rounded-full bg-night font-display text-[11px] font-semibold">AR</div>
        </div>
      </div>
    </header>
  );
}

export function Hero() {
  return (
    <section className="relative" data-testid="hero">
      <div className="relative mx-auto grid max-w-[1360px] items-center gap-10 px-4 pb-14 pt-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-20 lg:pb-20 lg:pt-10">
        <div className="rise order-2 lg:order-1">
          <div className="mb-7 flex flex-wrap items-center gap-2.5">
            <span className="flex items-center gap-2 rounded-full border border-magenta/30 bg-magenta/10 px-3 py-1.5 text-[12px] font-medium text-[#ffb3d6]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-magenta opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-magenta" />
              </span>
              On sale now · 9-night residency
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-mist">Electronic · Dream pop</span>
          </div>

          <p className="eyebrow mb-4 text-cyan/90">
            {EVENT.venue} · {EVENT.city}
          </p>
          <h1 className="font-display text-[clamp(48px,8.4vw,132px)] font-extrabold leading-[0.86] tracking-[-0.045em]">
            AURORA
            <br />
            VALE
          </h1>
          <p className="mt-4 font-serif text-[clamp(34px,4.6vw,64px)] italic leading-none text-aurora">{EVENT.tour}</p>

          <p className="mt-7 max-w-[540px] text-[16px] leading-relaxed text-mist">
            Nine nights of shimmering synths and tidal bass. Aurora Vale brings the full Neon Tides light show to the
            Fillmore, with special guest <span className="text-white">{EVENT.support}</span>.
          </p>

          <dl className="mt-9 grid max-w-[620px] grid-cols-2 border-y border-white/10 sm:grid-cols-4 sm:divide-x sm:divide-white/10">
            {[
              ['Dates', 'Nov 19 – 29'],
              ['Doors', EVENT.doors],
              ['Show', EVENT.show],
              ['Ages', 'All ages'],
            ].map(([k, v]) => (
              <div key={k} className="py-3.5 pr-5 sm:px-5 sm:first:pl-0">
                <dt className="eyebrow text-[10px] text-haze">{k}</dt>
                <dd className="mt-1 text-[15px] font-medium">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-9 flex max-w-[620px] flex-wrap items-center gap-4">
            <a href="#dates" className="btn-glow rounded-full px-7 py-3.5 text-[15px] font-semibold text-white" data-testid="hero-cta">
              Get tickets
            </a>
            <a href="#" className="group flex items-center gap-3 rounded-full px-2 py-2 text-[15px] text-mist transition hover:text-white">
              <span className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/5 transition group-hover:border-white/30">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 4.5v15l13-7.5z" />
                </svg>
              </span>
              Watch the trailer
            </a>
          </div>
        </div>

        <div className="rise relative order-1 mx-auto w-full max-w-[230px] sm:max-w-[340px] lg:order-2 lg:max-w-none" style={{ animationDelay: '120ms' }}>
          <div className="absolute -inset-10 rounded-[48px] bg-[radial-gradient(closest-side,rgba(255,79,163,0.45),rgba(139,92,246,0.25)_55%,transparent)] blur-2xl" />
          <div className="absolute -left-6 top-[44%] z-10 hidden items-center gap-3 whitespace-nowrap rounded-full bg-[#120f1c]/80 py-2 pl-2 pr-4 shadow-2xl ring-1 ring-white/10 backdrop-blur-md sm:flex lg:-left-12">
            <div className="flex -space-x-2">
              {['#3ee6d6', '#a78bfa', '#ff4fa3'].map((c) => (
                <span key={c} className="h-7 w-7 rounded-full ring-2 ring-[#120f1c]" style={{ background: `radial-gradient(circle at 30% 30%, #fff8, ${c})` }} />
              ))}
            </div>
            <div className="text-[12px] leading-tight">
              <div className="font-semibold">2,841 fans going</div>
              <div className="text-mist">14 friends interested</div>
            </div>
          </div>
          <div className="relative rotate-[2.5deg] overflow-hidden rounded-[28px] shadow-[0_50px_120px_-30px_rgba(160,40,140,0.75)] ring-1 ring-white/15 transition-transform duration-700 hover:rotate-0">
            <PosterArt className="block aspect-[5/7] w-full" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.16),transparent_35%,transparent_70%,rgba(255,255,255,0.06))]" />
          </div>
        </div>
      </div>
    </section>
  );
}
