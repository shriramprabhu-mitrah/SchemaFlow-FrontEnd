import { Component, OnInit, inject, ChangeDetectorRef, signal, ApplicationRef, NgZone, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';
import { DashboardService } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-offer-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './offer-management.html',
  styleUrls: ['./offer-management.scss']
})
export class OfferManagementComponent implements OnInit {
  private adminService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);
  private appRef = inject(ApplicationRef);
  private ngZone = inject(NgZone);
  public dashService = inject(DashboardService);

  private _offers = signal<any[]>([]);
  get offers(): any[] { return this._offers(); }
  set offers(v: any[]) { this._offers.set(v); }

  private _availablePlans = signal<any[]>([]);
  get availablePlans(): any[] { return this._availablePlans(); }
  set availablePlans(v: any[]) { this._availablePlans.set(v); }

  private _loading = signal<boolean>(true);
  get loading(): boolean { return this._loading(); }
  set loading(v: boolean) { this._loading.set(v); }

  private _refreshing = signal<boolean>(false);
  get refreshing(): boolean { return this._refreshing(); }
  set refreshing(v: boolean) { this._refreshing.set(v); }

  private _saving = signal<boolean>(false);
  get saving(): boolean { return this._saving(); }
  set saving(v: boolean) { this._saving.set(v); }

  private _deleting = signal<boolean>(false);
  get deleting(): boolean { return this._deleting(); }
  set deleting(v: boolean) { this._deleting.set(v); }

  // Filter & Search
  searchQuery = '';
  statusFilter = 'all';

  // Link Plans Modal State
  selectedOffer: any = null;
  modalOpen = false;
  selectedPlanIds: Set<number> = new Set<number>();
  maxRedemptionsInput = 10;
  protected readonly Math = Math;

  // Create / Edit Modal State
  createModalOpen = false;
  isEditing = false;
  editingOffer: any = null;
  showDiscountTypeDropdown = false;
  formPlanIds: Set<number> = new Set<number>();
  offerForm = this.getInitialForm();
  formErrors: {
    code?: string;
    discount_value?: string;
    max_discount_cap?: string;
    max_redemptions?: string;
    dates?: string;
    plans?: string;
  } = {};

  // Custom Datepicker State
  activeDatePicker: 'start' | 'end' | null = null;
  pickerYear: number = new Date().getFullYear();
  pickerMonth: number = new Date().getMonth();
  pickerHour: number = 12;
  pickerMinute: number = 0;
  pickerPeriod: 'AM' | 'PM' = 'PM';
  pickerDays: Array<{
    date: Date;
    dayNum: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    isDisabled: boolean;
  }> = [];
  readonly monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  readonly weekDayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Delete Confirmation Modal State
  deleteConfirmOpen = false;
  offerToDelete: any = null;

  ngOnInit(): void {
    this.loadOffers();
  }

  refreshView(): void {
    this.cdr.markForCheck();
    this.cdr.detectChanges();
    try {
      this.appRef.tick();
    } catch { }
  }

  getInitialForm() {
    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    return {
      id: '',
      code: '',
      display_name: '',
      description: '',
      discount_type: 'PERCENTAGE' as 'PERCENTAGE' | 'FLAT',
      discount_value: 20,
      max_discount_cap: null as number | null,
      max_redemptions: 10,
      per_user_limit: 1,
      starts_at: this.formatForDateTimeLocal(now),
      ends_at: this.formatForDateTimeLocal(in30Days),
      never_expires: false,
      applicable_cycles: 'ALL_CYCLES' as 'FIRST_CYCLE' | 'ALL_CYCLES',
      status: 'active' as 'active' | 'inactive'
    };
  }

  get formDiscountPreview(): string {
    const val = this.offerForm.discount_value || 0;
    if (this.offerForm.discount_type === 'PERCENTAGE') {
      let s = `${val}% OFF`;
      if (this.offerForm.max_discount_cap) {
        s += ` (Up to ₹${this.offerForm.max_discount_cap})`;
      }
      return s;
    }
    return `₹${val} Flat Discount`;
  }

  formatForDateTimeLocal(val: any): string {
    if (!val) return '';
    const d = typeof val === 'number'
      ? new Date(val > 10000000000 ? val : val * 1000)
      : new Date(val);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n < 10 ? '0' + n : String(n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  isOfferExpired(ends_at: any): boolean {
    if (!ends_at) return false;
    const num = typeof ends_at === 'number' ? ends_at : (typeof ends_at === 'string' ? parseInt(ends_at, 10) : null);
    const endMs = num ? (num > 10000000000 ? num : num * 1000) : new Date(ends_at).getTime();
    return !isNaN(endMs) && Date.now() > endMs;
  }

  loadOffers(isManualSync = false): void {
    this.ngZone.run(() => {
      if (isManualSync) {
        this.refreshing = true;
      } else {
        this.loading = true;
      }
      this.refreshView();

      this.adminService.getOffers().subscribe({
        next: (res: any) => {
          this.ngZone.run(() => {
            const list = res?.offers || res?.data?.offers || res?.data || [];
            const plans = res?.available_plans || res?.data?.available_plans || [];
            this.offers = list;
            this.availablePlans = plans;
            this.loading = false;
            this.refreshing = false;
            if (isManualSync) {
              this.dashService.showToast('Offers synced successfully from database & Razorpay', 3000, 'success');
            }
            this.refreshView();
          });
        },
        error: (err: any) => {
          console.error('[OfferManagement] Error loading offers:', err);
          this.ngZone.run(() => {
            this.loading = false;
            this.refreshing = false;
            const msg = err.error?.error || err.error?.message || 'Failed to load offers';
            this.dashService.showToast(msg, 4000, 'error');
            this.refreshView();
          });
        }
      });
    });
  }

  get filteredOffers(): any[] {
    return this.offers.filter(offer => {
      const q = this.searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (offer.name && offer.name.toLowerCase().includes(q)) ||
        (offer.display_name && offer.display_name.toLowerCase().includes(q)) ||
        (offer.description && offer.description.toLowerCase().includes(q));

      const offerStatus = (offer.status || '').toString().toLowerCase();
      const isActive = offerStatus === 'active' || offerStatus === '1' || offerStatus === 'enabled';
      const isExpired = this.isOfferExpired(offer.ends_at);

      let matchesStatus = true;
      if (this.statusFilter === 'active') {
        matchesStatus = isActive && !isExpired;
      } else if (this.statusFilter === 'inactive') {
        matchesStatus = !isActive;
      } else if (this.statusFilter === 'expired') {
        matchesStatus = isExpired;
      }

      return matchesSearch && matchesStatus;
    });
  }

  get totalOffersCount(): number {
    return this.offers.length;
  }

  get activeOffersCount(): number {
    return this.offers.filter(o => {
      const s = (o.status || '').toString().toLowerCase();
      const isActive = s === 'active' || s === '1' || s === 'enabled';
      return isActive && !this.isOfferExpired(o.ends_at);
    }).length;
  }

  get inactiveOffersCount(): number {
    return this.offers.filter(o => {
      const s = (o.status || '').toString().toLowerCase();
      return s !== 'active' && s !== '1' && s !== 'enabled';
    }).length;
  }

  get expiredOffersCount(): number {
    return this.offers.filter(o => this.isOfferExpired(o.ends_at)).length;
  }

  get linkedOffersCount(): number {
    return this.offers.filter(o => o.linked_plans && o.linked_plans.length > 0).length;
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return 'No expiry';
    const num = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
    if (typeof timestamp === 'string' && isNaN(num)) {
      const d = new Date(timestamp);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }
    const date = new Date(num > 10000000000 ? num : num * 1000);
    if (isNaN(date.getTime())) return 'No expiry';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatDiscount(benefit: any): string {
    if (!benefit) return 'Special Offer';
    if (benefit.unit === 'PERCENTAGE' && benefit.percentage !== null && benefit.percentage !== undefined) {
      let text = `${benefit.percentage}% OFF`;
      if (benefit.maxCap) {
        text += ` (Up to ₹${benefit.maxCap})`;
      }
      return text;
    }
    if (benefit.flatAmount) {
      return `₹${benefit.flatAmount} OFF`;
    }
    return benefit.type || 'Discount';
  }

  getOfferDetailsTooltip(offer: any): string {
    if (!offer) return '';
    const title = offer.display_name || offer.name || '';
    if (offer.description) {
      return title ? `${title}\n${offer.description}` : offer.description;
    }
    return title;
  }

  copyCode(code: string, event: Event): void {
    event.stopPropagation();
    if (!code) return;

    // 1. Try modern navigator.clipboard if available (in secure HTTPS context)
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(code).then(() => {
        this.dashService.showToast(`Coupon code '${code}' copied!`, 2000, 'success');
      }).catch(() => {
        this.fallbackCopyText(code);
      });
      return;
    }

    // 2. Normal copy (works across HTTP, QA IP addresses, and browsers without clipboard API)
    this.fallbackCopyText(code);
  }

  private fallbackCopyText(code: string): void {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = code;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, code.length);

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        this.dashService.showToast(`Coupon code '${code}' copied!`, 2000, 'success');
      } else {
        this.dashService.showToast('Failed to copy coupon code', 2000, 'error');
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      this.dashService.showToast('Failed to copy coupon code', 2000, 'error');
    }
  }

  // ── Status Toggle ──
  toggleOfferStatus(offer: any, event?: Event): void {
    if (event) event.stopPropagation();
    const currentStatus = (offer.status || '').toLowerCase();
    const newStatus = (currentStatus === 'active' || currentStatus === '1') ? 'inactive' : 'active';

    // Optimistically update
    offer.status = newStatus.toUpperCase();
    this.refreshView();

    this.adminService.toggleOfferStatus(offer.id, newStatus).subscribe({
      next: () => {
        this.dashService.showToast(`Coupon '${offer.name}' marked as ${newStatus}`, 2500, 'success');
      },
      error: (err: any) => {
        // Revert on error
        offer.status = currentStatus.toUpperCase();
        const msg = err.error?.error || err.error?.message || 'Failed to update status';
        this.dashService.showToast(msg, 3500, 'error');
        this.refreshView();
      }
    });
  }

  // ── Create / Edit Coupon Modal ──
  openCreateModal(): void {
    this.isEditing = false;
    this.editingOffer = null;
    this.offerForm = this.getInitialForm();
    this.formPlanIds.clear();
    this.formErrors = {};
    // Default: select all plans
    this.availablePlans.forEach(p => this.formPlanIds.add(p.plan_id));
    this.showDiscountTypeDropdown = false;
    this.activeDatePicker = null;
    this.createModalOpen = true;
    this.refreshView();
  }

  openEditModal(offer: any, event?: Event): void {
    if (event) event.stopPropagation();
    this.isEditing = true;
    this.editingOffer = offer;
    this.formErrors = {};
    this.showDiscountTypeDropdown = false;
    this.activeDatePicker = null;
    this.offerForm = {
      id: offer.id,
      code: offer.name || '',
      display_name: offer.display_name || offer.name || '',
      description: offer.description || '',
      discount_type: (offer.benefit?.unit === 'FLAT' ? 'FLAT' : 'PERCENTAGE') as 'PERCENTAGE' | 'FLAT',
      discount_value: offer.benefit?.percentage ?? offer.benefit?.flatAmount ?? 20,
      max_discount_cap: offer.benefit?.maxCap ?? offer.max_discount_cap ?? null,
      max_redemptions: offer.max_redemptions || 10,
      per_user_limit: offer.per_user_limit || 1,
      starts_at: this.formatForDateTimeLocal(offer.starts_at),
      ends_at: offer.ends_at ? this.formatForDateTimeLocal(offer.ends_at) : '',
      never_expires: !offer.ends_at,
      applicable_cycles: (offer.applicable_cycles === 'FIRST_CYCLE' ? 'FIRST_CYCLE' : 'ALL_CYCLES') as 'FIRST_CYCLE' | 'ALL_CYCLES',
      status: (offer.status || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active'
    };
    this.formPlanIds = new Set<number>(offer.linked_plan_ids || []);
    this.createModalOpen = true;
    this.refreshView();
  }

  closeCreateModal(): void {
    this.createModalOpen = false;
    this.editingOffer = null;
    this.showDiscountTypeDropdown = false;
    this.activeDatePicker = null;
    this.formErrors = {};
    this.offerForm = this.getInitialForm();
    this.formPlanIds.clear();
    this.refreshView();
  }

  toggleFormPlan(planId: number): void {
    if (this.formPlanIds.has(planId)) {
      this.formPlanIds.delete(planId);
    } else {
      this.formPlanIds.add(planId);
    }
    this.validateForm('plans');
    this.refreshView();
  }

  isFormPlanSelected(planId: number): boolean {
    return this.formPlanIds.has(planId);
  }

  selectAllFormPlans(): void {
    this.availablePlans.forEach(p => this.formPlanIds.add(p.plan_id));
    this.validateForm('plans');
    this.refreshView();
  }

  deselectAllFormPlans(): void {
    this.formPlanIds.clear();
    this.validateForm('plans');
    this.refreshView();
  }

  get currentUsedCount(): number {
    if (this.isEditing && this.editingOffer) {
      return Number(this.editingOffer.redemption_count || 0);
    }
    return 0;
  }

  get minRedemptionsAllowed(): number {
    return Math.max(1, this.currentUsedCount);
  }

  get isDiscountModified(): boolean {
    if (!this.isEditing || !this.editingOffer) return false;
    const origType = (this.editingOffer.benefit?.unit === 'FLAT' ? 'FLAT' : 'PERCENTAGE');
    const origVal = Number(this.editingOffer.benefit?.percentage ?? this.editingOffer.benefit?.flatAmount ?? 0);
    const currType = this.offerForm.discount_type;
    const currVal = Number(this.offerForm.discount_value);

    // Check discount type or base value change
    if (currType !== origType || currVal !== origVal) {
      return true;
    }

    // Check max cap change for percentage discounts
    if (currType === 'PERCENTAGE') {
      const origCapRaw = this.editingOffer.benefit?.maxCap ?? this.editingOffer.max_discount_cap;
      const origCap = (origCapRaw !== null && origCapRaw !== undefined && origCapRaw !== '') ? Number(origCapRaw) : null;
      const currCapRaw = this.offerForm.max_discount_cap;
      const currCap = (currCapRaw !== null && currCapRaw !== undefined && (currCapRaw as any) !== '') ? Number(currCapRaw) : null;
      if (origCap !== currCap) {
        return true;
      }
    }

    // Check billing cycle policy change
    const origCycles = (this.editingOffer.applicable_cycles === 'FIRST_CYCLE' ? 'FIRST_CYCLE' : 'ALL_CYCLES');
    const currCycles = (this.offerForm.applicable_cycles === 'FIRST_CYCLE' ? 'FIRST_CYCLE' : 'ALL_CYCLES');
    if (origCycles !== currCycles) {
      return true;
    }

    return false;
  }

  get isExpirationModified(): boolean {
    if (!this.isEditing || !this.editingOffer) return false;
    const origNeverExpires = !this.editingOffer.ends_at;
    if (this.offerForm.never_expires !== origNeverExpires) {
      return true;
    }
    if (!this.offerForm.never_expires) {
      const origDate = this.parseDateSafe(this.editingOffer.ends_at);
      const currDate = this.parseDateSafe(this.offerForm.ends_at);
      if (!origDate && !currDate) return false;
      if (!origDate || !currDate) return true;
      return origDate.getTime() !== currDate.getTime();
    }
    return false;
  }

  setFormRedemptionLimitPreset(limit: number): void {
    if (limit < this.minRedemptionsAllowed) {
      const used = this.currentUsedCount;
      this.dashService.showToast(
        `Couldn't reduce member limit below the used count (${used} already claimed)`,
        3500,
        'error'
      );
      return;
    }
    this.offerForm.max_redemptions = limit;
    this.validateForm('max_redemptions');
    this.refreshView();
  }

  stepFormRedemptionLimit(delta: number): void {
    const currentVal = Number(this.offerForm.max_redemptions) || 0;
    const nextVal = currentVal + delta;
    if (delta < 0 && nextVal < this.minRedemptionsAllowed) {
      const used = this.currentUsedCount;
      this.dashService.showToast(
        used > 0
          ? `Couldn't reduce member limit below the used count (${used} already claimed)`
          : 'Member limit must be at least 1',
        3500,
        'error'
      );
      this.offerForm.max_redemptions = this.minRedemptionsAllowed;
      this.validateForm('max_redemptions');
      this.refreshView();
      return;
    }
    this.offerForm.max_redemptions = Math.max(this.minRedemptionsAllowed, nextVal);
    this.validateForm('max_redemptions');
    this.refreshView();
  }

  preventNegative(event: KeyboardEvent): void {
    if (event.key === '-' || event.key === 'e' || event.key === '+' || event.key === 'E') {
      event.preventDefault();
    }
  }

  onDiscountValueInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let val = parseFloat(input.value);
    if (!isNaN(val)) {
      if (val < 0) {
        val = 1;
        this.offerForm.discount_value = 1;
        input.value = '1';
      } else if (this.offerForm.discount_type === 'PERCENTAGE' && val > 100) {
        val = 100;
        this.offerForm.discount_value = 100;
        input.value = '100';
      }
    }
    this.validateForm('discount_value');
    this.refreshView();
  }

  onMaxCapInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let val = parseFloat(input.value);
    if (!isNaN(val) && val < 0) {
      this.offerForm.max_discount_cap = null;
      input.value = '';
    }
    this.validateForm('max_discount_cap');
    this.refreshView();
  }

  onRedemptionsInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let val = parseInt(input.value, 10);
    if (!isNaN(val) && val < 1) {
      this.offerForm.max_redemptions = 1;
      input.value = '1';
    }
    this.validateForm('max_redemptions');
    this.refreshView();
  }

  onCodeChange(): void {
    if (this.offerForm.code) {
      this.offerForm.code = this.offerForm.code.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    }
    this.validateForm('code');
    this.refreshView();
  }

  onStartDateChange(): void {
    if (this.offerForm.starts_at && this.offerForm.ends_at && !this.offerForm.never_expires) {
      const parsedStart = this.parseDateSafe(this.offerForm.starts_at);
      const parsedEnd = this.parseDateSafe(this.offerForm.ends_at);
      if (parsedStart && parsedEnd && parsedEnd.getTime() <= parsedStart.getTime()) {
        const nextEnd = new Date(parsedStart.getTime() + 30 * 24 * 60 * 60 * 1000);
        this.offerForm.ends_at = this.formatForDateTimeLocal(nextEnd);
      }
    }
    this.validateForm('dates');
    this.refreshView();
  }

  onDatesChange(): void {
    this.validateForm('dates');
    this.refreshView();
  }

  validateForm(field?: string): boolean {
    if (!field || field === 'code') {
      const code = (this.offerForm.code || '').trim().toUpperCase();
      if (!code) {
        this.formErrors.code = 'Coupon code is required';
      } else if (!/^[A-Z0-9_-]+$/.test(code)) {
        this.formErrors.code = 'Only uppercase letters, numbers, hyphens and underscores allowed';
      } else {
        const isDuplicate = this.offers.some(o =>
          (o.name || '').trim().toUpperCase() === code &&
          (!this.isEditing || o.id !== this.offerForm.id)
        );
        if (isDuplicate) {
          this.formErrors.code = `Coupon code '${code}' already exists. Please choose a different code.`;
        } else {
          delete this.formErrors.code;
        }
      }
    }

    if (!field || field === 'discount_value') {
      const val = Number(this.offerForm.discount_value);
      if (this.offerForm.discount_value === null || this.offerForm.discount_value === undefined || isNaN(val) || (this.offerForm.discount_value as any) === '') {
        this.formErrors.discount_value = 'Discount value is required';
      } else if (val <= 0) {
        this.formErrors.discount_value = 'Discount value must be greater than 0';
      } else if (this.offerForm.discount_type === 'PERCENTAGE' && val < 1) {
        this.formErrors.discount_value = 'Percentage discount must be at least 1%';
      } else if (this.offerForm.discount_type === 'PERCENTAGE' && val > 100) {
        this.formErrors.discount_value = 'Percentage discount cannot exceed 100%';
      } else if (this.offerForm.discount_type === 'FLAT' && val < 1) {
        this.formErrors.discount_value = 'Flat discount amount must be at least ₹1';
      } else {
        delete this.formErrors.discount_value;
      }
    }

    if (!field || field === 'max_discount_cap') {
      if (this.offerForm.discount_type === 'PERCENTAGE' && this.offerForm.max_discount_cap !== null && this.offerForm.max_discount_cap !== undefined && (this.offerForm.max_discount_cap as any) !== '') {
        const cap = Number(this.offerForm.max_discount_cap);
        if (isNaN(cap) || cap < 1) {
          this.formErrors.max_discount_cap = 'Max discount cap must be at least ₹1';
        } else {
          delete this.formErrors.max_discount_cap;
        }
      } else {
        delete this.formErrors.max_discount_cap;
      }
    }

    if (!field || field === 'max_redemptions') {
      const redemptions = Number(this.offerForm.max_redemptions);
      const minAllowed = this.minRedemptionsAllowed;
      const used = this.currentUsedCount;
      if (isNaN(redemptions) || redemptions < 1) {
        this.formErrors.max_redemptions = 'Max member limit must be at least 1';
      } else if (this.isEditing && redemptions < minAllowed) {
        this.formErrors.max_redemptions = `Couldn't reduce member limit below the used count (${used} already claimed)`;
      } else {
        delete this.formErrors.max_redemptions;
      }
    }

    if (!field || field === 'dates') {
      if (!this.offerForm.starts_at) {
        this.formErrors.dates = 'Start date is required';
      } else if (!this.offerForm.never_expires) {
        if (!this.offerForm.ends_at) {
          this.formErrors.dates = 'Expiration date is required when Never Expires is off';
        } else {
          const parsedStart = this.parseDateSafe(this.offerForm.starts_at);
          const parsedEnd = this.parseDateSafe(this.offerForm.ends_at);
          const start = parsedStart ? parsedStart.getTime() : NaN;
          const end = parsedEnd ? parsedEnd.getTime() : NaN;
          if (isNaN(start) || isNaN(end)) {
            this.formErrors.dates = 'Please enter valid start and expiration dates';
          } else if (end <= start) {
            this.formErrors.dates = 'Expiration date must be greater than start date';
          } else {
            delete this.formErrors.dates;
          }
        }
      } else {
        delete this.formErrors.dates;
      }
    }

    if (!field || field === 'plans') {
      if (this.formPlanIds.size === 0) {
        this.formErrors.plans = 'Please select at least one applicable plan';
      } else {
        delete this.formErrors.plans;
      }
    }

    return Object.keys(this.formErrors).length === 0;
  }

  toggleDiscountTypeDropdown(event: Event): void {
    event.stopPropagation();
    this.showDiscountTypeDropdown = !this.showDiscountTypeDropdown;
    this.refreshView();
  }

  selectDiscountType(type: 'PERCENTAGE' | 'FLAT'): void {
    this.offerForm.discount_type = type;
    this.showDiscountTypeDropdown = false;
    this.validateForm('discount_value');
    this.validateForm('max_discount_cap');
    this.refreshView();
  }

  parseDateSafe(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val === 'number') {
      const ms = val > 10000000000 ? val : val * 1000;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      const num = Number(trimmed);
      if (!isNaN(num) && /^\d+$/.test(trimmed)) {
        const ms = num > 10000000000 ? num : num * 1000;
        const d = new Date(ms);
        return isNaN(d.getTime()) ? null : d;
      }
      const d = new Date(trimmed);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  formatDisplayDateTime(dateVal: any): string {
    const d = this.parseDateSafe(dateVal);
    if (!d) return '';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  toggleDatePicker(type: 'start' | 'end', event?: Event): void {
    if (event) event.stopPropagation();
    if (type === 'end' && this.offerForm.never_expires) return;

    if (this.activeDatePicker === type) {
      this.activeDatePicker = null;
      this.refreshView();
      return;
    }

    this.activeDatePicker = type;
    this.showDiscountTypeDropdown = false;

    const currentVal = type === 'start' ? this.offerForm.starts_at : this.offerForm.ends_at;
    let initialDate = this.parseDateSafe(currentVal);
    const parsedStart = this.parseDateSafe(this.offerForm.starts_at);

    if (type === 'end') {
      if (!initialDate || (parsedStart && initialDate.getTime() <= parsedStart.getTime())) {
        if (parsedStart) {
          initialDate = new Date(parsedStart.getTime() + 30 * 24 * 60 * 60 * 1000);
        } else {
          initialDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        }
      }
    } else {
      if (!initialDate) {
        initialDate = new Date();
      }
    }

    this.pickerYear = initialDate.getFullYear();
    this.pickerMonth = initialDate.getMonth();
    const rawH = initialDate.getHours();
    this.pickerPeriod = rawH >= 12 ? 'PM' : 'AM';
    this.pickerHour = rawH % 12 || 12;
    this.pickerMinute = initialDate.getMinutes();

    this.buildCalendarGrid();
    this.refreshView();
  }

  closeDatePicker(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.activeDatePicker = null;
    this.validateForm('dates');
    this.refreshView();
  }

  canGoToPrevMonth(): boolean {
    if (this.activeDatePicker === 'end' && this.offerForm.starts_at) {
      const parsedStart = this.parseDateSafe(this.offerForm.starts_at);
      if (parsedStart) {
        const startYear = parsedStart.getFullYear();
        const startMonth = parsedStart.getMonth();
        if (this.pickerYear < startYear || (this.pickerYear === startYear && this.pickerMonth <= startMonth)) {
          return false;
        }
      }
    }
    return true;
  }

  buildCalendarGrid(): void {
    const year = this.pickerYear;
    const month = this.pickerMonth;
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selectedVal = this.activeDatePicker === 'start' ? this.offerForm.starts_at : this.offerForm.ends_at;
    const selectedDate = this.parseDateSafe(selectedVal);
    if (selectedDate) selectedDate.setHours(0, 0, 0, 0);

    let startDateLimit: Date | null = null;
    if (this.activeDatePicker === 'end' && this.offerForm.starts_at) {
      const parsedStart = this.parseDateSafe(this.offerForm.starts_at);
      if (parsedStart) {
        startDateLimit = new Date(parsedStart);
        startDateLimit.setHours(0, 0, 0, 0);
      }
    }

    const cells: typeof this.pickerDays = [];

    // Helper to test if day is disabled
    const checkDisabled = (d: Date): boolean => {
      if (this.activeDatePicker === 'end') {
        if (startDateLimit) {
          return d.getTime() < startDateLimit.getTime();
        }
        return d.getTime() < today.getTime();
      }
      return false;
    };

    // Previous month filler days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const d = new Date(year, month - 1, dayNum);
      d.setHours(0, 0, 0, 0);
      cells.push({
        date: d,
        dayNum,
        isCurrentMonth: false,
        isToday: d.getTime() === today.getTime(),
        isSelected: selectedDate ? d.getTime() === selectedDate.getTime() : false,
        isDisabled: checkDisabled(d)
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const d = new Date(year, month, dayNum);
      d.setHours(0, 0, 0, 0);
      cells.push({
        date: d,
        dayNum,
        isCurrentMonth: true,
        isToday: d.getTime() === today.getTime(),
        isSelected: selectedDate ? d.getTime() === selectedDate.getTime() : false,
        isDisabled: checkDisabled(d)
      });
    }

    // Next month filler days (to complete 42 cells = 6 rows)
    const remaining = 42 - cells.length;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const d = new Date(year, month + 1, dayNum);
      d.setHours(0, 0, 0, 0);
      cells.push({
        date: d,
        dayNum,
        isCurrentMonth: false,
        isToday: d.getTime() === today.getTime(),
        isSelected: selectedDate ? d.getTime() === selectedDate.getTime() : false,
        isDisabled: checkDisabled(d)
      });
    }

    this.pickerDays = cells;
  }

  prevPickerMonth(event?: Event): void {
    if (event) event.stopPropagation();
    if (!this.canGoToPrevMonth()) return;
    if (this.pickerMonth === 0) {
      this.pickerMonth = 11;
      this.pickerYear--;
    } else {
      this.pickerMonth--;
    }
    this.buildCalendarGrid();
    this.refreshView();
  }

  nextPickerMonth(event?: Event): void {
    if (event) event.stopPropagation();
    if (this.pickerMonth === 11) {
      this.pickerMonth = 0;
      this.pickerYear++;
    } else {
      this.pickerMonth++;
    }
    this.buildCalendarGrid();
    this.refreshView();
  }

  selectPickerDate(cell: typeof this.pickerDays[0], event?: Event): void {
    if (event) event.stopPropagation();
    if (cell.isDisabled) return;

    if (!cell.isCurrentMonth) {
      this.pickerYear = cell.date.getFullYear();
      this.pickerMonth = cell.date.getMonth();
    }

    this.applyPickerValue(cell.date);
    this.buildCalendarGrid();
    this.refreshView();
  }

  applyPickerValue(dateOnly?: Date): void {
    if (!this.activeDatePicker) return;

    let targetDate: Date;
    if (dateOnly) {
      targetDate = new Date(dateOnly);
    } else {
      const curVal = this.activeDatePicker === 'start' ? this.offerForm.starts_at : this.offerForm.ends_at;
      targetDate = this.parseDateSafe(curVal) || new Date();
    }

    let h24 = this.pickerHour % 12;
    if (this.pickerPeriod === 'PM') h24 += 12;

    targetDate.setHours(h24, this.pickerMinute, 0, 0);
    const formatted = this.formatForDateTimeLocal(targetDate);

    if (this.activeDatePicker === 'start') {
      this.offerForm.starts_at = formatted;
      this.onStartDateChange();
    } else {
      this.offerForm.ends_at = formatted;
      this.onDatesChange();
    }
  }

  setPickerHour(hour: any, event?: Event): void {
    if (event) event.stopPropagation();
    const h = parseInt(hour, 10);
    if (!isNaN(h)) {
      this.pickerHour = Math.max(1, Math.min(12, h));
      this.applyPickerValue();
      this.refreshView();
    }
  }

  setPickerMinute(minute: any, event?: Event): void {
    if (event) event.stopPropagation();
    const m = parseInt(minute, 10);
    if (!isNaN(m)) {
      this.pickerMinute = Math.max(0, Math.min(59, m));
      this.applyPickerValue();
      this.refreshView();
    }
  }

  setPickerPeriod(period: 'AM' | 'PM', event?: Event): void {
    if (event) event.stopPropagation();
    this.pickerPeriod = period;
    this.applyPickerValue();
    this.refreshView();
  }


  onModalContainerClick(event: MouseEvent): void {
    event.stopPropagation();
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-datepicker-container')) {
      if (this.activeDatePicker) {
        this.closeDatePicker();
      }
    }
    if (!target.closest('.custom-select-container')) {
      if (this.showDiscountTypeDropdown) {
        this.showDiscountTypeDropdown = false;
        this.refreshView();
      }
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-select-container')) {
      if (this.showDiscountTypeDropdown) {
        this.showDiscountTypeDropdown = false;
        this.refreshView();
      }
    }
    if (!target.closest('.custom-datepicker-container')) {
      if (this.activeDatePicker) {
        this.closeDatePicker();
      }
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.activeDatePicker) {
      this.closeDatePicker();
    }
    if (this.showDiscountTypeDropdown) {
      this.showDiscountTypeDropdown = false;
      this.refreshView();
    }
  }

  saveOffer(): void {
    if (!this.validateForm()) {
      const firstError = Object.values(this.formErrors)[0];
      if (firstError) {
        this.dashService.showToast(firstError, 3500, 'error');
      }
      return;
    }

    const code = (this.offerForm.code || '').trim().toUpperCase();

    this.saving = true;
    this.refreshView();

    const planIds = Array.from(this.formPlanIds);
    const payload: any = {
      code,
      name: code,
      display_name: this.offerForm.display_name || code,
      description: this.offerForm.description || '',
      discount_type: this.offerForm.discount_type,
      discount_value: Number(this.offerForm.discount_value),
      max_discount_cap: this.offerForm.discount_type === 'PERCENTAGE' && this.offerForm.max_discount_cap ? Number(this.offerForm.max_discount_cap) : null,
      max_redemptions: Math.max(1, Number(this.offerForm.max_redemptions) || 10),
      per_user_limit: 1,
      applicable_cycles: this.offerForm.applicable_cycles || 'ALL_CYCLES',
      status: this.offerForm.status,
      starts_at: this.offerForm.starts_at ? new Date(this.offerForm.starts_at).toISOString() : new Date().toISOString(),
      ends_at: !this.offerForm.never_expires && this.offerForm.ends_at ? new Date(this.offerForm.ends_at).toISOString() : null,
      plan_ids: planIds
    };

    const action$ = this.isEditing && this.offerForm.id
      ? this.adminService.updateOffer(this.offerForm.id, payload)
      : this.adminService.createOffer(payload);

    action$.subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          this.saving = false;
          this.createModalOpen = false;
          this.formErrors = {};
          this.dashService.showToast(
            this.isEditing ? `Coupon '${code}' updated successfully!` : `Coupon '${code}' created successfully!`,
            3000,
            'success'
          );
          this.loadOffers();
        });
      },
      error: (err: any) => {
        this.ngZone.run(() => {
          this.saving = false;
          const msg = err.error?.error || err.error?.message || 'Failed to save coupon';
          this.dashService.showToast(msg, 4000, 'error');
          this.refreshView();
        });
      }
    });
  }

  // ── Delete Confirmation Modal ──
  openDeleteModal(offer: any, event?: Event): void {
    if (event) event.stopPropagation();
    this.offerToDelete = offer;
    this.deleteConfirmOpen = true;
    this.refreshView();
  }

  closeDeleteModal(): void {
    this.deleteConfirmOpen = false;
    this.offerToDelete = null;
    this.refreshView();
  }

  confirmDelete(): void {
    if (!this.offerToDelete) return;
    this.deleting = true;
    this.refreshView();

    this.adminService.deleteOffer(this.offerToDelete.id).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.deleting = false;
          this.deleteConfirmOpen = false;
          const code = this.offerToDelete.name;
          this.offerToDelete = null;
          this.dashService.showToast(`Coupon '${code}' deleted successfully`, 3000, 'success');
          this.loadOffers();
        });
      },
      error: (err: any) => {
        this.ngZone.run(() => {
          this.deleting = false;
          const msg = err.error?.error || err.error?.message || 'Failed to delete offer';
          this.dashService.showToast(msg, 4000, 'error');
          this.refreshView();
        });
      }
    });
  }

  // ── Plan Linking Modal ──
  openLinkModal(offer: any, event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedOffer = offer;
    this.selectedPlanIds = new Set<number>(offer.linked_plan_ids || []);
    this.maxRedemptionsInput = offer.max_redemptions !== undefined && offer.max_redemptions !== null ? offer.max_redemptions : 10;
    this.modalOpen = true;
    this.refreshView();
  }

  closeModal(): void {
    this.modalOpen = false;
    this.selectedOffer = null;
    this.selectedPlanIds.clear();
    this.maxRedemptionsInput = 10;
    this.refreshView();
  }

  isPlanSelected(planId: number): boolean {
    return this.selectedPlanIds.has(planId);
  }

  togglePlan(planId: number): void {
    if (this.selectedPlanIds.has(planId)) {
      this.selectedPlanIds.delete(planId);
    } else {
      this.selectedPlanIds.add(planId);
    }
    this.refreshView();
  }

  selectAllPlans(): void {
    this.availablePlans.forEach(p => this.selectedPlanIds.add(p.plan_id));
    this.refreshView();
  }

  deselectAllPlans(): void {
    this.selectedPlanIds.clear();
    this.refreshView();
  }

  setRedemptionLimitPreset(limit: number): void {
    this.maxRedemptionsInput = limit;
    this.refreshView();
  }

  stepRedemptionLimit(delta: number): void {
    const nextVal = (Number(this.maxRedemptionsInput) || 0) + delta;
    this.maxRedemptionsInput = Math.max(1, nextVal);
    this.refreshView();
  }

  saveOfferPlans(): void {
    if (!this.selectedOffer) return;

    this.saving = true;
    this.refreshView();
    const planIds = Array.from(this.selectedPlanIds);

    this.adminService.linkOffer(this.selectedOffer.id, planIds, this.maxRedemptionsInput).subscribe({
      next: (res: any) => {
        this.ngZone.run(() => {
          this.saving = false;
          const updatedPlans = res.linked_plans || [];
          const updatedPlanIds = res.linked_plan_ids || [];

          this.selectedOffer.linked_plans = updatedPlans;
          this.selectedOffer.linked_plan_ids = updatedPlanIds;
          this.selectedOffer.max_redemptions = this.maxRedemptionsInput;

          const currentOffers = [...this.offers];
          const idx = currentOffers.findIndex(o => o.id === this.selectedOffer.id);
          if (idx !== -1) {
            currentOffers[idx] = {
              ...currentOffers[idx],
              linked_plans: updatedPlans,
              linked_plan_ids: updatedPlanIds,
              max_redemptions: this.maxRedemptionsInput
            };
            this.offers = currentOffers;
          }

          this.dashService.showToast(`Offer successfully linked to ${planIds.length} plan(s).`, 3000, 'success');
          this.closeModal();
          this.refreshView();
        });
      },
      error: (err: any) => {
        this.ngZone.run(() => {
          this.saving = false;
          const msg = err.error?.error || err.error?.message || 'Failed to update offer plan linkages';
          this.dashService.showToast(msg, 4000, 'error');
          this.refreshView();
        });
      }
    });
  }
}
