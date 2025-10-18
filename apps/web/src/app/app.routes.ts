import { Routes } from '@angular/router';
import { CanvasPageComponent } from '@nabdchainsystem/canvas';
import { InboxPageComponent } from './inbox/inbox-page.component';

export const appRoutes: Routes = [
  { path: '', pathMatch: 'full', component: CanvasPageComponent },
  { path: 'inbox', component: InboxPageComponent },
  { path: 'rooms/:roomId', component: CanvasPageComponent },
  { path: '**', redirectTo: '' },
];
