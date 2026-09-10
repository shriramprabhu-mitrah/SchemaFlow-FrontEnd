import { Icons } from '../../../core/component/icons/icons';
import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';
import { DashboardService } from '../../../core/services/dashboard.service';

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
  private cdr = inject(ChangeDetectorRef);
  public dashService = inject(DashboardService);

  allEnquiries: any[] = [];
  search = '';
  page = 1;
  limit = 10;
  showLimitDropdown = false;
  totalFilteredCount = 0;

  @HostListener('document:click')
  onDocumentClick() {
    this.showLimitDropdown = false;
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
    this.admin.getEnquiries(this.page, this.limit, this.search, this.sortColumn, this.sortAsc).subscribe({
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
}
