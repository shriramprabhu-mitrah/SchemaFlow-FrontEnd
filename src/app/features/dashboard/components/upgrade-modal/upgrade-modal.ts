import { Component, Input, Output, EventEmitter, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../../core/services/auth.service';
import { AppConfigService } from '../../../../core/services/app-config.service';
import { Icons } from '../../../../core/component/icons/icons';
import { ButtonComponent } from '../../../../shared/button/button';
import { DashboardService } from '../../../../core/services/dashboard.service';
import { OrganizationService } from '../../../organization/services/organization.service';
import { timeout } from 'rxjs';
import { ContactSalesModalComponent } from '../../../../shared/components/modals/contact-sales-modal/contact-sales-modal';
import { EntitlementService } from '../../../../core/services/entitlement.service';
import { environment } from '../../../../../environment/environment';

@Component({
  selector: 'app-upgrade-modal',
  standalone: true,
  imports: [CommonModule, RouterModule, Icons, ButtonComponent, ContactSalesModalComponent],
  templateUrl: './upgrade-modal.html'
})
export class UpgradeModalComponent implements OnInit {
  private _visible = false;
  @Input()
  set visible(val: boolean) {
    this._visible = val;
    if (val) {
      this.isLoggedIn = this.auth.isLoggedIn();

      if (this.isLoggedIn) {
        const orgId = this.auth.getOrganizationId() || undefined;
        this.auth.getUserFeatures(orgId).subscribe({
          next: (res) => {
            this.currentPlanSlug = res?.data?.purchasedPlan?.slug || '';
            this.currentPlanStatus = res?.data?.purchasedPlan?.status || '';
            this.hasUsedTrial = res?.data?.hasUsedTrial || false;
            this.cdr.detectChanges();
          }
        });
      }

      if (this._featureKey === 'create_diagrams' || this._featureKey === 'max_diagrams') {
        this.showLimitWarning = true;
      } else {
        this.showLimitWarning = false;
      }
      // Only show loader if we don't have plans loaded yet
      if (this.plans.length === 0) {
        this.loading = true;
      }
      this.loadPlans();
    }
  }
  get visible(): boolean {
    return this._visible;
  }

  @Output() close = new EventEmitter<void>();

  @Input()
  set featureKey(val: string) {
    this._featureKey = val || '';
    if (this._featureKey === 'create_diagrams' || this._featureKey === 'max_diagrams') {
      this.showLimitWarning = true;
    } else {
      this.showLimitWarning = false;
    }
    if (this.allPlans.length > 0) {
      this.applyFeatureFilter();
      this.cdr.detectChanges();
    }
  }
  get featureKey(): string { return this._featureKey; }
  private _featureKey = '';

  showLimitWarning = false;
  isLoggedIn = false;
  isAnnual = true;
  allPlans: any[] = [];
  plans: any[] = [];
  loading = true;

  currentPlanSlug = '';
  currentPlanStatus = '';
  hasUsedTrial = false;
  showPlanSwitchAlert = false;
  showContactModal = false;
  upgrading = false;
  selectedCurrency = 'INR';

  private http = inject(HttpClient);
  private appConfig = inject(AppConfigService);
  private cdr = inject(ChangeDetectorRef);
  private orgService = inject(OrganizationService);
  private entitlementService = inject(EntitlementService);

  constructor(
    private auth: AuthService,
    private router: Router,
    private svc: DashboardService
  ) { }

  get limitEntityName(): string {
    switch (this.featureKey) {
      case 'create_diagrams':
      case 'max_diagrams': return 'diagram';
      case 'create_workspaces': return 'workspace';
      case 'workspace_members': return 'team member';
      case 'code_compare': return 'sql compare';
      default: return 'feature';
    }
  }

  proceedToPlans(): void {
    this.showLimitWarning = false;
    this.cdr.detectChanges();
  }

  ngOnInit(): void {
    // Pre-load plans on init so they are ready when clicking upgrade
    if (this.auth.isLoggedIn()) {
      const orgId = this.auth.getOrganizationId() || undefined;
      this.auth.getUserFeatures(orgId).subscribe({
        next: (res) => {
          this.currentPlanSlug = res?.data?.purchasedPlan?.slug || '';
          this.currentPlanStatus = res?.data?.purchasedPlan?.status || '';
          this.hasUsedTrial = res?.data?.hasUsedTrial || false;
          this.cdr.detectChanges();
        }
      });
      this.loadPlans();
    }
  }

  loadPlans(): void {
    const cached = this.entitlementService.getPlans();
    if (cached && cached.length > 0) {
      this.allPlans = cached;
      this.applyFeatureFilter();
      this.loading = false;
      this.cdr.detectChanges();
    }

    const url = this.appConfig.environment?.pricingApiUrls?.plans;
    if (url) {
      this.http.get<any>(url).pipe(timeout(3500)).subscribe({
        next: (res) => {
          const plans = res?.data && res.data.length > 0 ? res.data : (Array.isArray(res) ? res : []);
          if (plans.length > 0) {
            this.allPlans = plans;
            this.entitlementService.loadPlans(true).subscribe();
          }
          this.applyFeatureFilter();
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.warn('Upgrade plans API load error:', err);
          if (this.allPlans.length === 0) {
            this.allPlans = this.entitlementService.getPlans();
          }
          this.applyFeatureFilter();
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.allPlans = this.entitlementService.getPlans();
      this.applyFeatureFilter();
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  /** Filter allPlans to only show plans that have the restricted featureKey enabled */
  private applyFeatureFilter(): void {
    // Keep all plans loaded in this.plans, displayedPlans will filter what is displayed.
    this.plans = this.allPlans;
  }

  get isOrganization(): boolean {
    return this.auth.isOrganizationAccount() || this.auth.getOrganizationId() !== null;
  }

  get displayedPlans(): any[] {
    if (this.isOrganization) {
      return this.plans.filter(p => p.slug === 'team');
    }
    if (this._featureKey === 'create_workspaces') {
      return this.plans.filter(p => p.slug === 'team');
    }
    // Otherwise, show only the two individual plans (Free & Premium)
    return this.plans.filter(p => p.slug === 'free' || p.slug === 'premium');
  }

  closeModal(): void {
    this.close.emit();
  }

  toggleBilling(annual: boolean): void {
    this.isAnnual = annual;
  }

  getPrice(plan: any): string {
    const monthlyPrice = parseFloat(plan.price_monthly || '0');
    const annualPrice = parseFloat(plan.price_annual || '0') || monthlyPrice * 12;

    if (monthlyPrice === 0) return 'Free';

    const price = this.isAnnual ? annualPrice : monthlyPrice;
    return price.toString();
  }

  getCurrencySymbol(): string {
    return '₹';
  }

  getPeriod(plan: any): string {
    const monthlyPrice = parseFloat(plan.price_monthly || '0');
    if (monthlyPrice === 0) return 'Forever';
    return this.isAnnual ? '/year' : '/month';
  }

  getFeatureValue(plan: any, featureKey: string): string {
    const ent = (plan.entitlements || []).find((e: any) => e.feature_key === featureKey);
    if (!ent) return '—';
    if (ent.display_text) return ent.display_text;
    if (ent.value === 'true' || ent.value === true) return '✓';
    if (ent.value === 'false' || ent.value === false) return '✗';
    if (ent.limit_value === -1) return 'Unlimited';
    if (ent.limit_value) return String(ent.limit_value);
    return ent.value || '—';
  }

  isFeatureEnabled(plan: any, featureKey: string): boolean {
    const ent = (plan.entitlements || []).find((e: any) => e.feature_key === featureKey);
    if (!ent) return false;
    return ent.value === 'true' || ent.value === true || (ent.limit_value && Number(ent.limit_value) > 0);
  }

  isValidFeature(text: string | null | undefined): boolean {
    if (!text) return false;
    const trimmed = text.trim();
    return trimmed !== '' && trimmed !== '—' && trimmed !== '-' && trimmed !== '0';
  }

  expandedCards = new Set<string | number>();

  isPlanExpanded(plan: any): boolean {
    const key = plan?.id ?? plan?.slug;
    return this.expandedCards.has(key);
  }

  togglePlanFeatures(plan: any): void {
    const key = plan?.id ?? plan?.slug;
    if (this.expandedCards.has(key)) {
      this.expandedCards.delete(key);
    } else {
      this.expandedCards.add(key);
    }
  }

  getValidEntitlements(plan: any): any[] {
    if (!plan || !plan.entitlements) return [];
    return plan.entitlements.filter((ent: any) =>
      ent.value !== 'false' && ent.value !== false && this.isValidFeature(ent.display_text || ent.feature_name)
    );
  }

  getVisibleEntitlements(plan: any): any[] {
    const valid = this.getValidEntitlements(plan);
    if (this.isPlanExpanded(plan)) {
      return valid;
    }
    return valid.slice(0, 5);
  }

  hasMoreFeatures(plan: any): boolean {
    return this.getValidEntitlements(plan).length > 5;
  }

  getCtaLabel(plan: any): string {
    if (this.isLoggedIn && this.currentPlanSlug && this.currentPlanSlug === plan.slug && this.currentPlanStatus !== 'expired') {
      if (this.currentPlanStatus === 'trial') {
        return 'Current Plan (Free trial for 45 days)';
      }
      return 'Current Plan';
    }

    if (plan.slug === 'enterprise') return 'Contact Sales';

    const monthlyPrice = parseFloat(plan.price_monthly || '0');

    if (!this.isLoggedIn) {
      if (plan.cta_text) return plan.cta_text;
      if (monthlyPrice === 0) return 'Sign Up Free';
      if (this.isOrganization) return 'Sign Up & Try Free';
      return 'Sign Up & Get Started';
    }

    if (this.isEligibleForTrial() && plan.slug !== 'free') return 'Start free trial for 45 days';


    // Logged-in user: show contextual upgrade label based on plan type
    if (monthlyPrice === 0) return 'Start for Free';
    const planName = plan.name || 'Plan';
    return `Upgrade to ${planName}`;
  }

  isCtaDisabled(plan: any): boolean {
    if (!this.isLoggedIn) return false;
    if (this.currentPlanStatus === 'expired') return false;
    return !!(this.currentPlanSlug && this.currentPlanSlug === plan.slug);
  }

  isTrialActive(): boolean {
    return this.isLoggedIn && this.currentPlanStatus === 'trial';
  }

  isTrialExpired(): boolean {
    if (!this.isLoggedIn) return false;
    // The backend returns them to the free plan if their trial expires
    return (this.hasUsedTrial && (this.currentPlanSlug === 'free' || !this.currentPlanSlug)) || this.currentPlanStatus === 'expired';
  }

  shouldShowNoCardRequired(plan: any): boolean {
    if (!plan || (plan.slug !== 'premium' && plan.slug !== 'team')) {
      return false;
    }
    // Don't show when the free trial is active or expired
    if (this.isTrialActive() || this.isTrialExpired()) {
      return false;
    }
    // Don't show if user already has an active paid plan
    if (this.isLoggedIn && this.currentPlanSlug && this.currentPlanSlug !== 'free') {
      return false;
    }
    return true;
  }

  isEligibleForTrial(): boolean {
    if (!this.isLoggedIn) return true;
    if (this.hasUsedTrial) return false;
    return this.currentPlanStatus === 'trial' || this.currentPlanSlug === 'free';
  }

  contactModalMessage = 'Your 45-day free trial has expired. To continue using premium features, please contact our sales team.';

  closeContactModal(): void {
    this.showContactModal = false;
  }

  closePlanSwitchAlert(): void {
    this.showPlanSwitchAlert = false;
  }

  contactSalesFromAlert(): void {
    this.closePlanSwitchAlert();
    this.contactModalMessage = 'If you want to switch to another plan, please cancel your ongoing plan first.';
    this.showContactModal = true;
  }

  selectPlan(plan: any): void {
    if (!this.isLoggedIn) {
      this.closeModal();
      this.router.navigate(['/auth/register'], {
        queryParams: {
          type: this.isOrganization ? 'organization' : 'individual',
          plan: plan.slug
        }
      });
      return;
    }

    if ((this.currentPlanStatus === 'active' || this.currentPlanStatus === 'trial') && this.currentPlanSlug !== 'free' && plan.slug !== this.currentPlanSlug && plan.slug !== 'free') {
      this.contactModalMessage = 'To switch to a different plan, you need to cancel your ongoing plan first. Please contact sales.';
      this.showContactModal = true;
      return;
    }

    if (plan.slug === 'enterprise') {
      this.closeModal();
      if (this.isOrganization) {
        this.router.navigate(['/organization/subscription']);
      } else {
        this.router.navigate(['/profile/subscription']);
      }
      return;
    }

    // Skip upgrade for free plan
    if (plan.slug === 'free') {
      this.closeModal();
      return;
    }

    const orgId = this.auth.getOrganizationId();

    if (orgId) {
      // Organization user — call org upgrade API
      this.loading = true;
      this.orgService.upgrade(orgId, plan.slug).subscribe({
        next: (res) => {
          const localSubId = res.data?.subscription_id || res.subscription_id; 

          // Check if the plan requires payment (status will be 'expired' or pending)
          if (res.data?.status === 'expired' && localSubId) {
            this.initiateRazorpayPayment(localSubId, plan);
            return;
          }

          this.auth.getUserFeatures().subscribe();
          this.loading = false;
          this.svc.showToast('Subscription updated successfully!', 3000, 'success');
          if ((this.auth as any).setCurrentPlanSlug) {
            (this.auth as any).setCurrentPlanSlug(plan.slug);
          }
          this.closeModal();
          setTimeout(() => window.location.reload(), 1000);
        },
        error: (err) => {
          this.loading = false;
          const errorMsg = err?.error?.message || err?.error || 'Failed to update subscription';
          this.svc.showToast(typeof errorMsg === 'string' ? errorMsg : 'Failed to update subscription', 4000, 'error');
          this.cdr.detectChanges();
        }
      });
      return;
    }
    // Individual user — call /api/profile/subscription/upgrade
    const upgradeUrl = this.appConfig.environment?.pricingApiUrls?.profileUpgrade;
    if (!upgradeUrl) {
      this.svc.showToast('Upgrade endpoint not configured.', 4000, 'error');
      return;
    }
    this.loading = true;
    this.http.post<any>(upgradeUrl, { planSlug: plan.slug, currency: this.selectedCurrency }, { withCredentials: true }).subscribe({
      next: (res) => {
        const localSubId = res.data?.subscription_id;
        if (res.data?.status === 'expired' && localSubId) {
          this.initiateRazorpayPayment(localSubId, plan);
          return;
        }

        this.auth.getUserFeatures().subscribe();
        this.loading = false;
        this.svc.showToast('Plan upgraded successfully!', 3000, 'success');
        if (typeof window !== 'undefined') {
          localStorage.setItem('cachedPlanSlug', plan.slug);
          if (plan.slug !== 'free') localStorage.setItem('cachedHasUsedTrial', 'true');
        }
        if ((this.auth as any).setCurrentPlanSlug) {
          (this.auth as any).setCurrentPlanSlug(plan.slug);
          (this.auth as any).setCurrentPlanStatus(res.data?.status || 'trial');
        }
        this.closeModal();
        setTimeout(() => window.location.reload(), 1000);
      },
      error: (err) => {
        this.loading = false;
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

  private loadRazorpayScript(): Promise<boolean> {
    return new Promise(resolve => {
      if (typeof window === 'undefined') {
        return resolve(false);
      }
      if ((window as any).Razorpay) {
        return resolve(true);
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  private initiateRazorpayPayment(localSubId: string, plan: any): void {
    const baseUrl = this.appConfig.environment?.apiConfig?.baseUrl || 'http://localhost:4000';
    const createSubUrl = this.appConfig.environment?.paymentApiUrls?.createSubscription || `${baseUrl}/api/payments/create-subscription`;
    const verifySubUrl = this.appConfig.environment?.paymentApiUrls?.verifySubscription || `${baseUrl}/api/payments/verify-subscription`;
    const planType = `${plan.slug}_${this.isAnnual ? 'yearly' : 'monthly'}`;

    this.http.post<any>(createSubUrl, {
      planType: planType,
      currency: this.selectedCurrency,
      subscriptionId: localSubId
    }, { withCredentials: true }).subscribe({
      next: async (res) => {
        const rpSubId = res.subscription_id;
        if (!rpSubId) {
          this.loading = false;
          this.svc.showToast('Failed to generate payment gateway link.', 4000, 'error');
          this.cdr.detectChanges();
          return;
        }

        const isLoaded = await this.loadRazorpayScript();
        if (!isLoaded) {
          this.loading = false;
          this.svc.showToast('Failed to load payment gateway.', 4000, 'error');
          this.cdr.detectChanges();
          return;
        }

        const razorpayKey = res.key_id || environment.razorpayKeyId || this.appConfig.environment?.appConfig?.razorpayKeyId;
        if (!razorpayKey) {
          this.loading = false;
          this.svc.showToast('Payment gateway configuration error.', 4000, 'error');
          this.cdr.detectChanges();
          return;
        }

        const options = {
          key: razorpayKey,
          subscription_id: rpSubId,
          name: "DB Nexus",
          description: `${plan.name} Subscription`,
          handler: (response: any) => {
            this.loading = true; // Keep loading while verifying
            this.http.post<any>(verifySubUrl, {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature
            }, { withCredentials: true }).subscribe({
              next: () => {
                this.loading = false;
                this.svc.showToast(`Payment successful! Welcome to ${plan.name}.`, 3000, 'success');

                if (typeof window !== 'undefined') {
                  localStorage.setItem('cachedPlanSlug', plan.slug);
                  localStorage.setItem('cachedHasUsedTrial', 'true');
                }
                if ((this.auth as any).setCurrentPlanSlug) {
                  (this.auth as any).setCurrentPlanSlug(plan.slug);
                }
                this.cdr.detectChanges();
                this.closeModal();
                setTimeout(() => window.location.reload(), 1500);
              },
              error: () => {
                this.loading = false;
                this.svc.showToast('Payment successful, but verification failed. Please contact support.', 5000, 'error');
                this.cdr.detectChanges();
              }
            });
          },
          theme: { color: "#2563eb" },
          modal: {
            ondismiss: () => {
              this.loading = false;
              this.svc.showToast('Payment cancelled.', 3000, 'error');
              this.cdr.detectChanges();
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', (response: any) => {
          this.loading = false;
          this.svc.showToast('Payment failed: ' + response.error.description, 4000, 'error');
          this.cdr.detectChanges();
        });
        rzp.open();
      },
      error: (err) => {
        this.loading = false;
        this.svc.showToast('Error initiating checkout. Please try again.', 4000, 'error');
        this.cdr.detectChanges();
      }
    });
  }
}
