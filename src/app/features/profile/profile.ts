import { Component, ChangeDetectorRef, Inject, PLATFORM_ID, afterNextRender, NgZone, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { HeaderComponent } from '../../core/layout/header/header';
import { LoaderComponent } from '../../shared/loader/loader';
import { Icons } from '../../core/component/icons/icons';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { AppConfigService } from '../../core/services/app-config.service';
import { CancellationModalComponent } from '../../shared/components/modals/cancellation-modal/cancellation-modal';
import { EnquiryService } from '../../core/services/enquiry.service';

export type ProfileTab = 'general' | 'subscription' | 'preferences' | 'enquiries';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HeaderComponent, LoaderComponent, Icons],
  templateUrl: './profile.html'
})
export class ProfileComponent {
  // Navigation & Tabs
  activeTab = signal<ProfileTab>('general');

  // User Profile Fields (Only displayName & base64Image are editable)
  displayName = signal<string>('');
  initialDisplayName = signal<string>('');
  email = signal<string>('');
  accountType = signal<string>('');
  orgRole = signal<string>('');
  isSuperAdmin = signal<boolean>(false);
  organizationName = signal<string>('');

  // Plan State (Supports free, student_plan, premium, team)
  planSlug = signal<string>('free');
  planStatus = signal<string>('active');
  apiPlans = signal<any[]>([]);
  subscriptionId = signal<number | null>(null);
  nextBillingRegular = signal<boolean>(false);
  offerExpiredNotice = signal<string | null>(null);
  currentPeriodEnd = signal<string | null>(null);

  effectiveRenewalDate = computed(() => {
    const end = this.currentPeriodEnd();
    if (!end) return 'your next billing date';
    try {
      const d = new Date(end);
      if (isNaN(d.getTime())) return 'your next billing date';
      return d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'your next billing date';
    }
  });

  // Avatar State
  previewUrl = signal<SafeUrl | null>(null);
  base64Image = signal<string | null>(null);
  initialBase64Image = signal<string | null>(null);

  // Status & Feedback
  isLoading = signal<boolean>(false);
  loadingText = signal<string>('Loading profile...');
  showSuccessMessage = signal<boolean>(false);
  showErrorMessage = signal<boolean>(false);
  errorMessage = signal<string>('');

  // Contact Sales Modal
  showContactModal = false;
  contactModalMessage = '';

  private http = inject(HttpClient);
  private appConfig = inject(AppConfigService);
  private enquiryService = inject(EnquiryService);

  // My Enquiries State
  myEnquiries = signal<any[]>([]);
  isLoadingEnquiries = signal<boolean>(false);
  enquiriesError = signal<string | null>(null);
  enquirySearch = signal<string>('');
  enquiryStatusFilter = signal<string>('');
  showStatusFilterDropdown = signal<boolean>(false);
  openRowDropdownId = signal<any>(null);
  openRowDropdownUpward = signal<boolean>(false);

  filteredEnquiries = computed(() => {
    const term = this.enquirySearch().toLowerCase().trim();
    const statusFilter = this.enquiryStatusFilter();
    let list = this.myEnquiries();

    if (statusFilter) {
      list = list.filter(item => this.getEnquiryStatusValue(item.status) === statusFilter);
    }

    if (!term) return list;

    return list.filter(item => {
      const subject = (item.subject || '').toLowerCase();
      const type = (item.enquiry_type || item.contact_type || '').toLowerCase();
      const details = (item.project_details || item.message || '').toLowerCase();
      const email = (item.company_email || item.email || '').toLowerCase();
      const status = (item.status || '').toLowerCase();
      return subject.includes(term) || type.includes(term) || details.includes(term) || email.includes(term) || status.includes(term);
    });
  });

  // Computed Properties
  isDirty = computed(() => {
    return (
      this.displayName().trim() !== this.initialDisplayName().trim() ||
      this.base64Image() !== this.initialBase64Image()
    );
  });

  currentTheme = computed(() => this.dashService.theme());

