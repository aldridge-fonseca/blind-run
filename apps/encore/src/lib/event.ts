// Static event data for the fictional Aurora Vale residency at The Fillmore.

export const EVENT = {
  artist: 'Aurora Vale',
  tour: 'Neon Tides Tour',
  venue: 'The Fillmore',
  city: 'San Francisco',
  address: '1805 Geary Blvd, San Francisco, CA',
  support: 'Lumen Drift',
  doors: '7:00 PM',
  show: '8:00 PM',
  orderNumber: 'ENC-4821',
  feePerTicket: 12.5,
};

export type Availability = 'available' | 'selling' | 'few' | 'soldout';

export interface ShowDate {
  id: string;
  weekday: string;
  weekdayLong: string;
  day: number;
  month: string;
  time: string;
  availability: Availability;
  note?: string;
}

export const DATES: ShowDate[] = [
  { id: 'wed-19', weekday: 'Wed', weekdayLong: 'Wednesday', day: 19, month: 'Nov', time: '8:00 PM', availability: 'few' },
  { id: 'thu-20', weekday: 'Thu', weekdayLong: 'Thursday', day: 20, month: 'Nov', time: '8:00 PM', availability: 'selling' },
  { id: 'fri-21', weekday: 'Fri', weekdayLong: 'Friday', day: 21, month: 'Nov', time: '8:00 PM', availability: 'selling', note: 'Opening weekend' },
  { id: 'sat-22', weekday: 'Sat', weekdayLong: 'Saturday', day: 22, month: 'Nov', time: '8:00 PM', availability: 'soldout' },
  { id: 'sun-23', weekday: 'Sun', weekdayLong: 'Sunday', day: 23, month: 'Nov', time: '7:00 PM', availability: 'available' },
  { id: 'tue-25', weekday: 'Tue', weekdayLong: 'Tuesday', day: 25, month: 'Nov', time: '8:00 PM', availability: 'available' },
  { id: 'wed-26', weekday: 'Wed', weekdayLong: 'Wednesday', day: 26, month: 'Nov', time: '8:00 PM', availability: 'available' },
  { id: 'fri-28', weekday: 'Fri', weekdayLong: 'Friday', day: 28, month: 'Nov', time: '8:00 PM', availability: 'few' },
  { id: 'sat-29', weekday: 'Sat', weekdayLong: 'Saturday', day: 29, month: 'Nov', time: '8:00 PM', availability: 'few', note: 'Final night' },
];

export interface Tier {
  id: 'front' | 'orchestra' | 'mezz';
  name: string;
  price: number;
  color: string;
  rows: string[];
}

export const TIERS: Tier[] = [
  { id: 'front', name: 'Front Stage', price: 189, color: '#ff4fa3', rows: ['A', 'B', 'C'] },
  { id: 'orchestra', name: 'Orchestra', price: 129, color: '#a78bfa', rows: ['D', 'E', 'F', 'G', 'H'] },
  { id: 'mezz', name: 'Mezzanine', price: 79, color: '#3ee6d6', rows: ['I', 'J', 'K', 'L'] },
];

export const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
export const SEATS_PER_ROW = 24;
/** Seat numbers after which an aisle runs (left | center | right sections). */
export const AISLES_AFTER = [6, 18];

export const tierForRow = (row: string): Tier => TIERS.find((t) => t.rows.includes(row))!;

export const sectionForSeat = (n: number) => (n <= 6 ? 'Left' : n <= 18 ? 'Center' : 'Right');

export interface Seat {
  id: string;
  row: string;
  number: number;
  tier: Tier;
  sold: boolean;
}

// Small deterministic hash so the sold-out pattern is stable across reloads and runs.
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) % 10000) / 10000;
};

const soldRate: Record<Tier['id'], number> = { front: 0.74, orchestra: 0.58, mezz: 0.46 };

export function seatsFor(dateId: string): Seat[] {
  const seats: Seat[] = [];
  for (const row of ROWS) {
    const tier = tierForRow(row);
    for (let n = 1; n <= SEATS_PER_ROW; n++) {
      let sold = hash(`${dateId}:${row}${n}`) < soldRate[tier.id];
      // Friday's row F is nearly gone: only the adjacent pair F14–F15 is left.
      if (dateId === 'fri-21' && row === 'F') sold = n !== 14 && n !== 15;
      seats.push({ id: `${row}${n}`, row, number: n, tier, sold });
    }
  }
  return seats;
}

export const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

/** "Row F · Seats 14–15" for a consecutive run in one row, otherwise a plain list. */
export function describeSeats(seats: Pick<Seat, 'row' | 'number'>[]): string {
  if (seats.length === 0) return '';
  const sorted = [...seats].sort((a, b) => (a.row === b.row ? a.number - b.number : a.row.localeCompare(b.row)));
  const sameRow = sorted.every((s) => s.row === sorted[0].row);
  if (sameRow) {
    const nums = sorted.map((s) => s.number);
    if (nums.length === 1) return `Row ${sorted[0].row} · Seat ${nums[0]}`;
    const consecutive = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
    if (consecutive) return `Row ${sorted[0].row} · Seats ${nums[0]}–${nums[nums.length - 1]}`;
    return `Row ${sorted[0].row} · Seats ${nums.join(', ')}`;
  }
  return `Seats ${sorted.map((s) => `${s.row}${s.number}`).join(', ')}`;
}
