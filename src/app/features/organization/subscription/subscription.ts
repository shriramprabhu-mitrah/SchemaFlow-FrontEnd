import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrganizationService } from '../services/organization.service';
import { AuthService } from '../../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { AppConfigService } from '../../../core/services/app-config.service';

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subscription.html'
})
export class SubscriptionComponent implements OnInit {
  private orgService = inject(OrganizationService);
  private auth = inject(AuthService);
  private http = inject(HttpClient);
  private appConfig = inject(AppConfigService);
  private cdr = inject(ChangeDetectorRef);

  subscription: any = null;
  entitlements: any[] = [];
  plans: any[] = [];
  loading = true;

  // Change Plan Selection Modal
  showUpgradeModal = false;

  // Plan Confirmation Popup Card Modal
  showPlanConfirmModal = false;
  pendingPlan: any = null;
  pendingAction: 'upgrade' | 'downgrade' = 'upgrade';

  // Add Seats Popup Card Modal
  showAddSeatsModal = false;
  addSeatCount = 1;

  // Toast Notification Card Popup
  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  // Search, Filter, Sort & Pagination for Entitlements
  searchTerm = '';
  statusFilter: 'all' | 'enabled' | 'disabled' = 'all';
  sortColumn: string = 'feature_name';
  sortAsc: boolean = true;
  currentPage: number = 1;
  pageSize: number = 5;

  get orgId(): number { return this.auth.getOrganizationId() || 0; }

  get filteredEntitlements(): any[] {
    let result = [...(this.entitlements || [])];

    if (this.searchTerm && this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      result = result.filter(e =>
        (e.feature_name && e.feature_name.toLowerCase().includes(term)) ||
        (e.feature_key && e.feature_key.toLowerCase().includes(term))
      );
    }

    if (this.statusFilter !== 'all') {
      const isEnabled = this.statusFilter === 'enabled';
      result = result.filter(e => !!e.enabled === isEnabled);
    }

    result.sort((a, b) => {
      let valA = a[this.sortColumn];
      let valB = b[this.sortColumn];

      const isNullA = valA === undefined || valA === null;
      const isNullB = valB === undefined || valB === null;
      if (isNullA && isNullB) return 0;
      if (isNullA) return this.sortAsc ? 1 : -1;
      if (isNullB) return this.sortAsc ? -1 : 1;

      // Numeric sorting for limits and usage
      if (this.sortColumn === 'effective_limit' || this.sortColumn === 'limit' || this.sortColumn === 'used') {
        let numA = Number(valA);
        let numB = Number(valB);

        // -1 represents unlimited (∞) -> sort at top for descending, bottom for ascending
        if (numA === -1) numA = Infinity;
        if (numB === -1) numB = Infinity;

        if (isNaN(numA)) numA = 0;
        if (isNaN(numB)) numB = 0;

        return this.sortAsc ? numA - numB : numB - numA;
      }

      // Boolean sorting for status
      if (this.sortColumn === 'enabled') {
        const boolA = valA ? 1 : 0;
        const boolB = valB ? 1 : 0;
        return this.sortAsc ? boolA - boolB : boolB - boolA;
      }

      // String sorting for feature name
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return this.sortAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });

    return result;
  }

  get paginatedEntitlements(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredEntitlements.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredEntitlements.length / this.pageSize) || 1;
  }

  get paginationStartIndex(): number {
    if (this.filteredEntitlements.length === 0) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get paginationEndIndex(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredEntitlements.length);
  }

  sortBy(col: string): void {
    if (this.sortColumn === col) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortColumn = col;
      this.sortAsc = true;
    }
    this.currentPage = 1;
    this.cdr.detectChanges();
  }

  setPage(p: number): void {
    if (p >= 1 && p <= this.totalPages) {
      this.currentPage = p;
      this.cdr.detectChanges();
    }
  }

  ngOnInit(): void {
    this.loadSubscription();
    this.loadPlans();
  }

  loadSubscription(): void {
    this.loading = true;
    this.orgService.getSubscription(this.orgId).subscribe({
      next: (res) => {
        this.subscription = res?.data || res;
        this.loading = false;
        this.cdr.detectChanges();
        this.loadEntitlements();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadEntitlements(): void {
    this.orgService.getEntitlements(this.orgId).subscribe({
      next: (res) => {
        this.entitlements = res?.data || [];
        this.cdr.detectChanges();
      }
    });
  }

  loadPlans(): void {
    const url = this.appConfig.environment?.pricingApiUrls?.plans || '';
    if (url) {
      this.http.get<any>(url).subscribe({
        next: (res) => {
          this.plans = res?.data || [];
          this.cdr.detectChanges();
        }
      });
    }
  }

  openUpgradeModal(): void { this.showUpgradeModal = true; }
  closeUpgradeModal(): void { this.showUpgradeModal = false; }

  selectPlan(plan: any): void {
    const current = this.subscription?.plan_slug;
    if (plan.slug === current) return;

    this.pendingPlan = plan;
    this.pendingAction = plan.display_order > (this.subscription?.display_order || 0) ? 'upgrade' : 'downgrade';
    this.showPlanConfirmModal = true;
    this.cdr.detectChanges();
  }

  cancelPlanConfirm(): void {
    this.showPlanConfirmModal = false;
    this.pendingPlan = null;
    this.cdr.detectChanges();
  }

  executePlanChange(): void {
    if (!this.pendingPlan) return;
    const plan = this.pendingPlan;
    const action = this.pendingAction;

    const obs = action === 'upgrade'
      ? this.orgService.upgrade(this.orgId, plan.slug)
      : this.orgService.downgrade(this.orgId, plan.slug);

    obs.subscribe({
      next: () => {
        this.auth.getUserFeatures().subscribe();
        this.showPlanConfirmModal = false;
        this.closeUpgradeModal();
        this.pendingPlan = null;
        this.triggerToast(`Successfully ${action === 'upgrade' ? 'upgraded' : 'downgraded'} to ${plan.name}!`, 'success');
        this.loadSubscription();
      },
      error: (err: any) => {
        this.showPlanConfirmModal = false;
        this.triggerToast(err?.error?.message || 'Error changing plan', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  openAddSeatsModal(): void {
    this.addSeatCount = 1;
    this.showAddSeatsModal = true;
    this.cdr.detectChanges();
  }

  closeAddSeatsModal(): void {
    this.showAddSeatsModal = false;
    this.cdr.detectChanges();
  }

  confirmAddSeats(): void {
    if (!this.addSeatCount || this.addSeatCount < 1) return;
    this.orgService.addSeats(this.orgId, Number(this.addSeatCount)).subscribe({
      next: () => {
        this.showAddSeatsModal = false;
        this.triggerToast(`Added ${this.addSeatCount} additional seat(s) successfully!`, 'success');
        this.loadSubscription();
      },
      error: (err: any) => {
        this.showAddSeatsModal = false;
        this.triggerToast(err?.error?.message || 'Error adding seats', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  triggerToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.toastMessage = msg;
    this.toastType = type;
    this.showToast = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.showToast = false;
      this.cdr.detectChanges();
    }, 4000);
  }
}
