import { Component, OnInit, OnDestroy, HostBinding, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DashboardService } from '../../core/services/dashboard.service';
import { CanvasComponent } from '../dashboard/components/canvas/canvas';
import { LoaderComponent } from '../../shared/loader/loader';

@Component({
  selector: 'app-public-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, CanvasComponent, LoaderComponent],
  templateUrl: './public-viewer.html'
})
export class PublicViewerComponent implements OnInit, OnDestroy {
  loading = true;
  error: string | null = null;
  needsPassword = false;
  password = '';
  unlocking = false;
  token = '';
  showPassword = false;
  diagramName = 'Public Diagram';
  hasCustomDetailLevel = false;
  hasCustomLinkType = false;

  @HostBinding('class') get themeClass() {
    return this.svc.theme();
  }

  constructor(
    private route: ActivatedRoute,
    public svc: DashboardService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.svc.isReadOnly = true;
    this.svc.isPublicViewer = true;
    this.svc.paneMode.set('canvas'); // Only show canvas
    this.token = this.route.snapshot.paramMap.get('token') || '';
    
    // Check for embed configuration in query params
    const queryTheme = this.route.snapshot.queryParamMap.get('theme');
    if (queryTheme === 'dark' || queryTheme === 'light') {
      this.svc.theme.set(queryTheme);
      this.svc.applyTheme(queryTheme);
    }
    
    const highlight = this.route.snapshot.queryParamMap.get('highlight');
    if (highlight === 'true') {
      this.svc.showAllConnections = true;
    }
    
    const detailLevel = this.route.snapshot.queryParamMap.get('detailLevel');
    if (detailLevel) {
      this.hasCustomDetailLevel = true;
      if (detailLevel === 'all') {
        this.svc.isAllFields = true;
        this.svc.isKeyOnly = false;
        this.svc.isColumnNameOnly = false;
      } else if (detailLevel === 'key') {
        this.svc.isAllFields = false;
        this.svc.isKeyOnly = true;
        this.svc.isColumnNameOnly = false;
      } else if (detailLevel === 'table') {
        this.svc.isAllFields = false;
        this.svc.isKeyOnly = false;
        this.svc.isColumnNameOnly = true;
      }
    }

    const linkType = this.route.snapshot.queryParamMap.get('linkType');
    if (linkType) {
      this.hasCustomLinkType = true;
      if (linkType === 'smooth') {
        this.svc.isSmoothLine = true;
        this.svc.isStraightLine = false;
      } else if (linkType === 'straight') {
        this.svc.isSmoothLine = false;
        this.svc.isStraightLine = true;
      }
    }

    
    if (this.token) {
      this.loadDiagram();
    } else {
      this.error = 'Invalid or missing token.';
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    this.svc.isReadOnly = false;
    this.svc.isPublicViewer = false;
    // Reset service state if leaving
    this.svc.paneMode.set('split');
  }

  loadDiagram(): void {
    this.loading = true;
    this.error = null;
    this.svc.getPublicDiagram(this.token).subscribe({
      next: (res) => {
        this.processDiagramData(res?.data ?? res);
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 401) {
          this.needsPassword = true;
        } else {
          this.error = err?.error?.message || 'Failed to load the diagram. It might have been deleted or is unavailable.';
        }
        this.cdr.detectChanges();
      }
    });
  }

  unlock(): void {
    if (!this.password) return;
    this.unlocking = true;
    this.error = null;

    this.svc.unlockProtectedDiagram(this.token, this.password).subscribe({
      next: (res) => {
        this.unlocking = false;
        this.needsPassword = false;
        this.processDiagramData(res?.data ?? res);
      },
      error: (err) => {
        this.unlocking = false;
        if (err.status === 401) {
          this.error = 'Incorrect password.';
        } else {
          this.error = 'An error occurred while trying to unlock the diagram.';
        }
        this.cdr.detectChanges();
      }
    });
  }

