import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnInit,
  OnDestroy,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { finalize, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { DashboardService } from '../../../../core/services/dashboard.service';
import { AuthService } from '../../../../core/services/auth.service';
import { EntitlementService } from '../../../../core/services/entitlement.service';
import { ExportService, SqlDialect } from '../../../../core/services/export.service';
import { Icons } from '../../../../core/component/icons/icons';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, Icons],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent implements OnInit, OnDestroy {
  importMenuOpen = false;
  exportMenuOpen = false;
  exporting = false;
  importing = false;
  exportError: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    public svc: DashboardService,
    public auth: AuthService,
    public entitlementService: EntitlementService,
    private exportSvc: ExportService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    effect(() => {
      // Track editor errors and validation errors to keep sidebar states reactive
      this.svc.editorErrors();

      // Automatically close inspectors or menus if diagram is in read-only / can-view mode
      if (this.isCanViewOnly) {
        if (this.svc.sidebarInspectorTab() === 'tables') {
          this.svc.sidebarInspectorTab.set(null);
        }
        if (this.importMenuOpen) {
          this.importMenuOpen = false;
        }
        if (this.svc.showVersionHistory()) {
          this.svc.showVersionHistory.set(false);
        }
      }
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    this.entitlementService.entitlements$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.cdr.markForCheck();
      });
    this.entitlementService.orgEntitlements$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.cdr.markForCheck();
      });
    this.svc.redraw$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  get isCanViewOnly(): boolean {
    if (this.svc.isReadOnly) return true;
    const wsId = this.svc.activeWorkspaceId();
    if (wsId) {
      const ws = this.svc.workspaces().find(w => w.id === wsId);
      if (ws) {
        const perm = (ws.permission || (ws as any).role || '').toLowerCase();
        if (perm.includes('view') || perm === 'viewer') return true;
      }
    }
    return false;
  }

  isSampleDiagram(): boolean {
    return this.svc.diagramName === 'Sample Diagram';
  }

  isDiagramEmpty(): boolean {
    const code = this.svc.code;
    return !code || code.trim() === '' || this.svc.tables.length === 0;
  }

  hasFeatureAccess(featureKey: string): boolean {
    if (this.auth.isSuperAdmin()) return true;
    if (featureKey === 'code_compare' && !this.isLoggedIn) return true;
    return this.entitlementService.orgHasFeature(featureKey) || this.entitlementService.canUseFeature(featureKey);
  }

  showCrown(item: 'import' | 'export' | 'share' | 'versions' | 'tables' | 'refs' | 'compare'): boolean {
    if (!this.isLoggedIn || this.auth.isSuperAdmin() || this.isSampleDiagram()) return false;
    switch (item) {
      case 'import':
        return !this.hasFeatureAccess('import_sql');
      case 'export':
        return !this.hasFeatureAccess('export_image') || !this.hasFeatureAccess('export_sql');
      case 'share':
        return !this.hasFeatureAccess('share_diagram');
      case 'versions':
        return !this.hasFeatureAccess('version_history');
      case 'tables':
      case 'refs':
        return !this.hasFeatureAccess('document_view');
      case 'compare':
        return !this.hasFeatureAccess('code_compare');
      default:
        return false;
    }
  }

  // ============ IMPORT ============

  toggleImportMenu(e?: Event): void {
    if (e) e.stopPropagation();
    this.svc.closeErrorsCard();
    if (!this.isLoggedIn || this.isSampleDiagram()) {
      if (!this.isLoggedIn) this.svc.authModalVisible.set(true);
      return;
    }
    this.importMenuOpen = !this.importMenuOpen;
    if (this.importMenuOpen) {
      this.exportMenuOpen = false;
    }
    this.cdr.markForCheck();
  }

  openImportDialect(dialect: 'postgres' | 'mysql' | 'sqlserver' | 'sqlite', e?: Event): void {
    if (e) e.stopPropagation();
    this.svc.closeErrorsCard();
    this.importMenuOpen = false;
    if (!this.isLoggedIn || this.isSampleDiagram()) {
      if (!this.isLoggedIn) this.svc.authModalVisible.set(true);
      return;
    }
    if (!this.entitlementService.canUseFeature('import_sql')) {
      if (!this.entitlementService.orgHasFeature('import_sql')) {
        this.svc.showUpgradeModal('import_sql');
      }
      return;
    }
    this.svc.openImportModal(dialect);
    this.cdr.markForCheck();
  }

  openImportModal(dialect: 'postgres' | 'mysql' | 'sqlserver' | 'sqlite', e?: Event): void {
    this.openImportDialect(dialect, e);
  }

  hasDbmlErrors(): boolean {
    return this.svc.editorErrors().length > 0 || this.svc.getValidationErrors().length > 0 || this.svc.dbmlValidationError != null;
  }

  // ============ EXPORT ============

  toggleExportMenu(e?: Event): void {
    if (e) e.stopPropagation();
    this.svc.closeErrorsCard();
    if (!this.isLoggedIn || this.isSampleDiagram()) {
      if (!this.isLoggedIn) this.svc.authModalVisible.set(true);
      return;
    }
    this.exportMenuOpen = !this.exportMenuOpen;
    if (this.exportMenuOpen) {
      this.importMenuOpen = false;
      this.exportError = null;
      this.exporting = false;
    }
    this.cdr.markForCheck();
  }

  exportFormat(format: 'pdf' | 'png' | 'svg', e?: Event): void {
    if (e) e.stopPropagation();
    if (this.hasDbmlErrors()) {
      return;
    }
    this.exportMenuOpen = false;
    if (!this.isLoggedIn || this.isSampleDiagram()) {
      return;
    }
    if (this.isDiagramEmpty()) {
      this.svc.showToast('Diagram is empty. Nothing to export.', 3000, 'error');
      return;
    }
    if (!this.entitlementService.canUseFeature('export_image')) {
      if (!this.entitlementService.orgHasFeature('export_image')) {
        this.svc.showUpgradeModal('export_image');
      }
      return;
    }
    this.svc.triggerExport(format);
    this.cdr.markForCheck();
  }

  exportSQL(dialect: 'postgres' | 'mysql' | 'sqlserver' | 'sqlite', e?: Event): void {
    if (e) e.stopPropagation();
    if (this.hasDbmlErrors()) {
      return;
    }
    if (!this.isLoggedIn || this.isSampleDiagram()) {
      return;
    }
    if (this.isDiagramEmpty()) {
      this.svc.showToast('Diagram is empty. Nothing to export.', 3000, 'error');
      return;
    }
    if (!this.entitlementService.canUseFeature('export_sql')) {
      if (!this.entitlementService.orgHasFeature('export_sql')) {
        this.svc.showUpgradeModal('export_sql');
      }
      return;
    }

    const id = this.svc.diagramId() ?? 0;
    this.exporting = true;
    this.exportError = null;

    this.exportSvc.convert(id, dialect, this.svc.code).pipe(
      finalize(() => {
        this.exporting = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (sql: string) => {
        this.exporting = false;
        this.exportSvc.downloadSqlFile(sql, dialect);
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

  // ============ SHARE ============

  openShare(e?: Event): void {
    if (e) e.stopPropagation();
    this.svc.closeErrorsCard();
    if (!this.isLoggedIn || this.isSampleDiagram()) {
      if (!this.isLoggedIn) this.svc.authModalVisible.set(true);
      return;
    }
    if (this.hasDbmlErrors()) {
      this.svc.showToast('Cannot share diagram with syntax errors. Please fix errors first.', 3000, 'error');
      return;
    }
    if (this.isDiagramEmpty()) {
      this.svc.showToast('Diagram is empty. Nothing to share.', 3000, 'error');
      return;
    }
    this.importMenuOpen = false;
    this.exportMenuOpen = false;
    if (this.svc.showVersionHistory()) {
      this.svc.closeVersionHistory$.next();
      this.svc.showVersionHistory.set(false);
    }
    if (!this.entitlementService.canUseFeature('share_diagram')) {
      if (!this.entitlementService.orgHasFeature('share_diagram')) {
        this.svc.showUpgradeModal('share_diagram');
      }
      return;
    }
    this.svc.openShareModal();
    this.cdr.markForCheck();
  }

  // ============ VERSION HISTORY ============

  toggleVersionHistory(e?: Event): void {
    if (e) e.stopPropagation();
    this.svc.closeErrorsCard();
    this.importMenuOpen = false;
    this.exportMenuOpen = false;
    if (this.svc.shareModalVisible()) {
      this.svc.shareModalVisible.set(false);
    }
    if (this.svc.showDiffChecker()) {
      this.svc.closeDiffChecker();
    }
    if (!this.isLoggedIn || this.isSampleDiagram()) {
      if (!this.isLoggedIn) this.svc.authModalVisible.set(true);
      return;
    }
    if (!this.entitlementService.canUseFeature('version_history')) {
      if (!this.entitlementService.orgHasFeature('version_history')) {
        this.svc.showUpgradeModal('version_history');
      }
      return;
    }
    this.svc.showVersionHistory.set(!this.svc.showVersionHistory());
    this.cdr.markForCheck();
  }

  // ============ INSPECTOR (TABLES / REFS / DBML) ============

  toggleInspector(tab: 'tables' | 'refs', e?: Event): void {
    if (e) e.stopPropagation();
    this.svc.closeErrorsCard();
    this.importMenuOpen = false;
    this.exportMenuOpen = false;

    if (this.svc.showDiffChecker()) {
      this.svc.closeDiffChecker();
      const id = this.svc.diagramId();
      if (id) {
        this.router.navigate([], { queryParams: { id } });
      } else {
        this.router.navigate([]);
      }
    }

    if (!this.isLoggedIn || this.isSampleDiagram()) {
      if (!this.isLoggedIn) this.svc.authModalVisible.set(true);
      return;
    }

    if (!this.auth.isSuperAdmin()) {
      if (!this.hasFeatureAccess('document_view')) {
        this.svc.showUpgradeModal('document_view');
        return;
      }
    }

    if (this.svc.sidebarInspectorTab() === tab) {
      this.svc.sidebarInspectorTab.set(null);
    } else {
      this.svc.sidebarInspectorTab.set(tab);
    }

    if (this.svc.paneMode() === 'canvas') {
      this.svc.setPaneMode('split');
    }

    this.cdr.markForCheck();
  }

  showDbmlEditor(e?: Event): void {
    if (e) e.stopPropagation();
    this.importMenuOpen = false;
    this.exportMenuOpen = false;

    if (this.svc.showDiffChecker()) {
      this.svc.closeDiffChecker();
      const id = this.svc.diagramId();
      if (id) {
        this.router.navigate([], { queryParams: { id } });
      } else {
        this.router.navigate([]);
      }
    }

    this.svc.sidebarInspectorTab.set(null);

    if (this.svc.paneMode() === 'canvas') {
      this.svc.setPaneMode('split');
    }

    this.cdr.markForCheck();
  }

  // ============ DIFF CHECKER ============

  toggleDiffChecker(e?: Event): void {
    if (e) e.stopPropagation();
    this.importMenuOpen = false;
    this.exportMenuOpen = false;
    if (this.svc.shareModalVisible()) {
      this.svc.shareModalVisible.set(false);
    }
    if (this.isLoggedIn && !this.hasFeatureAccess('code_compare')) {
      this.svc.showUpgradeModal('code_compare');
      return;
    }
    this.svc.toggleDiffChecker();
    if (this.svc.showDiffChecker()) {
      this.router.navigate([], { queryParams: { view: 'diff' } });
    } else {
      const id = this.svc.diagramId();
      if (id) {
        this.router.navigate([], { queryParams: { id } });
      } else {
        this.router.navigate([]);
      }
    }
    this.cdr.markForCheck();
  }

  // ============ VIEW DOCS (Commented out as requested) ============
  /*
  toggleDocs(e?: Event): void {
    if (e) e.stopPropagation();
    this.importMenuOpen = false;
    this.exportMenuOpen = false;
    if (!this.isLoggedIn) {
      this.svc.authModalVisible.set(true);
      return;
    }
    if (this.isSampleDiagram()) {
      return;
    }
    if (!this.entitlementService.canUseFeature('document_view')) {
      if (!this.entitlementService.orgHasFeature('document_view')) {
        this.svc.showUpgradeModal('document_view');
      }
      return;
    }
    this.svc.showDocs = !this.svc.showDocs;
    if (this.svc.showDocs) {
      this.svc.requestSplitView();
    }
    this.cdr.markForCheck();
  }
  */

  // ============ AUTH / SIGNOUT ============

  handleSignOut(e?: Event): void {
    if (e) e.stopPropagation();
    this.importMenuOpen = false;
    this.exportMenuOpen = false;
    if (!this.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }
    this.svc.askForConfirmation(() => {
      this.auth.logout();
      this.svc.clearDiagram(false);
      this.svc.showToast('Logged out successfully.', 2500, 'success');
      this.router.navigate(['/login']);
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.activity-nav-item.import-item')) {
      this.importMenuOpen = false;
    }
    if (!target.closest('.activity-nav-item.export-item-wrap')) {
      this.exportMenuOpen = false;
    }
    this.cdr.markForCheck();
  }
}
