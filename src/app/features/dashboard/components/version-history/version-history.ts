import { Component, OnInit, OnDestroy, ChangeDetectorRef, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../../../core/services/dashboard.service';
import { ButtonComponent } from '../../../../shared/button/button';

@Component({
  selector: 'app-version-history',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './version-history.html',
})
export class VersionHistoryComponent implements OnInit, OnDestroy {
  versions: any[] = [];
  selectedVersion: any = null;
  isLoading = false;
  error: string | null = null;
  showConfirmModal = false;

  private originalState: any = null;
  private revertSub?: any;
  private closeSub?: any;

  constructor(
    public svc: DashboardService,
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    const currentId = this.svc.diagramId();
    if (!currentId) {
      this.error = 'No active diagram loaded.';
      return;
    }

    this.revertSub = this.svc.revertRequested$.subscribe(() => this.confirmRestore());
    this.closeSub = this.svc.closeVersionHistory$.subscribe(() => this.close());

    // 1. Backup original state so we can cancel/preview cleanly
    this.originalState = {
      code: this.svc.code,
      diagramName: this.svc.diagramName,
      tablePositions: JSON.parse(JSON.stringify(this.svc.tablePositions || {})),
      refColors: JSON.parse(JSON.stringify(this.svc.refColors || {})),
      groupColors: JSON.parse(JSON.stringify(this.svc.groupColors || {})),
      groupIds: JSON.parse(JSON.stringify(this.svc.groupIds || {})),
      tableColorsMap: JSON.parse(JSON.stringify(this.svc.tableColorsMap || {})),
      view: { ...this.svc.view }
    };

    // 2. Fetch history from the API
    this.loadHistory(currentId);
  }

  ngOnDestroy(): void {
    if (this.revertSub) this.revertSub.unsubscribe();
    if (this.closeSub) this.closeSub.unsubscribe();
    this.svc.selectedVersion.set(null);
  }

  loadHistory(diagramId: number): void {
    this.isLoading = true;
    this.error = null;

    this.svc.getDiagramHistory(diagramId).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        // Parse list from various response wrappers
        const list = Array.isArray(response)
          ? response
          : response?.data?.history ?? response?.data ?? response?.history ?? response?.result ?? [];

        if (!Array.isArray(list)) {
          this.versions = [];
          this.cdr.detectChanges();
          return;
        }

        // Sort versions descending by creation date
        this.versions = list.map((v: any) => {
          const rawId = v.id ?? v.versionId ?? v.versionid ?? v.historyId ?? v.diagramid;
          const rawDate = v.created_at ?? v.createdAt ?? v.timestamp ?? v.updated_at ?? v.updatedat ?? v.createdat;
          return {
            ...v,
            parsedId: rawId,
            timestamp: rawDate ? new Date(rawDate) : null
          };
        }).sort((a: any, b: any) => {
          if (!a.timestamp) return 1;
          if (!b.timestamp) return -1;
          return b.timestamp.getTime() - a.timestamp.getTime();
        });
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isLoading = false;
        this.error = 'Failed to load version history.';
        console.error('Failed to load version history:', err);
        this.cdr.detectChanges();
      }
    });
  }

  selectVersion(version: any): void {
    this.selectedVersion = version;
    this.svc.selectedVersion.set(version);

    // Apply the version preview cleanly to editor and canvas
    this.svc.tablePositions = {};
    this.svc.refColors = {};
    this.svc.groupColors = {};
    this.svc.tableColorsMap = {};

    let layout = version.layout;
    if (typeof layout === 'string') {
      try {
        layout = JSON.parse(layout);
      } catch {
        layout = undefined;
      }
    }

    layout?.tables?.forEach((table: any) => {
      if (!table?.name) return;
      this.svc.tablePositions[table.name] = {
        x: Number(table.posx ?? table.x ?? 0),
        y: Number(table.posy ?? table.y ?? 0)
      };
      if (table.color && table.color !== '#3ec5c1') {
        this.svc.tableColorsMap[table.name] = table.color;
      }
    });
    layout?.relations?.forEach((relation: any) => {
      if (relation?.from && relation?.to && relation?.color && relation.color !== '#3ec5c1') {
        this.svc.refColors[`${relation.from}>${relation.to}`] = relation.color;
      }
    });
    layout?.tableGroup?.forEach((group: any) => {
      if (group?.name && group?.color) {
        this.svc.groupColors[group.name] = group.color;
      }
      if (group?.name != null && group?.id != null) {
        this.svc.groupIds[group.name] = group.id;
      }
    });

    const rawCode = version.diagramDbml ?? version.diagram_dbml ?? version.diagramdbml ?? version.dbml ?? version.code ?? '';
    this.svc.code = rawCode.replace(/(TableGroup\s+["']?[^"'\r\n]+["']?\s*)\[color:\s*[^\]]+\]\s*(\{)/gi, '$1$2');
    this.svc.showCanvasPlaceholder = !this.svc.code.trim();
    this.svc.updateGutter();
    this.svc.parseAndLayout();
    this.svc.requestCanvasFit();
  }

  close(): void {
    this.svc.selectedVersion.set(null);
    // Restore the live original diagram state on exit
    if (this.originalState) {
      this.svc.code = this.originalState.code;
      this.svc.diagramName = this.originalState.diagramName;
      this.svc.tablePositions = this.originalState.tablePositions;
      this.svc.refColors = this.originalState.refColors;
      this.svc.groupColors = this.originalState.groupColors;
      this.svc.groupIds = this.originalState.groupIds;
      this.svc.tableColorsMap = this.originalState.tableColorsMap;
      this.svc.view = this.originalState.view;
      this.svc.updateGutter();
      this.svc.parseAndLayout();
      this.svc.requestCanvasFit();
    }
    this.svc.showVersionHistory.set(false);
  }

  confirmRestore(): void {
    if (!this.selectedVersion) return;
    this.showConfirmModal = true;
  }

  restoreVersion(): void {
    const currentId = this.svc.diagramId();
    if (!currentId || !this.selectedVersion) return;

    this.svc.revertDiagram(currentId, this.selectedVersion.parsedId).subscribe({
      next: () => {
        this.showConfirmModal = false;
        this.svc.showToast('Diagram restored successfully.', 4000, 'success');
        this.cdr.detectChanges();
        // Reload the newly reverted diagram officially
        this.svc.loadDiagram(currentId).subscribe({
          next: () => {
            this.svc.showVersionHistory.set(false);
            this.cdr.detectChanges();
          },
          error: (err: any) => {
            this.cdr.detectChanges();
          }
        });
      },
      error: (err: any) => {
        console.error('Failed to restore version:', err);
        this.svc.showToast(err.error.message || 'Failed to restore version.', 4000, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  restoreFromRow(event: Event, version: any): void {
    event.stopPropagation(); // Prevent selectVersion preview trigger
    this.selectedVersion = version;
    this.svc.selectedVersion.set(version);
    this.showConfirmModal = true;
  }


  formatDate(dateStr: string | Date): string {
    if (!dateStr) return 'Unknown Date';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    const timeStr = date.toLocaleTimeString(undefined, timeOptions);

    if (isToday) {
      return `Today at ${timeStr}`;
    } else if (isYesterday) {
      return `Yesterday at ${timeStr}`;
    } else {
      const dateOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
      const dateValStr = date.toLocaleDateString(undefined, dateOptions);
      return `${dateValStr} at ${timeStr}`;
    }
  }

  getInitials(email: string): string {
    if (!email) return '?';
    return email.charAt(0).toUpperCase();
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
    // 1. If Version History is not open, do nothing
    if (!this.svc.showVersionHistory()) return;

    // 2. If click is inside this component, do nothing
    if (this.elementRef.nativeElement.contains(target)) return;

    // 3. If click is on the revert/restore confirmation modal, do nothing
    if (target.closest('.modal-backdrop') || target.closest('.modal-container')) return;

    // 4. If click is on the Version History toggle button in the header, do nothing
    const isHeaderToggleBtn = target.closest('app-button') && 
      (target.innerText?.includes('Version History') || target.textContent?.includes('Version History'));
    if (isHeaderToggleBtn) return;

    // Otherwise, close the version history
    this.close();
  }
}
