import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { AppConfigService } from '../../core/services/app-config.service';
import { Icons } from '../../core/component/icons/icons';
import { ButtonComponent } from '../../shared/button/button';
import { DashboardService } from '../../core/services/dashboard.service';
import { OrganizationService } from '../organization/services/organization.service';
import { EntitlementService } from '../../core/services/entitlement.service';
import { SeoService } from '../../core/services/seo.service';
import { ContactSalesModalComponent } from '../../shared/components/modals/contact-sales-modal/contact-sales-modal';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, RouterModule, Icons, ButtonComponent, ContactSalesModalComponent],
  templateUrl: './pricing.html',
})
export class PricingComponent implements OnInit {
  isLoggedIn = false;
  isMobileMenuOpen = false;

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }
  isAnnual = true;
  plans: any[] = [];
  loading = false;

  currentPlanSlug = 'free';
  currentPlanStatus = 'active';
  hasUsedTrial = false;
  showPlanSwitchAlert = false;

  private http = inject(HttpClient);
  private appConfig = inject(AppConfigService);
  private cdr = inject(ChangeDetectorRef);
  private orgService = inject(OrganizationService);
  private entitlementService = inject(EntitlementService);
  private seoService = inject(SeoService);

  constructor(
    private auth: AuthService,
    private router: Router,
    private svc: DashboardService
  ) { }

  // Re-fetch data if they return to this tab and the trial might have expired
  @HostListener('document:visibilitychange')
  onVisibilityChange() {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && this.isLoggedIn) {
      this.refreshFeatures();
    }
  }

  refreshFeatures(): void {
    const orgId = this.auth.getOrganizationId() || undefined;
    this.auth.getUserFeatures(orgId).subscribe({
      next: (res) => {
        if (res?.data?.purchasedPlan) {
          this.currentPlanSlug = res.data.purchasedPlan.slug || 'free';
          this.currentPlanStatus = res.data.purchasedPlan.status || 'active';
          this.hasUsedTrial = res.data.hasUsedTrial || false;
          
          if (typeof window !== 'undefined') {
            localStorage.setItem('cachedPlanSlug', this.currentPlanSlug);
            localStorage.setItem('cachedPlanStatus', this.currentPlanStatus);
            localStorage.setItem('cachedHasUsedTrial', String(this.hasUsedTrial));
          }
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to fetch user features on visibility change:', err);
      }
    });
  }

  ngOnInit(): void {
    this.seoService.updateTags({
      title: 'Pricing - DBNexus',
      description: 'Choose the best plan for your database diagramming needs. Flexible pricing for individuals and organizations.',
      url: 'https://dbnexus.up.railway.app/pricing'
    });

    this.seoService.setStructuredData({
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Pricing - DBNexus",
      "description": "Flexible pricing for individuals and organizations."
    });

    if (typeof window !== 'undefined') {
      this.isLoggedIn = this.auth.isLoggedIn();
      // Account type loaded check
      if (this.isLoggedIn) {
        const accountType = this.auth.getAccountType();
        // Try to load cached state first so we don't flash incorrect states
        if (typeof window !== 'undefined') {
          this.currentPlanSlug = localStorage.getItem('cachedPlanSlug') || 'free';
          this.currentPlanStatus = localStorage.getItem('cachedPlanStatus') || 'active';
          this.hasUsedTrial = localStorage.getItem('cachedHasUsedTrial') === 'true';
        } else {
          this.currentPlanSlug = 'free';
          this.currentPlanStatus = 'active';
        }

        const orgId = this.auth.getOrganizationId() || undefined;
        // Bust cache with timestamp
        const cacheBust = `_t=${Date.now()}`;
        this.auth.getUserFeatures(orgId).subscribe({
          next: (res) => {
            setTimeout(() => {
              if (res?.data?.purchasedPlan) {
                this.currentPlanSlug = res.data.purchasedPlan.slug || 'free';
                this.currentPlanStatus = res.data.purchasedPlan.status || 'active';
                this.hasUsedTrial = res.data.hasUsedTrial || false;
                
                if (typeof window !== 'undefined') {
                  localStorage.setItem('cachedPlanSlug', this.currentPlanSlug);
                  localStorage.setItem('cachedPlanStatus', this.currentPlanStatus);
                  localStorage.setItem('cachedHasUsedTrial', String(this.hasUsedTrial));
                }
              }
              this.cdr.detectChanges();
            });
          },
          error: (err) => {
            console.error('Failed to fetch user features:', err);
            setTimeout(() => {
              this.cdr.detectChanges();
            });
          }
        });
      }
    }
    this.loadPlans();
  }

  loadPlans(): void {
    const url = this.appConfig.environment?.pricingApiUrls?.plans;
    if (url) {
      this.http.get<any>(url).subscribe({
        next: (res) => {
          this.plans = res?.data && res.data.length > 0 ? res.data : [];
          setTimeout(() => {
            this.loading = false;
            this.cdr.detectChanges();
          });
        },
        error: () => {
          this.plans = [];
          setTimeout(() => {
            this.loading = false;
            this.cdr.detectChanges();
          });
        }
      });
    } else {
      this.plans = [];
      setTimeout(() => {
        this.loading = false;
        this.cdr.detectChanges();
      });
    }
  }

  /** Plans to display (all except enterprise by default) */
  get displayedPlans(): any[] {
    // Hide enterprise plan
    return this.plans.filter(p => p.slug !== 'enterprise');
  }

  onCreateDiagram(): void {
    if (this.isLoggedIn) {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/dashboard'], { queryParams: { sample: 'true' } });
    }
  }

  logout(): void {
    this.auth.logout();
    this.isLoggedIn = false;
    this.svc.showToast('Logged out successfully.', 2500, 'success');
  }

  toggleBilling(annual: boolean): void {
    this.isAnnual = annual;
  }

  getPrice(plan: any): string {
    const monthlyPrice = parseFloat(plan.price_monthly || '0');
    if (monthlyPrice === 0) return 'Free';

    const annualPrice = parseFloat(plan.price_annual || '0') || monthlyPrice * 10;
    const price = this.isAnnual ? annualPrice : monthlyPrice;
    return '₹' + price;
  }

  getPeriod(plan: any): string {
    if (plan.slug === 'free') return 'forever';
    return this.isAnnual ? 'per year' : 'per month';
  }

  getFeatureName(ent: any): string {
    if (ent.display_text) return ent.display_text;
    if (ent.feature_name) return ent.feature_name;
    
    if (ent.feature_key) {
      const formatted = ent.feature_key.replace(/_/g, ' ');
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
    return '';
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
      ent.value !== 'false' && ent.value !== false && ent.display_text !== '-' && ent.display_text !== '—'
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

  /** CTA button label depending on audience + plan type + login state */
  getCtaLabel(plan: any): string {
    if (plan.slug === 'enterprise') return 'Contact Sales';

    const monthlyPrice = parseFloat(plan.price_monthly || '0');

    // --- Public (not logged in) ---
    if (!this.isLoggedIn) {
      if (plan.slug !== 'free' && plan.slug !== 'enterprise') {
        return 'Start free trial for 45 days';
      }
      if (plan.cta_text) return plan.cta_text;
      if (monthlyPrice === 0) return 'Sign Up Free';
      return 'Sign Up & Get Started';
    }


    // --- Logged-in user ---
    if (this.currentPlanSlug && this.currentPlanSlug === plan.slug) {
      if (this.currentPlanStatus === 'trial') {
        return 'Current Plan (Free trial for 45 days)';
      }
      return 'Current Plan';
    }

    if (this.auth.isOrganizationMember() && plan.slug !== 'free') {
      return 'Contact Sales';
    }

    if (this.isEligibleForTrial() && plan.slug !== 'free') return 'Start free trial for 45 days';


    if (monthlyPrice === 0) return 'Start for Free';
    const planName = plan.name || 'Plan';
    return `Upgrade to ${planName}`;
  }

  isEligibleForTrial(): boolean {
    if (!this.isLoggedIn) return true;
    if (this.hasUsedTrial) return false;
    return this.currentPlanStatus === 'trial' || this.currentPlanSlug === 'free';
  }

  isTrialExpired(): boolean {
    if (!this.isLoggedIn) return false;
    // The backend returns them to the free plan if their trial expires
    return this.hasUsedTrial && this.currentPlanSlug === 'free';
  }

  showContactModal = false;
  showLoginPromptModal = false;
  pendingPlanSlug = '';

  contactModalMessage = 'Your 45-day free trial has expired. To continue using premium features, please contact our sales team.';

  openContactModal(): void {
    this.contactModalMessage = 'Your 45-day free trial has expired. To continue using premium features, please contact our sales team.';
    this.showContactModal = true;
  }

  closeContactModal(): void {
    this.showContactModal = false;
  }

  openLoginPromptModal(planSlug: string): void {
    this.pendingPlanSlug = planSlug;
    this.showLoginPromptModal = true;
  }

  closeLoginPromptModal(): void {
    this.showLoginPromptModal = false;
  }

  closePlanSwitchAlert(): void {
    this.showPlanSwitchAlert = false;
  }

  navigateToLogin(): void {
    this.router.navigate(['/login'], {
      queryParams: {
        type: this.pendingPlanSlug === 'team' ? 'organization' : 'individual',
        plan: this.pendingPlanSlug
      }
    });
    this.closeLoginPromptModal();
  }

  isCtaDisabled(plan: any): boolean {
    if (!this.isLoggedIn) return false;
    if (this.currentPlanStatus === 'expired') return false;
    
    // If they are on this exact plan (active or trial), disable the button
    if (this.currentPlanSlug && this.currentPlanSlug === plan.slug) {
      return true;
    }
    
    // If they are on any paid plan (not free), disable the free plan button
    if (plan.slug === 'free' && this.currentPlanSlug && this.currentPlanSlug !== 'free') {
      return true;
    }
    
    return false;
  }

  hideFreePlanButton(plan: any): boolean {
    // We are now disabling it instead of hiding it, so return false to always show it
    return false;
  }

  upgrading = false;

  contactSalesFromAlert(): void {
    this.closePlanSwitchAlert();
    this.contactModalMessage = 'If you want to switch to another plan, please cancel your ongoing plan first.';
    this.showContactModal = true;
  }

  selectPlan(plan: any): void {
    if (!this.isLoggedIn) {
      this.openLoginPromptModal(plan.slug);
      return;
    }

    if (this.isTrialExpired() && plan.slug !== 'free') {
      this.openContactModal();
      return;
    }

    if (this.auth.isOrganizationMember() && plan.slug !== 'free' && plan.slug !== this.currentPlanSlug) {
      this.contactModalMessage = 'You are a team member and cannot modify the organization plan. Please contact your administrator or sales.';
      this.showContactModal = true;
      return;
    }

    if ((this.hasUsedTrial || (this.currentPlanStatus === 'active' && this.currentPlanSlug !== 'free')) && plan.slug !== this.currentPlanSlug && plan.slug !== 'free') {
      this.contactModalMessage = 'To upgrade to a new plan, you need to deactivate the ongoing plan. Please contact sales.';
      this.showContactModal = true;
      return;
    }

    // Enterprise — contact sales / go to org subscription page
    if (plan.slug === 'enterprise') {
      if (this.auth.isOrganizationAccount()) {
        this.router.navigate(['/organization/subscription']);
      } else {
        window.open('mailto:sales@dbnexus.com?subject=Enterprise Plan Inquiry', '_blank');
      }
      return;
    }

    // Free plan — nothing to do
    if (plan.slug === 'free') return;

    // Organization account — call org upgrade API
    if (this.auth.isOrganizationAccount()) {
      const orgId = this.auth.getOrganizationId();
      if (!orgId) return;
      this.upgrading = true;
      this.cdr.detectChanges();
      this.orgService.upgrade(orgId, plan.slug).subscribe({
        next: () => {
          this.auth.getUserFeatures().subscribe();
          this.upgrading = false;
          this.svc.showToast('Subscription updated successfully!', 3000, 'success');
          if ((this.auth as any).setCurrentPlanSlug) {
            (this.auth as any).setCurrentPlanSlug(plan.slug);
          }
          this.cdr.detectChanges();
          setTimeout(() => window.location.reload(), 1000);
        },
        error: (err) => {
          this.upgrading = false;
          const msg = err?.error?.message || 'Failed to update subscription';
          this.svc.showToast(msg, 4000, 'error');
          this.cdr.detectChanges();
        }
      });
      return;
    }

    // Individual user — call /api/profile/subscription/upgrade directly
    const upgradeUrl = this.appConfig.environment?.pricingApiUrls?.profileUpgrade;
    if (!upgradeUrl) {
      this.svc.showToast('Upgrade endpoint not configured.', 4000, 'error');
      return;
    }
    this.upgrading = true;
    this.cdr.detectChanges();
    this.http.post<any>(upgradeUrl, { planSlug: plan.slug }, { withCredentials: true }).subscribe({
      next: () => {
        this.auth.getUserFeatures().subscribe();
        this.upgrading = false;
        this.svc.showToast(`Upgraded to ${plan.name} successfully!`, 3000, 'success');
        
        // Proactively update localStorage so the reload is perfectly seamless
        if (typeof window !== 'undefined') {
          localStorage.setItem('cachedPlanSlug', plan.slug);
          // If we upgraded to a free trial, status is trial. If we bought a plan, it's active.
          // The backend determines this, but 'trial' is a safe guess if no money was involved initially, or 'active'.
          // To be safe, we just leave status as is or 'active', the API will correct it in 50ms.
          // But we DO know they used the trial now if they just started one!
          if (plan.slug !== 'free') {
             localStorage.setItem('cachedHasUsedTrial', 'true');
          }
        }

        if ((this.auth as any).setCurrentPlanSlug) {
          (this.auth as any).setCurrentPlanSlug(plan.slug);
        }
        this.cdr.detectChanges();
        setTimeout(() => window.location.reload(), 1000);
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
}



