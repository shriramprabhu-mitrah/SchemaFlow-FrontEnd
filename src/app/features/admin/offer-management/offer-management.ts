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
  showDiscountTypeDropdown = false;
  formPlanIds: Set<number> = new Set<number>();
  offerForm = this.getInitialForm();

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

  copyCode(code: string, event: Event): void {
    event.stopPropagation();
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      this.dashService.showToast(`Coupon code '${code}' copied!`, 2000, 'success');
    }).catch(() => {
      this.dashService.showToast('Failed to copy coupon code', 2000, 'error');
    });
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
    this.offerForm = this.getInitialForm();
    this.formPlanIds.clear();
    // Default: select all plans
    this.availablePlans.forEach(p => this.formPlanIds.add(p.plan_id));
    this.showDiscountTypeDropdown = false;
    this.createModalOpen = true;
    this.refreshView();
  }

  openEditModal(offer: any, event?: Event): void {
    if (event) event.stopPropagation();
    this.isEditing = true;
    this.showDiscountTypeDropdown = false;
    this.offerForm = {
      id: offer.id,
      code: offer.name || '',
      display_name: offer.display_name || offer.name || '',
      description: offer.description || '',
      discount_type: (offer.benefit?.unit === 'FLAT' ? 'FLAT' : 'PERCENTAGE') as 'PERCENTAGE' | 'FLAT',
      discount_value: offer.benefit?.percentage ?? offer.benefit?.flatAmount ?? 20,
      max_discount_cap: offer.benefit?.maxCap ?? null,
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
    this.showDiscountTypeDropdown = false;
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
    this.refreshView();
  }

  isFormPlanSelected(planId: number): boolean {
    return this.formPlanIds.has(planId);
  }

  selectAllFormPlans(): void {
    this.availablePlans.forEach(p => this.formPlanIds.add(p.plan_id));
    this.refreshView();
  }

  deselectAllFormPlans(): void {
    this.formPlanIds.clear();
    this.refreshView();
  }

  setFormRedemptionLimitPreset(limit: number): void {
    this.offerForm.max_redemptions = limit;
    this.refreshView();
  }

  stepFormRedemptionLimit(delta: number): void {
    const nextVal = (Number(this.offerForm.max_redemptions) || 0) + delta;
    this.offerForm.max_redemptions = Math.max(1, nextVal);
    this.refreshView();
  }

  toggleDiscountTypeDropdown(event: Event): void {
    event.stopPropagation();
    this.showDiscountTypeDropdown = !this.showDiscountTypeDropdown;
    this.refreshView();
  }

  selectDiscountType(type: 'PERCENTAGE' | 'FLAT'): void {
    this.offerForm.discount_type = type;
    this.showDiscountTypeDropdown = false;
    this.refreshView();
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
  }

  saveOffer(): void {
    const code = (this.offerForm.code || '').trim().toUpperCase();
    if (!code) {
      this.dashService.showToast('Coupon code is required', 3000, 'error');
      return;
    }

    if (!this.offerForm.discount_value || this.offerForm.discount_value <= 0) {
      this.dashService.showToast('Please enter a valid discount value', 3000, 'error');
      return;
    }

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
