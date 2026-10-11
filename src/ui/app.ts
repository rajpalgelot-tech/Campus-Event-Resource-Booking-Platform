import type { Booking } from '../booking/types';
import { BookingStore, clearStored, loadStore, saveStore } from '../booking/store';
import { formatLong, nowMinutes, todayIso } from '../booking/dates';
import './styles.css';

const root = document.getElementById('app')!;
const today = todayIso();
const minute = nowMinutes();

const stored = loadStore();
const store = stored ?? new BookingStore();

let tab: 'resources' | 'bookings' = 'resources';
let resourceFilter = 'all';
let dateFilter = '';
let showCancelled = false;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setLog(message: string, kind: 'ok' | 'warn' | 'info'): void {
  refs.logLine.textContent = message;
  refs.logLine.className = `log-line ${kind}`;
}

function persist(): void {
  saveStore(store);
}

function slotLabel(b: Booking): string {
  return `${formatLong(b.date)}, ${b.start} to ${b.end}`;
}

function isFuture(b: Booking): boolean {
  return b.date >= today;
}

// ---------- static shell ----------

const refs = (() => {
  const shell = el('div', 'shell');
  const header = el('header', 'topbar');
  const titleBox = el('div');
  titleBox.append(el('h1', undefined, 'Campus Event Resource Booking'));
  titleBox.append(el('p', 'tagline', 'Reserve rooms and equipment for events without double booking anyone'));
  const actions = el('div', 'top-actions');
  const resetBtn = el('button', 'btn ghost danger', 'Reset demo data');
  const newBtn = el('button', 'btn primary', 'New booking');
  actions.append(resetBtn, newBtn);
  header.append(titleBox, actions);
  shell.append(header);

  const todayLine = el('p', 'today-line', `Today is ${formatLong(today)}. Bookings are saved in this browser.`);
  shell.append(todayLine);

  const cards = el('section', 'stat-cards');
  const labels = ['Resources', 'Active bookings', 'Upcoming', 'Hours reserved'];
  const statValues: HTMLElement[] = [];
  for (const label of labels) {
    const card = el('div', 'stat-card');
    const value = el('div', 'stat-value', '0');
    card.append(value, el('div', 'stat-label', label));
    cards.append(card);
    statValues.push(value);
  }
  shell.append(cards);

  const tabBar = el('div', 'tabs');
  const resourcesTabBtn = el('button', 'tab active', 'Resources');
  const bookingsTabBtn = el('button', 'tab', 'Bookings');
  tabBar.append(resourcesTabBtn, bookingsTabBtn);
  shell.append(tabBar);

  const resourcesPanel = el('section', 'resource-grid');
  const bookingsPanel = el('section', 'panel hidden');
  const bookingsHead = el('div', 'list-head');
  bookingsHead.append(el('h2', undefined, 'All bookings'));
  const filters = el('div', 'controls');
  const resourceSel = el('select', 'control') as HTMLSelectElement;
  const dateIn = el('input', 'control') as HTMLInputElement;
  dateIn.type = 'date';
  const cancelledLabel = el('label', 'check-label');
  const cancelledIn = el('input') as HTMLInputElement;
  cancelledIn.type = 'checkbox';
  cancelledLabel.append(cancelledIn, el('span', undefined, 'Show cancelled'));
  filters.append(resourceSel, dateIn, cancelledLabel);
  bookingsHead.append(filters);
  const bookingsList = el('div', 'booking-list');
  const bookingsEmpty = el('p', 'empty-hint hidden', 'No bookings match these filters.');
  bookingsPanel.append(bookingsHead, bookingsList, bookingsEmpty);
  shell.append(resourcesPanel, bookingsPanel);

  // modal form
  const modal = el('div', 'modal-backdrop hidden');
  const modalCard = el('div', 'modal');
  modalCard.append(el('h2', undefined, 'New booking'));
  const form = el('form', 'app-form');
  const resourceIn = el('select', 'field') as HTMLSelectElement;
  for (const r of store.resources) {
    const opt = el('option');
    opt.value = r.id;
    opt.textContent = `${r.name} (${r.type})`;
    resourceIn.append(opt);
  }
  const titleIn = el('input', 'field') as HTMLInputElement;
  titleIn.type = 'text';
  titleIn.placeholder = 'Event title';
  const organizerIn = el('input', 'field') as HTMLInputElement;
  organizerIn.type = 'text';
  organizerIn.placeholder = 'Organizer or club';
  const dateField = el('input', 'field') as HTMLInputElement;
  dateField.type = 'date';
  dateField.value = today;
  const timeRow = el('div', 'time-row');
  const startIn = el('input', 'field') as HTMLInputElement;
  startIn.type = 'time';
  startIn.value = '10:00';
  const endIn = el('input', 'field') as HTMLInputElement;
  endIn.type = 'time';
  endIn.value = '12:00';
  timeRow.append(startIn, el('span', 'time-sep', 'to'), endIn);
  const errorsBox = el('div', 'form-errors hidden');

  const rows: [string, HTMLElement][] = [
    ['Resource', resourceIn],
    ['Event', titleIn],
    ['Organizer', organizerIn],
    ['Date', dateField],
    ['Time', timeRow],
  ];
  for (const [label, input] of rows) {
    const row = el('label', 'form-row');
    row.append(el('span', 'form-label', label), input);
    form.append(row);
  }
  form.append(errorsBox);
  const formActions = el('div', 'form-actions');
  const cancelBtn = el('button', 'btn ghost', 'Cancel');
  cancelBtn.type = 'button';
  const saveBtn = el('button', 'btn primary', 'Confirm booking');
  formActions.append(cancelBtn, saveBtn);
  form.append(formActions);
  modalCard.append(form);
  modal.append(modalCard);
  shell.append(modal);

  const logLine = el('p', 'log-line info', 'Ready.');
  shell.append(logLine);
  root.replaceChildren(shell);

  return {
    resetBtn,
    newBtn,
    statValues,
    resourcesTabBtn,
    bookingsTabBtn,
    resourcesPanel,
    bookingsPanel,
    resourceSel,
    dateIn,
    cancelledIn,
    bookingsList,
    bookingsEmpty,
    modal,
    resourceIn,
    titleIn,
    organizerIn,
    dateField,
    startIn,
    endIn,
    errorsBox,
    cancelBtn,
    saveBtn,
    logLine,
  };
})();

