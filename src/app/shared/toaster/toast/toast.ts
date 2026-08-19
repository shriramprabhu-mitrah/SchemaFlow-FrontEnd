import { Component } from '@angular/core';
import { DashboardService } from '../../../core/services/dashboard.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-toast',
  imports: [CommonModule],
  templateUrl: './toast.html',
  styleUrl: './toast.scss',
})
export class Toast {
  constructor(
    public svc: DashboardService,
    private router: Router
  ) { }

  get isDashboard(): boolean {
    return this.router.url.startsWith('/dashboard');
  }

  getToastStyle(): Record<string, string> {
    if (this.router.url.startsWith('/dashboard')) {
      const mode = this.svc.paneMode();
      if (mode === 'split') {
        return {
          position: 'fixed',
          left: '12px',
          bottom: '12px',
          width: `calc(${this.svc.editorWidthPct()}% - 24px)`,
          maxWidth: 'none'
        };
      } else if (mode === 'editor') {
        return {
          position: 'fixed',
          left: '12px',
          bottom: '12px',
          width: 'calc(100% - 24px)',
          maxWidth: 'none'
        };
      }
    }
    return {
      position: 'fixed',
      right: '24px',
      top: '24px',
      left: 'auto',
      bottom: 'auto',
      width: '360px',
      maxWidth: '360px',
      zIndex: '999999'
    };
  }
}


