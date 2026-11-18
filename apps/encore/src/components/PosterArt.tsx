// Generated tour poster: aurora curtains over a striped neon sun sinking into a tide of light.
import { useId } from 'react';

const STARS = Array.from({ length: 70 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { x: r(1) * 400, y: r(2) * 300, s: 0.4 + r(3) * 1.3, o: 0.25 + r(4) * 0.75 };
});

const wave = (y: number, amp: number, len: number, phase: number) => {
  let d = `M -20 ${y}`;
  for (let x = -20; x <= 420; x += 10) d += ` L ${x} ${(y + Math.sin((x + phase) / len) * amp).toFixed(1)}`;
  return d;
};

export default function PosterArt({ className = '', showText = true }: { className?: string; showText?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const id = (n: string) => `${n}-${uid}`;
  const url = (n: string) => `url(#${id(n)})`;
  // Sun stripes get thicker toward the horizon, classic synthwave.
  const stripes = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ y: 318 + i * 11.5 + i * i * 0.6, h: 1.6 + i * 1.3 }));

  return (
    <svg viewBox="0 0 400 560" className={className} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#05030f" />
          <stop offset="0.38" stopColor="#1a0b3d" />
          <stop offset="0.62" stopColor="#4a1260" />
          <stop offset="0.74" stopColor="#c02a78" />
          <stop offset="0.8" stopColor="#ff7a6b" />
        </linearGradient>
        <linearGradient id={id('sun')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.35" stopColor="#ffb547" />
          <stop offset="0.7" stopColor="#ff4fa3" />
          <stop offset="1" stopColor="#a21caf" />
        </linearGradient>
        <linearGradient id={id('aur1')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3ee6d6" stopOpacity="0" />
          <stop offset="0.3" stopColor="#3ee6d6" />
          <stop offset="0.7" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id('aur2')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a78bfa" stopOpacity="0" />
          <stop offset="0.45" stopColor="#ff4fa3" />
          <stop offset="1" stopColor="#3ee6d6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id('sea')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b0838" />
          <stop offset="1" stopColor="#04020b" />
        </linearGradient>
        <radialGradient id={id('halo')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff6bb5" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ff6bb5" stopOpacity="0" />
        </radialGradient>
        <filter id={id('blur')} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id={id('glow')} x="-20%" y="-200%" width="140%" height="500%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <mask id={id('sunmask')}>
          <rect width="400" height="560" fill="#fff" />
          {stripes.map((s) => (
            <rect key={s.y} x="0" y={s.y} width="400" height={s.h} fill="#000" />
          ))}
        </mask>
        <clipPath id={id('above')}>
          <rect width="400" height="400" />
        </clipPath>
      </defs>

      <rect width="400" height="560" fill={url('sky')} />
      {STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#fff" opacity={s.o * 0.8} />
      ))}

      {/* aurora curtains */}
      <g filter={url('blur')} opacity="0.9">
        <path d="M -20 150 C 60 60, 140 190, 220 100 S 360 40, 430 120 L 430 170 C 340 110, 260 230, 180 160 S 40 150, -20 220 Z" fill={url('aur1')} />
        <path d="M -20 70 C 80 140, 160 20, 250 80 S 380 160, 430 60 L 430 100 C 360 190, 260 120, 200 140 S 60 80, -20 120 Z" fill={url('aur2')} opacity="0.7" />
      </g>
      <g opacity="0.35" stroke="#7ff6ea" strokeWidth="0.6">
        {Array.from({ length: 26 }, (_, i) => (
          <line key={i} x1={20 + i * 14} y1={70 + Math.sin(i / 2) * 26} x2={20 + i * 14 + 4} y2={150 + Math.cos(i / 3) * 34} />
        ))}
      </g>

      {/* sun */}
      <circle cx="200" cy="330" r="150" fill={url('halo')} />
      <g clipPath={url('above')}>
        <circle cx="200" cy="330" r="104" fill={url('sun')} mask={url('sunmask')} />
      </g>

      {/* tide */}
      <rect y="398" width="400" height="162" fill={url('sea')} />
      <rect y="396" width="400" height="3" fill="#ffd1e8" opacity="0.85" filter={url('glow')} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect
          key={i}
          x={200 - (90 - i * 9)}
          y={408 + i * 9 + i * i * 0.9}
          width={(90 - i * 9) * 2}
          height={2.2 - i * 0.15}
          rx="1"
          fill="#ff9bc8"
          opacity={0.75 - i * 0.08}
        />
      ))}
      <g fill="none" filter={url('glow')} strokeLinecap="round">
        <path d={wave(452, 6, 22, 0)} stroke="#3ee6d6" strokeWidth="1.6" opacity="0.95" />
        <path d={wave(474, 8, 28, 40)} stroke="#a78bfa" strokeWidth="1.4" opacity="0.8" />
        <path d={wave(500, 10, 34, 90)} stroke="#ff4fa3" strokeWidth="1.3" opacity="0.65" />
        <path d={wave(530, 12, 40, 10)} stroke="#3ee6d6" strokeWidth="1.1" opacity="0.45" />
      </g>

      {showText && (
        <g fill="#fff">
          <text x="200" y="58" textAnchor="middle" fontFamily="'Unbounded Variable', sans-serif" fontWeight="800" fontSize="40" letterSpacing="2">
            AURORA
          </text>
          <text x="200" y="100" textAnchor="middle" fontFamily="'Unbounded Variable', sans-serif" fontWeight="800" fontSize="40" letterSpacing="2">
            VALE
          </text>
          <text x="200" y="128" textAnchor="middle" fontFamily="'Instrument Serif', serif" fontStyle="italic" fontSize="22" fill="#ffd1e8">
            Neon Tides Tour
          </text>
          <text x="200" y="538" textAnchor="middle" fontFamily="'JetBrains Mono Variable', monospace" fontSize="9.5" letterSpacing="3" opacity="0.8">
            THE FILLMORE · SAN FRANCISCO · NOV 19–29
          </text>
        </g>
      )}
    </svg>
  );
}
