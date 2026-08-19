import { ChangeDetectorRef, Component, HostListener, Input, OnInit, effect, NgZone, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../../../core/services/dashboard.service';
import { ButtonComponent } from '../../../shared/button/button';
import { Icons } from '../../component/icons/icons';
import { ExportService, SqlDialect } from '../../services/export.service';
import { ImportService } from '../../services/import.service';
import { Subject } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { EntitlementService } from '../../../core/services/entitlement.service';
import { WorkspaceModalComponent } from '../../../features/dashboard/components/workspace-modal/workspace-modal';
import { ShareModalComponent } from '../../../features/dashboard/components/share-modal/share-modal';
import { UpgradeModalComponent } from '../../../features/dashboard/components/upgrade-modal/upgrade-modal';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, ButtonComponent, Icons, WorkspaceModalComponent, ShareModalComponent, UpgradeModalComponent],
  templateUrl: './header.html',
})

export class HeaderComponent implements OnInit {
  private _diagramNameEl?: ElementRef<HTMLDivElement>;
  @ViewChild('diagramNameEl') set diagramNameEl(el: ElementRef<HTMLDivElement> | undefined) {
    if (el) {
      this._diagramNameEl = el;
      const nameEl = el.nativeElement;
      if (nameEl && document.activeElement !== nameEl) {
        nameEl.innerText = this.svc.diagramName;
      }
    }
  }
  @Input() isProfilePage = false;

  isSampleDiagram(): boolean {
    return this.route.snapshot.queryParamMap.get('sample') === 'true' || this.svc.diagramName === 'Sample Diagram';
  }

  exportMenuOpen = false;
  exporting = false;
  exportError: string | null = null;

  importMenuOpen = false;

  // Personal Menu & Workspace Modal state
  personalMenuOpen = false;
  showMyDiagramsSubmenu = false;
  showSampleSubmenu = false;
  showWorkspaceSubmenu = false;
  workspaceModalOpen = false;
  shareModalOpen = false;
  upgradeModalOpen = false;
  upgradeFeatureKey = '';
  workspaceModalTab: 'my-diagrams' | 'shared' | 'create-workspace' | 'my-workspaces' | 'edit-workspace' | 'view-members' = 'my-diagrams';
  profileMenuOpen = false;

  // Import modal state
  importModalOpen = false;
  importDialect: SqlDialect | null = null;
  importSqlText = '';
  importValidating = false;
  importValidated = false;
  importValidationError: string | null = null;
  importing = false;
  importError: string | null = null;
  private readonly validateTrigger$ = new Subject<void>();
  private validateDebounce: any;

  // Deletion warning alert modal state
  deletionAlertVisible = false;

