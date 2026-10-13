
import { Component, OnInit, HostListener, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SignOutService } from '../../../core/services/sign-out.service';
import { Icons } from '../../../core/component/icons/icons';
import { ButtonComponent } from '../../../shared/button/button';
import { DashboardService } from '../../../core/services/dashboard.service';
import { Footer } from '../../../shared/components/footer/footer';

@Component({
  selector: 'app-db-docs',
  standalone: true,
  imports: [CommonModule, RouterModule, Icons, ButtonComponent, Footer],
  templateUrl: './db-docs.html',
  styleUrls: ['./db-docs.scss']
})
export class DbDocsComponent implements OnInit {

  isFeaturesDropdownOpen = false;

  toggleFeaturesDropdown(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.isFeaturesDropdownOpen = !this.isFeaturesDropdownOpen;
  }

  @HostListener('document:click', ['$event'])
  closeFeaturesDropdownOnGlobalClick(event: Event): void {
    this.isFeaturesDropdownOpen = false;
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.isFeaturesDropdownOpen) {
      this.isFeaturesDropdownOpen = false;
    }
  }

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  @HostListener('window:userLogout')
  onUserLogout(): void {
    this.cdr.detectChanges();
  }

  isMobileMenuOpen = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    public svc: DashboardService
  ) { }

  ngOnInit(): void {
  }

  
  isMobileFeaturesDropdownOpen = false;

  toggleMobileFeaturesDropdown(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.isMobileFeaturesDropdownOpen = !this.isMobileFeaturesDropdownOpen;
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  onCreateDiagram(): void {
    if (this.isLoggedIn) {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/dashboard'], { queryParams: { sample: 'true' } });
    }
  }

  private signOutService = inject(SignOutService);
  private cdr = inject(ChangeDetectorRef);

  logout(): void {
    this.signOutService.prompt(() => {
      this.auth.logout();
      this.svc.showToast('Logged out successfully.', 2500, 'success');
      this.cdr.detectChanges();
    });
  }
}
