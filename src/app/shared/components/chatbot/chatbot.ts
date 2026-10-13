import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { ChatbotService, ChatbotCategory, ChatbotNode } from '../../../core/services/chatbot.service';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';

export interface ChatMessage {
  sender: 'bot' | 'user';
  text?: string;
  node?: ChatbotNode;
  options?: any[];
  time: string;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './chatbot.html',
  styleUrl: './chatbot.scss'
})
export class ChatbotComponent implements OnInit, OnDestroy {
  private readonly chatbotService = inject(ChatbotService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly dashboardSvc = inject(DashboardService, { optional: true });
  private readonly themeSub = new Subscription();

  constructor() {
    if (this.dashboardSvc) {
      effect(() => {
        // Automatically re-evaluate when dashboard theme signal changes
        this.dashboardSvc?.theme();
        this.cdr.markForCheck();
      });
    }
  }

  isLightTheme(): boolean {
    if (typeof document !== 'undefined') {
      // 1. Explicit dark theme indicators on DOM take absolute precedence
      if (
        document.documentElement.getAttribute('data-theme') === 'dark' ||
        document.body.classList.contains('dark-theme') ||
        document.documentElement.classList.contains('dark-theme')
      ) {
        return false;
      }

      // 2. Explicit light theme indicators on DOM
      if (
        document.body.classList.contains('light-theme') ||
        document.documentElement.classList.contains('light-theme') ||
        document.documentElement.getAttribute('data-theme') === 'light'
      ) {
        return true;
      }
    }

    // 3. Check localStorage saved theme directly
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('theme');
        if (saved === 'dark') return false;
        if (saved === 'light') return true;
      } catch (_) {}
    }

    // 4. Fallback to DashboardService theme signal
    if (this.dashboardSvc) {
      return this.dashboardSvc.theme() === 'light';
    }

