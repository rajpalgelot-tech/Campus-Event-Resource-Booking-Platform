import type { Booking, BookingInput, Issue } from './types';
import { parseIso } from './dates';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** '09:30' becomes 570 minutes since midnight; anything else becomes null. */
export function toMinutes(hhmm: string): number | null {
  if (typeof hhmm !== 'string' || !TIME_RE.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Half-open intervals [start, end). A slot that ends exactly when the next one
 * starts does NOT overlap, so back to back bookings are allowed.
 */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export interface Slot {
  resourceId: string;
  date: string;
  start: string;
  end: string;
}

/**
 * The first confirmed booking on the same resource, date and overlapping time
 * range, or null when the slot is free. Cancelled bookings never block.
 */
export function findConflict(existing: Booking[], slot: Slot): Booking | null {
  const start = toMinutes(slot.start);
  const end = toMinutes(slot.end);
  if (start === null || end === null) return null;
  for (const b of existing) {
    if (b.status !== 'confirmed') continue;
    if (b.resourceId !== slot.resourceId || b.date !== slot.date) continue;
    const bs = toMinutes(b.start);
    const be = toMinutes(b.end);
    if (bs === null || be === null) continue;
    if (rangesOverlap(start, end, bs, be)) return b;
  }
  return null;
}

export function validateBooking(
  input: Partial<BookingInput>,
  today: string,
  currentMinute: number,
  resourceIds: string[],
): Issue[] {
  const issues: Issue[] = [];
  if (!input.resourceId || !resourceIds.includes(input.resourceId)) {
    issues.push({ field: 'resourceId', message: 'Pick a resource from the list' });
  }
  if (!input.title || input.title.trim().length === 0) {
    issues.push({ field: 'title', message: 'Event title is required' });
  }
  if (!input.organizer || input.organizer.trim().length === 0) {
    issues.push({ field: 'organizer', message: 'Organizer name is required' });
  }
  if (!input.date || parseIso(input.date) === null) {
    issues.push({ field: 'date', message: 'Enter a real date in YYYY-MM-DD format' });
  }
  const start = toMinutes(input.start ?? '');
  const end = toMinutes(input.end ?? '');
  if (start === null) {
    issues.push({ field: 'start', message: 'Start time must be in HH:MM format' });
  }
  if (end === null) {
    issues.push({ field: 'end', message: 'End time must be in HH:MM format' });
  }
  if (start !== null && end !== null && end <= start) {
    issues.push({ field: 'end', message: 'End time must be after the start time' });
  }
  if (parseIso(input.date ?? '') !== null && parseIso(today) !== null) {
    if (input.date! < today) {
      issues.push({ field: 'date', message: 'Bookings cannot be made for a past date' });
    } else if (input.date === today && start !== null && start < currentMinute) {
      issues.push({ field: 'start', message: 'That start time has already passed today' });
    }
  }
  return issues;
}

/** Length of a booking in minutes; zero for malformed times. */
export function bookingMinutes(b: Booking): number {
  const s = toMinutes(b.start);
  const e = toMinutes(b.end);
  if (s === null || e === null || e <= s) return 0;
  return e - s;
}
