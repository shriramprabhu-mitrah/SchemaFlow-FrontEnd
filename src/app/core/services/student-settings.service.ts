import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { AppConfigService } from './app-config.service';

const CACHE_KEY = 'cachedStudentOfferMonth';
const CACHE_FEATURES_KEY = 'cachedStudentOfferFeatures';
const DEFAULT_MONTH = 6;
export const DEFAULT_STUDENT_FEATURES: string[] = [
  'Upto 20 Diagrams',
  'Table Relationships',
  'Sql Compare',
  'Customize Canvas',
  'Diagram Notes',
  'Table Group',
  'Import SQL',
  'Export as PNG/SVG/PDF',
  'Export as SQL & NoSQL',
  'Share Diagrams',
  'Database Connection'
];

@Injectable({
  providedIn: 'root'
})
export class StudentSettingsService {
  readonly studentMonth = signal<number>(this.getInitialMonth());
  readonly studentPlan = signal<any>(null);
  readonly studentFeatures = signal<string[]>(this.getInitialFeatures());

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

  private getInitialFeatures(): string[] {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(CACHE_FEATURES_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.filter((f: string) => f !== 'Table Color & Connection Color');
          }
        }
      } catch {}
    }
    return DEFAULT_STUDENT_FEATURES;
  }

  setStudentPlan(plan: any): void {
    if (!plan) return;
    this.studentPlan.set(plan);
    const feats = this.extractFeaturesFromPlan(plan);
    if (feats && feats.length > 0) {
      this.studentFeatures.set(feats);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(CACHE_FEATURES_KEY, JSON.stringify(feats));
        } catch {}
      }
    }
  }

  getDisplayFeatures(): string[] {
    const list = this.studentFeatures();
    if (list && list.length > 0) {
      return list;
    }
    return DEFAULT_STUDENT_FEATURES;
  }

  extractFeaturesFromPlan(plan: any): string[] {
    if (!plan || !Array.isArray(plan.entitlements)) {
      return [];
    }

    const isTrue = (val: any) => val === true || val === 'true' || val === 1 || val === '1';

    const validEnts = plan.entitlements.filter((ent: any) => {
      // Both value and show_in_pricing must be true
      const isValueTrue = isTrue(ent.value);
      const isShowInPricingTrue = isTrue(ent.show_in_pricing);
      if (!isValueTrue || !isShowInPricingTrue) return false;

      if (ent.display_text === '-' || ent.display_text === '—') return false;
      return true;
    }).sort((a: any, b: any) => {
      const orderA = a.display_order ?? a.feature_order ?? a.order ?? 999999;
      const orderB = b.display_order ?? b.feature_order ?? b.order ?? 999999;
      if (orderA !== orderB) return Number(orderA) - Number(orderB);
      return (Number(a.feature_id || 0) - Number(b.feature_id || 0));
    });

    const labels: string[] = [];

    for (const ent of validEnts) {
      // Diagram limit spec
      if (ent.feature_key === 'create_diagrams') {
        if (ent.display_text && ent.display_text.trim()) {
          labels.push(ent.display_text.trim());
        } else if (Number(ent.limit_value) === -1) {
          labels.push('Unlimited active diagrams');
        } else if (ent.limit_value && Number(ent.limit_value) > 0) {
          labels.push(`Up to ${ent.limit_value} active diagrams`);
        } else {
          labels.push('Diagram projects');
        }
        continue;
      }

      // Workspace members spec
      if (ent.feature_key === 'workspace_members') {
        if (ent.display_text && ent.display_text.trim()) {
          labels.push(ent.display_text.trim());
        } else {
          const seats = Number(ent.limit_value || plan.included_seats || 1);
          labels.push(seats > 1 ? `${seats} workspace members` : 'Single user access');
        }
        continue;
      }

      // Display text
      if (ent.display_text && !['true', 'false', '-', '—'].includes(String(ent.display_text).trim().toLowerCase())) {
        labels.push(ent.display_text.trim());
        continue;
      }

      // Feature name
      if (ent.feature_name && ent.feature_name.trim()) {
        labels.push(ent.feature_name.trim());
        continue;
      }

      // Feature key formatted
      if (ent.feature_key) {
        const formatted = ent.feature_key.replace(/_/g, ' ');
        labels.push(formatted.charAt(0).toUpperCase() + formatted.slice(1));
      }
    }

    return labels.filter((item, idx, self) => item && self.indexOf(item) === idx);
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
        const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : null);
        if (list) {
          const studentPlan = list.find((p: any) => this.isStudentPlan(p));
          if (studentPlan) {
            this.setStudentPlan(studentPlan);
            const m = this.extractPlanMonth(studentPlan);
            if (m > 0) {
              this.setMonth(m);
            }
          }
        }
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
    const slug = (typeof plan === 'string' ? plan : (plan.slug || '')).toLowerCase();
    const name = (typeof plan === 'string' ? '' : (plan.name || '')).toLowerCase();
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
    return 'No credit card required';
  }

  getDurationText(plan?: any): string {
    return '';
  }

  getHeadingText(plan?: any): string {
    return `dbNexus,<br>free for students.`;
  }

  getFormSubtitle(plan?: any): string {
    return `Complete the details below to claim your free student offer. Fields marked <span class="req">*</span> are required.`;
  }

  getClaimButtonText(isSubmitting: boolean, plan?: any): string {
    if (isSubmitting) return 'Submitting...';
    return 'Claim Student Offer';
  }
}
