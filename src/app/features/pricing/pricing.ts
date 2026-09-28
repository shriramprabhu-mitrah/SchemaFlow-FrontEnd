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
import { Footer } from '../../shared/components/footer/footer';
import { environment } from '../../../environment/environment';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, RouterModule, Icons, ButtonComponent, ContactSalesModalComponent, Footer],
  templateUrl: './pricing.html',
})
export class PricingComponent implements OnInit {
  isLoggedIn = false;
  isMobileMenuOpen = false;

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }
  isAnnual = true;
  overallPercentage: number = 20;
  plans: any[] = [];
  loading = false;

  currentPlanSlug = 'free';
  currentPlanStatus = 'active';
  hasUsedTrial = false;
  showPlanSwitchAlert = false;

  selectedCurrency = 'INR';

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
          if (res?.overall_percentage !== undefined && res?.overall_percentage !== null) {
            this.overallPercentage = Number(res.overall_percentage) || 20;
          } else if (res?.data && Array.isArray(res.data)) {
            const found = res.data.find((p: any) => p.overall_percentage || p.discount_percentage);
            if (found) {
              this.overallPercentage = Number(found.overall_percentage || found.discount_percentage) || 20;
            }
          }
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

  getCurrencySymbol(): string {
    return '₹';
  }

  getPrice(plan: any): string {
    const monthlyPrice = parseFloat(plan.price_monthly || '0');
    if (monthlyPrice === 0) return 'Free';

    if (this.isAnnual) {
      if (plan.price_annual !== undefined && plan.price_annual !== null && Number(plan.price_annual) > 0) {
        return Math.round(Number(plan.price_annual)).toString();
      }
      const discount = Number(this.overallPercentage) || 0;
      return Math.round(monthlyPrice * (1 - discount / 100)).toString();
    }
    return Math.round(monthlyPrice).toString();
  }

  getOriginalMonthlyPrice(plan: any): string {
    const monthlyPrice = parseFloat(plan.price_monthly || '0');
    return Math.round(monthlyPrice).toString();
  }

  getAnnualTotal(plan: any): string {
    const activeMonthly = Number(this.getPrice(plan)) || 0;
    return (activeMonthly * 12).toString();
  }

  getPeriod(plan: any): string {
    if (plan.slug === 'free') return 'forever';
    return this.isAnnual ? 'per year' : 'per month';
  }

  private isTrue(val: any): boolean {
    return val === true || val === 'true' || val === 1 || val === '1';
  }

  getFeatureName(ent: any): string {
    if (ent.isHeader) return ent.text;
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

  getKeySpecs(plan: any): { text: string; icon: string }[] {
    if (!plan) return [];
    const specs: { text: string; icon: string }[] = [];

    // 1. Diagram limit spec
    const diagramEnt = (plan.entitlements || []).find((e: any) => e.feature_key === 'create_diagrams');
    if (diagramEnt) {
      let text = diagramEnt.display_text;
      if (!text || text.trim() === '') {
        if (Number(diagramEnt.limit_value) === -1) text = 'Unlimited diagrams & doc projects';
        else if (diagramEnt.limit_value) text = `Up to ${diagramEnt.limit_value} diagrams & doc projects`;
        else text = 'Diagram projects';
      }
      specs.push({ text, icon: 'diagram' });
    }

    // 2. User / Seats spec (Dynamic from included_seats & workspace_members entitlement)
    const memberEnt = (plan.entitlements || []).find((e: any) => e.feature_key === 'workspace_members');
    const seats = Number(plan.included_seats || 0);

    if (seats > 1) {
      specs.push({ text: `${seats} users`, icon: 'users' });
    } else if (seats === -1) {
      specs.push({ text: 'Unlimited users', icon: 'users' });
    } else if (memberEnt && this.isTrue(memberEnt.value) && memberEnt.display_text && memberEnt.display_text.trim() !== '' && memberEnt.display_text.trim() !== '0') {
      specs.push({ text: memberEnt.display_text, icon: Number(memberEnt.limit_value) === 1 ? 'user' : 'users' });
    } else if (memberEnt && this.isTrue(memberEnt.value) && memberEnt.limit_value && Number(memberEnt.limit_value) > 1) {
      specs.push({ text: `${memberEnt.limit_value} users`, icon: 'users' });
    } else if (memberEnt && this.isTrue(memberEnt.value) && Number(memberEnt.limit_value) === -1) {
      specs.push({ text: 'Unlimited users', icon: 'users' });
    } else {
      specs.push({ text: 'Single user', icon: 'user' });
    }

    // 3. Paid doc project spec (if document_view limit exists)
    const docEnt = (plan.entitlements || []).find((e: any) => e.feature_key === 'document_view');
    if (docEnt && docEnt.limit_value && Number(docEnt.limit_value) > 0) {
      const text = docEnt.display_text || `${docEnt.limit_value} paid doc projects`;
      specs.push({ text, icon: 'doc' });
    }

    return specs;
  }

  getValidEntitlements(plan: any): any[] {
    if (!plan || !plan.entitlements) return [];
    return plan.entitlements.filter((ent: any) => {
      if (!this.isTrue(ent.show_in_pricing) || !this.isTrue(ent.feature_show_in_pricing)) return false;
      if (ent.value === 'false' || ent.value === false) return false;
      if (ent.display_text === '-' || ent.display_text === '—') return false;

      // Exclude top key spec features from lower checklist
      if (ent.feature_key === 'create_diagrams') return false;
      if (ent.feature_key === 'workspace_members') return false;
      if (ent.feature_key === 'document_view' && ent.limit_value && Number(ent.limit_value) > 0) return false;

      return true;
    });
  }

  getCardFeatures(plan: any): any[] {
    if (!plan) return [];
    const validEntitlements = this.getValidEntitlements(plan);

    const slug = (plan.slug || '').toLowerCase();
    let prevPlanName = '';
    let prevPlanObj: any = null;

    const allAvailablePlans = (this.plans && this.plans.length > 0) ? this.plans : (this.displayedPlans || []);

    if (slug === 'premium' || slug === 'pro') {
      prevPlanObj = allAvailablePlans.find((p: any) => (p.slug || '').toLowerCase() === 'free');
      prevPlanName = prevPlanObj?.name || 'Free';
    } else if (slug === 'team' || slug === 'business' || slug === 'organization') {
      prevPlanObj = allAvailablePlans.find((p: any) => {
        const s = (p.slug || '').toLowerCase();
        return s === 'premium' || s === 'pro';
      });
      prevPlanName = prevPlanObj?.name || 'Premium';
    } else if (allAvailablePlans && allAvailablePlans.length > 0) {
      const idx = allAvailablePlans.findIndex((p: any) => p.slug === plan.slug || p.id === plan.id);
      if (idx > 0) {
        prevPlanObj = allAvailablePlans[idx - 1];
        prevPlanName = prevPlanObj.name || prevPlanObj.slug;
      }
    }

    if (!prevPlanName) {
      return validEntitlements;
    }

    // Collect all feature representations from previous plan tiers
    const prevFeatureMap = new Map<string, string>();

    const getEntRepresentation = (ent: any) => {
      const text = (ent.display_text || ent.feature_name || ent.feature_key || '').trim();
      const val = ent.value !== undefined && ent.value !== null ? String(ent.value) : '';
      const lim = ent.limit_value !== undefined && ent.limit_value !== null ? String(ent.limit_value) : '';
      return `${ent.feature_key}::${text}::${val}::${lim}`;
    };

    const ancestorPlans: any[] = [];
    let currentCheckSlug = slug;
    while (currentCheckSlug) {
      let parent: any = null;
      if (currentCheckSlug === 'team' || currentCheckSlug === 'business' || currentCheckSlug === 'organization') {
        parent = allAvailablePlans.find((p: any) => (p.slug || '').toLowerCase() === 'premium' || (p.slug || '').toLowerCase() === 'pro');
      } else if (currentCheckSlug === 'premium' || currentCheckSlug === 'pro') {
        parent = allAvailablePlans.find((p: any) => (p.slug || '').toLowerCase() === 'free');
      }
      if (parent && !ancestorPlans.includes(parent)) {
        ancestorPlans.push(parent);
        currentCheckSlug = (parent.slug || '').toLowerCase();
      } else {
        break;
      }
    }

    for (const pOfPrev of ancestorPlans) {
      const pEnts = this.getValidEntitlements(pOfPrev);
      for (const pe of pEnts) {
        if (!prevFeatureMap.has(pe.feature_key)) {
          prevFeatureMap.set(pe.feature_key, getEntRepresentation(pe));
        }
      }
    }

    const additionalFeatures = validEntitlements.filter((ent: any) => {
      const rep = getEntRepresentation(ent);
      const prevRep = prevFeatureMap.get(ent.feature_key);
      return prevRep !== rep;
    });

    const headerItem = {
      isHeader: true,
      text: `Everything in ${prevPlanName}, plus`,
      feature_key: `header_${plan.slug}`
    };

    return [headerItem, ...additionalFeatures];
  }

  getVisibleEntitlements(plan: any): any[] {
    const cardFeatures = this.getCardFeatures(plan);
    if (this.isPlanExpanded(plan)) {
      return cardFeatures;
    }
    return cardFeatures.slice(0, 6);
  }

  hasMoreFeatures(plan: any): boolean {
    return this.getCardFeatures(plan).length > 6;
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

  isBooleanFeature(featureKey: string): boolean {
    for (const plan of this.displayedPlans) {
      const ent = (plan.entitlements || []).find((e: any) => e.feature_key === featureKey);
      if (ent) {
        if (ent.limit_value !== null && ent.limit_value !== undefined && ent.limit_value !== 0) return false;
        if (ent.display_text && ent.display_text !== '-' && ent.display_text !== '—') return false;
      }
    }
    return true;
  }

  get allFeatures(): any[] {
    const featuresMap = new Map<string, any>();
    for (const plan of this.displayedPlans) {
      if (plan.entitlements) {
        for (const ent of plan.entitlements) {
          if (!this.isTrue(ent.show_in_pricing) || !this.isTrue(ent.feature_show_in_pricing)) continue;
          if (!featuresMap.has(ent.feature_key)) {
            featuresMap.set(ent.feature_key, ent);
          }
        }
      }
    }
    return Array.from(featuresMap.values());
  }

  get groupedFeatures(): { category: string; features: any[] }[] {
    const categoryOrder: string[] = [];
    const categoryFeatureMap = new Map<string, Map<string, any>>();

    for (const plan of this.displayedPlans) {
      if (plan.entitlements) {
        for (const ent of plan.entitlements) {
          if (!this.isTrue(ent.show_in_pricing) || !this.isTrue(ent.feature_show_in_pricing)) continue;
          const cat = ent.category || ent.feature_category || 'Features';
          if (!categoryFeatureMap.has(cat)) {
            categoryFeatureMap.set(cat, new Map<string, any>());
            categoryOrder.push(cat);
          }
          const featureMap = categoryFeatureMap.get(cat)!;
          if (!featureMap.has(ent.feature_key)) {
            featureMap.set(ent.feature_key, ent);
          }
        }
      }
    }

    return categoryOrder.map(cat => ({
      category: cat,
      features: Array.from(categoryFeatureMap.get(cat)!.values())
    }));
  }

  getTrialDays(plan?: any): number {
    if (plan && plan.trial_days !== undefined && plan.trial_days !== null && Number(plan.trial_days) > 0) {
      return Number(plan.trial_days);
    }
    const found = this.plans.find(p => p.trial_days && Number(p.trial_days) > 0);
    return found ? Number(found.trial_days) : 14;
  }

  formatTrialDuration(planOrDays?: any): string {
    let totalDays: number;
    if (typeof planOrDays === 'number') {
      totalDays = planOrDays;
    } else if (planOrDays && planOrDays.trial_days !== undefined && planOrDays.trial_days !== null) {
      totalDays = Number(planOrDays.trial_days);
    } else {
      totalDays = this.getTrialDays();
    }

    if (!totalDays || totalDays <= 0) return '0 days';

    const totalMinutes = Math.round(totalDays * 1440);
    const days = Math.floor(totalMinutes / 1440);
    const remainingMinutes = totalMinutes % 1440;
    const hours = Math.floor(remainingMinutes / 60);
    const mins = remainingMinutes % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
    if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
    if (mins > 0) parts.push(`${mins} ${mins === 1 ? 'min' : 'mins'}`);

    return parts.join(' ') || '0 days';
  }

  get isOrganization(): boolean {
    return this.auth.isOrganizationAccount() || this.auth.getOrganizationId() !== null;
  }

  /** CTA button label depending on audience + plan type + login state */
  getCtaLabel(plan: any): string {
    if (this.auth.isSuperAdmin()) return 'Super Admin';
    if (plan.slug === 'enterprise') return 'Contact Sales';

    const monthlyPrice = parseFloat(plan.price_monthly || '0');
    const trialDuration = this.formatTrialDuration(plan);

    // --- Public (not logged in) ---
    if (!this.isLoggedIn) {
      if (plan.slug !== 'free' && plan.slug !== 'enterprise') {
        return `Start free trial for ${trialDuration}`;
      }
      if (plan.cta_text) return plan.cta_text;
      if (monthlyPrice === 0) return 'Sign Up Free';
      return 'Sign Up & Get Started';
    }


    // --- Logged-in user ---
    if (this.currentPlanSlug && this.currentPlanSlug === plan.slug && this.currentPlanStatus !== 'expired') {
      if (this.currentPlanStatus === 'trial') {
        return `Current Plan (Free trial for ${trialDuration})`;
      }
      return 'Current Plan';
    }

    if (this.auth.isOrganizationMember() && plan.slug !== 'free') {
      return 'Contact Sales';
    }

    // Business account viewing individual plans
    if (this.isOrganization && (plan.slug === 'free' || plan.slug === 'premium' || plan.plan_type === 'individual')) {
      return 'Individual Only';
    }

    // Individual account viewing team plan
    if (!this.isOrganization && (plan.slug === 'team' || plan.plan_type === 'organization')) {
      return 'Business Only';
    }

    if (this.isEligibleForTrial() && plan.slug !== 'free') return `Start free trial for ${trialDuration}`;


    if (monthlyPrice === 0) return 'Start for Free';
    const planName = plan.name || 'Plan';
    return `Upgrade to ${planName}`;
  }

  isEligibleForTrial(): boolean {
    if (!this.isLoggedIn) return true;
    if (this.hasUsedTrial) return false;
    return this.currentPlanStatus === 'trial' || this.currentPlanSlug === 'free';
  }

  isTrialActive(): boolean {
    return this.isLoggedIn && this.currentPlanStatus === 'trial';
  }

  isTrialExpired(): boolean {
    if (!this.isLoggedIn) return false;
    // The backend returns them to the free plan if their trial expires
    return (this.hasUsedTrial && this.currentPlanSlug === 'free') || this.currentPlanStatus === 'expired';
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
    if (this.isLoggedIn && this.currentPlanSlug !== 'free') {
      return false;
    }
    return true;
  }

  showContactModal = false;
  showLoginPromptModal = false;
  pendingPlanSlug = '';

  contactModalMessage = 'Your free trial has expired. To continue using premium features, please contact our sales team.';

  openContactModal(): void {
    const trialDuration = this.formatTrialDuration();
    this.contactModalMessage = `Your ${trialDuration} free trial has expired. To continue using premium features, please contact our sales team.`;
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
    if (this.auth.isSuperAdmin()) return true;
    if (!this.isLoggedIn) return false;
    if (this.currentPlanStatus === 'expired') return false;

    // If they are on this exact plan (active or trial), disable the button
    if (this.currentPlanSlug && this.currentPlanSlug === plan.slug) {
      return true;
    }

    // Business account cannot subscribe to individual plans
    if (this.isOrganization && (plan.slug === 'free' || plan.slug === 'premium' || plan.plan_type === 'individual')) {
      return true;
    }

    // Individual account cannot subscribe to team plan
    if (!this.isOrganization && (plan.slug === 'team' || plan.plan_type === 'organization')) {
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
    if (this.auth.isSuperAdmin()) {
      return;
    }

    if (!this.isLoggedIn) {
      this.openLoginPromptModal(plan.slug);
      return;
    }

    if (this.isOrganization && (plan.slug === 'free' || plan.slug === 'premium' || plan.plan_type === 'individual')) {
      this.svc.showToast('Business accounts can only subscribe to the Team plan.', 4000, 'error');
      return;
    }

    if (!this.isOrganization && (plan.slug === 'team' || plan.plan_type === 'organization')) {
      this.svc.showToast('Team plan is only available for Business/Organization accounts.', 4000, 'error');
      return;
    }

    if (this.auth.isOrganizationMember() && plan.slug !== 'free' && plan.slug !== this.currentPlanSlug) {
      this.contactModalMessage = 'You are a team member and cannot modify the organization plan. Please contact your administrator or sales.';
      this.showContactModal = true;
      return;
    }

    if ((this.currentPlanStatus === 'active' || this.currentPlanStatus === 'trial') && this.currentPlanSlug !== 'free' && plan.slug !== this.currentPlanSlug && plan.slug !== 'free') {
      this.contactModalMessage = 'To switch to a different plan, you need to cancel your ongoing plan first. Please contact sales.';
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
        next: (res) => {
          console.log('ORG UPGRADE RESPONSE:', res);
          const localSubId = res.data?.subscription_id || res.subscription_id;

          // Check if the plan requires payment (status will be 'expired' or pending)
          if (res.data?.status === 'expired' && localSubId) {
            this.initiateRazorpayPayment(localSubId, plan);
            return;
          }

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
    this.http.post<any>(upgradeUrl, { planSlug: plan.slug, currency: this.selectedCurrency }, { withCredentials: true }).subscribe({
      next: (res) => {
        const localSubId = res.data?.subscription_id;

        // Check if the plan is paid (no trial) and requires Razorpay
        if (res.data?.status === 'expired' && localSubId) {
          this.initiateRazorpayPayment(localSubId, plan);
          return;
        }

        // If it's a free trial or free plan, just succeed
        this.auth.getUserFeatures().subscribe();
        this.upgrading = false;
        this.svc.showToast(`Upgraded to ${plan.name} successfully!`, 3000, 'success');

        // Proactively update localStorage so the reload is perfectly seamless
        if (typeof window !== 'undefined') {
          localStorage.setItem('cachedPlanSlug', plan.slug);
          if (plan.slug !== 'free') {
            localStorage.setItem('cachedHasUsedTrial', 'true');
          }
        }

        if ((this.auth as any).setCurrentPlanSlug) {
          (this.auth as any).setCurrentPlanSlug(plan.slug);
          (this.auth as any).setCurrentPlanStatus(res.data?.status || 'trial');
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
          this.upgrading = false;
          this.svc.showToast('Failed to generate payment gateway link.', 4000, 'error');
          this.cdr.detectChanges();
          return;
        }

        const isLoaded = await this.loadRazorpayScript();
        if (!isLoaded) {
          this.upgrading = false;
          this.svc.showToast('Failed to load payment gateway.', 4000, 'error');
          this.cdr.detectChanges();
          return;
        }

        const razorpayKey = res.key_id || environment.razorpayKeyId || this.appConfig.environment?.appConfig?.razorpayKeyId;
        if (!razorpayKey) {
          this.upgrading = false;
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
            this.upgrading = true; // Keep loading while verifying
            this.http.post<any>(verifySubUrl, {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature
            }, { withCredentials: true }).subscribe({
              next: () => {
                this.upgrading = false;
                this.svc.showToast(`Payment successful! Welcome to ${plan.name}.`, 3000, 'success');

                if (typeof window !== 'undefined') {
                  localStorage.setItem('cachedPlanSlug', plan.slug);
                  localStorage.setItem('cachedHasUsedTrial', 'true');
                }
                if ((this.auth as any).setCurrentPlanSlug) {
                  (this.auth as any).setCurrentPlanSlug(plan.slug);
                }
                this.cdr.detectChanges();
                setTimeout(() => window.location.reload(), 1500);
              },
              error: () => {
                this.upgrading = false;
                this.svc.showToast('Payment successful, but verification failed. Please contact support.', 5000, 'error');
                this.cdr.detectChanges();
              }
            });
          },
          theme: {
            color: "#2563eb"
          },
          modal: {
            ondismiss: () => {
              this.upgrading = false;
              this.svc.showToast('Payment cancelled.', 3000, 'error');
              this.cdr.detectChanges();
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', (response: any) => {
          this.upgrading = false;
          this.svc.showToast('Payment failed: ' + response.error.description, 4000, 'error');
          this.cdr.detectChanges();
        });
        rzp.open();
      },
      error: (err) => {
        this.upgrading = false;
        this.svc.showToast('Error initiating checkout. Please try again.', 4000, 'error');
        this.cdr.detectChanges();
      }
    });
  }
}
