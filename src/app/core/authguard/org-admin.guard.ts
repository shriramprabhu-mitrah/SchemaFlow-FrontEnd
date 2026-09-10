import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const orgAdminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn() && authService.isOrganizationAdmin()) {
    return true;
  }

  // Redirect to dashboard if they don't have access
  return router.parseUrl('/dashboard');
};
