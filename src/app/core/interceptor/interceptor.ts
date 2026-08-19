import { HttpInterceptorFn, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { AppConfigService } from '../services/app-config.service';
import { Router } from '@angular/router';

import { catchError, switchMap, throwError, map } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const appConfig = inject(AppConfigService);
  const baseUrl = appConfig.environment?.apiConfig?.baseUrl || '';

  /** URLs that must NOT carry an Authorization header (public endpoints) */
  const publicUrls = [
    '/api/pricing/plans',
  ];
  const isPublicUrl = publicUrls.some(p => req.url.includes(p));

  if (baseUrl && req.url.startsWith(baseUrl)) {
    const token = auth.getToken();
    if (token && !isPublicUrl) {
      req = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
        withCredentials: true // ensures the refreshToken cookie rides along on every API call
      });
    } else {
      req = req.clone({ withCredentials: true });
    }
  }

  return next(req).pipe(
    map((event) => {
      if (event instanceof HttpResponse) {
        const body = event.body as any;
        if (body && (body.statusCode === 401 || body.status === 401)) {
          throw new HttpErrorResponse({
            error: body,
            status: 401,
            statusText: body.message || 'Unauthorized',
            url: req.url
          });
        }
      }
      return event;
    }),
    catchError((error: HttpErrorResponse) => {
      const isBypassedUrl =
        req.url.includes('/auth/login') ||
        req.url.includes('/auth/register') ||
        req.url.includes('/auth/refreshToken') ||
        req.url.includes('/auth/logout') ||
        req.url.includes('/api/diagrams/public') ||
        req.url.includes('/api/pricing');

      if (error.status === 401 && !isBypassedUrl) {
        return auth.refreshToken().pipe(
          switchMap(() => {
            const newToken = auth.getToken();
            const newReq = req.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` },
              withCredentials: true
            });
            return next(newReq);
          }),
          catchError((refreshErr) => {
            auth.clearLocalState();
            router.navigate(['/login']);
            return throwError(() => refreshErr);
          })
        );
      }

      return throwError(() => error);
    })
  );
};