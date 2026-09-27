import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AppConfigService } from '../../../core/services/app-config.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { Icons } from '../../../core/component/icons/icons';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-transaction-management',
  standalone: true,
  imports: [CommonModule, FormsModule, Icons],
  templateUrl: './transaction-management.html'
})
export class TransactionManagementComponent implements OnInit {
  private http = inject(HttpClient);
  private appConfig = inject(AppConfigService);
  private cdr = inject(ChangeDetectorRef);
  private dashService = inject(DashboardService);

  transactions: any[] = [];
  loading = false;

  currentPage = 1;
  pageSize = 10;
  totalFilteredCount = 0;
  search = '';
  sortColumn = 'created_at';
  sortAsc = false;

  showLimitDropdown = false;
  private searchSubject = new Subject<string>();

  showConfirmModal = false;
  transactionToRefund: any = null;

  @HostListener('document:click')
  onDocumentClick() {
    this.showLimitDropdown = false;
  }

  get totalPagesCount(): number {
    return Math.ceil(this.totalFilteredCount / this.pageSize) || 1;
  }

  get totalPages(): number[] {
    const total = this.totalPagesCount;
    const current = this.currentPage;
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
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get paginationEndIndex(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalFilteredCount);
  }

  ngOnInit(): void {
    this.loadTransactions();

    this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.currentPage = 1;
      this.loadTransactions();
    });
  }

  onSearch(): void {
    this.searchSubject.next(this.search);
  }

  sortBy(col: string): void {
    if (this.sortColumn === col) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortColumn = col;
      this.sortAsc = true;
    }
    this.currentPage = 1;
    this.loadTransactions();
  }

  setPage(page: number): void {
    if (page !== this.currentPage && page >= 1 && page <= this.totalPagesCount) {
      this.currentPage = page;
      this.loadTransactions();
    }
  }

  onLimitChange(): void {
    this.currentPage = 1;
    this.loadTransactions();
  }

  loadTransactions(): void {
    this.loading = true;
    let url = this.appConfig.environment?.apiConfig?.baseUrl ? `${this.appConfig.environment.apiConfig.baseUrl}/api/admin/transactions` : `http://localhost:4000/api/admin/transactions`;
    url += `?page=${this.currentPage}&limit=${this.pageSize}&search=${encodeURIComponent(this.search)}&sortColumn=${this.sortColumn}&sortAsc=${this.sortAsc}`;

    this.http.get<any>(url, { withCredentials: true }).subscribe({
      next: (res) => {
        this.transactions = res?.data || [];
        this.totalFilteredCount = res?.meta?.total || 0;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load transactions:', err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getCurrency(c: string): string {
    if (!c || c === 'UNKNOWN') return 'INR';
    return c;
  }

  showSuccessModal = false;
  isRefunding = false;

  refundTransaction(transaction: any): void {
    this.transactionToRefund = transaction;
    this.showConfirmModal = true;
    this.cdr.detectChanges();
  }

  closeConfirmModal(): void {
    if (this.isRefunding) return;
    this.showConfirmModal = false;
    this.transactionToRefund = null;
    this.cdr.detectChanges();
  }

  closeSuccessModal(): void {
    this.showSuccessModal = false;
    this.cdr.detectChanges();
  }

  executeRefund(): void {
    if (!this.transactionToRefund || this.isRefunding) return;

    this.isRefunding = true;
    this.cdr.detectChanges();

    const transaction = this.transactionToRefund;
    
    const url = this.appConfig.environment?.apiConfig?.baseUrl ? `${this.appConfig.environment.apiConfig.baseUrl}/api/payments/refund` : 'http://localhost:4000/api/payments/refund';

    this.http.post<any>(url, { subscriptionId: transaction.subscription_id, amount: transaction.amount, transactionId: transaction.transaction_id }, { withCredentials: true }).subscribe({
      next: (res) => {
        this.isRefunding = false;
        this.showConfirmModal = false;
        this.showSuccessModal = true;
        this.cdr.detectChanges();
        this.loadTransactions();
      },
      error: (err) => {
        this.isRefunding = false;
        this.showConfirmModal = false;
        this.cdr.detectChanges();
        this.dashService.showToast(err.error?.error || 'Failed to process refund.', 4000, 'error', 'global');
      }
    });
  }
}
