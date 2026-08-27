import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';
import { OrganizationService } from '../../organization/services/organization.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { Icons } from '../../../core/component/icons/icons';

import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-organization-management',
  standalone: true,
  imports: [CommonModule, FormsModule, Icons],
  templateUrl: './organization-management.html'
})
export class OrganizationManagementComponent implements OnInit {
  private admin = inject(AdminService);
  private orgService = inject(OrganizationService);
  private cdr = inject(ChangeDetectorRef);
  public dashService = inject(DashboardService);

  allOrgs: any[] = [];
  features: any[] = [];
  search = '';
  page = 1;
  limit = 10;
  showLimitDropdown = false;
  showFeatureOverrideDropdown = false;

  getSelectedFeatureLabel(): string {
    const f = this.features.find(item => item.feature_id == this.overrideForm.feature_id);
    return f ? `${f.name} (${f.feature_key})` : 'Select Feature';
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.showLimitDropdown = false;
    this.showFeatureOverrideDropdown = false;
    this.cdr.detectChanges();
  }

  toggleLimitDropdown(e: Event): void {
    e.stopPropagation();
    this.showLimitDropdown = !this.showLimitDropdown;
    this.showFeatureOverrideDropdown = false;
    this.cdr.detectChanges();
  }

  toggleFeatureDropdown(e: Event): void {
    e.stopPropagation();
    this.showFeatureOverrideDropdown = !this.showFeatureOverrideDropdown;
    this.showLimitDropdown = false;
    this.cdr.detectChanges();
  }

  selectLimitOption(opt: number, e: Event): void {
    e.stopPropagation();
    this.limit = opt;
    this.showLimitDropdown = false;
    this.onLimitChange();
    this.cdr.detectChanges();
  }

  selectFeatureOption(featureId: number, e: Event): void {
    e.stopPropagation();
    this.overrideForm.feature_id = featureId;
    this.showFeatureOverrideDropdown = false;
    this.onFeatureChange();
    this.cdr.detectChanges();
  }
  sortColumn = 'name';
  sortAsc = true;
  loading = true;
  selectedOrg: any = null;
  showDetail = false;

  // Override Form
  overrideForm = {
    feature_id: 0,
    override_value: 'true',
    override_limit: null as number | null,
    reason: ''
  };

  // Add-on Form
  seatQuantity = 1;

  totalFilteredCount = 0;

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

  get displayOrgs(): any[] {
    return this.allOrgs;
  }

  private searchSubject = new Subject<string>();

