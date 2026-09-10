import { Component, OnInit, inject, ChangeDetectorRef, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { Icons } from '../../../core/component/icons/icons';

import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-subscription-management',
  standalone: true,
  imports: [CommonModule, FormsModule, Icons],
  templateUrl: './subscription-management.html'
})
export class SubscriptionManagementComponent implements OnInit {
  private admin = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);
  public dashService = inject(DashboardService);

  search = '';
  statusFilter = '';
  page = 1;
  limit = 10;
  showLimitDropdown = false;
  showStatusFilterDropdown = false;

  getStatusFilterLabel(): string {
    if (this.statusFilter === 'active') return 'Active';
    if (this.statusFilter === 'trial') return 'Trial';
    if (this.statusFilter === 'cancelled') return 'Cancelled';
    if (this.statusFilter === 'expired') return 'Expired';
    return 'All Statuses';
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.showLimitDropdown = false;
    this.showStatusFilterDropdown = false;
    this.showPlanDropdown = false;
    this.showBillingDropdown = false;
  }
  sortColumn = 'subscription_id';
  sortAsc = true;
  loading = true;

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

  allSubscriptions = signal<any[]>([]);

  get displaySubscriptions(): any[] {
    return this.allSubscriptions();
  }

  private searchSubject = new Subject<string>();

  ngOnInit(): void {
    this.load();
    this.loadPlans();
    this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.page = 1;
      this.load();
    });
  }

  loadPlans(): void {
    this.admin.getAllPlansForDropdown().subscribe({
      next: (res) => {
        this.allPlans = res?.data || res || [];
      },
      error: (err) => console.error('Failed to load plans', err)
    });
  }

  load(): void {
    this.loading = true;
    this.admin.getSubscriptions(this.page, this.limit, this.statusFilter || undefined, this.search, this.sortColumn, this.sortAsc).subscribe({
      next: (res) => {
        const data = res?.data || res || [];
        this.allSubscriptions.set(data);
        this.totalFilteredCount = res?.meta?.total || data.length;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onSearch(): void {
    this.page = 1;
    this.load();
  }

  onFilter(): void {
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

  // ── Edit Subscription ──
  showEditModal = false;
  savingEdit = false;
  allPlans: any[] = [];
  showPlanDropdown = false;
  showBillingDropdown = false;
  disableTrialOption = false;
  editForm = {
    subscriptionId: 0,
    email: '',
    planId: 0,
    planName: '',
    billingCycle: 'monthly',
    message: ''
  };

  isPlanDisabled(planName: string, currentPlanName: string): boolean {
    const pName = (planName || '').toLowerCase();
    const cName = (currentPlanName || '').toLowerCase();

    // if it is a team plan then disable the premium and free options
    if (cName.includes('team')) {
      if (pName.includes('premium') || pName.includes('free')) return true;
    }
    // if it is a premium then disable all the other other than premium plan
    else if (cName.includes('premium')) {
      if (!pName.includes('premium')) return true;
    }

    return false;
  }

  openEditModal(subscription: any): void {
    const defaultMessage = `We have received your payment and successfully upgraded your plan.`;
    this.editForm = {
      subscriptionId: subscription.subscription_id,
      email: subscription.email || subscription.org_name,
      planId: subscription.plan_id,
      planName: subscription.plan_name || 'Select Plan',
      billingCycle: subscription.status === 'trial' ? 'trial' : (subscription.billing_cycle === 'annual' ? 'annual' : 'monthly'),
      message: defaultMessage
    };

    // Disable plans dynamically
    this.allPlans = this.allPlans.map(p => {
      return {
        ...p,
        disabled: this.isPlanDisabled(p.name, subscription.plan_name)
      };
    });

    this.disableTrialOption = !!(subscription.status === 'expired' && subscription.trial_start && subscription.trial_end);

    this.showEditModal = true;
    this.showPlanDropdown = false;
    this.showBillingDropdown = false;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.savingEdit = false;
  }

  saveSubscription(): void {
    if (!this.editForm.planId || !this.editForm.billingCycle) return;
    this.savingEdit = true;
    this.admin.updateSubscription(this.editForm.subscriptionId, {
      plan_id: this.editForm.planId,
      billing_cycle: this.editForm.billingCycle,
      message: this.editForm.message
    }).subscribe({
      next: () => {
        this.savingEdit = false;
        this.showEditModal = false;

        // Forcefully remove modal from DOM just in case Angular change detection is stuck
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
          modal.remove();
        }

        try {
          this.dashService.showToast('Subscription updated successfully.', 3000, 'success');
        } catch (e) {
          console.error('Toast error:', e);
        }

        this.load(); // Refresh list
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.savingEdit = false;
        this.showEditModal = false;

        const modal = document.querySelector('.modal-overlay');
        if (modal) modal.remove();

        console.error('Failed to update subscription', err);
        const errMsg = err?.error?.message || 'Failed to update subscription. Please try again.';
        try {
          this.dashService.showToast(errMsg, 4000, 'error');
        } catch (e) {
          console.error('Toast error:', e);
        }
        this.cdr.detectChanges();
      }
    });
  }
}
