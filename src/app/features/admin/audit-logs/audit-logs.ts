import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-logs.html'
})
export class AuditLogsComponent implements OnInit {
  private admin = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);
  logs: any[] = [];
  meta: any = {};
  page = 1;
  limit = 10;
  actionFilter = '';
  searchQuery = '';
  sortColumn = 'time';
  sortAsc = false;
  loading = true;

  get totalPagesCount(): number {
    return this.meta.totalPages || Math.ceil((this.meta.total || this.logs.length) / this.limit) || 1;
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
    if (!this.meta.total && this.logs.length === 0) return 0;
    return (this.page - 1) * this.limit + 1;
  }

  get paginationEndIndex(): number {
    return Math.min(this.page * this.limit, this.meta.total || this.logs.length || 0);
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    const filters: any = {};
    if (this.actionFilter) filters.action = this.actionFilter;
    if (this.searchQuery) filters.search = this.searchQuery;

    this.admin.getAuditLogs(this.page, this.limit, filters).subscribe({
      next: (res) => {
        this.logs = res?.data || [];
        this.meta = res?.meta || {};
        this.sortLogs();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onFilter(): void { this.page = 1; this.load(); }
  goToPage(p: number): void { this.page = p; this.load(); }
  onLimitChange(): void { this.page = 1; this.load(); }

  sortBy(col: string): void {
    if (this.sortColumn === col) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortColumn = col;
      this.sortAsc = true;
    }
    this.sortLogs();
  }

  sortLogs(): void {
    if (!this.logs) return;
    this.logs.sort((a, b) => {
      let valA: any = a[this.sortColumn] ?? '';
      let valB: any = b[this.sortColumn] ?? '';

      if (this.sortColumn === 'time') {
        valA = new Date(a.created_at || 0).getTime();
        valB = new Date(b.created_at || 0).getTime();
      } else if (this.sortColumn === 'actor') {
        valA = a.actor_name || a.actor_email || '';
        valB = b.actor_name || b.actor_email || '';
      } else if (this.sortColumn === 'action') {
        valA = a.action || '';
        valB = b.action || '';
      } else if (this.sortColumn === 'resource') {
        valA = a.resource_type || '';
        valB = b.resource_type || '';
      }

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return this.sortAsc ? -1 : 1;
      if (valA > valB) return this.sortAsc ? 1 : -1;
      return 0;
    });
  }

  formatDetails(details: any): string {
    if (!details) return '';
    try { return JSON.stringify(details, null, 2); } catch { return String(details); }
  }
}
