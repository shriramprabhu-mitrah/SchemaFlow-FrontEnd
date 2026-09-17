import { Component, ElementRef, HostListener, ViewChild, OnInit, AfterViewInit, OnDestroy, PLATFORM_ID, Inject, ChangeDetectorRef, effect } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../core/services/dashboard.service';
import { HeaderComponent } from '../../core/layout/header/header';
import { EditorComponent } from './components/editor/editor';
import { CanvasComponent } from './components/canvas/canvas';
import { DocsComponent } from './components/docs/docs';
import { ButtonComponent } from '../../shared/button/button';
import { LoaderComponent } from '../../shared/loader/loader';
import { DiagramViews } from '../dashboard/components/diagram-views/diagram-views';
import { EntitlementService } from '../../core/services/entitlement.service';
import { DiffCheckerComponent } from './components/diff-checker/diff-checker';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Subscription, Observable } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponent,
    EditorComponent,
    CanvasComponent,
    // DocsComponent, // Commented out as requested
    DiffCheckerComponent,
    ButtonComponent,
    LoaderComponent
  ],
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('bodyEl', { static: true }) bodyRef!: ElementRef<HTMLDivElement>;


  private resizing = false;
  get paneMode(): 'split' | 'editor' | 'canvas' {
    return this.svc.paneMode();
  }

  set paneMode(val: 'split' | 'editor' | 'canvas') {
    this.svc.setPaneMode(val);
  }

  showPaneMenu = false;
  private readonly splitViewSubscription: Subscription;
  private queryParamsSubscription!: Subscription;
  private trialExpiredSubscription!: Subscription;
  private socketConnectSubscription!: Subscription;
  private socketErrorSubscription!: Subscription;
  private isInitialLoad = true;

  constructor(
    public svc: DashboardService,
    private route: ActivatedRoute,
    private router: Router,
    public auth: AuthService,
    private readonly cdr: ChangeDetectorRef,
    public entitlementService: EntitlementService,
    private titleService: Title
  ) {
    this.splitViewSubscription = this.svc.splitViewRequested$.subscribe(() => this.restoreSplitView());

    effect(() => {
      if (this.svc.showDiffChecker()) {
        this.titleService.setTitle('Diff Checker - DBNexus');
        return;
      }
      const name = this.svc.diagramNameSignal()?.trim();
      if (name) {
        this.titleService.setTitle(`${name} - DBNexus`);
      } else {
        this.titleService.setTitle('Dashboard - DBNexus');
      }
    });
  }

  ngOnInit(): void {
    this.trialExpiredSubscription = this.svc.socketService.onTrialExpired().subscribe(() => {
        this.svc.isSubscriptionExpired.set(true);
        // Clear collaboration indicators immediately
        this.svc.activeRoomUsers.set([]);
        this.svc.remoteCursors.set({});
        this.entitlementService.loadEntitlements(true).subscribe(() => {
            this.cdr.detectChanges();
        });
        this.svc.socketService.disconnect();
    });
    this.socketConnectSubscription = this.svc.socketService.onConnect().subscribe(() => {
        const currentId = this.svc.diagramId();
        if (currentId) {
            this.svc.socketService.joinDiagram(currentId);
        }
    });
    this.socketErrorSubscription = this.svc.socketService.onError().subscribe((err) => {
        if (err?.message && (err.message.includes('session expired') || err.message.includes('not joined'))) {
            const currentId = this.svc.diagramId();
            if (currentId) {
                this.svc.socketService.joinDiagram(currentId);
            }
        }
    });
    if (typeof window !== 'undefined') {
      this.svc.syncThemeFromStorage();
      this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
        const id = params['id'];
        const isSample = params['sample'] === 'true';
        const isDiff = params['view'] === 'diff' || this.router.url.includes('/diff');

        if (isDiff) {
          this.svc.showDiffChecker.set(true);
        } else if (this.svc.showDiffChecker()) {
          this.svc.showDiffChecker.set(false);
        }

        if (isSample) {
          this.isInitialLoad = false;
          this.svc.clearDiagram(false);
          this.svc.code = this.svc.getSampleCode('normal');
          this.svc.diagramName = 'Sample Diagram';
          this.svc.showCanvasPlaceholder = false;
          this.svc.updateGutter();
          this.svc.parseAndLayout();
          this.svc.requestCanvasFit();
          this.svc.updateOriginalState();
        } else if (id && this.auth.isLoggedIn()) {
          const numId = Number(id);
          if (this.isInitialLoad || this.svc.diagramId() !== numId) {
            this.isInitialLoad = false;
            this.svc.loadDiagram(numId).subscribe({
              error: (err: any) => console.error('Failed to load diagram from url:', err)
            });
          }
        } else {
          if (this.isInitialLoad) {
            this.isInitialLoad = false;
            
            if (this.auth.isLoggedIn()) {
              const lastOpenedId = typeof localStorage !== 'undefined' ? localStorage.getItem('active_diagram_id') : null;
              if (lastOpenedId && !isNaN(Number(lastOpenedId)) && Number(lastOpenedId) !== 0) {
                // Navigate to last opened diagram
                this.router.navigate([], { queryParams: { id: lastOpenedId, sample: null }, queryParamsHandling: 'merge' });
              } else {
                // Logged in user: fetch recent diagrams
                this.svc.fetchDiagrams({ limit: 1, sortBy: 'updated_at', sortOrder: 'desc' }).subscribe({
                next: (res: any) => {
                  const diagrams = res.items || res.data || [];
                  if (diagrams && diagrams.length > 0) {
                    // Navigate to most recent diagram
                    this.router.navigate([], { queryParams: { id: diagrams[0].id, sample: null }, queryParamsHandling: 'merge' });
                  } else {
                    const isTeam = (this.svc.diagramWorkspaceType() || '').toLowerCase() === 'team';
                    const activeWsId = isTeam ? this.svc.activeWorkspaceId() : null;
                    const createReq$ = (isTeam && activeWsId)
                      ? this.svc.createWorkspaceDiagram(activeWsId, '')
                      : this.svc.createDiagram('');
                    createReq$.subscribe({
                      next: (newDiag: any) => {
                        this.svc.clearDiagram(true);
                        if (isTeam && activeWsId) {
                          this.svc.setActiveWorkspace(activeWsId, this.svc.activeWorkspaceName);
                          this.svc.diagramWorkspaceType.set('Team');
                        } else {
                          this.svc.setActiveWorkspace(null);
                          this.svc.diagramWorkspaceType.set('Personal');
                        }
                        this.svc.code = '';
                        this.svc.diagramName = 'Untitled Diagram';
                        this.svc.diagramId.set(newDiag.id || newDiag.diagram_id || newDiag.diagramid);
                        this.svc.updateOriginalState();
                        this.router.navigate([], { queryParams: { id: this.svc.diagramId(), sample: null }, queryParamsHandling: 'merge' });
                      },
                      error: (err: any) => {
                        console.error('Failed to create initial diagram:', err);
                        if (err?.status === 403) {
                          this.svc.showUpgradeModal('create_diagrams');
                        }
                      }
                    });
                  }
                },
                  error: (err: any) => console.error('Failed to fetch recent diagrams:', err)
                });
              }
            } else {
              // Not logged in: check local storage or load sample
              const draftIdStr = localStorage.getItem('active_diagram_id');
              if (draftIdStr && draftIdStr !== 'null') {
                this.svc.diagramId.set(Number(draftIdStr));
              } else {
                this.svc.diagramId.set(null);
              }
              this.svc.code = this.svc.getSampleCode(false);
              this.svc.diagramName = '';
              this.svc.tablePositions = {};
              this.svc.showCanvasPlaceholder = false;
              this.svc.updateGutter();
              this.svc.parseAndLayout();
              this.svc.requestCanvasFit();
              this.svc.updateOriginalState();
            }
          }
        }
      });
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.auth.isLoggedIn() && this.svc.hasUnsavedChanges()) {
      $event.preventDefault();
      $event.returnValue = '';
    }
  }

  canDeactivate(): Observable<boolean> | Promise<boolean> | boolean {
    if (!this.auth.isLoggedIn() || !this.svc.hasUnsavedChanges()) {
      return true;
    }
    return new Promise<boolean>((resolve) => {
      this.svc.askForConfirmation(
        () => resolve(true),
        () => resolve(false)
      );
    });
  }

  ngAfterViewInit(): void {
    this.svc.updateGutter();
    this.svc.parseAndLayout();
  }

  onResizerMouseDown(e: MouseEvent): void {
    this.resizing = true;
    e.preventDefault();
  }

  ngOnDestroy(): void {
    if (this.splitViewSubscription) this.splitViewSubscription.unsubscribe();
    if (this.queryParamsSubscription) this.queryParamsSubscription.unsubscribe();
    if (this.trialExpiredSubscription) this.trialExpiredSubscription.unsubscribe();
    if (this.socketConnectSubscription) this.socketConnectSubscription.unsubscribe();
    if (this.socketErrorSubscription) this.socketErrorSubscription.unsubscribe();
  }

  showEditorFullScreen(): void {
    this.showPaneMenu = false;
    this.paneMode = 'editor';
  }

  showCanvasFullScreen(): void {
    this.showPaneMenu = false;
    this.paneMode = 'canvas';
  }

  togglePaneMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showPaneMenu = !this.showPaneMenu;
  }

  restoreSplitView(): void {
    this.paneMode = 'split';
  }

  private resizingRafPending = false;

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(e: MouseEvent): void {
    if (this.resizing && this.bodyRef) {
      if (this.resizingRafPending) return;
      this.resizingRafPending = true;
      const clientX = e.clientX;
      requestAnimationFrame(() => {
        this.resizingRafPending = false;
        if (!this.resizing || !this.bodyRef) return;
        const bodyRect = this.bodyRef.nativeElement.getBoundingClientRect();
        const w = clientX - bodyRect.left;
        const pct = (w / bodyRect.width) * 100;

      if (this.paneMode !== 'split') {
        if (this.paneMode === 'canvas' && pct < 8) return;
        if (this.paneMode === 'editor' && pct > 92) return;
        this.paneMode = 'split';
      }

      if (pct >= 94) {
        this.paneMode = 'editor';
        this.resizing = false;
      } else if (pct <= 6) {
        this.paneMode = 'canvas';
        this.resizing = false;
      } else {
        this.svc.editorWidthPct.set(pct);
      }
      this.cdr.detectChanges();
       });
    }
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    this.resizing = false;
    this.resizingRafPending = false;
  }

  closeDbdocsInstructions(): void {
    this.svc.showDbdocsInstructions = false;
  }

  goToLogin(): void {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      if (this.svc.code.trim()) {
        localStorage.setItem('pending_save_after_login', 'true');
      }
    }
    this.svc.authModalVisible.set(false);
    this.router.navigate(['/login']);
  }

  openUpgradeModal(): void {
    this.svc.showUpgradeModal('trial_expired_banner');
  }
}
