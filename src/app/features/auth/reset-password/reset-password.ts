import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { SeoService } from '../../../core/services/seo.service';
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
  get hasSpecialChar(): boolean { return /[^a-zA-Z0-9\s]/.test(this.password); }
  get hasMinLength(): boolean { return this.password.length >= 8; }
  get hasNoWhitespace(): boolean { return !/\s/.test(this.password); }
  get isPasswordValid(): boolean { return this.hasLowercase && this.hasUppercase && this.hasNumber && this.hasSpecialChar && this.hasMinLength && this.hasNoWhitespace; }
  constructor(
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private svc: DashboardService,
    private seoService: SeoService
  ) {}

  ngOnInit(): void {
    this.seoService.updateTags({
      title: 'Reset Password - DBNexus',
      description: 'Reset your DBNexus account password.',
      url: 'https://dbnexus.up.railway.app/reset-password'
    });

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
