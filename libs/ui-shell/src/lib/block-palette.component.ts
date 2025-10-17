import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { CdkDragEnd, CdkDragStart, DragDropModule } from '@angular/cdk/drag-drop';

@Component({
  selector: 'ncs-block-palette',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  styles: [
    `
      .item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        cursor: grab;
        background: #fff;
      }
      .item + .item {
        margin-top: 8px;
      }
    `,
  ],
  template: `
    <div
      class="item"
      cdkDrag
      [cdkDragData]="{ kind: 'kpi' }"
      (cdkDragStarted)="onStart($event, 'kpi')"
      (cdkDragEnded)="onEnd($event)"
    >
      KPI
    </div>
    <div
      class="item"
      cdkDrag
      [cdkDragData]="{ kind: 'table' }"
      (cdkDragStarted)="onStart($event, 'table')"
      (cdkDragEnded)="onEnd($event)"
    >
      Table
    </div>
    <div
      class="item"
      cdkDrag
      [cdkDragData]="{ kind: 'chart' }"
      (cdkDragStarted)="onStart($event, 'chart')"
      (cdkDragEnded)="onEnd($event)"
    >
      Chart
    </div>
  `,
})
export class BlockPaletteComponent {
  onStart(event: CdkDragStart, kind: string) {
    event.source.data = { kind };
    const ghost = document.createElement('div');
    ghost.className = 'grid-stack-item';
    ghost.setAttribute('gs-w', '6');
    ghost.setAttribute('gs-h', '4');
    ghost.dataset['kind'] = kind;

    const content = document.createElement('div');
    content.className = 'grid-stack-item-content';
    content.style.width = '240px';
    content.style.height = '120px';
    content.style.background = '#eef2ff';
    content.style.border = '1px dashed #93c5fd';
    content.style.borderRadius = '8px';
    content.style.display = 'grid';
    content.style.placeItems = 'center';
    content.textContent = `Add ${kind.toUpperCase()}`;

    ghost.appendChild(content);

    const dragRef = (event.source as any)._dragRef;
    if (dragRef) {
      dragRef._preview = ghost;
    }
    ghost.style.position = 'absolute';
    document.body.appendChild(ghost);
  }

  onEnd(event: CdkDragEnd) {
    const dragRef = (event.source as any)._dragRef;
    const preview: HTMLElement | undefined = dragRef?._preview;
    if (preview && preview.parentElement === document.body) {
      preview.remove();
    }
    if (dragRef) {
      dragRef._preview = null;
    }
  }
}
