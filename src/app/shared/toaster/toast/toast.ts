import { Component, Input, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnDestroy, computed } from '@angular/core';
import { DashboardService } from '../../../core/services/dashboard.service';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-toast',
  imports: [CommonModule],
  templateUrl: './toast.html',
  styleUrl: './toast.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toast implements OnInit, OnDestroy {
  /** Which zone this instance renders toasts for: 'editor' | 'canvas' */
  @Input() location: 'editor' | 'canvas' = 'canvas';

  private destroy$ = new Subject<void>();

  constructor(
    public svc: DashboardService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Re-render whenever toast state changes
    // Angular signals are used in template; but for OnPush we need a nudge
    // Use an interval-free approach: subscribe to a tick from signal effects via a simple reactive hack
    // Actually since we use svc signals directly in template, this works automatically in default mode,
    // but for OnPush we mark for check whenever any relevant signal changes.
    // We leverage the fact that toastMessage changes drive visibility.
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Returns true when this instance should show the current toast */
  readonly shouldShow = computed(() => {
    const msg = this.svc.toastMessage();
    if (!msg) return false;
    return this.svc.toastLocation() === this.location;
  });

  readonly isDark = computed(() => {
    return this.svc.theme() === 'dark';
  });

  dismiss(): void {
    this.svc.toastMessage.set(null);
  }

  /** Reactive computed style for editor toast — updates when paneMode or editorWidthPct changes */
  readonly editorStyle = computed(() => {
    const mode = this.svc.paneMode();
    const pct  = this.svc.editorWidthPct();
    if (mode === 'split') {
      return {
        left: '12px',
        bottom: '12px',
        width: `calc(${pct}% - 24px)`,
        maxWidth: 'none'
      };
    }
    if (mode === 'editor') {
      return {
        left: '12px',
        bottom: '12px',
        width: 'calc(100% - 24px)',
        maxWidth: 'none'
      };
    }
    // canvas mode: editor is hidden, so hide this toast too
    return { display: 'none' };
  });
}