  // Subject that drives debounced/cancelled SQL validation
  constructor(
    public svc: DashboardService,
    public auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    public entitlementService: EntitlementService,
    private exportSvc: ExportService,
    private importSvc: ImportService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {
    effect(() => {
      // Access diagramId and diagramNameSignal to register dependencies
      this.svc.diagramId();
      this.svc.diagramNameSignal();

      const nameEl = this._diagramNameEl?.nativeElement ?? document.querySelector('.diagram-name') as HTMLDivElement;
      if (nameEl && document.activeElement !== nameEl) {
        nameEl.innerText = this.svc.diagramName;
      }
    });
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }

  get currentDiagramId(): number | string {
    return this.getNormalizedDiagramId();
  }

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  get isUpgradeDisabled(): boolean {
    if (this.auth.isSuperAdmin()) {
      return true;
    }

    // Check current workspace entitlements first (works for both personal and orgs)
    const ent = this.entitlementService.getEntitlement('create_diagrams');
    if (ent) {
      const limit = ent.effective_limit ?? (ent as any).limit_value;
      if (limit === -1) {
        return true; // Unlimited diagrams means it's a premium/upgraded plan
      }
      if (limit !== undefined && limit !== null && limit !== -1) {
        return false; // Has a limit, so it's a free plan
      }
    }

    // Fallback to local storage for personal plan
    const currentPlan = this.auth.getCurrentPlanSlug();
    return !!(currentPlan && currentPlan !== 'free');
  }

  goToLogin(): void {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      if (this.svc.code.trim()) {
        localStorage.setItem('pending_save_after_login', 'true');
      }
    }
    this.router.navigate(['/login']);
  }

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.entitlementService.loadEntitlements().subscribe();
    }
    this.entitlementService.entitlements$.subscribe(() => {
      this.cdr.detectChanges();
    });
    this.svc.showUpgradeModal$.subscribe((featureKey: string) => {
      this.upgradeFeatureKey = featureKey || '';
      this.upgradeModalOpen = true;
      this.cdr.detectChanges();
    });
  }


  private getNormalizedDiagramId(): number | string {
    const id = this.svc.diagramId();
    const name = this.svc.diagramName;
    if (!id || !name || !name.trim()) {
      return '';
    }
    const exists = this.svc.diagrams().some(d => d.id === id && d.name && d.name.trim());
    if (!exists) {
      return '';
    }
    return id;
  }



  runWithUnsavedChangesCheck(action: () => void, cancelAction?: () => void): void {
    this.svc.askForConfirmation(action, cancelAction);
  }

  hasEffectiveEditPermission(): boolean {
    if (!this.isLoggedIn) return false;
    
    if (this.auth.hasDiagramEditPermission()) {
      return true;
    }

    const activeWsId = this.svc.activeWorkspaceId();
    if (activeWsId) {
      const ws = this.svc.workspaces().find(w => w.id === activeWsId);
      if (ws) {
        const perm = (ws.permission || '').toLowerCase();
        if (perm === 'owner' || perm === 'editor' || perm.includes('edit')) {
          return true;
        }
      }
    }
    
    return false;
  }

  createDiagram(): void {
    if (!this.entitlementService.canUseFeature('create_diagrams')) {
      this.svc.showUpgradeModal('create_diagrams');
      return;
    }

    if (!this.isLoggedIn) {
      this.svc.authModalVisible.set(true);
      return;
    }
    this.runWithUnsavedChangesCheck(() => {
      this.svc.requestSplitView();
      this.svc.createDiagram(this.svc.diagramName).subscribe({
        next: () => {
          this.svc.clearDiagram(true);
          this.svc.diagramName = '';
          const id = this.svc.diagramId();
          this.svc.showToast('Diagram created successfully.', 3000, 'success');
          // Reload entitlements to update usage count
          this.entitlementService.loadEntitlements(true).subscribe();
          if (id != null) {
            this.router.navigate([], {
              queryParams: { id: id, sample: null },
              queryParamsHandling: 'merge'
            });
          }
        },
        error: (err: any) => {
          console.error('Failed to create diagram:', err);
          if (err?.status === 403) {
            this.svc.showUpgradeModal('create_diagrams');
            return;
          }
          const msg = err?.error?.message || 'Failed to create diagram.';
          this.svc.showToast(msg, 3000, 'error');
        }
      });
    });
  }

  saveDiagram(): void {
    if (!this.isLoggedIn) {
      this.svc.authModalVisible.set(true);
      return;
    }
    if (!this.hasEffectiveEditPermission()) {
      this.svc.showToast('You do not have permission to save diagrams.', 3000, 'error');
      return;
    }
    if (!this.svc.validateDiagramName()) {
      return;
    }
    if (!this.svc.canSaveDiagram()) {
      return;
    }
    this.svc.saveDiagram().subscribe({
      next: (res: any) => {
        this.svc.showToast('Diagram saved.', 2000);
      },
      error: (err: any) => {
        this.svc.showToast(err.error.message || 'Failed to save diagram.', 4000, 'error');
      }
    });
  }

  selectDiagramById(id: number, onRevert?: () => void): void {
    if (!id) return;

    const selectedDiagram = this.svc.diagrams().find(d => d.id === id);
    if (selectedDiagram) {
      const nameLower = (selectedDiagram.name || '').trim().toLowerCase();
      if (nameLower === 'untitled' || nameLower === 'untitled diagram') {
        this.deletionAlertVisible = true;
      } else {
        this.deletionAlertVisible = false;
      }
    }

    this.runWithUnsavedChangesCheck(() => {
      this.svc.requestSplitView();
      this.svc.loadDiagram(id).subscribe({
        next: () => {
          this.router.navigate(['/dashboard'], {
            queryParams: { id: id, sample: null },
            queryParamsHandling: 'merge'
          });
        },
        error: (err: any) => console.error('Failed to load diagram:', err)
      });
    }, () => {
      if (onRevert) onRevert();
    });
  }

  closeDeletionAlert(): void {
    this.deletionAlertVisible = false;
  }

  private refreshDiagrams(): void {
    this.svc.fetchDiagrams().subscribe({
      error: (err: any) => {
        console.error('Failed to load diagrams:', err);
        this.svc.showToast('Failed to load diagrams.', 4000, 'error');
      }
    });
  }

  onDiagramNameInput(e: InputEvent): void {
    const el = e.target as HTMLDivElement;
    this.svc.diagramName = el.innerText.trim();
  }

  onDiagramNameBlur(e: FocusEvent): void {
    const el = e.target as HTMLDivElement;
    this.svc.diagramName = el.innerText.trim();
  }

  toggleDocs(): void {
    if (!this.isLoggedIn) {
      this.svc.authModalVisible.set(true);
      return;
    }
    if (!this.entitlementService.canUseFeature('document_view')) {
      this.svc.showUpgradeModal('document_view');
      return;
    }
    this.svc.showDocs = !this.svc.showDocs;
    if (this.svc.showDocs) {
      this.svc.requestSplitView();
    }
  }

  toggleVersionHistory(): void {
    if (!this.entitlementService.canUseFeature('version_history')) {
      this.svc.showUpgradeModal('version_history');
      return;
    }
    this.svc.showVersionHistory.set(!this.svc.showVersionHistory());
  }

  toggleDiagramViews(): void {
    if (!this.isLoggedIn) {
      this.svc.authModalVisible.set(true);
      return;
    }
    this.svc.toggleDiagramViews();
  }

  exportDBML(): void {
    if (!this.isLoggedIn) {
      this.svc.authModalVisible.set(true);
      return;
    }
    this.svc.exportDBML();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    if (this.exportMenuOpen && !target.closest('#export-dropdown')) {
      this.exportMenuOpen = false;
      this.cdr.markForCheck();
    }

    if (this.importMenuOpen && !target.closest('#import-dropdown')) {
      this.importMenuOpen = false;
      this.cdr.markForCheck();
    }

    if (!target.closest('.personal-dropdown-wrap')) {
      this.personalMenuOpen = false;
      this.showMyDiagramsSubmenu = false;
      this.showWorkspaceSubmenu = false;
      this.cdr.markForCheck();
    }

    if (!target.closest('.profile-dropdown-wrap')) {
      this.profileMenuOpen = false;
      this.cdr.markForCheck();
    }
  }

  // ============ EXPORT ============


  toggleExportMenu(): void {
    if (!this.isLoggedIn) {
      this.svc.authModalVisible.set(true);
      return;
    }
    this.exportMenuOpen = !this.exportMenuOpen;
    if (this.exportMenuOpen) {
      this.importMenuOpen = false;
      this.personalMenuOpen = false;
      this.profileMenuOpen = false;
      this.exportError = null;
      this.exporting = false;
    }
  }

  goToProfile(): void {
    this.router.navigate(['/profile']);
  }

  goToAdminDashboard(): void {
    if (this.auth.isSuperAdmin()) {
      this.router.navigate(['/admin']);
    } else if (this.auth.isOrganizationOwner() || this.auth.isOrganizationAdmin()) {
      this.router.navigate(['/organization']);
    }
  }

  /**
   * Exports the current diagram as SQL.
   * IMPORTANT: diagramId is a signal — it must be CALLED as diagramId(),
   * never interpolated directly, or the URL ends up as
   * ".../export/[Signal (diagramId): null]".
   */
  publishToDbdocs(): void {
    this.svc.showDbdocsInstructions = true;
    this.exportMenuOpen = false;
  }

  exportPDF(): void {
    if (!this.entitlementService.canUseFeature('export_image')) {
      this.svc.showUpgradeModal('export_image');
      return;
    }
    this.svc.triggerExport('pdf');
    this.exportMenuOpen = false;
  }

  exportPNG(): void {
    if (!this.entitlementService.canUseFeature('export_image')) {
      this.svc.showUpgradeModal('export_image');
      return;
    }
    this.svc.triggerExport('png');
    this.exportMenuOpen = false;
  }

  exportSVG(): void {
    if (!this.entitlementService.canUseFeature('export_image')) {
      this.svc.showUpgradeModal('export_image');
      return;
    }
    this.svc.triggerExport('svg');
    this.exportMenuOpen = false;
  }

  exportSQL(dialect: any): void {
    if (!this.entitlementService.canUseFeature('export_sql')) {
      this.svc.showUpgradeModal('export_sql');
      return;
    }
    const id = this.svc.diagramId() ?? 0;

    // Normalize 'mssql' (dashboard dialect) to 'sqlserver' (export service dialect)
    const exportDialect: any =
      dialect === 'mssql' ? 'sqlserver' : (dialect as any);

    this.exporting = true;
    this.exportError = null;

    this.exportSvc.convert(id, exportDialect, this.svc.code).pipe(
      finalize(() => {
        this.exporting = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (sql: string) => {
        this.exporting = false;
        this.exportSvc.downloadSqlFile(sql, exportDialect);
        this.exportMenuOpen = false;
        this.svc.showToast('SQL schema exported successfully.', 3000, 'success');
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        let errorMsg = 'Failed to export SQL. Please try again.';
        if (err?.error) {
          try {
            const parsed = typeof err.error === 'string' ? JSON.parse(err.error) : err.error;
            if (parsed && parsed.message) {
              errorMsg = parsed.message;
            }
          } catch (ex) {
            if (typeof err.error === 'string' && err.error.trim().length > 0) {
              errorMsg = err.error;
            }
          }
        } else if (err?.message) {
          errorMsg = err.message;
        }
        this.exportError = errorMsg;
        this.svc.showToast(errorMsg, 4000, 'error');
        this.cdr.markForCheck();
      }
    });
  }

  // ============ IMPORT ============

  toggleImportMenu(): void {
    if (!this.isLoggedIn) {
      this.svc.authModalVisible.set(true);
      return;
    }
    this.importMenuOpen = !this.importMenuOpen;
    if (this.importMenuOpen) {
      this.exportMenuOpen = false;
      this.importing = false;
      this.personalMenuOpen = false;
      this.profileMenuOpen = false;
    }
  }

  openImportModal(dialect: any): void {
    if (!this.entitlementService.canUseFeature('import_sql')) {
      this.svc.showUpgradeModal('import_sql');
      return;
    }
    this.importDialect = dialect;
    this.importModalOpen = true;
    this.importMenuOpen = false;
    this.resetImportState();
  }

  closeImportModal(): void {
    this.importModalOpen = false;
    this.resetImportState();
    this.cdr.markForCheck();
  }

  private resetImportState(): void {
    this.importSqlText = '';
    this.importing = false;
    this.importError = null;
    this.importValidating = false;
    this.importValidated = false;
    this.importValidationError = null;
    if (this.validateDebounce) {
      clearTimeout(this.validateDebounce);
    }
  }

  onSqlInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.importSqlText = target.value;
    this.importValidated = false;
    this.importValidationError = null;
    this.importError = null;

    if (this.validateDebounce) {
      clearTimeout(this.validateDebounce);
    }
    if (!this.importSqlText.trim()) {
      return;
    }

    this.validateDebounce = setTimeout(() => this.validateImportSql(), 500);
  }

  onSqlFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.zone.run(() => {
          const textarea = document.getElementById('import-sql-textarea') as HTMLTextAreaElement;
          if (textarea) {
            textarea.value = e.target.result;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
          }

          // Clear the input value so the same file can be uploaded again if needed
          input.value = '';
        });
      };
      reader.readAsText(file);
    }
  }

  private validateImportSql(): void {
    this.importValidating = true;
    this.cdr.detectChanges();

    this.importSvc.validate(this.importDialect!, this.importSqlText).pipe(
      finalize(() => {
        this.importValidating = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (text: string) => {
        try {
          const res = JSON.parse(text);
          const dbmlVal = res?.data?.dbml ?? res?.dbml;
          if (dbmlVal && dbmlVal.isValid === false) {
            this.importValidated = false;
            this.importValidationError =
              dbmlVal.errors?.[0] || 'This does not look like valid SQL for the selected dialect.';
          } else {
            this.importValidated = true;
            this.importValidationError = null;
          }
        } catch {
          this.importValidated = true;
          this.importValidationError = null;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.importValidated = false;
        let errorMessage = 'This does not look like valid SQL for the selected dialect.';
        if (err?.error) {
          try {
            const parsed = JSON.parse(err.error);
            errorMessage = parsed?.message || errorMessage;
          } catch {
            errorMessage = err.error || errorMessage;
          }
        }
        this.importValidationError = errorMessage;
        this.cdr.detectChanges();
      }
    });
  }

  submitImport(): void {
    if (!this.importSqlText.trim() || this.importValidationError || this.importValidating) {
      return;
    }

    this.importing = true;
    this.importError = null;

    const performImport = (id: number) => {
      this.importSvc.convert(id, this.importDialect!, this.importSqlText).pipe(
        finalize(() => {
          this.importing = false;
          this.cdr.markForCheck();
        })
      ).subscribe({
        next: (text: string) => {
          let dbml = '';
          try {
            const response = JSON.parse(text);
            dbml = response?.data?.diagramdbml ?? response?.data?.dbml ?? response?.diagramdbml ?? response?.dbml ?? text;
          } catch {
            dbml = text;
          }

          if (!dbml || !dbml.trim()) {
            this.importError = 'Import succeeded but no DBML was returned.';
            this.cdr.markForCheck();
            return;
          }
          this.svc.forceSetCode(dbml);
          this.svc.showToast('SQL imported successfully.', 2500);
          this.closeImportModal();
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          console.error('Import failed:', err);
          let errorMessage = 'Failed to convert SQL. Please check the syntax.';
          if (err?.error) {
            try {
              const parsed = JSON.parse(err.error);
              errorMessage = parsed?.message || errorMessage;
            } catch {
              errorMessage = err.error || errorMessage;
            }
          }
          this.importError = errorMessage;
          this.svc.showToast(errorMessage, 4000, 'error');
          this.cdr.markForCheck();
        }
      });
    };

    const currentId = this.svc.diagramId();
    performImport(currentId || 0);
  }

  logout(): void {
    this.runWithUnsavedChangesCheck(() => {
      this.auth.logout();
      this.svc.clearDiagram(false);
      this.svc.showToast('Logged out successfully.', 2500, 'success');
      this.router.navigate(['/login']);
    });
  }

  togglePersonalMenu(e?: Event): void {
    if (!this.isLoggedIn) return;
    if (e) e.stopPropagation();
    this.personalMenuOpen = !this.personalMenuOpen;
    if (this.personalMenuOpen) {
      this.exportMenuOpen = false;
      this.importMenuOpen = false;
      this.showMyDiagramsSubmenu = false;
      this.showWorkspaceSubmenu = false;
      this.showSampleSubmenu = false;
      this.profileMenuOpen = false;
    }
  }

  openPersonalDropdown(e: Event): void {
    if (!this.isLoggedIn) return;
    e.stopPropagation();
    this.personalMenuOpen = !this.personalMenuOpen;
    if (this.personalMenuOpen) {
      this.exportMenuOpen = false;
      this.importMenuOpen = false;
      this.showMyDiagramsSubmenu = false;
      this.showWorkspaceSubmenu = false;
      this.showSampleSubmenu = false;
    }
  }

  openWorkspaceSubmenu(): void {
    this.showWorkspaceSubmenu = true;
  }

  closeWorkspaceSubmenu(): void {
    this.showWorkspaceSubmenu = false;
  }

  toggleWorkspaceSubmenu(e: Event): void {
    e.stopPropagation();
    this.showWorkspaceSubmenu = !this.showWorkspaceSubmenu;
    if (this.showWorkspaceSubmenu) {
      this.showMyDiagramsSubmenu = false;
      this.showSampleSubmenu = false;
    }
  }

  openMyDiagramsSubmenu(): void {
    this.showMyDiagramsSubmenu = true;
    this.svc.fetchDiagrams(undefined, true).subscribe();
  }

  closeMyDiagramsSubmenu(): void {
    this.showMyDiagramsSubmenu = false;
  }

  toggleMyDiagramsSubmenu(e: Event): void {
    e.stopPropagation();
    this.showMyDiagramsSubmenu = !this.showMyDiagramsSubmenu;
    if (this.showMyDiagramsSubmenu) {
      this.showWorkspaceSubmenu = false;
      this.showSampleSubmenu = false;
      this.svc.fetchDiagrams(undefined, true).subscribe();
    }
  }

  toggleSampleSubmenu(e: Event): void {
    e.stopPropagation();
    this.showSampleSubmenu = !this.showSampleSubmenu;
    if (this.showSampleSubmenu) {
      this.showWorkspaceSubmenu = false;
      this.showMyDiagramsSubmenu = false;
    }
  }

  closeSampleSubmenu(): void {
    this.showSampleSubmenu = false;
  }

  selectDiagramFromMenu(id: number): void {
    this.personalMenuOpen = false;
    this.showMyDiagramsSubmenu = false;
    this.selectDiagramById(id);
  }

  openWorkspaceModal(tab: 'my-diagrams' | 'shared' | 'create-workspace' | 'my-workspaces' | 'edit-workspace' | 'view-members' = 'my-diagrams'): void {
    if ((tab === 'create-workspace') && !this.entitlementService.canUseFeature('create_workspaces')) {
      this.svc.showUpgradeModal('create_workspaces');
      return;
    }
    this.workspaceModalTab = tab;
    this.workspaceModalOpen = true;
    this.personalMenuOpen = false;
    this.showMyDiagramsSubmenu = false;
    this.showWorkspaceSubmenu = false;
    this.showSampleSubmenu = false;
    this.profileMenuOpen = false;
  }

  openShareModal(): void {
    if (!this.isLoggedIn) {
      this.svc.showToast('Please sign in to share your diagrams', 3000, 'error');
      return;
    }
    if (!this.entitlementService.canUseFeature('share_diagram')) {
      this.svc.showUpgradeModal('share_diagram');
      return;
    }

    const name = (this.svc.diagramName || '').trim().toLowerCase();
    const isUnsaved = !this.svc.diagramId() || !name || name === 'untitled diagram' || name === 'untitled';

    this.svc.showDiscardButton.set(false); // Hide the Discard button when prompting before share

    // If the diagram is unsaved/sample, prompt to save it first
    if (isUnsaved) {
      this.svc.forceUnsavedChangesCheck(() => {
        this.shareModalOpen = true;
      });
      return;
    }

    this.runWithUnsavedChangesCheck(() => {
      this.shareModalOpen = true;
    });
  }

  openUpgradeModal(featureKey?: string): void {
    this.upgradeFeatureKey = featureKey || 'premium_plan';
    this.upgradeModalOpen = true;
  }

  toggleProfileMenu(e?: Event): void {
    if (e) e.stopPropagation();
    this.profileMenuOpen = !this.profileMenuOpen;
    if (this.profileMenuOpen) {
      this.personalMenuOpen = false;
      this.exportMenuOpen = false;
      this.importMenuOpen = false;
      this.showMyDiagramsSubmenu = false;
      this.showWorkspaceSubmenu = false;
      this.showSampleSubmenu = false;
    }
  }

  closeProfileMenu(): void {
    this.profileMenuOpen = false;
  }

  get userEmail(): string {
    return this.auth.getUserEmail();
  }

  get userName(): string {
    const email = this.userEmail || '';
    return email.split('@')[0];
  }

  get userProfilePicture(): string | null {
    return this.auth.getUserProfilePicture();
  }

  closePersonalMenu(): void {
    this.personalMenuOpen = false;
  }

  createSampleDiagram(type: 'normal' | 'group' = 'normal'): void {
    if (!this.isLoggedIn) {
      this.svc.authModalVisible.set(true);
      return;
    }
    if (type === 'group' && !this.entitlementService.canUseFeature('table_group')) {
      this.svc.showUpgradeModal('table_group');
      return;
    }
    this.runWithUnsavedChangesCheck(() => {
      this.deletionAlertVisible = false;
      this.svc.requestSplitView();
      this.svc.clearDiagram(true);
      this.svc.code = this.svc.getSampleCode(type);
      this.svc.diagramName = 'Sample Diagram';
      this.svc.diagramId.set(null);
      this.svc.parseAndLayout();
      this.svc.updateOriginalState();
      
      this.router.navigate([], {
        queryParams: { sample: 'true', id: null },
        queryParamsHandling: 'merge'
      });
    });
  }

}