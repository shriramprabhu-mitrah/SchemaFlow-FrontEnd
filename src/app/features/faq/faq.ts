import { Component, OnInit, ViewEncapsulation, HostListener, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SignOutService } from '../../core/services/sign-out.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { SeoService } from '../../core/services/seo.service';
import { Icons } from '../../core/component/icons/icons';
import { ButtonComponent } from '../../shared/button/button';
import { Footer } from '../../shared/components/footer/footer';

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [CommonModule, RouterModule, Icons, ButtonComponent, Footer],
  templateUrl: './faq.html',
  styleUrls: ['./faq.scss'],
  encapsulation: ViewEncapsulation.None
})
export class FaqComponent implements OnInit {
  private auth = inject(AuthService);
  private signOutService = inject(SignOutService);
  private dashboardService = inject(DashboardService);
  private seoService = inject(SeoService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  isFeaturesDropdownOpen = false;
  isMobileFeaturesDropdownOpen = false;
  isMobileMenuOpen = false;

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
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

  @HostListener('window:userLogout')
  onUserLogout(): void {
    this.cdr.detectChanges();
  }

  toggleFeaturesDropdown(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.isFeaturesDropdownOpen = !this.isFeaturesDropdownOpen;
  }

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

  logout(): void {
    this.signOutService.prompt(() => {
      this.auth.logout();
      this.dashboardService.showToast('Logged out successfully.', 2500, 'success');
      this.cdr.detectChanges();
    });
  }

  ngOnInit(): void {
    this.seoService.updateTags({
      title: 'Frequently Asked Questions - dbNexus',
      description: 'Find answers to frequently asked questions about dbNexus, pricing plans, team licenses, database modeling, and schema workflows.',
      url: 'https://www.dbnexus.io/faq'
    });
  }
}
