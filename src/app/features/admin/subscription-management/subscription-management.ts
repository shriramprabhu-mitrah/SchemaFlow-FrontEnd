import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';

@Component({
  selector: 'app-subscription-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subscription-management.html'
})
export class SubscriptionManagementComponent implements OnInit {
  private admin = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);

  allSubscriptions: any[] = [];
  search = '';
  statusFilter = '';
  page = 1;
  limit = 10;
  sortColumn = 'subscription_id';
  sortAsc = true;
  loading = true;

  get filteredSubscriptionsList(): any[] {
    if (!this.allSubscriptions) return [];
    let list = [...this.allSubscriptions];

    // Status Filter
    if (this.statusFilter) {
      list = list.filter(s => (s.status || '').toLowerCase() === this.statusFilter.toLowerCase());
    }

    // Search Query (Organization name, Plan name, Status, ID)
    if (this.search.trim()) {
      const q = this.search.trim().toLowerCase();
      list = list.filter(s =>
        (s.org_name || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.username || '').toLowerCase().includes(q) ||
        (s.organization_name || '').toLowerCase().includes(q) ||
        (s.plan_name || '').toLowerCase().includes(q) ||
        (s.status || '').toLowerCase().includes(q) ||
        String(s.subscription_id || '').includes(q) ||
        String(s.organization_id || '').includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let valA: any = a[this.sortColumn] ?? '';
      let valB: any = b[this.sortColumn] ?? '';

      if (this.sortColumn === 'user') {
        valA = a.email ? a.email : a.org_name || '';
        valB = b.email ? b.email : b.org_name || '';
      } else if (this.sortColumn === 'plan') {
        valA = a.plan_name || '';
        valB = b.plan_name || '';
      } else if (this.sortColumn === 'started') {
        valA = new Date(a.current_period_start || 0).getTime();
        valB = new Date(b.current_period_start || 0).getTime();
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
    return this.filteredSubscriptionsList.length;
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

  get displaySubscriptions(): any[] {
    const start = (this.page - 1) * this.limit;
    return this.filteredSubscriptionsList.slice(start, start + this.limit);
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.admin.getSubscriptions(1, 1000, this.statusFilter || undefined).subscribe({
      next: (res) => {
        this.allSubscriptions = res?.data || res || [];
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
  onFilter(): void { this.page = 1; this.load(); }
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
}
