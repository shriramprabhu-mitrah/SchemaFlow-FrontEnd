import { Component, OnInit, inject, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrganizationService } from '../services/organization.service';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Icons } from '../../../core/component/icons/icons';

@Component({
  selector: 'app-org-audit-logs',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, Icons],
  templateUrl: './org-audit-logs.html',
  styleUrls: ['./org-audit-logs.scss']
})
export class OrgAuditLogsComponent implements OnInit {
  private orgService = inject(OrganizationService);
  private route = inject(ActivatedRoute);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private auth = inject(AuthService);

  orgId!: number;
  loading = true;
  auditLogs: any[] = [];
  filteredLogs: any[] = [];
  meta: any = {};
  
  private searchSubject = new Subject<string>();
  
  search: string = '';
  page: number = 1;
  limit: number = 10;
  showPageSizeDropdown = false;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  showDetailsModal = false;
  selectedLogDetails: any = null;
  selectedLogAction: string = '';
  
  Math = Math;

  ngOnInit(): void {
    const storedOrgId = this.auth.getOrganizationId();
    if (storedOrgId) {
      this.orgId = storedOrgId;
      this.loadAuditLogs();
    } else {
      this.route.parent?.params.subscribe(params => {
        if (params['id']) {
          this.orgId = +params['id'];
          this.loadAuditLogs();
        }
      });
    }

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.ngZone.run(() => {
        this.search = term;
        this.page = 1;
        this.loadAuditLogs();
      });
    });
  }

  openDetailsModal(log: any) {
    if (!log.details) return;
    this.selectedLogDetails = log.details;
    this.selectedLogAction = log.action;
    this.showDetailsModal = true;
  }

  closeDetailsModal() {
    this.showDetailsModal = false;
    this.selectedLogDetails = null;
  }

  loadAuditLogs() {
    this.loading = true;
    this.orgService.getOrganizationAuditLogs(this.orgId, this.page, this.limit, this.search, this.sortColumn, this.sortDirection === 'asc').subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          if (res.data) {
            this.auditLogs = res.data.map((log: any) => {
              if (log.action) {
                log.action = log.action.replace(/seats/g, 'members').replace(/seat/g, 'member').replace(/Seats/g, 'Members').replace(/Seat/g, 'Member');
              }
              return log;
            });
          }
          if (res.meta) {
            this.meta = res.meta;
          }
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err: any) => {
        this.ngZone.run(() => {
          console.error('Error fetching audit logs:', err);
          this.loading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  onSearch(term: string) {
    this.searchSubject.next(term);
  }

  sortBy(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.loadAuditLogs();
  }

  get totalPages(): number {
    return this.meta.totalPages || 1;
  }

  get totalPagesArray(): number[] {
    return Array(this.totalPages).fill(0).map((x, i) => i + 1);
  }

  goToPage(p: number) {
    if (p >= 1 && p <= this.totalPages) {
      this.page = p;
      this.loadAuditLogs();
    }
  }

  togglePageSizeDropdown(event: Event) {
    event.stopPropagation();
    this.showPageSizeDropdown = !this.showPageSizeDropdown;
  }

  selectPageSize(size: number) {
    this.limit = size;
    this.page = 1;
    this.showPageSizeDropdown = false;
    this.loadAuditLogs();
  }
}
