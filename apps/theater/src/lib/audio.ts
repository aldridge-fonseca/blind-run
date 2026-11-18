// Plays the screen-reader mp3s in sync with the show clock and exposes an analyser for the waveform.
import type { Clock } from './clock';
import { laneTimeAt, type Show } from './show';
import type { AudioClip } from './types';

type Active = { clip: AudioClip; el: HTMLAudioElement };

export class AudioEngine {
  ctx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  private gain: GainNode | null = null;
  private elements = new Map<string, HTMLAudioElement>();
  private active: Active[] = [];
  private lastLaneT: number | null = null;
  private lastChapter: string | null = null;
  private lastSeeks = -1;
  muted = false;
  /** Clips that actually started playing (for tests). */
  played = 0;
  listeners = new Set<() => void>();

  constructor(private clock: Clock, private show: () => Show) {}

  /** Follows the clock until the returned function is called. Safe to call again afterwards. */
  attach() {
    const unsub = this.clock.subscribe(this.update);
    return () => {
      unsub();
      this.stopAll();
    };
  }

  /** Must be called from a user gesture (or with autoplay allowed) before sound can play. */
  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.6;
        this.gain = this.ctx.createGain();
        this.analyser.connect(this.gain).connect(this.ctx.destination);
        this.listeners.forEach((fn) => fn());
      } catch {
        this.ctx = null;
      }
    }
    void this.ctx
      ?.resume()
      .then(() => this.listeners.forEach((fn) => fn()))
      .catch(() => {});
  }

  get running() {
    return this.ctx?.state === 'running';
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.gain) this.gain.gain.value = muted ? 0 : 1;
    for (const el of this.elements.values()) el.muted = muted && !this.gain;
  }

  preload(clips: AudioClip[]) {
    for (const c of clips) this.element(c.url);
  }

  private element(url: string) {
    let el = this.elements.get(url);
    if (!el) {
      el = new Audio();
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      el.src = url;
      this.elements.set(url, el);
      (el as HTMLAudioElement & { _wired?: boolean })._wired = false;
    }
    if (this.ctx && this.analyser && !(el as HTMLAudioElement & { _wired?: boolean })._wired) {
      try {
        this.ctx.createMediaElementSource(el).connect(this.analyser);
        (el as HTMLAudioElement & { _wired?: boolean })._wired = true;
      } catch {
        /* already wired */
      }
    }
    return el;
  }

  private stopAll() {
    for (const a of this.active) a.el.pause();
    this.active = [];
  }

  private update = () => {
    const { t, playing, speed, seeks } = this.clock.get();
    const show = this.show();
    const ch = show.chapters.find((c) => t >= c.start && t < c.end);
    const blind = ch && ch.kind === 'race' ? ch.blind : null;
    const seeked = seeks !== this.lastSeeks;
    this.lastSeeks = seeks;
    if (!playing || !blind || !ch || ch.id !== this.lastChapter || seeked) {
      if (!playing || seeked || ch?.id !== this.lastChapter) this.stopAll();
      this.lastChapter = ch?.id ?? null;
      this.lastLaneT = blind && ch ? laneTimeAt(blind.warp, t - ch.start) : null;
      if (!playing || !blind) return;
    }
    const laneT = laneTimeAt(blind.warp, t - ch!.start);
    const prev = this.lastLaneT ?? laneT;
    this.lastLaneT = laneT;
    for (const clip of blind.lane.audio) {
      if (clip.t > prev && clip.t <= laneT) this.start(clip, 0, speed);
    }
    for (const a of this.active) if (a.el.playbackRate !== speed) a.el.playbackRate = speed;
  };

  private start(clip: AudioClip, offset: number, speed: number) {
    const el = this.element(clip.url);
    // A new announcement interrupts the previous one, as a real screen reader does.
    this.stopAll();
    el.currentTime = offset;
    el.playbackRate = speed;
    el.muted = this.muted && !this.gain;
    void el.play().then(() => this.played++).catch(() => {});
    this.active.push({ clip, el });
  }

}
