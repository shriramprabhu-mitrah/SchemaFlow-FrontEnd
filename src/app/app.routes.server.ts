import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Landing / public pages — SSR for SEO & fast first paint
  {
    path: '',
    renderMode: RenderMode.Server,
  },
  {
    path: 'pricing',
    renderMode: RenderMode.Server,
  },
  {
    path: 'login',
    renderMode: RenderMode.Client,
  },
  {
    path: 'auth/register',
    renderMode: RenderMode.Client,
  },
  {
    path: 'reset-password',
    renderMode: RenderMode.Client,
  },
  {
    path: 'accept-invitation',
    renderMode: RenderMode.Client,
  },
  // All other routes (dashboard, admin, org, etc.) — CSR
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
