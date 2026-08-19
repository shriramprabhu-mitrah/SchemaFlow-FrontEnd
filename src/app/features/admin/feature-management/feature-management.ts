import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';
import { DashboardService } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-feature-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feature-management.html'
})
export class FeatureManagementComponent implements OnInit {
  private admin = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);
  public dashService = inject(DashboardService);

  allFeatures: any[] = [];
  search = '';
  page = 1;
  limit = 10;
  sortColumn = 'name';
  sortAsc = true;
  loading = true;
  showModal = false;
  editMode = false;
  form: any = {};

  get filteredFeaturesList(): any[] {
    if (!this.allFeatures) return [];
    let list = [...this.allFeatures];

    if (this.search.trim()) {
      const q = this.search.trim().toLowerCase();
      list = list.filter(f =>
        (f.feature_key || '').toLowerCase().includes(q) ||
        (f.name || '').toLowerCase().includes(q) ||
        (f.value_type || '').toLowerCase().includes(q) ||
        (f.category || '').toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let valA: any = a[this.sortColumn] ?? '';
      let valB: any = b[this.sortColumn] ?? '';

      if (this.sortColumn === 'status') {
        valA = a.is_active ? 'Active' : 'Inactive';
        valB = b.is_active ? 'Active' : 'Inactive';
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
    return this.filteredFeaturesList.length;
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

  get displayFeatures(): any[] {
    const start = (this.page - 1) * this.limit;
    return this.filteredFeaturesList.slice(start, start + this.limit);
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.admin.getFeatures().subscribe({
      next: (res) => {
        this.allFeatures = res?.data || res || [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
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

  formErrors = { name: '', feature_key: '' };

  openCreate(): void {
    this.editMode = false;
    this.form = { feature_key: '', name: '', description: '', value_type: 'boolean', category: '', display_order: 0 };
    this.formErrors = { name: '', feature_key: '' };
    this.showModal = true;
  }

  openEdit(f: any): void {
    this.editMode = true;
    this.form = { ...f };
    this.formErrors = { name: '', feature_key: '' };
    this.showModal = true;
  }

  closeModal(): void { this.showModal = false; }

  save(): void {
    this.formErrors = { name: '', feature_key: '' };
    let hasError = false;

    if (!this.form.name || !this.form.name.trim()) {
      this.formErrors.name = 'Feature name is required.';
      hasError = true;
    }

    if (!this.form.feature_key || !this.form.feature_key.trim()) {
      this.form.feature_key = (this.form.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    }

    if (hasError) {
      this.cdr.detectChanges();
      return;
    }

    const obs = this.editMode
      ? this.admin.updateFeature(this.form.feature_id, this.form)
      : this.admin.createFeature(this.form);
    obs.subscribe({
      next: () => {
        this.dashService.showToast(this.editMode ? 'Feature updated successfully!' : 'Feature created successfully!', 3500, 'success');
        this.closeModal();
        this.load();
      },
      error: (err: any) => {
        this.dashService.showToast(err?.error?.message || 'Error saving feature', 4000, 'error');
      }
    });
  }

  showConfirmModal = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmButtonText = '';
  confirmActionType: 'deactivate' | 'activate' = 'deactivate';
  pendingFeatureAction: { type: 'activate' | 'deactivate'; id: number } | null = null;

  deleteFeature(id: number): void {
    this.pendingFeatureAction = { type: 'deactivate', id };
    this.confirmTitle = 'Deactivate Feature';
    this.confirmMessage = 'Are you sure you want to deactivate this feature?';
    this.confirmButtonText = 'Deactivate';
    this.confirmActionType = 'deactivate';
    this.showConfirmModal = true;
  }

  activateFeature(id: number): void {
    this.pendingFeatureAction = { type: 'activate', id };
    this.confirmTitle = 'Activate Feature';
    this.confirmMessage = 'Are you sure you want to activate this feature?';
    this.confirmButtonText = 'Activate';
    this.confirmActionType = 'activate';
    this.showConfirmModal = true;
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.pendingFeatureAction = null;
  }

  executeConfirmedAction(): void {
    if (!this.pendingFeatureAction) return;
    const { type, id } = this.pendingFeatureAction;
    this.closeConfirmModal();

    if (type === 'deactivate') {
      this.admin.deleteFeature(id).subscribe({
        next: () => {
          this.dashService.showToast('Feature deactivated!', 3500, 'success');
          this.load();
        },
        error: (err: any) => {
          this.dashService.showToast(err?.error?.message || 'Error deactivating feature', 4000, 'error');
        }
      });
    } else {
      this.admin.updateFeature(id, { is_active: true }).subscribe({
        next: () => {
          this.dashService.showToast('Feature activated!', 3500, 'success');
          this.load();
        },
        error: (err: any) => {
          this.dashService.showToast(err?.error?.message || 'Error activating feature', 4000, 'error');
        }
      });
    }
  }

  generateKey(): void {
    if (!this.editMode) {
      this.form.feature_key = (this.form.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    }
  }
}
