import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  BookingStore,
  clearStored,
  loadStore,
  saveStore,
  seedBookings,
  seedResources,
} from '../src/booking/store';
import { addDays } from '../src/booking/dates';

const TODAY = '2026-10-11';

function freshStore(): BookingStore {
  return new BookingStore(seedResources(), []);
}

describe('seeds', () => {
  it('provides eight resources across both types', () => {
    const resources = seedResources();
    expect(resources).toHaveLength(8);
    expect(resources.filter((r) => r.type === 'Room')).toHaveLength(5);
    expect(resources.filter((r) => r.type === 'Equipment')).toHaveLength(3);
  });

  it('creates bookings that never clash with each other', () => {
    const bookings = seedBookings(TODAY);
    const confirmed = bookings.filter((b) => b.status === 'confirmed');
    for (let i = 0; i < confirmed.length; i += 1) {
      for (let j = i + 1; j < confirmed.length; j += 1) {
        const sameSlot =
          confirmed[i].resourceId === confirmed[j].resourceId &&
          confirmed[i].date === confirmed[j].date;
        if (!sameSlot) continue;
        const a = confirmed[i];
        const b = confirmed[j];
        const overlaps = a.start < b.end && b.start < a.end;
        expect(overlaps).toBe(false);
      }
    }
  });
});

describe('BookingStore.book', () => {
  const input = {
    resourceId: 'r-semA',
    title: '  Guest lecture  ',
    organizer: '  CSE Department  ',
    date: '2026-10-15',
    start: '10:00',
    end: '12:00',
  };

  it('confirms a valid booking and trims the text fields', () => {
    const store = freshStore();
    const result = store.book(input, TODAY, 600);
    expect(result.ok).toBe(true);
    expect(result.booking?.title).toBe('Guest lecture');
    expect(result.booking?.organizer).toBe('CSE Department');
    expect(result.booking?.status).toBe('confirmed');
  });

  it('rejects a booking that clashes with an existing one and reports it', () => {
    const store = freshStore();
    const first = store.book(input, TODAY, 600);
    expect(first.ok).toBe(true);
    const clash = store.book({ ...input, title: 'Second event' }, TODAY, 600);
    expect(clash.ok).toBe(false);
    expect(clash.conflict?.title).toBe('Guest lecture');
    expect(clash.issues).toBeUndefined();
  });

  it('allows a booking that starts exactly when another ends', () => {
    const store = freshStore();
    store.book(input, TODAY, 600);
    const backToBack = store.book({ ...input, title: 'Next slot', start: '12:00', end: '13:30' }, TODAY, 600);
    expect(backToBack.ok).toBe(true);
  });

  it('returns validation issues instead of booking', () => {
    const store = freshStore();
    const bad = store.book({ ...input, title: '', end: '09:00' }, TODAY, 600);
    expect(bad.ok).toBe(false);
    expect(bad.issues?.map((i) => i.field)).toContain('title');
    expect(bad.issues?.map((i) => i.field)).toContain('end');
  });

  it('hands out increasing booking ids', () => {
    const store = freshStore();
    const a = store.book(input, TODAY, 600);
    const b = store.book({ ...input, date: '2026-10-16' }, TODAY, 600);
    expect(a.booking!.id).not.toBe(b.booking!.id);
    expect(b.booking!.id > a.booking!.id).toBe(true);
  });
});

describe('BookingStore.cancel', () => {
  it('cancels a confirmed booking and frees the slot', () => {
    const store = freshStore();
    const made = store.book(
      { resourceId: 'r-aud', title: 'Seminar', organizer: 'Clubs', date: '2026-10-20', start: '09:00', end: '11:00' },
      TODAY,
      600,
    );
    expect(made.ok).toBe(true);
    expect(store.cancel(made.booking!.id)).toBe(true);
    const rebook = store.book(
      { resourceId: 'r-aud', title: 'Different event', organizer: 'Clubs', date: '2026-10-20', start: '09:30', end: '10:30' },
      TODAY,
      600,
    );
    expect(rebook.ok).toBe(true);
  });

  it('refuses to cancel twice or an unknown id', () => {
    const store = freshStore();
    expect(store.cancel('b-9999')).toBe(false);
    const made = store.book(
      { resourceId: 'r-aud', title: 'Seminar', organizer: 'Clubs', date: '2026-10-20', start: '09:00', end: '11:00' },
      TODAY,
      600,
    );
    store.cancel(made.booking!.id);
    expect(store.cancel(made.booking!.id)).toBe(false);
  });

  it('keeps cancelled bookings visible in the list', () => {
    const store = freshStore();
    const made = store.book(
      { resourceId: 'r-aud', title: 'Seminar', organizer: 'Clubs', date: '2026-10-20', start: '09:00', end: '11:00' },
      TODAY,
      600,
    );
    store.cancel(made.booking!.id);
    expect(store.bookings.find((b) => b.id === made.booking!.id)?.status).toBe('cancelled');
  });
});

