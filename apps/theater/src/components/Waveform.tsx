import { useEffect, useRef } from 'react';

type Props = {
  analyser: AnalyserNode | null;
  /** 0..1 loudness used when no live audio is flowing (muted, no mp3s, or paused scrubbing). */
  fallback: number;
  width: number;
  height: number;
  color?: string;
};

const BARS = 72;

/** Mirrored bar waveform; reads the live analyser when sound is playing, else a speech-like envelope. */
export function Waveform({ analyser, fallback, width, height, color = '#ffd60a' }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;
  const levels = useRef(new Float32Array(BARS));

  useEffect(() => {
    const c = canvas.current!;
    const g = c.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = width * dpr;
    c.height = height * dpr;
    g.scale(dpr, dpr);
    const data = new Uint8Array(analyser ? analyser.fftSize : 0);
    let raf = 0;
    const draw = (now: number) => {
      let live = 0;
      const target = new Float32Array(BARS);
      if (analyser) {
        analyser.getByteTimeDomainData(data);
        const per = Math.floor(data.length / BARS);
        for (let i = 0; i < BARS; i++) {
          let peak = 0;
          for (let j = 0; j < per; j++) peak = Math.max(peak, Math.abs(data[i * per + j] - 128) / 128);
          target[i] = Math.min(1, peak * 2.4);
          live = Math.max(live, target[i]);
        }
      }
      if (live < 0.02) {
        const f = fallbackRef.current;
        for (let i = 0; i < BARS; i++) {
          const x = i / BARS;
          const shape = Math.sin(Math.PI * x) ** 0.8;
          const n = 0.55 + 0.45 * Math.sin(now / 90 + i * 1.7) * Math.sin(now / 210 + i * 0.6);
          target[i] = f * shape * n;
        }
      }
      const lv = levels.current;
      g.clearRect(0, 0, width, height);
      const gap = width / BARS;
      const bw = Math.max(3, gap * 0.42);
      const mid = height / 2;
      for (let i = 0; i < BARS; i++) {
        lv[i] += (target[i] - lv[i]) * (target[i] > lv[i] ? 0.5 : 0.12);
        // Silence draws nothing: the black screen should look as quiet as it sounds.
        if (lv[i] < 0.04) continue;
        const h = Math.max(10, lv[i] * (height - 6));
        const x = i * gap + (gap - bw) / 2;
        g.globalAlpha = 0.85 + 0.15 * Math.min(1, lv[i] * 2);
        g.fillStyle = color;
        g.beginPath();
        g.roundRect(x, mid - h / 2, bw, h, bw / 2);
        g.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyser, width, height, color]);

  return <canvas ref={canvas} aria-hidden="true" style={{ width, height }} />;
}
