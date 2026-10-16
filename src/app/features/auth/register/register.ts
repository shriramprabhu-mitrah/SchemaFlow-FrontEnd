import { Component, ChangeDetectorRef, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { SeoService } from '../../../core/services/seo.service';
import { AppConfigService } from '../../../core/services/app-config.service';
import { Icons } from '../../../core/component/icons/icons';
import { ButtonComponent } from '../../../shared/button/button';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Icons, ButtonComponent],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class RegisterComponent implements OnInit, OnDestroy {
  // Account type signal
  accountType = signal<'individual' | 'organization'>('individual');

  // Core fields signals
  username = signal('');
  email = signal('');
  password = signal('');
  confirmPassword = signal('');

  // Organization-specific fields signal
  organizationName = signal('');

  // UI state signals
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  isLoading = signal(false);

  // Email verification state signals
  isEmailVerified = signal(false);
  isVerifyingEmail = signal(false);
  showOtpModal = signal(false);
  isResendingOtp = signal(false);
  isVerifyingOtp = signal(false);
  otpTimer = signal(60);
  isOtpExpired = signal(false);
  otpVerifyError = signal('');

  // Field-level errors signals
  errorMessage = signal('');
  usernameError = signal('');
  emailError = signal('');
  passwordError = signal('');
  confirmPasswordError = signal('');
  organizationNameError = signal('');

  // Password rules validation computed signals
  hasLowercase = computed(() => /[a-z]/.test(this.password()));
  hasUppercase = computed(() => /[A-Z]/.test(this.password()));
  hasNumber = computed(() => /[0-9]/.test(this.password()));
  hasSpecialChar = computed(() => /[^a-zA-Z0-9\s]/.test(this.password()));
  hasMinLength = computed(() => this.password().length >= 8);
  hasNoWhitespace = computed(() => !/\s/.test(this.password()));
  isPasswordValid = computed(() =>
    this.hasLowercase() &&
    this.hasUppercase() &&
    this.hasNumber() &&
    this.hasSpecialChar() &&
    this.hasMinLength() &&
    this.hasNoWhitespace()
  );

  // OTP digits array
  otp: string[] = ['', '', '', '', '', ''];
  private otpInterval: any = null;

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private svc: DashboardService,
    private seoService: SeoService,
    private appConfig: AppConfigService
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
      url: 'https://www.dbnexus.io/auth/register'
    });
  }

  ngOnInit(): void {
    // Pre-select account type from query param (?type=organization)
    this.route.queryParams.subscribe(params => {
      const type = params['type'];
      if (type === 'organization' || type === 'individual') {
        this.accountType.set(type);
      }
    });
  }

  ngOnDestroy(): void {
    this.stopOtpTimer();
  }

  getAuthApiUrl(endpoint: 'send-otp' | 'verify-otp'): string {
    const authUrls = this.appConfig.environment?.authApiUrls;
    if (endpoint === 'send-otp' && authUrls?.sendOtp) return authUrls.sendOtp;
    if (endpoint === 'verify-otp' && authUrls?.verifyOtp) return authUrls.verifyOtp;
    const rawBase = this.appConfig.environment?.apiConfig?.baseUrl || '';
    if (rawBase) {
      const cleanBase = rawBase.replace(/\/+$/, '');
      return `${cleanBase}/api/auth/${endpoint}`;
    }
    return `/api/auth/${endpoint}`;
  }

  setAccountType(type: 'individual' | 'organization'): void {
    this.accountType.set(type);
    this.organizationNameError.set('');
    this.organizationName.set('');
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update(v => !v);
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
      this.password.set(newVal);
      input.setSelectionRange(start + cleaned.length, start + cleaned.length);
    } else {
      this.password.set((this.password() + cleaned).replace(/\s/g, ''));
    }
    this.passwordError.set('');
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
      this.confirmPassword.set(newVal);
      input.setSelectionRange(start + cleaned.length, start + cleaned.length);
    } else {
      this.confirmPassword.set((this.confirmPassword() + cleaned).replace(/\s/g, ''));
    }
    this.confirmPasswordError.set('');
  }

  onPasswordInput(event?: Event): void {
    const input = event?.target as HTMLInputElement;
    const cleaned = (input ? input.value : this.password() || '').replace(/\s/g, '');
    this.password.set(cleaned);
    if (input && input.value !== cleaned) {
      input.value = cleaned;
    }
    this.passwordError.set('');
  }

  onConfirmPasswordInput(event?: Event): void {
    const input = event?.target as HTMLInputElement;
    const cleaned = (input ? input.value : this.confirmPassword() || '').replace(/\s/g, '');
    this.confirmPassword.set(cleaned);
    if (input && input.value !== cleaned) {
      input.value = cleaned;
    }
    this.confirmPasswordError.set('');
  }

  onEmailInput(event?: Event): void {
    const input = event?.target as HTMLInputElement;
    const val = input ? input.value : this.email();
    this.email.set(val);
    this.emailError.set('');
    if (this.isEmailVerified()) {
      this.isEmailVerified.set(false);
    }
  }

  private isEmailAlreadyVerifiedMessage(msg: any): boolean {
    if (!msg) return false;
    const lower = String(msg).toLowerCase();
    return lower.includes('already verified') || 
           (lower.includes('email') && lower.includes('verified') && lower.includes('proceed')) ||
           lower.includes('please proceed');
  }

  private isResponseSuccess(response: Response, data: any): boolean {
    if (!response.ok) return false;
    if (data?.statusCode != null) {
      return data.statusCode === 200 || data.statusCode === 201;
    }
    if (data?.status != null) {
      return data.status === 'success' || data.status === 200 || data.status === 201;
    }
    return true;
  }

  startOtpTimer(seconds: number = 60): void {
    this.stopOtpTimer();
    this.otpTimer.set(seconds);
    this.isOtpExpired.set(false);
    this.cdr.markForCheck();

    this.otpInterval = setInterval(() => {
      if (this.otpTimer() > 0) {
        this.otpTimer.update(t => t - 1);
      } else {
        this.isOtpExpired.set(true);
        this.stopOtpTimer();
      }
      this.cdr.markForCheck();
    }, 1000);
  }

  stopOtpTimer(): void {
    if (this.otpInterval) {
      clearInterval(this.otpInterval);
      this.otpInterval = null;
    }
  }

  async sendOtp() {
    if (this.isEmailVerified() || this.isVerifyingEmail() || this.isLoading()) {
      return;
    }

    const mail = (this.email() || '').trim();
    if (!mail) {
      this.emailError.set('Email address is required.');
      this.cdr.markForCheck();
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(mail)) {
      this.emailError.set('Please enter a valid email address.');
      this.cdr.markForCheck();
      return;
    }

    this.isVerifyingEmail.set(true);
    this.emailError.set('');
    this.cdr.markForCheck();

    const url = this.getAuthApiUrl('send-otp');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: mail })
      });

      const data = await response.json().catch(() => ({}));
      const message = data?.message || data?.error || data?.msg || '';

      if (this.isEmailAlreadyVerifiedMessage(message)) {
        this.isEmailVerified.set(true);
        this.emailError.set('');
        this.showOtpModal.set(false);
        this.stopOtpTimer();
        this.svc.showToast('Your email is already verified. Please proceed.', 4000, 'success');
        return;
      }

      if (this.isResponseSuccess(response, data)) {
        this.otp = ['', '', '', '', '', ''];
        this.otpVerifyError.set('');
        this.showOtpModal.set(true);
        this.startOtpTimer(data?.data?.expiresIn || 60);
        this.svc.showToast(message || 'OTP sent successfully to your email', 3000, 'info');
        setTimeout(() => {
          const firstInput = document.getElementById('otp-0') as HTMLInputElement;
          if (firstInput) {
            firstInput.focus();
          }
        }, 100);
      } else {
        this.emailError.set(message || 'Failed to send OTP');
      }
    } catch (err: any) {
      const errMessage = err?.message || '';
      if (this.isEmailAlreadyVerifiedMessage(errMessage)) {
        this.isEmailVerified.set(true);
        this.emailError.set('');
        this.showOtpModal.set(false);
        this.stopOtpTimer();
        this.svc.showToast('Your email is already verified. Please proceed.', 4000, 'success');
        return;
      }
      this.emailError.set(errMessage || 'Failed to send OTP. Please try again.');
    } finally {
      this.isVerifyingEmail.set(false);
      this.cdr.markForCheck();
    }
  }

  async resendOtp() {
    if (this.isResendingOtp() || this.otpTimer() > 0) return;
    const mail = (this.email() || '').trim();
    if (!mail) return;

    this.isResendingOtp.set(true);
    this.otpVerifyError.set('');
    this.cdr.markForCheck();

    const url = this.getAuthApiUrl('send-otp');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: mail })
      });

      const data = await response.json().catch(() => ({}));
      const message = data?.message || data?.error || data?.msg || '';

      if (this.isEmailAlreadyVerifiedMessage(message)) {
        this.isEmailVerified.set(true);
        this.otpVerifyError.set('');
        this.showOtpModal.set(false);
        this.stopOtpTimer();
        this.svc.showToast('Your email is already verified. Please proceed.', 4000, 'success');
        return;
      }

      if (this.isResponseSuccess(response, data)) {
        this.otp = ['', '', '', '', '', ''];
        this.startOtpTimer(data?.data?.expiresIn || 60);
        this.svc.showToast('OTP resent successfully!', 3000, 'info');
        setTimeout(() => {
          const firstInput = document.getElementById('otp-0') as HTMLInputElement;
          if (firstInput) {
            firstInput.focus();
          }
        }, 50);
      } else {
        this.otpVerifyError.set(message || 'Failed to resend OTP');
      }
    } catch (err: any) {
      const errMessage = err?.message || '';
      if (this.isEmailAlreadyVerifiedMessage(errMessage)) {
        this.isEmailVerified.set(true);
        this.otpVerifyError.set('');
        this.showOtpModal.set(false);
        this.stopOtpTimer();
        this.svc.showToast('Your email is already verified. Please proceed.', 4000, 'success');
        return;
      }
      this.otpVerifyError.set(errMessage || 'Failed to resend OTP');
    } finally {
      this.isResendingOtp.set(false);
      this.cdr.markForCheck();
    }
  }

  async verifyOtp() {
    const mail = (this.email() || '').trim();
    const otpValue = this.otp.join('');

    if (otpValue.length !== 6) {
      this.otpVerifyError.set('Please enter the 6-digit OTP');
      this.cdr.markForCheck();
      return;
    }

    this.isVerifyingOtp.set(true);
    this.otpVerifyError.set('');
    this.cdr.markForCheck();

    const url = this.getAuthApiUrl('verify-otp');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: mail, otp: otpValue })
      });

      const data = await response.json().catch(() => ({}));
      const message = data?.message || data?.error || data?.msg || '';

      if (this.isEmailAlreadyVerifiedMessage(message)) {
        this.isEmailVerified.set(true);
        this.closeOtpModal();
        this.svc.showToast('Your email is already verified. Please proceed.', 4000, 'success');
        return;
      }

      if (this.isResponseSuccess(response, data)) {
        this.isEmailVerified.set(true);
        this.closeOtpModal();
        this.svc.showToast(data?.message || 'Email verified successfully!', 3000, 'success');
      } else {
        this.otpVerifyError.set(message || 'Invalid OTP');
      }
    } catch (err: any) {
      const errMessage = err?.message || '';
      if (this.isEmailAlreadyVerifiedMessage(errMessage)) {
        this.isEmailVerified.set(true);
        this.closeOtpModal();
        this.svc.showToast('Your email is already verified. Please proceed.', 4000, 'success');
        return;
      }
      this.otpVerifyError.set(errMessage || 'Invalid OTP');
    } finally {
      this.isVerifyingOtp.set(false);
      this.cdr.markForCheck();
    }
  }

  closeOtpModal(): void {
    this.showOtpModal.set(false);
    this.stopOtpTimer();
    this.otp = ['', '', '', '', '', ''];
    this.otpVerifyError.set('');
    this.isVerifyingOtp.set(false);
    this.cdr.markForCheck();
  }

  trackByIndex(index: number): number {
    return index;
  }

  onOtpInput(event: any, index: number): void {
    const input = event.target as HTMLInputElement;
    let value = input.value || '';
    
    value = value.replace(/[^0-9]/g, '');
    
    if (value.length > 1) {
      const digits = value.split('');
      const startIndex = digits.length >= 6 ? 0 : index;
      for (let i = startIndex; i < 6 && digits.length > 0; i++) {
        this.otp[i] = digits.shift() || '';
        const el = document.getElementById(`otp-${i}`) as HTMLInputElement;
        if (el) el.value = this.otp[i];
      }
      const focusIndex = Math.min(startIndex + value.length - 1, 5);
      const nextEl = document.getElementById(`otp-${focusIndex}`) as HTMLInputElement;
      if (nextEl) {
        nextEl.focus();
        nextEl.select();
      }
      if (this.otpVerifyError()) {
        this.otpVerifyError.set('');
      }
      this.cdr.markForCheck();
      return;
    }
    
    this.otp[index] = value;
    input.value = value;

    if (this.otpVerifyError()) {
      this.otpVerifyError.set('');
      this.cdr.markForCheck();
    }
  }

  onOtpPaste(event: ClipboardEvent, index: number = 0): void {
    event.preventDefault();
    const clipboardData = event.clipboardData || (window as any).clipboardData;
    if (!clipboardData) return;

    const pastedText = clipboardData.getData('text') || '';
    const digits = pastedText.replace(/[^0-9]/g, '');
    if (!digits) return;

    const startIndex = digits.length >= 6 ? 0 : index;
    const digitChars = digits.split('');

    for (let i = 0; i < 6; i++) {
      if (i >= startIndex && digitChars.length > 0) {
        this.otp[i] = digitChars.shift() || '';
      }
      const inputEl = document.getElementById(`otp-${i}`) as HTMLInputElement;
      if (inputEl) {
        inputEl.value = this.otp[i];
      }
    }

    if (this.otpVerifyError()) {
      this.otpVerifyError.set('');
    }

    const lastFilled = Math.min(startIndex + digits.length - 1, 5);
    const targetInput = document.getElementById(`otp-${lastFilled}`) as HTMLInputElement;
    if (targetInput) {
      targetInput.focus();
      targetInput.select();
    }

    this.cdr.markForCheck();
  }

  onOtpCopy(event: ClipboardEvent): void {
    const fullOtp = this.otp.join('');
    if (fullOtp.length > 0) {
      event.preventDefault();
      const clipboardData = event.clipboardData || (window as any).clipboardData;
      if (clipboardData) {
        clipboardData.setData('text/plain', fullOtp);
      }
    }
  }

  onOtpKeyUp(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') return;
    
    const value = this.otp[index];
    if (value && index < 5 && /^[0-9]$/.test(value)) {
      const nextInput = document.getElementById(`otp-${index + 1}`) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  }

  onOtpKeyDown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace') {
      if (!this.otp[index] && index > 0) {
        const prevInput = document.getElementById(`otp-${index - 1}`) as HTMLInputElement;
        if (prevInput) {
          prevInput.focus();
          this.otp[index - 1] = '';
          prevInput.value = '';
        }
      } else if (this.otp[index]) {
        this.otp[index] = '';
        const currentInput = document.getElementById(`otp-${index}`) as HTMLInputElement;
        if (currentInput) {
          currentInput.value = '';
        }
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`) as HTMLInputElement;
      if (prevInput) prevInput.focus();
    } else if (event.key === 'ArrowRight' && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`) as HTMLInputElement;
      if (nextInput) nextInput.focus();
    }
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
    this.errorMessage.set('');
    this.usernameError.set('');
    this.emailError.set('');
    this.passwordError.set('');
    this.confirmPasswordError.set('');
    this.organizationNameError.set('');

    const user = this.username().trim();
    const mail = this.email().trim();
    const pass = this.password();
    const confirmPass = this.confirmPassword();
    const orgName = this.organizationName().trim();

    let hasValidationError = false;

    if (!user) {
      this.usernameError.set('Username is required.');
      hasValidationError = true;
    }

    if (!mail) {
      this.emailError.set('Email address is required.');
      hasValidationError = true;
    } else {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(mail)) {
        this.emailError.set('Please enter a valid email address.');
        hasValidationError = true;
      } else if (!this.isEmailVerified()) {
        this.emailError.set('Please verify your email with OTP first.');
        hasValidationError = true;
      }
    }

    if (!pass) {
      this.passwordError.set('Password is required.');
      hasValidationError = true;
    } else if (/\s/.test(pass)) {
      this.passwordError.set('Password cannot contain whitespace.');
      hasValidationError = true;
    } else if (pass.length < 8 || !this.hasLowercase() || !this.hasUppercase() || !this.hasNumber() || !this.hasSpecialChar()) {
      this.passwordError.set('Password does not meet the requirements.');
      hasValidationError = true;
    }

    if (!confirmPass) {
      this.confirmPasswordError.set('Please confirm your password.');
      hasValidationError = true;
    } else if (/\s/.test(confirmPass)) {
      this.confirmPasswordError.set('Password cannot contain whitespace.');
      hasValidationError = true;
    } else if (pass && pass !== confirmPass) {
      this.confirmPasswordError.set('Passwords do not match.');
      hasValidationError = true;
    }

    // Organization-specific validation
    if (this.accountType() === 'organization' && !orgName) {
      this.organizationNameError.set('Company / organization name is required.');
      hasValidationError = true;
    }

    if (hasValidationError) {
      return;
    }

    this.isLoading.set(true);

    const payload: any = {
      userName: user,
      email: mail,
      password: pass,
      confirmPassword: confirmPass,
      accountType: this.accountType()
    };

    if (this.accountType() === 'organization') {
      payload.organizationName = orgName;
    }

    this.auth.register(payload).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.cdr.markForCheck();
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

        if (this.auth.isLoggedIn()) {
          if (this.auth.isSuperAdmin()) {
            this.router.navigate(['/admin']);
          } else if (this.auth.isOrganizationAdmin() || this.auth.isOrganizationMember()) {
            this.router.navigate(['/organization']);
          } else {
            this.router.navigate(['/dashboard']);
          }
        } else {
          this.router.navigate(['/login'], { queryParams: { registered: 'true' } });
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        const errorMsg = this.getErrorMessage(err, 'Registration failed. Please try again.');
        const errorMsgLower = errorMsg.toLowerCase();

        if (errorMsgLower.includes('organization') || errorMsgLower.includes('company')) {
          this.organizationNameError.set(errorMsg);
        } else if (errorMsgLower.includes('email')) {
          this.emailError.set(errorMsg);
        } else if (errorMsgLower.includes('username') || errorMsgLower.includes('user name') || errorMsgLower.includes('user')) {
          this.usernameError.set(errorMsg);
        } else if (errorMsgLower.includes('confirm')) {
          this.confirmPasswordError.set(errorMsg);
        } else if (errorMsgLower.includes('password')) {
          this.passwordError.set(errorMsg);
        } else {
          this.errorMessage.set(errorMsg);
        }
        this.cdr.markForCheck();
      }
    });
  }
}
