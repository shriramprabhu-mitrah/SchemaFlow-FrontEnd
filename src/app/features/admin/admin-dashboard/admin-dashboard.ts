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

  get systemOverviewMetrics(): any[] {
    return [
      { name: 'Total Users', count: Number(this.stats.totalUsers) || 0 },
      { name: 'Organizations', count: Number(this.stats.totalOrganizations) || 0 },
      { name: 'Subscriptions', count: Number(this.stats.activeSubscriptions) || 0 },
      { name: 'Active Plans', count: Number(this.stats.activePlans) || 0 }
    ];
  }

  getNiceMax(rawMax: number): number {
    if (rawMax <= 4) return 4;
    if (rawMax <= 8) return 8;
    if (rawMax <= 12) return 12;
    if (rawMax <= 20) return 20;
    if (rawMax <= 40) return 40;
    if (rawMax <= 60) return 60;
    if (rawMax <= 80) return 80;
    if (rawMax <= 100) return 100;
    const step = 20 * Math.pow(10, Math.floor(Math.log10(rawMax)) - 1);
    return Math.ceil(rawMax / step) * step;
  }

  getSystemPercentage(count: number): number {
    const max = this.getSystemMaxScale();
    return (Number(count) / max) * 100;
  }

  getSystemMaxScale(): number {
    const rawMax = Math.max(...this.systemOverviewMetrics.map(m => m.count), 1);
    return this.getNiceMax(rawMax);
  }

  getPercentage(count: number): number {
    const max = this.getMaxScale();
    return (Number(count) / max) * 100;
  }

  getMaxScale(): number {
    if (!this.planDistribution || this.planDistribution.length === 0) return 4;
    const rawMax = Math.max(...this.planDistribution.map((p: any) => Number(p.count) || 0), 1);
    return this.getNiceMax(rawMax);
  }

  getMaxCount(): number {
    return this.getMaxScale();
  }

  getSystemMaxCount(): number {
    return this.getSystemMaxScale();
  }

  getSvgPoints(): string {
    if (!this.planDistribution || this.planDistribution.length === 0) return '';
    const max = this.getMaxScale();
    const count = this.planDistribution.length;
    const width = 500;
    const height = 180;
    const paddingX = 40;
    const paddingY = 20;
    const usableWidth = width - paddingX * 2;
    const usableHeight = height - paddingY * 2;

    const points = this.planDistribution.map((plan, idx) => {
      const x = paddingX + (idx / Math.max(count - 1, 1)) * usableWidth;
      const y = height - paddingY - (Number(plan.count) / max) * usableHeight;
      return { x, y };
    });

    return points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }

  getSvgAreaPath(): string {
    if (!this.planDistribution || this.planDistribution.length === 0) return '';
    const max = this.getMaxScale();
    const count = this.planDistribution.length;
    const width = 500;
    const height = 180;
    const paddingX = 40;
    const paddingY = 20;
    const usableWidth = width - paddingX * 2;
    const usableHeight = height - paddingY * 2;

    const points = this.planDistribution.map((plan, idx) => {
      const x = paddingX + (idx / Math.max(count - 1, 1)) * usableWidth;
      const y = height - paddingY - (Number(plan.count) / max) * usableHeight;
      return { x: x.toFixed(1), y: y.toFixed(1) };
    });

    if (points.length === 0) return '';
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    const bottomY = (height - paddingY).toFixed(1);

    let path = `M ${firstX} ${bottomY} L ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    path += ` L ${lastX} ${bottomY} Z`;
    return path;
  }

  getPointData(): any[] {
    if (!this.planDistribution || this.planDistribution.length === 0) return [];
    const max = this.getMaxScale();
    const count = this.planDistribution.length;
    const width = 500;
    const height = 180;
    const paddingX = 40;
    const paddingY = 20;
    const usableWidth = width - paddingX * 2;
    const usableHeight = height - paddingY * 2;

    return this.planDistribution.map((plan, idx) => {
      const x = paddingX + (idx / Math.max(count - 1, 1)) * usableWidth;
      const y = height - paddingY - (Number(plan.count) / max) * usableHeight;
      return {
        x: x.toFixed(1),
        y: y.toFixed(1),
        name: plan.name,
        count: plan.count,
        leftPct: ((x / width) * 100).toFixed(2),
        topPct: ((y / height) * 100).toFixed(2)
      };
    });
  }

  Math = Math;
}
