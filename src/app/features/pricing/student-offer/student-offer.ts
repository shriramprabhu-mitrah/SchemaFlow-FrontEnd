import { Component, ChangeDetectorRef, signal, ViewChild, ElementRef, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AppConfigService } from '../../../core/services/app-config.service';
import { StudentSettingsService } from '../../../core/services/student-settings.service';
import { DashboardService } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-student-offer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormsModule],
  templateUrl: './student-offer.html',
  styleUrls: ['./student-offer.scss']
})
export class StudentOfferComponent implements OnDestroy {
  @ViewChild('fileInput') fileInputRef?: ElementRef<HTMLInputElement>;

  private emailSub?: Subscription;

  studentForm: FormGroup;
  selectedFile: File | null = null;
  fileError: string = '';
  
  showOtpModal = signal(false);
  otp: string[] = ['', '', '', '', '', ''];
  isVerifyingEmail = signal(false);
  isEmailVerified = signal(false);
  emailVerifyError = signal('');
  otpVerifyError = signal('');
  
  fullNameError = signal('');
  phoneError = signal('');
  cityError = signal('');
  instituteError = signal('');
  joinedYearError = signal('');
  passedOutYearError = signal('');
  confirmEnrolledError = signal('');

  // Customized Year Picker state
  readonly currentYear = new Date().getFullYear();
  activeYearPicker = signal<'joined' | 'passedOut' | null>(null);
  joinedDecadeStart = signal<number>(2020);
  passedOutDecadeStart = signal<number>(2020);

  otpTimer = signal(60);
  isOtpExpired = signal(false);
  isResendingOtp = signal(false);
  isSubmitting = signal(false);
  submitError = signal('');
  submitSuccess = signal(false);
  private otpInterval: any;

  constructor(
    private fb: FormBuilder, 
    private router: Router, 
    private appConfig: AppConfigService,
    private cdr: ChangeDetectorRef,
    public studentSettings: StudentSettingsService,
    private svc: DashboardService
  ) {
    this.studentForm = this.fb.group({
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
      city: ['', Validators.required],
      institute: ['', Validators.required],
      joinedYear: ['', [Validators.required, Validators.pattern(/^(19|20)\d{2}$/)]],
      passedOutYear: ['', [Validators.required, Validators.pattern(/^(19|20)\d{2}$/)]],
      confirmEnrolled: [false, Validators.requiredTrue]
    });

    this.studentForm.get('email')?.valueChanges.subscribe(() => {
      if (!this.isEmailVerified()) {
        this.emailVerifyError.set('');
        this.submitError.set('');
        this.cdr.markForCheck();
      }
    });

    this.emailSub = this.studentForm.get('email')?.valueChanges.pipe(
      debounceTime(600),
      distinctUntilChanged()
    ).subscribe((rawEmail: string | null) => {
      const email = (rawEmail || '').trim();
      if (!email || this.isEmailVerified() || this.isVerifyingEmail()) {
        return;
      }
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (emailRegex.test(email) && this.studentForm.get('email')?.valid) {
        this.sendOtp();
      }
    });

    this.studentForm.get('joinedYear')?.valueChanges.subscribe(() => {
      this.validateYearOrder();
    });

    this.studentForm.get('passedOutYear')?.valueChanges.subscribe(() => {
      this.validateYearOrder();
    });
  }

  getStudentApiUrl(endpoint: string): string {
    if (endpoint === 'credentials') {
      const adminUrls = this.appConfig.environment?.adminApiUrls;
      if (adminUrls?.studentCredentials) return adminUrls.studentCredentials;
    }
    const studentPlanUrls = this.appConfig.environment?.studentPlanApiUrls;
    if (studentPlanUrls) {
      if (endpoint === 'send-otp' && studentPlanUrls.sendOtp) return studentPlanUrls.sendOtp;
      if (endpoint === 'verify-otp' && studentPlanUrls.verifyOtp) return studentPlanUrls.verifyOtp;
      if (studentPlanUrls[endpoint]) return studentPlanUrls[endpoint];
    }
    const studentUrls = this.appConfig.environment?.studentApiUrls;
    if (studentUrls && studentUrls[endpoint]) {
      return studentUrls[endpoint];
    }
    const rawBase = this.appConfig.environment?.apiConfig?.baseUrl || '';
    if (rawBase) {
      const cleanBase = rawBase.replace(/\/+$/, '');
      if (cleanBase.endsWith('/api')) {
        return `${cleanBase}/student/${endpoint}`;
      }
      return `${cleanBase}/api/student/${endpoint}`;
    }
    if (endpoint === 'credentials') {
      return 'http://localhost:4000/api/student/credentials';
    }
    return `http://localhost:4000/api/student/${endpoint}`;
  }