    // 5. Default in SchemaFlow is dark
    return false;
  }

  isOpen = false;
  isLoading = false;
  isLoggedIn = false;

  categories: ChatbotCategory[] = [];
  selectedCategory: ChatbotCategory | null = null;
  currentNodes: ChatbotNode[] = [];
  currentNode: ChatbotNode | null = null;

  // Views: 'categories' | 'sub_menu' | 'answer' | 'search_results' | 'escalate'
  currentView: 'categories' | 'sub_menu' | 'answer' | 'search_results' | 'escalate' = 'categories';
  navStack: Array<{ view: any; data?: any }> = [];

  searchQuery = '';
  searchResults: ChatbotNode[] = [];
  searchFallbackMessage = '';
  searchFallbackOptions: any[] = [];

  feedbackGiven: { [nodeId: number]: boolean | null } = {};

  // Support ticket form model
  enquiryForm = {
    firstName: '',
    lastName: '',
    companyEmail: '',
    phoneNumber: '',
    subject: '',
    message: '',
    enquiryType: 'Support'
  };
  isSubmittingTicket = false;
  ticketSubmittedSuccess = false;
  ticketId: number | null = null;

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.isLoggedIn = this.auth.isLoggedIn();
      this.prefillUser();
    }
    if (this.dashboardSvc) {
      this.themeSub.add(
        this.dashboardSvc.forceRedraw$.subscribe(() => {
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        })
      );
    }
  }

  ngOnDestroy(): void {
    this.themeSub.unsubscribe();
  }

  private prefillUser(): void {
    if (this.isLoggedIn && typeof window !== 'undefined') {
      const email = this.auth.getUserEmail();
      if (email) {
        this.enquiryForm.companyEmail = email;
      }
    }
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen && this.categories.length === 0) {
      this.initializeChatbot();
    }
    this.cdr.detectChanges();
  }

  initializeChatbot(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

    this.chatbotService.initSession(currentPath).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.categories = res?.data?.categories || [];
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error('Failed to init chatbot session:', err);
        // Fallback: try fetching categories directly
        this.chatbotService.getCategories().subscribe({
          next: (catRes) => {
            this.ngZone.run(() => {
              this.categories = catRes?.data || [];
              this.isLoading = false;
              this.cdr.detectChanges();
            });
          },
          error: () => {
            this.ngZone.run(() => {
              this.isLoading = false;
              this.cdr.detectChanges();
            });
          }
        });
      }
    });
  }

  // ── Navigation Methods ──

  selectCategory(category: ChatbotCategory): void {
    this.pushNavState();
    this.selectedCategory = category;
    this.isLoading = true;
    this.currentView = 'sub_menu';
    this.cdr.detectChanges();

    this.chatbotService.getCategoryNodes(category.category_id).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.currentNodes = res?.data || [];
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  selectNode(nodeId: number): void {
    this.pushNavState();
    this.isLoading = true;
    this.cdr.detectChanges();

    this.chatbotService.getNodeDetail(nodeId).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.currentNode = res?.data || null;
          this.currentView = 'answer';
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  private isDbConnectOption(opt: any): boolean {
    if (!opt) return false;
    if (opt.action === 'db_connect' || opt.action === 'open_db_connect') return true;
    if (opt.url === '/features/db-connect') return true;
    if (typeof opt.label === 'string' && /test connection|connect to database/i.test(opt.label)) return true;
    return false;
  }

  openDbConnectModal(): void {
    if (this.router.url.includes('/dashboard')) {
      this.dashboardSvc?.openConnectionStringModal();
    } else {
      if (this.dashboardSvc) {
        this.dashboardSvc.pendingOpenConnectionStringModal = true;
      }
      this.router.navigate(['/dashboard']).then(() => {
        setTimeout(() => {
          if (this.dashboardSvc?.pendingOpenConnectionStringModal) {
            this.dashboardSvc.pendingOpenConnectionStringModal = false;
            this.dashboardSvc.openConnectionStringModal();
          }
        }, 150);
      });
    }
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      this.isOpen = false;
    }
    this.cdr.detectChanges();
  }

  handleOptionClick(opt: any): void {
    if (opt.nextNodeId) {
      this.selectNode(opt.nextNodeId);
    } else if (opt.action === 'escalate') {
      this.openEscalateForm(this.currentNode?.title);
    } else if (opt.action === 'show_categories') {
      this.goToMainMenu();
    } else if (this.isDbConnectOption(opt)) {
      this.openDbConnectModal();
    } else if (opt.action === 'link' && opt.url) {
      this.navigateToActionUrl(opt.url);
    }
  }

  navigateToActionUrl(url?: string | null): void {
    if (!url) return;
    if (url === '/features/db-connect') {
      this.openDbConnectModal();
      return;
    }
    if (url.startsWith('http')) {
      window.open(url, '_blank');
    } else {
      this.router.navigateByUrl(url);
      if (typeof window !== 'undefined' && window.innerWidth < 640) {
        this.isOpen = false;
      }
    }
    this.cdr.detectChanges();
  }

  goBack(): void {
    if (this.navStack.length > 0) {
      const prev = this.navStack.pop();
      if (prev) {
        this.currentView = prev.view;
        if (prev.view === 'categories') {
          this.selectedCategory = null;
          this.currentNode = null;
        } else if (prev.view === 'sub_menu') {
          this.selectedCategory = prev.data?.category || this.selectedCategory;
          this.currentNodes = prev.data?.nodes || this.currentNodes;
          this.currentNode = null;
        } else if (prev.view === 'answer') {
          this.currentNode = prev.data?.node || null;
        }
        this.cdr.detectChanges();
        return;
      }
    }
    this.goToMainMenu();
  }

  goToMainMenu(): void {
    this.navStack = [];
    this.currentView = 'categories';
    this.selectedCategory = null;
    this.currentNode = null;
    this.searchQuery = '';
    this.searchResults = [];
    this.ticketSubmittedSuccess = false;
    this.cdr.detectChanges();
  }

  private pushNavState(): void {
    this.navStack.push({
      view: this.currentView,
      data: {
        category: this.selectedCategory,
        nodes: this.currentNodes,
        node: this.currentNode
      }
    });
  }

  // ── Search & Fallback ──

  onSearch(): void {
    const q = this.searchQuery.trim();
    if (!q) return;

    this.pushNavState();
    this.isLoading = true;
    this.currentView = 'search_results';
    this.cdr.detectChanges();

    this.chatbotService.search(q).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.isLoading = false;
          if (res.data?.matched && res.data.results && res.data.results.length > 0) {
            this.searchResults = res.data.results;
            this.searchFallbackMessage = '';
            this.searchFallbackOptions = [];
          } else {
            this.searchResults = [];
            this.searchFallbackMessage = res.data?.message || "I couldn't find an answer for that. As a guided assistant, I can help you with dbNexus features, connections, or billing.";
            this.searchFallbackOptions = res.data?.options || [
              { label: '📂 Browse Support Categories', action: 'show_categories' },
              { label: '📖 View Documentation', action: 'link', url: '/docs' },
              { label: '📩 Contact Support Team', action: 'escalate' }
            ];
          }
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.isLoading = false;
          this.searchResults = [];
          this.searchFallbackMessage = "Unable to complete search. Please browse categories below.";
          this.searchFallbackOptions = [{ label: '📂 Browse Support Categories', action: 'show_categories' }];
          this.cdr.detectChanges();
        });
      }
    });
  }

  // ── Feedback (Thumbs Up / Down) ──

  submitFeedback(wasHelpful: boolean): void {
    if (!this.currentNode) return;
    const nodeId = this.currentNode.node_id;
    this.feedbackGiven[nodeId] = wasHelpful;
    this.cdr.detectChanges();

    this.chatbotService.logFeedback(nodeId, wasHelpful).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.cdr.detectChanges();
        });
      },
      error: () => {}
    });
  }

  // ── Escalation to Support Ticket ──

  openEscalateForm(prefillSubject?: string): void {
    this.pushNavState();
    this.currentView = 'escalate';
    this.ticketSubmittedSuccess = false;
    this.prefillUser();

    if (prefillSubject) {
      this.enquiryForm.subject = `Need Help: ${prefillSubject}`;
    }
    this.cdr.detectChanges();
  }

  submitTicket(): void {
    if (!this.enquiryForm.firstName || !this.enquiryForm.companyEmail || !this.enquiryForm.message) {
      return;
    }

    this.isSubmittingTicket = true;
    this.cdr.detectChanges();

    this.chatbotService.escalateTicket({
      first_name: this.enquiryForm.firstName,
      last_name: this.enquiryForm.lastName,
      company_email: this.enquiryForm.companyEmail,
      phone_number: this.enquiryForm.phoneNumber,
      subject: this.enquiryForm.subject || 'Support Ticket via Chatbot',
      message: this.enquiryForm.message,
      enquiry_type: this.enquiryForm.enquiryType
    }).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.isSubmittingTicket = false;
          this.ticketSubmittedSuccess = true;
          this.ticketId = res.data?.ticketId || null;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.isSubmittingTicket = false;
          this.cdr.detectChanges();
          alert(err?.error?.message || 'Failed to submit ticket. Please try again.');
        });
      }
    });
  }

  formatContent(content?: string | null): SafeHtml {
    if (!content) return '';
    return this.sanitizer.bypassSecurityTrustHtml(this.parseMarkdown(content));
  }

  private parseMarkdown(content: string): string {
    if (!content) return '';

    let res = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    // Convert list bullets at line start: "* " or "- "
    res = res.replace(/^(\s*)[*-]\s+/gm, '$1• ');

    // Links: [text](url)
    res = res.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, 
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Inline code: `code`
    res = res.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // Triple asterisks: ***text***
    res = res.replace(/\*{3}([^*\n]+?)\*{3}/g, '<strong><em>$1</em></strong>');

    // Standard Bold: **text** or __text__
    res = res.replace(/(\*\*|__)([^*\n_]+?)\1/g, '<strong>$2</strong>');

    // Mismatched / loose asterisks for bold, e.g. *Check Popup Blockers**: or **Check Popup Blockers*:
    res = res.replace(/\*(?!\s)([^*\n]+?)\*\*(?=:|\s|$|[.,!?])/g, '<strong>$1</strong>');
    res = res.replace(/\*\*(?!\s)([^*\n]+?)\*(?=:|\s|$|[.,!?])/g, '<strong>$1</strong>');

    // Single-asterisk section titles before colon: *Check Popup Blockers*: or 1. *Title*:
    res = res.replace(/(^|[\n\r]|•|\d+\.)\s*\*([^*\n:]+?)\*:/g, '$1 <strong>$2</strong>:');

    // Italic: *text* or _text_
    res = res.replace(/(?:\*(?!\s)([^*\n]+?)\*|_(?!\s)([^*\n_]+?)_)/g, (m, p1, p2) => '<em>' + (p1 || p2) + '</em>');

    // Strikethrough: ~~text~~
    res = res.replace(/~~([^~\n]+?)~~/g, '<del>$1</del>');

    return res;
  }
}
