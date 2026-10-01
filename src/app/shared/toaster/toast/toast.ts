import { Component, Input, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnDestroy, computed, effect } from '@angular/core';
import { DashboardService } from '../../../core/services/dashboard.service';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-toast',
  imports: [CommonModule],
  templateUrl: './toast.html',
  styleUrl: './toast.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toast implements OnInit, OnDestroy {
  /** Optional location property retained for backwards compatibility */
  @Input() location?: string;

  private destroy$ = new Subject<void>();

  constructor(
    public svc: DashboardService,
    private cdr: ChangeDetectorRef
  ) {
    effect(() => {
      // Re-render whenever toast state changes
      this.svc.toastMessage();
      this.svc.toastType();
      this.cdr.markForCheck();
    });
  }

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
    return !!this.svc.toastMessage();
  });

  readonly isDark = computed(() => {
    return this.svc.theme() === 'dark';
  });

  dismiss(): void {
    this.svc.toastMessage.set(null);
  }
}
