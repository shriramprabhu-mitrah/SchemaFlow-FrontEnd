import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { AppConfigService } from '../../../core/services/app-config.service';
import { Icons } from '../../../core/component/icons/icons';
import { ButtonComponent } from '../../../shared/button/button';
import { DashboardService } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-user-subscription',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonComponent],
  templateUrl: './user-subscription.html',
})
export class UserSubscriptionComponent implements OnInit {
  subscription: any = null;
  loading = true;
  upgrading = false;
  error = '';

  private http = inject(HttpClient);
  private appConfig = inject(AppConfigService);
  private cdr = inject(ChangeDetectorRef);

  constructor(
    private auth: AuthService,
    private router: Router,
    private svc: DashboardService
  ) { }

  ngOnInit(): void {
    this.loadSubscription();
  }

  loadSubscription(): void {
    // Try to load from a user subscription endpoint if it exists
    const base = this.appConfig.environment?.pricingApiUrls?.plans;
    const userSubUrl = base ? base.replace('/plans', '/user/subscription') : null;

    if (userSubUrl) {
      this.http.get<any>(userSubUrl, { withCredentials: true }).subscribe({
        next: (res) => {
          this.subscription = res?.data || res;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          // Not a hard failure — user may simply be on a free plan
          this.subscription = null;
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.loading = false;
    }
  }

  upgradeToPremium(): void {
    const upgradeUrl = this.appConfig.environment?.pricingApiUrls?.profileUpgrade;
    if (!upgradeUrl) {
      this.svc.showToast('Upgrade endpoint not configured.', 4000, 'error');
      return;
    }
    this.upgrading = true;
    this.http.post<any>(upgradeUrl, { planSlug: 'premium' }, { withCredentials: true }).subscribe({
      next: () => {
        this.auth.getUserFeatures().subscribe();
        this.upgrading = false;
        this.svc.showToast('Plan upgraded to Premium successfully!', 3000, 'success');
        if ((this.auth as any).setCurrentPlanSlug) {
          (this.auth as any).setCurrentPlanSlug('premium');
        }
        this.loadSubscription();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.upgrading = false;
        let errorMsg = 'Failed to upgrade plan. Please try again.';
        if (err?.error?.message) {
          errorMsg = err.error.message;
        } else if (typeof err?.error === 'string') {
          try { errorMsg = JSON.parse(err.error)?.message || err.error; } catch { errorMsg = err.error; }
        }
        this.svc.showToast(errorMsg, 4000, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  goToPricing(): void {
    this.router.navigate(['/pricing'], { queryParams: { type: 'individual' } });
  }

  get planName(): string {
    return this.subscription?.plan?.name || 'Free';
  }

  get planSlug(): string {
    return this.subscription?.plan?.slug || 'free';
  }

  get status(): string {
    return this.subscription?.status || 'active';
  }

  get renewalDate(): string {
    if (!this.subscription?.end_date) return '—';
    return new Date(this.subscription.end_date).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  get isFree(): boolean {
    return !this.subscription || this.planSlug === 'free';
  }
}
