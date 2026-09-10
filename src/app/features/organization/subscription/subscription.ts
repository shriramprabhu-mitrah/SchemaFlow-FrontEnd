import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrganizationService } from '../services/organization.service';
import { AuthService } from '../../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AppConfigService } from '../../../core/services/app-config.service';
import { Icons } from '../../../core/component/icons/icons';

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CommonModule, FormsModule, Icons],
  templateUrl: './subscription.html',
  styleUrls: ['./subscription.scss']
})
export class SubscriptionComponent implements OnInit {
  private orgService = inject(OrganizationService);
  private auth = inject(AuthService);
  private http = inject(HttpClient);
  private appConfig = inject(AppConfigService);
  private cdr = inject(ChangeDetectorRef);

  subscription: any = null;
  entitlements: any[] = [];
  meta: any = {};
  plans: any[] = [];
  loading = true;

  // Add Seats Popup Card Modal
  showAddSeatsModal = false;
  addSeatCount = 1;
  isRequestSeatSuccess = false;
  requestSeatSuccessMessage = '';

  // Toast Notification Card Popup
  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  private searchSubject = new Subject<string>();

  // Search, Sort & Pagination for Entitlements
  searchTerm = '';
  showPageSizeDropdown = false;
  sortColumn: string = 'feature_name';
  sortAsc: boolean = true;
  currentPage: number = 1;
  pageSize: number = 10;

  @HostListener('document:click')
  closeDropdowns() {
    this.showPageSizeDropdown = false;
  }

  togglePageSizeDropdown(event: Event) {
    event.stopPropagation();
    this.showPageSizeDropdown = !this.showPageSizeDropdown;
  }

  selectPageSize(size: number) {
    this.pageSize = size;
    this.currentPage = 1;
    this.showPageSizeDropdown = false;
    this.loadEntitlements();
  }

  get orgId(): number { return this.auth.getOrganizationId() || 0; }

  onSearch(term: string): void {
    this.searchSubject.next(term);
  }

  get totalPages(): number {
    return this.meta?.totalPages || 1;
  }

  get pageList(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get visiblePages(): (number | '...')[] {
    const total = this.totalPages;
    const current = this.currentPage;
    if (total <= 5) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [1];
    const rangeStart = Math.max(2, current - 1);
    const rangeEnd = Math.min(total - 1, current + 1);
    if (rangeStart > 2) pages.push('...');
    for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
    if (rangeEnd < total - 1) pages.push('...');
    pages.push(total);
    return pages;
  }

  get paginationStartIndex(): number {
    if (this.entitlements.length === 0) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get paginationEndIndex(): number {
    return Math.min(this.currentPage * this.pageSize, this.meta?.total || 0);
  }

  sortBy(col: string): void {
    if (this.sortColumn === col) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortColumn = col;
      this.sortAsc = true;
    }
    this.currentPage = 1;
    this.loadEntitlements();
  }

  setPage(p: number): void {
    if (p >= 1 && p <= this.totalPages) {
      this.currentPage = p;
      this.loadEntitlements();
    }
  }

  ngOnInit(): void {
    this.loadSubscription();
    this.loadPlans();

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.searchTerm = term;
      this.currentPage = 1;
      this.loadEntitlements();
    });
  }

  loadSubscription(): void {
    this.loading = true;
    this.orgService.getSubscription(this.orgId).subscribe({
      next: (res) => {
        this.subscription = res?.data || res;
        this.loading = false;
        this.cdr.detectChanges();
        this.loadEntitlements();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadEntitlements(): void {
    this.orgService.getEntitlements(this.orgId, this.currentPage, this.pageSize, this.searchTerm, 'all', this.sortColumn, this.sortAsc).subscribe({
      next: (res) => {
        this.entitlements = res?.data || [];
        this.meta = res?.meta || {};
        this.cdr.detectChanges();
      }
    });
  }

  loadPlans(): void {
    const url = this.appConfig.environment?.pricingApiUrls?.plans || '';
    if (url) {
      this.http.get<any>(url).subscribe({
        next: (res) => {
          this.plans = res?.data || [];
          this.cdr.detectChanges();
        }
      });
    }
  }

  openAddSeatsModal(): void {
    this.addSeatCount = 1;
    this.isRequestSeatSuccess = false;
    this.requestSeatSuccessMessage = '';
    this.showAddSeatsModal = true;
    this.cdr.detectChanges();
  }

  closeAddSeatsModal(): void {
    this.showAddSeatsModal = false;
    this.cdr.detectChanges();
  }

  confirmAddSeats(): void {
    if (!this.addSeatCount || this.addSeatCount < 1) return;
    this.orgService.requestSeats(this.orgId, Number(this.addSeatCount)).subscribe({
      next: (res: any) => {
        this.isRequestSeatSuccess = true;
        this.requestSeatSuccessMessage = res?.message || 'Will let you know once your request has been updated';
        this.loadSubscription();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isRequestSeatSuccess = false;
        this.showAddSeatsModal = false;
        this.triggerToast(err?.error?.message || 'Error adding seats', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  triggerToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.toastMessage = msg;
    this.toastType = type;
    this.showToast = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.showToast = false;
      this.cdr.detectChanges();
    }, 4000);
  }
}
