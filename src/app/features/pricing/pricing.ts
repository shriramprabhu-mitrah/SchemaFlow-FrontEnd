import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
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

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, RouterModule, Icons, ButtonComponent],
  templateUrl: './pricing.html',
})
export class PricingComponent implements OnInit {
  isLoggedIn = false;
  isAnnual = true;
  plans: any[] = [];
  loading = true;

  /** Which audience tab is currently selected */
  planAudience: 'individual' | 'organization' = 'individual';

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

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.isLoggedIn = this.auth.isLoggedIn();
      // Default the tab to match the logged-in user's account type
      if (this.isLoggedIn) {
        const accountType = this.auth.getAccountType();
        if (accountType === 'organization') {
          this.planAudience = 'organization';
        }
      }
    }
    this.loadPlans();
  }

  loadPlans(): void {
    const url = this.appConfig.environment?.pricingApiUrls?.plans;
    if (url) {
      this.http.get<any>(url).subscribe({
        next: (res) => {
          this.plans = res?.data && res.data.length > 0 ? res.data : FALLBACK_PLANS;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.plans = FALLBACK_PLANS;
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.plans = FALLBACK_PLANS;
      this.loading = false;
    }
  }

  /** Plans filtered by selected audience tab.
   *  Supports: plan.plan_type === 'individual' | 'organization' | 'both'
   *  Falls back to showing all plans when no plan_type field is set (backward-compatible). */
  get displayedPlans(): any[] {
    const hasTypedPlans = this.plans.some(p => p.plan_type);
    if (!hasTypedPlans) {
      // Backend hasn't added plan_type yet — show all plans for both tabs
      return this.plans;
    }
    return this.plans.filter(p =>
      p.plan_type === this.planAudience || p.plan_type === 'both'
    );
  }

  setAudience(audience: 'individual' | 'organization'): void {
    this.planAudience = audience;
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

  /** CTA button label depending on audience + plan type + login state */
  getCtaLabel(plan: any): string {
    if (plan.slug === 'enterprise') return 'Contact Sales';

    const monthlyPrice = parseFloat(plan.price_monthly || '0');

    // --- Public (not logged in) ---
    if (!this.isLoggedIn) {
      if (plan.cta_text) return plan.cta_text;
      if (monthlyPrice === 0) return 'Sign Up Free';
      if (this.planAudience === 'organization') return 'Sign Up & Try Free';
      return 'Sign Up & Get Started';
    }

    // --- Logged-in user ---
    const currentPlanSlug = (this.auth as any).getCurrentPlanSlug?.() || '';
    if (currentPlanSlug && currentPlanSlug === plan.slug) return 'Current Plan';

    if (monthlyPrice === 0) return 'Start for Free';
    const planName = plan.name || 'Plan';
    return `Upgrade to ${planName}`;
  }

  /** Whether the CTA button should be disabled (e.g. user is already on this plan) */
  isCtaDisabled(plan: any): boolean {
    if (!this.isLoggedIn) return false;
    const currentPlanSlug = (this.auth as any).getCurrentPlanSlug?.() || '';
    return !!(currentPlanSlug && currentPlanSlug === plan.slug);
  }

  upgrading = false;

  selectPlan(plan: any): void {
    if (!this.isLoggedIn) {
      this.router.navigate(['/auth/register'], {
        queryParams: {
          type: this.planAudience,
          plan: plan.slug
        }
      });
      return;
    }

    // Enterprise — contact sales / go to org subscription page
    if (plan.slug === 'enterprise') {
      if (this.auth.isOrganizationAccount()) {
        this.router.navigate(['/organization/subscription']);
      } else {
        window.open('mailto:sales@mitrah.in?subject=Enterprise Plan Inquiry', '_blank');
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

const FALLBACK_PLANS = [
  {
    slug: 'free',
    name: 'Free',
    description: 'For developers drafting personal schemas and single diagrams.',
    price_monthly: '0.00',
    price_annual: '0.00',
    plan_type: 'individual',
    highlight_color: '#3ec5c1',
    entitlements: [
      { feature_key: 'digram_hide', value: 'false' },
      { feature_key: 'create_diagrams', value: 'true', limit_value: 5, display_text: 'Upto 5 Diagrams' },
      { feature_key: 'edit_diagram', value: 'true' },
      { feature_key: 'customize_canvas', value: 'true' },
      { feature_key: 'table_group', value: 'false' },
      { feature_key: 'table_color_and_connection_color', value: 'false' },
      { feature_key: 'import_sql', value: 'false' },
      { feature_key: 'export_image', value: 'true' },
      { feature_key: 'export_sql', value: 'false' },
      { feature_key: 'document_view', value: 'false' },
      { feature_key: 'version_history', value: 'false' },
      { feature_key: 'create_workspaces', value: 'false' },
      { feature_key: 'workspace_members', value: 'false' },
      { feature_key: 'workspace_types', value: 'personal' },
      { feature_key: 'realtime_collab', value: 'false' },
      { feature_key: 'sso', value: 'false' },
      { feature_key: 'audit_logs', value: 'false' },
      { feature_key: 'custom_hosting', value: 'false' },
      { feature_key: 'api_access', value: 'false' },
      { feature_key: 'advanced_iam', value: 'false' },
      { feature_key: 'share_diagram', value: 'false' },
      { feature_key: 'diagram_notes', value: 'false' },
      { feature_key: 'max_workspace_members', value: 'false', limit_value: 5 },
      { feature_key: 'diagram_detailing', value: 'false' }
    ]
  },
  {
    slug: 'premium',
    name: 'Premium Schema',
    description: 'For individual freelancers and consultants managing relational setups.',
    price_monthly: '399.00',
    price_annual: '299.00',
    plan_type: 'individual',
    highlight_color: '#3b82f6',
    entitlements: [
      { feature_key: 'digram_hide', value: 'true' },
      { feature_key: 'create_diagrams', value: 'true', limit_value: -1, display_text: 'Unlimited diagrams' },
      { feature_key: 'edit_diagram', value: 'true' },
      { feature_key: 'customize_canvas', value: 'true' },
      { feature_key: 'table_group', value: 'true' },
      { feature_key: 'table_color_and_connection_color', value: 'true' },
      { feature_key: 'import_sql', value: 'true' },
      { feature_key: 'export_image', value: 'true' },
      { feature_key: 'export_sql', value: 'true' },
      { feature_key: 'document_view', value: 'true' },
      { feature_key: 'version_history', value: 'false' },
      { feature_key: 'create_workspaces', value: 'false' },
      { feature_key: 'workspace_members', value: 'false', limit_value: 0 },
      { feature_key: 'workspace_types', value: 'personal' },
      { feature_key: 'realtime_collab', value: 'false' },
      { feature_key: 'sso', value: 'false' },
      { feature_key: 'audit_logs', value: 'false' },
      { feature_key: 'custom_hosting', value: 'false' },
      { feature_key: 'api_access', value: 'false' },
      { feature_key: 'advanced_iam', value: 'false' },
      { feature_key: 'share_diagram', value: 'true' },
      { feature_key: 'diagram_notes', value: 'true' },
      { feature_key: 'max_workspace_members', value: 'false' },
      { feature_key: 'diagram_detailing', value: 'true' }
    ]
  },
  {
    slug: 'team',
    name: 'Team',
    description: 'For collaborative product squads syncing database schema blueprints.',
    price_monthly: '1999.00',
    price_annual: '1599.00',
    plan_type: 'organization',
    highlight_color: '#10b981',
    badge_text: 'POPULAR COLLABORATION',
    entitlements: [
      { feature_key: 'digram_hide', value: 'true' },
      { feature_key: 'create_diagrams', value: 'true', limit_value: -1, display_text: 'Unlimited diagrams' },
      { feature_key: 'edit_diagram', value: 'true' },
      { feature_key: 'customize_canvas', value: 'true' },
      { feature_key: 'table_group', value: 'true' },
      { feature_key: 'table_color_and_connection_color', value: 'true' },
      { feature_key: 'import_sql', value: 'true' },
      { feature_key: 'export_image', value: 'true' },
      { feature_key: 'export_sql', value: 'true' },
      { feature_key: 'document_view', value: 'true' },
      { feature_key: 'version_history', value: 'true' },
      { feature_key: 'create_workspaces', value: 'true', limit_value: -1, display_text: 'Unlimited' },
      { feature_key: 'workspace_members', value: 'true', limit_value: 5, display_text: 'Max 5 members' },
      { feature_key: 'workspace_types', value: 'all', display_text: 'Personal & Shared' },
      { feature_key: 'realtime_collab', value: 'true' },
      { feature_key: 'sso', value: 'false' },
      { feature_key: 'audit_logs', value: 'false' },
      { feature_key: 'custom_hosting', value: 'false' },
      { feature_key: 'api_access', value: 'false' },
      { feature_key: 'advanced_iam', value: 'false' },
      { feature_key: 'share_diagram', value: 'true' },
      { feature_key: 'diagram_notes', value: 'true' },
      { feature_key: 'max_workspace_members', value: 'false' },
      { feature_key: 'diagram_detailing', value: 'true' }
    ]
  },
  {
    slug: 'enterprise',
    name: 'Enterprise Shield',
    description: 'For organizations requiring custom hostings, SLAs, and SAML SSO.',
    price_monthly: '0.00',
    price_annual: '0.00',
    plan_type: 'organization',
    highlight_color: '#f59e0b',
    entitlements: [
      { feature_key: 'digram_hide', value: 'true' },
      { feature_key: 'create_diagrams', value: 'true', limit_value: -1, display_text: 'Unlimited diagrams' },
      { feature_key: 'edit_diagram', value: 'true' },
      { feature_key: 'customize_canvas', value: 'true' },
      { feature_key: 'table_group', value: 'true' },
      { feature_key: 'table_color_and_connection_color', value: 'true' },
      { feature_key: 'import_sql', value: 'true' },
      { feature_key: 'export_image', value: 'true' },
      { feature_key: 'export_sql', value: 'true' },
      { feature_key: 'document_view', value: 'true' },
      { feature_key: 'version_history', value: 'true' },
      { feature_key: 'create_workspaces', value: 'true', limit_value: -1, display_text: 'Unlimited' },
      { feature_key: 'workspace_members', value: 'true', limit_value: -1, display_text: 'Unlimited members' },
      { feature_key: 'workspace_types', value: 'all', display_text: 'Personal & Shared' },
      { feature_key: 'realtime_collab', value: 'true' },
      { feature_key: 'sso', value: 'true' },
      { feature_key: 'audit_logs', value: 'true' },
      { feature_key: 'custom_hosting', value: 'true' },
      { feature_key: 'api_access', value: 'true' },
      { feature_key: 'advanced_iam', value: 'true' },
      { feature_key: 'share_diagram', value: 'true' },
      { feature_key: 'diagram_notes', value: 'true' },
      { feature_key: 'max_workspace_members', value: 'true', limit_value: -1 },
      { feature_key: 'diagram_detailing', value: 'true' }
    ]
  }
];

