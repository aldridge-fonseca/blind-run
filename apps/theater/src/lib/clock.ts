import { useSyncExternalStore } from 'react';

export const SPEEDS = [0.5, 1, 1.5, 2, 3];

type State = { t: number; playing: boolean; speed: number; duration: number; seeks: number };

/** The master playback clock. Everything on screen is a pure function of `t`. */
export class Clock {
  private state: State = { t: 0, playing: false, speed: 1, duration: 0, seeks: 0 };
  private listeners = new Set<() => void>();
  private raf = 0;
  private last = 0;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  get = () => this.state;

  private set(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  private tick = (now: number) => {
    const dt = now - this.last;
    this.last = now;
    const t = Math.min(this.state.duration, this.state.t + dt * this.state.speed);
    if (t >= this.state.duration) this.set({ t, playing: false });
    else {
      this.set({ t });
      this.raf = requestAnimationFrame(this.tick);
    }
  };

  play() {
    if (this.state.playing) return;
    if (this.state.t >= this.state.duration) this.set({ t: 0, seeks: this.state.seeks + 1 });
    this.last = performance.now();
    this.set({ playing: true });
    this.raf = requestAnimationFrame(this.tick);
  }
  pause() {
    cancelAnimationFrame(this.raf);
    if (this.state.playing) this.set({ playing: false });
  }
  toggle() {
    if (this.state.playing) this.pause();
    else this.play();
  }
  seek(t: number) {
    this.set({ t: Math.min(Math.max(0, t), this.state.duration), seeks: this.state.seeks + 1 });
  }
  setSpeed(speed: number) {
    this.set({ speed });
  }
  setDuration(duration: number) {
    this.set({ duration, t: Math.min(this.state.t, duration) });
  }
  dispose() {
    this.pause();
  }
}

export function useClock<T>(clock: Clock, select: (s: State) => T): T {
  return useSyncExternalStore(clock.subscribe, () => select(clock.get()));
}
