import { Component, OnInit, OnDestroy, inject, ViewEncapsulation, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml, Title } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { CmsDocsService } from '../../../core/services/cms-docs.service';
import { MarkdownRendererService } from '../../../core/services/markdown-renderer.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { AuthService } from '../../../core/services/auth.service';
import { SeoService } from '../../../core/services/seo.service';
import { DocPage, DocSection, TocItem } from '../../../core/models/cms-docs.model';
import { Icons } from '../../../core/component/icons/icons';

@Component({
  selector: 'app-public-docs',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Icons],
  templateUrl: './public-docs.html',
  styleUrls: ['./public-docs.scss'],
  encapsulation: ViewEncapsulation.None
})
export class PublicDocsComponent implements OnInit, OnDestroy {
  cmsService = inject(CmsDocsService);
  mdRenderer = inject(MarkdownRendererService);
  dashService = inject(DashboardService);
  auth = inject(AuthService);
  private titleService = inject(Title);
  private seoService = inject(SeoService);
  private sanitizer = inject(DomSanitizer);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sub = new Subscription();

  constructor() {
    effect(() => {
      const _loaded = this.cmsService.mediaLoaded();
      if (_loaded > 0) {
        if (this.currentPage) {
          this.loadDocBySlug(this.currentPage.slug);
        } else {
          this.loadDocBySlug();
        }
      }
    }, { allowSignalWrites: true });
  }

  searchQuery = '';
  currentPage: DocPage | null = null;
  renderedHtml: SafeHtml = '';
  tocItems: TocItem[] = [];
  activeTocId: string | null = null;
  isMobileMenuOpen = false;

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

  // Collapsible Sidebar Section Accordions
  collapsedSections = new Set<string>();

  toggleSection(sectionId: string): void {
    if (this.collapsedSections.has(sectionId)) {
      this.collapsedSections.delete(sectionId);
    } else {
      this.collapsedSections.add(sectionId);
    }
  }

  isSectionExpanded(sectionId: string): boolean {
    return !this.collapsedSections.has(sectionId);
  }

