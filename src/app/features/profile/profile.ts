import { Component, ChangeDetectorRef, Inject, PLATFORM_ID, afterNextRender, NgZone, signal, computed, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { HeaderComponent } from '../../core/layout/header/header';
import { LoaderComponent } from '../../shared/loader/loader';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { AppConfigService } from '../../core/services/app-config.service';

export type ProfileTab = 'general' | 'subscription' | 'preferences';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HeaderComponent, LoaderComponent],
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

  // Plan State (Only 3 supported plans: free, premium, team)
  planSlug = signal<'free' | 'premium' | 'team'>('free');
  planStatus = signal<string>('active');
  apiPlans = signal<any[]>([]);

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

  private http = inject(HttpClient);
  private appConfig = inject(AppConfigService);

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

      const savedPic = this.auth.getUserProfilePicture();
      if (savedPic) {
        this.previewUrl.set(this.sanitizer.bypassSecurityTrustUrl(savedPic));
        this.base64Image.set(savedPic);
        this.initialBase64Image.set(savedPic);
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
            if (profilePic) {
              this.previewUrl.set(this.sanitizer.bypassSecurityTrustUrl(profilePic));
              this.base64Image.set(profilePic);
              this.initialBase64Image.set(profilePic);
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
          const rawSlug = (plan.slug || plan.name || '').toLowerCase();
          if (rawSlug.includes('team')) {
            this.planSlug.set('team');
          } else if (rawSlug.includes('premium') || rawSlug.includes('pro')) {
            this.planSlug.set('premium');
          } else {
            this.planSlug.set('free');
          }

          if (plan.status) {
            this.planStatus.set(plan.status);
          }
        }
      },
      error: () => {
        const cached = (this.auth.getCurrentPlanSlug() || localStorage.getItem('cachedPlanSlug') || 'free').toLowerCase();
        if (cached.includes('team')) {
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
      this.errorMessage.set('Display name cannot be empty.');
      this.showErrorMessage.set(true);
      setTimeout(() => this.showErrorMessage.set(false), 3000);
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
        const newPic = res?.data?.profilepicture || res?.data?.profilePicture;
        if (newPic) {
          this.auth.setUserProfilePicture(newPic);
        } else if (this.base64Image() === '') {
          this.auth.setUserProfilePicture('');
        }

        this.initialDisplayName.set(this.displayName().trim());
        this.initialBase64Image.set(this.base64Image());
        this.showSuccessMessage.set(true);
        setTimeout(() => {
          this.showSuccessMessage.set(false);
        }, 3000);
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Failed to update profile:', err);
        const msg = err?.error?.message || err?.message || 'Failed to update profile.';
        this.errorMessage.set(msg);
        this.showErrorMessage.set(true);
        setTimeout(() => {
          this.showErrorMessage.set(false), 4000;
        });
      }
    });
  }

  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        this.errorMessage.set('Image size exceeds 5MB limit. Please choose a smaller file.');
        this.showErrorMessage.set(true);
        setTimeout(() => this.showErrorMessage.set(false), 4000);
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      this.previewUrl.set(this.sanitizer.bypassSecurityTrustUrl(objectUrl));

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.base64Image.set(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  }

  removePhoto(): void {
    this.previewUrl.set(null);
    this.base64Image.set('');
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
    if (p === 'team') return 'Team';
    if (p === 'premium' || p === 'pro') return 'Premium';
    return 'Free';
  }

  setTab(tab: ProfileTab): void {
    this.activeTab.set(tab);
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
    this.router.navigate(['/dashboard']);
  }

  goBack(): void {
    this.location.back();
  }
}
