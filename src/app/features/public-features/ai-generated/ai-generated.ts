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
  selector: 'app-ai-generated',
  standalone: true,
  imports: [CommonModule, RouterModule, Icons, ButtonComponent, Footer],
  templateUrl: './ai-generated.html',
  styleUrls: ['./ai-generated.scss']
})
export class AiGeneratedComponent implements OnInit {

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
      title: 'Prompt to DBML: The First AI Database Schema Generator Built for Teams - dbNexus',
      description: 'Describe your application or microservice in plain English. Watch dbNexus AI write the code, generate the tables, and map relationships instantly.',
      url: 'https://www.dbnexus.io/features/ai-schema-generator',
      keywords: 'AI database schema generator, text to database schema, AI database diagram tool, prompt to DBML'
    });

    this.seoService.setStructuredData({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "dbNexus AI Database Schema Generator",
      "applicationCategory": "DeveloperApplication",
      "url": "https://www.dbnexus.io/features/ai-schema-generator"
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

  onCreateDiagram(prompt?: string): void {
    if (this.isLoggedIn) {
      this.router.navigate(['/dashboard'], prompt ? { queryParams: { prompt } } : undefined);
    } else {
      this.router.navigate(['/dashboard'], { queryParams: { sample: 'true', ...(prompt ? { prompt } : {}) } });
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

