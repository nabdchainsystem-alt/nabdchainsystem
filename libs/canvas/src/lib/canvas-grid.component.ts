import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import {
  DDUIData,
  GridItemHTMLElement,
  GridStack,
  GridStackNode,
  GridStackOptions,
  GridStackWidget,
} from 'gridstack';
import * as echarts from 'echarts';
import { GridOptions, createGrid } from 'ag-grid-community';
import { DATA_SOURCE } from '@nabdchainsystem/mocks';
import { BlockRegistry } from './block-registry.service';
import { BlockKind } from './block-types';

interface Block extends GridStackWidget {
  id: string;
  kind: BlockKind;
  title?: string;
}

type BlockEnhancement = {
  observer?: ResizeObserver;
};

export const DEFAULT_CANVAS_STORAGE_KEY = 'ncs.canvas.home';

const HOME_DEFAULT_BLOCKS: readonly Block[] = [
  { id: 'kpi', kind: 'kpi', x: 0, y: 0, w: 6, h: 4, title: 'Spend Snapshot' },
  { id: 'flow', kind: 'chart', x: 6, y: 0, w: 12, h: 6, title: 'Inbound vs Outbound' },
  { id: 'recent', kind: 'table', x: 0, y: 4, w: 12, h: 8, title: 'Recent POs' },
  { id: 'docs', kind: 'table', x: 12, y: 6, w: 12, h: 8, title: 'Docs' },
  { id: 'folders', kind: 'table', x: 0, y: 12, w: 12, h: 6, title: 'Folders' },
  { id: 'lists', kind: 'table', x: 12, y: 14, w: 12, h: 8, title: 'Lists' },
];

export const HOME_CANVAS_BLOCKS = HOME_DEFAULT_BLOCKS;

const BLOCK_KIND_VALUES: readonly BlockKind[] = [
  'kpi',
  'table',
  'chart',
  'agenda',
  'tasks',
  'subtasks',
  'recents',
  'my-work',
  'assigned-to-me',
  'task-statuses',
  'priorities',
  'views',
  'custom-fields',
  'automations',
  'docs',
  'whiteboards',
  'dashboards',
  'time-tracking',
  'goals-okrs',
  'sprints-boards',
  'forms',
  'integrations',
];

export const canvasStorageKeyForRoom = (roomId?: string) =>
  roomId ? `ncs.canvas.room.${roomId}` : DEFAULT_CANVAS_STORAGE_KEY;

