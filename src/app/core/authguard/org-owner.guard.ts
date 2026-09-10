import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const orgOwnerGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn() && authService.isOrganizationAdmin()) {
    return true;
  }

  // Redirect to organization home if they are an admin/member, otherwise dashboard
  if (authService.isOrganizationAdmin() || authService.isOrganizationMember()) {
    return router.parseUrl('/organization');
  }
  return router.parseUrl('/dashboard');
};
