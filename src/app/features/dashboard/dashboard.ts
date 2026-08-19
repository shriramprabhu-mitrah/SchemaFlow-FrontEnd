import { Component, ElementRef, HostListener, ViewChild, OnInit, AfterViewInit, OnDestroy, PLATFORM_ID, Inject, ChangeDetectorRef } from '@angular/core';
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
    DocsComponent,
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
  private isInitialLoad = true;

  constructor(
    public svc: DashboardService,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.splitViewSubscription = this.svc.splitViewRequested$.subscribe(() => this.restoreSplitView());
  }

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
        const id = params['id'];
        const isSample = params['sample'] === 'true';

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
                    // Create a blank diagram
                    this.svc.createDiagram('').subscribe({
                      next: (newDiag: any) => {
                        this.svc.clearDiagram(true);
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
    this.splitViewSubscription.unsubscribe();
    if (this.queryParamsSubscription) {
      this.queryParamsSubscription.unsubscribe();
    }
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
}
