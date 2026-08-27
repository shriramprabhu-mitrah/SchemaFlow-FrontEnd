import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { EntitlementService } from '../../../core/services/entitlement.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { Icons } from '../../../core/component/icons/icons';

import { ButtonComponent } from '../../../shared/button/button';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Icons, ButtonComponent],
  templateUrl: './login.html'
})
export class LoginComponent {
  username = '';
  password = '';
  showPassword = false;
  isLoading = false;
  errorMessage = '';
  infoMessage = '';
  usernameError = '';
  passwordError = '';

  isForgotPasswordMode = false;
  forgotPasswordEmail = '';
  forgotPasswordEmailError = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private svc: DashboardService,
    private cdr: ChangeDetectorRef,
    private entitlementService: EntitlementService
  ) {
    // If already logged in, redirect directly to dashboard
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleForgotPasswordMode(event?: Event): void {
    if (event) event.preventDefault();
    this.isForgotPasswordMode = !this.isForgotPasswordMode;
    this.errorMessage = '';
    this.infoMessage = '';
    this.usernameError = '';
    this.passwordError = '';
    this.forgotPasswordEmail = '';
    this.forgotPasswordEmailError = '';
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

  submitForgotPassword(event: Event): void {
    event.preventDefault();
    this.errorMessage = '';
    this.forgotPasswordEmailError = '';
    this.infoMessage = '';

    const email = this.forgotPasswordEmail.trim();
    if (!email) {
      this.forgotPasswordEmailError = 'Please enter your email address.';
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      this.forgotPasswordEmailError = 'Please enter a valid email address.';
      return;
    }

    this.isLoading = true;

    this.auth.forgotPassword(email).subscribe({
      next: (res) => {
        this.isLoading = false;
        const msg = res?.message || 'A password reset link has been sent to your email address.';
        this.infoMessage = msg;
        this.isForgotPasswordMode = false;
        this.forgotPasswordEmail = '';
        this.svc.showToast(msg, 4000, 'success');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        const errorMsg = this.getErrorMessage(err, 'Failed to send reset link. Please try again.');
        this.forgotPasswordEmailError = errorMsg;
        this.cdr.detectChanges();
      }
    });
  }

  private handlePostLoginNavigation(): void {
    this.isLoading = false;
    this.svc.showToast('Logged in successfully.', 3000, 'success');

    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    if (returnUrl) {
      this.router.navigateByUrl(returnUrl);
      return;
    }

    const pendingInviteUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('pending_accept_invitation_url') : null;
    const pendingInviteId = typeof localStorage !== 'undefined' ? localStorage.getItem('pending_accept_invitation_id') : null;

    if (pendingInviteUrl) {
      localStorage.removeItem('pending_accept_invitation_url');
      localStorage.removeItem('pending_accept_invitation_id');
      this.router.navigateByUrl(pendingInviteUrl);
      return;
    } else if (pendingInviteId) {
      localStorage.removeItem('pending_accept_invitation_id');
      this.router.navigate(['/invite-accept']);
      return;
    }

    // Super admin redirect
    if (this.auth.isSuperAdmin()) {
      this.router.navigate(['/admin']);
      return;
    }

    // Organization redirect
    if (this.auth.isOrganizationAdmin() || this.auth.isOrganizationMember()) {
      this.router.navigate(['/organization']);
      return;
    }

    const fromHome = this.route.snapshot.queryParams['fromHome'] === 'true';
    if (fromHome) {
      this.router.navigate(['/dashboard'], { queryParams: { sample: 'true' } });
    } else {
      this.router.navigate(['/dashboard']);
    }
  }


  onSubmit(): void {
    this.errorMessage = '';
    this.usernameError = '';
    this.passwordError = '';
    this.infoMessage = '';

    const user = this.username.trim();
    const pass = this.password;

    let hasValidationError = false;
    if (!user) {
      this.usernameError = 'Please enter your username or email.';
      hasValidationError = true;
    }
    if (!pass) {
      this.passwordError = 'Please enter your password.';
      hasValidationError = true;
    }

    if (hasValidationError) {
      return;
    }

    this.isLoading = true;

    const payload = {
      email: user, // Send as both username/email to match backend keys
      password: pass
    };

    this.auth.login(payload).subscribe({
      next: () => {
        this.handlePostLoginNavigation();
      },
      error: (err) => {
        try {
          this.isLoading = false;
          const errorMsg = this.getErrorMessage(err, 'Invalid username or password.');
          const errorMsgLower = errorMsg.toLowerCase();

          if (errorMsgLower.includes('email') || errorMsgLower.includes('username') || errorMsgLower.includes('user')) {
            this.usernameError = errorMsg;
          } else if (errorMsgLower.includes('password')) {
            this.passwordError = errorMsg;
          } else {
            this.errorMessage = errorMsg;
          }
          this.cdr.detectChanges();
        } catch (ex) {
          this.isLoading = false;
          this.errorMessage = 'Invalid username or password.';
          this.cdr.detectChanges();
        }
      }
    });
  }
}
