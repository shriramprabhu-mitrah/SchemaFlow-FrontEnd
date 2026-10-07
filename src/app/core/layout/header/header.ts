import { ChangeDetectorRef, Component, HostListener, Input, OnInit, effect, NgZone, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { parseConnectionDetails } from '../../../dbconnect/connection-string.util';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule,FormsModule, ButtonComponent, Icons, WorkspaceModalComponent, ShareModalComponent, UpgradeModalComponent],
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
  isSampleUrl = false;

  isSampleDiagram(): boolean {
    return this.isSampleUrl || this.svc.diagramName === 'Sample Diagram';
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
  get shareModalOpen(): boolean {
    return this.svc.shareModalVisible();
  }
  set shareModalOpen(val: boolean) {
    if (val && this.svc.showVersionHistory()) {
      this.svc.closeVersionHistory$.next();
      this.svc.showVersionHistory.set(false);
    }
    this.svc.shareModalVisible.set(val);
  }
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



  // Connection String import modal state
  connStringModalOpen = false;
  connStringConnectMode: 'host' | 'url' = 'host';
  connStringDatabaseType: 'postgres' | 'mysql' | 'mariadb' | 'mssql' | 'sqlite' | 'oracle' = 'postgres';
  selectedSqliteFile: File | null = null;
  isSqliteDraggingOver = false;

  // Host mode fields
  connHost = 'localhost';
  connPort: number | null = 5432;
  connDatabase = '';
  connUsername = 'postgres';
  connPassword = '';
  connSchema = 'public';
  showConnPassword = false;

  // URL mode field
  connStringValue = '';

  connStringImporting = false;
  connStringError: string | null = null;

  // Deletion warning alert modal state


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
      // Access diagramId, diagramNameSignal, and editorErrors to register dependencies
      this.svc.diagramId();
      this.svc.diagramNameSignal();
      this.svc.editorErrors();

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

    if (this.auth.getCurrentPlanStatus() === 'expired') {
      return false;
    }

    // Check if the plan is explicitly free or trial
    const currentPlan = this.auth.getCurrentPlanSlug();
    if (currentPlan && currentPlan !== 'free') {
      return true; // Hide the upgrade button for premium users
    }

    // Fallback to entitlement check if plan slug is unknown
    const ent = this.entitlementService.getEntitlement('create_diagrams');
    if (ent) {
      const limit = ent.effective_limit ?? (ent as any).limit_value;
      if (limit === -1) {
        return true;
      }
    }

    return false;
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
    this.route.queryParams.subscribe(params => {
      this.isSampleUrl = params['sample'] === 'true';
      this.cdr.detectChanges();
    });
    this.entitlementService.entitlements$.subscribe(() => {
      this.cdr.detectChanges();
    });
    this.svc.showUpgradeModal$.subscribe((featureKey: string) => {
      this.upgradeFeatureKey = featureKey || '';
      this.upgradeModalOpen = true;
      this.cdr.detectChanges();
    });
    this.svc.openShareModal$.subscribe(() => {
      this.openShareModal();
      this.cdr.detectChanges();
    });
    this.svc.openImportModal$.subscribe((dialect: any) => {
      this.openImportModal(dialect);
      this.cdr.detectChanges();
    });
      this.svc.openConnectionStringModal$.subscribe(() => {
      this.openConnectionStringModal();
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

  isDiagramEmpty(): boolean {
    const code = this.svc.code;
    return !code || code.trim() === '' || this.svc.tables.length === 0;
  }

  hasEffectiveEditPermission(): boolean {
    if (!this.isLoggedIn) return false;
    if (this.svc.isReadOnly) return false;
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
    const isFreePlan = (this.auth.getCurrentPlanSlug() || 'free') === 'free';
    const diagramCount = this.svc.totalDiagrams() > 0 ? this.svc.totalDiagrams() : this.svc.diagrams().length;
    const isAtLimit = (isFreePlan && diagramCount >= 5) || !this.entitlementService.canUseFeature('create_diagrams');

    if (isAtLimit) {
      this.svc.showUpgradeModal('create_diagrams');
      return;
    }

    if (!this.isLoggedIn) {
      this.svc.authModalVisible.set(true);
      return;
    }
    this.runWithUnsavedChangesCheck(() => {
      this.svc.closeAiDiffReview(false);
      this.svc.requestSplitView();

      const isTeam = (this.svc.diagramWorkspaceType() || '').toLowerCase() === 'team';
      const activeWsId = isTeam ? this.svc.activeWorkspaceId() : null;
      const createReq$ = (isTeam && activeWsId)
        ? this.svc.createWorkspaceDiagram(activeWsId, '')
        : this.svc.createDiagram('');

      createReq$.subscribe({
        next: () => {
          this.svc.clearDiagram(true);
          if (isTeam && activeWsId) {
            this.svc.setActiveWorkspace(activeWsId, this.svc.activeWorkspaceName);
            this.svc.diagramWorkspaceType.set('Team');
          } else {
            this.svc.setActiveWorkspace(null);
            this.svc.diagramWorkspaceType.set('Personal');
          }
          this.svc.diagramName = 'Untitled Diagram';
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

  selectDiagramById(id: number, onRevert?: () => void): void {
    if (!id) return;



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



  private refreshDiagrams(): void {
    this.svc.fetchDiagrams().subscribe({
      error: (err: any) => {
        console.error('Failed to load diagrams:', err);
        this.svc.showToast('Failed to load diagrams.', 4000, 'error');
      }
    });
  }

  private diagramNameDebounce: any;

  private getDiagramNameFromEl(el: HTMLElement): string {
    if (!el) return '';
    return (el.textContent || '').replace(/[\u200B\u00A0\r\n\t]/g, ' ').trim();
  }

  onDiagramNameInput(e: Event): void {
    const el = e.target as HTMLDivElement;
    const name = this.getDiagramNameFromEl(el);
    this.svc.diagramName = name;
    this.svc.saveErrorOccurred = false;

    if (this.diagramNameDebounce) {
      clearTimeout(this.diagramNameDebounce);
      this.diagramNameDebounce = null;
    }

    if (name && name !== this.svc.originalDiagramName) {
      this.diagramNameDebounce = setTimeout(() => {
        if (
          this.svc.diagramName &&
          !this.svc.isDiagramNameEmpty() &&
          this.svc.canSaveDiagram(false) &&
          this.svc.validateDiagramName(false) &&
          !this.svc.saveErrorOccurred
        ) {
          if (this.svc.diagramWorkspaceType() === 'Team' && this.svc.socketService.isConnected) {
            this.svc.emitCollabChange();
          } else {
            this.svc.saveDiagram().subscribe({ error: () => { } });
          }
        }
      }, 1000);
    }
  }

  onDiagramNameFocus(e: FocusEvent): void {
    const el = e.target as HTMLDivElement;
    if (this.getDiagramNameFromEl(el) === 'Untitled Diagram') {
      setTimeout(() => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }, 0);
    }
  }

  onDiagramNameBlur(e: FocusEvent): void {
    if (this.diagramNameDebounce) {
      clearTimeout(this.diagramNameDebounce);
      this.diagramNameDebounce = null;
    }

    const el = e.target as HTMLDivElement;
    const name = this.getDiagramNameFromEl(el);
    this.svc.diagramName = name;
    if (!name) {
      el.textContent = '';
      return;
    }

    if (
      name !== this.svc.originalDiagramName &&
      this.svc.canSaveDiagram(false) &&
      this.svc.validateDiagramName(false) &&
      !this.svc.saveErrorOccurred
    ) {
      if (this.svc.diagramWorkspaceType() === 'Team' && this.svc.socketService.isConnected) {
        this.svc.emitCollabChange();
      } else {
        this.svc.saveDiagram().subscribe({
          error: () => { }
        });
      }
    }
  }

  onDiagramNameKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
  }

  onStatusIconClick(): void {
    if (this.svc.isDiagramNameEmpty() || this.svc.isDiagramNameDuplicate()) {
      return;
    }
    if (this.svc.hasDbmlError()) {
      const first = this.svc.editorErrors()[0];
      if (first) {
        this.svc.showToast(`Cannot save: ${first.message}`, 4000, 'error');
        return;
      }
      const valErrors = this.svc.getValidationErrors();
      if (valErrors.length > 0) {
        const msg = typeof valErrors[0] === 'string' ? valErrors[0] : valErrors[0]?.message ?? 'Invalid DBML syntax';
        this.svc.showToast(`Cannot save: ${msg}`, 4000, 'error');
        return;
      }
    }
    if (this.svc.hasUnsavedChanges() && this.svc.saveErrorOccurred) {
      const msg = typeof this.svc.dbmlValidationError === 'string' ? this.svc.dbmlValidationError : 'Save failed';
      this.svc.showToast(msg, 4000, 'error');
    }
  }

  toggleDocs(): void {
    if (!this.isLoggedIn) {
      this.svc.authModalVisible.set(true);
      return;
    }

    if (this.svc.showDocs) {
      this.svc.showDocs = false;
      return;
    }

    if (this.auth.isSuperAdmin()) {
      this.svc.showDocs = true;
      this.svc.requestSplitView();
      return;
    }

    const isPlanExpired = this.auth.getCurrentPlanStatus() === 'expired' ||
      (this.entitlementService.hasUsedTrial && (!this.auth.getCurrentPlanSlug() || this.auth.getCurrentPlanSlug() === 'free'));

    const canUse = this.entitlementService.canUseFeature('document_view');
    const ent = this.entitlementService.getEntitlement('document_view');
    const limit = ent?.effective_limit ?? ent?.limit_value;
    const isLimitReached = !canUse || (limit !== undefined && limit !== null && limit !== -1 && (
      limit === 0 ||
      (ent?.used !== undefined && ent.used >= limit) ||
      (ent?.remaining !== undefined && ent.remaining <= 0)
    ));

    if (isPlanExpired || isLimitReached || !this.entitlementService.orgHasFeature('document_view')) {
      this.svc.showToast('Docs view count is completed. To view docs, please buy docs or upgrade your plan.', 4000, 'error');
      this.svc.showUpgradeModal('document_view');
      return;
    }

    if (this.svc.isDocUnlocked()) {
      this.svc.showDocs = true;
      this.svc.requestSplitView();
    } else {
      this.svc.showDocs = false;
      this.svc.showDocsPlaceholder = true;
    }

    this.svc.showDocs = false;
    this.svc.showDocsPlaceholder = true;
  }

  toggleVersionHistory(): void {
    if (!this.entitlementService.canUseFeature('version_history')) {
      if (!this.entitlementService.orgHasFeature('version_history')) {
        this.svc.showUpgradeModal('version_history');
      }
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
    } else if (this.auth.isOrganizationAdmin()) {
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
      if (!this.entitlementService.orgHasFeature('export_image')) {
        this.svc.showUpgradeModal('export_image');
      }
      return;
    }
    this.svc.triggerExport('pdf');
    this.exportMenuOpen = false;
  }

  exportPNG(): void {
    if (!this.entitlementService.canUseFeature('export_image')) {
      if (!this.entitlementService.orgHasFeature('export_image')) {
        this.svc.showUpgradeModal('export_image');
      }
      return;
    }
    this.svc.triggerExport('png');
    this.exportMenuOpen = false;
  }

  exportSVG(): void {
    if (!this.entitlementService.canUseFeature('export_image')) {
      if (!this.entitlementService.orgHasFeature('export_image')) {
        this.svc.showUpgradeModal('export_image');
      }
      return;
    }
    this.svc.triggerExport('svg');
    this.exportMenuOpen = false;
  }

  exportSQL(dialect: any): void {
    if (!this.entitlementService.canUseFeature('export_sql')) {
      if (!this.entitlementService.orgHasFeature('export_sql')) {
        this.svc.showUpgradeModal('export_sql');
      }
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
      if (!this.entitlementService.orgHasFeature('import_sql')) {
        this.svc.showUpgradeModal('import_sql');
      }
      return;
    }
    this.importDialect = dialect;
    this.importModalOpen = true;
    this.importMenuOpen = false;
    this.resetImportState();
  }

openConnectionStringModal(): void {
    if (!this.entitlementService.canUseFeature('db_connect')) {
      if (!this.entitlementService.orgHasFeature('db_connect')) {
        this.svc.showUpgradeModal('db_connect');
      }
      return;
    }
    this.connStringModalOpen = true;
    this.importMenuOpen = false;
    this.connStringConnectMode = 'host';
    this.connStringDatabaseType = 'postgres';
    this.connHost = 'localhost';
    this.connPort = 5432;
    this.connDatabase = '';
    this.connUsername = 'postgres';
    this.connPassword = '';
    this.connSchema = 'public';
    this.showConnPassword = false;
    this.connStringValue = '';
    this.selectedSqliteFile = null;
    this.isSqliteDraggingOver = false;
    this.connStringImporting = false;
    this.connStringError = null;
    this.cdr.markForCheck();
  }

  closeConnectionStringModal(): void {
    this.connStringModalOpen = false;
    this.connStringValue = '';
    this.selectedSqliteFile = null;
    this.isSqliteDraggingOver = false;
    this.connStringImporting = false;
    this.connStringError = null;
    this.cdr.markForCheck();
  }

  onConnPasswordInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value.includes(' ')) {
      input.value = input.value.replace(/\s+/g, '');
      this.connPassword = input.value;
    }
  }

  syncFromConnectionString(): void {
    if (!this.connStringValue.trim()) {
      return;
    }
    const details = parseConnectionDetails(
      this.connStringValue,
      this.connStringDatabaseType
    );

    if (!details) return;

    this.connHost = details.host;
    this.connPort = details.port;
    this.connDatabase = details.database;
    this.connUsername = details.username;
    this.connPassword = details.password;
    this.connSchema = details.schema;
    this.connStringError = null;
    this.cdr.markForCheck();
  }

  onConnStringInput(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.connStringValue = input.value;
    this.syncFromConnectionString();
  }

  onConnectModeChange(mode?: 'host' | 'url'): void {
    if (mode) {
      this.connStringConnectMode = mode;
    }
    if (this.connStringConnectMode === 'url') {
      if (!this.connStringValue.trim()) {
        this.connStringValue = this.getGeneratedConnectionString();
      }
      this.syncFromConnectionString();
    }
    this.cdr.markForCheck();
  }

  onDatabaseTypeChange(event?: Event): void {
    const selectedType = (event?.target as HTMLSelectElement | null)?.value;
    if (selectedType) {
      this.connStringDatabaseType = selectedType as 'postgres' | 'mysql' | 'mariadb' | 'mssql' | 'sqlite' | 'oracle';
    }

    this.connStringError = null;
    if (this.connStringDatabaseType === 'sqlite') {
      this.selectedSqliteFile = null;
      this.isSqliteDraggingOver = false;
    } else if (this.connStringDatabaseType === 'postgres') {
      if (!this.connPort || this.connPort === 3306 || this.connPort === 1433 || this.connPort === 1521) this.connPort = 5432;
      if (!this.connUsername || this.connUsername === 'root' || this.connUsername === 'sa' || this.connUsername === 'system') this.connUsername = 'postgres';
      if (!this.connSchema) this.connSchema = 'public';
    } else if (this.connStringDatabaseType === 'mysql') {
      if (!this.connPort || this.connPort === 5432 || this.connPort === 1433 || this.connPort === 1521) this.connPort = 3306;
      if (!this.connUsername || this.connUsername === 'postgres' || this.connUsername === 'sa' || this.connUsername === 'system') this.connUsername = 'root';
    } else if (this.connStringDatabaseType === 'mariadb') {
      if (!this.connPort || this.connPort === 5432 || this.connPort === 1433 || this.connPort === 1521) this.connPort = 3306;
      if (!this.connUsername || this.connUsername === 'postgres' || this.connUsername === 'sa' || this.connUsername === 'system') this.connUsername = 'root';
      if (this.connSchema === 'public') this.connSchema = '';
    } else if (this.connStringDatabaseType === 'mssql') {
      if (!this.connPort || this.connPort === 5432 || this.connPort === 3306 || this.connPort === 1521) this.connPort = 1433;
      if (!this.connUsername || this.connUsername === 'postgres' || this.connUsername === 'root' || this.connUsername === 'system') this.connUsername = 'sa';
    } else if (this.connStringDatabaseType === 'oracle') {
      if (!this.connPort || this.connPort === 5432 || this.connPort === 3306 || this.connPort === 1433) this.connPort = 1521;
      if (!this.connUsername || this.connUsername === 'postgres' || this.connUsername === 'root' || this.connUsername === 'sa') this.connUsername = 'system';
    }
    if (this.connStringConnectMode === 'url' && this.connStringValue.trim()) {
      this.syncFromConnectionString();
    }
    this.cdr.markForCheck();
  }

  onSqliteFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.validateAndSetSqliteFile(input.files[0]);
      input.value = '';
    }
  }

  onSqliteDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isSqliteDraggingOver = true;
  }

  onSqliteDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isSqliteDraggingOver = false;
  }

  onSqliteDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isSqliteDraggingOver = false;
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.validateAndSetSqliteFile(event.dataTransfer.files[0]);
    }
  }

  validateAndSetSqliteFile(file: File): void {
    if (!file) return;
    const name = file.name.toLowerCase();
    const validExtensions = ['.db', '.sqlite', '.sqlite3', '.db3'];
    const isValid = validExtensions.some(ext => name.endsWith(ext));
    if (!isValid) {
      this.connStringError = 'Invalid file type. Only .db, .sqlite, .sqlite3, and .db3 files are supported.';
      this.selectedSqliteFile = null;
      this.cdr.markForCheck();
      return;
    }
    this.selectedSqliteFile = file;
    this.connStringError = null;
    this.cdr.markForCheck();
  }
  removeSqliteFile(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedSqliteFile = null;
    this.connStringError = null;
    this.cdr.markForCheck();
  }

  formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  getGeneratedConnectionString(): string {
    if (this.connStringConnectMode === 'url') {
      let raw = this.connStringValue.trim();
      if (raw.toLowerCase().startsWith('jdbc:') && this.connStringDatabaseType !== 'oracle') {
        raw = raw.substring(5);
      }
      return raw;
    }

    const host = this.connHost.trim() || 'localhost';
    const port = this.connPort || (this.connStringDatabaseType === 'postgres' ? 5432 : this.connStringDatabaseType === 'mysql' || this.connStringDatabaseType === 'mariadb' ? 3306 : this.connStringDatabaseType === 'oracle' ? 1521 : 1433);
    const db = this.connDatabase.trim();
    const user = this.connUsername.trim();
    const pass = this.connPassword;
    const schema = this.connSchema.trim() || 'public';

    if (this.connStringDatabaseType === 'mssql') {
      const authPart = user ? `User Id=${user};Password=${pass};` : '';
      return `Server=${host},${port};Database=${db};${authPart}Encrypt=false;TrustServerCertificate=true;`;
    }

    const userPass = user ? (pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : `${encodeURIComponent(user)}@`) : '';

    if (this.connStringDatabaseType === 'oracle') {
      const credentials = user ? `${encodeURIComponent(user)}/${encodeURIComponent(pass)}@` : '';
      return `jdbc:oracle:thin:${credentials}//${host}:${port}/${db}`;
    }

    if (this.connStringDatabaseType === 'postgres') {
      return `postgresql://${userPass}${host}:${port}/${db}${schema ? `?schemas=${schema}` : ''}`;
    } else if (this.connStringDatabaseType === 'mysql') {
      return `mysql://${userPass}${host}:${port}/${db}`;
    } else if (this.connStringDatabaseType === 'mariadb') {
      const schemaQuery = this.connSchema.trim() ? `?schema=${encodeURIComponent(this.connSchema.trim())}` : '';
      return `mariadb://${userPass}${host}:${port}/${db}${schemaQuery}`;
    }

    return `postgresql://${userPass}${host}:${port}/${db}`;
  }

  isConnStringSubmitDisabled(): boolean {
    if (this.connStringImporting) return true;
    if (this.connStringDatabaseType === 'sqlite') {
      return !this.selectedSqliteFile;
    }
    if (this.connStringConnectMode === 'host') {
      return !this.connHost.trim()
        || !this.connDatabase.trim()
        || (!this.connUsername.trim() || !this.connPassword.trim());
    }
    return !this.connStringValue.trim() || !this.connDatabase.trim();
  }

  submitConnectionStringImport(): void {
    if (this.isConnStringSubmitDisabled()) {
      return;
    }

    if (this.connStringDatabaseType === 'sqlite') {
      if (!this.selectedSqliteFile) {
        this.connStringError = 'Please upload a valid SQLite database file (.db, .sqlite, .sqlite3 and .db3).';
        return;
      }

      this.connStringImporting = true;
      this.connStringError = null;

      this.importSvc.generateFromSqlite(this.selectedSqliteFile).pipe(
        finalize(() => {
          this.connStringImporting = false;
          this.cdr.markForCheck();
        })
      ).subscribe({
        next: (response: any) => {
          let dbml = '';
          try {
            const parsed = typeof response === 'string' ? JSON.parse(response) : response;
            dbml = parsed?.data?.diagramdbml ?? parsed?.data?.dbml ?? parsed?.diagramdbml ?? parsed?.dbml ?? parsed?.result ?? parsed?.code ?? (typeof parsed === 'string' ? parsed : JSON.stringify(parsed));
          } catch {
            dbml = response;
          }

          if (!dbml || !dbml.trim()) {
            this.connStringError = 'Import succeeded but no DBML was returned.';
            this.cdr.markForCheck();
            return;
          }
          this.svc.forceSetCode(dbml);
          this.svc.showToast('Schema generated and imported successfully.', 2500, 'success');
          this.closeConnectionStringModal();
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          console.error('SQLite import failed:', err);
          let errorMessage = 'Failed to generate DBML from SQLite file.';

          if (err?.error) {
            try {
              const parsed = typeof err.error === 'string' ? JSON.parse(err.error) : err.error;
              if (parsed?.message) {
                errorMessage = Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message;
              } else if (parsed?.error) {
                errorMessage = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
              }
            } catch {
              if (typeof err.error === 'string' && err.error.trim()) {
                errorMessage = err.error.length > 250 ? err.error.substring(0, 250) + '...' : err.error;
              }
            }
          } else if (err?.message) {
            errorMessage = err.message;
          }

          this.connStringError = errorMessage;
          this.cdr.markForCheck();
        }
      });
      return;
    }

    const finalConnString = this.getGeneratedConnectionString();
    if (!finalConnString || !finalConnString.trim()) {
      this.connStringError = 'Please specify valid connection parameters.';
      return;
    }

    this.connStringImporting = true;
    this.connStringError = null;

    this.importSvc.generateFromConnectionString(this.connStringDatabaseType, finalConnString).pipe(
      finalize(() => {
        this.connStringImporting = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (response: any) => {
        let dbml = '';
        try {
          const parsed = typeof response === 'string' ? JSON.parse(response) : response;
          dbml = parsed?.data?.diagramdbml ?? parsed?.data?.dbml ?? parsed?.diagramdbml ?? parsed?.dbml ?? parsed?.result ?? parsed?.code ?? (typeof parsed === 'string' ? parsed : JSON.stringify(parsed));
        } catch {
          dbml = response;
        }

        if (!dbml || !dbml.trim()) {
          this.connStringError = 'Import succeeded but no DBML was returned.';
          this.cdr.markForCheck();
          return;
        }
        this.svc.forceSetCode(dbml);
        this.svc.showToast('Schema generated and imported successfully.', 2500, 'success');
        this.closeConnectionStringModal();
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        console.error('Connection string import failed:', err);
        let errorMessage = 'Failed to generate DBML from connection string.';

        if (err?.error) {
          try {
            const parsed = typeof err.error === 'string' ? JSON.parse(err.error) : err.error;
            if (parsed?.message) {
              errorMessage = Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message;
            } else if (parsed?.error) {
              errorMessage = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
            }
          } catch {
            if (typeof err.error === 'string' && err.error.trim()) {
              errorMessage = err.error.length > 250 ? err.error.substring(0, 250) + '...' : err.error;
            }
          }
        } else if (err?.message) {
          errorMessage = err.message;
        }

        if (errorMessage.toLowerCase().includes('authentication failed') || errorMessage.toLowerCase().includes('password authentication failed')) {
          errorMessage = 'Database Authentication Failed: Incorrect database username or password in connection string.';
        } else if (err?.status === 503) {
          errorMessage = 'Service Unavailable (503): Backend failed to reach the target database. Check host and port.';
        }

        this.connStringError = errorMessage;
        this.cdr.markForCheck();
      }
    });
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
              dbmlVal.errors?.[0] || 'This does not look like valid schema syntax for the selected dialect.';
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
        let errorMessage = 'This does not look like valid schema syntax for the selected dialect.';
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
          this.svc.showToast('Schema imported successfully.', 2500, 'success');
          this.closeImportModal();
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          console.error('Import failed:', err);
          let errorMessage = 'Failed to convert schema. Please check the syntax.';
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
    
    this.showMyDiagramsSubmenu = !this.showMyDiagramsSubmenu;
    if (this.showMyDiagramsSubmenu) {
      this.showWorkspaceSubmenu = false;
      this.showSampleSubmenu = false;
      this.svc.fetchDiagrams(undefined, true).subscribe();
    }
  }

  toggleSampleSubmenu(e: Event): void {
    
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
    if (tab === 'create-workspace' && (this.entitlementService.isMember() || !this.entitlementService.canUseFeature('create_workspaces'))) {
      this.svc.showUpgradeModal('create_workspaces');
      return;
    }
    if (tab === 'my-workspaces' && !this.entitlementService.isMember() && !this.entitlementService.canUseFeature('create_workspaces')) {
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
    if (this.svc.showVersionHistory()) {
      this.svc.closeVersionHistory$.next();
      this.svc.showVersionHistory.set(false);
    }
    if (!this.isLoggedIn) {
      this.svc.showToast('Please sign in to share your diagrams', 3000, 'error');
      return;
    }
    if (this.svc.editorErrors().length > 0 || this.svc.getValidationErrors().length > 0 || this.svc.dbmlValidationError != null) {
      this.svc.showToast('Cannot share diagram with syntax errors. Please fix errors first.', 3000, 'error');
      return;
    }
    if (!this.svc.code || this.svc.code.trim() === '' || this.svc.tables.length === 0) {
      this.svc.showToast('Diagram is empty. Nothing to share.', 3000, 'error');
      return;
    }
    if (!this.entitlementService.canUseFeature('share_diagram')) {
      if (!this.entitlementService.orgHasFeature('share_diagram')) {
        this.svc.showUpgradeModal('share_diagram');
      }
      return;
    }

    // Existing diagram: auto-save in background if there are unsaved edits, and open share modal immediately
    if (this.svc.diagramId() != null) {
      if (this.svc.hasUnsavedChanges() && this.svc.canSaveDiagram(false)) {
        this.svc.saveDiagram().subscribe({
          error: (err) => console.warn('Auto-save before share failed:', err)
        });
      }
      this.shareModalOpen = true;
      this.cdr.detectChanges();
      return;
    }

    // Unsaved diagram: save it first so backend generates ID & publicToken, then open modal
    const currentName = (this.svc.diagramName || '').trim();
    if (!currentName) {
      this.svc.diagramName = 'Untitled Diagram';
    }

    if (!this.svc.canSaveDiagram(true)) {
      return;
    }

    this.svc.saveDiagram().subscribe({
      next: () => {
        this.shareModalOpen = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (err?.status === 403) {
          this.svc.showUpgradeModal('create_diagrams');
        } else {
          this.svc.showToast('Failed to save diagram before sharing.', 3000, 'error');
        }
      }
    });
  }

  openUpgradeModal(featureKey?: string): void {
    this.upgradeFeatureKey = featureKey || 'premium_plan';
    this.upgradeModalOpen = true;
  }

  toggleProfileMenu(e?: Event): void {
    
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

      this.svc.closeAiDiffReview(false);
      this.svc.requestSplitView();
      this.svc.clearDiagram(true);
      this.svc.code = this.svc.getSampleCode(type);
      this.svc.diagramName = 'Sample Diagram';
      this.svc.diagramId.set(null);
      this.svc.parseAndLayout();
      this.svc.updateOriginalState();

      this.router.navigate([], {
        queryParams: { sample: type, id: null },
        queryParamsHandling: 'merge'
      });
    });
  }

}