import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrganizationService } from '../services/organization.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-org-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './org-settings.html'
})
export class OrgSettingsComponent implements OnInit {
  private orgService = inject(OrganizationService);
  private auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  public dashService = inject(DashboardService);
  org: any = null;
  loading = true;
  saving = false;
  roles: any[] = [];
  loadingRoles = true;

  ngOnInit(): void {
    const orgId = this.auth.getOrganizationId();
    if (!orgId) return;
    this.orgService.getOrganization(orgId).subscribe({
      next: (res) => {
        this.org = res?.data || res;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });

    this.orgService.getRoles().subscribe({
      next: (res) => {
        this.roles = res?.data || [];
        this.loadingRoles = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingRoles = false;
        this.cdr.detectChanges();
      }
    });
  }

  nameError = '';

  save(): void {
    this.nameError = '';
    if (!this.org || !this.org.name || !this.org.name.trim()) {
      this.nameError = 'Organization name is required.';
      this.cdr.detectChanges();
      return;
    }
    if (this.org.name.trim().length < 2) {
      this.nameError = 'Organization name must be at least 2 characters.';
      this.cdr.detectChanges();
      return;
    }

    this.saving = true;
    const orgId = this.auth.getOrganizationId();
    if (!orgId) return;
    this.orgService.updateOrganization(orgId, { name: this.org.name.trim(), description: this.org.description ? this.org.description.trim() : '' }).subscribe({
      next: () => {
        this.saving = false;
        this.triggerToast('Organization settings updated successfully!', 'success');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.saving = false;
        this.triggerToast(err?.error?.message || 'Error updating organization settings.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  triggerToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.dashService.showToast(msg, 4000, type);
  }
}
