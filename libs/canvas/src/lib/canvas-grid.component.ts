import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import {
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

const LS_KEY = 'ncs.canvas.v1';
const DEFAULT_BLOCKS: Block[] = [
  { id: 'kpi', kind: 'kpi', x: 0, y: 0, w: 6, h: 4, title: 'Spend Snapshot' },
  { id: 'flow', kind: 'chart', x: 6, y: 0, w: 12, h: 6, title: 'Inbound vs Outbound' },
  { id: 'recent', kind: 'table', x: 0, y: 4, w: 12, h: 8, title: 'Recent POs' },
  { id: 'docs', kind: 'table', x: 12, y: 6, w: 12, h: 8, title: 'Docs' },
  { id: 'folders', kind: 'table', x: 0, y: 12, w: 12, h: 6, title: 'Folders' },
  { id: 'lists', kind: 'table', x: 12, y: 14, w: 12, h: 8, title: 'Lists' },
];

@Component({
  selector: 'lib-canvas-grid',
  standalone: true,
  imports: [CommonModule],
  styles: [
    `
      .gs-container {
        min-width: 1200px;
        min-height: calc(100vh - 220px);
      }
      .grid-stack {
        background: transparent;
      }
      .block {
        width: 100%;
        height: 100%;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        display: grid;
        grid-template-rows: 36px 1fr;
        overflow: hidden;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
      }
      .block .hd {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 10px;
        font-size: 12px;
        color: #111827;
        border-bottom: 1px solid #f1f5f9;
        background: #fafafa;
      }
      .block .hd .actions {
        display: flex;
        gap: 6px;
      }
      .block .hd button {
        border: 1px solid #e5e7eb;
        background: #fff;
        height: 22px;
        padding: 0 8px;
        border-radius: 6px;
        cursor: pointer;
      }
      .block .bd {
        padding: 10px;
        color: #4b5563;
        font-size: 12px;
      }
      .home-header {
        margin: 0 0 12px;
      }
      .home-header h1 {
        margin: 0 0 0 -6px;
        font-size: 22px;
        font-weight: 600;
        color: #0f172a;
      }
      .home-placeholder {
        margin: 12px auto 18px;
        padding: 24px;
        border: 1px dashed rgba(148, 163, 184, 0.6);
        border-radius: 12px;
        background: var(--surface);
        display: grid;
        place-items: center;
        text-align: center;
        gap: 12px;
        width: 100%;
        max-width: 920px;
      }
      .home-placeholder .illustration {
        width: 180px;
        height: 110px;
        border-radius: 16px;
        background:
          linear-gradient(135deg, rgba(96, 165, 250, 0.2) 25%, transparent 25%) -12px 0 / 24px 24px,
          linear-gradient(225deg, rgba(96, 165, 250, 0.2) 25%, transparent 25%) -12px 0 / 24px 24px,
          linear-gradient(315deg, rgba(96, 165, 250, 0.2) 25%, transparent 25%) 0 0 / 24px 24px,
          linear-gradient(45deg, rgba(59, 130, 246, 0.2) 25%, transparent 25%) 0 0 / 24px 24px,
          linear-gradient(to bottom, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.2));
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
      }
      .home-placeholder h2 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: #0f172a;
        max-width: 420px;
      }
      .home-placeholder .muted {
        margin: 0;
        font-size: 12px;
        color: #64748b;
        max-width: 420px;
      }
      .home-placeholder .primary {
        border: 1px solid rgba(148, 163, 184, 0.7);
        background: #e2e8f0;
        color: #64748b;
        border-radius: 10px;
        padding: 0 18px;
        height: 30px;
        cursor: not-allowed;
        font-size: 12px;
        font-weight: 600;
      }
    `,
  ],
  template: `
    <div class="home-header">
      <h1>Good morning, Mohamed</h1>
    </div>
    <section class="home-placeholder" aria-labelledby="home-cards-title">
      <div class="illustration" aria-hidden="true"></div>
      <h2 id="home-cards-title">Add cards onto your home in order to customize it to your needs.</h2>
      <p class="muted">You can add reports, lists, and KPIs here. We'll hook this up to real cards soon.</p>
      <button type="button" id="btn-home-customize" class="primary" disabled title="Coming soon">
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

  ngOnInit(): void {
    const el = this.host.nativeElement.querySelector('.grid-stack') as HTMLElement;
    const opts: GridStackOptions = {
      column: 24,
      cellHeight: 24,
      margin: 8,
      float: true,
      minRow: 24,
      animate: true,
      draggable: { handle: '.hd', scroll: true, appendTo: 'body' },
      resizable: { handles: 'all' },
      acceptWidgets: true,
    };
    this.grid = GridStack.init(opts, el);

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

    this.grid.on('change', schedule);
    this.grid.on('added removed', schedule);
    this.grid.on('added', (_event, items) => items?.forEach((item) => this.decorateNode(item)));

    this.loadInitial();
  }

  ngOnDestroy(): void {
    this.grid?.offAll();
    this.grid?.destroy(false);
  }

  add(kind: BlockKind) {
    if (!this.grid) return;
    const block: Block = {
      id: this.makeId(kind),
      kind,
      w: 6,
      h: 4,
      autoPosition: true,
      title: this.titleFor(kind),
    };
    const el = this.grid.addWidget({ ...block, content: this.blockContent(block) });
    this.decorateElement(el, block);
    this.persist();
    this.pushHistory();
  }

  reset() {
    this.applyLayout(DEFAULT_BLOCKS);
    this.pushHistory();
  }

  private loadInitial() {
    const saved = localStorage.getItem(LS_KEY);
    const blocks: Block[] = saved ? JSON.parse(saved) : DEFAULT_BLOCKS;
    this.applyLayout(blocks);
    this.pushHistory(true);
  }

  private applyLayout(items: Block[]) {
    if (!this.grid) return;
    const blocks = this.cloneBlocks(items);
    this.suppressHistory = true;
    this.grid.removeAll();
    blocks.forEach((block) => {
      const el = this.grid!.addWidget({ ...block, content: this.blockContent(block) });
      this.decorateElement(el, block);
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
  }

  private blockContent(block: Partial<Block> & { kind: BlockKind }) {
    const title = block.title ?? this.titleFor(block.kind);
    const data = this.pickData(block.kind);
    return `
      <div class="block">
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
        this.persist();
        this.pushHistory();
      };
    });
  }

  private enhanceBlock(wrapper: HTMLElement, block: Partial<Block> & { kind: BlockKind }) {
    const body = wrapper.querySelector('.bd') as HTMLElement | null;
    if (!body) return;

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
      new ResizeObserver(() => chart.resize()).observe(el);
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
    }
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

  private persist() {
    localStorage.setItem(LS_KEY, JSON.stringify(this.snapshot()));
  }

  saveLayout() {
    const data = localStorage.getItem(LS_KEY) ?? '[]';
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
}