  ngOnInit(): void {
    this.load();
    this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.page = 1;
      this.load();
    });
  }

  load(): void {
    this.loading = true;
    this.admin.getOrganizations(this.page, this.limit, this.search, this.sortColumn, this.sortAsc).subscribe({
      next: (res) => {
        this.allOrgs = res?.data || res || [];
        this.totalFilteredCount = res?.meta?.total || this.allOrgs.length;
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
    this.admin.getFeatures(1, 1000).subscribe({
      next: (res) => {
        this.features = res?.data || [];
        this.resetOverrideForm();
        this.cdr.detectChanges();
      }
    });
  }

  onSearch(): void {
    this.page = 1;
    this.load();
  }

  goToPage(p: number): void {
    if (this.page !== p) {
      this.page = p;
      this.load();
    }
  }

  onLimitChange(): void {
    this.page = 1;
    this.load();
  }

  sortBy(col: string): void {
    if (this.sortColumn === col) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortColumn = col;
      this.sortAsc = true;
    }
    this.page = 1;
    this.load();
  }

  viewOrg(org: any): void {
    this.admin.getOrganization(org.organization_id).subscribe({
      next: (res) => {
        this.selectedOrg = res?.data || res;
        this.showDetail = true;
        
        if (this.features.length === 0) {
          this.loadFeatures();
        } else {
          this.resetOverrideForm();
        }
        
        this.cdr.detectChanges();
      }
    });
  }

  closeDetail(): void { this.showDetail = false; this.selectedOrg = null; }

  isSubmittingOverride = false;

  updateOrgStatus(arg1: any, arg2?: string, e?: Event): void {
    if (e) e.stopPropagation();
    if (this.isSubmittingOverride) return;
    const status = (typeof arg2 === 'string') ? arg2 : String(arg1);
    const orgId = (typeof arg2 === 'string') ? arg1 : (this.selectedOrg ? this.selectedOrg.organization_id : null);
    if (!orgId || !status) return;

    this.isSubmittingOverride = true;
    this.admin.updateOrganization(orgId, { status }).subscribe({
      next: () => {
        this.isSubmittingOverride = false;
        this.dashService.showToast('Organization status updated!', 3500, 'success');
        this.closeDetail();
        this.load();
      },
      error: (err: any) => {
        this.isSubmittingOverride = false;
        this.dashService.showToast(err?.error?.message || 'Error updating status', 4000, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  resetOverrideForm(): void {
    this.overrideForm = {
      feature_id: this.features[0]?.feature_id || 0,
      override_value: 'true',
      override_limit: null,
      reason: ''
    };
    this.seatQuantity = 1;
  }

  onFeatureChange(): void {
    const feature = this.features.find(f => f.feature_id === Number(this.overrideForm.feature_id));
    if (feature) {
      this.overrideForm.override_value = feature.value_type === 'boolean' ? 'true' : '';
    }
  }

  applyOverride(e?: Event): void {
    if (e) e.stopPropagation();
    if (this.isSubmittingOverride || !this.overrideForm.feature_id) return;
    this.isSubmittingOverride = true;
    this.cdr.detectChanges();

    this.admin.overrideSubscription(this.selectedOrg.organization_id, this.overrideForm).subscribe({
      next: () => {
        this.dashService.showToast('Custom override applied successfully!', 3500, 'success');
        this.refreshOrgDetails();
      },
      error: (err: any) => {
        this.isSubmittingOverride = false;
        this.dashService.showToast(err?.error?.message || 'Error applying override', 4000, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  deleteOverride(featureId: number, e?: Event): void {
    if (e) e.stopPropagation();
    if (this.isSubmittingOverride) return;
    this.isSubmittingOverride = true;
    this.cdr.detectChanges();

    this.admin.overrideSubscription(this.selectedOrg.organization_id, {
      feature_id: featureId,
      action: 'delete'
    }).subscribe({
      next: () => {
        this.dashService.showToast('Custom override removed successfully!', 3500, 'success');
        this.refreshOrgDetails();
      },
      error: (err: any) => {
        this.isSubmittingOverride = false;
        this.dashService.showToast(err?.error?.message || 'Error removing override', 4000, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  seatQuantityError = '';

  getTotalAddonSeats(): number {
    if (!this.selectedOrg?.addons?.length) return 0;
    return this.selectedOrg.addons.reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);
  }

  addSeatAddon(e?: Event): void {
    if (e) e.stopPropagation();
    this.seatQuantityError = '';
    if (!this.seatQuantity || this.seatQuantity < 1) {
      this.seatQuantityError = 'Please enter a valid quantity';
      this.cdr.detectChanges();
      return;
    }
    if (this.isSubmittingOverride) return;
    this.isSubmittingOverride = true;
    this.cdr.detectChanges();

    this.orgService.addSeats(this.selectedOrg.organization_id, this.seatQuantity).subscribe({
      next: () => {
        this.dashService.showToast('Seats added successfully!', 3500, 'success');
        this.refreshOrgDetails();
      },
      error: (err: any) => {
        this.isSubmittingOverride = false;
        this.dashService.showToast(err?.error?.message || 'Error adding seats', 4000, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  refreshOrgDetails(): void {
    this.admin.getOrganization(this.selectedOrg.organization_id).subscribe({
      next: (res) => {
        this.selectedOrg = res?.data || res;
        this.resetOverrideForm();
        this.isSubmittingOverride = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isSubmittingOverride = false;
        this.cdr.detectChanges();
      }
    });
  }
}
