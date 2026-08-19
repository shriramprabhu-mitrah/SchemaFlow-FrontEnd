import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { Icons } from '../../../core/component/icons/icons';

import { ButtonComponent } from '../../../shared/button/button';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Icons, ButtonComponent],
  templateUrl: './reset-password.html'
})
export class ResetPasswordComponent implements OnInit {
  password = '';
  confirmPassword = '';
  token = '';
  showPassword = false;
  showConfirmPassword = false;
  isLoading = false;
  errorMessage = '';
  infoMessage = '';
  passwordError = '';
  confirmPasswordError = '';

  get hasLowercase(): boolean { return /[a-z]/.test(this.password); }
  get hasUppercase(): boolean { return /[A-Z]/.test(this.password); }
  get hasNumber(): boolean { return /[0-9]/.test(this.password); }
  get hasSpecialChar(): boolean { return /[^a-zA-Z0-9]/.test(this.password); }
  get hasMinLength(): boolean { return this.password.length >= 8; }
  get isPasswordValid(): boolean { return this.hasLowercase && this.hasUppercase && this.hasNumber && this.hasSpecialChar && this.hasMinLength; }
  constructor(
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private svc: DashboardService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
      if (!this.token) {
        this.errorMessage = 'Reset token is missing or invalid. Please request a new password reset link.';
      }
    });
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
    if (!this.token) {
      this.errorMessage = 'Reset token is missing. Please request a new link.';
      return;
    }
    this.errorMessage = '';
    this.passwordError = '';
    this.confirmPasswordError = '';
    this.infoMessage = '';

    const pass = this.password;
    const confirmPass = this.confirmPassword;

    let hasValidationError = false;
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

    if (hasValidationError) {
      return;
    }

    this.isLoading = true;

    const payload = {
      newPassword: pass,
      confirmNewPassword: confirmPass
    };

    this.auth.resetPassword(payload, this.token).subscribe({
      next: (res) => {
        this.isLoading = false;
        const msg = res?.message || 'Password has been updated successfully. Redirecting to login...';
        this.infoMessage = msg;
        this.svc.showToast(msg, 4000, 'success');
        this.cdr.detectChanges();
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (err) => {
        try {
          this.isLoading = false;
          const errorMsg = this.getErrorMessage(err, 'Failed to reset password. The link may have expired.');
          const errorMsgLower = errorMsg.toLowerCase();

          if (errorMsgLower.includes('confirm')) {
            this.confirmPasswordError = errorMsg;
          } else if (errorMsgLower.includes('password')) {
            this.passwordError = errorMsg;
          } else {
            this.errorMessage = errorMsg;
          }
          this.cdr.detectChanges();
        } catch (ex) {
          this.isLoading = false;
          this.errorMessage = 'Failed to reset password. The link may have expired.';
          this.cdr.detectChanges();
        }
      }
    });
  }
}
