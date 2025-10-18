import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UiZoomService {
  private readonly defaultZoom = 1;
  private readonly zoomSubject = new BehaviorSubject<number>(this.defaultZoom);
  readonly zoom$ = this.zoomSubject.asObservable();

  set(value: number) {
    const clamped = Math.min(1.5, Math.max(0.7, Number(value.toFixed(2))));
    this.zoomSubject.next(clamped);
  }

  inc(step = 0.05) {
    this.set(this.zoomSubject.value + step);
  }

  dec(step = 0.05) {
    this.set(this.zoomSubject.value - step);
  }

  reset() {
    this.zoomSubject.next(this.defaultZoom);
  }
}