  get searchResults(): DocPage[] {
    const q = (this.searchQuery || '').trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return this.publishedPages.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.content && p.content.toLowerCase().includes(q))
    ).slice(0, 6);
  }

  selectSearchResult(page: DocPage): void {
    this.searchQuery = '';
    this.selectDoc(page);
  }

  clearSearch(): void {
    this.searchQuery = '';
  }

  ngOnInit(): void {
    this.dashService.applyTheme(this.dashService.theme());
    this.sub.add(
      this.route.params.subscribe(params => {
        const slug = params['slug'];
        this.loadDocBySlug(slug);
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  isLightTheme(): boolean {
    return this.dashService.theme() === 'light';
  }

  toggleTheme(): void {
    this.dashService.toggleTheme();
  }

  get sections(): DocSection[] {
    return this.cmsService.getSections();
  }

  get publishedPages(): DocPage[] {
    return this.cmsService.getPublishedPages();
  }

  getPagesForSection(sectionId: string): DocPage[] {
    return this.publishedPages
      .filter(p => p.sectionId === sectionId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  loadDocBySlug(slug?: string): void {
    const published = this.publishedPages;
    if (published.length === 0) {
      this.currentPage = null;
      this.renderedHtml = this.sanitizer.bypassSecurityTrustHtml('<div class="no-docs">No published documentation available yet.</div>');
      this.tocItems = [];
      return;
    }

    let target: DocPage | undefined;
    if (slug) {
      target = this.cmsService.getPageBySlug(slug);
    }

    if (!target) {
      target = published[0];
    }

    this.currentPage = target;
    if (target) {
      if (target.sectionId) {
        this.collapsedSections.delete(target.sectionId);
      }
      const pageTitle = `${target.title} | DB Nexus Docs`;
      this.titleService.setTitle(pageTitle);
      this.seoService.updateTags({
        title: pageTitle,
        description: target.description || target.seoDescription || `Documentation for ${target.title} in DB Nexus.`,
        url: typeof window !== 'undefined' ? window.location.href : undefined
      });
    }
    const res = this.mdRenderer.render(target.content);
    this.renderedHtml = this.sanitizer.bypassSecurityTrustHtml(res.html);
    this.tocItems = res.toc;
    this.activeTocId = null;

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => this.initCanvasEngines(), 50);
      setTimeout(() => this.initCanvasEngines(), 250);
      setTimeout(() => this.sanitizeAndPlayMedia(), 100);
      setTimeout(() => this.sanitizeAndPlayMedia(), 400);
    }
  }

  private sanitizeAndPlayMedia(): void {
    if (typeof document === 'undefined') return;
    const mediaContainer = document.querySelector('.article-rendered-body');
    if (!mediaContainer) return;

    const videos = mediaContainer.querySelectorAll<HTMLVideoElement>('video');
    videos.forEach(v => {
      let src = v.getAttribute('src') || v.src || '';
      if (src.startsWith('unsafe:')) {
        src = src.replace(/^unsafe:/, '');
        v.setAttribute('src', src);
      }
      v.muted = true;
      v.playsInline = true;
      v.autoplay = true;
      v.controls = true;
      if (src) {
        try {
          v.load();
          v.play().catch(() => {});
        } catch {}
      }
    });

    const imgs = mediaContainer.querySelectorAll<HTMLImageElement>('img');
    imgs.forEach(img => {
      let src = img.getAttribute('src') || img.src || '';
      if (src.startsWith('unsafe:')) {
        src = src.replace(/^unsafe:/, '');
        img.setAttribute('src', src);
      }
    });
  }

  private initCanvasEngines(): void {
    if (typeof window === 'undefined') return;
    const canvasElements = document.querySelectorAll<HTMLCanvasElement>('.doc-real-canvas-element');
    canvasElements.forEach(canvas => {
      (canvas as any)._initialized = false;
    });
    if ((window as any).initAllDocCanvasEngines) {
      (window as any).initAllDocCanvasEngines();
    }
  }

  selectDoc(page: DocPage): void {
    this.closeMobileMenu();
    this.router.navigate(['/docs', page.slug]);
    this.loadDocBySlug(page.slug);
  }

  scrollToToc(tocId: string, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.activeTocId = tocId;

    if (typeof document === 'undefined') return;

    // 1. Direct ID lookup
    let el = document.getElementById(tocId);

    // 2. Lookup without 'heading-' prefix
    if (!el) {
      const cleanId = tocId.replace(/^heading-/, '').toLowerCase();
      el = document.getElementById(cleanId);
    }

    // 3. Fallback query selector matching text content or ID substring
    if (!el) {
      const cleanId = tocId.replace(/^heading-/, '').toLowerCase();
      const headings = Array.from(document.querySelectorAll('.article-rendered-body h1, .article-rendered-body h2, .article-rendered-body h3, .doc-heading'));
      el = (headings.find(h => {
        const idAttr = (h.getAttribute('id') || h.id || '').toLowerCase();
        const textSlug = (h.textContent || '')
          .toLowerCase()
          .trim()
          .replace(/<[^>]*>/g, '')
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
        return idAttr === tocId.toLowerCase() || idAttr === cleanId || idAttr.includes(cleanId) || textSlug === cleanId || textSlug.includes(cleanId);
      }) || null) as HTMLElement | null;
    }

    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });

      const headerOffset = 90;
      const rect = el.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const targetY = rect.top + scrollTop - headerOffset;

      window.scrollTo({
        top: Math.max(0, targetY),
        behavior: 'smooth'
      });

      if (document.documentElement) {
        document.documentElement.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
      }
    } else {
      console.warn('Could not locate heading element for TOC ID:', tocId);
    }
  }

  getPreviousPage(): DocPage | null {
    if (!this.currentPage) return null;
    const all = this.publishedPages;
    const idx = all.findIndex(p => p.id === this.currentPage!.id);
    return idx > 0 ? all[idx - 1] : null;
  }

  getNextPage(): DocPage | null {
    if (!this.currentPage) return null;
    const all = this.publishedPages;
    const idx = all.findIndex(p => p.id === this.currentPage!.id);
    return idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
  }

  getSectionTitle(sectionId: string): string {
    const sec = this.sections.find(s => s.id === sectionId);
    return sec ? sec.title : 'Documentation';
  }

  getParentPageTitle(parentId?: string | null): string {
    if (!parentId) return '';
    const parent = this.cmsService.getPageById(parentId);
    return parent ? parent.title : '';
  }

  getReadTime(): string {
    if (!this.currentPage) return '1 min read';
    const words = this.currentPage.content.trim().split(/\s+/).length;
    const min = Math.max(1, Math.ceil(words / 200));
    return `${min} min read`;
  }

  isSuperAdmin(): boolean {
    return this.auth.isSuperAdmin();
  }

  goToAdminCms(): void {
    this.router.navigate(['/admin/docs']);
  }

  goToApplication(): void {
    this.router.navigate(['/dashboard']);
  }
}
