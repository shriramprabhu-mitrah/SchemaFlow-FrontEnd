import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { DashboardService } from './dashboard.service';

@Injectable({
  providedIn: 'root'
})
export class SignOutService {
  readonly isOpen = signal<boolean>(false);
  readonly isSigningOut = signal<boolean>(false);

  private onConfirmCallback?: () => void;

  constructor(
    private auth: AuthService,
    private router: Router,
    private dashboardSvc: DashboardService
  ) {}

  prompt(onConfirm?: () => void): void {
    this.onConfirmCallback = onConfirm;
    this.isOpen.set(true);
  }

  cancel(): void {
    if (this.isSigningOut()) return;
    this.isOpen.set(false);
    this.onConfirmCallback = undefined;
  }

  confirm(): void {
    if (this.isSigningOut()) return;
    this.isSigningOut.set(true);

    try {
      const cb = this.onConfirmCallback;
      this.onConfirmCallback = undefined;
      this.isOpen.set(false);
      this.isSigningOut.set(false);

      if (cb) {
        cb();
      } else {
        this.defaultLogout();
      }
    } catch {
      this.isOpen.set(false);
      this.isSigningOut.set(false);
      this.router.navigate(['/login']);
    }
  }

  private defaultLogout(): void {
    this.auth.logout();
    this.dashboardSvc.clearDiagram(false);
    this.dashboardSvc.showToast('Logged out successfully.', 2500, 'success');
    this.router.navigate(['/login']);
  }
}

