import { Icons } from '../../../core/component/icons/icons';
import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';
import { DashboardService } from '../../../core/services/dashboard.service';

import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, Icons],
  templateUrl: './user-management.html'
})
export class UserManagementComponent implements OnInit {
  private admin = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);
  public dashService = inject(DashboardService);

  allUsers: any[] = [];
  search = '';
  page = 1;
  limit = 10;
  showLimitDropdown = false;
  totalFilteredCount = 0;
  selectedOrganization = '';
  showOrgDropdown = false;
  organizationsList: any[] = [];

  @HostListener('document:click')
  onDocumentClick() {
    this.showLimitDropdown = false;
    this.showOrgDropdown = false;
  }
  sortColumn = 'userid';
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

  get displayUsers(): any[] {
    return this.allUsers;
  }

  selectOrg(orgName: string) {
    this.selectedOrganization = orgName;
    this.showOrgDropdown = false;
    this.page = 1;
    this.load();
  }

  private searchSubject = new Subject<string>();

  ngOnInit(): void { 
    this.admin.getOrganizations(1, 1000).subscribe({
      next: (res) => {
        this.organizationsList = res?.data || res || [];
      }
    });
    this.load(); 
    this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.page = 1;
      this.load();
    });
  }

  load(): void {
    this.loading = true;
    this.admin.getUsers(this.page, this.limit, this.search, this.sortColumn, this.sortAsc, this.selectedOrganization).subscribe({
      next: (res) => {
        this.allUsers = res?.data || res || [];
        this.totalFilteredCount = res?.meta?.total || this.allUsers.length;
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

  showConfirmModal = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmButtonText = '';
  confirmActionType: 'deactivate' | 'activate' = 'deactivate';
  pendingUserAction: any = null;

  toggleActive(user: any): void {
    this.pendingUserAction = { type: 'active', user };
    this.confirmTitle = user.isactive ? 'Deactivate User' : 'Activate User';
    this.confirmMessage = `Are you sure you want to ${user.isactive ? 'deactivate' : 'activate'} user account for ${user.email}?`;
    this.confirmButtonText = user.isactive ? 'Deactivate' : 'Activate';
    this.confirmActionType = user.isactive ? 'deactivate' : 'activate';
    this.showConfirmModal = true;
  }

  toggleSuperAdmin(user: any): void {
    this.pendingUserAction = { type: 'superadmin', user };
    this.confirmTitle = user.is_super_admin ? 'Revoke Super Admin' : 'Grant Super Admin';
    this.confirmMessage = `Are you sure you want to ${user.is_super_admin ? 'revoke super admin access from' : 'grant super admin access to'} ${user.email}?`;
    this.confirmButtonText = user.is_super_admin ? 'Revoke Admin' : 'Grant Admin';
    this.confirmActionType = user.is_super_admin ? 'deactivate' : 'activate';
    this.showConfirmModal = true;
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.pendingUserAction = null;
  }

  executeConfirmedAction(): void {
    if (!this.pendingUserAction) return;
    const { type, user } = this.pendingUserAction;
    this.closeConfirmModal();

    if (type === 'active') {
      this.admin.updateUser(user.userid, { isactive: !user.isactive }).subscribe({
        next: () => {
          this.dashService.showToast('User status updated successfully!', 3500, 'success');
          this.load();
        },
        error: (err: any) => {
          this.dashService.showToast(err?.error?.message || 'Error updating user status', 4000, 'error');
        }
      });
    } else if (type === 'superadmin') {
      this.admin.updateUser(user.userid, { is_super_admin: !user.is_super_admin }).subscribe({
        next: () => {
          this.dashService.showToast('User admin role updated successfully!', 3500, 'success');
          this.load();
        },
        error: (err: any) => {
          this.dashService.showToast(err?.error?.message || 'Error updating admin role', 4000, 'error');
        }
      });
    }
  }
}
