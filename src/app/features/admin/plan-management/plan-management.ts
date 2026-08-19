import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';
import { DashboardService } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-plan-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plan-management.html'
})
export class PlanManagementComponent implements OnInit {
  private admin = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);
  public dashService = inject(DashboardService);

  plans: any[] = [];
  features: any[] = [];
  loading = true;
  loadingEntitlements = false;
  showModal = false;
  showEntitlementsView = false;
  editMode = false;
  selectedPlan: any = {};
  planEntitlements: any[] = [];
  form: any = {};

  /** Filter tab on the plans list: 'all' | 'individual' | 'organization' */
  planTypeFilter: 'all' | 'individual' | 'organization' = 'all';

  get filteredPlans(): any[] {
    if (this.planTypeFilter === 'all') return this.plans;
    return this.plans.filter(p => p.plan_type === this.planTypeFilter || p.plan_type === 'both');
  }

  get individualPlanCount(): number {
    return this.plans.filter(p => p.plan_type === 'individual' || p.plan_type === 'both').length;
  }

  get orgPlanCount(): number {
    return this.plans.filter(p => p.plan_type === 'organization' || p.plan_type === 'both').length;
  }

  ngOnInit(): void { this.loadPlans(); this.loadFeatures(); }

  loadPlans(): void {
    this.loading = true;
    this.admin.getPlans().subscribe({
      next: (res) => {
        this.plans = res?.data || [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadFeatures(): void {
    this.admin.getFeatures().subscribe({
      next: (res) => {
        this.features = res?.data || [];
        this.cdr.detectChanges();
      }
    });
  }

  formErrors = { name: '', slug: '' };

  openCreate(): void {
    this.editMode = false;
    this.form = {
      name: '',
      slug: '',
      description: '',
      plan_type: 'individual',   // 'individual' | 'organization' | 'both'
      price_monthly: 0,
      price_annual: 0,
      is_per_seat: false,        // true = per-user billing (org plans)
      included_seats: 1,
      trial_days: 0,
      cta_text: 'Get Started',
      highlight_color: '',
      badge_text: '',
      is_active: true,
      is_custom: false,
      custom_email: '',
      is_public: true
    };
    this.formErrors = { name: '', slug: '' };
    this.showModal = true;
  }

  openEdit(plan: any): void {
    this.editMode = true;
    this.form = { ...plan };
    this.formErrors = { name: '', slug: '' };
    this.showModal = true;
  }

  closeModal(): void { this.showModal = false; }

  savePlan(): void {
    this.formErrors = { name: '', slug: '' };
    let hasError = false;

    if (!this.form.name || !this.form.name.trim()) {
      this.formErrors.name = 'Plan name is required.';
      hasError = true;
    }

    if (!this.form.slug || !this.form.slug.trim()) {
      this.generateSlug();
    }

    if (!this.form.slug || !this.form.slug.trim()) {
      this.formErrors.slug = 'Plan slug is required.';
      hasError = true;
    }

    if (this.form.is_custom && (!this.form.custom_email || !this.form.custom_email.trim())) {
      this.dashService.showToast('Email is required for custom plans', 3000, 'error');
      hasError = true;
    }

    if (hasError) {
      this.cdr.detectChanges();
      return;
    }

    const obs = this.editMode
      ? this.admin.updatePlan(this.form.plan_id, this.form)
      : this.admin.createPlan(this.form);

    obs.subscribe({
      next: () => {
        this.dashService.showToast(this.editMode ? 'Plan updated successfully!' : 'Plan created successfully!', 3500, 'success');
        this.closeModal();
        this.loadPlans();
      },
      error: (err: any) => {
        this.dashService.showToast(err?.error?.message || 'Error saving plan', 4000, 'error');
      }
    });
  }

  showConfirmModal = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmButtonText = '';
  confirmActionType: 'deactivate' | 'activate' = 'deactivate';
  pendingPlanId: number | null = null;

  deletePlan(id: number): void {
    this.pendingPlanId = id;
    this.confirmTitle = 'Deactivate Plan';
    this.confirmMessage = 'Are you sure you want to deactivate this plan? Existing active subscribers will retain access until expiration.';
    this.confirmButtonText = 'Deactivate';
    this.confirmActionType = 'deactivate';
    this.showConfirmModal = true;
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.pendingPlanId = null;
  }

  executeConfirmedAction(): void {
    if (!this.pendingPlanId) return;
    const id = this.pendingPlanId;
    this.closeConfirmModal();

    this.admin.deletePlan(id).subscribe({
      next: () => {
        this.dashService.showToast('Plan deactivated successfully!', 3500, 'success');
        this.loadPlans();
      },
      error: (err: any) => {
        this.dashService.showToast(err?.error?.message || 'Error deactivating plan', 4000, 'error');
      }
    });
  }

  openEntitlements(plan: any): void {
    this.selectedPlan = plan;
    this.showEntitlementsView = true;
    this.loadingEntitlements = true;
    this.admin.getPlanEntitlements(plan.plan_id).subscribe({
      next: (res) => {
        this.planEntitlements = this.features.map(f => {
          const existing = (res?.data || []).find((e: any) => e.feature_id === f.feature_id);
          const rawText = (existing?.display_text || '').trim();
          const cleanText = (rawText === '—' || rawText === '-' || rawText === 'null') ? '' : rawText;

          return {
            feature_id: f.feature_id,
            feature_key: f.feature_key,
            name: f.name,
            value_type: f.value_type,
            value: existing?.value || 'false',
            limit_value: existing?.limit_value || null,
            display_text: cleanText
          };
        });
        this.loadingEntitlements = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingEntitlements = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeEntitlementsView(): void {
    this.showEntitlementsView = false;
    this.selectedPlan = {};
  }

  saveEntitlements(): void {
    const entitlements = this.planEntitlements.map(e => {
      const dt = (e.display_text || '').trim();
      return {
        feature_id: e.feature_id,
        value: e.value,
        limit_value: e.limit_value,
        display_text: (dt === '—' || dt === '-' || dt === 'null') ? '' : dt
      };
    });
    this.admin.updatePlanEntitlements(this.selectedPlan.plan_id, entitlements).subscribe({
      next: () => {
        this.dashService.showToast('Plan entitlements saved successfully!', 3500, 'success');
        this.closeEntitlementsView();
      },
      error: (err: any) => {
        this.dashService.showToast(err?.error?.message || 'Error saving entitlements', 4000, 'error');
      }
    });
  }

  generateSlug(): void {
    if (!this.editMode) {
      this.form.slug = (this.form.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
  }

  getFeaturePlaceholder(ent: any): string {
    if (!ent) return 'e.g. Display text';
    const key = (ent.feature_key || '').toLowerCase();
    const name = ent.name || 'Feature';

    if (key.includes('diagram') || key.includes('schema')) {
      return 'e.g. Up to 10 diagrams';
    }
    if (key.includes('member') || key.includes('seat') || key.includes('user')) {
      return 'e.g. Up to 5 team members';
    }
    if (key.includes('export') || key.includes('pdf') || key.includes('sql') || key.includes('image')) {
      return `e.g. ${name}`;
    }
    if (key.includes('storage') || key.includes('space')) {
      return 'e.g. 10 GB Storage';
    }
    if (ent.value_type === 'boolean') {
      return `e.g. ${name} Included`;
    }
    return `e.g. ${name}`;
  }
}
