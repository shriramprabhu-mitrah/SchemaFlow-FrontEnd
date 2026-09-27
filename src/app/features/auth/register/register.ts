import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { SeoService } from '../../../core/services/seo.service';
import { Icons } from '../../../core/component/icons/icons';

import { ButtonComponent } from '../../../shared/button/button';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Icons, ButtonComponent],
  templateUrl: './register.html'
})
export class RegisterComponent implements OnInit {
  // Account type
  accountType: 'individual' | 'organization' = 'individual';

  // Core fields
  username = '';
  email = '';
  password = '';
  confirmPassword = '';

  // Organization-specific fields
  organizationName = '';

  // UI state
  showPassword = false;
  showConfirmPassword = false;
  isLoading = false;

  // Field-level errors
  errorMessage = '';
  usernameError = '';
  emailError = '';
  passwordError = '';
  confirmPasswordError = '';
  organizationNameError = '';

  get hasLowercase(): boolean { return /[a-z]/.test(this.password); }
  get hasUppercase(): boolean { return /[A-Z]/.test(this.password); }
  get hasNumber(): boolean { return /[0-9]/.test(this.password); }
  get hasSpecialChar(): boolean { return /[^a-zA-Z0-9\s]/.test(this.password); }
  get hasMinLength(): boolean { return this.password.length >= 8; }
  get hasNoWhitespace(): boolean { return !/\s/.test(this.password); }
  get isPasswordValid(): boolean { return this.hasLowercase && this.hasUppercase && this.hasNumber && this.hasSpecialChar && this.hasMinLength && this.hasNoWhitespace; }

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private svc: DashboardService,
    private seoService: SeoService
  ) {
    // If already logged in, redirect directly according to user role
    if (this.auth.isLoggedIn()) {
      if (this.auth.isSuperAdmin()) {
        this.router.navigate(['/admin']);
      } else if (this.auth.isOrganizationAdmin() || this.auth.isOrganizationMember()) {
        this.router.navigate(['/organization']);
      } else {
        this.router.navigate(['/dashboard']);
      }
      return;
    }

    this.seoService.updateTags({
      title: 'Sign Up - DBNexus',
      description: 'Create a new DBNexus account to start designing, documenting, and sharing your database schemas.',
      url: 'https://dbnexus.up.railway.app/auth/register'
    });
  }

  ngOnInit(): void {
    // Pre-select account type from query param (?type=organization)
    this.route.queryParams.subscribe(params => {
      const type = params['type'];
      if (type === 'organization' || type === 'individual') {
        this.accountType = type;
      }
    });
  }

  setAccountType(type: 'individual' | 'organization'): void {
    this.accountType = type;
    // Clear org-specific errors when switching
    this.organizationNameError = '';
    this.organizationName = '';
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  preventWhitespace(event: KeyboardEvent): void {
    if (event.key === ' ' || event.code === 'Space' || event.keyCode === 32) {
      event.preventDefault();
    }
  }

  onPasswordPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') || '';
    const cleaned = text.replace(/\s/g, '');
    const input = event.target as HTMLInputElement;
    if (input) {
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const val = input.value || '';
      const newVal = val.substring(0, start) + cleaned + val.substring(end);
      input.value = newVal;
      this.password = newVal;
      input.setSelectionRange(start + cleaned.length, start + cleaned.length);
    } else {
      this.password = (this.password + cleaned).replace(/\s/g, '');
    }
    this.passwordError = '';
  }

  onConfirmPasswordPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') || '';
    const cleaned = text.replace(/\s/g, '');
    const input = event.target as HTMLInputElement;
    if (input) {
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const val = input.value || '';
      const newVal = val.substring(0, start) + cleaned + val.substring(end);
      input.value = newVal;
      this.confirmPassword = newVal;
      input.setSelectionRange(start + cleaned.length, start + cleaned.length);
    } else {
      this.confirmPassword = (this.confirmPassword + cleaned).replace(/\s/g, '');
    }
    this.confirmPasswordError = '';
  }

  onPasswordInput(event?: Event): void {
    const input = event?.target as HTMLInputElement;
    const cleaned = (input ? input.value : this.password || '').replace(/\s/g, '');
    this.password = cleaned;
    if (input && input.value !== cleaned) {
      input.value = cleaned;
    }
    this.passwordError = '';
  }

  onConfirmPasswordInput(event?: Event): void {
    const input = event?.target as HTMLInputElement;
    const cleaned = (input ? input.value : this.confirmPassword || '').replace(/\s/g, '');
    this.confirmPassword = cleaned;
    if (input && input.value !== cleaned) {
      input.value = cleaned;
    }
    this.confirmPasswordError = '';
  }

  private getErrorMessage(err: any, fallback: string): string {
    if (!err) return fallback;
    if (err.error) {
      if (typeof err.error === 'object') {
        if (err.error.message) return err.error.message;
        if (err.error.error) return err.error.error;
        if (err.error.errors) {
          if (Array.isArray(err.error.errors)) {
            return err.error.errors.join(' ');
          }
          if (typeof err.error.errors === 'object') {
            return Object.values(err.error.errors).flat().join(' ');
          }
        }
      } else if (typeof err.error === 'string') {
        try {
          const parsed = JSON.parse(err.error);
          return parsed.message || parsed.error || err.error;
        } catch {
          return err.error;
        }
      }
    }
    return err.message || fallback;
  }

  onSubmit(): void {
    this.errorMessage = '';
    this.usernameError = '';
    this.emailError = '';
    this.passwordError = '';
    this.confirmPasswordError = '';
    this.organizationNameError = '';

    const user = this.username.trim();
    const mail = this.email.trim();
    const pass = this.password;
    const confirmPass = this.confirmPassword;
    const orgName = this.organizationName.trim();

    let hasValidationError = false;

    if (!user) {
      this.usernameError = 'Username is required.';
      hasValidationError = true;
    }

    if (!mail) {
      this.emailError = 'Email address is required.';
      hasValidationError = true;
    } else {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(mail)) {
        this.emailError = 'Please enter a valid email address.';
        hasValidationError = true;
      }
    }

    if (!pass) {
      this.passwordError = 'Password is required.';
      hasValidationError = true;
    } else if (/\s/.test(pass)) {
      this.passwordError = 'Password cannot contain whitespace.';
      hasValidationError = true;
    } else if (pass.length < 8 || !this.hasLowercase || !this.hasUppercase || !this.hasNumber || !this.hasSpecialChar) {
      this.passwordError = 'Password does not meet the requirements.';
      hasValidationError = true;
    }

    if (!confirmPass) {
      this.confirmPasswordError = 'Please confirm your password.';
      hasValidationError = true;
    } else if (/\s/.test(confirmPass)) {
      this.confirmPasswordError = 'Password cannot contain whitespace.';
      hasValidationError = true;
    } else if (pass && pass !== confirmPass) {
      this.confirmPasswordError = 'Passwords do not match.';
      hasValidationError = true;
    }

    // Organization-specific validation
    if (this.accountType === 'organization' && !orgName) {
      this.organizationNameError = 'Company / organization name is required.';
      hasValidationError = true;
    }

    if (hasValidationError) {
      return;
    }

    this.isLoading = true;

    const payload: any = {
      userName: user,
      email: mail,
      password: pass,
      confirmPassword: confirmPass,
      accountType: this.accountType
    };

    if (this.accountType === 'organization') {
      payload.organizationName = orgName;
    }

    this.auth.register(payload).subscribe({
      next: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
        this.svc.showToast('Registration successful!', 3000, 'success');
        // Handle pending invitation if present
        const pendingInviteUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('pending_accept_invitation_url') : null;
        if (pendingInviteUrl) {
          localStorage.removeItem('pending_accept_invitation_url');
          localStorage.removeItem('pending_accept_invitation_id');
          localStorage.removeItem('pending_accept_invitation_token');
          localStorage.removeItem('pending_accept_invitation_type');
          this.router.navigateByUrl(pendingInviteUrl);
          return;
        }

        // If the service auto-logs the user in (res contains a token), redirect to dashboard
        if (this.auth.isLoggedIn()) {
          if (this.auth.isSuperAdmin()) {
            this.router.navigate(['/admin']);
          } else if (this.auth.isOrganizationAdmin() || this.auth.isOrganizationMember()) {
            this.router.navigate(['/organization']);
          } else {
            this.router.navigate(['/dashboard']);
          }
        } else {
          // Otherwise, redirect to login page with a success message
          this.router.navigate(['/login'], { queryParams: { registered: 'true' } });
        }
      },
      error: (err) => {
        try {
          this.isLoading = false;
          const errorMsg = this.getErrorMessage(err, 'Registration failed. Please try again.');
          const errorMsgLower = errorMsg.toLowerCase();

          if (errorMsgLower.includes('organization') || errorMsgLower.includes('company')) {
            this.organizationNameError = errorMsg;
          } else if (errorMsgLower.includes('email')) {
            this.emailError = errorMsg;
          } else if (errorMsgLower.includes('username') || errorMsgLower.includes('user name') || errorMsgLower.includes('user')) {
            this.usernameError = errorMsg;
          } else if (errorMsgLower.includes('confirm')) {
            this.confirmPasswordError = errorMsg;
          } else if (errorMsgLower.includes('password')) {
            this.passwordError = errorMsg;
          } else {
            this.errorMessage = errorMsg;
          }
          this.cdr.detectChanges();
        } catch (ex) {
          this.isLoading = false;
          this.errorMessage = 'Registration failed. Please try again.';
          this.cdr.detectChanges();
        }
      }
    });
  }
}
