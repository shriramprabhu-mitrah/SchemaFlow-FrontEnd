import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
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
  get hasSpecialChar(): boolean { return /[^a-zA-Z0-9]/.test(this.password); }
  get hasMinLength(): boolean { return this.password.length >= 8; }
  get isPasswordValid(): boolean { return this.hasLowercase && this.hasUppercase && this.hasNumber && this.hasSpecialChar && this.hasMinLength; }

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private svc: DashboardService
  ) {
    // If already logged in, redirect directly to dashboard
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
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
    } else if (pass.length < 8 || !this.hasLowercase || !this.hasUppercase || !this.hasNumber || !this.hasSpecialChar) {
      this.passwordError = 'Password does not meet the requirements.';
      hasValidationError = true;
    }

    if (!confirmPass) {
      this.confirmPasswordError = 'Please confirm your password.';
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