  constructor(
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    public auth: AuthService,
    public dashService: DashboardService,
    private router: Router,
    private location: Location,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    afterNextRender(() => {
      this.ngZone.run(() => {
        this.fetchUserDetails();
        this.fetchActivePlan();
      });
    });
  }

  fetchUserDetails(): void {
    if (isPlatformBrowser(this.platformId)) {
      const savedEmail = localStorage.getItem('profile_email') || this.auth.getUserEmail();
      if (savedEmail) {
        this.email.set(savedEmail);
      }

      this.accountType.set(this.auth.getAccountType() || 'Individual');
      this.orgRole.set(this.auth.getOrgRole() || 'Member');
      this.isSuperAdmin.set(this.auth.isSuperAdmin());
      if (this.isSuperAdmin() && this.activeTab() === 'enquiries') {
        this.activeTab.set('general');
      }

      const savedPic = this.auth.getUserProfilePicture();
      if (savedPic) {
        this.previewUrl.set(this.sanitizer.bypassSecurityTrustUrl(savedPic));
        this.base64Image.set(savedPic);
        this.initialBase64Image.set(savedPic);
      } else {
        this.previewUrl.set(null);
        this.base64Image.set('');
        this.initialBase64Image.set('');
      }

      this.isLoading.set(true);
      this.loadingText.set('Loading profile...');
      this.auth.getUserDetails().subscribe({
        next: (res) => {
          this.isLoading.set(false);
          const user = res?.data || res;
          if (user) {
            const name = user.username || user.userName || user.name || (this.email() ? this.email().split('@')[0] : '');
            this.displayName.set(name);
            this.initialDisplayName.set(name);

            const email = user.email || this.email();
            this.email.set(email);

            if (user.accountType || user.account_type) {
              this.accountType.set(user.accountType || user.account_type);
            }
            if (user.role || user.orgRole) {
              this.orgRole.set(user.role || user.orgRole);
            }
            if (user.organization || user.organizationName) {
              this.organizationName.set(user.organization || user.organizationName);
            }

            const profilePic = user.profilepicture || user.profilePicture;
            if (profilePic && profilePic.trim() !== '') {
              this.previewUrl.set(this.sanitizer.bypassSecurityTrustUrl(profilePic));
              this.base64Image.set(profilePic);
              this.initialBase64Image.set(profilePic);
              this.auth.setUserProfilePicture(profilePic);
            } else {
              this.previewUrl.set(null);
              this.base64Image.set('');
              this.initialBase64Image.set('');
              this.auth.setUserProfilePicture('');
            }
          }
        },
        error: (err) => {
          this.isLoading.set(false);
          console.error('Failed to get user details:', err);
          if (!this.displayName() && this.email()) {
            const fallbackName = this.email().split('@')[0];
            this.displayName.set(fallbackName);
            this.initialDisplayName.set(fallbackName);
          }
        }
      });
    }
  }

  fetchActivePlan(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const orgId = this.auth.getOrganizationId() || undefined;

    // Fetch user features which includes active purchasedPlan
    this.auth.getUserFeatures(orgId).subscribe({
      next: (res) => {
        const plan = res?.data?.purchasedPlan || res?.data?.plan || res?.data?.activePlan;
        if (plan) {
          if (plan.subscription_id || plan.id) {
            this.subscriptionId.set(plan.subscription_id || plan.id);
          }

          this.nextBillingRegular.set(!!plan.next_billing_regular);
          this.offerExpiredNotice.set(plan.offer_expired_notice || null);
          this.currentPeriodEnd.set(plan.current_period_end || null);

          const rawSlug = (plan.slug || plan.name || '').toLowerCase();
          if (rawSlug.includes('student')) {
            this.planSlug.set('student_plan');
            this.auth.setCurrentPlanSlug('student_plan');
          } else if (rawSlug.includes('team')) {
            this.planSlug.set('team');
            this.auth.setCurrentPlanSlug('team');
          } else if (rawSlug.includes('premium') || rawSlug.includes('pro')) {
            this.planSlug.set('premium');
            this.auth.setCurrentPlanSlug('premium');
          } else {
            this.planSlug.set('free');
            this.auth.setCurrentPlanSlug('free');
          }

          if (plan.status) {
            this.planStatus.set(plan.status);
            this.auth.setCurrentPlanStatus(plan.status);
          }
        }
      },
      error: () => {
        const cached = (this.auth.getCurrentPlanSlug() || localStorage.getItem('cachedPlanSlug') || 'free').toLowerCase();
        if (cached.includes('student')) {
          this.planSlug.set('student_plan');
        } else if (cached.includes('team')) {
          this.planSlug.set('team');
        } else if (cached.includes('premium') || cached.includes('pro')) {
          this.planSlug.set('premium');
        } else {
          this.planSlug.set('free');
        }
      }
    });

    // Call pricing plans API to fetch live plans if configured
    const plansUrl = this.appConfig.environment?.pricingApiUrls?.plans;
    if (plansUrl) {
      this.http.get<any>(plansUrl).subscribe({
        next: (res) => {
          const list = res?.data || res;
          if (Array.isArray(list)) {
            // Keep only the 3 recognized plans: free, premium, team
            this.apiPlans.set(list.filter(p => ['free', 'premium', 'team'].includes((p.slug || '').toLowerCase())));
          }
        },
        error: (err) => {
          console.warn('Could not load pricing plans list from API:', err);
        }
      });
    }
  }

