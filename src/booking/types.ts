export type ResourceType = 'Room' | 'Equipment';

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  detail: string;
  /** Seating capacity for rooms, null for equipment. */
  capacity: number | null;
}

export type BookingStatus = 'confirmed' | 'cancelled';

export interface Booking {
  id: string;
  resourceId: string;
  title: string;
  organizer: string;
  /** Event date in YYYY-MM-DD format. */
  date: string;
  /** Start time in HH:MM, 24 hour clock. */
  start: string;
  /** End time in HH:MM, 24 hour clock. */
  end: string;
  status: BookingStatus;
}

export interface BookingInput {
  resourceId: string;
  title: string;
  organizer: string;
  date: string;
  start: string;
  end: string;
}

export interface Issue {
  field: string;
  message: string;
}
