import { Routes } from '@angular/router';
import { CanvasPageComponent } from '@nabdchainsystem/canvas';

export const appRoutes: Routes = [
  { path: '', pathMatch: 'full', component: CanvasPageComponent },
  { path: '**', redirectTo: '' },
];
