import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgIconsModule } from '@ng-icons/core';
import { DATA_SOURCE, MocksService } from '@nabdchainsystem/mocks';
import { ThemeService, UiZoomService } from '@nabdchainsystem/shared-util';
import { DEFAULT_CANVAS_STORAGE_KEY, canvasStorageKeyForRoom } from '@nabdchainsystem/canvas';
import { tools, ToolDescriptor } from './tools.data';
import { Subscription, filter } from 'rxjs';

type RoomPermission = 'full' | 'comment' | 'view';

interface RoomDescriptor {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  isDefault?: boolean;
  permission: RoomPermission;
  isPrivate: boolean;
  createdAt: number;
}

type QuickActionId =
  | 'profile'
  | 'my-work'
  | 'planner'
  | 'track-time'
  | 'notepad'
  | 'clips'
  | 'reminder'
  | 'chat'
  | 'new-doc'
  | 'whiteboard'
  | 'people'
  | 'dashboard'
  | 'ai-notetaker';

interface QuickAction {
  id: QuickActionId;
  label: string;
  icon: string;
  accent?: string;
  pinned?: boolean;
}

const ROOM_STORAGE_KEY = 'ncs.rooms.v1';

const DEFAULT_ROOMS: readonly RoomDescriptor[] = [];

interface RoomIconOption {
  icon: string;
  label: string;
}

const ROOM_ICON_OPTIONS: RoomIconOption[] = [
  { icon: 'lucideSparkles', label: 'Spark' },
  { icon: 'lucideUsers', label: 'Team' },
  { icon: 'lucideBarChart2', label: 'Analytics' },
  { icon: 'lucideClipboardList', label: 'Tasks' },
  { icon: 'lucideTarget', label: 'Goals' },
  { icon: 'lucidePenSquare', label: 'Docs' },
  { icon: 'lucideBolt', label: 'Energy' },
  { icon: 'lucideFlag', label: 'Flag' },
  { icon: 'lucideLayoutGrid', label: 'Boards' },
  { icon: 'lucideTimer', label: 'Timeline' },
  { icon: 'lucidePlugZap', label: 'Automate' },
  { icon: 'lucideVideo', label: 'Media' },
];

function isRoomPermission(value: unknown): value is RoomPermission {
  return value === 'full' || value === 'comment' || value === 'view';
}

