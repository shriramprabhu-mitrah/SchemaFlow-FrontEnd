import { Component, OnInit, inject, ChangeDetectorRef, HostListener, NgZone, signal, ApplicationRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { EntitlementService } from '../../../core/services/entitlement.service';

import { Subject, forkJoin, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, catchError } from 'rxjs/operators';
import { Icons } from '../../../core/component/icons/icons';

@Component({
  selector: 'app-plan-management',
  standalone: true,
  imports: [CommonModule, FormsModule, Icons],
  templateUrl: './plan-management.html'
})
export class PlanManagementComponent implements OnInit {
  private admin = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);
  private appRef = inject(ApplicationRef);
  private ngZone = inject(NgZone);
  public dashService = inject(DashboardService);
  private entitlementService = inject(EntitlementService);

  private _savingEntitlements = signal(false);
  get savingEntitlements(): boolean { return this._savingEntitlements(); }
  set savingEntitlements(v: boolean) { this._savingEntitlements.set(v); }

  private _plans = signal<any[]>([]);
  get plans(): any[] { return this._plans(); }
  set plans(v: any[]) { this._plans.set(v); }

  features: any[] = [];
  rawPlanEntitlements: any[] = []; // Stores all entitlements for the selected plan
  search = '';
  featureSearch = '';
  featureSortColumn = 'name';
  featureSortAsc = true;

  private _featurePage = signal(1);
  get featurePage(): number { return this._featurePage(); }
  set featurePage(v: number) { this._featurePage.set(v); }

  featureLimit = 10;

  private _totalFeatureCount = signal(0);
  get totalFeatureCount(): number { return this._totalFeatureCount(); }
  set totalFeatureCount(v: number) { this._totalFeatureCount.set(v); }

  showFeatureLimitDropdown = false;

  editedEntitlementsMap = new Map<number, any>();

  page = 1;
  limit = 10;
  showLimitDropdown = false;
  activeEntDropdownId: number | null = null;

  @HostListener('document:click')
  onDocumentClick() {
    this.showLimitDropdown = false;
    this.activeEntDropdownId = null;
  }

  sortColumn = 'name';
  sortAsc = true;

  private _loading = signal(true);
  get loading(): boolean { return this._loading(); }
  set loading(v: boolean) { this._loading.set(v); }

  private _loadingEntitlements = signal(false);
  get loadingEntitlements(): boolean { return this._loadingEntitlements(); }
  set loadingEntitlements(v: boolean) { this._loadingEntitlements.set(v); }

  showModal = false;

  private _showEntitlementsView = signal(false);
  get showEntitlementsView(): boolean { return this._showEntitlementsView(); }
  set showEntitlementsView(v: boolean) { this._showEntitlementsView.set(v); }

  editMode = false;
  selectedPlan: any = {};

  private _planEntitlements = signal<any[]>([]);
  get planEntitlements(): any[] { return this._planEntitlements(); }
  set planEntitlements(v: any[]) { this._planEntitlements.set(v); }

  form: any = {};

  refreshView(): void {
    this.cdr.markForCheck();
    this.cdr.detectChanges();
    try {
      this.appRef.tick();
    } catch {}
    setTimeout(() => {
      this.cdr.markForCheck();
      this.cdr.detectChanges();
      try {
        this.appRef.tick();
      } catch {}
    }, 0);
  }

  /** Filter tab on the plans list: 'all' | 'individual' | 'organization' */
  planTypeFilter: 'all' | 'individual' | 'organization' = 'all';



  get totalFeaturePagesCount(): number {
    return Math.ceil(this.totalFeatureCount / this.featureLimit) || 1;
  }

  get featureTotalPages(): number[] {
    const total = this.totalFeaturePagesCount;
    const current = this.featurePage;
    const maxVisible = 5;

    if (total <= maxVisible) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    const pages: number[] = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  get featurePaginationStartIndex(): number {
    if (this.totalFeatureCount === 0) return 0;
    return (this.featurePage - 1) * this.featureLimit + 1;
  }

  get featurePaginationEndIndex(): number {
    return Math.min(this.featurePage * this.featureLimit, this.totalFeatureCount);
  }

  get paginatedPlanEntitlements(): any[] {
    return this.planEntitlements;
  }

  isEntitlementChanged(ent: any): boolean {
    if (!ent || !ent.feature_id) return false;
    const entId = Number(ent.feature_id);
    const rawList = Array.isArray(this.rawPlanEntitlements) ? this.rawPlanEntitlements : [];
    const raw = rawList.find((r: any) => r && Number(r.feature_id) === entId);
    const rawVal = raw ? String(raw.value ?? 'false') : 'false';
    const curVal = String(ent.value ?? 'false');

    const rawLimit = (raw?.limit_value === null || raw?.limit_value === undefined || raw?.limit_value === '') ? null : Number(raw.limit_value);
    const curLimit = (ent.limit_value === null || ent.limit_value === undefined || ent.limit_value === '') ? null : Number(ent.limit_value);

    const rawText = (raw?.display_text || '').trim();
    const cleanRawText = (rawText === '—' || rawText === '-' || rawText === 'null') ? '' : rawText;
    const curText = (ent.display_text || '').trim();
    const cleanCurText = (curText === '—' || curText === '-' || curText === 'null') ? '' : curText;

    return (rawVal !== curVal) || (rawLimit !== curLimit) || (cleanRawText !== cleanCurText);
  }

  syncCurrentPageToEdits(): void {
    if (!this.planEntitlements || !Array.isArray(this.planEntitlements) || this.planEntitlements.length === 0) return;
    for (const ent of this.planEntitlements) {
      if (!ent || !ent.feature_id) continue;
      const fId = Number(ent.feature_id);
      if (this.isEntitlementChanged(ent)) {
        const curLimit = (ent.limit_value === null || ent.limit_value === undefined || ent.limit_value === '') ? null : Number(ent.limit_value);
        const curText = (ent.display_text || '').trim();
        const cleanCurText = (curText === '—' || curText === '-' || curText === 'null') ? '' : curText;
        this.editedEntitlementsMap.set(fId, {
          feature_id: fId,
          feature_key: ent.feature_key,
          name: ent.name,
          value_type: ent.value_type,
          value: String(ent.value ?? 'false'),
          limit_value: isNaN(curLimit as number) ? null : curLimit,
          display_text: cleanCurText
        });
      } else {
        this.editedEntitlementsMap.delete(fId);
      }
    }
  }

  onEntitlementFieldChange(ent?: any): void {
    this.syncCurrentPageToEdits();
    this.cdr.detectChanges();
  }

  setEntitlementValue(ent: any, val: string): void {
    if (!ent) return;
    ent.value = val;
    this.onEntitlementFieldChange(ent);
  }

  goToFeaturePage(p: number): void {
    if (p < 1 || p > this.totalFeaturePagesCount || this.featurePage === p) return;

    // Sync any edits made on the current page into the persistent in-memory draft map
    this.syncCurrentPageToEdits();

    // Seamlessly navigate to target page - no modal popup (single save across all pages)
    this.featurePage = p;
    this.loadFeatures();
  }

  onFeatureLimitChange(): void {
    this.syncCurrentPageToEdits();
    this.featurePage = 1;
    this.loadFeatures();
  }

  sortByFeature(col: string): void {
    this.syncCurrentPageToEdits();
    if (this.featureSortColumn === col) {
      this.featureSortAsc = !this.featureSortAsc;
    } else {
      this.featureSortColumn = col;
      this.featureSortAsc = true;
    }
    this.featurePage = 1;
    this.loadFeatures();
  }

  get filteredPlansList(): any[] {
    if (this.planTypeFilter === 'all') {
      return this.plans;
    } else if (this.planTypeFilter === 'individual') {
      return this.plans.filter(p => p.plan_type === 'individual' || p.plan_type === 'both' || !p.plan_type);
    } else if (this.planTypeFilter === 'organization') {
      return this.plans.filter(p => p.plan_type === 'organization' || p.plan_type === 'both' || !p.plan_type);
    }
    return this.plans;
  }

  get filteredPlans(): any[] {
    return this.filteredPlansList;
  }

  get totalFilteredCount(): number {
    // If we're showing 'all' and there's server pagination, use the total from the server
    if (this.planTypeFilter === 'all') {
      return this._serverTotalCount;
    }
    // Otherwise rely on the filtered list length for the current page.
    return this.filteredPlansList.length;
  }

  private _serverTotalCount = 0;


  get totalPagesCount(): number {
    return Math.ceil(this.totalFilteredCount / this.limit) || 1;
  }

  get totalPages(): number[] {
    const total = this.totalPagesCount;
    const current = this.page;
    const maxVisible = 5;

    if (total <= maxVisible) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    const pages: number[] = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  get paginationStartIndex(): number {
    if (this.totalFilteredCount === 0) return 0;
    return (this.page - 1) * this.limit + 1;
  }

  get paginationEndIndex(): number {
    return Math.min(this.page * this.limit, this.totalFilteredCount);
  }

  get displayPlans(): any[] { return this.filteredPlansList; }

  onSearch(): void { this.searchSubject.next(this.search); }
  goToPage(p: number): void { if (this.page !== p) { this.page = p; this.loadPlans(); } }
  onLimitChange(): void { this.page = 1; this.loadPlans(); }

  sortBy(col: string): void {
    if (this.sortColumn === col) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortColumn = col;
      this.sortAsc = true;
    }
    this.page = 1;
    this.loadPlans();
  }

  get individualPlanCount(): number {
    return this.plans.filter(p => p.plan_type === 'individual' || p.plan_type === 'both').length;
  }

  get orgPlanCount(): number {
    return this.plans.filter(p => p.plan_type === 'organization' || p.plan_type === 'both').length;
  }

  private searchSubject = new Subject<string>();
  private featureSearchSubject = new Subject<string>();

  ngOnInit(): void {
    this.loadPlans();
    this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.ngZone.run(() => {
        this.page = 1;
        this.loadPlans();
      });
    });
    this.featureSearchSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.ngZone.run(() => {
        this.featurePage = 1;
        this.loadFeatures();
      });
    });
  }

  onFeatureSearch(): void {
    this.syncCurrentPageToEdits();
    this.featureSearchSubject.next(this.featureSearch);
  }

  loadPlans(): void {
    this.loading = true;
    this.refreshView();
    this.admin.getPlans(this.page, this.limit, this.search, this.sortColumn, this.sortAsc).subscribe({
      next: (res) => {
        this.plans = res?.data || [];
        this._serverTotalCount = res?.meta?.total || this.plans.length;
        this.loading = false;
        this.refreshView();
      },
      error: () => {
        this.loading = false;
        this.refreshView();
      }
    });
  }

  loadFeatures(): void {
    this.loadingEntitlements = true;
    this.refreshView();
    this.admin.getFeatures(this.featurePage, this.featureLimit, this.featureSearch, this.featureSortColumn, this.featureSortAsc)
      .pipe(catchError((err) => {
        console.error('Error fetching features:', err);
        return of({ data: [], meta: { total: 0 } });
      }))
      .subscribe({
        next: (res) => {
          this.features = res?.data || [];
          this.totalFeatureCount = res?.meta?.total || 0;
          try {
            this.mapFeaturesToEntitlements();
          } catch (err) {
            console.error('Error in mapFeaturesToEntitlements:', err);
          } finally {
            this.loadingEntitlements = false;
            this.refreshView();
          }
        },
        error: () => {
          this.loadingEntitlements = false;
          this.refreshView();
        }
      });
  }

  mapFeaturesToEntitlements(): void {
    if (!Array.isArray(this.features)) {
      this.planEntitlements = [];
      return;
    }
    const rawList = Array.isArray(this.rawPlanEntitlements) ? this.rawPlanEntitlements : [];

    this.planEntitlements = this.features.map(f => {
      if (!f) return null;
      const fId = Number(f.feature_id);
      const edited = this.editedEntitlementsMap.get(fId);
      const existing = rawList.find((e: any) => e && Number(e.feature_id) === fId);
      const rawText = (existing?.display_text || '').trim();
      const cleanText = (rawText === '—' || rawText === '-' || rawText === 'null') ? '' : rawText;

      if (edited) {
        return {
          feature_id: fId,
          feature_key: f.feature_key,
          name: f.name,
          value_type: f.value_type,
          value: edited.value,
          limit_value: edited.limit_value,
          display_text: edited.display_text
        };
      }

      const exLimit = (existing?.limit_value === null || existing?.limit_value === undefined || existing?.limit_value === '') ? null : Number(existing.limit_value);

      return {
        feature_id: fId,
        feature_key: f.feature_key,
        name: f.name,
        value_type: f.value_type,
        value: existing?.value || 'false',
        limit_value: isNaN(exLimit as number) ? null : exLimit,
        display_text: cleanText
      };
    }).filter(item => item !== null);
  }

  formErrors = { name: '', slug: '' };

  onDiscountOrMonthlyChange(): void {
    const monthly = parseFloat(this.form.price_monthly) || 0;
    const discountRaw = this.form.discount_percentage;

    if (discountRaw !== null && discountRaw !== undefined && discountRaw !== '') {
      const discount = parseFloat(discountRaw) || 0;
      const validDiscount = Math.max(0, Math.min(100, discount));
      const annual = monthly - (monthly * (validDiscount / 100));
      this.form.price_annual = Math.round(annual);
    } else {
      this.form.price_annual = Math.round(monthly);
    }
  }

  openCreate(): void {
    this.editMode = false;
    this.form = {
      name: '',
      slug: '',
      description: '',
      plan_type: 'individual',   // 'individual' | 'organization' | 'both'
      discount_percentage: 0,
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

    const monthly = parseFloat(this.form.price_monthly || '0');
    const annual = parseFloat(this.form.price_annual || '0');

    if (this.form.discount_percentage !== undefined && this.form.discount_percentage !== null) {
      this.form.discount_percentage = parseFloat(this.form.discount_percentage) || 0;
    } else if (monthly > 0 && annual >= 0 && annual <= monthly) {
      const calculatedDiscount = ((monthly - annual) / monthly) * 100;
      this.form.discount_percentage = Math.round(calculatedDiscount * 100) / 100;
    } else {
      this.form.discount_percentage = 0;
    }

    this.formErrors = { name: '', slug: '' };
    this.showModal = true;
  }

  closeModal(): void { this.showModal = false; }

  savePlan(): void {
    this.formErrors = { name: '', slug: '' };
    let hasError = false;

    if (this.form.plan_type === 'individual') {
      this.form.is_custom = false;
      this.form.custom_email = '';
    }

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
        this.refreshView();
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
        this.refreshView();
      }
    });
  }

  openEntitlements(plan: any): void {
    this.selectedPlan = plan;
    this.showEntitlementsView = true;
    this.loadingEntitlements = true;
    this.featureSearch = '';
    this.featureSortColumn = 'name';
    this.featureSortAsc = true;
    this.featurePage = 1;
    this.editedEntitlementsMap.clear();
    this.refreshView();

    forkJoin({
      entitlements: this.admin.getPlanEntitlements(plan.plan_id).pipe(catchError((err) => {
        console.error('Error fetching plan entitlements:', err);
        return of({ data: [] });
      })),
      features: this.admin.getFeatures(this.featurePage, this.featureLimit, this.featureSearch, this.featureSortColumn, this.featureSortAsc).pipe(catchError((err) => {
        console.error('Error fetching features:', err);
        return of({ data: [], meta: { total: 0 } });
      }))
    }).subscribe({
      next: (res) => {
        this.rawPlanEntitlements = res.entitlements?.data || [];
        this.features = res.features?.data || [];
        this.totalFeatureCount = res.features?.meta?.total || 0;
        try {
          this.mapFeaturesToEntitlements();
        } catch (err) {
          console.error('Error in mapFeaturesToEntitlements:', err);
        } finally {
          this.loadingEntitlements = false;
          this.refreshView();
        }
      },
      error: () => {
        this.loadingEntitlements = false;
        this.refreshView();
      }
    });
  }

  closeEntitlementsView(): void {
    this.showEntitlementsView = false;
    this.selectedPlan = {};
    this.editedEntitlementsMap.clear();
    this.refreshView();
  }

  saveEntitlements(callback?: () => void): void {
    if (this.savingEntitlements) return;
    this.syncCurrentPageToEdits();
    this.savingEntitlements = true;
    this.cdr.detectChanges();

    const entitlementsMap = new Map<number, any>();

    // 1. Existing rawPlanEntitlements
    if (Array.isArray(this.rawPlanEntitlements)) {
      for (const r of this.rawPlanEntitlements) {
        if (!r || !r.feature_id) continue;
        const dt = (r.display_text || '').trim();
        entitlementsMap.set(Number(r.feature_id), {
          feature_id: Number(r.feature_id),
          value: String(r.value ?? 'false'),
          limit_value: (r.limit_value === null || r.limit_value === undefined || r.limit_value === '') ? null : (isNaN(Number(r.limit_value)) ? null : Number(r.limit_value)),
          display_text: (dt === '—' || dt === '-' || dt === 'null') ? '' : dt
        });
      }
    }

    // 2. Overlay all items currently displayed on this page
    if (Array.isArray(this.planEntitlements)) {
      for (const e of this.planEntitlements) {
        if (!e || !e.feature_id) continue;
        const dt = (e.display_text || '').trim();
        entitlementsMap.set(Number(e.feature_id), {
          feature_id: Number(e.feature_id),
          value: String(e.value ?? 'false'),
          limit_value: (e.limit_value === null || e.limit_value === undefined || e.limit_value === '') ? null : (isNaN(Number(e.limit_value)) ? null : Number(e.limit_value)),
          display_text: (dt === '—' || dt === '-' || dt === 'null') ? '' : dt
        });
      }
    }

    // 3. Overlay any edited entitlements from other pages
    for (const [id, e] of this.editedEntitlementsMap.entries()) {
      if (!id || !e) continue;
      const dt = (e.display_text || '').trim();
      entitlementsMap.set(Number(id), {
        feature_id: Number(id),
        value: String(e.value ?? 'false'),
        limit_value: (e.limit_value === null || e.limit_value === undefined || e.limit_value === '') ? null : (isNaN(Number(e.limit_value)) ? null : Number(e.limit_value)),
        display_text: (dt === '—' || dt === '-' || dt === 'null') ? '' : dt
      });
    }

    const entitlements = Array.from(entitlementsMap.values());

    this.admin.updatePlanEntitlements(this.selectedPlan.plan_id, entitlements).subscribe({
      next: () => {
        this.savingEntitlements = false;
        if (Array.isArray(this.rawPlanEntitlements)) {
          entitlements.forEach(saved => {
            const idx = this.rawPlanEntitlements.findIndex(r => r && r.feature_id === saved.feature_id);
            if (idx >= 0) {
              this.rawPlanEntitlements[idx] = { ...this.rawPlanEntitlements[idx], ...saved };
            } else {
              this.rawPlanEntitlements.push(saved);
            }
          });
        }
        this.editedEntitlementsMap.clear();
        this.dashService.showToast('Plan entitlements saved successfully!', 3500, 'success');
        this.refreshView();
        if (callback) {
          callback();
        }
        this.entitlementService.loadPlans(true).pipe(catchError(() => of([]))).subscribe();
        this.entitlementService.loadEntitlements(true).pipe(catchError(() => of([]))).subscribe();
      },
      error: (err: any) => {
        this.savingEntitlements = false;
        this.dashService.showToast(err?.error?.message || 'Error saving entitlements', 4000, 'error');
        this.refreshView();
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
