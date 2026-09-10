import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptor/interceptor';
import { provideAppConfig } from './core/services/app-config.service';
import { provideClientHydration } from '@angular/platform-browser';
import { GlobalErrorHandler } from './core/services/global-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAppConfig(),
    provideClientHydration(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ],
};
