import { Component, ChangeDetectorRef, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
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
export class StudentOfferComponent {
  @ViewChild('fileInput') fileInputRef?: ElementRef<HTMLInputElement>;

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
      phone: ['', [Validators.required, Validators.pattern(/^(?=(?:\D*\d){10,15}\D*$)\+?[\d\s()-]+$/)]],
      city: ['', Validators.required],
      institute: ['', Validators.required],
      joinedYear: ['', [Validators.required, Validators.pattern(/^(19|20)\d{2}$/)]],
      passedOutYear: ['', [Validators.required, Validators.pattern(/^(19|20)\d{2}$/)]],
      confirmEnrolled: [false, Validators.requiredTrue]
    });

    this.studentForm.get('email')?.valueChanges.subscribe(() => {
      this.emailVerifyError.set('');
      this.isEmailVerified.set(false);
      this.cdr.markForCheck();
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

  async sendOtp() {
    const email = this.studentForm.get('email')?.value;
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
      
      if (this.isResponseSuccess(response, data)) {
        this.showOtpModal.set(true);
        this.startOtpTimer();
      } else {
        this.emailVerifyError.set(data?.message || 'Failed to send OTP');
      }
    } catch (err: any) {
      this.emailVerifyError.set(err?.message || 'Failed to send OTP');
    } finally {
      this.isVerifyingEmail.set(false);
      this.cdr.markForCheck();
    }
  }

  async resendOtp() {
    if (this.isResendingOtp()) return;
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
        this.otpVerifyError.set(data?.message || 'Failed to resend OTP');
      }
    } catch (err: any) {
      this.otpVerifyError.set(err?.message || 'Failed to resend OTP');
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
    
    if (this.isOtpExpired()) {
      this.otpVerifyError.set('OTP expired. Please request a new one.');
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
      
      if (this.isResponseSuccess(response, data)) {
        this.isEmailVerified.set(true);
        this.closeOtpModal();
        this.svc.showToast(data?.message || 'Email verified successfully!', 3000, 'success');
      } else {
        this.otpVerifyError.set(data?.message || 'Invalid OTP');
      }
    } catch (err: any) {
      this.otpVerifyError.set(err?.message || 'Invalid OTP');
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

  onOtpInput(event: any, index: number) {
    const input = event.target as HTMLInputElement;
    let value = input.value;
    
    value = value.replace(/[^0-9]/g, '');
    
    if (value.length > 1) {
      value = value.substring(value.length - 1);
    }
    
    this.otp[index] = value;
    input.value = value;

    if (this.otpVerifyError()) {
      this.otpVerifyError.set('');
      this.cdr.markForCheck();
    }
  }

  onOtpKeyUp(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace') return;
    
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
    if (event.key === 'Backspace' && !this.otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`) as HTMLInputElement;
      if (prevInput) {
        prevInput.focus();
        this.otp[index - 1] = '';
        prevInput.value = '';
      }
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
    this.emailVerifyError.set('');
    this.submitError.set('');
    this.isEmailVerified.set(false);
    this.studentForm.get('email')?.markAsUntouched();
    this.cdr.markForCheck();
  }

  onEmailBlur(): void {
    this.studentForm.get('email')?.markAsTouched();
    this.cdr.markForCheck();
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
    // 1. Check if structured errors exist in data
    if (data?.errors) {
      if (typeof data.errors === 'object' && !Array.isArray(data.errors)) {
        let mappedAny = false;
        for (const [key, val] of Object.entries(data.errors)) {
          const valMsg = Array.isArray(val) ? val.join(', ') : String(val);
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
          if (field && this.setFieldError(field, msg)) {
            mappedAny = true;
          }
        }
        if (mappedAny) return;
      }
    }

    // 2. Parse errorMsg string against field keywords
    const lower = (errorMsg || '').toLowerCase();

    if (lower.includes('phone') || lower.includes('mobile') || lower.includes('digit')) {
      this.phoneError.set(errorMsg);
      this.studentForm.get('phone')?.markAsTouched();
    } else if (lower.includes('email') || lower.includes('mail')) {
      this.emailVerifyError.set(errorMsg);
      this.studentForm.get('email')?.markAsTouched();
    } else if (lower.includes('full_name') || lower.includes('full name') || (lower.includes('name') && !lower.includes('institution') && !lower.includes('institute'))) {
      this.fullNameError.set(errorMsg);
      this.studentForm.get('fullName')?.markAsTouched();
    } else if (lower.includes('institution') || lower.includes('institute') || lower.includes('college') || lower.includes('school')) {
      this.instituteError.set(errorMsg);
      this.studentForm.get('institute')?.markAsTouched();
    } else if (lower.includes('joined_year') || lower.includes('joined year') || lower.includes('join year')) {
      this.joinedYearError.set(errorMsg);
      this.studentForm.get('joinedYear')?.markAsTouched();
    } else if (lower.includes('passed_out_year') || lower.includes('pass out year') || lower.includes('passout year') || lower.includes('passout') || lower.includes('passed out')) {
      this.passedOutYearError.set(errorMsg);
      this.studentForm.get('passedOutYear')?.markAsTouched();
    } else if (lower.includes('city')) {
      this.cityError.set(errorMsg);
      this.studentForm.get('city')?.markAsTouched();
    } else if (lower.includes('image') || lower.includes('id card') || lower.includes('id_card') || lower.includes('file') || lower.includes('upload') || lower.includes('document')) {
      this.fileError = errorMsg;
    } else if (lower.includes('enrolled') || lower.includes('confirm')) {
      this.confirmEnrolledError.set(errorMsg);
      this.studentForm.get('confirmEnrolled')?.markAsTouched();
    } else {
      // General error fallback only if no field matches
      this.submitError.set(errorMsg);
    }
  }

  private setFieldError(field: string, msg: string): boolean {
    const f = field.toLowerCase();
    if (f.includes('phone') || f.includes('mobile')) {
      this.phoneError.set(msg);
      this.studentForm.get('phone')?.markAsTouched();
      return true;
    } else if (f.includes('email')) {
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
    this.otp = ['', '', '', '', '', ''];
    this.isOtpExpired.set(false);
    this.isResendingOtp.set(false);

    this.submitError.set('');
    this.submitSuccess.set(false);
    this.cdr.markForCheck();
  }
}
