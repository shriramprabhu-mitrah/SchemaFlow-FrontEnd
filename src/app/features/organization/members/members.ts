import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrganizationService } from '../services/organization.service';
import { AuthService } from '../../../core/services/auth.service';

import { EntitlementService } from '../../../core/services/entitlement.service';
import { Router } from '@angular/router';
import { DashboardService } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './members.html'
})
export class MembersComponent implements OnInit {
  private orgService = inject(OrganizationService);
  private auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private entitlementService = inject(EntitlementService);
  private router = inject(Router);
  private dashboardService = inject(DashboardService);

  members: any[] = [];
  meta: any = {};
  search = '';
  page = 1;
  loading = true;

  // Add Member Modal
  showAddModal = false;
  addEmail = '';
  addRole = 'member';
  availableRoles: any[] = [];

  // Delete Confirmation Popup Card
  showDeleteModal = false;
  memberToDelete: any = null;

  // Edit Role Confirmation Popup Card
  showEditModal = false;
  memberToEdit: any = null;
  pendingRole = '';

  // Toast Notification Popup Card
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  showToast = false;
  orgName = '';
  get orgId(): number { return this.auth.getOrganizationId() || 0; }

  limit = 10;
  sortColumn: string = 'user';
  sortAsc: boolean = true;

  get totalPages(): number[] {
    const pages = this.meta.totalPages || 1;
    return Array.from({ length: pages }, (_, i) => i + 1);
  }

  get paginationStartIndex(): number {
    if (this.meta.total === 0) return 0;
    return (this.page - 1) * this.limit + 1;
  }

  get paginationEndIndex(): number {
    return Math.min(this.page * this.limit, this.meta.total || 0);
  }

  ngOnInit(): void {
    this.entitlementService.loadEntitlements(true).subscribe();
    this.load();
    this.orgService.getOrganization(this.orgId).subscribe({
      next: (res) => {
        this.orgName = res?.data?.name || '';
      }
    });
  }