  saveProfile(): void {
    if (!this.displayName().trim()) {
      this.dashService.showToast('Display name cannot be empty.', 3000, 'error');
      return;
    }

    const payload = {
      userName: this.displayName().trim(),
      profilePicture: this.base64Image() ?? ''
    };

    this.isLoading.set(true);
    this.loadingText.set('Saving profile...');
    this.auth.updateProfile(payload).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.dashService.showToast('Your profile has been saved successfully!', 3000, 'success');

        // Immediately call api/user-details to refresh user details and reflect removed/updated profile picture
        this.auth.getUserDetails().subscribe({
          next: (userRes) => {
            const user = userRes?.data || userRes;
            if (user) {
              const name = user.username || user.userName || user.name || (this.email() ? this.email().split('@')[0] : '');
              this.displayName.set(name);
              this.initialDisplayName.set(name);

              const email = user.email || this.email();
              this.email.set(email);

              const profilePic = user.profilepicture || user.profilePicture;
              if (profilePic && profilePic.trim() !== '') {
                this.previewUrl.set(this.sanitizer.bypassSecurityTrustUrl(profilePic));
                this.base64Image.set(profilePic);
                this.initialBase64Image.set(profilePic);
                this.auth.setUserProfilePicture(profilePic);
              } else {
                this.previewUrl.set(null);
                this.base64Image.set('');
                this.initialBase64Image.set('');
                this.auth.setUserProfilePicture('');
              }
              this.cdr.detectChanges();
            }
          },
          error: (err) => {
            console.error('Failed to refresh user details after profile update:', err);
            if (!this.base64Image() || this.base64Image() === '') {
              this.previewUrl.set(null);
              this.auth.setUserProfilePicture('');
            }
            this.initialDisplayName.set(this.displayName().trim());
            this.initialBase64Image.set(this.base64Image());
            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Failed to update profile:', err);
        const msg = err?.error?.message || err?.message || 'Failed to update profile.';
        this.dashService.showToast(msg, 4000, 'error');
      }
    });
  }

  onFileSelected(event: any): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      const fileName = (file.name || '').toLowerCase();
      const hasAllowedExtension =
        fileName.endsWith('.png') ||
        fileName.endsWith('.jpg') ||
        fileName.endsWith('.jpeg') ||
        fileName.endsWith('.webp');

      const isTypeValid = (file.type && allowedTypes.includes(file.type.toLowerCase())) || hasAllowedExtension;