@Component({
  selector: 'lib-canvas-grid',
  standalone: true,
  imports: [CommonModule],
  styleUrls: ['./canvas-grid.component.scss'],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="home-header">
      <h1>Good morning, Mohamed</h1>
    </div>
    <section class="home-placeholder" aria-labelledby="home-cards-title" *ngIf="!hasBlocks()">
      <div class="illustration" aria-hidden="true"></div>
      <h2 id="home-cards-title">Add cards onto your home in order to customize it to your needs.</h2>
      <p class="muted">You can add reports, lists, and KPIs here. We'll hook this up to real cards soon.</p>
      <button
        type="button"
        id="btn-home-customize"
        class="primary"
        title="Customize cards"
        (click)="openManage()"
      >
        Customize
      </button>
    </section>
    <div class="grid-stack gs-container"></div>
  `,
})
export class CanvasGridComponent implements OnInit, OnDestroy {
  private host = inject(ElementRef<HTMLElement>);
  private registry = inject(BlockRegistry);
  private dataSource = inject(DATA_SOURCE, { optional: true }) as
    | {
        getKpi?: () => unknown;
        getTable?: () => { rows: any[] };
        getMonthlyFlow?: () => { months: string[]; inbound: number[]; outbound: number[] };
      }
    | undefined;
  private grid?: GridStack;
  private pushSnapshotScheduled = false;
  private undo: Block[][] = [];
  private redo: Block[][] = [];
  private suppressHistory = false;
  private readonly hasBlocksSignal = signal(false);
  private mutationObserver?: MutationObserver;
  private lastLayoutSignature = '';
  private blockEnhancements = new Map<HTMLElement, BlockEnhancement>();
  private scheduledResize = new Set<HTMLElement>();
  private pointerInteracting = false;
  private pendingResizes = new Map<HTMLElement, () => void>();
  private dragPointerOffset: { x: number; y: number } | undefined;
  private dragHelperEl: HTMLElement | undefined;
  private activeResizeHandle: HTMLElement | undefined;
  private storageKeyValue = DEFAULT_CANVAS_STORAGE_KEY;
  private defaultBlocksValue: readonly Block[] = HOME_DEFAULT_BLOCKS;
  private isInitialized = false;

  @Input()
  set storageKey(value: string | undefined) {
    const next = value && value.trim().length > 0 ? value.trim() : DEFAULT_CANVAS_STORAGE_KEY;
    if (next === this.storageKeyValue) {
      return;
    }
    this.storageKeyValue = next;
    if (this.isInitialized) {
      this.loadInitial();
    }
  }

  get storageKey() {
    return this.storageKeyValue;
  }

  @Input()
  set defaultBlocks(value: readonly Block[] | undefined) {
    const next = Array.isArray(value) ? Array.from(value) : HOME_DEFAULT_BLOCKS;
    const current = this.defaultBlocksValue;
    if (this.areDefaultBlocksEqual(current, next)) {
      return;
    }
    this.defaultBlocksValue = next;
    if (this.isInitialized) {
      this.loadInitial();
    }
  }

  @HostBinding('class.has-widgets')
  get hasWidgetsClass() {
    return this.hasBlocksSignal();
  }
  private readonly handleAddBlock = (event: Event) => {
    const detail = (event as CustomEvent<{ kind?: string }>).detail;
    const kind = typeof detail?.kind === 'string' ? detail.kind : undefined;
    if (!kind || !this.isBlockKind(kind)) {
      return;
    }
    this.add(kind);
  };
  private readonly handleRemoveBlock = (event: Event) => {
    const detail = (event as CustomEvent<{ kind?: string; id?: string }>).detail;
    const id = typeof detail?.id === 'string' ? detail.id : undefined;
    const kind = typeof detail?.kind === 'string' ? detail.kind : undefined;
    if (id) {
      this.removeById(id);
      return;
    }
    if (!kind || !this.isBlockKind(kind)) {
      return;
    }
    this.removeByKind(kind);
  };
  private readonly handleContentChanged = (event: Event) => {
    const detail = (event as CustomEvent<{ element?: HTMLElement | null }>).detail;
    const element = detail?.element;
    if (!element) {
      return;
    }
    const gridItem = element.closest('.grid-stack-item') as GridItemHTMLElement | null;
    if (!gridItem) {
      return;
    }
    this.scheduleResize(gridItem, () => this.resizeToContent(gridItem));
  };

  hasBlocks() {
    return this.hasBlocksSignal();
  }

  private syncPresence() {
    if (!this.grid) {
      this.hasBlocksSignal.set(false);
      return;
    }
    const nodes = this.grid.engine?.nodes ?? [];
    const kinds = nodes
      .map((node) => node.el?.dataset['kind'])
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
    const uniqueKinds = Array.from(new Set(kinds)).sort();
    const has = nodes.length > 0;
    if (this.hasBlocksSignal() !== has) {
      this.hasBlocksSignal.set(has);
    }
    const signature = `${nodes.length}|${uniqueKinds.join(',')}`;
    if (signature !== this.lastLayoutSignature && typeof window !== 'undefined') {
      this.lastLayoutSignature = signature;
      window.dispatchEvent(
        new CustomEvent('ncs:layout-changed', { detail: { count: nodes.length, kinds: uniqueKinds } }),
      );
    }
  }

  ngOnInit(): void {
    const el = this.host.nativeElement.querySelector('.grid-stack') as HTMLElement;
    const opts: GridStackOptions = {
      column: 24,
      cellHeight: 24,
      margin: 8,
      float: true,
      minRow: 12,
      animate: true,
      draggable: {
        handle: '.hd',
        scroll: true,
        appendTo: 'body',
        cancel: 'input,textarea,button,select,option,.cdk-drag-handle,.cdk-drop-list',
        helper: (element) => this.createDragHelper(element),
        start: (event, ui) => this.onDragStart(event, ui),
        drag: (event, ui) => this.onDragMove(event, ui),
        stop: () => this.onDragStop(),
      },
      resizable: { handles: 'all' },
      acceptWidgets: true,
    };
    this.grid = GridStack.init(opts, el);
    this.host.nativeElement.addEventListener('pointerdown', this.onResizeHandlePointerDown);

    if (typeof MutationObserver !== 'undefined') {
      this.mutationObserver = new MutationObserver(() => this.syncPresence());
      this.mutationObserver.observe(el, { childList: true });
    }

    const schedule = () => {
      if (this.suppressHistory || this.pushSnapshotScheduled) {
        return;
      }
      this.pushSnapshotScheduled = true;
      setTimeout(() => {
        this.pushSnapshotScheduled = false;
        this.persist();
        this.pushHistory();
      }, 120);
    };

    this.grid.on('change', (_event, items) => {
      schedule();
      items?.forEach((item) => {
        const el = item?.el as GridItemHTMLElement | undefined;
        if (el) {
          this.enforceMinSize(el);
        }
      });
    });
    this.grid.on('added removed', schedule);
    this.grid.on('added', (_event, items) => {
      items?.forEach((item) => this.decorateNode(item));
      this.syncPresence();
    });
    this.grid.on('removed', (_event, items) => {
      items?.forEach((item) => {
        const el = item?.el as GridItemHTMLElement | undefined;
        if (!el) {
          return;
        }
        this.destroyEnhancements(el);
        const kind =
          (el.dataset['kind'] as BlockKind | undefined) ??
          ((item as unknown as Partial<Block>).kind as BlockKind | undefined);
        const id = el.dataset['id'] ?? (item?.id as string | undefined);
        if (typeof window !== 'undefined' && kind) {
          window.dispatchEvent(
            new CustomEvent('ncs:block-removed', {
              detail: { kind, id, count: this.kindCount(kind) },
            }),
          );
        }
      });
      this.syncPresence();
    });
    this.grid.on('dragstart resizestart', () => this.beginPointerInteraction());
    this.grid.on('dragstop resizestop', (_event: Event, item: GridStackNode) => {
      this.endPointerInteraction();
      this.clearActiveResizeHandle();
      const el = item?.el as GridItemHTMLElement | undefined;
      if (el) {
        this.enforceMinSize(el);
        this.scheduleResize(el, () => this.resizeToContent(el));
      }
    });

    this.loadInitial();
    this.syncPresence();
    this.isInitialized = true;

    if (typeof window !== 'undefined') {
      window.addEventListener('ncs:add-block', this.handleAddBlock);
      window.addEventListener('ncs:remove-block', this.handleRemoveBlock);
      window.addEventListener('ncs:block-content-changed', this.handleContentChanged as EventListener);
    }
  }

  ngOnDestroy(): void {
    this.grid?.offAll();
    this.grid?.destroy(false);
    this.host.nativeElement.removeEventListener('pointerdown', this.onResizeHandlePointerDown);
    this.mutationObserver?.disconnect();
    if (typeof window !== 'undefined') {
      window.removeEventListener('ncs:add-block', this.handleAddBlock);
      window.removeEventListener('ncs:remove-block', this.handleRemoveBlock);
      window.removeEventListener(
        'ncs:block-content-changed',
        this.handleContentChanged as EventListener,
      );
    }
    this.blockEnhancements.forEach((entry) => {
      entry.observer?.disconnect();
    });
    this.blockEnhancements.clear();
  }

  add(kind: BlockKind) {
    if (!this.grid) return;
    const base: Block = {
      id: this.makeId(kind),
      kind,
      ...this.defaultSize(kind),
      autoPosition: true,
      title: this.titleFor(kind),
    };
    const block = this.normalizeBlock(base);
    const el = this.grid.addWidget({ ...block, content: this.blockContent(block) });
    this.decorateElement(el, block);
    this.persist();
    this.pushHistory();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ncs:block-added', {
          detail: { kind, id: block.id, count: this.kindCount(kind) },
        }),
      );
    }
  }

  private defaultSize(kind: BlockKind) {
    switch (kind) {
      case 'agenda':
        return { w: 24, h: 12 };
      case 'tasks':
        return { w: 12, h: 12 };
      case 'subtasks':
        return { w: 8, h: 10 };
      case 'dashboards':
        return { w: 10, h: 8 };
      case 'my-work':
      case 'assigned-to-me':
      case 'docs':
      case 'whiteboards':
      case 'goals-okrs':
      case 'sprints-boards':
        return { w: 8, h: 6 };
      case 'recents':
      case 'task-statuses':
      case 'priorities':
      case 'views':
      case 'custom-fields':
      case 'automations':
      case 'time-tracking':
      case 'forms':
      case 'integrations':
        return { w: 6, h: 5 };
      default:
        return { w: 6, h: 4 };
    }
  }

  private normalizeBlock(block: Block): Block {
    const { w: minW, h: minH } = this.minSize(block.kind);
    return {
      ...block,
      w: Math.max(block.w ?? minW, minW),
      h: Math.max(block.h ?? minH, minH),
      minW,
      minH,
    };
  }

  private minSize(kind: BlockKind) {
    switch (kind) {
      case 'agenda':
        return { w: 12, h: 8 };
      case 'tasks':
        return { w: 8, h: 6 };
      case 'subtasks':
        return { w: 6, h: 5 };
      case 'dashboards':
        return { w: 6, h: 5 };
      case 'my-work':
      case 'assigned-to-me':
      case 'docs':
      case 'whiteboards':
      case 'goals-okrs':
      case 'sprints-boards':
        return { w: 5, h: 4 };
      case 'recents':
      case 'task-statuses':
      case 'priorities':
      case 'views':
      case 'custom-fields':
      case 'automations':
      case 'time-tracking':
      case 'forms':
      case 'integrations':
        return { w: 4, h: 4 };
      case 'table':
      case 'chart':
        return { w: 4, h: 4 };
      case 'kpi':
      default:
        return { w: 3, h: 3 };
    }
  }

  private removeById(id: string) {
    if (!this.grid) return;
    const nodes = this.grid.engine?.nodes ?? [];
    const target = nodes.find((node) => {
      const nodeId = node.id ?? node.el?.dataset['id'];
      return nodeId === id;
    });
    if (target?.el) {
      this.grid.removeWidget(target.el);
      this.persist();
      this.pushHistory();
      this.syncPresence();
    }
  }

  private removeByKind(kind: BlockKind) {
    if (!this.grid) return;
    const nodes = this.grid.engine?.nodes ?? [];
    const target = nodes.find(
      (node) => (node.el?.dataset['kind'] as BlockKind | undefined) === kind,
    );
    if (target?.el) {
      this.grid.removeWidget(target.el);
      this.persist();
      this.pushHistory();
      this.syncPresence();
    }
  }

  private resizeToContent(item: GridItemHTMLElement) {
    const grid = this.grid;
    if (!grid) {
      return;
    }
    const content = item.querySelector('.grid-stack-item-content') as HTMLElement | null;
    if (!content) {
      return;
    }
    const primary = content.firstElementChild as HTMLElement | null;
    const inner = primary ?? content;
    const measuredHeight = inner.offsetHeight;
    if (!measuredHeight) {
      return;
    }
    const margin = this.currentMargin();
    const cellHeight = this.currentCellHeight();
    const unit = cellHeight + margin;
    if (unit <= 0) {
      return;
    }
    const desired = Math.max(2, Math.ceil((measuredHeight + margin * 2) / unit));
    const node = item.gridstackNode;
    if (!node) {
      return;
    }
    const current = node.h ?? this.defaultSize((node.el?.dataset['kind'] as BlockKind) ?? 'kpi').h;
    if (desired > current) {
      grid.update(item, { h: desired });
    }
  }

  private scheduleResize(wrapper: HTMLElement, task: () => void) {
    if (!wrapper.isConnected) {
      return;
    }
    if (this.pointerInteracting) {
      this.pendingResizes.set(wrapper, task);
      return;
    }
    if (this.scheduledResize.has(wrapper)) {
      return;
    }
    this.scheduledResize.add(wrapper);
    requestAnimationFrame(() => {
      this.scheduledResize.delete(wrapper);
      if (this.pointerInteracting || !wrapper.isConnected) {
        return;
      }
      task();
    });
  }

  private onResizeHandlePointerDown = (event: PointerEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const handle = target.closest('.ui-resizable-handle') as HTMLElement | null;
    if (!handle) {
      return;
    }
    this.setActiveResizeHandle(handle);
    const release = () => {
      this.clearActiveResizeHandle(handle);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
  };

  private setActiveResizeHandle(handle: HTMLElement) {
    if (this.activeResizeHandle === handle) {
      return;
    }
    this.clearActiveResizeHandle();
    handle.classList.add('ncs-resize-handle-active');
    this.activeResizeHandle = handle;
  }

  private clearActiveResizeHandle(handle?: HTMLElement) {
    if (!this.activeResizeHandle) {
      return;
    }
    if (handle && this.activeResizeHandle !== handle) {
      return;
    }
    this.activeResizeHandle.classList.remove('ncs-resize-handle-active');
    this.activeResizeHandle = undefined;
  }

  private beginPointerInteraction() {
    this.pointerInteracting = true;
    this.pendingResizes.clear();
  }

  private endPointerInteraction() {
    if (!this.pointerInteracting) {
      return;
    }
    this.pointerInteracting = false;
    if (this.pendingResizes.size === 0) {
      return;
    }
    const pending = Array.from(this.pendingResizes.entries());
    this.pendingResizes.clear();
    pending.forEach(([target, task]) => this.scheduleResize(target, task));
  }

  private createDragHelper(element: HTMLElement) {
    const clone = element.cloneNode(true) as HTMLElement;
    clone.removeAttribute('id');
    clone.classList.add('gs-drag-helper');
    clone.style.position = 'absolute';
    clone.style.width = `${element.offsetWidth}px`;
    clone.style.height = `${element.offsetHeight}px`;
    this.dragHelperEl = clone;
    return clone;
  }

  private onDragStart(event: Event, _ui: DDUIData) {
    if (!(event instanceof MouseEvent)) {
      this.dragPointerOffset = undefined;
      return;
    }
    const helper = this.dragHelperEl;
    if (!helper) {
      this.dragPointerOffset = undefined;
      return;
    }
    const rect = helper.getBoundingClientRect();
    this.dragPointerOffset = {
      x: event.pageX - (rect.left + window.scrollX),
      y: event.pageY - (rect.top + window.scrollY),
    };
    helper.classList.add('gs-drag-helper--active');
  }

  private onDragMove(event: Event, ui: DDUIData) {
    if (!(event instanceof MouseEvent) || !this.dragPointerOffset) {
      return;
    }
    const position = ui.position ?? (ui.position = { left: 0, top: 0 });
    position.left = event.pageX - this.dragPointerOffset.x;
    position.top = event.pageY - this.dragPointerOffset.y;
  }

  private onDragStop() {
    this.dragPointerOffset = undefined;
    if (this.dragHelperEl) {
      this.dragHelperEl.classList.remove('gs-drag-helper--active');
    }
    this.dragHelperEl = undefined;
  }

  private currentCellHeight(): number {
    const grid = this.grid;
    if (!grid) {
      return 24;
    }
    const value = grid.opts.cellHeight;
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return 24;
  }

  private currentMargin(): number {
    const grid = this.grid;
    if (!grid) {
      return 0;
    }
    const value = grid.opts.margin;
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value.split(' ')[0] ?? value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return 0;
  }

  private enforceMinSize(el: GridItemHTMLElement) {
    const grid = this.grid;
    const node = el.gridstackNode;
    if (!grid || !node) {
      return;
    }
    const kind = (el.dataset['kind'] as BlockKind | undefined) ?? 'kpi';
    const { w: minW, h: minH } = this.minSize(kind);
    const updates: Partial<GridStackWidget> = {};
    let changed = false;
    if ((node.w ?? minW) < minW) {
      updates.w = minW;
      changed = true;
    }
    if ((node.h ?? minH) < minH) {
      updates.h = minH;
      changed = true;
    }
    if ((node.minW ?? 0) !== minW) {
      updates.minW = minW;
      changed = true;
    }
    if ((node.minH ?? 0) !== minH) {
      updates.minH = minH;
      changed = true;
    }
    if (changed) {
      grid.update(el, updates);
    }
  }

  private kindCount(kind: string | BlockKind | undefined) {
    if (!kind || !this.grid) {
      return 0;
    }
    const nodes = this.grid.engine?.nodes ?? [];
    let total = 0;
    for (const node of nodes) {
      const nodeKind = node.el?.dataset['kind'] as BlockKind | undefined;
      if (nodeKind === kind) {
        total += 1;
      }
    }
    return total;
  }

  reset() {
    this.applyLayout(this.defaultLayout());
    this.pushHistory();
  }

  private loadInitial() {
    const savedRaw = localStorage.getItem(this.storageKeyValue) ?? this.readLegacyLayout();
    let blocks: Block[];
    if (savedRaw) {
      try {
        blocks = JSON.parse(savedRaw) as Block[];
      } catch {
        blocks = this.defaultLayout();
      }
    } else {
      blocks = this.defaultLayout();
    }
    this.applyLayout(blocks);
    this.pushHistory(true);
  }

  private applyLayout(items: Block[]) {
    if (!this.grid) return;
    const blocks = this.cloneBlocks(items);
    this.suppressHistory = true;
    this.grid.removeAll();
    blocks.forEach((block) => {
      const normalized = this.normalizeBlock(block);
      const el = this.grid!.addWidget({ ...normalized, content: this.blockContent(normalized) });
      this.decorateElement(el, normalized);
    });
    this.suppressHistory = false;
    this.persist();
  }

  private decorateNode(node: GridStackNode) {
    if (!node.el) return;
    const el = node.el as GridItemHTMLElement;
    const kind = (el.dataset['kind'] as BlockKind) ?? ((node as unknown as Block).kind ?? 'kpi');
    const id = el.dataset['id'] ?? (node.id as string | undefined) ?? this.makeId(kind);
    node.id = id;
    this.decorateElement(el, { id, kind, title: el.querySelector('.ttl')?.textContent ?? undefined });
  }

  private decorateElement(el: GridItemHTMLElement, block: Partial<Block>) {
    const kind = block.kind ?? (el.dataset['kind'] as BlockKind) ?? 'kpi';
    const id = block.id ?? el.dataset['id'] ?? this.makeId(kind);
    el.dataset['kind'] = kind;
    el.dataset['id'] = id;
    el.dataset['storageKey'] = this.storageKeyValue;
    this.destroyEnhancements(el);
    const title = block.title ?? el.querySelector('.ttl')?.textContent ?? this.titleFor(kind);
    const markup = this.blockContent({ id, kind, title });
    const content = el.querySelector('.grid-stack-item-content');
    if (content) {
      content.innerHTML = markup;
    } else {
      el.innerHTML = markup;
    }
    this.bindActions(el);
    this.enhanceBlock(el, { id, kind, title });
    this.enforceMinSize(el);
  }

  private destroyEnhancements(el: HTMLElement) {
    const entry = this.blockEnhancements.get(el);
    if (!entry) return;
    entry.observer?.disconnect();
    this.blockEnhancements.delete(el);
  }

  private blockContent(block: Partial<Block> & { kind: BlockKind }) {
    const title = block.title ?? this.titleFor(block.kind);
    const data = this.pickData(block.kind);
    return `
      <div class="block" data-canvas-storage="${this.storageKeyValue}" data-block-kind="${block.kind}">
        <div class="hd">
          <span class="ttl">${title}</span>
          <div class="actions">
            <button data-act="smaller">−</button>
            <button data-act="bigger">+</button>
            <button data-act="remove">Delete</button>
          </div>
        </div>
        <div class="bd">${this.registry.render(block.kind, data)}</div>
      </div>
    `;
  }

  private bindActions(el: GridItemHTMLElement) {
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('button[data-act]'));
    buttons.forEach((btn) => {
      const action = btn.dataset['act'];
      btn.onclick = () => {
        if (!this.grid) return;
        const node = el.gridstackNode;
        if (!node) return;
        if (action === 'remove') {
          this.grid.removeWidget(el);
        } else if (action === 'bigger') {
          this.grid.update(el, {
            w: (node.w ?? 6) + 2,
            h: (node.h ?? 4) + 2,
          });
        } else if (action === 'smaller') {
          this.grid.update(el, {
            w: Math.max(2, (node.w ?? 6) - 2),
            h: Math.max(2, (node.h ?? 4) - 2),
          });
        }
        this.enforceMinSize(el);
        this.persist();
        this.pushHistory();
      };
    });
  }

  private enhanceBlock(wrapper: HTMLElement, block: Partial<Block> & { kind: BlockKind }) {
    const body = wrapper.querySelector('.bd') as HTMLElement | null;
    if (!body) return;
    const gridItem = wrapper as GridItemHTMLElement;
    this.destroyEnhancements(wrapper);

    if (block.kind === 'chart') {
      const el = document.createElement('div');
      el.style.width = '100%';
      el.style.height = '100%';
      body.innerHTML = '';
      body.appendChild(el);
      const chart = echarts.init(el);
      const flow = this.dataSource?.getMonthlyFlow?.() ?? {
        months: [],
        inbound: [],
        outbound: [],
      };
      chart.setOption({
        tooltip: { trigger: 'axis' },
        legend: { data: ['Inbound', 'Outbound'] },
        grid: { left: 40, right: 16, top: 26, bottom: 28 },
        xAxis: { type: 'category', data: flow.months },
        yAxis: { type: 'value' },
        series: [
          { name: 'Inbound', type: 'bar', data: flow.inbound },
          { name: 'Outbound', type: 'bar', data: flow.outbound },
        ],
      });
      let observer: ResizeObserver | undefined;
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => {
          this.scheduleResize(wrapper, () => {
            chart.resize();
            this.resizeToContent(gridItem);
          });
        });
        observer.observe(el);
      }
      this.blockEnhancements.set(wrapper, { observer });
      this.scheduleResize(wrapper, () => this.resizeToContent(gridItem));
      return;
    }

    if (block.kind === 'table') {
      const el = document.createElement('div');
      el.style.width = '100%';
      el.style.height = '100%';
      el.className = 'ag-theme-quartz';
      body.innerHTML = '';
      body.appendChild(el);
      const tableData = this.dataSource?.getTable?.();
      const opts: GridOptions = {
        rowData: tableData?.rows ?? [],
        columnDefs: [
          { field: 'po', headerName: 'PO', flex: 1, pinned: 'left' },
          { field: 'vendor', headerName: 'Vendor', flex: 1.5 },
          {
            field: 'amount',
            headerName: 'Amount',
            flex: 1,
            valueFormatter: (p) => (p.value != null ? `SAR ${Number(p.value).toLocaleString()}` : ''),
          },
          { field: 'status', headerName: 'Status', flex: 1 },
          { field: 'date', headerName: 'Date', flex: 1, sort: 'desc' },
        ],
        defaultColDef: { resizable: true, sortable: true, filter: true },
      };
      createGrid(el, opts);
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() =>
          this.scheduleResize(wrapper, () => this.resizeToContent(gridItem)),
        );
        observer.observe(el);
        this.blockEnhancements.set(wrapper, { observer });
      }
      this.scheduleResize(wrapper, () => this.resizeToContent(gridItem));
      return;
    }

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() =>
        this.scheduleResize(wrapper, () => this.resizeToContent(gridItem)),
      );
      observer.observe(body);
      this.blockEnhancements.set(wrapper, { observer });
    }
    this.scheduleResize(wrapper, () => this.resizeToContent(gridItem));
  }

  private pickData(kind: BlockKind) {
    if (!this.dataSource) return undefined;
    if (kind === 'kpi') {
      return this.dataSource.getKpi?.();
    }
    if (kind === 'table') {
      return this.dataSource.getTable?.();
    }
    return undefined;
  }

  private snapshot(): Block[] {
    const nodes = this.grid?.engine.nodes ?? [];
    return nodes.map((node) => {
      const el = node.el as GridItemHTMLElement;
      return {
        id: el.dataset['id'] ?? (node.id as string | undefined) ?? this.makeId('kpi'),
        kind: (el.dataset['kind'] as BlockKind) ?? 'kpi',
        x: node.x,
        y: node.y,
        w: node.w,
        h: node.h,
        title: el.querySelector('.ttl')?.textContent ?? undefined,
      };
    });
  }

  private cloneBlocks(blocks: Block[]): Block[] {
    return blocks.map((block) => ({ ...block }));
  }

  private areDefaultBlocksEqual(a: readonly Block[], b: readonly Block[]) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => {
      const other = b[index];
      if (!other) return false;
      return (
        item.id === other.id &&
        item.kind === other.kind &&
        item.x === other.x &&
        item.y === other.y &&
        item.w === other.w &&
        item.h === other.h &&
        item.title === other.title
      );
    });
  }

  private defaultLayout(): Block[] {
    return this.cloneBlocks(Array.from(this.defaultBlocksValue));
  }

  private readLegacyLayout(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
    if (this.storageKeyValue === DEFAULT_CANVAS_STORAGE_KEY) {
      const legacy = localStorage.getItem('ncs.canvas.v1');
      if (legacy) {
        try {
          localStorage.setItem(DEFAULT_CANVAS_STORAGE_KEY, legacy);
          localStorage.removeItem('ncs.canvas.v1');
        } catch {
          /* noop */
        }
        return legacy;
      }
    }
    return null;
  }

  private persist() {
    localStorage.setItem(this.storageKeyValue, JSON.stringify(this.snapshot()));
    this.syncPresence();
  }

  saveLayout() {
    const data = localStorage.getItem(this.storageKeyValue) ?? '[]';
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    anchor.download = 'nabd-canvas-layout.json';
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  loadLayout() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const items = JSON.parse(String(reader.result)) as Block[];
          this.applyLayout(items);
          this.pushHistory();
        } catch (error) {
          console.warn('Invalid layout file', error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  private pushHistory(initial = false) {
    const snap = this.snapshot();
    if (initial) {
      this.undo = [snap];
      this.redo = [];
      return;
    }
    const last = this.undo[this.undo.length - 1];
    if (!last || !this.areSnapshotsEqual(last, snap)) {
      this.undo.push(snap);
      if (this.undo.length > 50) {
        this.undo.shift();
      }
      this.redo = [];
    }
  }

  private areSnapshotsEqual(a: Block[], b: Block[]) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => {
      const other = b[index];
      if (!other) return false;
      return (
        item.id === other.id &&
        item.kind === other.kind &&
        item.x === other.x &&
        item.y === other.y &&
        item.w === other.w &&
        item.h === other.h &&
        (item.title ?? '') === (other.title ?? '')
      );
    });
  }

  undoAction() {
    if (this.undo.length <= 1) return;
    const current = this.undo.pop();
    if (!current) return;
    this.redo.push(current);
    const previous = this.undo[this.undo.length - 1];
    if (previous) {
      this.applyLayout(previous);
    }
  }

  redoAction() {
    if (this.redo.length === 0) return;
    const next = this.redo.pop();
    if (!next) return;
    this.undo.push(next);
    this.applyLayout(next);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent) {
    const meta = event.ctrlKey || event.metaKey;
    if (!meta) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.undoAction();
    } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
      event.preventDefault();
      this.redoAction();
    }
  }

  private titleFor(kind: BlockKind) {
    switch (kind) {
      case 'kpi':
        return 'KPI';
      case 'table':
        return 'Table';
      case 'agenda':
        return 'Agenda';
      case 'tasks':
        return 'Tasks';
      case 'subtasks':
        return 'Subtasks';
      case 'recents':
        return 'Recents';
      case 'my-work':
        return 'My Work';
      case 'assigned-to-me':
        return 'Assigned to Me';
      case 'task-statuses':
        return 'Task Statuses';
      case 'priorities':
        return 'Priorities';
      case 'views':
        return 'Views';
      case 'custom-fields':
        return 'Custom Fields';
      case 'automations':
        return 'Automations';
      case 'docs':
        return 'Docs';
      case 'whiteboards':
        return 'Whiteboards';
      case 'dashboards':
        return 'Dashboards';
      case 'time-tracking':
        return 'Time Tracking';
      case 'goals-okrs':
        return 'Goals & OKRs';
      case 'sprints-boards':
        return 'Sprints & Boards';
      case 'forms':
        return 'Forms';
      case 'integrations':
        return 'Integrations';
      default:
        return 'Chart';
    }
  }

  private makeId(kind: BlockKind) {
    const suffix =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    return `${kind}-${suffix}`;
  }

  private isBlockKind(value: string): value is BlockKind {
    return (BLOCK_KIND_VALUES as readonly string[]).includes(value);
  }

  openManage() {
    window.dispatchEvent(new CustomEvent('nabd:open-manage'));
  }
}
