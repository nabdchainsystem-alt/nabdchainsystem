import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FullCalendarModule, FullCalendarComponent } from '@fullcalendar/angular';
import { CalendarOptions, DateSelectArg, EventClickArg, EventDropArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { DEFAULT_CANVAS_STORAGE_KEY } from '../canvas-grid.component';

interface AgendaEvent {
  id: string;
  title: string;
  date: string;
  color?: string;
}

const LEGACY_STORAGE_KEY = 'ncs:agenda';
const STORAGE_SUFFIX = 'agenda';

function generateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

@Component({
  selector: 'ncs-agenda-block',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FullCalendarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="agenda-toolbar" *ngIf="showImportButton()">
      <button
        type="button"
        class="import"
        (click)="importFromHome()"
        [disabled]="!canImportFromHome()"
      >
        Import from Home
      </button>
    </div>
    <form class="agenda-form" [formGroup]="form" (ngSubmit)="addEvent()">
      <input
        formControlName="title"
        placeholder="Event title"
        aria-label="Event title"
        required
      />
      <input formControlName="date" type="date" aria-label="Event date" required />
      <select formControlName="color" aria-label="Event color">
        <option value="">Default</option>
        <option value="#3b82f6">Blue</option>
        <option value="#eab308">Gold</option>
        <option value="#10b981">Green</option>
        <option value="#ef4444">Red</option>
      </select>
      <button type="submit">Add</button>
    </form>

    <full-calendar
      #calendar
      [options]="calendarOptions()"
      class="agenda-calendar"
    ></full-calendar>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-height: 100%;
        height: 100%;
      }
      .agenda-form {
        display: grid;
        grid-template-columns: minmax(160px, 2fr) minmax(140px, 1fr) 140px auto;
        gap: 8px;
        align-items: center;
        margin: 0;
      }
      .agenda-toolbar {
        display:flex;
        justify-content:flex-end;
      }
      .agenda-toolbar .import{
        border:1px solid #cbd5f5;
        background:#f1f5f9;
        color:#1f2937;
        font-size:12px;
        border-radius:8px;
        padding:4px 12px;
        cursor:pointer;
        transition:background .18s ease,border-color .18s ease;
      }
      .agenda-toolbar .import:hover:not(:disabled){
        background:#e2e8f0;
        border-color:#94a3b8;
      }
      .agenda-toolbar .import:disabled{
        opacity:.5;
        cursor:not-allowed;
      }
      .agenda-form input,
      .agenda-form select {
        padding: 6px 8px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 12px;
      }
      .agenda-form input:focus,
      .agenda-form select:focus {
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.16);
        outline: none;
      }
      .agenda-form button {
        padding: 6px 12px;
        border-radius: 8px;
        border: none;
        background: #2563eb;
        color: #fff;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .agenda-calendar {
        width: 100%;
        flex: 1;
      }
      :host ::ng-deep .fc {
        font-size: 12px;
      }
      :host ::ng-deep .fc .fc-toolbar-title {
        font-size: 16px;
        font-weight: 600;
        color: #0f172a;
      }
      :host ::ng-deep .fc .fc-button {
        border-radius: 8px;
        background: #f1f5f9;
        border: 1px solid #cbd5f5;
        color: #1f2937;
        padding: 4px 10px;
        font-size: 11px;
        text-transform: capitalize;
      }
      :host ::ng-deep .fc .fc-button-primary:not(:disabled).fc-button-active,
      :host ::ng-deep .fc .fc-button-primary:not(:disabled):active,
      :host ::ng-deep .fc .fc-button-primary:hover {
        background: #2563eb;
        border-color: #2563eb;
        color: #fff;
      }
      :host ::ng-deep .fc-daygrid-day {
        border: 1px solid #e2e8f0;
      }
      :host ::ng-deep .fc-daygrid-day.fc-day-today {
        background: #eff6ff;
      }
      @media (max-width: 960px) {
        .agenda-form {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `,
  ],
})
export class AgendaBlockComponent implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly fb = inject(FormBuilder);
  @ViewChild('calendar', { static: false }) calendar?: FullCalendarComponent;
  private resizeObserver?: ResizeObserver;
  private readonly storageKey = this.resolveStorageKey();
  private readonly homeStorageKey = `${DEFAULT_CANVAS_STORAGE_KEY}.${STORAGE_SUFFIX}`;
  private readonly isHomeContext = this.storageKey === this.homeStorageKey;

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    date: [''],
    color: [''],
  });

  private readonly eventsSignal = signal<AgendaEvent[]>(this.load());
  readonly showImportButton = computed(() => !this.isHomeContext);

  readonly calendarOptions = computed<CalendarOptions>(() => ({
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: '',
    },
    selectable: true,
    events: this.eventsSignal().map((event) => ({
      id: event.id,
      title: event.title,
      start: event.date,
      display: 'block',
      backgroundColor: event.color,
      borderColor: event.color,
    })),
    select: (selection) => this.handleSelect(selection),
    eventDrop: (arg) => this.handleEventDrop(arg),
    eventClick: (arg) => this.handleEventClick(arg),
    height: 'auto',
  }));

  constructor() {
    effect(() => {
      const value = this.eventsSignal();
      localStorage.setItem(this.storageKey, JSON.stringify(value));
      this.emitContentChange('agenda');
    });
  }

  ngAfterViewInit(): void {
    this.updateCalendarSize();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateCalendarSize();
        this.emitContentChange('agenda');
      });
      this.resizeObserver.observe(this.host.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  addEvent() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { title, date, color } = this.form.getRawValue();
    if (!date) {
      return;
    }
    const event: AgendaEvent = {
      id: generateId(),
      title: title.trim(),
      date,
      color: color || undefined,
    };
    this.eventsSignal.update((current) => [event, ...current]);
    this.form.reset({ title: '', date: '', color: '' });
  }

  private handleSelect(selection: DateSelectArg) {
    this.form.patchValue({ date: selection.startStr });
  }

  private handleEventDrop(arg: EventDropArg) {
    const date = arg.event.startStr;
    if (!date) {
      return;
    }
    this.eventsSignal.update((current) =>
      current.map((event) => (event.id === arg.event.id ? { ...event, date } : event)),
    );
  }

  private handleEventClick(arg: EventClickArg) {
    if (confirm(`Delete event "${arg.event.title}"?`)) {
      this.eventsSignal.update((current) => current.filter((event) => event.id !== arg.event.id));
    }
  }

  private load(): AgendaEvent[] {
    return this.readFromKey(this.storageKey, this.isHomeContext);
  }

  private seedEvents(): AgendaEvent[] {
    const today = new Date();
    const fmt = (offset: number) => {
      const date = new Date(today);
      date.setDate(date.getDate() + offset);
      return date.toISOString().slice(0, 10);
    };
    return [
      { id: generateId(), title: 'Executive Sync', date: fmt(1), color: '#3b82f6' },
      { id: generateId(), title: 'Supplier Check-in', date: fmt(2), color: '#eab308' },
      { id: generateId(), title: 'Spend Review', date: fmt(5), color: '#10b981' },
    ];
  }

  private emitContentChange(kind: string) {
    const element = this.host.nativeElement;
    window.dispatchEvent(
      new CustomEvent('ncs:block-content-changed', {
        detail: { kind, element },
      }),
    );
  }

  private updateCalendarSize() {
    this.calendar?.getApi().updateSize();
  }

  importFromHome() {
    if (this.isHomeContext) {
      return;
    }
    const snapshot = this.readFromKey(this.homeStorageKey);
    if (!snapshot.length) {
      return;
    }
    this.eventsSignal.set(snapshot);
    this.updateCalendarSize();
  }

  canImportFromHome() {
    if (this.isHomeContext) {
      return false;
    }
    try {
      const raw = localStorage.getItem(this.homeStorageKey) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
      return !!raw && raw !== '[]';
    } catch {
      return false;
    }
  }

  private resolveStorageKey() {
    const gridItem = this.host.nativeElement.closest('.grid-stack-item') as HTMLElement | null;
    const base = gridItem?.dataset['storageKey'] ?? DEFAULT_CANVAS_STORAGE_KEY;
    return `${base}.${STORAGE_SUFFIX}`;
  }

  private readFromKey(key: string, allowLegacy = false): AgendaEvent[] {
    try {
      let raw = localStorage.getItem(key);
      if (!raw && allowLegacy && key === this.homeStorageKey) {
        raw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (raw) {
          localStorage.setItem(key, raw);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
      }
      if (!raw) {
        return key === this.homeStorageKey ? this.seedEvents() : [];
      }
      const parsed = JSON.parse(raw) as AgendaEvent[];
      if (!Array.isArray(parsed)) {
        return key === this.homeStorageKey ? this.seedEvents() : [];
      }
      return parsed.map((event) => ({
        id: event.id ?? generateId(),
        title: event.title ?? 'Untitled event',
        date: event.date ?? new Date().toISOString().slice(0, 10),
        color: event.color,
      }));
    } catch {
      return key === this.homeStorageKey ? this.seedEvents() : [];
    }
  }
}
