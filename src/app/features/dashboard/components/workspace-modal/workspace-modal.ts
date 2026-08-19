import { Component, Input, Output, EventEmitter, HostListener, OnChanges, SimpleChanges, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { DashboardService, DiagramSummary, WorkspaceItem } from '../../../../core/services/dashboard.service';
import { AuthService } from '../../../../core/services/auth.service';
import { EntitlementService } from '../../../../core/services/entitlement.service';
import { Icons } from '../../../../core/component/icons/icons';
import { LoaderComponent } from '../../../../shared/loader/loader';

export type PermissionType = 'Viewer' | 'Editor' | 'Editor & Inviter' | 'Owner';

export interface WorkspaceMemberItem {
  id?: number;
  email: string;
  permission: PermissionType;
  isNew?: boolean;
}

export type UserWorkspacePermission = 'Owner' | 'EditorInvite' | 'Editor' | 'Viewer';

@Component({
  selector: 'app-workspace-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, Icons, LoaderComponent],
  templateUrl: './workspace-modal.html'
})
export class WorkspaceModalComponent implements OnChanges, OnInit {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  private _activeTab: 'my-diagrams' | 'shared' | 'create-workspace' | 'my-workspaces' | 'edit-workspace' | 'view-members' = 'my-diagrams';

  @Input()
  get activeTab(): 'my-diagrams' | 'shared' | 'create-workspace' | 'my-workspaces' | 'edit-workspace' | 'view-members' {
    return this._activeTab;
  }
  set activeTab(val: 'my-diagrams' | 'shared' | 'create-workspace' | 'my-workspaces' | 'edit-workspace' | 'view-members') {
    if (this._activeTab !== val) {
      this._activeTab = val;
      this.activeTabChange.emit(val);
    }
  }

  @Output() activeTabChange = new EventEmitter<'my-diagrams' | 'shared' | 'create-workspace' | 'my-workspaces' | 'edit-workspace' | 'view-members'>();
  @Output() close = new EventEmitter<void>();

  sharedDiagrams: any[] = [];
  isLoadingSharedDiagrams = false;

  searchQuery = '';
  sharedDiagramsSearch$ = new Subject<string>();
  sharedDiagramsSearch: string = '';
  sharedDiagramsPage: number = 1;
  sharedDiagramsLimit: number = 10;
  sharedDiagramsTotal: number = 0;
  sharedDiagramsSortBy: string = 'shared_date';
  sharedDiagramsSortOrder: 'asc' | 'desc' = 'desc';

  openMenuId: number | null = null;
  Math = Math;
  openWorkspaceMenuId: number | null = null;
  loadingWorkspaceMenuId: number | null = null;
  selectedWorkspace: WorkspaceItem | null = null;
  selectedWorkspaceForMembers: WorkspaceItem | null = null;
  editingWorkspace: WorkspaceItem | null = null;
  showDiagramsLimitDropdown = false;
  showWorkspacesLimitDropdown = false;
  showSharedLimitDropdown = false;
  showMembersLimitDropdown = false;

  workspacePermissionsMap = new Map<number, UserWorkspacePermission>();
  cachedMembersMap = new Map<number, any[]>();

  // Form State (Create & Edit Workspace)
  workspaceName = '';
  inviteEmail = '';
  invitedEmailsChips: string[] = [];
  invitePermission: PermissionType = 'Viewer';
  membersList: WorkspaceMemberItem[] = [];

  permissionDropdownOpen = false;
  activeMemberDropdownIndex: number | null = null;
  isCreatingWorkspace = false;
  createWorkspaceError = '';
  isUpdatingWorkspace = false;
  updateWorkspaceError = '';

  deleteConfirm = {
    visible: false,
    isDeleting: false,
    deleteSuccess: false,
    workspace: null as WorkspaceItem | null
  };

  deleteDiagramConfirm = {
    visible: false,
    isDeleting: false,
    deleteSuccess: false,
    diagramId: null as number | null,
    diagramName: ''
  };

  deleteMemberConfirm = {
    visible: false,
    isDeleting: false,
    deleteSuccess: false,
    member: null as WorkspaceMemberItem | null
  };

  // --- Diagrams Pagination & Search & Sort ---
  diagramsPage = 1;
  diagramsLimit = 10;
  diagramsSearch = '';
  diagramsSortBy = 'updatedat';
  diagramsSortOrder: 'asc' | 'desc' = 'desc';
  diagramsTotal = 0;
  diagramsTotalPages = 1;

  // --- Workspaces Pagination & Search & Sort ---
  workspacesPage = 1;
  workspacesLimit = 10;
  workspacesSearch = '';
  workspacesSortBy = 'workspacename';
  workspacesSortOrder: 'asc' | 'desc' = 'asc';
  workspacesTotal = 0;
  workspacesTotalPages = 1;

  // --- Members Pagination & Search & Sort ---
  membersPage = 1;
  membersLimit = 10;
  membersSearch = '';
  membersSortBy = 'joineddate';
  membersSortOrder: 'asc' | 'desc' = 'desc';
  membersTotal = 0;
  membersTotalPages = 1;

  constructor(
    public svc: DashboardService,
    public auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    public entitlementService: EntitlementService
  ) { }

  private diagramsSearch$ = new Subject<string>();
  private workspacesSearch$ = new Subject<string>();
  private membersSearch$ = new Subject<string>();

  ngOnInit(): void {
    this.diagramsSearch$.pipe(
      debounceTime(800)
    ).subscribe((val) => {
      this.diagramsSearch = val;
      this.loadDiagrams(1);
      this.isDiagramsLoading = false;
    });

    this.workspacesSearch$.pipe(
      debounceTime(800)
    ).subscribe((val) => {
      this.workspacesSearch = val;
      this.loadWorkspaces(1);
      this.isWorkspacesLoading = false;
    });

    this.sharedDiagramsSearch$.pipe(
      debounceTime(800)
    ).subscribe((val) => {
      this.sharedDiagramsSearch = val;
      this.loadSharedDiagrams(1);
      this.isLoadingSharedDiagrams = false;
    });


    this.membersSearch$.pipe(
      debounceTime(2000),
      distinctUntilChanged()
    ).subscribe((val) => {
      this.membersSearch = val;
      if (this.activeTab === 'view-members') {
        this.loadMembersForView(1);
      } else {
        this.loadMembers(undefined, 1);
      }
    });

  }

  ngOnChanges(changes: SimpleChanges): void {
    const gotVisible = changes['visible'] && changes['visible'].currentValue;
    const gotHidden = changes['visible'] && changes['visible'].currentValue === false;
    const tabChanged = changes['activeTab'] && !changes['activeTab'].firstChange;

    if (gotHidden) {
      // Ensure everything is cleared when the parent hides the modal
      this.workspaceName = '';
      this.inviteEmail = '';
      this.invitedEmailsChips = [];
      this.membersList = [];
      this.createWorkspaceError = '';
      this.updateWorkspaceError = '';
      this.editingWorkspace = null;
      this.selectedWorkspaceForMembers = null;
      this.closeDeleteMemberConfirm();
      this.diagramsSearch = '';
      this.workspacesSearch = '';
      this.membersSearch = '';
      this.openMenuId = null;
      this.openWorkspaceMenuId = null;
      this.activeMemberDropdownIndex = null;
    }

    if (gotVisible || tabChanged) {
      if (!this.activeTab) {
        this.activeTab = 'my-diagrams';
      }
      if (this.activeTab === 'my-diagrams') {
        this.selectedWorkspace = null;
        this.loadDiagrams(1);
      } else if (this.activeTab === 'my-workspaces') {
        this.selectedWorkspace = null;
        this.loadWorkspaces(1);
      } else if (this.activeTab === 'create-workspace') {
        this.createWorkspaceError = '';
        this.workspaceName = '';
        this.inviteEmail = '';
        this.invitedEmailsChips = [];
        this.membersList = [];
        this.editingWorkspace = null;
      }
    }
  }

  get userEmail(): string {
    return this.auth.getUserEmail();
  }

  get diagrams(): DiagramSummary[] {
    return this.svc.diagrams();
  }

  get filteredDiagrams(): DiagramSummary[] {
    const query = (this.searchQuery || '').toLowerCase().trim();
    if (!query) {
      return this.diagrams;
    }
    return this.diagrams.filter(d => (d.name || '').toLowerCase().includes(query));
  }

  onCloseModal(): void {
    this.openMenuId = null;
    this.permissionDropdownOpen = false;
    this.activeMemberDropdownIndex = null;

    // Clear form fields to ensure a fresh state on next open
    this.workspaceName = '';
    this.inviteEmail = '';
    this.invitedEmailsChips = [];
    this.membersList = [];
    this.createWorkspaceError = '';
    this.updateWorkspaceError = '';
    this.editingWorkspace = null;
    this.selectedWorkspaceForMembers = null;
    this.closeDeleteMemberConfirm();

    this.diagramsSearch = '';
    this.workspacesSearch = '';
    this.membersSearch = '';

    this.visible = false;
    this.visibleChange.emit(false);
    this.close.emit();
  }

  onSelectDiagram(id: number): void {
    if (!id) return;
    this.openMenuId = null;
    this.svc.requestSplitView();
    this.svc.loadDiagram(id).subscribe({
      next: () => {
        this.router.navigate([], {
          queryParams: { id: id },
          queryParamsHandling: 'merge'
        });
        this.onCloseModal();
      },
      error: (err) => {
        console.error('Failed to load diagram:', err);
      }
    });
  }

  clearSearches(): void {
    if (this.diagramsSearch) {
      this.diagramsSearch = '';
      this.loadDiagrams(1);
    }
    if (this.workspacesSearch) {
      this.workspacesSearch = '';
      this.loadWorkspaces(1);
    }
    if (this.sharedDiagramsSearch) {
      this.sharedDiagramsSearch = '';
      this.loadSharedDiagrams(1);
    }
    this.membersSearch = '';
  }

  openCreateWorkspace(): void {
    this.clearSearches();
    this.activeTab = 'create-workspace';
    this.createWorkspaceError = '';
    this.workspaceName = '';
    this.inviteEmail = '';
    this.invitedEmailsChips = [];
    this.membersList = [];
    this.editingWorkspace = null;
  }

  selectPersonalWorkspace(loadData: boolean = true): void {
    this.clearSearches();
    const tabChanged = this._activeTab !== 'my-diagrams';
    this.selectedWorkspace = null;
    this.activeTab = 'my-diagrams';
    if (loadData && !tabChanged) {
      this.loadDiagrams(1);
    }
  }

  openSharedTab(): void {
    this.clearSearches();
    this.activeTab = 'shared';
    this.loadSharedDiagrams();
    this.cdr.detectChanges();
  }

  loadSharedDiagrams(page: any = this.sharedDiagramsPage): void {
    this.sharedDiagramsPage = Number(page);
    this.isLoadingSharedDiagrams = true;
    this.cdr.markForCheck();
    
    const params = {
      page: this.sharedDiagramsPage,
      limit: this.sharedDiagramsLimit,
      search: this.sharedDiagramsSearch,
      sortBy: this.sharedDiagramsSortBy,
      sortOrder: this.sharedDiagramsSortOrder
    };

    this.svc.getSharedDiagrams(params).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.sharedDiagrams = res?.data || [];
          this.sharedDiagramsTotal = res?.total || 0;
          this.isLoadingSharedDiagrams = false;
          this.cdr.markForCheck();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.isLoadingSharedDiagrams = false;
          this.cdr.markForCheck();
        });
      }
    });
  }

  onSharedDiagramsSearchChange(val: string): void {
    this.isLoadingSharedDiagrams = true;
    this.sharedDiagramsSearch$.next(val);
  }

  onSharedSortToggle(field: string): void {
    if (this.sharedDiagramsSortBy === field) {
      this.sharedDiagramsSortOrder = this.sharedDiagramsSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sharedDiagramsSortBy = field;
      this.sharedDiagramsSortOrder = 'desc';
    }
    this.loadSharedDiagrams(1);
  }

  onSharedLimitChange(newLimit: any): void {
    this.sharedDiagramsLimit = Number(newLimit);
    this.showSharedLimitDropdown = false;
    this.loadSharedDiagrams(1);
  }

  getSharedPages(): any[] {
    const totalPages = Math.ceil(this.sharedDiagramsTotal / this.sharedDiagramsLimit) || 1;
    const currentPage = this.sharedDiagramsPage;
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, '...', totalPages];
    }
    if (currentPage >= totalPages - 2) {
      return [1, '...', totalPages - 2, totalPages - 1, totalPages];
    }
    return [currentPage, currentPage + 1, '...', totalPages];
  }

  openSharedDiagram(publicToken: string): void {
    if (!publicToken) return;
    const url = `/public-diagram/${publicToken}`;
    window.open(url, '_blank');
  }

  deleteSharedConfirm = {
    visible: false,
    diagramId: null as number | null,
    isDeleting: false,
    deleteSuccess: false
  };

  deleteSharedDiagram(diagramId: number): void {
    this.deleteSharedConfirm = {
      visible: true,
      diagramId,
      isDeleting: false,
      deleteSuccess: false
    };
  }

  closeDeleteSharedConfirm(): void {
    this.deleteSharedConfirm = {
      visible: false,
      diagramId: null,
      isDeleting: false,
      deleteSuccess: false
    };
  }

  confirmDeleteSharedDiagram(): void {
    const diagramId = this.deleteSharedConfirm.diagramId;
    if (!diagramId) return;

    this.deleteSharedConfirm.isDeleting = true;
    this.cdr.detectChanges();

    this.svc.deleteSharedDiagram(diagramId).subscribe({
      next: () => {
        this.deleteSharedConfirm.isDeleting = false;
        this.deleteSharedConfirm.deleteSuccess = true;
        this.cdr.detectChanges();
        this.loadSharedDiagrams();

        setTimeout(() => {
          this.closeDeleteSharedConfirm();
        }, 1500);
      },
      error: () => {
        this.deleteSharedConfirm.isDeleting = false;
        this.svc.showToast('Failed to remove shared diagram.', 3000, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  getMin(a: number, b: number): number {
    return Math.min(a, b);
  }

  getPageRange(currentPage: number, totalPages: number): (number | string)[] {
    if (totalPages <= 3) {
      const range: (number | string)[] = [];
      for (let i = 1; i <= totalPages; i++) {
        range.push(i);
      }
      return range;
    }
    if (currentPage <= 2) {
      return [1, 2, '...', totalPages];
    }
    if (currentPage >= totalPages - 1) {
      return [totalPages - 2, totalPages - 1, totalPages];
    }
    return [currentPage, currentPage + 1, '...', totalPages];
  }

  loadDiagrams(page: any = this.diagramsPage): void {
    this.diagramsPage = Number(page);
    const wsId = this.selectedWorkspace?.id;
    this.svc.fetchDiagrams({
      workspaceId: wsId,
      page: this.diagramsPage,
      limit: this.diagramsLimit,
      search: this.diagramsSearch,
      sortBy: this.diagramsSortBy,
      sortOrder: this.diagramsSortOrder
    }).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.diagramsTotal = res.total;
          this.diagramsTotalPages = res.totalPages;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.cdr.markForCheck();
        });
      }
    });
  }

  onDiagramsLimitChange(newLimit: any): void {
    this.diagramsLimit = Number(newLimit);
    this.loadDiagrams(1);
  }

  isDiagramsLoading = false;

  onDiagramsSearchChange(val: string): void {
    this.diagramsSearch = val;
    this.isDiagramsLoading = true;
    this.diagramsSearch$.next(val);
  }

  onDiagramsSortToggle(field: string): void {
    if (this.diagramsSortBy === field) {
      this.diagramsSortOrder = this.diagramsSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.diagramsSortBy = field;
      this.diagramsSortOrder = 'asc';
    }
    this.loadDiagrams(1);
  }

  isWorkspacesLoading = false;

  loadWorkspaces(page: any = this.workspacesPage): void {
    this.workspacesPage = Number(page);
    this.isWorkspacesLoading = true;
    this.svc.fetchWorkspaces({
      page: this.workspacesPage,
      limit: this.workspacesLimit,
      search: this.workspacesSearch,
      sortBy: this.workspacesSortBy,
      sortOrder: this.workspacesSortOrder
    }).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.workspacesTotal = res.total;
          this.workspacesTotalPages = res.totalPages;
          this.isWorkspacesLoading = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.isWorkspacesLoading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  onWorkspacesLimitChange(newLimit: any): void {
    this.workspacesLimit = Number(newLimit);
    this.loadWorkspaces(1);
  }

  onWorkspacesSearchChange(val: string): void {
    this.workspacesSearch = val;
    this.isWorkspacesLoading = true;
    this.workspacesSearch$.next(val);
  }

  onWorkspacesSortToggle(field: string): void {
    if (this.workspacesSortBy === field) {
      this.workspacesSortOrder = this.workspacesSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.workspacesSortBy = field;
      this.workspacesSortOrder = 'asc';
    }
    this.loadWorkspaces(1);
  }

  loadMembers(workspaceId?: number, page: any = this.membersPage): void {
    const wsId = workspaceId ?? this.editingWorkspace?.id;
    if (!wsId) return;
    this.membersPage = Number(page);
    this.isLoadingMembers = true;
    this.cdr.detectChanges();
    this.svc.fetchWorkspaceMembers(wsId, {
      page: this.membersPage,
      limit: this.membersLimit,
      search: this.membersSearch,
      sortBy: this.membersSortBy,
      sortOrder: this.membersSortOrder
    }).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          try {
            this.membersTotal = res?.total || 0;
            this.membersTotalPages = res?.totalPages || 1;
            const membersData = res?.data || [];
            this.cachedMembersMap.set(wsId, membersData);
            this.populateMembersList(membersData);
          } catch (e) {
            console.error('Error processing members response:', e);
          } finally {
            this.isLoadingMembers = false;
            this.cdr.detectChanges();
          }
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.isLoadingMembers = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  onMembersLimitChange(newLimit: any): void {
    this.membersLimit = Number(newLimit);
    this.loadMembers(undefined, 1);
  }

  onMembersSearchChange(val: string): void {
    if (this.membersSearch !== val) {
      this.isLoadingMembers = true;
      this.cdr.detectChanges();
    }
    this.membersSearch = val;
    this.membersSearch$.next(val);
  }

  onMembersSortToggle(field: string): void {
    if (this.membersSortBy === field) {
      this.membersSortOrder = this.membersSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.membersSortBy = field;
      this.membersSortOrder = 'asc';
    }
    if (this.activeTab === 'view-members') {
      this.loadMembersForView(1);
    } else {
      this.loadMembers(undefined, 1);
    }
  }

  openMyWorkspaces(): void {
    this.clearSearches();
    const tabChanged = this._activeTab !== 'my-workspaces';
    this.activeTab = 'my-workspaces';
    this.selectedWorkspace = null;
    if (!tabChanged) {
      this.loadWorkspaces(1);
    }
    this.cdr.detectChanges();
  }

  onSelectWorkspace(workspace: WorkspaceItem): void {
    this.openWorkspaceMenuId = null;
    this.openMenuId = null;
    this.selectedWorkspace = workspace;
    this.loadDiagrams(1);
  }

  normalizePermissionRole(raw?: string): UserWorkspacePermission {
    if (!raw) return 'Owner';
    const str = raw.toString().trim().toLowerCase();
    if (str === 'owner') return 'Owner';
    if (str === 'editorinvite' || str.includes('invite') || str.includes('& inviter')) return 'EditorInvite';
    if (str === 'editor' || str.includes('edit')) return 'Editor';
    if (str === 'viewer' || str.includes('view')) return 'Viewer';
    return 'Owner';
  }

  getUserPermissionFromMembers(membersData: any[], currentUserEmail: string): UserWorkspacePermission {
    if (!Array.isArray(membersData) || membersData.length === 0) return 'Owner';
    const emailLower = (currentUserEmail || '').trim().toLowerCase();
    const member = membersData.find((m: any) => {
      const mEmail = (m?.email || m?.user_email || m?.userEmail || m?.member_email || '').toString().trim().toLowerCase();
      return mEmail === emailLower;
    });
    if (member) {
      const rawPerm = member.permission || member.role || member.access || member.permission_type || member.permissionType;
      if (rawPerm) {
        return this.normalizePermissionRole(rawPerm);
      }
    }
    return 'Owner';
  }

  getWorkspacePermission(ws: WorkspaceItem | null): UserWorkspacePermission {
    if (!ws) return 'Owner';
    if (this.workspacePermissionsMap.has(ws.id)) {
      return this.workspacePermissionsMap.get(ws.id)!;
    }
    return this.normalizePermissionRole(ws.permission);
  }

  canEditWorkspace(perm?: string | UserWorkspacePermission): boolean {
    const role = this.normalizePermissionRole(perm);
    return role === 'Owner' || role === 'EditorInvite';
  }

  canDeleteWorkspace(perm?: string | UserWorkspacePermission): boolean {
    const role = this.normalizePermissionRole(perm);
    return role === 'Owner' || role === 'EditorInvite';
  }

  canEditDiagram(perm?: string | UserWorkspacePermission): boolean {
    const role = this.normalizePermissionRole(perm);
    return role === 'Owner' || role === 'EditorInvite' || role === 'Editor';
  }

  canCreateDiagram(perm?: string | UserWorkspacePermission): boolean {
    const role = this.normalizePermissionRole(perm);
    return role === 'Owner' || role === 'EditorInvite' || role === 'Editor';
  }

  canDeleteDiagram(perm?: string | UserWorkspacePermission): boolean {
    const role = this.normalizePermissionRole(perm);
    return role === 'Owner' || role === 'EditorInvite' || role === 'Editor';
  }

  backToWorkspacesList(): void {
    this.selectedWorkspace = null;
    this.svc.fetchWorkspaces().subscribe({
      next: () => this.cdr.markForCheck(),
      error: () => this.cdr.markForCheck()
    });
    this.cdr.detectChanges();
  }

  getPermissionLabel(perm: PermissionType): string {
    switch (perm) {
      case 'Owner':
        return 'Owner';
      case 'Editor & Inviter':
        return 'Can edit & invite';
      case 'Editor':
        return 'Can edit';
      case 'Viewer':
      default:
        return 'Can view';
    }
  }

  getWorkspaceOwnerEmail(ws: WorkspaceItem): string {
    if (ws.user_email) return ws.user_email;

    if (ws.permission === 'Owner' || this.normalizePermissionRole(ws.permission) === 'Owner') {
      return this.userEmail || '';
    }

    if (this.cachedMembersMap.has(ws.id)) {
      const members = this.cachedMembersMap.get(ws.id)!;
      const ownerMember = members.find(m => m.permission === 'Owner' || m.role?.toLowerCase() === 'owner');
      if (ownerMember) {
        const email = ownerMember.email || ownerMember.user_email || ownerMember.userEmail || ownerMember.member_email;
        if (email) return email;
      }
    }

    return '';
  }

  onEmailInputKeyDown(event: KeyboardEvent): void {
    const key = event.key;
    if (key === ',' || key === ';' || key === ' ' || key === 'Enter') {
      event.preventDefault();
      this.addEmailChip();
    } else if (key === 'Backspace' && !this.inviteEmail) {
      if (this.invitedEmailsChips.length > 0) {
        this.invitedEmailsChips.pop();
        this.cdr.detectChanges();
      }
    }
  }

  addEmailChip(): void {
    const input = (this.inviteEmail || '').trim().toLowerCase();
    if (!input) return;

    // Split by comma, semicolon, or space
    const emails = input.split(/[,;\s]+/);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (const email of emails) {
      const trimmed = email.trim();
      if (!trimmed) continue;

      if (!emailRegex.test(trimmed)) {
        this.svc.showToast(`"${trimmed}" is not a valid email address.`, 3000, 'error');
        continue;
      }

      if (trimmed === this.userEmail.toLowerCase()) {
        this.svc.showToast('You cannot invite yourself as a member.', 3000, 'error');
        continue;
      }

      if (this.invitedEmailsChips.includes(trimmed)) {
        continue;
      }

      if (this.membersList.some(m => m.email.toLowerCase() === trimmed)) {
        this.svc.showToast(`"${trimmed}" has already been added to the members list.`, 3000, 'error');
        continue;
      }

      this.invitedEmailsChips.push(trimmed);
    }

    this.inviteEmail = '';
    this.cdr.detectChanges();
  }

  clearErrors(): void {
    this.createWorkspaceError = '';
    if (this.svc.toastType() === 'error') {
      this.svc.toastMessage.set(null);
    }
  }

  removeEmailChip(email: string): void {
    const idx = this.invitedEmailsChips.indexOf(email);
    if (idx !== -1) {
      this.invitedEmailsChips.splice(idx, 1);
      this.cdr.detectChanges();
    }
  }

  addMember(): void {
    this.addEmailChip();
    if (this.invitedEmailsChips.length === 0) {
      return;
    }

    for (const email of this.invitedEmailsChips) {
      if (this.membersList.some(m => m.email.toLowerCase() === email)) {
        continue;
      }
      this.membersList.push({
        email: email,
        permission: this.invitePermission,
        isNew: true
      });
    }

    this.membersTotal = this.membersList.length;
    this.membersTotalPages = Math.ceil(this.membersTotal / this.membersLimit);

    this.invitedEmailsChips = [];
    this.inviteEmail = '';
    this.permissionDropdownOpen = false;
    this.cdr.detectChanges();
  }

  removeMember(index: number, e?: Event): void {
    if (e) e.stopPropagation();
    this.membersList.splice(index, 1);
    this.membersTotal = Math.max(0, (this.membersTotal || 0) - 1);
    this.membersTotalPages = Math.ceil(this.membersTotal / this.membersLimit);
    this.activeMemberDropdownIndex = null;
    this.cdr.detectChanges();
  }

  toggleMemberDropdown(index: number, e: Event): void {
    if (e) e.stopPropagation();
    this.activeMemberDropdownIndex = this.activeMemberDropdownIndex === index ? null : index;
    this.cdr.detectChanges();
  }

  changeMemberPermission(index: number, permission: PermissionType, e?: Event): void {
    if (e) e.stopPropagation();
    if (index >= 0 && index < this.membersList.length) {
      this.membersList[index].permission = permission;
    }
    this.activeMemberDropdownIndex = null;
  }

  onMemberPermissionSelectChange(index: number, val: string): void {
    if (val === 'REMOVE') {
      this.removeMember(index);
    } else if (index >= 0 && index < this.membersList.length) {
      this.membersList[index].permission = val as PermissionType;
    }
  }

  submitCreateWorkspace(): void {
    const name = (this.workspaceName || '').trim();
    if (!name) {
      this.createWorkspaceError = 'Please enter a workspace name.';
      return;
    }

    this.isCreatingWorkspace = true;
    this.createWorkspaceError = '';

    const payload = {
      workspaceName: name,
      members: this.membersList.map(m => ({
        email: m.email,
        permission: this.normalizePermissionRole(m.permission)
      }))
    };

    this.svc.createWorkspace(payload).pipe(
      finalize(() => {
        this.isCreatingWorkspace = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: () => {
        this.svc.showToast(`Workspace "${name}" created successfully.`, 3000);
        this.resetWorkspaceForm();
        this.openMyWorkspaces();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to create workspace:', err);
        const errMsg = err?.error?.message || 'Failed to create workspace. Please try again.';
        this.svc.showToast(errMsg, 4000, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  resetWorkspaceForm(): void {
    this.workspaceName = '';
    this.inviteEmail = '';
    this.invitePermission = 'Viewer';
    this.membersList = [];
    this.createWorkspaceError = '';
    this.updateWorkspaceError = '';
    this.permissionDropdownOpen = false;
    this.activeMemberDropdownIndex = null;
    this.editingWorkspace = null;
    this.isCreatingWorkspace = false;
    this.isUpdatingWorkspace = false;
  }

  isLoadingMembers = false;

  private mapPermission(perm: string): PermissionType {
    if (!perm) return 'Viewer';
    const p = perm.toString().toLowerCase();
    if (p.includes('invite') || p.includes('editor & inviter')) {
      return 'Editor & Inviter';
    }
    if (p.includes('edit')) {
      return 'Editor';
    }
    return 'Viewer';
  }

  toggleWorkspaceMenu(id: number, e: Event): void {
    e.stopPropagation();
    if (this.openWorkspaceMenuId === id) {
      this.openWorkspaceMenuId = null;
      return;
    }
    this.openWorkspaceMenuId = id;
    this.openMenuId = null;
    this.cdr.detectChanges();

    // If members for this workspace are already cached, use cached permission
    if (this.cachedMembersMap.has(id)) {
      const cached = this.cachedMembersMap.get(id)!;
      const perm = this.getUserPermissionFromMembers(cached, this.userEmail);
      this.workspacePermissionsMap.set(id, perm);
      const ws = this.svc.workspaces().find(w => w.id === id);
      if (ws) ws.permission = perm;
      this.cdr.detectChanges();
      return;
    }

    // Call API ONLY for this specific workspace when clicking three dots
    this.svc.fetchWorkspaceMembers(id).subscribe({
      next: (res: any) => {
        const membersData = Array.isArray(res)
          ? res
          : (res?.data ?? res?.members ?? res?.result ?? []);
        this.cachedMembersMap.set(id, membersData);
        const perm = this.getUserPermissionFromMembers(membersData, this.userEmail);
        this.workspacePermissionsMap.set(id, perm);
        const ws = this.svc.workspaces().find(w => w.id === id);
        if (ws) ws.permission = perm;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to fetch workspace members on menu toggle:', err);
      }
    });
  }

  private populateMembersList(membersData: any[]): void {
    if (Array.isArray(membersData)) {
      const list = membersData.map((m: any) => {
        const id = m?.id ?? m?.workspace_member_id ?? m?.workspaceMemberId ?? m?.memberid ?? m?.member_id ?? m?.userId ?? m?.user_id ?? m?.userid;
        const email = (m?.email || '').toString();
        const rawPerm = m?.permission || m?.role || m?.access || m?.permission_type || m?.permissionType || '';
        const permission = (rawPerm.toString().toLowerCase() === 'owner') ? 'Owner' : this.mapPermission(rawPerm);
        return { id, email, permission };
      });
      
      // Sort to ensure 'Owner' is always first
      this.membersList = list.sort((a, b) => {
        if (a.permission === 'Owner' && b.permission !== 'Owner') return -1;
        if (b.permission === 'Owner' && a.permission !== 'Owner') return 1;
        return 0;
      });
    } else {
      this.membersList = [];
    }
  }

  get filteredMembersList(): any[] {
    const query = (this.membersSearch || '').toLowerCase().trim();
    if (!query) {
      return this.membersList;
    }
    return this.membersList.filter(m =>
      (m.email && m.email.toLowerCase().includes(query)) ||
      (m.permission && m.permission.toLowerCase().includes(query))
    );
  }

  openWorkspaceMembers(workspace: WorkspaceItem, e: Event): void {
    e.stopPropagation();
    this.openWorkspaceMenuId = null;
    this.selectedWorkspaceForMembers = workspace;
    this.membersList = [];
    this.membersPage = 1;
    this.membersSearch = '';
    this.activeTab = 'view-members';
    this.cdr.detectChanges();
    this.loadMembersForView(1);
  }

  loadMembersForView(page: any = this.membersPage): void {
    const wsId = this.selectedWorkspaceForMembers?.id;
    if (!wsId) return;
    this.membersPage = Number(page);
    this.isLoadingMembers = true;
    this.cdr.detectChanges();
    this.svc.fetchWorkspaceMembers(wsId, {
      page: this.membersPage,
      limit: this.membersLimit,
      search: this.membersSearch,
      sortBy: this.membersSortBy,
      sortOrder: this.membersSortOrder
    }).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          try {
            console.log('fetchWorkspaceMembers response:', res);
            this.membersTotal = res?.total || 0;
            this.membersTotalPages = res?.totalPages || 1;
            const membersData = res?.data || [];
            console.log('membersData derived from response:', membersData);
            this.cachedMembersMap.set(wsId, membersData);
            this.populateMembersList(membersData);
            console.log('membersList after populate:', this.membersList);
          } catch (e) {
            console.error('Error processing members response:', e);
          } finally {
            this.isLoadingMembers = false;
            this.cdr.detectChanges();
          }
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.isLoadingMembers = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  onMembersLimitChangeForView(newLimit: any): void {
    this.membersLimit = Number(newLimit);
    this.loadMembersForView(1);
  }

  canDeleteMember(): boolean {
    const ws = this.selectedWorkspaceForMembers;
    if (!ws) return false;
    const perm = this.getWorkspacePermission(ws);
    return perm === 'Owner' || perm === 'EditorInvite';
  }

  showDeleteMemberConfirm(member: WorkspaceMemberItem, e?: Event): void {
    if (e) e.stopPropagation();
    if (!this.canDeleteMember()) {
      this.svc.showToast('You do not have permission to delete members from this workspace.', 3000, 'error');
      return;
    }
    this.deleteMemberConfirm = {
      visible: true,
      isDeleting: false,
      deleteSuccess: false,
      member
    };
    this.cdr.detectChanges();
  }

  closeDeleteMemberConfirm(): void {
    this.deleteMemberConfirm = {
      visible: false,
      isDeleting: false,
      deleteSuccess: false,
      member: null
    };
    this.cdr.detectChanges();
  }

  confirmDeleteMember(): void {
    const member = this.deleteMemberConfirm.member;
    const ws = this.selectedWorkspaceForMembers;
    if (!member || !ws) return;
    if (!member.id) {
      this.svc.showToast('Unable to delete: member ID is missing.', 3000, 'error');
      return;
    }

    this.deleteMemberConfirm.isDeleting = true;
    this.cdr.detectChanges();

    this.svc.deleteWorkspaceMember(ws.id, member.id).subscribe({
      next: () => {
        this.deleteMemberConfirm.isDeleting = false;
        this.deleteMemberConfirm.deleteSuccess = true;
        this.cdr.detectChanges();

        // Reload the members list
        this.loadMembersForView(this.membersPage);

        setTimeout(() => {
          this.closeDeleteMemberConfirm();
        }, 1500);
      },
      error: (err) => {
        console.error('Failed to delete workspace member:', err);
        this.deleteMemberConfirm.isDeleting = false;
        this.svc.showToast(err?.error?.message || 'Failed to delete workspace member.', 3000, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  onSelectWorkspaceFromMenu(workspace: WorkspaceItem, e: Event): void {
    e.stopPropagation();
    this.openWorkspaceMenuId = null;
    this.onSelectWorkspace(workspace);
  }

  onCreateWorkspaceDiagram(workspace: WorkspaceItem, e: Event): void {
    e.stopPropagation();
    const perm = this.getWorkspacePermission(workspace);
    if (!this.canEditDiagram(perm)) {
      this.svc.showToast('You do not have permission to create diagrams in this workspace.', 3000, 'error');
      return;
    }
    this.openWorkspaceMenuId = null;

    this.svc.createWorkspaceDiagram(workspace.id, 'Untitled Diagram', workspace.name).subscribe({
      next: (res) => {
        const newId = this.svc.diagramId();
        this.svc.requestSplitView();
        this.svc.clearDiagram(true);
        this.svc.code = '';
        this.svc.diagramName = 'Untitled Diagram';
        this.svc.tablePositions = {};
        this.svc.refColors = {};
        this.svc.tables = [];
        this.svc.refs = [];
        this.svc.showCanvasPlaceholder = true;
        this.svc.updateGutter();
        this.svc.parseAndLayout();
        this.svc.requestCanvasFit();
        this.svc.updateOriginalState();

        this.svc.showToast(`Diagram created in workspace "${workspace.name}".`, 3000);
        this.onCloseModal();

        if (newId != null) {
          this.router.navigate(['/dashboard'], {
            queryParams: { id: newId },
            queryParamsHandling: 'merge'
          });
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        console.error('Failed to create diagram in workspace:', err);
        this.svc.showToast('Failed to create diagram. Please try again.', 3000, 'error');
      }
    });
  }

  openEditWorkspace(workspace: WorkspaceItem, e?: Event): void {
    if (e) e.stopPropagation();
    const perm = this.getWorkspacePermission(workspace);
    if (!this.canEditWorkspace(perm)) {
      this.svc.showToast('You do not have permission to edit this workspace.', 3000, 'error');
      return;
    }
    this.openWorkspaceMenuId = null;
    this.editingWorkspace = workspace;
    this.workspaceName = workspace.name || '';
    this.inviteEmail = '';
    this.membersList = [];
    this.updateWorkspaceError = '';
    this.activeTab = 'edit-workspace';
    this.membersPage = 1;
    this.membersSearch = '';
    this.cdr.detectChanges();

    this.loadMembers(workspace.id, 1);

    setTimeout(() => {
      const inputEl = document.querySelector('.workspace-title-input') as HTMLInputElement;
      if (inputEl) {
        inputEl.focus();
        const len = inputEl.value.length;
        inputEl.setSelectionRange(len, len);
      }
    }, 50);
  }

  submitEditWorkspace(): void {
    if (!this.editingWorkspace) return;
    const name = (this.workspaceName || '').trim();
    if (!name) {
      this.updateWorkspaceError = 'Please enter a workspace name.';
      return;
    }

    this.isUpdatingWorkspace = true;
    this.updateWorkspaceError = '';

    const payload = {
      workspaceName: name,
      members: this.membersList
        .filter(m => m.permission !== 'Owner')
        .map(m => ({
          email: m.email,
          permission: this.normalizePermissionRole(m.permission)
        }))
    };

    const targetId = this.editingWorkspace.id;

    this.svc.updateWorkspace(targetId, payload).pipe(
      finalize(() => {
        this.isUpdatingWorkspace = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: () => {
        this.svc.showToast(`Workspace "${name}" updated successfully.`, 3000);
        this.resetWorkspaceForm();
        this.openMyWorkspaces();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to update workspace:', err);
        const errMsg = err?.error?.message || 'Failed to update workspace. Please try again.';
        this.svc.showToast(errMsg, 4000, 'error');
        // Revert newly added members so UI accurately reflects backend state
        this.membersList = this.membersList.filter(m => !m.isNew);
        this.membersTotal = this.membersList.length;
        this.membersTotalPages = Math.ceil(this.membersTotal / this.membersLimit);
        this.cdr.detectChanges();
      }
    });
  }

  showDeleteConfirm(workspace: WorkspaceItem, e?: Event): void {
    if (e) e.stopPropagation();
    const perm = this.getWorkspacePermission(workspace);
    if (!this.canDeleteWorkspace(perm)) {
      this.svc.showToast('You do not have permission to delete this workspace.', 3000, 'error');
      return;
    }
    this.openWorkspaceMenuId = null;
    this.deleteConfirm = {
      visible: true,
      isDeleting: false,
      deleteSuccess: false,
      workspace
    };
    this.cdr.detectChanges();
  }

  closeDeleteConfirm(): void {
    this.deleteConfirm = {
      visible: false,
      isDeleting: false,
      deleteSuccess: false,
      workspace: null
    };
    this.cdr.detectChanges();
  }

  confirmDeleteWorkspace(): void {
    const workspace = this.deleteConfirm.workspace;
    if (!workspace) return;

    this.deleteConfirm.isDeleting = true;
    this.cdr.detectChanges();

    this.svc.deleteWorkspace(workspace.id).subscribe({
      next: () => {
        this.deleteConfirm.isDeleting = false;
        this.deleteConfirm.deleteSuccess = true;
        this.cdr.detectChanges();

        this.svc.fetchWorkspaces().subscribe();

        setTimeout(() => {
          this.closeDeleteConfirm();
        }, 2000);
      },
      error: (err) => {
        console.error('Failed to delete workspace:', err);
        this.deleteConfirm.isDeleting = false;
        this.svc.showToast('Failed to delete workspace.', 3000, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  toggleRowMenu(id: number, e: Event): void {
    e.stopPropagation();
    this.openMenuId = this.openMenuId === id ? null : id;
  }

  showDeleteDiagramConfirm(diagram: any, e: Event): void {
    e.stopPropagation();
    if (this.selectedWorkspace) {
      const perm = this.getWorkspacePermission(this.selectedWorkspace);
      if (!this.canDeleteDiagram(perm)) {
        this.svc.showToast('You do not have permission to delete diagrams in this workspace.', 3000, 'error');
        return;
      }
    }
    this.openMenuId = null;
    this.deleteDiagramConfirm = {
      visible: true,
      isDeleting: false,
      deleteSuccess: false,
      diagramId: diagram.id,
      diagramName: diagram.name || 'Untitled Diagram'
    };
  }

  closeDeleteDiagramConfirm(): void {
    if (this.deleteDiagramConfirm.isDeleting) return;
    this.deleteDiagramConfirm.visible = false;
    setTimeout(() => {
      this.deleteDiagramConfirm.diagramId = null;
      this.deleteDiagramConfirm.deleteSuccess = false;
    }, 200);
  }

  confirmDeleteDiagram(): void {
    if (!this.deleteDiagramConfirm.diagramId) return;
    this.deleteDiagramConfirm.isDeleting = true;

    this.svc.deleteDiagram(this.deleteDiagramConfirm.diagramId).subscribe({
      next: () => {
        this.deleteDiagramConfirm.isDeleting = false;
        this.deleteDiagramConfirm.deleteSuccess = true;
        this.svc.showToast('Diagram deleted.', 2000);
        setTimeout(() => this.closeDeleteDiagramConfirm(), 1500);
      },
      error: (err) => {
        console.error('Failed to delete diagram:', err);
        this.deleteDiagramConfirm.isDeleting = false;
        this.svc.showToast('Failed to delete diagram.', 3000, 'error');
        this.closeDeleteDiagramConfirm();
      }
    });
  }

  formatDate(dateVal: string | Date | null | undefined): string {
    if (!dateVal) return '—';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);

      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const month = monthNames[d.getMonth()];
      const day = d.getDate();
      let suffix = 'th';
      if (day === 1 || day === 21 || day === 31) suffix = 'st';
      else if (day === 2 || day === 22) suffix = 'nd';
      else if (day === 3 || day === 23) suffix = 'rd';

      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;

      return `${month} ${day}${suffix} ${year}, ${hours}:${minutes} ${ampm}`;
    } catch {
      return '—';
    }
  }

  onContainerClick(e: MouseEvent): void {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    if (!target.closest('.three-dots-btn') && !target.closest('.action-menu-dropdown')) {
      this.openMenuId = null;
      this.openWorkspaceMenuId = null;
    }
    if (!target.closest('.btn-member-perm-select') &&
      !target.closest('.member-context-menu') &&
      !target.closest('.permission-dropdown-menu')) {
      this.activeMemberDropdownIndex = null;
      this.permissionDropdownOpen = false;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e?: MouseEvent): void {
    if (e) {
      const target = e.target as HTMLElement;
      if (!target.closest('.three-dots-btn') && !target.closest('.action-menu-dropdown')) {
        this.openMenuId = null;
        this.openWorkspaceMenuId = null;
      }
      if (!target.closest('.custom-select-container')) {
        this.showDiagramsLimitDropdown = false;
        this.showWorkspacesLimitDropdown = false;
        this.showSharedLimitDropdown = false;
        this.showMembersLimitDropdown = false;
      }
    } else {
      this.openMenuId = null;
      this.openWorkspaceMenuId = null;
      this.showDiagramsLimitDropdown = false;
      this.showWorkspacesLimitDropdown = false;
    }
    this.permissionDropdownOpen = false;
    this.activeMemberDropdownIndex = null;
  }
}
