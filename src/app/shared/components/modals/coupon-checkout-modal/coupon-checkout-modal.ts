import { Component, EventEmitter, Input, Output, inject, ChangeDetectorRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AppConfigService } from '../../../../core/services/app-config.service';

@Component({
  selector: 'app-coupon-checkout-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './coupon-checkout-modal.html',
  styleUrls: ['./coupon-checkout-modal.scss']
})
export class CouponCheckoutModalComponent implements OnChanges {
  @Input() visible = false;
  @Input() plan: any = null;
  @Input() isAnnual = false;
  @Input() currency = 'INR';
  @Input() processingPayment = false;

  @Output() close = new EventEmitter<void>();
  @Output() proceed = new EventEmitter<{ couponCode?: string; offerId?: string; discount?: any }>();

  private http = inject(HttpClient);
  private appConfig = inject(AppConfigService);
  private cdr = inject(ChangeDetectorRef);

  couponInput = '';
  validating = false;
  validationError = '';
  appliedCoupon: any = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && changes['visible'].currentValue) {
      // Reset when reopened
      this.couponInput = '';
      this.validationError = '';
      this.appliedCoupon = null;
    }
  }

  get basePrice(): number {
    if (!this.plan) return 0;
    const raw = this.isAnnual
      ? (this.plan.price_annual || this.plan.price_monthly || 0)
      : (this.plan.price_monthly || 0);
    const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
    return Math.round(this.isAnnual ? (num * 12) : num);
  }

  get finalPrice(): number {
    if (this.appliedCoupon && this.appliedCoupon.final_amount !== undefined) {
      return Math.round(Number(this.appliedCoupon.final_amount));
    }
    return this.basePrice;
  }

  get discountAmount(): number {
    if (this.appliedCoupon && this.appliedCoupon.discount_amount !== undefined) {
      return Math.round(Number(this.appliedCoupon.discount_amount));
    }
    return 0;
  }

  get currencySymbol(): string {
    return this.currency?.toUpperCase() === 'USD' ? '$' : '₹';
  }

  get planDescription(): string {
    const desc = this.plan?.description;
    if (!desc || desc.toLowerCase().includes('freelancers and consultants')) {
      return 'Comprehensive schema design, AI generation, and advanced database tools for professionals.';
    }
    return desc;
  }

  onInputChange(): void {
    if (this.validationError) {
      this.validationError = '';
    }
    if (this.appliedCoupon && this.couponInput.trim().toUpperCase() !== this.appliedCoupon.coupon_code?.toUpperCase()) {
      this.appliedCoupon = null;
    }
  }

  validateAndApplyCoupon(autoProceed: boolean = false): void {
    const code = this.couponInput.trim();
    if (!code) {
      this.validationError = 'Please enter a coupon code';
      return;
    }

    if (!this.plan) return;

    this.validating = true;
    this.validationError = '';

    const baseUrl = this.appConfig.environment?.apiConfig?.baseUrl || 'http://localhost:4000/api';
    const validateUrl = this.appConfig.environment?.paymentApiUrls?.validateCoupon ||
      `${baseUrl.replace(/\/api$/, '')}/api/payments/validate-coupon`;

    this.http.post<any>(validateUrl, {
      couponCode: code,
      planSlug: this.plan.slug,
      billingCycle: this.isAnnual ? 'annual' : 'monthly'
    }, { withCredentials: true }).subscribe({
      next: (res) => {
        this.validating = false;
        if (res.valid) {
          this.appliedCoupon = res;
          this.validationError = '';
          if (autoProceed) {
            this.proceed.emit({
              couponCode: this.appliedCoupon?.coupon_code,
              offerId: this.appliedCoupon?.offer_id,
              discount: this.appliedCoupon
            });
          }
        } else {
          this.validationError = res.message || 'Coupon code is invalid';
          this.appliedCoupon = null;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.validating = false;
        this.appliedCoupon = null;
        this.validationError = err.error?.message || err.error?.error || 'Invalid or expired coupon code for this plan.';
        this.cdr.detectChanges();
      }
    });
  }

  removeCoupon(): void {
    this.appliedCoupon = null;
    this.couponInput = '';
    this.validationError = '';
  }

  onProceed(): void {
    if (this.validating || this.processingPayment) return;

    const enteredCode = this.couponInput.trim();
    // If a coupon code is typed but not yet applied, verify it first before proceeding
    if (enteredCode && (!this.appliedCoupon || this.appliedCoupon.coupon_code?.toUpperCase() !== enteredCode.toUpperCase())) {
      this.validateAndApplyCoupon(true);
      return;
    }

    // If coupon is not typed, proceeds with default plan (couponCode is undefined).
    // If coupon was applied, proceeds with the dedicated separate plan.
    this.proceed.emit({
      couponCode: this.appliedCoupon?.coupon_code,
      offerId: this.appliedCoupon?.offer_id,
      discount: this.appliedCoupon
    });
  }

  onClose(): void {
    this.close.emit();
  }
}

