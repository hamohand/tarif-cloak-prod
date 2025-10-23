import {
  ApplicationConfig,
  importProvidersFrom,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {OAuthModule} from 'angular-oauth2-oidc';
import {authInterceptor} from './core/config/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    importProvidersFrom(
      OAuthModule.forRoot({
        resourceServer: {
          allowedUrls: ['http://localhost:8081/api', '/api'],
          sendAccessToken: true
        }
      })
    ),
    provideHttpClient(
      withInterceptors([authInterceptor])
    )
  ]
};
