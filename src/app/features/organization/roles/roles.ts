import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrganizationService } from '../services/organization.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './roles.html'
})
export class RolesComponent implements OnInit {
  private orgService = inject(OrganizationService);
  private cdr = inject(ChangeDetectorRef);
  roles: any[] = [];
  loading = true;

  ngOnInit(): void {
    this.orgService.getRoles().subscribe({
      next: (res) => {
        this.roles = res?.data || [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
}
