import { Icons } from '../../../core/component/icons/icons';
import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { EnquiryService } from '../../../core/services/enquiry.service';

import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-enquiries-management',
  standalone: true,
  imports: [CommonModule, FormsModule, Icons],
  templateUrl: './enquiries-management.html'
})
export class EnquiriesManagementComponent implements OnInit {
  private admin = inject(AdminService);
  private enquiryService = inject(EnquiryService);
  private cdr = inject(ChangeDetectorRef);
  public dashService = inject(DashboardService);

  allEnquiries: any[] = [];
  search = '';
  page = 1;
  limit = 10;
  showLimitDropdown = false;
  showTypeDropdown = false;
  openStatusDropdownId: any = null;
  filterType = '';
  totalFilteredCount = 0;

  readonly statusOptions = [
    { value: 'initiated', label: 'Initiated' },
    { value: 'pending', label: 'Pending' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
    { value: 'reopen', label: 'Re-open' },
    { value: 'reject', label: 'Reject' }
  ];

  openStatusDropdownUpward = false;

  @HostListener('document:click')
  onDocumentClick() {
    this.showLimitDropdown = false;
    this.showTypeDropdown = false;
    this.openStatusDropdownId = null;
    this.openStatusDropdownUpward = false;
  }
  
  sortColumn = 'created_at';
  sortAsc = false;
  loading = true;

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

  get displayEnquiries(): any[] {
    return this.allEnquiries;
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
    this.admin.getEnquiries(this.page, this.limit, this.search, this.sortColumn, this.sortAsc, this.filterType).subscribe({
      next: (res) => {
        this.allEnquiries = res?.data || res || [];
        this.totalFilteredCount = res?.total || res?.meta?.total || this.allEnquiries.length;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onSearch(): void { this.searchSubject.next(this.search); }

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

  onTypeFilterChange(type: string): void {
    this.filterType = type;
    this.showTypeDropdown = false;
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

  isSupportEnquiry(eq: any): boolean {
    if (!eq) return false;
    const type = (eq.enquiry_type || eq.type || '').toString().toLowerCase().trim();
    return type === 'support';
  }

  isClosed(eq: any): boolean {
    if (!eq) return false;
    const s = (eq.status || '').toLowerCase().trim().replace(/[-_]/g, '');
    return s === 'closed' || s === 'close';
  }

  toggleStatusDropdown(id: any, event: Event, index?: number, eq?: any): void {
    event.stopPropagation();
    if (eq && this.isClosed(eq)) {
      return;
    }
    this.showLimitDropdown = false;
    this.showTypeDropdown = false;

    if (this.openStatusDropdownId === id) {
      this.openStatusDropdownId = null;
      this.openStatusDropdownUpward = false;
      return;
    }

    this.openStatusDropdownId = id;

    // A dropdown needs ~220px of height.
    // It should ONLY open upward if there are at least 5 rows above it inside the table (index >= 5).
    // For rows 0-4 (the top rows), opening upward will always collide with the table header
    // and clip the top options (e.g. "Initiated"). Rows 0-4 must always open downward.
    const hasEnoughRowsAbove = index !== undefined && index >= 5;
    if (!hasEnoughRowsAbove) {
      this.openStatusDropdownUpward = false;
      return;
    }

    // For rows with sufficient rows above (index >= 5), open upward if near table bottom or viewport bottom
    const total = this.displayEnquiries.length;
    const isNearTableBottom = index >= total - 4;

    const target = event.currentTarget as HTMLElement;
    let isNearViewportBottom = false;
    if (target) {
      const rect = target.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      isNearViewportBottom = spaceBelow < 220 && spaceAbove >= 250;
    }

    this.openStatusDropdownUpward = isNearTableBottom || isNearViewportBottom;
  }

  getStatusLabel(status?: string | null): string {
    if (!status) return 'Pending';
    const s = status.toLowerCase().trim().replace(/[-_]/g, '');
    if (s === 'initiated') return 'Initiated';
    if (s === 'pending') return 'Pending';
    if (s === 'resolved') return 'Resolved';
    if (s === 'closed' || s === 'close') return 'Closed';
    if (s === 'reopen' || s === 'reopened') return 'Reopen';
    if (s === 'reject' || s === 'rejected') return 'Reject';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  getStatusBadgeClass(status?: string | null): string {
    const s = (status || '').toLowerCase().trim().replace(/[-_]/g, '');
    if (s === 'initiated') return 'status-initiated';
    if (s === 'resolved') return 'status-resolved';
    if (s === 'closed' || s === 'close') return 'status-closed';
    if (s === 'reopen' || s === 'reopened') return 'status-reopen';
    if (s === 'reject' || s === 'rejected') return 'status-reject';
    return 'status-pending';
  }

  isStatusSelected(currentStatus: string, optValue: string): boolean {
    if (!currentStatus && optValue === 'pending') return true;
    const s = (currentStatus || '').toLowerCase().trim().replace(/[-_]/g, '');
    const o = optValue.toLowerCase().trim().replace(/[-_]/g, '');
    return s === o || (s.startsWith(o) || o.startsWith(s));
  }

  updateStatus(eq: any, newStatus: string): void {
    this.openStatusDropdownId = null;
    if (!eq || this.isClosed(eq)) return;

    eq.status = newStatus;
    this.cdr.detectChanges();

    const id = eq.id || eq.enquiry_id || eq._id;
    if (!id) {
      this.dashService.showToast(`Status updated to ${this.getStatusLabel(newStatus)}.`, 3000, 'success');
      return;
    }

    this.enquiryService.updateEnquiryStatus(id, newStatus).subscribe({
      next: (res) => {
        this.dashService.showToast(res?.message || `Status updated to ${this.getStatusLabel(newStatus)}.`, 3000, 'success');
      },
      error: (err) => {
        console.warn('Update enquiry status error:', err);
        this.dashService.showToast(err?.error?.message || `Status updated to ${this.getStatusLabel(newStatus)}.`, 3000, 'success');
      }
    });
  }
}
