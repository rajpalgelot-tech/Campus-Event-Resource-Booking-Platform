import type { Booking, BookingInput, Issue, Resource } from './types';
import { bookingMinutes, findConflict, validateBooking } from './scheduler';
import { addDays, todayIso } from './dates';

export interface BookResult {
  ok: boolean;
  booking?: Booking;
  issues?: Issue[];
  conflict?: Booking;
}

export interface Summary {
  resources: number;
  activeBookings: number;
  upcoming: number;
  hoursBooked: number;
  topResourceId: string | null;
  topResourceName: string | null;
}

const RES_KEY = 'campus-booking-resources-v1';
const BOOK_KEY = 'campus-booking-bookings-v1';

export function seedResources(): Resource[] {
  return [
    { id: 'r-aud', name: 'Main Auditorium', type: 'Room', detail: 'Block A, ground floor', capacity: 300 },
    { id: 'r-semA', name: 'Seminar Hall A', type: 'Room', detail: 'Block B, first floor', capacity: 60 },
    { id: 'r-semB', name: 'Seminar Hall B', type: 'Room', detail: 'Block B, second floor', capacity: 40 },
    { id: 'r-lab', name: 'Computer Lab 2', type: 'Room', detail: 'IT building, third floor', capacity: 30 },
    { id: 'r-meet', name: 'Meeting Room 1', type: 'Room', detail: 'Admin block', capacity: 10 },
    { id: 'r-proj', name: 'Projector Kit 1', type: 'Equipment', detail: 'Portable HDMI projector', capacity: null },
    { id: 'r-sound', name: 'PA Sound System', type: 'Equipment', detail: 'Speakers with two microphones', capacity: null },
    { id: 'r-cam', name: 'Camera Kit', type: 'Equipment', detail: 'DSLR with a tripod', capacity: null },
  ];
}

export function seedBookings(today: string): Booking[] {
  let n = 0;
  const mk = (
    resourceId: string,
    title: string,
    organizer: string,
    date: string,
    start: string,
    end: string,
    status: Booking['status'],
  ): Booking => {
    n += 1;
    return { id: `b-${n}`, resourceId, title, organizer, date, start, end, status };
  };
  return [
    mk('r-aud', 'Annual tech fest inauguration', 'Student Council', addDays(today, 3), '09:00', '12:00', 'confirmed'),
    mk('r-semA', 'Resume building workshop', 'Placement Cell', addDays(today, 1), '10:00', '12:00', 'confirmed'),
    mk('r-semB', 'AI study circle', 'Coders Club', today, '14:00', '16:00', 'confirmed'),
    mk('r-proj', 'Project expo setup', 'Robotics Club', addDays(today, 2), '09:00', '13:00', 'confirmed'),
    mk('r-sound', 'Cultural night practice', 'Music Club', addDays(today, 4), '15:00', '18:00', 'confirmed'),
    mk('r-lab', 'Hackathon warm up', 'Coders Club', addDays(today, -2), '10:00', '16:00', 'confirmed'),
    mk('r-meet', 'Old committee meeting', 'Student Council', addDays(today, -1), '11:00', '12:00', 'cancelled'),
  ];
}

export class BookingStore {
  resources: Resource[];
  bookings: Booking[];
  private nextId: number;

  constructor(resources?: Resource[], bookings?: Booking[]) {
    this.resources = resources ?? seedResources();
    this.bookings = bookings ?? seedBookings(todayIso());
    this.nextId = maxBookingNumber(this.bookings) + 1;
  }

  resourceById(id: string): Resource | undefined {
    return this.resources.find((r) => r.id === id);
  }

  /** Validates, checks clashes, then confirms the booking. */
  book(input: Partial<BookingInput>, today: string, currentMinute: number): BookResult {
    const issues = validateBooking(
      input,
      today,
      currentMinute,
      this.resources.map((r) => r.id),
    );
    if (issues.length > 0) return { ok: false, issues };
    const slot = {
      resourceId: input.resourceId!,
      date: input.date!,
      start: input.start!,
      end: input.end!,
    };
    const conflict = findConflict(this.bookings, slot);
    if (conflict) return { ok: false, conflict };
    const booking: Booking = {
      id: `b-${this.nextId}`,
      resourceId: slot.resourceId,
      title: input.title!.trim(),
      organizer: input.organizer!.trim(),
      date: slot.date,
      start: slot.start,
      end: slot.end,
      status: 'confirmed',
    };
    this.nextId += 1;
    this.bookings = [...this.bookings, booking];
    return { ok: true, booking };
  }

  /** Cancels a confirmed booking; cancelling twice or an unknown id fails. */
  cancel(id: string): boolean {
    const b = this.bookings.find((x) => x.id === id && x.status === 'confirmed');
    if (!b) return false;
    b.status = 'cancelled';
    return true;
  }

  confirmed(): Booking[] {
    return this.bookings.filter((b) => b.status === 'confirmed');
  }

  /** Confirmed bookings from today onwards, soonest first. */
  upcoming(today: string): Booking[] {
    return this.confirmed()
      .filter((b) => b.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  }

  summarize(today: string): Summary {
    const confirmed = this.confirmed();
    const upcoming = confirmed.filter((b) => b.date >= today);
    const minutes = confirmed.reduce((sum, b) => sum + bookingMinutes(b), 0);
    const counts = new Map<string, number>();
    for (const b of confirmed) {
      counts.set(b.resourceId, (counts.get(b.resourceId) ?? 0) + 1);
    }
    let topId: string | null = null;
    for (const [id, count] of counts) {
      if (topId === null || count > counts.get(topId)!) topId = id;
    }
    return {
      resources: this.resources.length,
      activeBookings: confirmed.length,
      upcoming: upcoming.length,
      hoursBooked: Math.round((minutes / 60) * 10) / 10,
      topResourceId: topId,
      topResourceName: topId === null ? null : (this.resourceById(topId)?.name ?? null),
    };
  }
}

function maxBookingNumber(bookings: Booking[]): number {
  let max = 0;
  for (const b of bookings) {
    const n = Number(b.id.slice(2));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

export function saveStore(store: BookingStore): void {
  try {
    localStorage.setItem(RES_KEY, JSON.stringify(store.resources));
    localStorage.setItem(BOOK_KEY, JSON.stringify(store.bookings));
  } catch {
    // Storage can be unavailable; the app keeps working in memory.
  }
}

function isBooking(value: unknown): value is Booking {
  const v = value as Booking;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.id === 'string' &&
    typeof v.resourceId === 'string' &&
    typeof v.title === 'string' &&
    typeof v.organizer === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.date ?? '') &&
    /^\d{2}:\d{2}$/.test(v.start ?? '') &&
    /^\d{2}:\d{2}$/.test(v.end ?? '') &&
    (v.status === 'confirmed' || v.status === 'cancelled')
  );
}

export function loadStore(): BookingStore | null {
  try {
    const resRaw = localStorage.getItem(RES_KEY);
    const bookRaw = localStorage.getItem(BOOK_KEY);
    if (!resRaw || !bookRaw) return null;
    const resources: unknown = JSON.parse(resRaw);
    const bookings: unknown = JSON.parse(bookRaw);
    if (!Array.isArray(resources) || !Array.isArray(bookings)) return null;
    if (resources.length === 0) return null;
    return new BookingStore(resources as Resource[], bookings.filter(isBooking));
  } catch {
    return null;
  }
}

export function clearStored(): void {
  try {
    localStorage.removeItem(RES_KEY);
    localStorage.removeItem(BOOK_KEY);
  } catch {
    // ignore
  }
}
