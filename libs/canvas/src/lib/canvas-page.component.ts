import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import {
  CanvasGridComponent,
  HOME_CANVAS_BLOCKS,
  canvasStorageKeyForRoom,
} from './canvas-grid.component';

@Component({
  selector: 'lib-canvas-page',
  standalone: true,
  imports: [CanvasGridComponent],
  template: `
    <div class="canvas-scroll">
      <div class="canvas">
        <lib-canvas-grid
          [storageKey]="storageKey()"
          [defaultBlocks]="defaultBlocks()"
        />
      </div>
    </div>
  `,
})
export class CanvasPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly roomId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('roomId'))),
    { initialValue: this.route.snapshot.paramMap.get('roomId') }
  );

  readonly storageKey = computed(() => canvasStorageKeyForRoom(this.roomId() ?? undefined));
  readonly defaultBlocks = computed(() => (this.roomId() ? [] : HOME_CANVAS_BLOCKS));
}

