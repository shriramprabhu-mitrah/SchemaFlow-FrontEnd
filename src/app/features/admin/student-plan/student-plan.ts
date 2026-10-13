import { Component, OnInit, inject, ChangeDetectorRef, HostListener, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Icons } from '../../../core/component/icons/icons';
import { AdminService } from '../services/admin.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { StudentSettingsService } from '../../../core/services/student-settings.service';
import { Subject, forkJoin, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, catchError } from 'rxjs/operators';

export interface MonthOption {
  value: number;
  label: string;
  payload: string;
}

@Component({
  selector: 'app-student-plan',
  standalone: true,
  imports: [CommonModule, FormsModule, Icons],
  templateUrl: './student-plan.html',
  styleUrls: ['./student-plan.scss']
})
export class StudentPlanComponent implements OnInit {
  private admin = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);
  public studentSettings = inject(StudentSettingsService);
  public dashService = inject(DashboardService);

  allStudents = signal<any[]>([]);
  searchInput = '';
  search = signal<string>('');
  page = signal<number>(1);
  limit = signal<number>(10);
  showLimitDropdown = signal<boolean>(false);
  sortColumn = signal<string>('is_approved');
  sortAsc = signal<boolean>(true);
  loading = signal<boolean>(true);
  error = signal<string>('');
  serverTotalCount = signal<number | null>(null);

  // Single student details modal state
  showDetailsModal = signal<boolean>(false);
  loadingStudentDetails = signal<boolean>(false);
  selectedStudent = signal<any>(null);
  detailsError = signal<string>('');

  // Image zoom modal
  showImagePreview = signal<boolean>(false);
  previewImageUrl = signal<string>('');

  // Status updating state
  updatingStudentId = signal<number | string | null>(null);
  updatingAction = signal<'accept' | 'reject' | null>(null);
  statusSuccessMsg = signal<string>('');

  // Month settings state
  studentPlan = signal<any>(null);
  monthSettings = signal<number>(6);
  showMonthModal = signal<boolean>(false);
  monthInput = signal<number>(6);
  savingMonth = signal<boolean>(false);
  monthError = signal<string>('');
  availableMonthOptions = signal<MonthOption[]>([]);
  showMonthDropdown = signal<boolean>(false);

  private searchSubject = new Subject<string>();

  @HostListener('document:click')
  onDocumentClick() {
    this.showLimitDropdown.set(false);
    this.showMonthDropdown.set(false);
  }

  ngOnInit(): void {
    this.load();
    this.loadMonthSettings();
    this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()).subscribe(val => {
      this.search.set(val);
      this.page.set(1);
      this.load();
    });
  }

  mapSortColumnToApi(col: string): string {
    switch (col) {
      case 'status':
      case 'is_approved':
        return 'is_approved';
      case 'full_name':
        return 'full_name';
      case 'email':
        return 'email';
      case 'city':
        return 'city';
      case 'institution_name':
        return 'institution_name';
      case 'joined_year':
        return 'joined_year';
      case 'passed_out_year':
        return 'passed_out_year';
      case 'id':
        return 'id';
      case 'created_at':
        return 'created_at';
      default:
        return col || 'is_approved';
    }
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.loadMonthSettings();
    this.cdr.markForCheck();

    const sortByParam = this.mapSortColumnToApi(this.sortColumn());
    const sortOrderParam = this.sortAsc() ? 'asc' : 'desc';

    this.admin.getStudentCredentials(this.page(), this.limit(), sortByParam, sortOrderParam, this.search()).subscribe({
      next: (res: any) => {
        let list: any[] = [];
        if (Array.isArray(res)) {
          list = res;
        } else if (Array.isArray(res?.data)) {
          list = res.data;
        } else if (Array.isArray(res?.data?.students)) {
          list = res.data.students;
        } else if (Array.isArray(res?.students)) {
          list = res.students;
        } else if (res && typeof res === 'object') {
          list = res?.data ? (Array.isArray(res.data) ? res.data : [res.data]) : [res];
        }

        const total = res?.total ?? res?.totalCount ?? res?.total_count ?? res?.count ??
                      res?.meta?.total ?? res?.meta?.totalCount ??
                      res?.pagination?.total ?? res?.data?.total ?? res?.data?.totalCount;
        if (typeof total === 'number' && !isNaN(total)) {
          this.serverTotalCount.set(total);
        } else {
          this.serverTotalCount.set(null);
        }

        this.allStudents.set(list);
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || err?.message || 'Failed to load student credentials');
        this.cdr.markForCheck();
      }
    });
  }

  onSearch(term: string): void {
    this.searchInput = term;
    this.searchSubject.next(term);
  }

  filteredStudents = computed(() => {
    let list = [...this.allStudents()];
    const q = this.search().trim().toLowerCase();
    if (q && this.serverTotalCount() === null) {
      list = list.filter(s =>
        (s.full_name || s.fullName || s.name || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.phone_number || s.phone || '').toLowerCase().includes(q) ||
        (s.city || '').toLowerCase().includes(q) ||
        (s.institution_name || s.institute || '').toLowerCase().includes(q) ||
        String(s.joined_year || s.joinedYear || '').toLowerCase().includes(q) ||
        String(s.passed_out_year || s.passedOutYear || '').toLowerCase().includes(q)
      );
    }

    if (this.serverTotalCount() === null) {
      const col = this.sortColumn();
      const asc = this.sortAsc();
      list.sort((a, b) => {
        const aVal = this.getProp(a, col);
        const bVal = this.getProp(b, col);
        if (aVal < bVal) return asc ? -1 : 1;
        if (aVal > bVal) return asc ? 1 : -1;
        return 0;
      });
    }

    return list;
  });

  totalFilteredCount = computed(() => {
    const sTotal = this.serverTotalCount();
    if (sTotal !== null) {
      return sTotal;
    }
    return this.filteredStudents().length;
  });

  totalPagesCount = computed(() => Math.ceil(this.totalFilteredCount() / this.limit()) || 1);

  totalPages = computed(() => {
    const total = this.totalPagesCount();
    const current = this.page();
    const maxVisible = 5;

    if (total <= maxVisible) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    const pages: number[] = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  paginatedStudents = computed(() => {
    if (this.serverTotalCount() !== null) {
      return this.filteredStudents();
    }
    const start = (this.page() - 1) * this.limit();
    return this.filteredStudents().slice(start, start + this.limit());
  });

  paginationStartIndex = computed(() => {
    if (this.totalFilteredCount() === 0) return 0;
    return (this.page() - 1) * this.limit() + 1;
  });

  paginationEndIndex = computed(() => {
    return Math.min(this.page() * this.limit(), this.totalFilteredCount());
  });

  goToPage(p: number): void {
    if (this.page() !== p && p >= 1 && p <= this.totalPagesCount()) {
      this.page.set(p);
      this.load();
    }
  }

  setLimit(l: number): void {
    this.limit.set(l);
    this.page.set(1);
    this.showLimitDropdown.set(false);
    this.load();
  }

  sortBy(col: string): void {
    if (this.sortColumn() === col) {
      this.sortAsc.set(!this.sortAsc());
    } else {
      this.sortColumn.set(col);
      this.sortAsc.set(true);
    }
    this.page.set(1);
    this.load();
  }

  private getProp(obj: any, col: string): any {
    switch (col) {
      case 'id':
        return obj.id ?? obj.student_id ?? 0;
      case 'full_name':
        return (obj.full_name || obj.fullName || obj.name || '').toLowerCase();
      case 'email':
        return (obj.email || '').toLowerCase();
      case 'city':
        return (obj.city || '').toLowerCase();
      case 'institution_name':
        return (obj.institution_name || obj.institute || '').toLowerCase();
      case 'joined_year':
        return obj.joined_year ?? obj.joinedYear ?? '';
      case 'passed_out_year':
        return obj.passed_out_year ?? obj.passedOutYear ?? '';
      case 'status':
        return this.getApprovalStatus(obj).toLowerCase();
      case 'created_at':
        return new Date(obj.created_at || obj.createdAt || 0).getTime();
      default:
        return obj[col] ?? '';
    }
  }

  getApprovalStatus(student: any): 'Accepted' | 'Rejected' | 'Pending' {
    const val = student?.is_approved ?? student?.is_accepted;
    if (val === true) return 'Accepted';
    if (val === false) return 'Rejected';
    return 'Pending';
  }

  viewDetails(student: any): void {
    const studentId = student?.id ?? student?.student_id;
    this.selectedStudent.set(student);
    this.showDetailsModal.set(true);
    this.detailsError.set('');

    if (studentId !== undefined && studentId !== null) {
      this.loadingStudentDetails.set(true);
      this.cdr.markForCheck();

      this.admin.getStudentCredentialById(studentId).subscribe({
        next: (res: any) => {
          const detail = res?.data || res?.student || res;
          if (detail && typeof detail === 'object') {
            this.selectedStudent.set({ ...student, ...detail });
          }
          this.loadingStudentDetails.set(false);
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          this.loadingStudentDetails.set(false);
          if (!this.selectedStudent()) {
            this.detailsError.set(err?.error?.message || err?.message || 'Failed to load student details');
          }
          this.cdr.markForCheck();
        }
      });
    } else {
      this.loadingStudentDetails.set(false);
      this.cdr.markForCheck();
    }
  }

  closeDetailsModal(): void {
    this.showDetailsModal.set(false);
    this.selectedStudent.set(null);
    this.detailsError.set('');
    this.loadingStudentDetails.set(false);
    this.cdr.markForCheck();
  }

  openImagePreview(imageUrl: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (!imageUrl) return;
    this.previewImageUrl.set(imageUrl);
    this.showImagePreview.set(true);
    this.cdr.markForCheck();
  }

  closeImagePreview(): void {
    this.showImagePreview.set(false);
    this.previewImageUrl.set('');
    this.cdr.markForCheck();
  }

  getStudentId(student: any): number | string {
    return student?.id ?? student?.student_id ?? '-';
  }

  getStudentName(student: any): string {
    return student?.full_name || student?.fullName || student?.name || 'N/A';
  }

  getStudentInstitution(student: any): string {
    return student?.institution_name || student?.institute || 'N/A';
  }

  getStudentJoinedYear(student: any): string | number {
    return student?.joined_year ?? student?.joinedYear ?? '-';
  }

  getStudentPassedOutYear(student: any): string | number {
    return student?.passed_out_year ?? student?.passedOutYear ?? '-';
  }

  getStudentAcademicYear(student: any): string {
    const joined = student?.joined_year ?? student?.joinedYear;
    const passed = student?.passed_out_year ?? student?.passedOutYear;
    if (joined && passed) return `${joined} – ${passed}`;
    if (joined) return `Joined: ${joined}`;
    if (passed) return `Pass out: ${passed}`;
    return '';
  }

  getStudentPhone(student: any): string {
    return student?.phone_number || student?.phone || 'N/A';
  }

  getStudentImageUrl(student: any): string {
    return student?.image_url || student?.imageUrl || student?.file_url || student?.image || '';
  }

  updateStatus(student: any, isApproved: boolean): void {
    const studentId = student?.id ?? student?.student_id;
    if (studentId === undefined || studentId === null) return;

    // Prevent clicking the same option twice
    const currentStatus = student?.is_approved ?? student?.is_accepted;
    if (currentStatus === isApproved) return;

    this.updatingStudentId.set(studentId);
    this.updatingAction.set(isApproved ? 'accept' : 'reject');
    this.error.set('');
    this.statusSuccessMsg.set('');
    this.cdr.markForCheck();

    this.admin.updateStudentCredentialStatus(studentId, isApproved).subscribe({
      next: (res: any) => {
        student.is_approved = isApproved;
        student.is_accepted = isApproved;
        this.allStudents.update(students =>
          students.map(s => {
            const sId = s?.id ?? s?.student_id;
            if (sId === studentId) {
              return { ...s, is_approved: isApproved, is_accepted: isApproved };
            }
            return s;
          })
        );
        this.statusSuccessMsg.set(`Student ${isApproved ? 'accepted' : 'rejected'} successfully.`);
        setTimeout(() => {
          this.statusSuccessMsg.set('');
          this.cdr.markForCheck();
        }, 3000);
        this.updatingStudentId.set(null);
        this.updatingAction.set(null);
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.updatingStudentId.set(null);
        this.updatingAction.set(null);
        this.error.set(err?.error?.message || err?.message || 'Failed to update student approval status');
        this.cdr.markForCheck();
      }
    });
  }

  // ── Month Settings Handlers ──
  get displayMonthSettings(): number {
    const val = this.monthSettings();
    return (typeof val === 'number' && !isNaN(val) && val > 0) ? Math.floor(val) : 6;
  }

  get displayMonthInput(): number {
    const val = this.monthInput();
    return (typeof val === 'number' && !isNaN(val) && val > 0) ? Math.floor(val) : 6;
  }

  getDefaultMonthOptions(): MonthOption[] {
    const allowed = [1, 3, 6, 9, 12];
    return allowed.map(n => ({
      value: n,
      label: n === 1 ? '1 Month' : `${n} Months`,
      payload: n === 1 ? '1 month' : `${n} months`
    }));
  }

  loadMonthSettings(): void {
    // 1. Fetch dynamic months from GET http://localhost:4000/api/admin/month-settings
    this.admin.getMonthSettings().subscribe({
      next: (res: any) => {
        const options = this.extractMonthOptions(res);
        if (options && options.length > 0) {
          this.availableMonthOptions.set(options);
        }

        const val = this.parseMonthValue(res);
        if (val > 0) {
          this.monthSettings.set(val);
          this.studentSettings.setMonth(val);
          this.monthInput.set(val);
        }
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        console.warn('Could not load month settings from API, using fallback:', err);
        if (this.availableMonthOptions().length === 0) {
          this.availableMonthOptions.set(this.getDefaultMonthOptions());
        }
        this.cdr.markForCheck();
      }
    });

    // 2. Also fetch plans to sync student plan object and month_plan
    this.admin.getAllPlansForDropdown().subscribe({
      next: (res: any) => {
        const plansList = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
        const found = plansList.find((p: any) => this.studentSettings.isStudentPlan(p));
        if (found) {
          this.studentPlan.set(found);
          const m = this.studentSettings.extractPlanMonth(found);
          if (m > 0) {
            this.monthSettings.set(m);
            this.studentSettings.setMonth(m);
            this.monthInput.set(m);
          }
        }
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        console.warn('Could not load plans for student plan duration:', err);
      }
    });
  }

  extractMonthOptions(res: any): MonthOption[] {
    const rawList: any[] = [];
    const tryAdd = (val: any): boolean => {
      if (Array.isArray(val) && val.length > 0) {
        rawList.push(...val);
        return true;
      }
      return false;
    };

    if (!tryAdd(res)) {
      if (!tryAdd(res?.data)) {
        if (!tryAdd(res?.months)) {
          if (!tryAdd(res?.data?.months)) {
            if (!tryAdd(res?.month_settings)) {
              if (!tryAdd(res?.data?.month_settings)) {
                if (!tryAdd(res?.settings)) {
                  if (!tryAdd(res?.data?.settings)) {
                    if (!tryAdd(res?.allowed_months)) {
                      if (!tryAdd(res?.data?.allowed_months)) {
                        if (res && typeof res === 'object') {
                          for (const v of Object.values(res)) {
                            if (tryAdd(v)) break;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    const options: MonthOption[] = [];
    const seen = new Set<number>();

    for (const item of rawList) {
      let rawVal = item;
      let rawPayload = '';
      if (item && typeof item === 'object') {
        rawVal = item.month ?? item.months ?? item.duration ?? item.duration_months ?? item.month_plan ?? item.value ?? item.name ?? item.label;
        rawPayload = item.payload ?? item.month ?? item.duration ?? '';
      }
      if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
        const str = String(rawVal).trim();
        const num = parseInt(str.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num) && num > 0 && !seen.has(num)) {
          seen.add(num);
          const label = num === 1 ? '1 Month' : `${num} Months`;
          const payload = (typeof rawPayload === 'string' && rawPayload.trim())
            ? rawPayload.trim()
            : (num === 1 ? '1 month' : `${num} months`);
          options.push({ value: num, label, payload });
        }
      }
    }

    options.sort((a, b) => a.value - b.value);

    if (options.length > 0) {
      return options;
    }

    return this.getDefaultMonthOptions();
  }

  parseMonthValue(res: any): number {
    return this.studentSettings.parseMonthValue(res);
  }

  openMonthModal(): void {
    const current = this.displayMonthSettings;
    this.monthInput.set(current);
    if (this.availableMonthOptions().length === 0) {
      this.loadMonthSettings();
    }
    this.showMonthDropdown.set(false);
    this.monthError.set('');
    this.showMonthModal.set(true);
    this.cdr.markForCheck();
  }

  closeMonthModal(): void {
    if (this.savingMonth()) return;
    this.showMonthModal.set(false);
    this.showMonthDropdown.set(false);
    this.cdr.markForCheck();
  }

  toggleMonthDropdown(event: Event): void {
    event.stopPropagation();
    this.showMonthDropdown.set(!this.showMonthDropdown());
    this.cdr.markForCheck();
  }

  selectMonthOption(opt: MonthOption): void {
    this.monthInput.set(opt.value);
    this.showMonthDropdown.set(false);
    this.monthError.set('');
    this.cdr.markForCheck();
  }

  getSelectedMonthLabel(): string {
    const current = this.displayMonthInput;
    const found = this.availableMonthOptions().find(o => o.value === current);
    if (found) return found.label;
    return current === 1 ? '1 Month' : `${current} Months`;
  }

  saveMonthSetting(): void {
    const newMonth = this.displayMonthInput;
    if (!newMonth || newMonth < 1) {
      this.monthError.set('Please select a valid duration.');
      return;
    }

    this.savingMonth.set(true);
    this.monthError.set('');
    this.cdr.markForCheck();

    const selectedOpt = this.availableMonthOptions().find(o => o.value === newMonth);
    const monthPayload = selectedOpt ? selectedOpt.payload : (newMonth === 1 ? '1 month' : `${newMonth} months`);

    const studentPlan = this.studentPlan();
    const studentPlanId = studentPlan?.plan_id ?? studentPlan?.id ?? 23;

    const planPayload = studentPlan ? {
      ...studentPlan,
      month_plan: newMonth
    } : {
      plan_id: studentPlanId,
      name: 'Student Plan',
      slug: 'student-plan',
      month_plan: newMonth
    };

    this.admin.updateGlobalMonth(monthPayload).subscribe({
      next: () => {
        this.admin.updatePlan(studentPlanId, planPayload).subscribe({
          error: () => {}
        });
        if (studentPlan) {
          studentPlan.month_plan = newMonth;
          this.studentPlan.set({ ...studentPlan, month_plan: newMonth });
        }
        this.monthSettings.set(newMonth);
        this.monthInput.set(newMonth);
        this.studentSettings.setMonth(newMonth);
        this.savingMonth.set(false);
        this.showMonthModal.set(false);
        const labelText = selectedOpt ? selectedOpt.label : `${newMonth} Months`;
        this.statusSuccessMsg.set(`Student offer duration successfully updated to ${labelText}.`);
        this.cdr.markForCheck();
        setTimeout(() => {
          this.statusSuccessMsg.set('');
          this.cdr.markForCheck();
        }, 3500);
      },
      error: (err: any) => {
        this.savingMonth.set(false);
        this.monthError.set(err?.error?.message || err?.message || 'Failed to update student plan duration');
        this.cdr.markForCheck();
      }
    });
  }
}

