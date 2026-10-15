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
    this.loading = true;
    this.auth.getUserFeatures().subscribe({
      next: (res: any) => {
        const p = res?.data?.purchasedPlan;
        if (p) {
          this.subscription = {
            ...p,
            plan: { name: p.name, slug: p.slug },
            status: p.status || 'active',
            billing_cycle: p.billing_cycle || 'monthly',
            current_period_end: p.current_period_end,
            next_billing_regular: p.next_billing_regular,
            offer_expired_notice: p.offer_expired_notice,
            price_monthly: p.price_monthly,
            price_annual: p.price_annual
          };
        } else {
          this.subscription = null;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.subscription = null;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
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
    const end = this.subscription?.current_period_end || this.subscription?.end_date;
    if (!end) return '—';
    return new Date(end).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  get isFree(): boolean {
    return !this.subscription || this.planSlug === 'free';
  }
}