      if (!isTypeValid) {
        const errorMsg = 'Only PNG, JPG, and WEBP files are allowed.';
        this.dashService.showToast(errorMsg, 4000, 'error');
        input.value = '';
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        const errorMsg = 'Image size exceeds 5MB limit. Please choose a smaller file.';
        this.dashService.showToast(errorMsg, 4000, 'error');
        input.value = '';
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      this.previewUrl.set(this.sanitizer.bypassSecurityTrustUrl(objectUrl));

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.base64Image.set(e.target.result);
      };
      reader.readAsDataURL(file);
      input.value = '';
    }
  }

  removePhoto(): void {
    this.previewUrl.set(null);
    this.base64Image.set('');
    this.auth.setUserProfilePicture('');
  }

  getInitials(): string {
    const name = this.displayName() || this.email() || 'User';
    const clean = name.trim().replace(/[@._-]+/g, ' ');
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name.charAt(0) || 'U').toUpperCase();
  }

  getRoleBadgeLabel(): string {
    if (this.isSuperAdmin()) return 'Super Admin';
    if (this.auth.isOrganizationAdmin()) return 'Org Admin';
    if (this.accountType().toLowerCase() === 'organization') return 'Org Member';
    return 'Developer';
  }

  getPlanBadgeLabel(): string {
    const p = this.planSlug().toLowerCase();
    if (p.includes('student')) return 'Student';
    if (p === 'team') return 'Team';
    if (p === 'premium' || p === 'pro') return 'Premium';
    return 'Free';
  }

  setTab(tab: ProfileTab): void {
    if (this.isSuperAdmin() && tab === 'enquiries') {
      this.activeTab.set('general');
      return;
    }
    this.activeTab.set(tab);
    if (tab === 'enquiries' && !this.isSuperAdmin()) {
      this.fetchMyEnquiries();
    }
  }

  fetchMyEnquiries(): void {
    if (this.isSuperAdmin()) return;
    this.isLoadingEnquiries.set(true);
    this.enquiriesError.set(null);
    this.enquiryService.getMyEnquiries().subscribe({
      next: (res) => {
        this.isLoadingEnquiries.set(false);
        const list = res?.data || res?.enquiries || (Array.isArray(res) ? res : []);
        this.myEnquiries.set(list);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoadingEnquiries.set(false);
        console.error('Failed to load my enquiries:', err);
        const msg = err?.error?.message || err?.message || 'Unable to load enquiries at this time.';
        this.enquiriesError.set(msg);
        this.cdr.detectChanges();
      }
    });
  }

  getEnquiryStatusValue(status?: string | null): string {
    const s = (status || '').toLowerCase().trim();
    if (s === 'closed' || s === 'close' || s === 'resolved') {
      return 'closed';
    }
    return 'reopen';
  }

  isReOpen(status?: string | null): boolean {
    return this.getEnquiryStatusValue(status) === 'reopen';
  }

  isClosed(status?: string | null): boolean {
    return this.getEnquiryStatusValue(status) === 'closed';
  }

  onEnquiryStatusChange(eq: any, newStatus: string): void {
    if (!eq || this.isClosed(eq.status)) return;
    const payloadStatus = (newStatus === 'close' || newStatus === 'closed') ? 'closed' : 'reopen';
    eq.status = payloadStatus;
    this.cdr.detectChanges();

    const id = eq.id || eq.enquiry_id || eq._id;
    const displayStatusLabel = payloadStatus === 'closed' ? 'Close' : 'Re-open';
    if (id) {
      this.enquiryService.updateEnquiryStatus(id, payloadStatus).subscribe({
        next: () => {
          this.dashService.showToast(`Status updated to ${displayStatusLabel}.`, 3000, 'success');
        },
        error: (err) => {
          console.warn('Update enquiry status error:', err);
          this.dashService.showToast(`Status updated to ${displayStatusLabel}.`, 3000, 'success');
        }
      });
    } else {
      this.dashService.showToast(`Status updated to ${displayStatusLabel}.`, 3000, 'success');
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.showStatusFilterDropdown.set(false);
    this.openRowDropdownId.set(null);
    this.openRowDropdownUpward.set(false);
  }

  toggleStatusFilterDropdown(event: Event): void {
    event.stopPropagation();
    this.openRowDropdownId.set(null);
    this.openRowDropdownUpward.set(false);
    this.showStatusFilterDropdown.set(!this.showStatusFilterDropdown());
  }

  selectStatusFilter(val: string): void {
    this.enquiryStatusFilter.set(val);
    this.showStatusFilterDropdown.set(false);
  }

  getStatusFilterLabel(): string {
    const filter = this.enquiryStatusFilter();
    if (filter === 'reopen') return 'Re-open';
    if (filter === 'closed') return 'Close';
    return 'All Statuses';
  }

  toggleRowDropdown(id: any, event: Event, eq?: any, index?: number): void {
    event.stopPropagation();
    if (eq && this.isClosed(eq.status)) return;
    this.showStatusFilterDropdown.set(false);

    if (this.openRowDropdownId() === id) {
      this.openRowDropdownId.set(null);
      this.openRowDropdownUpward.set(false);
      return;
    }

    this.openRowDropdownId.set(id);

    const total = this.filteredEnquiries().length;
    const hasEnoughSpaceAbove = index !== undefined && index >= 1;
    const isNearBottom = index !== undefined && index >= total - 2;

    const target = event.currentTarget as HTMLElement;
    let isNearViewportBottom = false;
    if (target) {
      const rect = target.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      isNearViewportBottom = spaceBelow < 120;
    }

    this.openRowDropdownUpward.set(hasEnoughSpaceAbove && (isNearBottom || isNearViewportBottom));
  }

  onRowStatusSelect(eq: any, newStatus: string): void {
    this.openRowDropdownId.set(null);
    this.openRowDropdownUpward.set(false);
    if (eq && this.isClosed(eq.status)) return;
    this.onEnquiryStatusChange(eq, newStatus);
  }

  selectTheme(theme: 'dark' | 'light'): void {
    if (this.currentTheme() !== theme) {
      this.dashService.toggleTheme();
    }
  }

  goToPricing(): void {
    this.router.navigate(['/pricing']);
  }

  goToDashboard(): void {
    this.auth.getUserDetails().subscribe({
      next: (res) => {
        const user = res?.data || res;
        if (user) {
          const profilePic = user.profilepicture || user.profilePicture;
          if (profilePic && profilePic.trim() !== '') {
            this.auth.setUserProfilePicture(profilePic);
          } else {
            this.auth.setUserProfilePicture('');
          }
        }
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.router.navigate(['/dashboard']);
      }
    });
  }

  goBack(): void {
    this.auth.getUserDetails().subscribe({
      next: (res) => {
        const user = res?.data || res;
        if (user) {
          const profilePic = user.profilepicture || user.profilePicture;
          if (profilePic && profilePic.trim() !== '') {
            this.auth.setUserProfilePicture(profilePic);
          } else {
            this.auth.setUserProfilePicture('');
          }
          const email = user.email;
          if (email) {
            this.auth.setUserEmail(email);
          }
        }
        this.location.back();
      },
      error: (err) => {
        console.error('Failed to get user details on back:', err);
        this.location.back();
      }
    });
  }

  showCancelModal = false;

  requestCancellation(): void {
    const subId = this.subscriptionId();
    if (!subId) {
      this.dashService.showToast('Could not find active subscription to cancel.', 3000, 'error');
      return;
    }
    this.showCancelModal = true;
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
  }

  executeCancellation(): void {
    const subId = this.subscriptionId();
    if (!subId) return;

    this.closeCancelModal();
    this.isLoading.set(true);
    this.loadingText.set('Cancelling subscription...');
    const url = this.appConfig.environment?.apiConfig?.baseUrl ? `${this.appConfig.environment.apiConfig.baseUrl}/api/payments/cancel-subscription` : 'http://localhost:4000/api/payments/cancel-subscription';
    
    this.http.post<any>(url, { subscriptionId: subId }, { withCredentials: true }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.closeCancelModal(); // Close the modal
        // We use dashService toast, no need for the local success message overlap
        this.dashService.showToast(res.message || 'Your auto renewal will be canceled at the end of the billing cycle.', 4000, 'success');
        this.fetchActivePlan();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.closeCancelModal(); // Close the modal
        this.dashService.showToast(err.error?.error || 'Failed to cancel auto renewal.', 4000, 'error');
      }
    });
  }

  closeContactModal(): void {
    this.showContactModal = false;
  }
}
