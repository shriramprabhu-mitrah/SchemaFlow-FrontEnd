import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';
import { OrganizationService } from '../../organization/services/organization.service';
import { DashboardService } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-organization-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  get filteredOrgsList(): any[] {
    if (!this.allOrgs) return [];
    let list = [...this.allOrgs];

    if (this.search.trim()) {
      const q = this.search.trim().toLowerCase();
      list = list.filter(o =>
        (o.name || '').toLowerCase().includes(q) ||
        (o.slug || '').toLowerCase().includes(q) ||
        (o.status || '').toLowerCase().includes(q) ||
        (o.plan_name || '').toLowerCase().includes(q) ||
        String(o.organization_id || '').includes(q)
      );
    }

    list.sort((a, b) => {
      let valA: any = a[this.sortColumn] ?? '';
      let valB: any = b[this.sortColumn] ?? '';

      if (this.sortColumn === 'members') {
        valA = Number(a.member_count || a.memberCount || 0);
        valB = Number(b.member_count || b.memberCount || 0);
      } else if (this.sortColumn === 'plan') {
        valA = a.plan_name || '';
        valB = b.plan_name || '';
      }

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return this.sortAsc ? -1 : 1;
      if (valA > valB) return this.sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }

  get totalFilteredCount(): number {
    return this.filteredOrgsList.length;
  }

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
    const start = (this.page - 1) * this.limit;
    return this.filteredOrgsList.slice(start, start + this.limit);
  }

  ngOnInit(): void { this.load(); this.loadFeatures(); }

  load(): void {
    this.loading = true;
    this.admin.getOrganizations().subscribe({
      next: (res) => {
        this.allOrgs = res?.data || res || [];
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
        if (this.features.length > 0 && !this.overrideForm.feature_id) {
          this.overrideForm.feature_id = this.features[0].feature_id;
        }
        this.cdr.detectChanges();
      }
    });
  }

  onSearch(): void { this.page = 1; }
  goToPage(p: number): void { this.page = p; }
  onLimitChange(): void { this.page = 1; }

  sortBy(col: string): void {
    if (this.sortColumn === col) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortColumn = col;
      this.sortAsc = true;
    }
  }

  viewOrg(org: any): void {
    this.admin.getOrganization(org.organization_id).subscribe({
      next: (res) => {
        this.selectedOrg = res?.data || res;
        this.showDetail = true;
        this.resetOverrideForm();
        this.cdr.detectChanges();
      }
    });
  }

  closeDetail(): void { this.showDetail = false; this.selectedOrg = null; }

  updateOrgStatus(arg1: any, arg2?: string): void {
    const status = (typeof arg2 === 'string') ? arg2 : String(arg1);
    const orgId = (typeof arg2 === 'string') ? arg1 : (this.selectedOrg ? this.selectedOrg.organization_id : null);
    if (!orgId || !status) return;

    this.admin.updateOrganization(orgId, { status }).subscribe({
      next: () => {
        this.dashService.showToast('Organization status updated!', 3500, 'success');
        this.closeDetail();
        this.load();
      },
      error: (err: any) => {
        this.dashService.showToast(err?.error?.message || 'Error updating status', 4000, 'error');
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

  applyOverride(): void {
    if (!this.overrideForm.feature_id) return;
    this.admin.overrideSubscription(this.selectedOrg.organization_id, this.overrideForm).subscribe({
      next: () => {
        this.dashService.showToast('Custom override applied successfully!', 3500, 'success');
        this.refreshOrgDetails();
      },
      error: (err: any) => {
        this.dashService.showToast(err?.error?.message || 'Error applying override', 4000, 'error');
      }
    });
  }

  deleteOverride(featureId: number): void {
    this.admin.overrideSubscription(this.selectedOrg.organization_id, {
      feature_id: featureId,
      action: 'delete'
    }).subscribe({
      next: () => {
        this.dashService.showToast('Custom override removed successfully!', 3500, 'success');
        this.refreshOrgDetails();
      },
      error: (err: any) => {
        this.dashService.showToast(err?.error?.message || 'Error removing override', 4000, 'error');
      }
    });
  }

  seatQuantityError = '';

  addSeatAddon(): void {
    this.seatQuantityError = '';
    if (!this.seatQuantity || this.seatQuantity < 1) {
      this.seatQuantityError = 'Please enter at least 1 seat.';
      this.cdr.detectChanges();
      return;
    }
    this.orgService.addSeats(this.selectedOrg.organization_id, this.seatQuantity).subscribe({
      next: () => {
        this.dashService.showToast('Seats added successfully!', 3500, 'success');
        this.refreshOrgDetails();
      },
      error: (err: any) => {
        this.dashService.showToast(err?.error?.message || 'Error adding seats', 4000, 'error');
      }
    });
  }

  refreshOrgDetails(): void {
    this.admin.getOrganization(this.selectedOrg.organization_id).subscribe({
      next: (res) => {
        this.selectedOrg = res?.data || res;
        this.resetOverrideForm();
        this.cdr.detectChanges();
      }
    });
  }
}