describe('upcoming and summarize', () => {
  it('lists confirmed bookings from today onwards, sorted', () => {
    const store = freshStore();
    store.book(
      { resourceId: 'r-aud', title: 'Later', organizer: 'A', date: addDays(TODAY, 5), start: '10:00', end: '11:00' },
      TODAY,
      600,
    );
    store.book(
      { resourceId: 'r-semA', title: 'Sooner', organizer: 'B', date: addDays(TODAY, 1), start: '10:00', end: '11:00' },
      TODAY,
      600,
    );
    const upcoming = store.upcoming(TODAY);
    expect(upcoming.map((b) => b.title)).toEqual(['Sooner', 'Later']);
  });

  it('summarizes counts, hours, and the busiest resource', () => {
    const store = freshStore();
    store.book(
      { resourceId: 'r-aud', title: 'Long day', organizer: 'A', date: '2026-10-20', start: '09:00', end: '17:00' },
      TODAY,
      600,
    );
    store.book(
      { resourceId: 'r-aud', title: 'Another', organizer: 'A', date: '2026-10-21', start: '09:00', end: '11:00' },
      TODAY,
      600,
    );
    const summary = store.summarize(TODAY);
    expect(summary.resources).toBe(8);
    expect(summary.activeBookings).toBe(2);
    expect(summary.upcoming).toBe(2);
    expect(summary.hoursBooked).toBe(10);
    expect(summary.topResourceName).toBe('Main Auditorium');
  });

  it('counts past bookings in hours but not in upcoming', () => {
    const store = new BookingStore(seedResources(), seedBookings(TODAY));
    const summary = store.summarize(TODAY);
    expect(summary.activeBookings).toBe(6); // 6 confirmed seeds, 1 cancelled
    expect(summary.upcoming).toBe(5); // one confirmed seed is in the past
  });
});

describe('persistence', () => {
  beforeEach(() => {
    const map = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
      removeItem: (key: string) => {
        map.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round trips a store through storage and keeps booking ids', () => {
    const store = freshStore();
    store.book(
      { resourceId: 'r-aud', title: 'Seminar', organizer: 'Clubs', date: '2026-10-20', start: '09:00', end: '11:00' },
      TODAY,
      600,
    );
    saveStore(store);
    const restored = loadStore();
    expect(restored).not.toBeNull();
    expect(restored!.resources).toHaveLength(8);
    expect(restored!.bookings).toHaveLength(1);
    expect(restored!.bookings[0].title).toBe('Seminar');
    // a restored store continues the id sequence instead of reusing it
    const again = restored!.book(
      { resourceId: 'r-aud', title: 'Second', organizer: 'Clubs', date: '2026-10-21', start: '09:00', end: '11:00' },
      TODAY,
      600,
    );
    expect(again.ok).toBe(true);
    expect(again.booking!.id).not.toBe(restored!.bookings[0].id);
  });

  it('returns null when nothing was saved', () => {
    expect(loadStore()).toBeNull();
  });

  it('returns null for corrupt JSON', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{oops', removeItem: () => {} });
    expect(loadStore()).toBeNull();
  });

  it('returns null when the resource list is empty', () => {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (key.includes('resources') ? '[]' : '[]'),
      removeItem: () => {},
    });
    expect(loadStore()).toBeNull();
  });

  it('drops malformed booking entries on load', () => {
    const store = freshStore();
    store.book(
      { resourceId: 'r-aud', title: 'Good', organizer: 'Clubs', date: '2026-10-20', start: '09:00', end: '11:00' },
      TODAY,
      600,
    );
    saveStore(store);
    const good = JSON.parse(localStorage.getItem('campus-booking-bookings-v1')!);
    good.push({ id: 'b-x', resourceId: 'r-aud', garbage: true });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) =>
        key.includes('resources')
          ? JSON.stringify(seedResources())
          : JSON.stringify(good),
      removeItem: () => {},
    });
    const restored = loadStore()!;
    expect(restored.bookings).toHaveLength(1);
  });

  it('clearStored removes both keys', () => {
    const store = freshStore();
    saveStore(store);
    clearStored();
    expect(loadStore()).toBeNull();
  });
});
