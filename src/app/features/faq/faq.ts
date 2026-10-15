import { Component, OnInit, ViewEncapsulation, HostListener, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SignOutService } from '../../core/services/sign-out.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { SeoService } from '../../core/services/seo.service';
import { Icons } from '../../core/component/icons/icons';
import { ButtonComponent } from '../../shared/button/button';
import { Footer } from '../../shared/components/footer/footer';

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  linkText?: string;
  linkUrl?: string;
  bullets?: string[];
}

export interface FaqSubcategory {
  id: string;
  title: string;
  items: FaqItem[];
}

export interface FaqSection {
  id: string;
  title: string;
  subcategories: FaqSubcategory[];
}

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Icons, ButtonComponent, Footer],
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

  searchQuery = '';
  activeSubcategoryId = 'sub-plans';
  openItems = new Set<string>(['faq-plans-1', 'faq-designer-1']);

  faqSections: FaqSection[] = [
    {
      id: 'sec-licensing',
      title: 'Plans & Licensing',
      subcategories: [
        {
          id: 'sub-plans',
          title: 'Subscriptions & Plans',
          items: [
            {
              id: 'faq-plans-1',
              question: 'What plans are available in dbNexus?',
              answer: 'dbNexus offers Free, Professional (Solo/Individual), and Team plans tailored to different database engineering needs:',
              bullets: [
                'Free Plan: Core visual modeling, up to 10 tables per diagram, DBML code editor, and standard export.',
                'Professional Plan: Unlimited tables per diagram, private projects, password protection, high-resolution SVG/PDF exports, and multi-dialect SQL generation.',
                'Team Plan: Multi-user shared workspaces, centralized billing, seat management, role-based access control, and live team collaboration.'
              ],
              linkText: 'Compare all plan details on our Pricing Page',
              linkUrl: '/pricing'
            },
            {
              id: 'faq-plans-2',
              question: 'Can I switch between monthly and annual billing cycles?',
              answer: 'Yes, you can upgrade, downgrade, or switch between monthly and annual billing cycles at any time from your account settings under the Subscription tab. Subscriptions will adjust automatically, and any unused balance from your current active cycle is pro-rated toward your new plan.'
            },
            {
              id: 'faq-plans-3',
              question: 'Is there a free trial for premium features?',
              answer: 'Yes! All registered users can activate a free 14-day trial of our Professional plan directly from the Pricing page without requiring a credit card upfront.'
            },
            {
              id: 'faq-plans-4',
              question: 'What happens to my diagrams if my subscription expires or is canceled?',
              answer: 'Your diagrams and schemas are never deleted. If your paid subscription lapses, your account seamlessly transitions to the Free tier. You can continue to access, view, and export all existing diagrams. If a diagram exceeds the Free tier table limit, it remains accessible in read-only mode until you renew or reduce the table count.'
            }
          ]
        },
        {
          id: 'sub-billing',
          title: 'Billing, Payments & Refunds',
          items: [
            {
              id: 'faq-billing-1',
              question: 'Which payment methods do you accept?',
              answer: 'We support all major international and domestic credit and debit cards (Visa, MasterCard, American Express), Net Banking, UPI (in supported regions via Razorpay), and corporate invoicing for annual Team accounts.'
            },
            {
              id: 'faq-billing-2',
              question: 'Do you offer refunds?',
              answer: 'All subscription purchases, renewals, seat additions, and plan upgrades are strictly final and non-refundable. You can disable auto-renewal in your account settings at any time to prevent future billing.',
              linkText: 'Read our full Refund Policy',
              linkUrl: '/docs/refund-policy'
            },
            {
              id: 'faq-billing-3',
              question: 'How can I download invoice receipts for accounting and taxes?',
              answer: 'Invoices and tax receipts are automatically generated and emailed to your registered billing email upon successful transaction. You can also view and download PDF receipts at any time from your Profile > Subscription page.'
            }
          ]
        },
        {
          id: 'sub-teams',
          title: 'Team Licenses & Member Seats',
          items: [
            {
              id: 'faq-teams-1',
              question: 'How do team user licenses and seat additions work?',
              answer: 'The Team plan includes base developer seats for your shared workspace. Additional member seats can be purchased dynamically at any time. When seats are added mid-billing cycle, charges are calculated on a pro-rata basis for the remaining days of your cycle.'
            },
            {
              id: 'faq-teams-2',
              question: 'Can I reassign a seat to another team member?',
              answer: 'Yes. Organization Owners and Admins can freely reassign seats by revoking access for an inactive team member in Workspace Settings and inviting a new member via their email address.'
            },
            {
              id: 'faq-teams-3',
              question: 'What roles and permissions are available for workspace members?',
              answer: 'dbNexus provides granular Role-Based Access Control (RBAC):',
              bullets: [
                'Owner: Full control over workspace governance, billing management, and member invitations.',
                'Admin: Ability to invite members, manage project permissions, and approve schema changes.',
                'Member: Full access to create, edit, and collaborate on schemas and migration scripts.',
                'Viewer: Read-only access to inspect visual diagrams and table specifications without making edits.'
              ]
            }
          ]
        },
        {
          id: 'sub-education',
          title: 'Student Offer & Academic Licenses',
          items: [
            {
              id: 'faq-edu-1',
              question: 'Does dbNexus offer a free plan for students and educators?',
              answer: 'Yes! Through our Student Offer program, currently enrolled university and college students, as well as academic faculty, can claim 100% free access to dbNexus premium features.',
              linkText: 'Apply on the Student Offer Page',
              linkUrl: '/student-registration'
            },
            {
              id: 'faq-edu-2',
              question: 'How do I verify my student status?',
              answer: 'Visit our student verification page, enter your valid college email address (.edu or institutional domain), or upload a photo of your current student ID. Verification is completed via instant email OTP or brief admin review.'
            },
            {
              id: 'faq-edu-3',
              question: 'Can professors and teaching staff get licenses for a full class?',
              answer: 'Yes! Academic institutions and professors conducting database design courses can contact us for bulk classroom licenses and student vouchers.',
              linkText: 'Reach out to our Academic Support Team',
              linkUrl: '/contact'
            }
          ]
        }
      ]
    },
    {
      id: 'sec-app',
      title: 'dbNexus Application',
      subcategories: [
        {
          id: 'sub-designer',
          title: 'Visual Schema Designer & DBML',
          items: [
            {
              id: 'faq-designer-1',
              question: 'How does declarative schema modeling work in dbNexus?',
              answer: 'dbNexus combines declarative DBML (Database Markup Language) code with an interactive visual canvas. As you type table entities, column data types, constraints, and relationships in code, the ER diagram renders in real time. Changes made visually on the canvas automatically update the DBML code in sync.'
            },
            {
              id: 'faq-designer-2',
              question: 'Can I design schemas without connecting to a live database?',
              answer: 'Absolutely. dbNexus runs completely in the browser with a local-first design. You can design, brainstorm, and visualize schemas offline or in the cloud without needing a live database connection or local server installed.'
            },
            {
              id: 'faq-designer-3',
              question: 'Which database dialects are supported for import and export?',
              answer: 'dbNexus supports all leading enterprise and open-source database engines:',
              bullets: [
                'PostgreSQL (including CockroachDB and Supabase)',
                'MySQL & MariaDB',
                'Microsoft SQL Server (T-SQL)',
                'Oracle Database',
                'SQLite',
                'Snowflake'
              ]
            },
            {
              id: 'faq-designer-4',
              question: 'What are TableGroups and how do they organize large schemas?',
              answer: 'TableGroup is a powerful DBML construct that clusters related database tables into color-coded visual containers on the canvas (e.g., Auth, Billing, Orders). This provides clear modular architecture and prevents spaghetti diagrams in large enterprise schemas.'
            }
          ]
        },
        {
          id: 'sub-connect',
          title: 'Live DB Connect & Security',
          items: [
            {
              id: 'faq-connect-1',
              question: 'What is DB Connect and how does it reverse-engineer schemas?',
              answer: 'DB Connect enables you to establish a secure, direct connection to your live PostgreSQL, MySQL, or SQLite database. It reads schema metadata (information schema, tables, column types, foreign key constraints) to generate a high-fidelity visual diagram in seconds.',
              linkText: 'Learn more about DB Connect',
              linkUrl: '/features/db-connect'
            },
            {
              id: 'faq-connect-2',
              question: 'Does dbNexus access or store my actual database records?',
              answer: 'No, strictly never. dbNexus only queries structural catalog metadata (table names, column types, and foreign key definitions). Your table rows, customer records, and confidential application data are never read, transferred, or stored.'
            },
            {
              id: 'faq-connect-3',
              question: 'Can I connect to databases behind private VPCs or firewalls?',
              answer: 'Yes. You can establish connections using SSL/TLS encryption, SSH bastion tunnels, or by whitelisting our dedicated IP addresses in your cloud firewall (AWS RDS, Google Cloud SQL, Azure Database, Supabase, Neon).'
            }
          ]
        },
        {
          id: 'sub-compare',
          title: 'SQL Compare & Migration Scripts',
          items: [
            {
              id: 'faq-compare-1',
              question: 'What is SQL Compare / Diff Checker?',
              answer: 'SQL Compare is our side-by-side schema comparison tool. It analyzes two schema scripts or versions, highlighting structural additions, modifications, and deletions for tables, columns, indexes, and constraints.',
              linkText: 'Try SQL Compare now',
              linkUrl: '/diff'
            },
            {
              id: 'faq-compare-2',
              question: 'Can SQL Compare generate automated migration scripts?',
              answer: 'Yes. Once differences are analyzed, dbNexus generates ready-to-run forward (Up) and rollback (Down) DDL migration scripts compatible with your chosen database engine.'
            }
          ]
        },
        {
          id: 'sub-docs',
          title: 'DB Docs & Schema Documentation',
          items: [
            {
              id: 'faq-docs-1',
              question: 'What is DB Docs and what documentation does it generate?',
              answer: 'DB Docs transforms your schema and DBML field notes into a responsive, searchable web documentation portal with interactive relationship graphs, column dictionaries, and Markdown notes.',
              linkText: 'Explore DB Docs',
              linkUrl: '/features/db-docs'
            },
            {
              id: 'faq-docs-2',
              question: 'Can I password-protect or restrict my DB Docs?',
              answer: 'Yes. You can share DB Docs publicly, password-protect them with a secret passphrase, or restrict viewing exclusively to authenticated workspace members.'
            }
          ]
        },
        {
          id: 'sub-ai',
          title: 'AI Schema Assistant',
          items: [
            {
              id: 'faq-ai-1',
              question: 'What can the dbNexus AI Assistant do?',
              answer: 'Our integrated AI Assistant converts plain English prompts into validated DBML schemas, recommends indexing and constraint improvements, suggests normalization patterns, and generates sample seed queries.'
            }
          ]
        }
      ]
    },
    {
      id: 'sec-collaboration',
      title: 'Collaboration & Security',
      subcategories: [
        {
          id: 'sub-history',
          title: 'Version History & Snapshots',
          items: [
            {
              id: 'faq-hist-1',
              question: 'Does dbNexus keep track of diagram revisions?',
              answer: 'Yes. dbNexus automatically records version snapshots as you make changes to your schemas. You can inspect historical versions, compare changes, and restore any previous state with one click.'
            },
            {
              id: 'faq-hist-2',
              question: 'Can I save named release milestones?',
              answer: 'Yes. You can create named snapshots (e.g., v2.1-Production-Release) before executing major migrations or presenting to engineering teams.'
            }
          ]
        },
        {
          id: 'sub-sharing',
          title: 'Sharing, Export & Embeds',
          items: [
            {
              id: 'faq-share-1',
              question: 'Can I embed interactive diagrams into Notion, Confluence, or GitHub?',
              answer: 'Yes. dbNexus provides interactive iframe embed snippets and live sharing links that allow your engineering team to embed responsive, zoomable diagrams directly into internal wiki pages, Notion documents, and PR descriptions.'
            },
            {
              id: 'faq-share-2',
              question: 'What export formats are supported?',
              answer: 'You can export diagrams as vector SVG, PNG, formatted PDF documents, raw DBML source code, and production-ready SQL DDL scripts.'
            }
          ]
        },
        {
          id: 'sub-security',
          title: 'Data Security & Privacy',
          items: [
            {
              id: 'faq-sec-1',
              question: 'How is my schema data stored and protected?',
              answer: 'All data in transit is encrypted using industry-standard TLS 1.3, and cloud storage is encrypted at rest using AES-256. We follow strict security practices and zero-trust principles.'
            },
            {
              id: 'faq-sec-2',
              question: 'Where can I read your Privacy Policy and Terms of Service?',
              answer: 'You can review our legal policies anytime:',
              bullets: [
                'Privacy Policy: Covers data handling, analytics, and cookies.',
                'Terms of Service: Governs platform usage and service-level agreements.',
                'Refund Policy: Outlines subscription terms and billing rules.'
              ],
              linkText: 'Review our Privacy Policy',
              linkUrl: '/docs/privacy-policy'
            }
          ]
        }
      ]
    }
  ];

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
    this.updateActiveSubcategoryOnScroll();
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

  toggleItem(itemId: string): void {
    if (this.openItems.has(itemId)) {
      this.openItems.delete(itemId);
    } else {
      this.openItems.add(itemId);
    }
  }

  isItemOpen(itemId: string): boolean {
    if (this.searchQuery.trim().length > 1) {
      return true; // Auto-expand when user searches
    }
    return this.openItems.has(itemId);
  }

  isSectionActive(section: FaqSection): boolean {
    return section.subcategories.some(sub => sub.id === this.activeSubcategoryId);
  }

  clearSearch(): void {
    this.searchQuery = '';
  }

  scrollToSubcategory(subId: string): void {
    this.activeSubcategoryId = subId;
    if (typeof document !== 'undefined') {
      const el = document.getElementById(subId);
      if (el) {
        const yOffset = -90;
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }
  }

  private updateActiveSubcategoryOnScroll(): void {
    if (typeof document === 'undefined' || this.searchQuery.trim().length > 0) return;

    let currentActive = this.faqSections[0]?.subcategories[0]?.id || 'sub-plans';
    for (const section of this.faqSections) {
      for (const sub of section.subcategories) {
        const el = document.getElementById(sub.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 180) {
            currentActive = sub.id;
          }
        }
      }
    }
    if (this.activeSubcategoryId !== currentActive) {
      this.activeSubcategoryId = currentActive;
      this.cdr.markForCheck();
    }
  }

  get filteredSections(): FaqSection[] {
    const q = (this.searchQuery || '').trim().toLowerCase();
    if (!q) {
      return this.faqSections;
    }

    return this.faqSections
      .map(section => {
        const filteredSubs = section.subcategories
          .map(sub => {
            const matchingItems = sub.items.filter(item =>
              item.question.toLowerCase().includes(q) ||
              item.answer.toLowerCase().includes(q) ||
              (item.bullets && item.bullets.some(b => b.toLowerCase().includes(q)))
            );
            return {
              ...sub,
              items: matchingItems
            };
          })
          .filter(sub => sub.items.length > 0);

        return {
          ...section,
          subcategories: filteredSubs
        };
      })
      .filter(section => section.subcategories.length > 0);
  }

  get totalMatchingQuestions(): number {
    let count = 0;
    for (const s of this.filteredSections) {
      for (const sub of s.subcategories) {
        count += sub.items.length;
      }
    }
    return count;
  }

  ngOnInit(): void {
    this.seoService.updateTags({
      title: 'Frequently Asked Questions (FAQ) - dbNexus',
      description: 'Find comprehensive answers to frequently asked questions about dbNexus database modeling, DBML syntax, live DB Connect, SQL Compare, team workspaces, pricing, and student licenses.',
      url: 'https://www.dbnexus.io/faq',
      keywords: 'dbNexus FAQ, database schema questions, DBML FAQ, SQL Compare FAQ, DB Connect documentation, database modeling answers'
    });

    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': this.faqSections.flatMap(section =>
        section.subcategories.flatMap(sub =>
          sub.items.map(item => ({
            '@type': 'Question',
            'name': item.question,
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': item.answer
            }
          }))
        )
      )
    };
    this.seoService.setStructuredData(faqSchema);
  }
}
