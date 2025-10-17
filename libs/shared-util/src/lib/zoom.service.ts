import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ZoomService {
  private _zoom$ = new BehaviorSubject<number>(1);
  readonly zoom$ = this._zoom$.asObservable();

  set(value: number) {
    const clamped = Math.min(2, Math.max(0.5, Number(value.toFixed(2))));
    this._zoom$.next(clamped);
  }

  inc(step = 0.05) {
    this.set(this._zoom$.value + step);
  }

  dec(step = 0.05) {
    this.set(this._zoom$.value - step);
  }

  reset() {
    this._zoom$.next(1);
  }
}
