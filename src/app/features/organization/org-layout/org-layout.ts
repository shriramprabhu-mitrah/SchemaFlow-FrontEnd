import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { Toast } from '../../../shared/toaster/toast/toast';
import { Icons } from '../../../core/component/icons/icons';
import { OrganizationService } from '../services/organization.service';

@Component({
  selector: 'app-org-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, Toast, Icons],
  templateUrl: './org-layout.html'
})
export class OrgLayoutComponent {
  private router = inject(Router);
  private auth = inject(AuthService);
  public dashService = inject(DashboardService);
  private orgService = inject(OrganizationService);
  sidebarCollapsed = false;

  ngOnInit() {
    this.checkScreenSize();
    window.addEventListener('resize', this.checkScreenSize.bind(this));

    const orgId = this.auth.getOrganizationId();
    if (orgId) {
      this.orgService.getSubscription(orgId).subscribe({
        next: (res: any) => {
          const sub = res?.data || res;
          this.dashService.currentOrgPlanSlug.set(sub?.plan_slug || 'free');
          this.dashService.currentOrgPlanStatus.set(sub?.status || 'active');
        },
        error: (err: any) => console.error('Failed to fetch org subscription', err)
      });
    }
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.checkScreenSize.bind(this));
  }

  private checkScreenSize() {
    if (window.innerWidth <= 768) {
      this.sidebarCollapsed = true;
    }
  }
  get userEmail(): string {
    return this.auth.getUserEmail() || '';
  }

  get userInitial(): string {
    return (this.userEmail ? this.userEmail.charAt(0) : 'U').toUpperCase();
  }

  get isOwner(): boolean {
    return this.auth.isOrganizationAdmin();
  }

  get pageTitle(): string {
    const url = this.router.url;
    if (url.includes('/dashboard')) return 'Organization Dashboard';
    if (url.includes('/settings')) return 'General Settings';
    if (url.includes('/subscription')) return 'Subscription';
    if (url.includes('/members')) return 'Members';
    if (url.includes('/roles')) return 'Roles';
    return 'Organization';
  }

  get showPremiumRoutes(): boolean {
    const plan = this.dashService.currentOrgPlanSlug();
    const isFree = plan === 'free' || !plan;
    const isExpired = this.dashService.isSubscriptionExpired() || this.dashService.currentOrgPlanStatus() === 'expired';
    return !isFree && !isExpired;
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  goToLandingPage(): void {
    this.router.navigate(['/']);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