// ---------- two step confirm ----------
// Confirm dialogs are blocked in some embedded browsers, so destructive
// buttons arm on the first click and fire on the second.

function makeArmable(button: HTMLButtonElement, baseLabel: string, armedLabel: string, action: () => void): void {
  let armed = false;
  let timer = 0;
  button.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      button.textContent = armedLabel;
      button.classList.add('armed');
      timer = window.setTimeout(() => {
        armed = false;
        button.textContent = baseLabel;
        button.classList.remove('armed');
        renderList();
      }, 3000);
      return;
    }
    window.clearTimeout(timer);
    armed = false;
    button.textContent = baseLabel;
    button.classList.remove('armed');
    action();
  });
}

// ---------- events ----------

function switchTab(next: 'resources' | 'bookings'): void {
  tab = next;
  refs.resourcesTabBtn.classList.toggle('active', tab === 'resources');
  refs.bookingsTabBtn.classList.toggle('active', tab === 'bookings');
  refs.resourcesPanel.classList.toggle('hidden', tab !== 'resources');
  refs.bookingsPanel.classList.toggle('hidden', tab !== 'bookings');
}

refs.resourcesTabBtn.addEventListener('click', () => switchTab('resources'));
refs.bookingsTabBtn.addEventListener('click', () => switchTab('bookings'));

function openModal(resourceId: string | null): void {
  refs.errorsBox.classList.add('hidden');
  if (resourceId !== null) refs.resourceIn.value = resourceId;
  refs.titleIn.value = '';
  refs.organizerIn.value = '';
  refs.dateField.value = today;
  refs.startIn.value = '10:00';
  refs.endIn.value = '12:00';
  refs.modal.classList.remove('hidden');
  refs.titleIn.focus();
}

refs.newBtn.addEventListener('click', () => openModal(null));
refs.cancelBtn.addEventListener('click', () => refs.modal.classList.add('hidden'));
refs.modal.addEventListener('click', (event) => {
  if (event.target === refs.modal) refs.modal.classList.add('hidden');
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') refs.modal.classList.add('hidden');
});

refs.saveBtn.addEventListener('click', () => {
  const result = store.book(
    {
      resourceId: refs.resourceIn.value,
      title: refs.titleIn.value,
      organizer: refs.organizerIn.value,
      date: refs.dateField.value,
      start: refs.startIn.value,
      end: refs.endIn.value,
    },
    today,
    minute,
  );
  if (!result.ok && result.issues) {
    refs.errorsBox.replaceChildren(...result.issues.map((i) => el('div', undefined, i.message)));
    refs.errorsBox.classList.remove('hidden');
    return;
  }
  if (!result.ok && result.conflict) {
    const c = result.conflict;
    const room = store.resourceById(c.resourceId)?.name ?? 'the resource';
    refs.errorsBox.replaceChildren(
      el(
        'div',
        undefined,
        `That slot clashes with "${c.title}" on ${room}, ${slotLabel(c)}. Pick another time or resource.`,
      ),
    );
    refs.errorsBox.classList.remove('hidden');
    return;
  }
  refs.modal.classList.add('hidden');
  persist();
  render();
  setLog(`Booked ${result.booking!.title} on ${store.resourceById(result.booking!.resourceId)?.name}`, 'ok');
});