function slugifyRoomName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function buildInitial(value: string, fallback = 'R'): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  const codePoint = trimmed.codePointAt(0);
  if (!codePoint) {
    return fallback;
  }
  return String.fromCodePoint(codePoint).toUpperCase();
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, NgIconsModule, FormsModule],
  template: `
    <div class="frame-zoom" [style.--ui-zoom]="uiZoomValue()">
      <div class="app-frame" [class.collapsed]="collapsed()">
        <!-- Primary (dark) topbar -->
        <header class="topbar-primary">
          <div class="topbar-primary__section topbar-primary__section--left">
            <button class="topbar-toggle" (click)="toggle()" aria-label="Toggle sidebar">☰</button>
            <span class="topbar-brand">NABD</span>
          </div>
          <div class="topbar-primary__section topbar-primary__section--center">
            <div class="primary-search">
              <span class="primary-search__icon" aria-hidden="true">🔎</span>
              <input id="global-search" aria-label="Search" placeholder="Search" autocomplete="off" />
              <span class="primary-search__badge" aria-hidden="true">AI</span>
            </div>
          </div>
          <div class="topbar-primary__section topbar-primary__section--right">
            <button type="button" class="topbar-icon" title="Create">
              <ng-icon name="lucidePlusCircle" size="18"></ng-icon>
            </button>
            <button type="button" class="topbar-icon" title="Tasks">
              <ng-icon name="lucideClipboardList" size="18"></ng-icon>
            </button>
            <button type="button" class="topbar-icon" title="Reminders">
              <ng-icon name="lucideAlarmClock" size="18"></ng-icon>
            </button>
            <div class="topbar-launcher" (click)="$event.stopPropagation()">
              <button
                type="button"
                class="topbar-icon topbar-icon--launcher"
                [class.topbar-icon--active]="quickLauncherOpen()"
                aria-haspopup="true"
                aria-expanded="{{ quickLauncherOpen() }}"
                title="Quick actions"
                (click)="toggleQuickLauncher()"
              >
                <ng-icon name="lucideGrid3x3" size="18"></ng-icon>
              </button>
              <div
                *ngIf="quickLauncherOpen()"
                class="topbar-launcher__menu"
                role="menu"
                (click)="$event.stopPropagation()"
              >
                <header class="topbar-launcher__header">
                  <span>Quick Launch</span>
                  <button type="button" (click)="toggleQuickLauncher(false)" aria-label="Close quick launch">
                    <ng-icon name="lucideX" size="16"></ng-icon>
                  </button>
                </header>
                <div class="topbar-launcher__grid">
                  <button
                    type="button"
                    class="launcher-tile"
                    *ngFor="let action of quickActions"
                    (click)="openQuickAction(action)"
                    role="menuitem"
                  >
                    <span class="launcher-tile__icon" [style.background]="action.accent ?? ''">
                      <ng-icon [name]="action.icon" size="20"></ng-icon>
                      <ng-icon
                        *ngIf="action.pinned"
                        name="lucideStar"
                        size="12"
                        class="launcher-tile__pin"
                        aria-hidden="true"
                      ></ng-icon>
                    </span>
                    <span class="launcher-tile__label">{{ action.label }}</span>
                  </button>
                </div>
              </div>
            </div>
            <button type="button" class="topbar-theme" (click)="theme.toggle()" title="Toggle theme">
              {{ theme.current === 'dark' ? 'Light' : 'Dark' }}
            </button>
          </div>
        </header>

        <!-- Secondary (white) topbar: breadcrumbs + actions -->
        <div class="topbar-secondary">
          <div class="topbar-secondary__left">
            <ng-icon name="lucideHome" size="16"></ng-icon>
            <span>Home</span>
          </div>
          <button
            class="topbar-secondary__manage"
            type="button"
            title="Manage cards"
            (click)="toggleManage()"
          >
            Manage cards
          </button>
        </div>

        <aside class="sidebar">
          <div class="sidebar-inner">
            <div class="ws-card">
              <div class="ws-head">
                <div class="ws-name" *ngIf="!collapsed()">Mohamed Ali's Workspace</div>
                <ng-icon
                  *ngIf="!collapsed()"
                  name="lucideChevronDown"
                  size="16"
                  style="margin-left:auto;opacity:.6"
                ></ng-icon>
              </div>
              <div class="ws-sep"></div>
            </div>
            <ul class="ws-pages">
              <li>
                <a
                  routerLink="/"
                  routerLinkActive="active"
                  [routerLinkActiveOptions]="{ exact: true }"
                  class="ws-link"
                >
                  <ng-icon name="lucideHome" size="18"></ng-icon>
                  <span *ngIf="!collapsed()">Home</span>
                </a>
              </li>
              <li>
                <a
                  routerLink="/inbox"
                  routerLinkActive="active"
                  [routerLinkActiveOptions]="{ exact: true }"
                  class="ws-link"
                >
                  <ng-icon name="lucideMail" size="18"></ng-icon>
                  <span *ngIf="!collapsed()">Inbox</span>
                </a>
              </li>
              <li>
                <a href="#" class="ws-link"
                  ><ng-icon name="lucideUsers" size="18"></ng-icon><span *ngIf="!collapsed()">Teams</span></a
                >
              </li>
              <li>
                <a href="#" class="ws-link"
                  ><ng-icon name="lucideFileText" size="18"></ng-icon><span *ngIf="!collapsed()">Docs</span></a
                >
              </li>
              <li>
                <a href="#" class="ws-link"
                  ><ng-icon name="lucideBarChart2" size="18"></ng-icon
                  ><span *ngIf="!collapsed()">Dashboards</span></a
                >
              </li>
              <li>
                <a href="#" class="ws-link"
                  ><ng-icon name="lucidePenSquare" size="18"></ng-icon
                  ><span *ngIf="!collapsed()">Whiteboards</span></a
                >
              </li>
              <li>
                <a href="#" class="ws-link"
                  ><ng-icon name="lucideClipboardList" size="18"></ng-icon
                  ><span *ngIf="!collapsed()">Forms</span></a
                >
              </li>
              <li>
                <a href="#" class="ws-link"
                  ><ng-icon name="lucideVideo" size="18"></ng-icon><span *ngIf="!collapsed()">Clips</span></a
                >
              </li>
              <li>
                <a href="#" class="ws-link"
                  ><ng-icon name="lucideActivity" size="18"></ng-icon><span *ngIf="!collapsed()">Pulse</span></a
                >
              </li>
              <li>
                <a href="#" class="ws-link"
                  ><ng-icon name="lucideTarget" size="18"></ng-icon><span *ngIf="!collapsed()">Goals</span></a
                >
              </li>
              <li>
                <a href="#" class="ws-link"
                  ><ng-icon name="lucideClock" size="18"></ng-icon
                  ><span *ngIf="!collapsed()">Timesheets</span></a
                >
              </li>
              <li>
                <a href="#" class="ws-link"
                  ><ng-icon name="lucideMoreHorizontal" size="18"></ng-icon
                  ><span *ngIf="!collapsed()">More</span></a
                >
              </li>
            </ul>

            <div class="rooms-separator"></div>
            <div class="rooms-header">
              <span *ngIf="!collapsed()">Rooms</span>
              <button
                type="button"
                class="rooms-header__add"
                (click)="openCreateRoom()"
                aria-label="Create room"
              >
                +
              </button>
            </div>

            <ul class="rooms-list" *ngIf="rooms().length > 0">
              <li *ngFor="let room of rooms(); trackBy: trackRoom" class="room-item">
                <div class="room-item__main">
                  <button
                    type="button"
                    class="room-link__icon-btn"
                    (click)="toggleRoomIconPicker(room.id, $event)"
                    [attr.aria-label]="room.icon ? 'Change icon for ' + room.name : 'Choose icon for ' + room.name"
                    aria-haspopup="true"
                    [attr.aria-expanded]="roomIconPickerOpen() === room.id"
                  >
                    <span class="room-link__icon" [class.room-link__icon--initial]="!room.icon">
                      <ng-icon *ngIf="room.icon" [name]="room.icon" size="16"></ng-icon>
                      <span *ngIf="!room.icon">{{ roomInitial(room) }}</span>
                    </span>
                  </button>
                  <a
                    class="ws-link room-link room-item__link"
                    [routerLink]="['/rooms', room.id]"
                    routerLinkActive="active"
                    [routerLinkActiveOptions]="{ exact: true }"
                    (click)="$event.stopPropagation()"
                  >
                    <span *ngIf="!collapsed()" class="room-link__name">{{ room.name }}</span>
                    <span *ngIf="!collapsed() && room.isPrivate" class="room-link__badge">Private</span>
                  </a>
                  <button
                    *ngIf="!collapsed()"
                    type="button"
                    class="room-link__menu"
                    aria-label="Room options"
                    aria-haspopup="true"
                    [attr.aria-expanded]="roomMenuOpen() === room.id"
                    (click)="toggleRoomMenu(room.id, $event)"
                  >
                    <ng-icon name="lucideMoreHorizontal" size="16"></ng-icon>
                  </button>
                </div>
                <div
                  class="room-menu"
                  *ngIf="roomMenuOpen() === room.id"
                  (click)="$event.stopPropagation()"
                >
                  <button type="button" (click)="deleteRoom(room.id)">Delete room</button>
                </div>
                <div
                  class="room-icon-picker"
                  *ngIf="roomIconPickerOpen() === room.id"
                  (click)="$event.stopPropagation()"
                >
                  <button
                    type="button"
                    class="room-icon-picker__option"
                    [class.room-icon-picker__option--selected]="!room.icon"
                    (click)="selectRoomIcon(room.id, null)"
                  >
                    <span class="room-icon-picker__icon room-icon-picker__icon--initial">
                      {{ roomInitial(room) }}
                    </span>
                    <span>Use initial</span>
                  </button>
                  <button
                    type="button"
                    class="room-icon-picker__option"
                    [class.room-icon-picker__option--selected]="room.icon === option.icon"
                    *ngFor="let option of roomIconOptions; trackBy: trackIconOption"
                    (click)="selectRoomIcon(room.id, option.icon)"
                  >
                    <span class="room-icon-picker__icon">
                      <ng-icon [name]="option.icon" size="16"></ng-icon>
                    </span>
                    <span>{{ option.label }}</span>
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </aside>

        <main class="main">
          <router-outlet />
        </main>

        <footer class="app-footer">
          <span>NABD CHAIN SYSTEM V11</span>
        </footer>
      </div>
    </div>

    <div
      class="drawer-overlay"
      *ngIf="drawerState() !== 'hidden'"
      [class.drawer-overlay--visible]="drawerState() === 'enter'"
      [class.drawer-overlay--leaving]="drawerState() === 'leave'"
      (click)="toggleManage(false)"
    ></div>
    <aside
      class="manage-drawer"
      *ngIf="drawerState() !== 'hidden'"
      [class.manage-drawer--entering]="drawerState() === 'enter'"
      [class.manage-drawer--leaving]="drawerState() === 'leave'"
      role="dialog"
      aria-modal="true"
      aria-label="Manage cards drawer"
      (click)="$event.stopPropagation()"
    >
      <header class="drawer-header">
        <h3>Add Cards</h3>
        <button
          type="button"
          class="drawer-header__close"
          aria-label="Close manage cards"
          (click)="toggleManage(false)"
        >
          ×
        </button>
      </header>
      <section class="drawer-content">
        <article class="tool-card" *ngFor="let tool of manageTools; trackBy: trackTool">
          <div class="tool-card__icon" [style.--tool-accent]="tool.accent" aria-hidden="true">
            <ng-icon [name]="tool.icon" size="20"></ng-icon>
          </div>
          <div class="tool-card__main">
            <div class="tool-card__row">
              <div class="tool-card__heading">
                <span class="tool-card__title">{{ tool.name }}</span>
                <span *ngIf="tool.badge" class="tool-card__badge">{{ tool.badge }}</span>
              </div>
              <button type="button" class="tool-card__action" (click)="onAdd(tool.id)">
                <ng-icon
                  [name]="isAdded(tool.id) ? 'lucideMinusCircle' : 'lucidePlusCircle'"
                  size="16"
                ></ng-icon>
                <span>{{ isAdded(tool.id) ? 'Remove' : 'Add to Overview' }}</span>
              </button>
            </div>
            <p class="tool-card__description">{{ tool.description }}</p>
          </div>
        </article>
      </section>
    </aside>

    <div
      class="quick-modal-backdrop"
      *ngIf="activeQuickAction() as quickAction"
      (click)="closeQuickAction()"
    >
      <section
        class="quick-modal"
        [attr.data-action]="quickAction.id"
        role="dialog"
        aria-modal="true"
        (click)="$event.stopPropagation()"
      >
        <header class="quick-modal__header">
          <div class="quick-modal__title">{{ quickAction.label }}</div>
          <div class="quick-modal__actions">
            <button type="button" class="quick-modal__bell" title="Manage notifications">
              <ng-icon name="lucideBellRing" size="16"></ng-icon>
            </button>
            <button type="button" class="quick-modal__close" aria-label="Close" (click)="closeQuickAction()">
              <ng-icon name="lucideX" size="16"></ng-icon>
            </button>
          </div>
        </header>
        <div class="quick-modal__content" [ngSwitch]="quickAction.id">
          <ng-container *ngSwitchCase="'profile'">
            <div class="quick-modal__split">
              <div class="profile-card">
                <div class="profile-card__avatar">MA</div>
                <h3>Mohamed Ali</h3>
                <p class="profile-card__role">Global Operations</p>
                <div class="profile-card__meta">
                  <span><strong>Manager:</strong> Sarah Blake</span>
                  <span><strong>Local time:</strong> 10:06 AM</span>
                </div>
                <button type="button" class="profile-card__cta">Write StandUp</button>
              </div>
              <div class="profile-stream">
                <header>
                  <div class="profile-stream__tabs">
                    <button class="active">Activity</button>
                    <button>My Work</button>
                    <button>Assigned</button>
                    <button>Calendar</button>
                  </div>
                  <button class="profile-stream__filter">
                    <ng-icon name="lucideFilter" size="14"></ng-icon>
                    Filter
                  </button>
                </header>
                <div class="profile-stream__list">
                  <article>
                    <div class="item-head">
                      <h4>Priorities</h4>
                      <button type="button">+ Add</button>
                    </div>
                    <ul>
                      <li>
                        <span class="dot dot--urgent"></span>
                        Task 2
                        <span class="chip chip--danger">Oct 12</span>
                      </li>
                      <li>
                        <span class="dot dot--warning"></span>
                        Task 3
                        <span class="chip chip--warning">Oct 6</span>
                      </li>
                    </ul>
                  </article>
                  <article>
                    <div class="item-head">
                      <h4>Recent activity</h4>
                    </div>
                    <ul class="profile-stream__timeline">
                      <li>
                        <span class="dot dot--blue"></span>
                        You set priority to <strong>Urgent</strong> on Task 2
                        <time>Oct 14 · 6:58 PM</time>
                      </li>
                      <li>
                        <span class="dot dot--blue"></span>
                        You changed due date to Oct 6 on Task 3
                        <time>Oct 14 · 6:57 PM</time>
                      </li>
                    </ul>
                  </article>
                </div>
              </div>
            </div>
          </ng-container>
          <ng-container *ngSwitchCase="'my-work'">
            <div class="my-work-board">
              <header>
                <h3>Today's Focus</h3>
                <button type="button">
                  <ng-icon name="lucidePlus" size="14"></ng-icon>
                  Add task
                </button>
              </header>
              <div class="my-work-columns">
                <section>
                  <h4>To Do</h4>
                  <ul>
                    <li>
                      <span class="status status--todo">Task</span>
                      Prep supplier brief
                      <time>Due today</time>
                    </li>
                    <li>
                      <span class="status status--todo">Task</span>
                      Update cost model
                      <time>Due tomorrow</time>
                    </li>
                  </ul>
                </section>
                <section>
                  <h4>In Progress</h4>
                  <ul>
                    <li>
                      <span class="status status--progress">Task</span>
                      Draft onboarding playbook
                      <time>Review in 2h</time>
                    </li>
                  </ul>
                </section>
                <section>
                  <h4>Done</h4>
                  <ul>
                    <li>
                      <span class="status status--done">Task</span>
                      Submit risk report
                      <time>Completed 1h ago</time>
                    </li>
                  </ul>
                </section>
              </div>
            </div>
          </ng-container>
          <ng-container *ngSwitchCase="'planner'">
            <div class="planner-view">
              <header>
                <div>
                  <h3>Week Planner</h3>
                  <p>Oct 19 – Oct 25</p>
                </div>
                <div class="planner-view__controls">
                  <button type="button">
                    <ng-icon name="lucideCalendarDays" size="14"></ng-icon>
                    Jump to today
                  </button>
                  <button type="button">
                    <ng-icon name="lucideFilter" size="14"></ng-icon>
                    Filter
                  </button>
                </div>
              </header>
              <div class="planner-grid">
                <div class="planner-day">
                  <span>Mon</span>
                  <button class="planner-pill planner-pill--primary">
                    Q4 roadmap review
                    <time>9:00 AM</time>
                  </button>
                </div>
                <div class="planner-day">
                  <span>Tue</span>
                  <button class="planner-pill planner-pill--mint">
                    Vendor sync
                    <time>1:00 PM</time>
                  </button>
                  <button class="planner-pill planner-pill--amber">
                    Finance handoff
                    <time>3:30 PM</time>
                  </button>
                </div>
                <div class="planner-day">
                  <span>Wed</span>
                  <button class="planner-pill planner-pill--violet">
                    Innovation sprint
                    <time>All day</time>
                  </button>
                </div>
                <div class="planner-day">
                  <span>Thu</span>
                  <button class="planner-pill planner-pill--gray">
                    Focus time
                    <time>10:00 AM</time>
                  </button>
                </div>
                <div class="planner-day">
                  <span>Fri</span>
                  <button class="planner-pill planner-pill--rose">
                    Team retro
                    <time>4:30 PM</time>
                  </button>
                </div>
              </div>
            </div>
          </ng-container>
          <ng-container *ngSwitchCase="'track-time'">
            <form class="quick-time-form">
              <div class="quick-time-form__row">
                <label>Log time</label>
                <div class="quick-time-form__timer">
                  <input type="text" placeholder="Enter time (ex: 3h 20m) or start timer" />
                  <button type="button" title="Start timer">
                    <ng-icon name="lucideTimer" size="16"></ng-icon>
                  </button>
                </div>
              </div>
              <div class="quick-time-form__row">
                <label>Select task</label>
                <button type="button" class="quick-time-form__select">Choose task</button>
              </div>
              <div class="quick-time-form__row quick-time-form__row--split">
                <div>
                  <label>When</label>
                  <button type="button" class="quick-time-form__select">
                    Sat, Oct 18 · 10:06 AM – 10:06 AM
                  </button>
                </div>
                <div>
                  <label>Notes</label>
                  <input type="text" placeholder="Add notes" />
                </div>
              </div>
              <div class="quick-time-form__row">
                <label>Tags</label>
                <input type="text" placeholder="Add tags" />
              </div>
              <footer class="quick-time-form__footer">
                <div class="quick-time-form__links">
                  <button type="button">My Timesheet</button>
                  <button type="button">Dashboard</button>
                </div>
                <button type="submit" class="primary">Save</button>
              </footer>
            </form>
          </ng-container>
          <ng-container *ngSwitchCase="'notepad'">
            <div class="notepad-empty">
              <div class="notepad-empty__icon">
                <ng-icon name="lucideClipboardList" size="32"></ng-icon>
              </div>
              <h3>Create personal notes</h3>
              <p>Capture your thoughts or ideas and access them anywhere in NABD.</p>
              <button type="button" class="primary">Create a note</button>
            </div>
          </ng-container>
          <ng-container *ngSwitchCase="'clips'">
            <div class="clips-panel">
              <div class="clips-panel__preview">
                <span>Recording · 02:46</span>
              </div>
              <div class="clips-panel__actions">
                <button type="button">
                  <ng-icon name="lucidePlay" size="16"></ng-icon>
                  Play
                </button>
                <button type="button">
                  <ng-icon name="lucideScissors" size="16"></ng-icon>
                  Trim
                </button>
                <button type="button">
                  <ng-icon name="lucideShare2" size="16"></ng-icon>
                  Share
                </button>
              </div>
            </div>
          </ng-container>
          <ng-container *ngSwitchCase="'reminder'">
            <div class="reminder-modal">
              <div class="reminder-modal__tabs">
                <button>Task</button>
                <button>Doc</button>
                <button class="active">Reminder</button>
                <button>Chat</button>
                <button>Whiteboard</button>
                <button>Dashboard</button>
              </div>
              <div class="reminder-modal__body">
                <input type="text" placeholder="Reminder name or type '/' for commands" />
                <div class="reminder-modal__chips">
                  <button type="button">Today</button>
                  <button type="button">M</button>
                  <button type="button">For me</button>
                  <button type="button">Notify me</button>
                </div>
                <textarea rows="4" placeholder="Add notes, links, or details"></textarea>
              </div>
              <footer class="reminder-modal__footer">
                <button type="button">
                  <ng-icon name="lucidePaperclip" size="16"></ng-icon>
                </button>
                <button type="button" class="primary">Create Reminder</button>
              </footer>
            </div>
          </ng-container>
          <ng-container *ngSwitchCase="'chat'">
            <div class="chat-panel">
              <div class="chat-panel__thread">
                <div class="chat-bubble">
                  <span class="chat-bubble__author">Sarah</span>
                  Client requested the revised pricing sheet by tomorrow.
                </div>
                <div class="chat-bubble chat-bubble--me">
                  <span class="chat-bubble__author">You</span>
                  On it! I'll align with finance and send the update tonight.
                </div>
              </div>
              <form class="chat-panel__composer">
                <input type="text" placeholder="Type a message…" />
                <button type="button">
                  <ng-icon name="lucideSmile" size="18"></ng-icon>
                </button>
                <button type="submit">
                  <ng-icon name="lucideSend" size="18"></ng-icon>
                </button>
              </form>
            </div>
          </ng-container>
          <ng-container *ngSwitchCase="'new-doc'">
            <form class="doc-form">
              <label>
                Title
                <input type="text" placeholder="Name your document" />
              </label>
              <label>
                Workspace
                <input type="text" placeholder="Select workspace" />
              </label>
              <label>
                Share with
                <input type="text" placeholder="Search teammates" />
              </label>
              <div class="doc-form__options">
                <label><input type="checkbox" checked /> Allow comments</label>
                <label><input type="checkbox" /> Lock editing</label>
              </div>
              <footer>
                <button type="button">Template gallery</button>
                <button type="submit" class="primary">Create doc</button>
              </footer>
            </form>
          </ng-container>
          <ng-container *ngSwitchCase="'whiteboard'">
            <div class="whiteboard-panel">
              <header>
                <div class="whiteboard-panel__tools">
                  <button type="button" class="active">Select</button>
                  <button type="button">Pen</button>
                  <button type="button">Sticky</button>
                  <button type="button">Frame</button>
                </div>
                <button type="button">
                  <ng-icon name="lucideShare2" size="16"></ng-icon>
                  Share
                </button>
              </header>
              <div class="whiteboard-panel__canvas">
                <div class="whiteboard-node whiteboard-node--sticky">Sprint ideas</div>
                <div class="whiteboard-node whiteboard-node--note">📌 Align with design</div>
                <div class="whiteboard-node whiteboard-node--note">🧪 Plan experiments</div>
              </div>
            </div>
          </ng-container>
          <ng-container *ngSwitchCase="'people'">
            <div class="people-panel">
              <header>
                <h3>Teammates</h3>
                <button type="button">
                  <ng-icon name="lucidePlus" size="14"></ng-icon>
                  Invite
                </button>
              </header>
              <ul>
                <li>
                  <span class="avatar avatar--teal">SB</span>
                  Sarah Blake
                  <span class="pill pill--online">Online</span>
                </li>
                <li>
                  <span class="avatar avatar--amber">JD</span>
                  Jamal Dorsey
                  <span class="pill">In focus</span>
                </li>
                <li>
                  <span class="avatar avatar--purple">KL</span>
                  Karina Lopez
                  <span class="pill pill--away">Away</span>
                </li>
              </ul>
            </div>
          </ng-container>
          <ng-container *ngSwitchCase="'dashboard'">
            <div class="dashboard-panel">
              <header>
                <h3>Executive Snapshot</h3>
                <button type="button">
                  <ng-icon name="lucideFilter" size="14"></ng-icon>
                  Filters
                </button>
              </header>
              <div class="dashboard-panel__grid">
                <article>
                  <h4>Revenue</h4>
                  <strong>SAR 1.2M</strong>
                  <span class="trend trend--up">+12% vs last week</span>
                </article>
                <article>
                  <h4>In flight requests</h4>
                  <strong>37</strong>
                  <span class="trend trend--neutral">5 awaiting review</span>
                </article>
                <article>
                  <h4>Team availability</h4>
                  <strong>78%</strong>
                  <span class="trend trend--down">-4% this week</span>
                </article>
                <article class="dashboard-panel__chart">
                  <h4>Velocity</h4>
                  <div class="bar bar--a"></div>
                  <div class="bar bar--b"></div>
                  <div class="bar bar--c"></div>
                </article>
              </div>
            </div>
          </ng-container>
          <ng-container *ngSwitchCase="'ai-notetaker'">
            <div class="ai-notes">
              <header>
                <h3>AI Notetaker</h3>
                <span class="chip chip--purple">Auto summaries</span>
              </header>
              <div class="ai-notes__body">
                <p><strong>Latest summary:</strong> Supplier onboarding workshop 10/18</p>
                <ul>
                  <li>Confirmed rollout timeline for phase 2 (Nov 12).</li>
                  <li>Assigned Mohamed to draft the stakeholder brief.</li>
                  <li>AI suggests a follow up Q&amp;A session next Tuesday.</li>
                </ul>
              </div>
              <footer>
                <button type="button">View transcript</button>
                <button type="button" class="primary">Generate action items</button>
              </footer>
            </div>
          </ng-container>
        </div>
      </section>
    </div>

    <div class="room-dialog-overlay" *ngIf="createRoomOpen()" (click)="closeCreateRoom()"></div>
    <section
      class="room-dialog"
      *ngIf="createRoomOpen()"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-room-title"
      (click)="$event.stopPropagation()"
    >
      <header class="room-dialog__header">
        <h2 id="create-room-title">Create a Room</h2>
        <button
          type="button"
          class="room-dialog__close"
          aria-label="Close create room dialog"
          (click)="closeCreateRoom()"
        >
          ×
        </button>
      </header>
      <form class="room-dialog__form" (ngSubmit)="createRoom()" novalidate>
        <div class="room-dialog__primary">
          <div class="room-dialog__avatar" aria-hidden="true">{{ previewRoomInitial() }}</div>
          <div class="room-dialog__field">
            <label class="room-dialog__label" for="room-name">Icon &amp; name</label>
            <input
              #roomNameInput
              id="room-name"
              name="roomName"
              placeholder="e.g. Marketing, Engineering, HR"
              autocomplete="off"
              required
              [(ngModel)]="roomNameModel"
              [class.invalid]="createRoomAttempted && !roomNameModel.trim()"
            />
            <p class="room-dialog__error" *ngIf="createRoomAttempted && !roomNameModel.trim()">
              A room name is required.
            </p>
          </div>
        </div>

        <label class="room-dialog__field" for="room-description">
          <span class="room-dialog__label">Description <span class="room-dialog__optional">(optional)</span></span>
          <textarea
            id="room-description"
            name="roomDescription"
            rows="2"
            placeholder="Describe the purpose of this room"
            [(ngModel)]="roomDescriptionModel"
          ></textarea>
        </label>

        <label class="room-dialog__field">
          <span class="room-dialog__label">Default permission</span>
          <select name="roomPermission" [(ngModel)]="roomPermissionModel">
            <option value="full">Full edit</option>
            <option value="comment">Can comment</option>
            <option value="view">View only</option>
          </select>
        </label>

        <label class="room-dialog__switch">
          <input type="checkbox" name="roomPrivate" [(ngModel)]="roomPrivateModel" />
          <div>
            <span>Make private</span>
            <small>Only you and invited members have access</small>
          </div>
        </label>

        <footer class="room-dialog__actions">
          <button type="button" class="room-dialog__cancel" (click)="closeCreateRoom()">Cancel</button>
          <button type="submit" class="room-dialog__submit">Create</button>
        </footer>
      </form>
    </section>
  `,
  providers: [{ provide: DATA_SOURCE, useExisting: MocksService }],
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild('roomNameInput') roomNameInput?: ElementRef<HTMLInputElement>;

  readonly collapsed = signal(false);
  readonly showManage = signal(false);
  readonly createRoomOpen = signal(false);
  private readonly drawerStage = signal<'hidden' | 'mount' | 'enter' | 'leave'>('hidden');
  private closeTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly addedIds = signal<Set<string>>(new Set());
  createRoomAttempted = false;

  roomNameModel = '';
  roomDescriptionModel = '';
  roomPermissionModel: RoomPermission = 'full';
  roomPrivateModel = false;

  readonly rooms = signal<RoomDescriptor[]>(DEFAULT_ROOMS.map((room) => ({ ...room })));
  readonly roomMenuOpen = signal<string | null>(null);
  readonly roomIconPickerOpen = signal<string | null>(null);
  readonly roomIconOptions: readonly RoomIconOption[] = ROOM_ICON_OPTIONS;
  readonly manageTools: ToolDescriptor[] = tools;
  readonly uiZoom = inject(UiZoomService);
  readonly uiZoomValue = toSignal(this.uiZoom.zoom$, { initialValue: 1 });
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private routeSub?: Subscription;
  private readonly currentLayoutKey = signal(DEFAULT_CANVAS_STORAGE_KEY);
  readonly quickActions: QuickAction[] = [
    {
      id: 'profile',
      label: 'My Profile',
      icon: 'lucideUserCheck',
      accent: 'linear-gradient(135deg,#7c3aed,#4c1d95)',
      pinned: true,
    },
    {
      id: 'my-work',
      label: 'My Work',
      icon: 'lucideCheckSquare',
      accent: 'linear-gradient(135deg,#6366f1,#312e81)',
      pinned: true,
    },
    {
      id: 'planner',
      label: 'Planner',
      icon: 'lucideCalendarDays',
      accent: 'linear-gradient(135deg,#34d399,#059669)',
    },
    {
      id: 'track-time',
      label: 'Track Time',
      icon: 'lucideTimer',
      accent: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
      pinned: true,
    },
    {
      id: 'notepad',
      label: 'Notepad',
      icon: 'lucideClipboardList',
      accent: 'linear-gradient(135deg,#fbbf24,#f59e0b)',
      pinned: true,
    },
    {
      id: 'clips',
      label: 'Clips',
      icon: 'lucideVideo',
      accent: 'linear-gradient(135deg,#f97316,#ea580c)',
      pinned: true,
    },
    {
      id: 'reminder',
      label: 'Reminder',
      icon: 'lucideAlarmClock',
      accent: 'linear-gradient(135deg,#22d3ee,#0891b2)',
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: 'lucideMessageCircle',
      accent: 'linear-gradient(135deg,#ec4899,#db2777)',
    },
    {
      id: 'new-doc',
      label: 'New Doc',
      icon: 'lucideFilePlus',
      accent: 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
    },
    {
      id: 'whiteboard',
      label: 'Whiteboard',
      icon: 'lucideLayoutGrid',
      accent: 'linear-gradient(135deg,#38bdf8,#0284c7)',
    },
    {
      id: 'people',
      label: 'People',
      icon: 'lucideUsers',
      accent: 'linear-gradient(135deg,#f97316,#f59e0b)',
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: 'lucideBarChart2',
      accent: 'linear-gradient(135deg,#10b981,#059669)',
    },
    {
      id: 'ai-notetaker',
      label: 'AI Notetaker',
      icon: 'lucideSparkles',
      accent: 'linear-gradient(135deg,#a855f7,#7c3aed)',
    },
  ];
  quickLauncherOpen = signal(false);
  activeQuickAction = signal<QuickAction | null>(null);

  private readonly handleBlockAdded = (event: Event) => {
    const detail = (event as CustomEvent<{ kind?: string }>).detail;
    const kind = typeof detail?.kind === 'string' ? detail.kind : undefined;
    if (!kind) {
      return;
    }
    this.addedIds.update((current) => {
      if (current.has(kind)) {
        return current;
      }
      const next = new Set(current);
      next.add(kind);
      return next;
    });
  };
  private readonly handleBlockRemoved = (event: Event) => {
    const detail = (event as CustomEvent<{ kind?: string }>).detail;
    const kind = typeof detail?.kind === 'string' ? detail.kind : undefined;
    if (!kind) {
      return;
    }
    this.addedIds.update((current) => {
      if (!current.has(kind)) {
        return current;
      }
      const next = new Set(current);
      next.delete(kind);
      return next;
    });
  };
  private readonly handleLayoutChanged = (event: Event) => {
    const detail = (event as CustomEvent<{ kinds?: unknown }>).detail;
    const kinds = Array.isArray(detail?.kinds)
      ? detail!.kinds.filter((value): value is string => typeof value === 'string')
      : [];
    this.addedIds.set(new Set(kinds));
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.hydrateRooms();
      this.updateRouteContext(true);
      this.routeSub = this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe(() => this.updateRouteContext());
    }
  }

  ngOnInit(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.addEventListener('ncs:block-added', this.handleBlockAdded);
    window.addEventListener('ncs:block-removed', this.handleBlockRemoved);
    window.addEventListener('ncs:layout-changed', this.handleLayoutChanged);
  }

  toggle() {
    this.collapsed.update((value) => !value);
    this.roomMenuOpen.set(null);
    this.roomIconPickerOpen.set(null);
  }

  toggleQuickLauncher(force?: boolean) {
    const desired =
      typeof force === 'boolean' ? force : !this.quickLauncherOpen();
    this.quickLauncherOpen.set(desired);
    if (desired) {
      this.roomMenuOpen.set(null);
      this.roomIconPickerOpen.set(null);
      this.activeQuickAction.set(null);
    }
  }

  openQuickAction(action: QuickAction) {
    this.activeQuickAction.set(action);
    this.quickLauncherOpen.set(false);
  }

  closeQuickAction() {
    this.activeQuickAction.set(null);
  }

  openCreateRoom() {
    this.createRoomAttempted = false;
    this.roomNameModel = '';
    this.roomDescriptionModel = '';
    this.roomPermissionModel = 'full';
    this.roomPrivateModel = false;
    this.roomMenuOpen.set(null);
    this.roomIconPickerOpen.set(null);
    this.createRoomOpen.set(true);
    requestAnimationFrame(() => {
      this.roomNameInput?.nativeElement.focus();
      this.roomNameInput?.nativeElement.select();
    });
  }

  closeCreateRoom() {
    this.createRoomOpen.set(false);
  }

  previewRoomInitial() {
    return buildInitial(this.roomNameModel);
  }

  roomInitial(room: RoomDescriptor) {
    return buildInitial(room.name, 'R');
  }

  toggleRoomMenu(roomId: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const next = this.roomMenuOpen() === roomId ? null : roomId;
    this.roomMenuOpen.set(next);
    if (next) {
      this.roomIconPickerOpen.set(null);
    }
  }

  toggleRoomIconPicker(roomId: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const next = this.roomIconPickerOpen() === roomId ? null : roomId;
    this.roomIconPickerOpen.set(next);
    if (next) {
      this.roomMenuOpen.set(null);
    }
  }

  selectRoomIcon(roomId: string, icon: string | null) {
    const normalized = icon && icon.trim().length > 0 ? icon.trim() : undefined;
    let changed = false;
    const nextRooms = this.rooms().map((room) => {
      if (room.id !== roomId) {
        return room;
      }
      if (room.icon === normalized) {
        return room;
      }
      changed = true;
      return { ...room, icon: normalized };
    });
    if (!changed) {
      this.roomIconPickerOpen.set(null);
      return;
    }
    this.rooms.set(nextRooms);
    this.persistRooms(nextRooms);
    this.roomIconPickerOpen.set(null);
  }

  deleteRoom(roomId: string) {
    let removed = false;
    const nextRooms = this.rooms().filter((room) => {
      if (room.id === roomId) {
        removed = true;
        return false;
      }
      return true;
    });
    if (!removed) {
      this.roomMenuOpen.set(null);
      return;
    }
    this.rooms.set(nextRooms);
    this.persistRooms(nextRooms);
    this.roomMenuOpen.set(null);
    this.roomIconPickerOpen.set(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(canvasStorageKeyForRoom(roomId));
    }
    if (this.resolveActiveRoomId() === roomId) {
      void this.router.navigate(['/']).then(() => this.updateRouteContext(true));
    }
  }

  private ensureUniqueRoomId(base: string) {
    const existing = new Set(this.rooms().map((room) => room.id));
    if (!base) {
      base = `room-${Date.now().toString(36)}`;
    }
    let candidate = base;
    let suffix = 2;
    while (existing.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  createRoom() {
    this.createRoomAttempted = true;
    const name = this.roomNameModel.trim();
    if (!name) {
      requestAnimationFrame(() => this.roomNameInput?.nativeElement.focus());
      return;
    }
    const description = this.roomDescriptionModel.trim();
    const baseId = slugifyRoomName(name);
    const id = this.ensureUniqueRoomId(baseId);
    const newRoom: RoomDescriptor = {
      id,
      name,
      description: description ? description : undefined,
      permission: this.roomPermissionModel,
      isPrivate: this.roomPrivateModel,
      createdAt: Date.now(),
    };
    this.rooms.update((current) => {
      const defaults = current.filter((room) => room.isDefault);
      const custom = current.filter((room) => !room.isDefault);
      const nextCustom = [...custom, newRoom].sort((a, b) => a.createdAt - b.createdAt);
      const next = [...defaults, ...nextCustom];
      this.persistRooms(next);
      return next;
    });
    this.closeCreateRoom();
    void this.router.navigate(['/rooms', id]).then(() => {
      setTimeout(() => this.toggleManage(true), 50);
    });
  }

  @HostListener('document:click')
  onDocumentClick() {
    if (this.quickLauncherOpen()) {
      this.quickLauncherOpen.set(false);
    }
    if (this.roomMenuOpen()) {
      this.roomMenuOpen.set(null);
    }
    if (this.roomIconPickerOpen()) {
      this.roomIconPickerOpen.set(null);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (this.roomIconPickerOpen()) {
        event.preventDefault();
        this.roomIconPickerOpen.set(null);
        return;
      }
      if (this.roomMenuOpen()) {
        event.preventDefault();
        this.roomMenuOpen.set(null);
        return;
      }
      if (this.activeQuickAction()) {
        event.preventDefault();
        this.closeQuickAction();
        return;
      }
      if (this.quickLauncherOpen()) {
        event.preventDefault();
        this.toggleQuickLauncher(false);
        return;
      }
      if (this.createRoomOpen()) {
        event.preventDefault();
        this.closeCreateRoom();
        return;
      }
      if (this.showManage()) {
        event.preventDefault();
        this.toggleManage(false);
        return;
      }
    }

  }

  @HostListener('window:nabd:open-manage')
  onOpenManage() {
    this.toggleManage(true);
  }

  private resolveActiveRoomId(): string | undefined {
    let route: ActivatedRoute | null = this.route;
    while (route?.firstChild) {
      route = route.firstChild;
    }
    return route?.snapshot.paramMap.get('roomId') ?? undefined;
  }

  private updateRouteContext(initial = false) {
    this.roomMenuOpen.set(null);
    this.roomIconPickerOpen.set(null);
    const roomId = this.resolveActiveRoomId();
    const key = canvasStorageKeyForRoom(roomId);
    const changed = this.currentLayoutKey() !== key;
    if (changed) {
      this.currentLayoutKey.set(key);
      this.seedAddedFromLayout(key);
    } else if (initial) {
      this.seedAddedFromLayout(key);
    }
  }

  private seedAddedFromLayout(storageKey: string) {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        this.addedIds.set(new Set());
        return;
      }
      const parsed = JSON.parse(raw) as Array<{ kind?: string }> | undefined;
      if (!Array.isArray(parsed)) {
        this.addedIds.set(new Set());
        return;
      }
      const next = new Set<string>();
      parsed.forEach((item) => {
        const kind = typeof item?.kind === 'string' ? item.kind : undefined;
        if (kind) {
          next.add(kind);
        }
      });
      this.addedIds.set(next);
    } catch (error) {
      console.warn('Failed to hydrate added cards from layout', error);
      this.addedIds.set(new Set());
    }
  }

  private hydrateRooms() {
    try {
      const raw = window.localStorage.getItem(ROOM_STORAGE_KEY);
      const defaults = DEFAULT_ROOMS.map((room) => ({ ...room }));
      if (!raw) {
        this.rooms.set(defaults);
        return;
      }
      const parsed = JSON.parse(raw) as Array<Partial<RoomDescriptor>> | undefined;
      if (!Array.isArray(parsed)) {
        this.rooms.set(defaults);
        return;
      }
      const custom = parsed
        .map((entry, index) => {
          const id = typeof entry.id === 'string' && entry.id ? entry.id : `room-${index + 1}`;
          const name =
            typeof entry.name === 'string' && entry.name.trim()
              ? entry.name.trim()
              : `Room ${index + 1}`;
          const description =
            typeof entry.description === 'string' && entry.description.trim()
              ? entry.description.trim()
              : undefined;
          const permission = isRoomPermission(entry.permission) ? entry.permission : 'full';
          const isPrivate = Boolean(entry.isPrivate);
          const createdAt =
            typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt)
              ? entry.createdAt
              : Date.now() + index;
          return {
            id,
            name,
            description,
            permission,
            isPrivate,
            createdAt,
          } satisfies RoomDescriptor;
        })
        .sort((a, b) => a.createdAt - b.createdAt);
      this.rooms.set([...defaults, ...custom]);
      this.roomMenuOpen.set(null);
      this.roomIconPickerOpen.set(null);
    } catch (error) {
      console.warn('Failed to hydrate rooms from storage', error);
      this.rooms.set(DEFAULT_ROOMS.map((room) => ({ ...room })));
      this.roomMenuOpen.set(null);
      this.roomIconPickerOpen.set(null);
    }
  }

  private persistRooms(next: RoomDescriptor[]) {
    if (typeof window === 'undefined') {
      return;
    }
    const custom = next.filter((room) => !room.isDefault);
    window.localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(custom));
  }

  toggleManage(force?: boolean) {
    this.roomMenuOpen.set(null);
    this.roomIconPickerOpen.set(null);
    const stage = this.drawerStage();
    const desired = typeof force === 'boolean' ? force : stage === 'hidden' || stage === 'leave';

    if (desired) {
      if (stage === 'enter') {
        return;
      }
      if (this.closeTimer) {
        clearTimeout(this.closeTimer);
        this.closeTimer = undefined;
      }
      this.showManage.set(true);
      this.drawerStage.set('mount');
      requestAnimationFrame(() => {
        if (this.drawerStage() === 'mount') {
          this.drawerStage.set('enter');
        }
      });
      return;
    }

    if (stage === 'hidden' || stage === 'leave') {
      return;
    }
    this.drawerStage.set('leave');
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
    }
    this.closeTimer = setTimeout(() => {
      this.closeTimer = undefined;
      this.drawerStage.set('hidden');
      this.showManage.set(false);
    }, 280);
  }

  onAdd(id: string) {
    if (typeof window === 'undefined') {
      return;
    }
    const eventName = this.isAdded(id) ? 'ncs:remove-block' : 'ncs:add-block';
    window.dispatchEvent(new CustomEvent(eventName, { detail: { kind: id } }));
  }

  isAdded(id: string) {
    return this.addedIds().has(id);
  }

  trackTool = (_: number, tool: ToolDescriptor) => tool.id;
  trackRoom = (_: number, room: RoomDescriptor) => room.id;
  trackIconOption = (_: number, option: RoomIconOption) => option.icon;

  ngOnDestroy() {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = undefined;
    }
    if (this.routeSub) {
      this.routeSub.unsubscribe();
      this.routeSub = undefined;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('ncs:block-added', this.handleBlockAdded);
      window.removeEventListener('ncs:block-removed', this.handleBlockRemoved);
      window.removeEventListener('ncs:layout-changed', this.handleLayoutChanged);
    }
  }

  drawerState() {
    return this.drawerStage();
  }
}