  load(): void {
    this.loading = true;
    this.orgService.getMembers(this.orgId, this.page, this.limit, this.search).subscribe({
      next: (res) => {
        this.members = res?.data || [];
        this.meta = res?.meta || {};
        this.sortMembers();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onSearch(): void { this.page = 1; this.load(); }
  goToPage(p: number): void { this.page = p; this.load(); }
  onLimitChange(): void { this.page = 1; this.load(); }

  sortBy(col: string): void {
    if (this.sortColumn === col) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortColumn = col;
      this.sortAsc = true;
    }
    this.sortMembers();
  }

  sortMembers(): void {
    if (!this.members) return;
    this.members.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';
      if (this.sortColumn === 'user') {
        valA = this.getUsername(a);
        valB = this.getUsername(b);
      } else if (this.sortColumn === 'email') {
        valA = a.email || '';
        valB = b.email || '';
      } else if (this.sortColumn === 'role') {
        valA = a.org_role || '';
        valB = b.org_role || '';
      } else if (this.sortColumn === 'status') {
        valA = a.status || 'active';
        valB = b.status || 'active';
      } else if (this.sortColumn === 'joined') {
        valA = new Date(a.joined_at || 0).getTime();
        valB = new Date(b.joined_at || 0).getTime();
      }

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return this.sortAsc ? -1 : 1;
      if (valA > valB) return this.sortAsc ? 1 : -1;
      return 0;
    });
  }

  // --- Delete Popup Card Methods ---
  promptRemoveMember(member: any): void {
    this.memberToDelete = member;
    this.showDeleteModal = true;
    this.cdr.detectChanges();
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.memberToDelete = null;
    this.cdr.detectChanges();
  }

  confirmDelete(): void {
    if (!this.memberToDelete) return;
    const userId = this.getUserId(this.memberToDelete);
    const username = this.getUsername(this.memberToDelete);
    if (!userId) {
      this.triggerToast('Invalid member user ID.', 'error');
      return;
    }
    this.orgService.removeMember(this.orgId, userId).subscribe({
      next: () => {
        this.showDeleteModal = false;
        this.triggerToast(`Removed member '${username}' successfully.`, 'success');
        this.memberToDelete = null;
        this.load();
      },
      error: (err: any) => {
        this.showDeleteModal = false;
        this.triggerToast(err?.error?.message || 'Error removing member.', 'error');
        this.memberToDelete = null;
        this.cdr.detectChanges();
      }
    });
  }

  // --- Edit Role Popup Card Methods ---
  openEditRoleModal(member: any): void {
    if (member.org_role === 'owner') return;
    this.memberToEdit = member;
    this.pendingRole = member.org_role || 'viewer';
    this.showEditModal = true;
    this.cdr.detectChanges();
  }

  promptChangeRole(member: any, newRole: string): void {
    if (member.org_role === newRole) return;
    this.memberToEdit = member;
    this.pendingRole = newRole;
    this.showEditModal = true;
    this.cdr.detectChanges();
  }

  cancelEditRole(): void {
    this.showEditModal = false;
    this.memberToEdit = null;
    this.pendingRole = '';
    this.cdr.detectChanges();
  }

  confirmChangeRole(): void {
    if (!this.memberToEdit || !this.pendingRole) return;
    const userId = this.getUserId(this.memberToEdit);
    const username = this.getUsername(this.memberToEdit);
    const targetRole = this.pendingRole;
    if (!userId) {
      this.triggerToast('Invalid member user ID.', 'error');
      return;
    }
    this.orgService.updateMemberRole(this.orgId, userId, targetRole).subscribe({
      next: () => {
        this.showEditModal = false;
        this.triggerToast(`Updated '${username}' role to ${targetRole}.`, 'success');
        this.memberToEdit = null;
        this.pendingRole = '';
        this.load();
      },
      error: (err: any) => {
        this.showEditModal = false;
        this.triggerToast(err?.error?.message || 'Error updating role.', 'error');
        this.memberToEdit = null;
        this.pendingRole = '';
        this.cdr.detectChanges();
      }
    });
  }

  showUpgradeModal = false;

  addEmailError = '';

  openAddModal(): void {
    if (!this.entitlementService.canUseFeature('workspace_members')) {
      this.showUpgradeModal = true;
      this.cdr.detectChanges();
      return;
    }
    this.addEmail = '';
    this.addEmailError = '';
    
    // Org roles are just string enums 'admin' and 'member' in the backend org module.
    this.availableRoles = [
      { name: 'member', slug: 'member' },
      { name: 'admin', slug: 'admin' }
    ];
    this.addRole = 'member';
    
    this.showAddModal = true;
  }

  closeAddModal(): void { this.showAddModal = false; this.addEmailError = ''; }

  inviteMember(): void {
    this.addEmailError = '';
    if (!this.addEmail || !this.addEmail.trim()) {
      this.addEmailError = 'Email address is required.';
      this.cdr.detectChanges();
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.addEmail.trim())) {
      this.addEmailError = 'Please enter a valid email address (e.g. user@example.com).';
      this.cdr.detectChanges();
      return;
    }
    if (!this.addRole) {
      this.addEmailError = 'Please select a member role.';
      this.cdr.detectChanges();
      return;
    }

    this.orgService.inviteMember(this.orgId, this.addEmail.trim(), this.addRole, this.orgName).subscribe({
      next: () => {
        this.closeAddModal();
        this.load();
        this.triggerToast('Invitation sent successfully!', 'success');
      },
      error: (err: any) => {
        if (err.status === 403 && err.error?.message?.includes('upgrade the plan')) {
          this.closeAddModal();
          this.dashboardService.showUpgradeModal();
        } else {
          this.addEmailError = err.error?.message || 'Failed to send invitation';
          this.cdr.detectChanges();
        }
      }
    });
  }

  goToUpgrade(): void {
    this.showUpgradeModal = false;
    this.router.navigate(['/pricing']);
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

  getUsername(member: any): string {
    if (!member) return 'User';
    return member.username || member.user_name || member.name || member.email || 'User';
  }

  getUserId(member: any): any {
    if (!member) return 0;
    const candidates = [
      member.user_id,
      member.userId,
      member.user?.id,
      member.user?.user_id,
      member.user?.userId,
      member.id,
      member.member_id,
      member.memberId,
      member.invitation_id,
      member.invitationId,
      member.invite_id,
      member.organization_user_id,
      member.org_user_id,
      member.email
    ];

    for (const val of candidates) {
      if (val !== undefined && val !== null && val !== '') {
        const strVal = String(val).trim();
        if (strVal && strVal !== 'NaN' && strVal !== 'undefined' && strVal !== 'null') {
          return strVal;
        }
      }
    }

    return 0;
  }

  getInitial(name: string): string {
    const displayName = this.getUsername({ username: name });
    return (displayName || '?').charAt(0).toUpperCase();
  }

  getAvatarBg(name: string): string {
    const colors = [
      'linear-gradient(135deg, #3ec5c1, #3b82f6)',
      'linear-gradient(135deg, #8b5cf6, #ec4899)',
      'linear-gradient(135deg, #f59e0b, #ef4444)',
      'linear-gradient(135deg, #10b981, #06b6d4)'
    ];
    let hash = 0;
    const str = name || '';
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }
}
