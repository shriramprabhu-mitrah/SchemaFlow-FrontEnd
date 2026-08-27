import { Component, OnInit, inject, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrganizationService } from '../services/organization.service';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-org-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './org-dashboard.html',
  styleUrls: ['./org-dashboard.scss']
})
export class OrgDashboardComponent implements OnInit {
  private orgService = inject(OrganizationService);
  private route = inject(ActivatedRoute);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private auth = inject(AuthService);

  orgId!: number;
  loading = true;
  
  stats = {
    members: { total: 0, growth: '+0%', label: 'this month' },
    workspaces: { total: 0, label: 'active workspaces' },
    diagrams: { total: 0, growth: '+0%', label: 'this month' },
    plan: { name: 'Free', label: 'No Billing' }
  };

  auditLogs: any[] = [];
  activeWorkspaces: any[] = [];
  pendingInvitations: any[] = [];
  chartData: any[] = [];

  ngOnInit(): void {
    const storedOrgId = this.auth.getOrganizationId();
    if (storedOrgId) {
      this.orgId = storedOrgId;
      this.loadDashboardData();
    } else {
      this.route.parent?.params.subscribe(params => {
        if (params['id']) {
          this.orgId = +params['id'];
          this.loadDashboardData();
        }
      });
    }
  }

  loadDashboardData() {
    this.loading = true;
    this.orgService.getOrganizationDashboard(this.orgId).subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          if (res.data) {
            this.stats = res.data.stats;
            this.auditLogs = (res.data.auditLogs || []).map((log: any) => {
              if (log.action) {
                log.action = log.action.replace(/seats/g, 'members').replace(/seat/g, 'member').replace(/Seats/g, 'Members').replace(/Seat/g, 'Member');
              }
              return log;
            });
            this.activeWorkspaces = res.data.activeWorkspaces;
            this.pendingInvitations = res.data.pendingInvitations;
            this.chartData = res.data.chartData || [];
          }
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err: any) => {
        this.ngZone.run(() => {
          console.error(err);
          this.loading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  get chartMetrics() {
    return [
      { name: 'Members', count: this.stats.members.total || 0 },
      { name: 'Workspaces', count: this.stats.workspaces.total || 0 },
      { name: 'Diagrams', count: this.stats.diagrams.total || 0 }
    ];
  }

  getPercentage(value: number): number {
    const maxVal = this.getChartMax();
    return maxVal === 0 ? 0 : Math.max(5, (value / maxVal) * 100);
  }

  getChartMax(): number {
    const max = Math.max(this.stats.members.total || 0, this.stats.workspaces.total || 0, this.stats.diagrams.total || 0, 5);
    // Round up to nearest 5 or 10
    return Math.ceil(max / 5) * 5;
  }

  getLogType(action: string): string {
    if (!action) return 'edit';
    const lowerAction = action.toLowerCase();
    if (lowerAction.includes('create')) return 'create';
    if (lowerAction.includes('invit')) return 'invite';
    if (lowerAction.includes('delete') || lowerAction.includes('remove')) return 'delete';
    return 'edit';
  }
}
