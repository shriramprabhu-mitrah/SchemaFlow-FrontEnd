import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DashboardService } from '../../../../core/services/dashboard.service';
import { DiffEngine, DiffResult, SideBySideRow } from './diff-engine';

export interface OverviewMarker {
  type: 'added' | 'removed' | 'modified';
  topPct: number;
  lineNum: number;
}

export type DiffViewMode = 'edit' | 'diff';

@Component({
  selector: 'app-diff-checker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './diff-checker.html',
})
export class DiffCheckerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('leftScroll') leftScrollRef?: ElementRef<HTMLDivElement>;
  @ViewChild('rightScroll') rightScrollRef?: ElementRef<HTMLDivElement>;
  @ViewChild('leftTextarea') leftTextareaRef?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('rightTextarea') rightTextareaRef?: ElementRef<HTMLTextAreaElement>;

  leftText = '';
  rightText = '';

  viewMode: DiffViewMode = 'edit';

  diffResult: DiffResult = {
    sideBySideRows: [],
    unifiedLines: [],
    stats: { additions: 0, deletions: 0, modifications: 0, totalLeftLines: 0, totalRightLines: 0, isIdentical: true }
  };

  overviewMarkers: OverviewMarker[] = [];
  copiedSide: 'left' | 'right' | null = null;
  private copiedTimer: any = null;
  private isSyncingScroll = false;
  private dataSubscription?: Subscription;

  constructor(
    public svc: DashboardService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.svc.diffCheckerData) {
      this.leftText = this.svc.diffCheckerData.leftText || '';
      this.rightText = this.svc.diffCheckerData.rightText || '';
      this.viewMode = this.svc.diffCheckerData.viewMode || 'edit';
    } else {
      this.leftText = '';
      this.rightText = '';
      this.viewMode = 'edit';
    }
    this.recompute();

    this.dataSubscription = this.svc.diffCheckerData$.subscribe(data => {
      if (data) {
        this.leftText = data.leftText || '';
        this.rightText = data.rightText || '';
        this.viewMode = data.viewMode || 'edit';
        this.recompute();
        setTimeout(() => {
          this.updateOverviewMarkers();
        }, 50);
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      }
    });
  }

  ngAfterViewInit(): void {
    this.updateOverviewMarkers();
  }

  ngOnDestroy(): void {
    if (this.copiedTimer) {
      clearTimeout(this.copiedTimer);
    }
    this.dataSubscription?.unsubscribe();
  }

  recompute(): void {
    this.diffResult = DiffEngine.computeDiff(this.leftText, this.rightText, false);
    this.updateOverviewMarkers();
  }

  getLineCount(text: string): number {
    if (!text) return 0;
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').length;
  }

  onLeftChange(val: string): void {
    this.leftText = val;
    this.recompute();
  }

  onRightChange(val: string): void {
    this.rightText = val;
    this.recompute();
  }

  setViewMode(mode: DiffViewMode, focusSide?: 'left' | 'right'): void {
    this.viewMode = mode;
    if (mode === 'diff') {
      this.recompute();
      setTimeout(() => {
        this.updateOverviewMarkers();
      }, 50);
    } else {
      setTimeout(() => {
        if (focusSide === 'right') {
          this.rightTextareaRef?.nativeElement?.focus();
        } else {
          this.leftTextareaRef?.nativeElement?.focus();
        }
      }, 50);
    }
  }

  onPanePaste(event: ClipboardEvent, side: 'left' | 'right'): void {
    if (this.viewMode !== 'diff') return;
    const text = event.clipboardData?.getData('text');
    if (text !== undefined) {
      event.preventDefault();
      if (side === 'left') {
        this.leftText = text;
      } else {
        this.rightText = text;
      }
      this.recompute();
    }
  }

  private updateOverviewMarkers(): void {
    const rows = this.diffResult.sideBySideRows;
    const total = rows.length;
    if (total === 0) {
      this.overviewMarkers = [];
      return;
    }

    const markers: OverviewMarker[] = [];
    rows.forEach((row, idx) => {
      const topPct = (idx / total) * 100;
      if (row.right.type === 'added' || row.right.type === 'modified') {
        markers.push({ type: 'added', topPct, lineNum: idx + 1 });
      } else if (row.left.type === 'removed') {
        markers.push({ type: 'removed', topPct, lineNum: idx + 1 });
      }
    });

    this.overviewMarkers = markers;
  }

  onScroll(source: 'left' | 'right'): void {
    if (this.isSyncingScroll) return;

    const leftEl = this.leftScrollRef?.nativeElement;
    const rightEl = this.rightScrollRef?.nativeElement;
    if (!leftEl || !rightEl) return;

    this.isSyncingScroll = true;
    if (source === 'left') {
      rightEl.scrollTop = leftEl.scrollTop;
      rightEl.scrollLeft = leftEl.scrollLeft;
    } else {
      leftEl.scrollTop = rightEl.scrollTop;
      leftEl.scrollLeft = rightEl.scrollLeft;
    }
    requestAnimationFrame(() => {
      this.isSyncingScroll = false;
    });
  }

  async copyText(side: 'left' | 'right'): Promise<void> {
    const text = side === 'left' ? this.leftText : this.rightText;
    if (!text) {
      this.svc.showToast('Nothing to copy', 2000, 'info');
      return;
    }

    // Set state immediately so single click provides instant visual response
    this.copiedSide = side;
    this.cdr.markForCheck();
    this.cdr.detectChanges();

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.warn('Fallback copy failed', err);
      }
      document.body.removeChild(ta);
    }

    this.svc.showToast('Copied to clipboard!', 2000, 'success');
    this.cdr.markForCheck();
    this.cdr.detectChanges();

    if (this.copiedTimer) clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => {
      this.copiedSide = null;
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    }, 2000);
  }

  clearAll(): void {
    this.leftText = '';
    this.rightText = '';
    this.viewMode = 'edit';
    this.svc.diffCheckerData = { leftText: '', rightText: '', viewMode: 'edit' };
    this.recompute();
    setTimeout(() => {
      this.leftTextareaRef?.nativeElement?.focus();
    }, 50);
  }


  exitDiffChecker(): void {
    this.svc.closeDiffChecker();
    const id = this.svc.diagramId();
    if (id) {
      this.router.navigate(['/dashboard'], { queryParams: { id } });
    } else {
      this.router.navigate(['/dashboard']);
    }
  }
}
