import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { DEFAULT_CANVAS_STORAGE_KEY } from '../canvas-grid.component';

export interface SubtaskItem {
  id: string;
  title: string;
  done?: boolean;
}

const LEGACY_STORAGE_KEY = 'ncs:subtasks';
const STORAGE_SUFFIX = 'subtasks';

function generateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

@Component({
  selector: 'ncs-subtasks-block',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, DragDropModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="subtasks-container">
      <div class="subtasks-toolbar" *ngIf="showImportButton()">
        <button
          type="button"
          class="import"
          (click)="importFromHome()"
          [disabled]="!canImportFromHome()"
        >
          Import from Home
        </button>
      </div>
      <form class="add-form" [formGroup]="form" (ngSubmit)="addSubtask()">
        <input
          formControlName="title"
          placeholder="Add subtask"
          aria-label="Subtask title"
          required
        />
        <button type="submit">Add</button>
      </form>

      <div
        class="subtasks-list"
        cdkDropList
        [cdkDropListData]="subtasks()"
        (cdkDropListDropped)="reorder($event)"
      >
        <div class="subtask-row" *ngFor="let subtask of subtasks(); trackBy: trackById" cdkDrag>
          <span
            class="drag-handle"
            cdkDragHandle
            aria-hidden="true"
          >⋮⋮</span>
          <input
            type="checkbox"
            [checked]="subtask.done"
            (change)="toggleDone(subtask.id, $any($event.target).checked)"
            aria-label="Toggle subtask"
          />
          <input
            class="subtask-title"
            [value]="subtask.title"
            (change)="updateSubtask(subtask.id, $any($event.target).value)"
            placeholder="Subtask"
            aria-label="Subtask title"
          />
          <button class="delete" type="button" (click)="removeSubtask(subtask.id)" aria-label="Delete subtask">
            ✕
          </button>
        </div>
        <p *ngIf="subtasks().length === 0" class="empty-state">No subtasks yet.</p>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 100%;
        height: 100%;
      }
      .add-form {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 64px;
        gap: 6px;
        margin: 0;
      }
      .subtasks-toolbar {
        display:flex;
        justify-content:flex-end;
      }
      .subtasks-toolbar .import{
        border:1px solid #cbd5f5;
        background:#f1f5f9;
        color:#1f2937;
        font-size:12px;
        border-radius:8px;
        padding:4px 12px;
        cursor:pointer;
        transition:background .18s ease,border-color .18s ease;
      }
      .subtasks-toolbar .import:hover:not(:disabled){
        background:#e2e8f0;
        border-color:#94a3b8;
      }
      .subtasks-toolbar .import:disabled{
        opacity:.5;
        cursor:not-allowed;
      }
      .add-form input {
        padding: 6px 8px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 12px;
      }
      .add-form input:focus {
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.16);
        outline: none;
      }
      .add-form button {
        padding: 6px 10px;
        border-radius: 8px;
        border: none;
        background: #2563eb;
        color: #fff;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .add-form button:hover {
        background: #1d4ed8;
      }
      .add-form button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .subtasks-list {
        display: grid;
        gap: 6px;
        flex: 1;
        overflow: auto;
        padding-right: 2px;
        min-height: 0;
      }
      .subtask-row {
        display: grid;
        grid-template-columns: 12px 16px minmax(0, 1fr) 22px;
        gap: 8px;
        align-items: center;
        padding: 6px 8px;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        background: #fff;
      }
      .subtask-row cdk-drag-placeholder {
        display: block;
        height: 38px;
        border-radius: 12px;
        background: rgba(99, 102, 241, 0.12);
        border: 1px dashed rgba(99, 102, 241, 0.3);
      }
      .subtasks-list.cdk-drop-list-dragging .subtask-row:not(.cdk-drag-placeholder) {
        transition: transform 150ms ease;
      }
      .subtask-row.cdk-drag-preview {
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
        border-radius: 12px;
      }
      .drag-handle {
        cursor: grab;
        color: #94a3b8;
        font-size: 12px;
      }
      .subtask-row input[type='checkbox'] {
        cursor: pointer;
      }
      .subtask-title {
        width: 100%;
        padding: 6px 8px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 12px;
      }
      .subtask-title:focus {
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
        outline: none;
      }
      .delete {
        border: none;
        background: transparent;
        font-size: 14px;
        color: #ef4444;
        cursor: pointer;
      }
      .delete:hover {
        color: #b91c1c;
      }
      .empty-state {
        margin: 0;
        padding: 16px;
        text-align: center;
        font-size: 12px;
        color: #94a3b8;
        border: 1px dashed #cbd5f5;
        border-radius: 10px;
        background: #f8fafc;
      }
    `,
  ],
})
export class SubtasksBlockComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly fb = inject(FormBuilder);
  private readonly storageKey = this.resolveStorageKey();
  private readonly homeStorageKey = `${DEFAULT_CANVAS_STORAGE_KEY}.${STORAGE_SUFFIX}`;
  private readonly isHomeContext = this.storageKey === this.homeStorageKey;

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
  });

  readonly subtasks = signal<SubtaskItem[]>(this.load());
  readonly showImportButton = computed(() => !this.isHomeContext);

  constructor() {
    effect(() => {
      const value = this.subtasks();
      localStorage.setItem(this.storageKey, JSON.stringify(value));
      this.emitContentChange();
    });
  }

  addSubtask() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const title = this.form.controls.title.value.trim();
    if (!title) {
      return;
    }
    const subtask: SubtaskItem = { id: generateId(), title, done: false };
    this.subtasks.update((current) => [subtask, ...current]);
    this.form.reset({ title: '' });
  }

  toggleDone(id: string, done: boolean) {
    this.subtasks.update((current) =>
      current.map((item) => (item.id === id ? { ...item, done } : item)),
    );
  }

  updateSubtask(id: string, title: string) {
    const cleaned = title.trim();
    this.subtasks.update((current) =>
      current.map((item) => (item.id === id ? { ...item, title: cleaned || item.title } : item)),
    );
  }

  removeSubtask(id: string) {
    this.subtasks.update((current) => current.filter((item) => item.id !== id));
  }

  reorder(event: CdkDragDrop<SubtaskItem[]>) {
    this.subtasks.update((current) => {
      const copy = [...current];
      moveItemInArray(copy, event.previousIndex, event.currentIndex);
      return copy;
    });
  }

  trackById(_index: number, item: SubtaskItem) {
    return item.id;
  }

  private load(): SubtaskItem[] {
    return this.readFromKey(this.storageKey, this.isHomeContext);
  }

  private emitContentChange() {
    const element = this.host.nativeElement;
    window.dispatchEvent(
      new CustomEvent('ncs:block-content-changed', {
        detail: { kind: 'subtasks', element },
      }),
    );
  }

  importFromHome() {
    if (this.isHomeContext) {
      return;
    }
    const snapshot = this.readFromKey(this.homeStorageKey);
    if (!snapshot.length) {
      return;
    }
    this.subtasks.set(snapshot);
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

  private readFromKey(key: string, allowLegacy = false): SubtaskItem[] {
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
        return [];
      }
      const parsed = JSON.parse(raw) as SubtaskItem[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map((item) => ({
        id: item.id ?? generateId(),
        title: item.title ?? 'Untitled subtask',
        done: item.done ?? false,
      }));
    } catch {
      return [];
    }
  }
}
