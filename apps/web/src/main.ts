import { bootstrapApplication } from '@angular/platform-browser';
import { EnvironmentInjector } from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { attachErrorOverlay } from '@nabdchainsystem/shared-util';
import { provideNabdIcons } from './app/icons';
import { registerCustomElements } from './app/custom-elements';

attachErrorOverlay();

bootstrapApplication(AppComponent, {
  providers: [provideRouter(appRoutes), provideNabdIcons()],
})
  .then((appRef) => {
    const injector = appRef.injector as EnvironmentInjector;
    registerCustomElements(injector);
  })
  .catch((err) => console.error(err));
