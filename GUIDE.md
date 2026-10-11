# Guide

A short walkthrough of the Campus Event Resource Booking Platform. Open the [live demo](https://rajpalgelot-tech.github.io/Campus-Event-Resource-Booking-Platform/) and follow along.

## The two tabs

- **Resources** shows everything the campus can lend out: rooms with their capacity and location, and equipment kits.
- **Bookings** shows every booking with filters for resource and date.

The cards at the top always show the current totals: resources, active bookings, upcoming bookings, and total hours reserved.

## Making a booking

1. On the Resources tab, find the room or kit you need and click **Book this**. The form opens with that resource preselected. (You can also use **New booking** and pick the resource in the form.)
2. Enter the event title and the organizer, for example a club or department name. Both are required.
3. Pick the date. Past dates are refused, and if the date is today the start time must still be in the future.
4. Set the start and end times in 24 hour format.
5. Click **Confirm booking**.

If anything is wrong, the form shows the exact problems above the buttons and nothing is saved.

## What happens on a clash

If another confirmed booking already holds that resource for an overlapping time, the form refuses and explains:

```
That slot clashes with "Resume building workshop" on Seminar Hall A,
Oct 12, 2026, 10:00 to 12:00. Pick another time or resource.
```

Two useful details:

- **Back to back is fine.** A booking from 12:00 to 13:00 does not clash with one from 10:00 to 12:00, because the second starts exactly when the first ends.
- **Different resources never clash.** Booking the auditorium and Seminar Hall B at the same time is normal.

## Cancelling a booking

On the Bookings tab, every confirmed booking has a **Cancel booking** button. The first click arms it (**Sure? Free the slot**) and the second click cancels. Cancelled bookings free their slot immediately, so someone else can book the same time. They stay in the list crossed out when **Show cancelled** is on; this keeps a record of what happened.

## Finding bookings

Above the list:

- The **resource dropdown** shows only one room's or kit's bookings.
- The **date box** shows only that day.
- Upcoming bookings are listed first in date order; bookings that are already over appear after them, slightly dimmed.

## Starting over

**Reset demo data** (top right) erases everything and restores the sample resources and bookings. It also needs a confirming second click, since it wipes anything you added.

## Where the data lives

Resources and bookings are stored in your browser's `localStorage`. Closing the tab keeps everything; clearing site data or clicking Reset demo data removes it. Nothing leaves your machine.

## Running it yourself

```bash
npm install
npm run dev
```

Then open the printed local URL. The test suite runs with `npm test`.
