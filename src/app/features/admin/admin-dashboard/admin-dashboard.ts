import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../services/admin.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.html'
})
export class AdminDashboardComponent implements OnInit {
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);

  stats: any = {};
  recentUsers: any[] = [];
  planDistribution: any[] = [];
  loading = true;

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading = true;
    this.adminService.getDashboard().subscribe({
      next: (res) => {
        const data = res?.data || res;
        this.stats = data.stats || {};
        this.recentUsers = data.recentUsers || [];
        this.planDistribution = data.planDistribution || [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getPercentage(count: number): number {
    const max = Math.max(...this.planDistribution.map((p: any) => Number(p.count) || 0), 1);
    return (Number(count) / max) * 100;
  }
}