refs.resourceSel.addEventListener('change', () => {
  resourceFilter = refs.resourceSel.value;
  renderList();
});
refs.dateIn.addEventListener('input', () => {
  dateFilter = refs.dateIn.value;
  renderList();
});
refs.cancelledIn.addEventListener('change', () => {
  showCancelled = refs.cancelledIn.checked;
  renderList();
});

makeArmable(refs.resetBtn, 'Reset demo data', 'Erase everything and start over?', () => {
  clearStored();
  const fresh = new BookingStore();
  store.resources = fresh.resources;
  store.bookings = fresh.bookings;
  persist();
  render();
  setLog('Demo data restored', 'ok');
});

// ---------- rendering ----------

function renderStats(): void {
  const s = store.summarize(today);
  const values = [String(s.resources), String(s.activeBookings), String(s.upcoming), `${s.hoursBooked}`];
  values.forEach((v, i) => {
    refs.statValues[i].textContent = v;
  });
}

function resourceBookingCount(id: string): number {
  return store.upcoming(today).filter((b) => b.resourceId === id).length;
}

function renderResources(): void {
  refs.resourcesPanel.replaceChildren(
    ...store.resources.map((r) => {
      const card = el('div', 'resource-card');
      const head = el('div', 'resource-head');
      head.append(el('h3', undefined, r.name), el('span', `type-badge ${r.type.toLowerCase()}`, r.type));
      card.append(head);
      card.append(el('p', 'resource-detail', r.detail));
      const facts = el('div', 'resource-facts');
      if (r.capacity !== null) facts.append(el('span', 'fact', `Capacity ${r.capacity}`));
      const upcomingCount = resourceBookingCount(r.id);
      facts.append(el('span', 'fact', upcomingCount === 0 ? 'No upcoming bookings' : `${upcomingCount} upcoming`));
      card.append(facts);
      const bookBtn = el('button', 'btn primary small', 'Book this');
      bookBtn.addEventListener('click', () => openModal(r.id));
      card.append(bookBtn);
      return card;
    }),
  );
}

function renderList(): void {
  const matches = store.bookings.filter((b) => {
    if (!showCancelled && b.status === 'cancelled') return false;
    if (resourceFilter !== 'all' && b.resourceId !== resourceFilter) return false;
    if (dateFilter !== '' && b.date !== dateFilter) return false;
    return true;
  });
  // upcoming first in date order, then past bookings most recent first
  const upcoming = matches
    .filter((b) => isFuture(b) && b.status === 'confirmed')
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const past = matches
    .filter((b) => !isFuture(b) || b.status === 'cancelled')
    .sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start));
  const ordered = [...upcoming, ...past];

  refs.bookingsEmpty.classList.toggle('hidden', ordered.length > 0);
  refs.bookingsList.replaceChildren(
    ...ordered.map((b) => {
      const card = el('div', `booking-card ${b.status === 'cancelled' ? 'is-cancelled' : ''} ${isFuture(b) ? '' : 'is-past'}`);
      const head = el('div', 'booking-head');
      const titleBox = el('div', 'booking-titlebox');
      titleBox.append(el('h3', undefined, b.title), el('p', 'booking-org', `by ${b.organizer}`));
      const badge = el('span', `status-badge ${b.status}`, b.status === 'confirmed' ? 'Confirmed' : 'Cancelled');
      head.append(titleBox, badge);
      card.append(head);
      const room = store.resourceById(b.resourceId);
      card.append(
        el(
          'p',
          'booking-where',
          `${room?.name ?? 'Unknown resource'} | ${slotLabel(b)}${isFuture(b) ? '' : ' | already over'}`,
        ),
      );
      if (b.status === 'confirmed') {
        const cancelBtn = el('button', 'btn ghost small danger', 'Cancel booking');
        makeArmable(cancelBtn, 'Cancel booking', 'Sure? Free the slot', () => {
          if (store.cancel(b.id)) {
            persist();
            render();
            setLog(`Cancelled ${b.title}; the slot is free again`, 'ok');
          }
        });
        card.append(cancelBtn);
      }
      return card;
    }),
  );
}

function renderResourceFilter(): void {
  const current = resourceFilter;
  refs.resourceSel.replaceChildren();
  const allOpt = el('option');
  allOpt.value = 'all';
  allOpt.textContent = 'All resources';
  refs.resourceSel.append(allOpt);
  for (const r of store.resources) {
    const opt = el('option');
    opt.value = r.id;
    opt.textContent = r.name;
    refs.resourceSel.append(opt);
  }
  refs.resourceSel.value = current;
}

function render(): void {
  renderStats();
  renderResources();
  renderResourceFilter();
  renderList();
}

render();
