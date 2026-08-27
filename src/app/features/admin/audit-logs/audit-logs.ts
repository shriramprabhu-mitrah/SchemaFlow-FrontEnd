import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';
import { DashboardService } from '../../../core/services/dashboard.service';

import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Icons } from '../../../core/component/icons/icons';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, Icons],
  templateUrl: './audit-logs.html'
})
export class AuditLogsComponent implements OnInit {
  private admin = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);
  public dashService = inject(DashboardService);

  allLogs: any[] = [];
  meta: any = {};
  page = 1;
  limit = 10;
  showLimitDropdown = false;
  showDetailsModal = false;
  selectedLogDetails: any = null;
  selectedLogAction: string = '';

  openDetailsModal(log: any) {
    if (!log.details) return;
    this.selectedLogDetails = log.details;
    this.selectedLogAction = log.action;
    this.showDetailsModal = true;
  }

  closeDetailsModal() {
    this.showDetailsModal = false;
    this.selectedLogDetails = null;
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.showLimitDropdown = false;
  }

  actionFilter = '';
  searchQuery = '';
  sortColumn = 'time';
  sortAsc = false;
  loading = true;

  totalFilteredCount = 0;
  get filteredLogsList(): any[] { return this.allLogs; }


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

  get logs(): any[] { return this.filteredLogsList; }

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
    const filters: any = {};
    if (this.actionFilter) filters.action = this.actionFilter;
    if (this.searchQuery) filters.search = this.searchQuery;

    this.admin.getAuditLogs(this.page, this.limit, filters, this.sortColumn, this.sortAsc).subscribe({
      next: (res) => {
        this.allLogs = (Array.isArray(res) ? res : (res?.data || [])).map((log: any) => {
          if (log.action) {
            log.action = log.action.replace(/seats/g, 'members').replace(/seat/g, 'member').replace(/Seats/g, 'Members').replace(/Seat/g, 'Member');
          }
          return log;
        });
        this.totalFilteredCount = res?.meta?.total || this.allLogs.length;
        this.meta = res?.meta || {};
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.allLogs = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onFilter(): void { this.searchSubject.next(this.searchQuery); }
  goToPage(p: number): void { if (this.page !== p) { this.page = p; this.load(); } }
  onLimitChange(): void { this.page = 1; this.load(); }

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
  formatDetails(details: any): string {
    if (!details) return '—';
    let obj = details;
    if (typeof details === 'string') {
      try { obj = JSON.parse(details); } catch { return details; }
    }
    if (typeof obj !== 'object' || !obj) return String(obj);

    // Humanize common patterns
    if (obj.new_role && obj.old_role) {
      const target = obj.target_user_id ? ` (User #${obj.target_user_id})` : '';
      return `Role: ${obj.old_role} → ${obj.new_role}${target}`;
    }
    if (obj.new_plan && obj.old_plan) {
      return `Plan: ${obj.old_plan} → ${obj.new_plan}`;
    }
    if (obj.name && obj.description) {
      return `${obj.name} — ${obj.description}`;
    }
    if (obj.name) {
      return `Name: ${obj.name}`;
    }

    try {
      const parts = Object.entries(obj)
        .filter(([_, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => {
          const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
          return `${k}: ${valStr}`;
        });
      return parts.join(' | ');
    } catch {
      return String(details);
    }
  }
}
