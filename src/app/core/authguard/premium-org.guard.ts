import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { OrganizationService } from '../../features/organization/services/organization.service';
import { DashboardService } from '../services/dashboard.service';
import { map, catchError, of } from 'rxjs';

export const premiumOrgGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const orgService = inject(OrganizationService);
  const dashService = inject(DashboardService);

  const orgId = auth.getOrganizationId();
  if (!orgId) {
    router.navigate(['/login']);
    return false;
  }

  return orgService.getSubscription(orgId).pipe(
    map((res: any) => {
      const sub = res?.data || res;
      const planSlug = sub?.plan_slug || 'free';
      const status = sub?.status || 'active';
      
      const isFree = planSlug === 'free';
      const isExpired = dashService.isSubscriptionExpired() || status === 'expired';

      if (!isFree && !isExpired) {
        return true;
      }

      // Redirect to dashboard if they don't have premium access
      router.navigate(['/organization/dashboard']);
      return false;
    }),
    catchError(() => {
      router.navigate(['/organization/dashboard']);
      return of(false);
    })
  );
};
