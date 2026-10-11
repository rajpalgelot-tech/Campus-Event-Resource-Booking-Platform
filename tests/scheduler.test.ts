import { describe, expect, it } from 'vitest';
import {
  bookingMinutes,
  findConflict,
  rangesOverlap,
  toMinutes,
  validateBooking,
} from '../src/booking/scheduler';
import { addDays } from '../src/booking/dates';
import type { Booking } from '../src/booking/types';

const TODAY = '2026-10-11'; // a Sunday

function mk(id: string, overrides: Partial<Booking> = {}): Booking {
  return {
    id,
    resourceId: 'r-semA',
    title: 'Existing event',
    organizer: 'Placement Cell',
    date: TODAY,
    start: '10:00',
    end: '12:00',
    status: 'confirmed',
    ...overrides,
  };
}

describe('toMinutes', () => {
  it('converts HH:MM to minutes since midnight', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('09:30')).toBe(570);
    expect(toMinutes('23:59')).toBe(1439);
  });

  it('rejects malformed times', () => {
    expect(toMinutes('9:30')).toBeNull();
    expect(toMinutes('24:00')).toBeNull();
    expect(toMinutes('12:5')).toBeNull();
    expect(toMinutes('')).toBeNull();
    expect(toMinutes('10:60')).toBeNull();
  });
});

describe('rangesOverlap', () => {
  it('detects a genuine overlap', () => {
    expect(rangesOverlap(600, 660, 630, 690)).toBe(true);
    expect(rangesOverlap(630, 690, 600, 660)).toBe(true);
    expect(rangesOverlap(600, 660, 610, 650)).toBe(true);
    expect(rangesOverlap(600, 660, 590, 670)).toBe(true);
  });

  it('allows back to back slots that only touch', () => {
    expect(rangesOverlap(600, 660, 660, 720)).toBe(false); // next slot starts at our end
    expect(rangesOverlap(540, 600, 600, 660)).toBe(false); // previous slot ends at our start
  });

  it('separates disjoint ranges', () => {
    expect(rangesOverlap(600, 660, 700, 760)).toBe(false);
  });
});

describe('findConflict', () => {
  // r-semA on TODAY is occupied 10:00-13:00 (b-1, b-5) with b-4 cancelled;
  // the afternoon slot belongs to another resource and the morning one to another day.
  const bookings = [
    mk('b-1'), // r-semA, TODAY, 10:00-12:00
    mk('b-2', { resourceId: 'r-semB', start: '14:00', end: '16:00' }), // other resource, today afternoon
    mk('b-3', { date: addDays(TODAY, 1), start: '14:00', end: '16:00' }), // same resource, tomorrow afternoon
    mk('b-4', { status: 'cancelled' }), // same slot as b-1 but cancelled
    mk('b-5', { start: '12:00', end: '13:00' }), // touches b-1 at noon
  ];

  it('finds the clashing booking on the same resource and slot', () => {
    const clash = findConflict(bookings, { resourceId: 'r-semA', date: TODAY, start: '11:00', end: '12:30' });
    expect(clash?.id).toBe('b-1');
  });

  it('ignores bookings on other resources', () => {
    // only b-2 occupies 15:00-16:00, and it lives on r-semB
    expect(
      findConflict(bookings, { resourceId: 'r-semA', date: TODAY, start: '15:00', end: '16:00' }),
    ).toBeNull();
  });

  it('ignores bookings on other dates', () => {
    // only b-3 occupies 14:00-15:00, and it is tomorrow
    expect(
      findConflict(bookings, { resourceId: 'r-semA', date: TODAY, start: '14:00', end: '15:00' }),
    ).toBeNull();
  });

  it('ignores cancelled bookings', () => {
    const onlyCancelled = [mk('b-4', { resourceId: 'r-meet', status: 'cancelled' })];
    expect(
      findConflict(onlyCancelled, { resourceId: 'r-meet', date: TODAY, start: '11:00', end: '12:00' }),
    ).toBeNull();
  });

  it('allows a slot that starts exactly when the last one ends', () => {
    expect(
      findConflict(bookings, { resourceId: 'r-semA', date: TODAY, start: '13:00', end: '14:30' }),
    ).toBeNull();
  });

  it('returns null for malformed candidate times', () => {
    expect(
      findConflict(bookings, { resourceId: 'r-semA', date: TODAY, start: '9am', end: '13:00' }),
    ).toBeNull();
  });
});

describe('validateBooking', () => {
  const resourceIds = ['r-aud', 'r-semA'];
  const base = {
    resourceId: 'r-semA',
    title: 'Workshop',
    organizer: 'Coders Club',
    date: '2026-10-15',
    start: '10:00',
    end: '12:00',
  };

  it('accepts a valid future booking', () => {
    expect(validateBooking(base, TODAY, 600, resourceIds)).toEqual([]);
  });

  it('requires title and organizer', () => {
    const issues = validateBooking({ ...base, title: ' ', organizer: '' }, TODAY, 600, resourceIds);
    const fields = issues.map((i) => i.field);
    expect(fields).toContain('title');
    expect(fields).toContain('organizer');
  });

  it('requires a known resource', () => {
    const issues = validateBooking({ ...base, resourceId: 'r-ghost' }, TODAY, 600, resourceIds);
    expect(issues.some((i) => i.field === 'resourceId')).toBe(true);
  });

  it('rejects end times that are not after the start', () => {
    const issues = validateBooking({ ...base, end: '10:00' }, TODAY, 600, resourceIds);
    expect(issues.some((i) => i.field === 'end')).toBe(true);
  });

  it('rejects impossible dates and bad time formats', () => {
    const issues = validateBooking(
      { ...base, date: '2026-02-30', start: '10:00am', end: '12' },
      TODAY,
      600,
      resourceIds,
    );
    const fields = issues.map((i) => i.field);
    expect(fields).toContain('date');
    expect(fields).toContain('start');
    expect(fields).toContain('end');
  });

  it('rejects past dates', () => {
    const issues = validateBooking({ ...base, date: '2026-10-10' }, TODAY, 600, resourceIds);
    expect(issues.some((i) => i.message.includes('past date'))).toBe(true);
  });

  it('rejects a start earlier today but allows a future start today', () => {
    const early = validateBooking({ ...base, date: TODAY, start: '08:00', end: '09:00' }, TODAY, 540, resourceIds);
    expect(early.some((i) => i.field === 'start')).toBe(true);
    const ok = validateBooking({ ...base, date: TODAY, start: '09:00', end: '10:00' }, TODAY, 540, resourceIds);
    expect(ok).toEqual([]);
  });
});

describe('bookingMinutes', () => {
  it('returns the slot length in minutes', () => {
    expect(bookingMinutes(mk('x'))).toBe(120);
    expect(bookingMinutes(mk('x', { start: '09:00', end: '09:30' }))).toBe(30);
    expect(bookingMinutes(mk('x', { start: '12:00', end: '11:00' }))).toBe(0);
  });
});
