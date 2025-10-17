import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { attachErrorOverlay } from '@nabdchainsystem/shared-util';
import { provideNabdIcons } from './app/icons';

attachErrorOverlay();

bootstrapApplication(AppComponent, {
  providers: [provideRouter(appRoutes), provideNabdIcons()],
}).catch((err) => console.error(err));
