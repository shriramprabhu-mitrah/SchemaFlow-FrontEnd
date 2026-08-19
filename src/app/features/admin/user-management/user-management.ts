import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';
import { DashboardService } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  sortColumn = 'username';
  sortAsc = true;
  loading = true;

  get filteredUsersList(): any[] {
    if (!this.allUsers) return [];
    let list = [...this.allUsers];

    if (this.search.trim()) {
      const q = this.search.trim().toLowerCase();
      list = list.filter(u =>
        (u.username || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        String(u.userid || '').includes(q)
      );
    }

    list.sort((a, b) => {
      let valA: any = a[this.sortColumn] ?? '';
      let valB: any = b[this.sortColumn] ?? '';

      if (this.sortColumn === 'joined') {
        valA = new Date(a.createddate || 0).getTime();
        valB = new Date(b.createddate || 0).getTime();
      } else if (this.sortColumn === 'status') {
        valA = a.isactive !== false ? 'Active' : 'Inactive';
        valB = b.isactive !== false ? 'Active' : 'Inactive';
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
    return this.filteredUsersList.length;
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

  get displayUsers(): any[] {
    const start = (this.page - 1) * this.limit;
    return this.filteredUsersList.slice(start, start + this.limit);
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.admin.getUsers().subscribe({
      next: (res) => {
        this.allUsers = res?.data || res || [];
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
