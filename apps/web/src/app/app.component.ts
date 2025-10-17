import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgIconsModule } from '@ng-icons/core';
import { DATA_SOURCE, MocksService } from '@nabdchainsystem/mocks';
import { ThemeService, UiZoomService } from '@nabdchainsystem/shared-util';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, NgIconsModule],
  template: `
    <div
      class="frame-zoom"
      [style.--ui-zoom]="uiZoomValue()"
      [style.--ui-zoom-inverse]="uiZoomInverse()"
    >
      <div class="app-frame" [class.collapsed]="collapsed()">
        <!-- Primary (dark) topbar -->
        <header class="topbar-primary">
          <div class="topbar-primary__section topbar-primary__section--left">
            <button
              (click)="toggle()"
              aria-label="Toggle sidebar"
              style="border:none;background:transparent;cursor:pointer;color:#fff;font-weight:700"
            >
              ☰
            </button>
            <div style="font-weight:800;letter-spacing:.3px;">NABD</div>
            <div style="opacity:.9;font-size:12px;">• Workspace</div>
          </div>
          <div class="topbar-primary__section topbar-primary__section--center">
            <div class="primary-search">
              <span class="icon" aria-hidden="true">🔎</span>
              <input id="global-search" placeholder="Search" autocomplete="off" />
              <span class="badge" aria-hidden="true">AI</span>
            </div>
          </div>
          <div class="topbar-primary__section topbar-primary__section--right">
            <div class="topbar-primary__actions" role="toolbar" aria-label="Workspace quick actions">
              <button type="button" class="tp-action tp-action--primary">
                <ng-icon name="lucidePlusCircle" size="16"></ng-icon>
                <span>New</span>
              </button>
              <span class="topbar-primary__divider" aria-hidden="true"></span>
              <button type="button" class="tp-action tp-action--icon" title="Mark complete">
                <ng-icon name="lucideCheckCircle2" size="16"></ng-icon>
              </button>
              <button type="button" class="tp-action tp-action--icon" title="Tasks">
                <ng-icon name="lucideClipboardList" size="16"></ng-icon>
              </button>
              <button type="button" class="tp-action tp-action--icon" title="Record clip">
                <ng-icon name="lucideVideo" size="16"></ng-icon>
              </button>
              <button type="button" class="tp-action tp-action--icon" title="Set reminder">
                <ng-icon name="lucideAlarmClock" size="16"></ng-icon>
              </button>
              <button type="button" class="tp-action tp-action--icon" title="Docs">
                <ng-icon name="lucideFileText" size="16"></ng-icon>
              </button>
              <button type="button" class="tp-action tp-action--icon" title="Launcher">
                <ng-icon name="lucideGrid3x3" size="16"></ng-icon>
              </button>
              <button type="button" class="tp-avatar" title="Account menu">
                <span class="tp-avatar__initial">M</span>
                <span class="tp-avatar__status" aria-hidden="true"></span>
                <ng-icon name="lucideChevronDown" size="14"></ng-icon>
              </button>
            </div>
            <button
              type="button"
              class="tp-action tp-action--ghost"
              (click)="theme.toggle()"
              title="Toggle theme"
            >
              {{ theme.current === 'dark' ? 'Light' : 'Dark' }}
            </button>
          </div>
        </header>

        <!-- Secondary (white) topbar: breadcrumbs + actions -->
        <div class="topbar-secondary">
          <div style="display:flex;align-items:center;gap:8px;flex:1;">
            <span style="font-size:12px;color:var(--muted)">Home</span>
          </div>
          <button
            title="Manage cards (coming soon)"
            disabled
            style="height:28px;padding:0 12px;border:1px solid var(--ring);background:#f3f4f6;color:#9ca3af;border-radius:8px;cursor:not-allowed;font-size:13px;font-weight:500;margin-top:-2px;"
          >
            Manage cards
          </button>
        </div>

        <aside class="sidebar">
          <div class="ws-card">
            <div class="ws-head">
              <div class="ws-badge">M</div>
              <div class="ws-name" *ngIf="!collapsed()">Mohamed Ali's Workspace</div>
              <ng-icon *ngIf="!collapsed()" name="lucideChevronDown" size="16" style="margin-left:auto;opacity:.6"></ng-icon>
            </div>
            <div class="ws-sep"></div>
            <ul class="ws-pages">
              <li>
                <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="ws-link">
                  <ng-icon name="lucideHome" size="18"></ng-icon>
                  <span *ngIf="!collapsed()">Home</span>
                </a>
              </li>
              <li><a href="#" class="ws-link"><ng-icon name="lucideMail" size="18"></ng-icon><span *ngIf="!collapsed()">Inbox</span></a></li>
              <li><a href="#" class="ws-link"><ng-icon name="lucideUsers" size="18"></ng-icon><span *ngIf="!collapsed()">Teams</span></a></li>
              <li><a href="#" class="ws-link"><ng-icon name="lucideFileText" size="18"></ng-icon><span *ngIf="!collapsed()">Docs</span></a></li>
              <li><a href="#" class="ws-link"><ng-icon name="lucideBarChart2" size="18"></ng-icon><span *ngIf="!collapsed()">Dashboards</span></a></li>
              <li><a href="#" class="ws-link"><ng-icon name="lucidePenSquare" size="18"></ng-icon><span *ngIf="!collapsed()">Whiteboards</span></a></li>
              <li><a href="#" class="ws-link"><ng-icon name="lucideClipboardList" size="18"></ng-icon><span *ngIf="!collapsed()">Forms</span></a></li>
              <li><a href="#" class="ws-link"><ng-icon name="lucideVideo" size="18"></ng-icon><span *ngIf="!collapsed()">Clips</span></a></li>
              <li><a href="#" class="ws-link"><ng-icon name="lucideActivity" size="18"></ng-icon><span *ngIf="!collapsed()">Pulse</span></a></li>
              <li><a href="#" class="ws-link"><ng-icon name="lucideTarget" size="18"></ng-icon><span *ngIf="!collapsed()">Goals</span></a></li>
              <li><a href="#" class="ws-link"><ng-icon name="lucideClock" size="18"></ng-icon><span *ngIf="!collapsed()">Timesheets</span></a></li>
              <li><a href="#" class="ws-link"><ng-icon name="lucideMoreHorizontal" size="18"></ng-icon><span *ngIf="!collapsed()">More</span></a></li>
            </ul>
          </div>

          <div class="sidebar-footer">
            <span *ngIf="!collapsed()">© NABD • v0.1</span>
          </div>
        </aside>

        <main class="main">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  providers: [{ provide: DATA_SOURCE, useExisting: MocksService }]
})
export class AppComponent {
  collapsed = signal(false);
  readonly uiZoom = inject(UiZoomService);
  readonly uiZoomValue = toSignal(this.uiZoom.zoom$, { initialValue: 1 });
  readonly uiZoomInverse = computed(() => Number((1 / this.uiZoomValue()).toFixed(4)));
  readonly theme = inject(ThemeService);

  toggle() {
    this.collapsed.update((value) => !value);
  }

  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent) {
    if (!event.altKey) return;
    event.preventDefault();
    const delta = Math.sign(event.deltaY) * -0.05;
    this.uiZoom.inc(delta);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent) {
    if (!event.altKey) return;
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.uiZoom.inc();
    } else if (event.key === '-') {
      event.preventDefault();
      this.uiZoom.dec();
    } else if (event.key === '0') {
      event.preventDefault();
      this.uiZoom.reset();
    }
  }
}
