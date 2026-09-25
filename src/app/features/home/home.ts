import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Icons } from '../../core/component/icons/icons';
import { ButtonComponent } from '../../shared/button/button';
import { DashboardService } from '../../core/services/dashboard.service';
import { SeoService } from '../../core/services/seo.service';
import { InteractivePreviewComponent } from './components/interactive-preview/interactive-preview';
import { Footer } from '../../shared/components/footer/footer';

interface HeroTable {
  name: string;
  rotate: string;
  position: { top?: string; bottom?: string; left?: string; right?: string };
  columns: { name: string; type: string; isPk?: boolean; isFk?: boolean }[];
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, Icons, ButtonComponent, InteractivePreviewComponent, Footer],
  templateUrl: './home.html',
})
export class HomeComponent implements OnInit {
  isLoggedIn = false;
  isMobileMenuOpen = false;

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  // Static preview data for the hero illustration — a small, believable
  // slice of the E-Commerce sample schema, arranged as floating cards
  // around the diagram canvas rather than a literal editor mockup.
  heroTables: HeroTable[] = [
    {
      name: 'products',
      rotate: '-4deg',
      position: { top: '14px', left: '18px' },
      columns: [
        { name: 'id', type: 'int', isPk: true },
        { name: 'name', type: 'varchar' },
        { name: 'merchant_id', type: 'int', isFk: true }
      ]
    },
    {
      name: 'merchants',
      rotate: '3deg',
      position: { top: '54px', right: '24px' },
      columns: [
        { name: 'id', type: 'int', isPk: true },
        { name: 'merchant_name', type: 'varchar' },
        { name: 'country_code', type: 'int', isFk: true }
      ]
    },
    {
      name: 'countries',
      rotate: '-2deg',
      position: { bottom: '26px', right: '46px' },
      columns: [
        { name: 'code', type: 'int', isPk: true },
        { name: 'name', type: 'varchar' }
      ]
    }
  ];

  constructor(
    private auth: AuthService,
    private router: Router,
    public svc: DashboardService,
    private seoService: SeoService
  ) { }

  ngOnInit(): void {
    this.seoService.updateTags({
      title: 'DBNexus - Database Schema Design Tool',
      description: 'Design, document, and collaborate on database schemas with ease. A simple and powerful tool for developers and teams.',
      url: 'https://dbnexus.up.railway.app/'
    });

    this.seoService.setStructuredData({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "DBNexus",
      "operatingSystem": "Any",
      "applicationCategory": "DeveloperApplication",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      }
    });

    if (typeof window !== 'undefined') {
      this.isLoggedIn = this.auth.isLoggedIn();
      this.svc.syncThemeFromStorage();
    }
  }

  onCreateDiagram(): void {
    if (this.isLoggedIn) {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/dashboard'], { queryParams: { sample: 'true' } });
    }
  }

  logout(): void {
    this.auth.logout();
    this.isLoggedIn = false;
    this.svc.showToast('Logged out successfully.', 2500, 'success');
  }
}
