
import { Component, OnInit, HostListener, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SignOutService } from '../../../core/services/sign-out.service';
import { Icons } from '../../../core/component/icons/icons';
import { ButtonComponent } from '../../../shared/button/button';
import { DashboardService } from '../../../core/services/dashboard.service';
import { Footer } from '../../../shared/components/footer/footer';
import { SeoService } from '../../../core/services/seo.service';

@Component({
  selector: 'app-live-connection',
  standalone: true,
  imports: [CommonModule, RouterModule, Icons, ButtonComponent, Footer],
  templateUrl: './live-connection.html',
  styleUrls: ['./live-connection.scss']
})
export class LiveConnectionComponent implements OnInit {

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
    public svc: DashboardService,
    private seoService: SeoService
  ) { }

  ngOnInit(): void {
    this.seoService.updateTags({
      title: 'DB Connect - Live Database Connection & Reverse Engineering - dbNexus',
      description: 'Connect securely directly to PostgreSQL, MySQL, SQL Server, and SQLite databases to import and visualize schemas in real-time.',
      url: 'https://www.dbnexus.io/features/db-connect',
      keywords: 'live database connection, reverse engineer database, db connect, database visualizer, import live schema'
    });

    this.seoService.setStructuredData({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "dbNexus DB Connect",
      "applicationCategory": "DeveloperApplication",
      "url": "https://www.dbnexus.io/features/db-connect"
    });
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
