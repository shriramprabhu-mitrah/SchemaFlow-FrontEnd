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

@Component({
  selector: 'app-upgrade-modal',
  standalone: true,
  imports: [CommonModule, RouterModule, Icons, ButtonComponent],
  templateUrl: './upgrade-modal.html'
})
export class UpgradeModalComponent implements OnInit {
  private _visible = false;
  @Input()
  set visible(val: boolean) {
    this._visible = val;
      if (val) {
      this.isLoggedIn = this.auth.isLoggedIn();
      if (this._featureKey === 'create_diagrams') {
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
    if (this._featureKey === 'create_diagrams') {
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

  private http = inject(HttpClient);
  private appConfig = inject(AppConfigService);
  private cdr = inject(ChangeDetectorRef);
  private orgService = inject(OrganizationService);

  constructor(
    private auth: AuthService,
    private router: Router,
    private svc: DashboardService
  ) { }

  get limitEntityName(): string {
    switch (this.featureKey) {
      case 'create_diagrams': return 'diagram';
      case 'create_workspaces': return 'workspace';
      case 'workspace_members': return 'team member';
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
      this.loadPlans();
    }
  }

  loadPlans(): void {
    const url = this.appConfig.environment?.pricingApiUrls?.plans;
    if (url) {
      this.http.get<any>(url).pipe(timeout(2500)).subscribe({
        next: (res) => {
          this.allPlans = res?.data && res.data.length > 0 ? res.data : FALLBACK_PLANS;
          this.applyFeatureFilter();
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.warn('Upgrade plans API load failed, using local fallback:', err);
          this.allPlans = FALLBACK_PLANS;
          this.applyFeatureFilter();
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.allPlans = FALLBACK_PLANS;
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
    // If it's a workspace or version history restriction, or they are an org account, show Team & Enterprise
    if (this._featureKey === 'create_workspaces' || this._featureKey === 'version_history' || this.isOrganization) {
      return this.plans.filter(p => p.slug === 'team' || p.slug === 'enterprise');
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

  isValidFeature(text: string | null | undefined): boolean {
    if (!text) return false;
    const trimmed = text.trim();
    return trimmed !== '' && trimmed !== '—' && trimmed !== '-' && trimmed !== '0';
  }

  getCtaLabel(plan: any): string {
    const currentPlanSlug = (this.auth as any).getCurrentPlanSlug?.() || '';
    if (this.isLoggedIn && currentPlanSlug && currentPlanSlug === plan.slug) return 'Current Plan';

    if (plan.slug === 'enterprise') return 'Contact Sales';

    const monthlyPrice = parseFloat(plan.price_monthly || '0');

    if (!this.isLoggedIn) {
      if (plan.cta_text) return plan.cta_text;
      if (monthlyPrice === 0) return 'Sign Up Free';
      if (this.isOrganization) return 'Sign Up & Try Free';
      return 'Sign Up & Get Started';
    }

    // Logged-in user: show contextual upgrade label based on plan type
    if (monthlyPrice === 0) return 'Start for Free';
    const planName = plan.name || 'Plan';
    return `Upgrade to ${planName}`;
  }

  isCtaDisabled(plan: any): boolean {
    if (!this.isLoggedIn) return false;
    const currentPlanSlug = (this.auth as any).getCurrentPlanSlug?.() || '';
    return !!(currentPlanSlug && currentPlanSlug === plan.slug);
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
        next: () => {
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
    } else {
      // Individual user — call /api/profile/subscription/upgrade
      const upgradeUrl = this.appConfig.environment?.pricingApiUrls?.profileUpgrade;
      if (!upgradeUrl) {
        this.svc.showToast('Upgrade endpoint not configured.', 4000, 'error');
        return;
      }
      this.loading = true;
      this.http.post<any>(upgradeUrl, { planSlug: plan.slug }).subscribe({
        next: () => {
          this.auth.getUserFeatures().subscribe();
          this.loading = false;
          this.svc.showToast('Plan upgraded successfully!', 3000, 'success');
          if ((this.auth as any).setCurrentPlanSlug) {
            (this.auth as any).setCurrentPlanSlug(plan.slug);
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
