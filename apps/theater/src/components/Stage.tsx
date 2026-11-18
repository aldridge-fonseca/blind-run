import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export const STAGE_W = 1920;
export const STAGE_H = 1080;

/** A fixed 1920×1080 canvas scaled to fit its container, so every screen matches the recording. */
export function Stage({ children, label }: { children: ReactNode; label: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = outer.current!;
    const fit = () => setScale(Math.min(el.clientWidth / STAGE_W, el.clientHeight / STAGE_H));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outer} className="relative h-full w-full overflow-hidden">
      <section
        aria-label={label}
        className="grain absolute left-1/2 top-1/2 overflow-hidden bg-ink"
        style={{ width: STAGE_W, height: STAGE_H, transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}
      >
        {children}
      </section>
    </div>
  );
}