  private isResponseSuccess(response: Response, data: any): boolean {
    if (!response.ok) return false;
    if (data?.statusCode != null) {
      const code = Number(data.statusCode);
      return !isNaN(code) ? (code >= 200 && code < 300) : (data.statusCode === 'success');
    }
    if (data?.status != null) {
      return data.status === 'success' || data.status === 200 || data.status === 201;
    }
    return true;
  }
  
  startOtpTimer() {
    this.stopOtpTimer();
    this.otpTimer.set(60);
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

  stopOtpTimer() {
    if (this.otpInterval) {
      clearInterval(this.otpInterval);
      this.otpInterval = null;
    }
  }

  private isEmailAlreadyVerifiedMessage(msg: any): boolean {
    if (!msg) return false;
    const lower = String(msg).toLowerCase();
    return lower.includes('already verified') || 
           (lower.includes('email') && lower.includes('verified') && lower.includes('proceed')) ||
           lower.includes('please proceed here');
  }

  async sendOtp() {
    if (this.isEmailVerified() || this.isVerifyingEmail()) {
      return;
    }

    const rawEmail = this.studentForm.get('email')?.value;
    const email = (rawEmail || '').trim();
    if (!email || this.studentForm.get('email')?.invalid) {
      this.studentForm.get('email')?.markAsTouched();
      this.cdr.markForCheck();
      return;
    }
    
    this.isVerifyingEmail.set(true);
    this.emailVerifyError.set('');
    this.cdr.markForCheck();
    
    const url = this.getStudentApiUrl('send-otp');
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json().catch(() => ({}));
      const message = data?.message || data?.error || data?.msg || '';

      if (this.isEmailAlreadyVerifiedMessage(message)) {
        this.isEmailVerified.set(true);
        this.emailVerifyError.set('');
        this.showOtpModal.set(false);
        this.stopOtpTimer();
        this.svc.showToast('Your email is already verified. Please proceed.', 4000, 'success');
        return;
      }
      
      if (this.isResponseSuccess(response, data)) {
        this.showOtpModal.set(true);
        this.startOtpTimer();
      } else {
        this.emailVerifyError.set(message || 'Failed to send OTP');
      }
    } catch (err: any) {
      const errMessage = err?.message || '';
      if (this.isEmailAlreadyVerifiedMessage(errMessage)) {
        this.isEmailVerified.set(true);
        this.emailVerifyError.set('');
        this.showOtpModal.set(false);
        this.stopOtpTimer();
        this.svc.showToast('Your email is already verified. Please proceed.', 4000, 'success');
        return;
      }
      this.emailVerifyError.set(errMessage || 'Failed to send OTP');
    } finally {
      this.isVerifyingEmail.set(false);
      this.cdr.markForCheck();
    }
  }

