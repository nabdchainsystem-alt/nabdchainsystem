import { AsyncPipe, NgStyle } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import { ZoomService } from '@nabdchainsystem/shared-util';
import { CanvasGridComponent } from './canvas-grid.component';

@Component({
  selector: 'lib-canvas-page',
  standalone: true,
  imports: [AsyncPipe, NgStyle, CanvasGridComponent],
  template: `
    <div class="canvas-scroll">
      <div
        class="canvas"
        [ngStyle]="{ '--zoom-scale': (zoom.zoom$ | async) ?? 1 }"
      >
        <lib-canvas-grid />
      </div>
    </div>
  `,
})
export class CanvasPageComponent {
  zoom = inject(ZoomService);

  @HostListener('wheel', ['$event'])
  onWheel(e: WheelEvent) {
    if (!(e.ctrlKey || e.metaKey)) {
      return;
    }
    e.preventDefault();
    const delta = Math.sign(e.deltaY) * -0.05;
    this.zoom.inc(delta);
  }
  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
      e.preventDefault();
      this.zoom.inc();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === '-') {
      e.preventDefault();
      this.zoom.dec();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === '0') {
      e.preventDefault();
      this.zoom.reset();
    }
  }
}
