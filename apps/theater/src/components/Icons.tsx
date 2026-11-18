import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 20): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false,
});

export const Eye = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const EyeOff = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.8 3.7M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="m3 3 18 18" /></svg>
);
export const Play = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} fill="currentColor" stroke="none"><path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l11.6-7.2a1 1 0 0 0 0-1.72L8.5 3.94A1 1 0 0 0 7 4.8Z" /></svg>
);
export const Pause = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1.2" /><rect x="14" y="4" width="4" height="16" rx="1.2" /></svg>
);
export const Check = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} strokeWidth={2.4}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const Cross = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} strokeWidth={2.4}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const Speaker = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4Z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" /></svg>
);
export const SpeakerOff = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4Z" /><path d="m16 9.5 5 5M21 9.5l-5 5" /></svg>
);
export const Arrow = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const External = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);
export const File = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z" /><path d="M14 3v5h5" /></svg>
);
export const Keyboard = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" /></svg>
);
export const Lens = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.2" /></svg>
);
export const Expand = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
);
export const Link = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></svg>
);
export const Back = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);
export const Bolt = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></svg>
);
export const FastForward = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} fill="currentColor" stroke="none"><path d="M3 6.5v11a.8.8 0 0 0 1.25.66L12 13v4.5a.8.8 0 0 0 1.25.66l8-5.5a.8.8 0 0 0 0-1.32l-8-5.5A.8.8 0 0 0 12 6.5V11L4.25 5.84A.8.8 0 0 0 3 6.5Z" /></svg>
);

/** The Blind Run mark: an eye ring struck through in red. */
export const Mark = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <circle cx="16" cy="16" r="8.5" fill="none" stroke="#f5f5f7" strokeWidth="2.6" />
    <path d="M6 26 26 6" stroke="#ff453a" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);
