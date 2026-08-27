import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { Toast } from '../../../shared/toaster/toast/toast';
import { Icons } from '../../../core/component/icons/icons';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, Toast, Icons],
  templateUrl: './admin-layout.html'
})
export class AdminLayoutComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  public dashService = inject(DashboardService);

  sidebarCollapsed = false;

  navItems = [
    { path: '/admin/dashboard', icon: 'dashboard', label: 'Dashboard' },
    { path: '/admin/plans', icon: 'plans', label: 'Plans' },
    { path: '/admin/features', icon: 'features', label: 'Features' },
    { path: '/admin/organizations', icon: 'organizations', label: 'Organizations' },
    { path: '/admin/users', icon: 'users', label: 'Users' },
    { path: '/admin/subscriptions', icon: 'subscriptions', label: 'Subscriptions' },
    { path: '/admin/audit-logs', icon: 'audit', label: 'Audit Logs' },
  ];

  get userEmail(): string {
    return this.auth.getUserEmail();
  }

  get userInitial(): string {
    const email = this.userEmail;
    return email ? email.charAt(0).toUpperCase() : 'A';
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  goToDashboard(): void {
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