  private processDiagramData(data: any): void {
    if (!data) {
      this.error = 'No data received from the server.';
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    this.diagramName = data.name || 'Untitled Diagram';
    this.svc.diagramName = this.diagramName;
    
    let rawCode = data.diagramDbml || data.diagram_dbml || data.diagramdbml || data.diagramdbnl || data.dbml || data.code || '';
    if (!rawCode) {
      for (const key of Object.keys(data)) {
        if (typeof data[key] === 'string' && data[key].includes('Table ')) {
          rawCode = data[key];
          break;
        }
      }
    }

    if (rawCode) {
      if (data.layout) {
        const layout = typeof data.layout === 'string' ? JSON.parse(data.layout) : data.layout;
        
        if (layout?.tables) {
          layout.tables.forEach((table: any) => {
            if (!table?.name) return;
            this.svc.tablePositions[table.name] = {
              x: Number(table.posx ?? table.x ?? 0),
              y: Number(table.posy ?? table.y ?? 0)
            };
            if (table.color && table.color !== '#3ec5c1') {
              this.svc.tableColorsMap[table.name] = table.color;
            }
          });
        }
        if (layout?.relations) {
          layout.relations.forEach((relation: any) => {
            if (relation?.from && relation?.to && relation?.color && relation.color !== '#3ec5c1') {
              this.svc.refColors[`${relation.from}>${relation.to}`] = relation.color;
            }
          });
        }

        if (layout?.tableGroup) {
          layout.tableGroup.forEach((group: any) => {
            if (group?.name && group?.color) {
              this.svc.groupColors[group.name] = group.color;
            }
            if (group?.name != null && group?.id != null) {
              this.svc.groupIds[group.name] = group.id;
            }
          });
        }

        const diagProps = Array.isArray(layout?.diagramProperties)
          ? layout?.diagramProperties[0]
          : layout?.diagramProperties;
        if (diagProps) {
          if (diagProps.zoomLevel != null) {
            // We intentionally ignore the saved zoomLevel for public viewer
            // so that the canvas can automatically calculate the best fitScale
            // for the user's screen or iframe dimensions.
          }
          if (diagProps.isGridView != null) {
            this.svc.gridOn = !!diagProps.isGridView;
          }
          if (!this.hasCustomDetailLevel) {
            this.svc.isAllFields = diagProps.isAllFields !== undefined ? !!diagProps.isAllFields : (data?.isAllFields !== undefined ? !!data.isAllFields : true);
            this.svc.isKeyOnly = diagProps.isKeyOnly !== undefined ? !!diagProps.isKeyOnly : (data?.isKeyOnly !== undefined ? !!data.isKeyOnly : false);
            this.svc.isColumnNameOnly = diagProps.isColumnNameOnly !== undefined ? !!diagProps.isColumnNameOnly : (data?.isColumnNameOnly !== undefined ? !!data.isColumnNameOnly : false);
          }
          if (!this.hasCustomLinkType) {
            this.svc.isStraightLine = diagProps.isStraightLine !== undefined ? !!diagProps.isStraightLine : (data?.isStraightLine !== undefined ? !!data.isStraightLine : false);
            this.svc.isSmoothLine = diagProps.isSmoothLine !== undefined ? !!diagProps.isSmoothLine : (data?.isSmoothLine !== undefined ? !!data.isSmoothLine : true);
          }
        } else {
          if (!this.hasCustomDetailLevel) {
            this.svc.isAllFields = data?.isAllFields !== undefined ? !!data.isAllFields : true;
            this.svc.isKeyOnly = data?.isKeyOnly !== undefined ? !!data.isKeyOnly : false;
            this.svc.isColumnNameOnly = data?.isColumnNameOnly !== undefined ? !!data.isColumnNameOnly : false;
          }
          if (!this.hasCustomLinkType) {
            this.svc.isStraightLine = data?.isStraightLine !== undefined ? !!data.isStraightLine : false;
            this.svc.isSmoothLine = data?.isSmoothLine !== undefined ? !!data.isSmoothLine : true;
          }
        }

        const rawNotes = layout?.diagramNotes;
        if (Array.isArray(rawNotes)) {
          this.svc.notes = rawNotes.map((n: any, i: number) => ({
            id: n.id ?? Date.now() + i,
            name: n.name ?? n.Notes_name ?? `note_${i + 1}`,
            text: n.text ?? '',
            posx: Number(n.posx ?? 0),
            posy: Number(n.posy ?? 0),
            width: Number(n.width ?? 180),
            height: Number(n.height ?? 180),
            color: n.color ?? '#FFE28B',
            textColor: n.textColor ?? '#000000',
            isNew: n.id == null
          }));
        } else {
          this.svc.notes = [];
        }
        try {
          this.svc.forceSetCode(rawCode);
        } catch (e) {
          console.error('Failed to parse DBML layout:', e);
        }
        
        this.svc.requestCanvasFit();
        this.svc.scheduleDraw();
      }
      this.loading = false;
      this.cdr.detectChanges();
    } else {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
}