  async resendOtp() {
    if (this.isResendingOtp() || this.otpTimer() > 0) return;
    const email = this.studentForm.get('email')?.value;
    if (!email) return;

    this.isResendingOtp.set(true);
    this.otpVerifyError.set('');
    this.cdr.markForCheck();

    const url = this.getStudentApiUrl('send-otp');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
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
        this.startOtpTimer();
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
    const email = this.studentForm.get('email')?.value;
    const otpValue = this.otp.join('');
    
    if (otpValue.length !== 6) {
      this.otpVerifyError.set('Please enter the 6-digit OTP');
      this.cdr.markForCheck();
      return;
    }
    
    this.otpVerifyError.set('');
    this.cdr.markForCheck();
    
    const url = this.getStudentApiUrl('verify-otp');
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpValue })
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
      this.cdr.markForCheck();
    }
  }

  closeOtpModal() {
    this.showOtpModal.set(false);
    this.stopOtpTimer();
    this.otp = ['', '', '', '', '', ''];
    this.otpVerifyError.set('');
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.stopOtpTimer();
    this.emailSub?.unsubscribe();
  }

  onOtpInput(event: any, index: number) {
    const input = event.target as HTMLInputElement;
    let value = input.value || '';
    
    value = value.replace(/[^0-9]/g, '');
    
    if (value.length > 1) {
      // Support browser autofill / multi-digit input
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

  onOtpPaste(event: ClipboardEvent, index: number = 0) {
    event.preventDefault();
    const clipboardData = event.clipboardData || (window as any).clipboardData;
    if (!clipboardData) return;

    const pastedText = clipboardData.getData('text') || '';
    const digits = pastedText.replace(/[^0-9]/g, '');
    if (!digits) return;

    // If 6 or more digits pasted, fill all boxes starting from index 0
    // Otherwise start from the currently focused index
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

    // Focus the last filled box or next available box
    const lastFilled = Math.min(startIndex + digits.length - 1, 5);
    const targetInput = document.getElementById(`otp-${lastFilled}`) as HTMLInputElement;
    if (targetInput) {
      targetInput.focus();
      targetInput.select();
    }

    this.cdr.markForCheck();
  }

  onOtpCopy(event: ClipboardEvent) {
    const fullOtp = this.otp.join('');
    if (fullOtp.length > 0) {
      event.preventDefault();
      const clipboardData = event.clipboardData || (window as any).clipboardData;
      if (clipboardData) {
        clipboardData.setData('text/plain', fullOtp);
      }
    }
  }

  onOtpKeyUp(event: KeyboardEvent, index: number) {
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

  onOtpKeyDown(event: KeyboardEvent, index: number) {
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

  trackByIndex(index: number, obj: any): any {
    return index;
  }

  onFileSelected(event: any): void {
    const file = event.target?.files?.[0];
    if (file) {
      this.submitError.set('');
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        this.fileError = 'File size should not exceed 5MB';
        this.selectedFile = null;
        if (event.target) event.target.value = '';
      } else {
        this.selectedFile = file;
        this.fileError = '';
      }
      this.cdr.markForCheck();
    }
  }

  removeSelectedFile(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedFile = null;
    this.fileError = '';
    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = '';
    }
    this.cdr.markForCheck();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.submitError.set('');
      const file = files[0];
      if (file.size > 5 * 1024 * 1024) {
        this.fileError = 'File size should not exceed 5MB';
        this.selectedFile = null;
        if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = '';
      } else {
        this.selectedFile = file;
        this.fileError = '';
      }
      this.cdr.markForCheck();
    }
  }

  onEmailInput(): void {
    if (this.isEmailVerified()) return;
    this.emailVerifyError.set('');
    this.submitError.set('');
    this.studentForm.get('email')?.markAsUntouched();
    this.cdr.markForCheck();
  }

  onEmailBlur(): void {
    if (this.isEmailVerified()) return;
    this.studentForm.get('email')?.markAsTouched();
    this.cdr.markForCheck();
  }

  onEmailKeyDown(event: KeyboardEvent): void {
    if (this.isEmailVerified()) {
      if ((event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'C')) {
        return;
      }
      event.preventDefault();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target?.closest('.custom-year-picker-wrapper')) {
      if (this.activeYearPicker()) {
        this.activeYearPicker.set(null);
        this.cdr.markForCheck();
      }
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.activeYearPicker()) {
      this.activeYearPicker.set(null);
      this.cdr.markForCheck();
    }
  }

  getDecadeTitle(picker: 'joined' | 'passedOut'): string {
    const start = picker === 'joined' ? this.joinedDecadeStart() : this.passedOutDecadeStart();
    return `${start} – ${start + 11}`;
  }

  getDecadeYears(picker: 'joined' | 'passedOut'): number[] {
    const start = picker === 'joined' ? this.joinedDecadeStart() : this.passedOutDecadeStart();
    return Array.from({ length: 12 }, (_, i) => start + i);
  }

  prevDecade(picker: 'joined' | 'passedOut', event?: Event): void {
    if (event) event.stopPropagation();
    if (picker === 'joined') {
      this.joinedDecadeStart.update(s => s - 12);
    } else {
      this.passedOutDecadeStart.update(s => s - 12);
    }
    this.cdr.markForCheck();
  }

  nextDecade(picker: 'joined' | 'passedOut', event?: Event): void {
    if (event) event.stopPropagation();
    if (picker === 'joined') {
      this.joinedDecadeStart.update(s => s + 12);
    } else {
      this.passedOutDecadeStart.update(s => s + 12);
    }
    this.cdr.markForCheck();
  }

  jumpToCurrentYear(picker: 'joined' | 'passedOut', event?: Event): void {
    if (event) event.stopPropagation();
    const start = Math.floor((this.currentYear - 2020) / 12) * 12 + 2020;
    if (picker === 'joined') {
      this.joinedDecadeStart.set(start);
    } else {
      this.passedOutDecadeStart.set(start);
    }
    this.cdr.markForCheck();
  }

  openYearPicker(picker: 'joined' | 'passedOut'): void {
    const currentVal = picker === 'joined'
      ? this.studentForm.get('joinedYear')?.value
      : this.studentForm.get('passedOutYear')?.value;

    let baseYear = this.currentYear;
    if (currentVal && /^\d{4}$/.test(String(currentVal).trim())) {
      baseYear = parseInt(String(currentVal).trim(), 10);
    } else if (picker === 'passedOut') {
      const joinedVal = this.studentForm.get('joinedYear')?.value;
      if (joinedVal && /^\d{4}$/.test(String(joinedVal).trim())) {
        baseYear = parseInt(String(joinedVal).trim(), 10);
      }
    }

    const start = Math.floor((baseYear - 2020) / 12) * 12 + 2020;
    if (picker === 'joined') {
      this.joinedDecadeStart.set(start);
    } else {
      this.passedOutDecadeStart.set(start);
    }

    this.activeYearPicker.set(picker);
    this.cdr.markForCheck();
  }

  toggleYearPicker(picker: 'joined' | 'passedOut', event?: Event): void {
    if (event) event.stopPropagation();
    if (this.activeYearPicker() === picker) {
      this.activeYearPicker.set(null);
    } else {
      this.openYearPicker(picker);
    }
    this.cdr.markForCheck();
  }

  closeYearPicker(): void {
    this.activeYearPicker.set(null);
    this.cdr.markForCheck();
  }

  isJoinedYearSelected(year: number): boolean {
    const val = this.studentForm.get('joinedYear')?.value;
    return val ? parseInt(String(val).trim(), 10) === year : false;
  }

  isPassedOutYearSelected(year: number): boolean {
    const val = this.studentForm.get('passedOutYear')?.value;
    return val ? parseInt(String(val).trim(), 10) === year : false;
  }

  isJoinedYearDisabled(year: number): boolean {
    // Condition 1: If pass out year is already set, joined year cannot be greater than pass out year
    const rawPassed = this.studentForm.get('passedOutYear')?.value;
    if (rawPassed && /^\d{4}$/.test(String(rawPassed).trim())) {
      const passYear = parseInt(String(rawPassed).trim(), 10);
      if (year > passYear) return true;
    }
    // Condition 2: Joined year cannot be far into the future (students can join current or incoming year)
    if (year > this.currentYear + 1) return true;
    // Lower threshold
    if (year < 1990) return true;
    return false;
  }

  isPassedOutYearDisabled(year: number): boolean {
    // Condition 1: Pass out year cannot be earlier than joined year
    const rawJoined = this.studentForm.get('joinedYear')?.value;
    if (rawJoined && /^\d{4}$/.test(String(rawJoined).trim())) {
      const joinedYear = parseInt(String(rawJoined).trim(), 10);
      if (year < joinedYear) return true;
    }
    // Lower threshold
    if (year < 1990) return true;
    // Upper threshold for academic programs
    if (year > this.currentYear + 15) return true;
    return false;
  }

  getJoinedYearTooltip(year: number): string {
    if (this.isJoinedYearDisabled(year)) {
      const rawPassed = this.studentForm.get('passedOutYear')?.value;
      if (rawPassed && year > parseInt(String(rawPassed).trim(), 10)) {
        return `Cannot be later than Pass out year (${rawPassed})`;
      }
      if (year > this.currentYear + 1) {
        return `Cannot be a future year`;
      }
      return `Year unavailable`;
    }
    return `Select ${year}`;
  }

  getPassedOutYearTooltip(year: number): string {
    if (this.isPassedOutYearDisabled(year)) {
      const rawJoined = this.studentForm.get('joinedYear')?.value;
      if (rawJoined && year < parseInt(String(rawJoined).trim(), 10)) {
        return `Cannot be earlier than Joined year (${rawJoined})`;
      }
      return `Year unavailable`;
    }
    return `Select ${year}`;
  }

  selectJoinedYear(year: number, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.isJoinedYearDisabled(year)) return;

    this.studentForm.get('joinedYear')?.setValue(String(year));
    this.studentForm.get('joinedYear')?.markAsDirty();
    this.studentForm.get('joinedYear')?.markAsTouched();
    this.joinedYearError.set('');
    this.activeYearPicker.set(null);

    // If passed out year was already set and is now less than the new joined year, clear it
    const rawPassed = this.studentForm.get('passedOutYear')?.value;
    if (rawPassed && /^\d{4}$/.test(String(rawPassed).trim())) {
      const passedYear = parseInt(String(rawPassed).trim(), 10);
      if (passedYear < year) {
        this.studentForm.get('passedOutYear')?.setValue('');
        this.studentForm.get('passedOutYear')?.markAsUntouched();
        this.passedOutYearError.set('Please select a pass out year on or after joined year');
      }
    }

    // Auto prompt pass out year if not set
    if (!this.studentForm.get('passedOutYear')?.value) {
      setTimeout(() => {
        this.openYearPicker('passedOut');
      }, 120);
    }

    this.validateYearOrder();
    this.cdr.markForCheck();
  }

  selectPassedOutYear(year: number, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.isPassedOutYearDisabled(year)) return;

    this.studentForm.get('passedOutYear')?.setValue(String(year));
    this.studentForm.get('passedOutYear')?.markAsDirty();
    this.studentForm.get('passedOutYear')?.markAsTouched();
    this.passedOutYearError.set('');
    this.activeYearPicker.set(null);
    this.validateYearOrder();
    this.cdr.markForCheck();
  }

  onYearInputChange(field: 'joinedYear' | 'passedOutYear'): void {
    this.onFieldInput(field);
    const val = this.studentForm.get(field)?.value;
    if (val && /^\d{4}$/.test(String(val).trim())) {
      const num = parseInt(String(val).trim(), 10);
      const start = Math.floor((num - 2020) / 12) * 12 + 2020;
      if (field === 'joinedYear') {
        this.joinedDecadeStart.set(start);
      } else {
        this.passedOutDecadeStart.set(start);
      }
    }
    this.validateYearOrder();
  }

  private validateYearOrder(): void {
    const joined = this.studentForm.get('joinedYear')?.value;
    const pass = this.studentForm.get('passedOutYear')?.value;
    const passControl = this.studentForm.get('passedOutYear');
    if (!passControl) return;

    if (joined && pass && /^\d{4}$/.test(String(joined).trim()) && /^\d{4}$/.test(String(pass).trim())) {
      if (parseInt(String(pass).trim(), 10) < parseInt(String(joined).trim(), 10)) {
        const currentErrors = passControl.errors || {};
        passControl.setErrors({ ...currentErrors, invalidOrder: true });
        return;
      }
    }
    if (passControl.hasError('invalidOrder')) {
      const currentErrors = { ...(passControl.errors || {}) };
      delete currentErrors['invalidOrder'];
      passControl.setErrors(Object.keys(currentErrors).length > 0 ? currentErrors : null);
    }
  }

  onFieldInput(field: string): void {
    this.submitError.set('');
    if (field === 'phone') this.phoneError.set('');
    if (field === 'fullName') this.fullNameError.set('');
    if (field === 'city') this.cityError.set('');
    if (field === 'institute') this.instituteError.set('');
    if (field === 'joinedYear') this.joinedYearError.set('');
    if (field === 'passedOutYear') this.passedOutYearError.set('');
    if (field === 'confirmEnrolled') this.confirmEnrolledError.set('');
    this.studentForm.get(field)?.markAsUntouched();
    this.cdr.markForCheck();
  }

  onFieldBlur(field: string): void {
    this.studentForm.get(field)?.markAsTouched();
    this.cdr.markForCheck();
  }

  isPhoneInvalid(): boolean {
    const c = this.studentForm?.get('phone');
    return !!(this.phoneError() || (c && c.touched && c.invalid));
  }

  onlyNumericInput(event: KeyboardEvent): boolean {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return true;
    }
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      let digitsOnly = input.value.replace(/\D/g, '');
      if (digitsOnly.length > 10) {
        if (digitsOnly.startsWith('91')) {
          digitsOnly = digitsOnly.slice(2);
        } else if (digitsOnly.startsWith('0')) {
          digitsOnly = digitsOnly.slice(1);
        }
      }
      const sanitized = digitsOnly.slice(0, 10);
      if (input.value !== sanitized) {
        input.value = sanitized;
        this.studentForm.get('phone')?.setValue(sanitized, { emitEvent: false });
      }
    }
    this.phoneError.set('');
    this.submitError.set('');
    this.cdr.markForCheck();
  }

  onPhonePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const clipboardData = event.clipboardData || (window as any).clipboardData;
    const pastedText = clipboardData?.getData('text') || '';
    let digitsOnly = pastedText.replace(/\D/g, '');
    if (digitsOnly.length > 10) {
      if (digitsOnly.startsWith('91')) {
        digitsOnly = digitsOnly.slice(2);
      } else if (digitsOnly.startsWith('0')) {
        digitsOnly = digitsOnly.slice(1);
      }
    }
    const sanitized = digitsOnly.slice(0, 10);
    this.studentForm.get('phone')?.setValue(sanitized);
    this.studentForm.get('phone')?.markAsDirty();
    this.phoneError.set('');
    this.submitError.set('');
    this.cdr.markForCheck();
  }

  getPhoneErrorMessage(): string {
    const control = this.studentForm?.get('phone');
    const val = control?.value ? String(control.value).trim() : '';
    if (!val) {
      return 'Phone number is required';
    }
    if (!/^\d+$/.test(val)) {
      return 'Phone number must contain only numbers';
    }
    if (val.length < 10) {
      return 'Phone number must be 10 digits';
    }
    if (!/^[6-9]/.test(val)) {
      return 'Phone number must start with 6, 7, 8, or 9';
    }
    return 'Please enter a valid 10-digit mobile number';
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          resolve('');
        }
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  }

  async onSubmit(): Promise<void> {
    if (this.isSubmitting()) return;

    this.submitError.set('');
    this.fullNameError.set('');
    this.phoneError.set('');
    this.cityError.set('');
    this.instituteError.set('');
    this.joinedYearError.set('');
    this.passedOutYearError.set('');
    this.confirmEnrolledError.set('');

    if (!this.studentForm.valid || !this.selectedFile || !this.isEmailVerified()) {
      this.studentForm.markAllAsTouched();
      if (!this.selectedFile) {
        this.fileError = 'Please upload your student ID card';
      }
      if (!this.isEmailVerified()) {
        this.emailVerifyError.set('Please verify your email first');
      }
      if (this.studentForm.get('confirmEnrolled')?.invalid) {
        this.confirmEnrolledError.set('Please confirm your student enrollment');
      }
      this.cdr.markForCheck();
      return;
    }

    const rawJoined = this.studentForm.get('joinedYear')?.value;
    const rawPassed = this.studentForm.get('passedOutYear')?.value;
    if (rawJoined && rawPassed && /^\d{4}$/.test(String(rawJoined).trim()) && /^\d{4}$/.test(String(rawPassed).trim())) {
      if (parseInt(String(rawPassed).trim(), 10) < parseInt(String(rawJoined).trim(), 10)) {
        this.passedOutYearError.set('Pass out year cannot be earlier than joined year');
        this.studentForm.get('passedOutYear')?.markAsTouched();
        this.cdr.markForCheck();
        return;
      }
    }

    this.isSubmitting.set(true);
    this.submitError.set('');
    this.cdr.markForCheck();

    let imageUrl = '';
    if (this.selectedFile) {
      try {
        imageUrl = await this.readFileAsDataUrl(this.selectedFile);
      } catch (err: any) {
        this.isSubmitting.set(false);
        this.fileError = 'Could not read the uploaded ID card image. Please re-upload.';
        this.cdr.markForCheck();
        return;
      }
    }

    const joinedYearNum = rawJoined ? (isNaN(Number(rawJoined)) ? rawJoined : Number(rawJoined)) : null;
    const passedOutYearNum = rawPassed ? (isNaN(Number(rawPassed)) ? rawPassed : Number(rawPassed)) : null;

    const payload = {
      full_name: this.studentForm.get('fullName')?.value || '',
      email: this.studentForm.get('email')?.value || '',
      phone_number: this.studentForm.get('phone')?.value || '',
      city: this.studentForm.get('city')?.value || '',
      institution_name: this.studentForm.get('institute')?.value || '',
      image_url: imageUrl,
      joined_year: joinedYearNum,
      passed_out_year: passedOutYearNum
    };

    const url = this.getStudentApiUrl('credentials');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        credentials: 'include'
      });

      const data = await response.json().catch(() => ({}));

      if (this.isResponseSuccess(response, data)) {
        this.submitSuccess.set(true);
        this.submitError.set('');
        const successMessage = data?.message || 'Student credentials submitted successfully!';
        this.svc.showToast(successMessage, 4000, 'success');
        this.resetForm();
      } else {
        const errorMsg = data?.message || 'Failed to submit student credentials';
        this.handleBackendError(errorMsg, data);
      }
    } catch (err: any) {
      const errMessage = err?.message || 'Failed to submit student credentials';
      this.handleBackendError(errMessage);
    } finally {
      this.isSubmitting.set(false);
      this.cdr.markForCheck();
    }
  }

  private handleBackendError(errorMsg: string, data?: any): void {
    const rawMsg = data?.message || data?.error || errorMsg || '';
    const lower = rawMsg.toLowerCase();

    // Check if error is related to existing student / email
    if (lower.includes('already exists') || lower.includes('student with this email')) {
      this.emailVerifyError.set('');
      this.svc.showToast(rawMsg || 'Student with this email already exists', 4000, 'error');
      return;
    }

    // 1. Check if structured errors exist in data
    if (data?.errors) {
      if (typeof data.errors === 'object' && !Array.isArray(data.errors)) {
        let mappedAny = false;
        for (const [key, val] of Object.entries(data.errors)) {
          const valMsg = Array.isArray(val) ? val.join(', ') : String(val);
          if (valMsg.toLowerCase().includes('already exists')) {
            this.emailVerifyError.set('');
            this.svc.showToast(valMsg, 4000, 'error');
            return;
          }
          if (this.setFieldError(key, valMsg)) {
            mappedAny = true;
          }
        }
        if (mappedAny) return;
      } else if (Array.isArray(data.errors) && data.errors.length > 0) {
        let mappedAny = false;
        for (const item of data.errors) {
          const field = item?.field || item?.param || item?.key || item?.path || '';
          const msg = item?.message || item?.msg || String(item);
          if (msg.toLowerCase().includes('already exists')) {
            this.emailVerifyError.set('');
            this.svc.showToast(msg, 4000, 'error');
            return;
          }
          if (field && this.setFieldError(field, msg)) {
            mappedAny = true;
          }
        }
        if (mappedAny) return;
      }
    }

    // 2. Parse errorMsg string against field keywords
    if (lower.includes('phone') || lower.includes('mobile') || lower.includes('digit')) {
      this.phoneError.set(rawMsg);
      this.studentForm.get('phone')?.markAsTouched();
    } else if (lower.includes('email') || lower.includes('mail')) {
      this.emailVerifyError.set(rawMsg);
      this.studentForm.get('email')?.markAsTouched();
    } else if (lower.includes('full_name') || lower.includes('full name') || (lower.includes('name') && !lower.includes('institution') && !lower.includes('institute'))) {
      this.fullNameError.set(rawMsg);
      this.studentForm.get('fullName')?.markAsTouched();
    } else if (lower.includes('institution') || lower.includes('institute') || lower.includes('college') || lower.includes('school')) {
      this.instituteError.set(rawMsg);
      this.studentForm.get('institute')?.markAsTouched();
    } else if (lower.includes('joined_year') || lower.includes('joined year') || lower.includes('join year')) {
      this.joinedYearError.set(rawMsg);
      this.studentForm.get('joinedYear')?.markAsTouched();
    } else if (lower.includes('passed_out_year') || lower.includes('pass out year') || lower.includes('passout year') || lower.includes('passout') || lower.includes('passed out')) {
      this.passedOutYearError.set(rawMsg);
      this.studentForm.get('passedOutYear')?.markAsTouched();
    } else if (lower.includes('city')) {
      this.cityError.set(rawMsg);
      this.studentForm.get('city')?.markAsTouched();
    } else if (lower.includes('image') || lower.includes('id card') || lower.includes('id_card') || lower.includes('file') || lower.includes('upload') || lower.includes('document')) {
      this.fileError = rawMsg;
    } else if (lower.includes('enrolled') || lower.includes('confirm')) {
      this.confirmEnrolledError.set(rawMsg);
      this.studentForm.get('confirmEnrolled')?.markAsTouched();
    } else {
      // General error fallback only if no field matches
      this.submitError.set(rawMsg);
    }
  }

  private setFieldError(field: string, msg: string): boolean {
    const f = field.toLowerCase();
    if (f.includes('phone') || f.includes('mobile')) {
      this.phoneError.set(msg);
      this.studentForm.get('phone')?.markAsTouched();
      return true;
    } else if (f.includes('email')) {
      if (msg.toLowerCase().includes('already exists')) {
        this.emailVerifyError.set('');
        this.svc.showToast(msg, 4000, 'error');
        return true;
      }
      this.emailVerifyError.set(msg);
      this.studentForm.get('email')?.markAsTouched();
      return true;
    } else if (f.includes('full_name') || f.includes('fullname') || f.includes('name')) {
      this.fullNameError.set(msg);
      this.studentForm.get('fullName')?.markAsTouched();
      return true;
    } else if (f.includes('city')) {
      this.cityError.set(msg);
      this.studentForm.get('city')?.markAsTouched();
      return true;
    } else if (f.includes('institute') || f.includes('institution')) {
      this.instituteError.set(msg);
      this.studentForm.get('institute')?.markAsTouched();
      return true;
    } else if (f.includes('joined_year') || f.includes('joinedyear') || f.includes('join_year') || f.includes('joined')) {
      this.joinedYearError.set(msg);
      this.studentForm.get('joinedYear')?.markAsTouched();
      return true;
    } else if (f.includes('passed_out_year') || f.includes('passout') || f.includes('pass_out') || f.includes('passedout')) {
      this.passedOutYearError.set(msg);
      this.studentForm.get('passedOutYear')?.markAsTouched();
      return true;
    } else if (f.includes('image') || f.includes('file') || f.includes('card')) {
      this.fileError = msg;
      return true;
    } else if (f.includes('enroll') || f.includes('confirm')) {
      this.confirmEnrolledError.set(msg);
      this.studentForm.get('confirmEnrolled')?.markAsTouched();
      return true;
    }
    return false;
  }

  resetForm(): void {
    this.studentForm.reset({
      fullName: '',
      email: '',
      phone: '',
      city: '',
      institute: '',
      joinedYear: '',
      passedOutYear: '',
      confirmEnrolled: false
    });
    this.studentForm.markAsPristine();
    this.studentForm.markAsUntouched();

    this.selectedFile = null;
    this.fileError = '';
    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = '';
    }

    this.isEmailVerified.set(false);
    this.isVerifyingEmail.set(false);
    this.emailVerifyError.set('');
    this.otpVerifyError.set('');

    this.fullNameError.set('');
    this.phoneError.set('');
    this.cityError.set('');
    this.instituteError.set('');
    this.joinedYearError.set('');
    this.passedOutYearError.set('');
    this.confirmEnrolledError.set('');

    this.stopOtpTimer();
    this.showOtpModal.set(false);
    this.activeYearPicker.set(null);
    this.otp = ['', '', '', '', '', ''];
    this.isOtpExpired.set(false);
    this.isResendingOtp.set(false);

    this.submitError.set('');
    this.submitSuccess.set(false);
    this.cdr.markForCheck();
  }
}
