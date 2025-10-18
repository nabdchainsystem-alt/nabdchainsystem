import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { DEFAULT_CANVAS_STORAGE_KEY } from '../canvas-grid.component';

type TaskStatus = 'Todo' | 'In Progress' | 'Done';

export interface TaskItem {
  id: string;
  title: string;
  assignee?: string;
  status: TaskStatus;
  due?: string;
  done?: boolean;
}

const LEGACY_STORAGE_KEY = 'ncs:tasks';
const STORAGE_SUFFIX = 'tasks';
const STATUSES: TaskStatus[] = ['Todo', 'In Progress', 'Done'];

function generateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

@Component({
  selector: 'ncs-tasks-block',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, DragDropModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tasks-container">
      <div class="tasks-toolbar" *ngIf="showImportButton()">
        <button
          type="button"
          class="import"
          (click)="importFromHome()"
          [disabled]="!canImportFromHome()"
        >
          Import from Home
        </button>
      </div>
      <form class="tasks-form" [formGroup]="form" (ngSubmit)="addTask()">
        <input
          formControlName="title"
          placeholder="Task title"
          aria-label="Task title"
          required
        />
        <input
          formControlName="assignee"
          placeholder="Assignee"
          aria-label="Assignee"
        />
        <select formControlName="status" aria-label="Status">
          <option *ngFor="let status of statuses" [value]="status">{{ status }}</option>
        </select>
        <input formControlName="due" type="date" aria-label="Due date" />
        <button type="submit">Add</button>
      </form>

      <div cdkDropList class="tasks-list" (cdkDropListDropped)="reorder($event)" [cdkDropListData]="tasks()">
        <div class="task-row" *ngFor="let task of tasks(); trackBy: trackById" cdkDrag>
          <span
            class="drag-handle"
            cdkDragHandle
            aria-hidden="true"
          >⋮⋮</span>
          <input
            type="checkbox"
            [checked]="task.done"
            (change)="toggleDone(task.id, $any($event.target).checked)"
            aria-label="Mark task complete"
          />
          <input
            class="task-title"
            [value]="task.title"
            (change)="updateTask(task.id, { title: $any($event.target).value })"
            placeholder="Title"
            aria-label="Task title"
          />
          <input
            class="task-assignee"
            [value]="task.assignee ?? ''"
            (change)="updateTask(task.id, { assignee: $any($event.target).value })"
            placeholder="Assignee"
            aria-label="Task assignee"
          />
          <select
            class="task-status"
            [value]="task.status"
            (change)="changeStatus(task.id, $any($event.target).value)"
            aria-label="Task status"
          >
            <option *ngFor="let status of statuses" [value]="status">{{ status }}</option>
          </select>
          <input
            type="date"
            class="task-due"
            [value]="task.due ?? ''"
            (change)="updateTask(task.id, { due: $any($event.target).value })"
            aria-label="Task due date"
          />
          <button class="delete" type="button" (click)="removeTask(task.id)" aria-label="Delete task">
            ✕
          </button>
        </div>
        <p *ngIf="tasks().length === 0" class="empty-state">No tasks yet. Add one above.</p>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-height: 100%;
        height: 100%;
      }
      .tasks-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: min(720px, 100%);
      }
      .tasks-toolbar {
        display: flex;
        justify-content: flex-end;
      }
      .tasks-toolbar .import {
        border: 1px solid #cbd5f5;
        background: #f1f5f9;
        color: #1f2937;
        font-size: 12px;
        border-radius: 8px;
        padding: 4px 12px;
        cursor: pointer;
        transition: background 0.18s ease, border-color 0.18s ease;
      }
      .tasks-toolbar .import:hover:not(:disabled) {
        background: #e2e8f0;
        border-color: #94a3b8;
      }
      .tasks-toolbar .import:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
     .tasks-form {
        display: grid;
        grid-template-columns: minmax(140px, 1fr) minmax(120px, 1fr) 110px 110px 64px;
        gap: 6px;
        margin: 0;
        align-items: center;
      }
      .tasks-form input,
      .tasks-form select {
        padding: 6px 8px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 12px;
        outline: none;
      }
      .tasks-form input:focus,
      .tasks-form select:focus {
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.16);
      }
      .tasks-form button[type='submit'] {
        padding: 6px 12px;
        border-radius: 8px;
        border: none;
        background: #1d4ed8;
        color: #fff;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .tasks-form button[type='submit']:hover {
        background: #1e3a8a;
      }
      .tasks-form button[type='submit']:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .tasks-list {
        display: grid;
        gap: 6px;
        flex: 1;
        overflow: auto;
        padding-right: 2px;
        min-height: 0;
      }
      .task-row {
        display: grid;
        grid-template-columns: 12px 16px minmax(0, 1fr) minmax(110px, 1fr) 110px 110px 22px;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        background: #fff;
      }
      .task-row cdk-drag-placeholder {
        display: block;
        height: 40px;
        border-radius: 12px;
        background: rgba(99, 102, 241, 0.12);
        border: 1px dashed rgba(99, 102, 241, 0.3);
      }
      .tasks-list.cdk-drop-list-dragging .task-row:not(.cdk-drag-placeholder) {
        transition: transform 150ms ease;
      }
      .task-row.cdk-drag-preview {
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
        border-radius: 12px;
      }
      .drag-handle {
        cursor: grab;
        color: #94a3b8;
        font-size: 12px;
      }
      .task-row input[type='checkbox'] {
        cursor: pointer;
      }
      .task-row input:not([type='checkbox']),
      .task-row select {
        width: 100%;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 6px 8px;
        font-size: 12px;
      }
      .task-row input:not([type='checkbox']):focus,
      .task-row select:focus {
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
        outline: none;
      }
      .task-row .delete {
        border: none;
        background: transparent;
        color: #ef4444;
        font-size: 12px;
        cursor: pointer;
      }
      .task-row .delete:hover {
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
      @media (max-width: 960px) {
        .tasks-form {
          grid-template-columns: repeat(2, 1fr);
        }
        .task-row {
          grid-template-columns: 14px 18px repeat(3, minmax(120px, 1fr)) 26px;
        }
      }
    `,
  ],
})
export class TasksBlockComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly fb = inject(FormBuilder);
  private readonly storageKey = this.resolveStorageKey();
  private readonly homeStorageKey = `${DEFAULT_CANVAS_STORAGE_KEY}.${STORAGE_SUFFIX}`;
  private readonly isHomeContext = this.storageKey === this.homeStorageKey;

  readonly statuses = STATUSES;
  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    assignee: [''],
    status: ['Todo' as TaskStatus],
    due: [''],
  });

  readonly tasks = signal<TaskItem[]>(this.load());
  readonly showImportButton = computed(() => !this.isHomeContext);

  constructor() {
    effect(() => {
      const value = this.tasks();
      localStorage.setItem(this.storageKey, JSON.stringify(value));
      this.emitContentChange();
    });
  }

  addTask() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const task: TaskItem = {
      id: generateId(),
      title: value.title.trim(),
      assignee: value.assignee?.trim() || undefined,
      status: value.status,
      due: value.due || undefined,
      done: false,
    };
    this.tasks.update((current) => [task, ...current]);
    this.form.reset({ title: '', assignee: '', status: 'Todo', due: '' });
  }

  toggleDone(id: string, done: boolean) {
    this.updateTask(id, { done, status: done ? 'Done' : 'Todo' });
  }

  updateTask(id: string, patch: Partial<TaskItem>) {
    this.tasks.update((current) =>
      current.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    );
  }

  removeTask(id: string) {
    this.tasks.update((current) => current.filter((task) => task.id !== id));
  }

  reorder(event: CdkDragDrop<TaskItem[]>) {
    this.tasks.update((current) => {
      const copy = [...current];
      moveItemInArray(copy, event.previousIndex, event.currentIndex);
      return copy;
    });
  }

  changeStatus(id: string, value: string) {
    if ((STATUSES as readonly string[]).includes(value)) {
      this.updateTask(id, { status: value as TaskStatus });
    }
  }

  importFromHome() {
    if (this.isHomeContext) {
      return;
    }
    const snapshot = this.readFromKey(this.homeStorageKey);
    if (!snapshot.length) {
      return;
    }
    this.tasks.set(snapshot);
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

  trackById(_index: number, task: TaskItem) {
    return task.id;
  }

  private load(): TaskItem[] {
    const snapshot = this.readFromKey(this.storageKey, this.isHomeContext);
    return snapshot;
  }

  private emitContentChange() {
    const element = this.host.nativeElement;
    window.dispatchEvent(
      new CustomEvent('ncs:block-content-changed', {
        detail: { kind: 'tasks', element },
      }),
    );
  }

  private resolveStorageKey() {
    const gridItem = this.host.nativeElement.closest('.grid-stack-item') as HTMLElement | null;
    const base = gridItem?.dataset['storageKey'] ?? DEFAULT_CANVAS_STORAGE_KEY;
    return `${base}.${STORAGE_SUFFIX}`;
  }

  private readFromKey(key: string, allowLegacy = false): TaskItem[] {
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
      const parsed = JSON.parse(raw) as TaskItem[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map((task) => ({
        id: task.id ?? generateId(),
        title: task.title ?? 'Untitled task',
        assignee: task.assignee,
        status: (STATUSES.includes(task.status as TaskStatus)
          ? task.status
          : 'Todo') as TaskStatus,
        due: task.due,
        done: task.done ?? false,
      }));
    } catch {
      return [];
    }
  }
}
