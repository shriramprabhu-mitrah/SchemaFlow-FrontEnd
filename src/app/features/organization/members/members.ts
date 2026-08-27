import { Component, OnInit, inject, ChangeDetectorRef, HostListener, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrganizationService } from '../services/organization.service';
import { AuthService } from '../../../core/services/auth.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { EntitlementService } from '../../../core/services/entitlement.service';
import { Router } from '@angular/router';
import { DashboardService } from '../../../core/services/dashboard.service';
import { Icons } from '../../../core/component/icons/icons';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [CommonModule, FormsModule, Icons],
  templateUrl: './members.html'
})
export class MembersComponent implements OnInit {
  private orgService = inject(OrganizationService);
  private auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private entitlementService = inject(EntitlementService);
  private router = inject(Router);
  private dashboardService = inject(DashboardService);
  private zone = inject(NgZone);

  members: any[] = [];
  meta: any = {};
  search = '';
  page = 1;
  loading = true;

  private searchSubject = new Subject<string>();

  // Unified Member Modal
  showMemberModal = false;
  isEditMode = false;
  addEmail = '';
  addRole = 'member';
  availableRoles: any[] = [];
  availableFeatures: any[] = [];
  selectedFeatures: string[] = [];
  isAdminSelected: boolean = false;

  // Delete Confirmation Popup Card
  showDeleteModal = false;
  memberToDelete: any = null;

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
    this.entitlementService.entitlements$.subscribe(entitlements => {
      this.zone.run(() => {
        this.availableFeatures = entitlements
          .filter((e: any) => e.enabled && ((e as any).feature_type === 'boolean' || (e as any).limit === null || (e as any).limit === undefined || typeof (e as any).limit === 'boolean' || e.feature_key === 'version_history' || e.feature_key === 'pdf_export' || e.feature_key === 'sql_export' || e.feature_key === 'password_protection' || e.feature_key === 'embed_diagram') && e.feature_key !== 'workspace_members' && e.feature_key !== 'billing')
          .map((e: any) => {
            if (e.feature_key === 'create_workspaces') {
              return { ...e, feature_name: 'Collaborative Workspace' };
            }
            return e;
          });
        this.cdr.markForCheck();
      });
    });
    this.load();
    this.orgService.getOrganization(this.orgId).subscribe({
      next: (res) => {
        this.zone.run(() => {
          this.orgName = res?.data?.name || '';
          this.cdr.markForCheck();
        });
      }
    });

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.zone.run(() => {
        this.search = term;
        this.page = 1;
        this.load();
      });
    });
  }

  load(): void {
    this.loading = true;
    this.orgService.getMembers(this.orgId, this.page, this.limit, this.search, this.sortColumn, this.sortAsc).subscribe({
      next: (res) => {
        this.zone.run(() => {
          this.members = (res?.data || []).map((m: any) => {
            if (m.org_role === 'owner') m.org_role = 'admin';
            return m;
          });
          this.meta = res?.meta || {};
          this.loading = false;
          this.cdr.markForCheck();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.loading = false;
          this.cdr.markForCheck();
        });
      }
    });
  }

  onSearch(term: string): void { 
    this.searchSubject.next(term);
  }
  goToPage(p: number): void { this.page = p; this.load(); }
  onLimitChange(): void { this.page = 1; this.load(); }

  showPageSizeDropdown = false;

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    if (!((event.target as HTMLElement).closest('.custom-status-dropdown-container'))) {
      this.showPageSizeDropdown = false;
    }
  }

  togglePageSizeDropdown(event: Event) {
    event.stopPropagation();
    this.showPageSizeDropdown = !this.showPageSizeDropdown;
  }

  selectPageSize(size: number) {
    this.limit = size;
    this.showPageSizeDropdown = false;
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
    this.load();
  }

  // --- Delete Popup Card Methods ---
  promptRemoveMember(member: any): void {
    if (this.auth.getUserEmail() === this.getUsername(member) || this.auth.getUserEmail() === member.email) {
      this.triggerToast('Cannot remove yourself.', 'error');
      return;
    }
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
    if (this.auth.getUserEmail() === this.getUsername(member) || this.auth.getUserEmail() === member.email) return;
    this.memberToEdit = member;
    this.isEditMode = true;
    this.pendingRole = member.org_role || member.role || 'viewer';
    this.isAdminSelected = this.pendingRole === 'admin';
    if (this.isAdminSelected) {
      this.selectedFeatures = this.availableFeatures.map(f => f.feature_key);
    } else {
      let fAccess = member.feature_access;
      if (typeof fAccess === 'string') {
        try { fAccess = JSON.parse(fAccess); } catch (e) { fAccess = []; }
      }
      if (fAccess && Array.isArray(fAccess)) {
        const validKeys = this.availableFeatures.map(f => f.feature_key);
        this.selectedFeatures = fAccess.filter((k: string) => validKeys.includes(k));
      } else {
        this.selectedFeatures = this.availableFeatures.map(f => f.feature_key);
      }
    }
    this.showMemberModal = true;
    this.cdr.detectChanges();
  }

  promptChangeRole(member: any, newRole: string): void {
    if (member.org_role === newRole) return;
    this.memberToEdit = member;
    this.isEditMode = true;
    this.pendingRole = newRole;
    this.showMemberModal = true;
    this.cdr.detectChanges();
  }

  closeMemberModal(): void {
    this.showMemberModal = false;
    this.memberToEdit = null;
    this.addEmailError = '';
    this.pendingRole = '';
    this.cdr.detectChanges();
  }

  confirmChangeRole(): void {
    if (!this.memberToEdit) return;
    const userId = this.getUserId(this.memberToEdit);
    const username = this.getUsername(this.memberToEdit);
    const targetRole = this.isAdminSelected ? 'admin' : 'member';

    if (!userId) {
      this.triggerToast('Invalid member user ID.', 'error');
      return;
    }

    const required = ['create_diagrams', 'edit_diagram', 'customize_canvas', 'create_diagram', 'diagram_creation', 'create_workspace', 'create_workspaces'];
    this.selectedFeatures = [...new Set([...this.selectedFeatures, ...this.availableFeatures.filter((f: any) => required.includes(f.feature_key)).map((f: any) => f.feature_key)])];

    this.orgService.updateMemberRole(this.orgId, userId, targetRole, this.selectedFeatures).subscribe({
      next: () => {
        this.showMemberModal = false;
        this.triggerToast(`Updated '${username}' permissions.`, 'success');
        this.memberToEdit = null;
        this.pendingRole = '';
        this.load();
      },
      error: (err: any) => {
        this.showMemberModal = false;
        this.triggerToast(err?.error?.message || 'Error updating role.', 'error');
        this.memberToEdit = null;
        this.pendingRole = '';
        this.cdr.detectChanges();
      }
    });
  }

  toggleFeature(featureKey: string): void {
    if (this.isAdminSelected) return;
    const index = this.selectedFeatures.indexOf(featureKey);
    if (index > -1) {
      this.selectedFeatures.splice(index, 1);
    } else {
      this.selectedFeatures.push(featureKey);
    }
    this.cdr.detectChanges();
  }

  areAllFeaturesSelected(): boolean {
    if (this.isAdminSelected) return true;
    return this.selectedFeatures.length === this.availableFeatures.length && this.availableFeatures.length > 0;
  }

  toggleAllFeatures(event: any): void {
    if (this.isAdminSelected) return;
    if (event.target.checked) {
      this.selectedFeatures = this.availableFeatures.map(f => f.feature_key);
    } else {
      this.selectedFeatures = this.availableFeatures
        .filter(f => this.isFeatureRequired(f.feature_key))
        .map(f => f.feature_key);
    }
    this.cdr.detectChanges();
  }

  toggleAdmin(): void {
    this.isAdminSelected = !this.isAdminSelected;
    if (this.isAdminSelected) {
      this.selectedFeatures = this.availableFeatures.map(f => f.feature_key);
    }
    this.cdr.detectChanges();
  }

  // --- Upgrade Modal removed ---

  addEmailError = '';

  openAddModal(): void {

    this.isEditMode = false;
    this.addEmail = '';
    this.addEmailError = '';

    this.isAdminSelected = false;
    this.selectedFeatures = this.availableFeatures.map(f => f.feature_key);
    this.addRole = 'member';

    this.showMemberModal = true;
  }

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
    if (!this.isAdminSelected && !this.addRole) {
      this.addEmailError = 'Please select a member role.';
      this.cdr.detectChanges();
      return;
    }

    const role = this.isAdminSelected ? 'admin' : 'member';
    const required = ['create_diagrams', 'edit_diagram', 'customize_canvas', 'create_diagram', 'diagram_creation', 'create_workspace', 'create_workspaces'];
    this.selectedFeatures = [...new Set([...this.selectedFeatures, ...this.availableFeatures.filter((f: any) => required.includes(f.feature_key)).map((f: any) => f.feature_key)])];

    this.orgService.inviteMember(this.orgId, this.addEmail.trim(), role, this.orgName, this.selectedFeatures).subscribe({
      next: () => {
        this.closeMemberModal();
        this.load();
        this.triggerToast('Invitation sent successfully!', 'success');
      },
      error: (err: any) => {
        if (err.status === 403 && err.error?.message?.includes('upgrade the plan')) {
          this.closeMemberModal();
          this.dashboardService.showUpgradeModal();
        } else {
          this.addEmailError = err.error?.message || 'Failed to send invitation';
          this.cdr.detectChanges();
        }
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
  isFeatureRequired(key: string): boolean {
    const required = ['create_diagrams', 'edit_diagram', 'customize_canvas', 'create_diagram', 'diagram_creation', 'create_workspace', 'create_workspaces'];
    return required.includes(key);
  }

  isCurrentUser(member: any): boolean {
    return this.auth.getUserEmail() === this.getUsername(member) || this.auth.getUserEmail() === member.email;
  }
}
