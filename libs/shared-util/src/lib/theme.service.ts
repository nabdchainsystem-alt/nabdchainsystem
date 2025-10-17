import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private mode: ThemeMode = 'light';

  constructor() {
    this.apply(this.mode);
  }

  get current(): ThemeMode {
    return this.mode;
  }

  toggle() {
    this.apply(this.mode === 'dark' ? 'light' : 'dark');
  }

  apply(mode: ThemeMode) {
    this.mode = mode;
    const body = this.document?.body;
    if (!body) return;
    body.dataset['theme'] = mode;
  }
}
