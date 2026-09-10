import { Component, Input, Output, EventEmitter, OnInit, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../../../core/services/dashboard.service';
import { AppConfigService } from '../../../../core/services/app-config.service';

@Component({
  selector: 'app-share-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './share-modal.html'
})
export class ShareModalComponent implements OnInit {
  @Input() visible = false;
  @Output() close = new EventEmitter<void>();

  // Using the dashboard service to get the active diagram's details
  get diagramId(): number | null {
    return this.svc.diagramId();
  }

  get diagramName(): string {
    return this.svc.diagramName || 'Untitled Diagram';
  }
  
  isPublic = true;
  password = '';
  emailsInput = '';
  sendingEmails = false;
  savingStatus = false;
  showPassword = false;
  
  activeTab: 'sharing' | 'embedding' = 'sharing';
  invitePermission = 'can view';
  sharePermission = 'Viewer';
  
  linkCopied = false;
  /*
  embedCopied = false;

  embedEnabled = false;
  embedDarkMode = false;
  embedHighlight = false;
  
  embedUseDetailLevel = true;
  embedDetailLevel: 'all' | 'key' | 'table' = 'all';
  
  embedUseLinkType = true;
  embedLinkType: 'smooth' | 'straight' = 'straight';

  showDetailLevelDropdown = false;
  showLinkTypeDropdown = false;
  */

  constructor(
    public svc: DashboardService,
    private appConfig: AppConfigService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
  }

  ngOnChanges(changes: any): void {
    if (changes['visible'] && this.visible) {
      this.isPublic = this.svc.isDiagramPublic;
      this.password = this.svc.diagramPassword;
      this.showPassword = false;
      /*
      if (!this.isPublic && this.activeTab === 'embedding') {
        this.activeTab = 'sharing';
      }
      */
    }
  }

  closeModal(): void {
    this.isPublic = true;
    this.password = '';
    this.emailsInput = '';
    this.activeTab = 'sharing';
    this.invitePermission = 'can view';
    /*
    this.embedEnabled = false;
    this.embedDarkMode = false;
    this.embedHighlight = false;
    this.embedUseDetailLevel = true;
    this.embedDetailLevel = 'all';
    this.embedUseLinkType = true;
    this.embedLinkType = 'straight';
    */
    this.close.emit();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: any): void {
    if (this.visible) {
      this.closeModal();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    /*
    this.showDetailLevelDropdown = false;
    this.showLinkTypeDropdown = false;
    */
  }

  togglePublicStatus(): void {
    this.isPublic = !this.isPublic;
  }

  saveSharingSettings(): void {
    if (!this.diagramId) return;
    
    if (this.isPublic) {
      this.password = ''; // Clear password when making it public
    } else if (!this.password) {
      this.svc.showToast('Password is required for protected sharing.', 3000, 'error');
      return;
    }

    this.savingStatus = true;
    this.svc.toggleDiagramSharingStatus(this.diagramId, this.isPublic, this.password).subscribe({
      next: () => {
        this.savingStatus = false;
        this.svc.isDiagramPublic = this.isPublic;
        this.svc.diagramPassword = this.password;
        this.cdr.detectChanges();
        this.svc.showToast('Sharing settings updated successfully.', 3000, 'success');
      },
      error: (err) => {
        this.savingStatus = false;
        this.cdr.detectChanges();
        this.svc.showToast(err?.error?.message || 'Failed to update sharing settings.', 3000, 'error');
      }
    });
  }

  sendEmails(): void {
    if (!this.diagramId) return;
    
    // Parse emails from input
    const rawEmails = this.emailsInput.split(/[\s,]+/).map(e => e.trim()).filter(e => e.length > 0);
    
    if (rawEmails.length === 0) {
      this.svc.showToast('Please enter at least one valid email address.', 3000, 'error');
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = rawEmails.filter(email => !emailRegex.test(email));
    
    if (invalidEmails.length > 0) {
      this.svc.showToast(`Invalid email(s): ${invalidEmails.join(', ')}`, 3000, 'error');
      return;
    }

    this.sendingEmails = true;
    this.svc.shareDiagramViaEmail(this.diagramId, rawEmails, this.sharePermission).subscribe({
      next: () => {
        this.sendingEmails = false;
        this.emailsInput = '';
        this.cdr.detectChanges();
        this.svc.showToast('Diagram shared successfully.', 3000, 'success');
      },
      error: (err) => {
        this.sendingEmails = false;
        this.cdr.detectChanges();
        this.svc.showToast(err?.error?.message || 'Failed to send invitations.', 3000, 'error');
      }
    });
  }

  getShareLink(): string {
    const token = (this.svc as any).publicToken || 'TOKEN_PENDING';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/public-diagram/${token}`;
  }

  /*
  getEmbedCode(): string {
    const link = this.getShareLink();
    const queryParams = [];
    if (this.embedDarkMode) {
      queryParams.push('theme=dark');
    } else {
      queryParams.push('theme=light');
    }
    
    if (this.embedHighlight) {
      queryParams.push('highlight=true');
    }
    
    if (this.embedUseDetailLevel) {
      queryParams.push(`detailLevel=${this.embedDetailLevel}`);
    }
    
    if (this.embedUseLinkType) {
      queryParams.push(`linkType=${this.embedLinkType}`);
    }
    
    const queryString = queryParams.length ? '?' + queryParams.join('&') : '';
    return `<iframe src="${link}${queryString}" width="100%" height="600" style="border:1px solid #ccc; border-radius: 4px;"></iframe>`;
  }
  */

  copyToClipboard(text: string, type: 'link' | 'embed'): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        if (type === 'link') {
          this.linkCopied = true;
          this.cdr.detectChanges();
          setTimeout(() => {
            this.linkCopied = false;
            this.cdr.detectChanges();
          }, 2000);
        } /* else {
          this.embedCopied = true;
          this.cdr.detectChanges();
          setTimeout(() => {
            this.embedCopied = false;
            this.cdr.detectChanges();
          }, 2000);
        } */
      });
    }
  }
}
