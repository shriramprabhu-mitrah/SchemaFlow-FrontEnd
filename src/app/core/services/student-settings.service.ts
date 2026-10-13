import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { AppConfigService } from './app-config.service';

const CACHE_KEY = 'cachedStudentOfferMonth';
const DEFAULT_MONTH = 6;

@Injectable({
  providedIn: 'root'
})
export class StudentSettingsService {
  readonly studentMonth = signal<number>(this.getInitialMonth());

  constructor(
    private http: HttpClient,
    private appConfig: AppConfigService
  ) {
    this.loadFromPlansApi().subscribe();
  }

  private getInitialMonth(): number {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = parseInt(cached, 10);
          if (!isNaN(parsed) && parsed > 0) {
            return parsed;
          }
        }
      } catch {}
    }
    return DEFAULT_MONTH;
  }

  setMonth(val: number | string): void {
    const num = typeof val === 'number' ? val : parseInt(String(val).replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num) && num > 0) {
      const monthNum = Math.floor(num);
      this.studentMonth.set(monthNum);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(CACHE_KEY, String(monthNum));
        } catch {}
      }
    }
  }

  getMonthSettingsUrl(): string {
    const studentPlanUrls = this.appConfig.environment?.studentPlanApiUrls;
    if (studentPlanUrls?.monthSettings) {
      return studentPlanUrls.monthSettings;
    }
    const adminUrls = this.appConfig.environment?.adminApiUrls;
    if (adminUrls?.monthSettings) {
      return adminUrls.monthSettings;
    }
    const rawBase = this.appConfig.environment?.apiConfig?.baseUrl || '';
    if (rawBase) {
      const cleanBase = rawBase.replace(/\/+$/, '');
      if (cleanBase.endsWith('/api')) {
        return `${cleanBase}/admin/month-settings`;
      }
      return `${cleanBase}/api/admin/month-settings`;
    }
    const studentUrls = this.appConfig.environment?.studentApiUrls;
    if (studentUrls?.monthSettings) {
      return studentUrls.monthSettings;
    }
    return 'http://localhost:4000/api/admin/month-settings';
  }

  loadFromPlansApi(): Observable<any> {
    const plansUrl = this.appConfig.environment?.pricingApiUrls?.plans || this.appConfig.environment?.adminApiUrls?.plans;
    if (!plansUrl) return of(null);
    return this.http.get<any>(plansUrl).pipe(
      tap((res) => {
        const val = this.parseMonthValue(res);
        if (val > 0) {
          this.setMonth(val);
        }
      }),
      catchError(() => of(null))
    );
  }

  loadMonthSettings(): Observable<any> {
    const url = this.getMonthSettingsUrl();
    let headers = new HttpHeaders();
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token') || localStorage.getItem('access_token') || localStorage.getItem('auth_token');
      if (!token) {
        return of(null);
      }
      headers = headers.set('Authorization', `Bearer ${token}`);
    } else {
      return of(null);
    }

    return this.http.get<any>(url, { headers }).pipe(
      tap((res) => {
        const val = this.parseMonthValue(res);
        if (val > 0) {
          this.setMonth(val);
        }
      }),
      catchError(() => {
        return of(null);
      })
    );
  }

  isStudentPlan(plan: any): boolean {
    if (!plan) return false;
    const slug = (plan.slug || '').toLowerCase();
    const name = (plan.name || '').toLowerCase();
    return slug === 'student' || slug === 'student-plan' || slug.includes('student') || name.includes('student');
  }

  extractPlanMonth(plan?: any): number {
    if (!plan) return this.studentMonth();
    const candidates = [
      plan?.month_plan,
      plan?.month,
      plan?.duration_months,
      plan?.duration,
      plan?.months
    ];
    for (const val of candidates) {
      if (val !== undefined && val !== null && typeof val !== 'object' && val !== '') {
        const parsed = parseInt(String(val).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }
    return this.studentMonth();
  }

  parseMonthValue(res: any): number {
    if (!res) return this.studentMonth();
    if (typeof res === 'number' && !isNaN(res) && res > 0) return Math.floor(res);

    // If res is an array of plans or res.data is an array of plans
    const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : null);
    if (list) {
      const studentPlan = list.find((p: any) => this.isStudentPlan(p));
      if (studentPlan) {
        const m = this.extractPlanMonth(studentPlan);
        if (m > 0) return m;
      }
    }

    const candidates = [
      res?.month_plan,
      res?.month,
      res?.months,
      res?.data?.month_plan,
      res?.data?.month,
      res?.data?.months,
      res?.data?.duration,
      res?.data?.duration_months,
      res?.settings?.month_plan,
      res?.settings?.month,
      res?.settings?.months,
      res?.duration_months,
      res?.duration,
      res?.month_settings,
      res?.data
    ];

    for (const val of candidates) {
      if (val !== undefined && val !== null && typeof val !== 'object') {
        const parsed = parseInt(String(val).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }
    return this.studentMonth();
  }

  getBadgeText(plan: any): string {
    if (!plan) return '';
    if (this.isStudentPlan(plan)) {
      const m = this.extractPlanMonth(plan);
      return m === 1 ? 'FREE FOR 1 MONTH' : `FREE FOR ${m} MONTHS`;
    }
    if (plan.badge_text) {
      return plan.badge_text;
    }
    if (plan.slug === 'team') {
      return 'POPULAR COLLABORATION';
    }
    return '';
  }

  getValidityText(plan?: any): string {
    const m = plan ? this.extractPlanMonth(plan) : this.studentMonth();
    return m === 1 ? 'Valid for 1 month' : `Valid for ${m} months`;
  }

  getDurationText(plan?: any): string {
    const m = plan ? this.extractPlanMonth(plan) : this.studentMonth();
    return m === 1 ? 'for 1 month' : `for ${m} months`;
  }

  getHeadingText(plan?: any): string {
    const m = plan ? this.extractPlanMonth(plan) : this.studentMonth();
    const word = m === 1 ? '1 month' : `${m} months`;
    return `${word} of DBNexus,<br>free for students.`;
  }

  getFormSubtitle(plan?: any): string {
    const m = plan ? this.extractPlanMonth(plan) : this.studentMonth();
    const word = m === 1 ? '1 month' : `${m} months`;
    return `Complete the details below to claim your free ${word}. Fields marked <span class="req">*</span> are required.`;
  }

  getClaimButtonText(isSubmitting: boolean, plan?: any): string {
    if (isSubmitting) return 'Submitting...';
    const m = plan ? this.extractPlanMonth(plan) : this.studentMonth();
    return m === 1 ? 'Claim 1 month free' : `Claim ${m} months free`;
  }
}
