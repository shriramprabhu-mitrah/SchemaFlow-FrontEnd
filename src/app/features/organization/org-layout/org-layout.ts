import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { Toast } from '../../../shared/toaster/toast/toast';
import { Icons } from '../../../core/component/icons/icons';

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
  sidebarCollapsed = false;

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
