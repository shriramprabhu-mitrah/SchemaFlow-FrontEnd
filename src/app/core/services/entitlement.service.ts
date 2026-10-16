import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map, of, tap, shareReplay, catchError, switchMap } from 'rxjs';
import { OrganizationService } from '../../features/organization/services/organization.service';
import { AuthService } from './auth.service';
import { AppConfigService } from './app-config.service';

export interface EffectiveEntitlement {
    feature_key: string;
    feature_name: string;
    enabled: boolean;
    included?: number;
    addons?: number;
    overridden?: number;
    effective_limit?: number;
    used: number;
    remaining?: number;
    display_text?: string;
}

@Injectable({ providedIn: 'root' })
export class EntitlementService {
  private orgService = inject(OrganizationService);
  private auth = inject(AuthService);
  private http = inject(HttpClient);
  private appConfig = inject(AppConfigService);

  private entitlementsSubject = new BehaviorSubject<EffectiveEntitlement[]>([]);
  public entitlements$ = this.entitlementsSubject.asObservable();

  private orgEntitlementsSubject = new BehaviorSubject<EffectiveEntitlement[]>([]);
  public orgEntitlements$ = this.orgEntitlementsSubject.asObservable();

  private plansSubject = new BehaviorSubject<any[]>([]);
  public plans$ = this.plansSubject.asObservable();
  private plansLoaded = false;

  private loadedOrgId: number | null = null;
  private inflightRequest$: Observable<EffectiveEntitlement[]> | null = null;
  public memberFeatureAccess: string[] | null = null;
  public memberFeatureAccess$ = new BehaviorSubject<string[] | null>(null);
  public hasUsedTrial: boolean = false;

  constructor() {
    const cachedAccess = this.auth.getMemberFeatureAccess();
    if (cachedAccess) {
      this.memberFeatureAccess = cachedAccess;
      this.memberFeatureAccess$.next(cachedAccess);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('userLogout', () => {
        this.hasUsedTrial = false;
        this.loadedOrgId = null;
        this.memberFeatureAccess = null;
        this.memberFeatureAccess$.next(null);
        this.plansLoaded = false;
        this.inflightRequest$ = null;
        this.entitlementsSubject.next([]);
        this.orgEntitlementsSubject.next([]);
        this.plansSubject.next([]);
      });
    }
  }

  loadEntitlements(force = false): Observable<EffectiveEntitlement[]> {
    this.loadPlans(force).subscribe();

    if (this.inflightRequest$ && !force) {
      return this.inflightRequest$;
    }

    const orgId = this.auth.getOrganizationId();
    if (!force) {
      const cachedAccess = this.auth.getMemberFeatureAccess();
      if (cachedAccess) {
        this.memberFeatureAccess = cachedAccess;
        this.memberFeatureAccess$.next(cachedAccess);
      }
      if (this.loadedOrgId === orgId && this.entitlementsSubject.value.length > 0) {
        if (this.auth.isStudentPlan()) {
          this.auth.checkStudentApproval(this.auth.getUserEmail() || undefined).subscribe();
        }
        return of(this.entitlementsSubject.value);
      }
      const cached = this.auth.getEntitlements();
      if (cached && cached.length > 0) {
        this.loadedOrgId = orgId;
        this.entitlementsSubject.next(cached);
        this.orgEntitlementsSubject.next(cached);
      }
    }

    this.inflightRequest$ = this.auth.getUserFeatures(orgId || undefined).pipe(
      switchMap(res => {
        const data = res?.data || res;
        
        let mAccess = data?.memberFeatureAccess;
        if (typeof mAccess === 'string') {
          try { mAccess = JSON.parse(mAccess); } catch { mAccess = null; }
        }
        if (Array.isArray(mAccess)) {
          this.memberFeatureAccess = mAccess;
          this.memberFeatureAccess$.next(mAccess);
          this.auth.setMemberFeatureAccess(mAccess);
        } else {
          this.memberFeatureAccess = null;
          this.memberFeatureAccess$.next(null);
          this.auth.setMemberFeatureAccess(null);
        }

        if (data?.purchasedPlan?.slug) {
          if (data.purchasedPlan.status === 'expired') {
            this.auth.setCurrentPlanSlug('free');
            // We keep the status as expired so the dashboard banner knows to show
            this.auth.setCurrentPlanStatus('expired');
          } else {
            this.auth.setCurrentPlanSlug(data.purchasedPlan.slug);
            this.auth.setCurrentPlanStatus(data.purchasedPlan.status);
          }
        }
        
        if (data?.hasUsedTrial !== undefined) {
            this.hasUsedTrial = data.hasUsedTrial;
        }

        if (data?.organizationId === null && typeof window !== 'undefined' && localStorage.getItem('organization_id')) {
          localStorage.removeItem('organization_id');
          localStorage.removeItem('org_role');
          localStorage.setItem('account_type', 'individual');
        } else if (data?.orgRole) {
          this.auth.setOrgRole(data.orgRole);
        }

        if (data?.isSuperAdmin !== undefined) {
          this.auth.setSuperAdmin(data.isSuperAdmin);
        }

        let rawEntitlements: any[] = [];
        if (Array.isArray(data)) rawEntitlements = data;
        else if (Array.isArray(res)) rawEntitlements = res;
        else if (Array.isArray(data?.features)) rawEntitlements = data.features;
        else if (Array.isArray(data?.entitlements)) rawEntitlements = data.entitlements;
        else if (Array.isArray(res?.features)) rawEntitlements = res.features;
        else if (Array.isArray(res?.entitlements)) rawEntitlements = res.entitlements;

        const planSlug = (data?.purchasedPlan?.slug || this.auth.getCurrentPlanSlug() || '').toLowerCase();
        const isStudent = planSlug === 'student-plan' || planSlug === 'student' || planSlug.includes('student');

        if (isStudent) {
          const userEmail = data?.email || data?.user?.email || data?.userEmail || this.auth.getUserEmail();
          const userId = data?.userId || data?.user_id || data?.id || data?.user?.id;
          if (userEmail) {
            this.auth.setUserEmail(userEmail);
          }
          if (userId && !isNaN(Number(userId))) {
            this.auth.setUserId(Number(userId));
          }
          // If the user has a student plan, call student credentials GET API to verify is_approved
          return this.auth.checkStudentApproval(userEmail).pipe(
            map(isApproved => {
              if (!isApproved) {
                // If not approved, disable all features
                return rawEntitlements.map((e: any) => ({
                  ...e,
                  enabled: false,
                  remaining: 0,
                  effective_limit: 0
                }));
              }
              return rawEntitlements;
            })
          );
        }

        return of(rawEntitlements);
      }),
      tap(data => {
        this.loadedOrgId = orgId;
        this.auth.setEntitlements(data);
        this.entitlementsSubject.next(data);
        this.orgEntitlementsSubject.next(data);
        this.inflightRequest$ = null;
      }),
      shareReplay(1)
    );
    return this.inflightRequest$;
  }

  findFeatureInList(list: any[], featureKey: string): any | undefined {
    if (!list || !Array.isArray(list) || list.length === 0) return undefined;

    let ent = list.find((e: any) => e.feature_key === featureKey);
    if (ent) return ent;

    if (featureKey === 'create_diagrams' || featureKey === 'max_diagrams' || featureKey === 'diagram_creation' || featureKey === 'create_diagram') {
      return list.find((e: any) => e.feature_key === 'create_diagrams' || e.feature_key === 'max_diagrams' || e.feature_key === 'diagram_creation' || e.feature_key === 'create_diagram');
    } else if (featureKey === 'ai_chat' || featureKey === 'ai' || featureKey === 'ai_assistant') {
      return list.find((e: any) => e.feature_key === 'ai_chat' || e.feature_key === 'ai' || e.feature_key === 'ai_assistant');
    } else if (featureKey === 'db_connect' || featureKey === 'db_connection' || featureKey === 'dbconnect' || featureKey === 'live_connection' || featureKey === 'connect') {
      return list.find((e: any) => e.feature_key === 'db_connect' || e.feature_key === 'db_connection' || e.feature_key === 'dbconnect' || e.feature_key === 'live_connection' || e.feature_key === 'connect');
    } else if (featureKey === 'code_compare' || featureKey === 'sql_compare' || featureKey === 'compare') {
      return list.find((e: any) => e.feature_key === 'code_compare' || e.feature_key === 'sql_compare' || e.feature_key === 'compare');
    } else if (featureKey === 'table_relationships' || featureKey === 'table_relations' || featureKey === 'tables' || featureKey === 'refs' || featureKey === 'relationships' || featureKey === 'table_group') {
      return list.find((e: any) => e.feature_key === 'table_relationships' || e.feature_key === 'table_relations' || e.feature_key === 'table_group' || e.feature_key === 'tables' || e.feature_key === 'relationships' || (e.long_description && e.long_description.toLowerCase().includes('relationship')) || (e.feature_name && e.feature_name.toLowerCase().includes('relationship')));
    } else if (featureKey === 'document_view' || featureKey === 'docs' || featureKey === 'doc_view' || featureKey === 'docs_view' || featureKey === 'document') {
      return list.find((e: any) => e.feature_key === 'document_view' || e.feature_key === 'docs' || e.feature_key === 'docs_view' || e.feature_key === 'doc_view' || e.feature_key === 'document');
    } else if (featureKey === 'version_history' || featureKey === 'versions' || featureKey === 'version') {
      return list.find((e: any) => e.feature_key === 'version_history' || e.feature_key === 'versions' || e.feature_key === 'version');
    } else if (featureKey === 'share_diagram' || featureKey === 'share' || featureKey === 'advanced_sharing') {
      return list.find((e: any) => e.feature_key === 'share_diagram' || e.feature_key === 'share' || e.feature_key === 'advanced_sharing');
    } else if (featureKey === 'import_sql' || featureKey === 'import' || featureKey === 'sql_import') {
      return list.find((e: any) => e.feature_key === 'import_sql' || e.feature_key === 'import' || e.feature_key === 'sql_import');
    } else if (featureKey === 'export_sql' || featureKey === 'export_image' || featureKey === 'export' || featureKey === 'pdf_export' || featureKey === 'sql_export') {
      return list.find((e: any) => e.feature_key === 'export_sql' || e.feature_key === 'export_image' || e.feature_key === 'export' || e.feature_key === 'pdf_export' || e.feature_key === 'sql_export');
    }
    return undefined;
  }

  getEntitlement(featureKey: string): any | undefined {
    if (this.auth.isStudentPlan() && !this.auth.isStudentApproved()) {
      return {
        feature_key: featureKey,
        enabled: false,
        value: 'false',
        effective_limit: 0,
        limit_value: 0,
        remaining: 0,
        used: 0
      };
    }
    if (this.auth.isSuperAdmin()) {
      return {
        feature_key: featureKey,
        enabled: true,
        value: 'true',
        effective_limit: -1,
        limit_value: -1,
        remaining: -1,
        used: 0
      };
    }

    const listsToSearch = [
      this.entitlementsSubject.value,
      this.orgEntitlementsSubject.value,
      this.auth.getEntitlements()
    ];

    for (const list of listsToSearch) {
      if (list && Array.isArray(list) && list.length > 0) {
        const ent = this.findFeatureInList(list, featureKey);
        if (ent) return ent;
      }
    }

    return undefined;
  }

  decrementUsage(featureKey: string, amount: number = 1): void {
    if (this.auth.isSuperAdmin()) return;

    const isTarget = (k: string) =>
      k === featureKey ||
      (featureKey === 'create_diagrams' && k === 'max_diagrams') ||
      (featureKey === 'max_diagrams' && k === 'create_diagrams');

    const updateList = (list: any[]) => {
      return (list || []).map((e: any) => {
        if (isTarget(e.feature_key)) {
          const copy = { ...e };
          if (copy.used !== undefined && copy.used !== null) {
            copy.used = Math.max(0, Number(copy.used) - amount);
          }
          if (copy.remaining !== undefined && copy.remaining !== null) {
            copy.remaining = Number(copy.remaining) + amount;
          }
          return copy;
        }
        return e;
      });
    };

    const updated = updateList(this.entitlementsSubject.value);
    this.entitlementsSubject.next(updated);
    this.orgEntitlementsSubject.next(updated);

    const cached = updateList(this.auth.getEntitlements());
    this.auth.setEntitlements(cached);

    // Sync with backend asynchronously
    this.loadEntitlements(true).subscribe();
  }

  incrementUsage(featureKey: string, amount: number = 1): void {
    if (this.auth.isSuperAdmin()) return;

    const isTarget = (k: string) =>
      k === featureKey ||
      (featureKey === 'create_diagrams' && k === 'max_diagrams') ||
      (featureKey === 'max_diagrams' && k === 'create_diagrams');

    const updateList = (list: any[]) => {
      return (list || []).map((e: any) => {
        if (isTarget(e.feature_key)) {
          const copy = { ...e };
          if (copy.used !== undefined && copy.used !== null) {
            copy.used = Number(copy.used) + amount;
          }
          if (copy.remaining !== undefined && copy.remaining !== null) {
            copy.remaining = Math.max(0, Number(copy.remaining) - amount);
          }
          return copy;
        }
        return e;
      });
    };

    const updated = updateList(this.entitlementsSubject.value);
    this.entitlementsSubject.next(updated);
    this.orgEntitlementsSubject.next(updated);

    const cached = updateList(this.auth.getEntitlements());
    this.auth.setEntitlements(cached);

    // Sync with backend asynchronously
    this.loadEntitlements(true).subscribe();
  }

  isMember(): boolean {
    return !!this.memberFeatureAccess;
  }

  hasMemberAccess(featureKey: string): boolean {
    if (this.auth.isSuperAdmin()) return true; // Allow super admin bypass, but not org admin, so memberFeatureAccess is respected
    if (!this.auth.getOrganizationId() && !this.memberFeatureAccess) return true; // Personal workspaces have no member restrictions, unless memberFeatureAccess is explicitly set
    
    if (this.memberFeatureAccess) {
      if (this.memberFeatureAccess.includes(featureKey)) return true;
      
      // Handle aliases/plurals that might have been saved inconsistently in the past
      if ((featureKey === 'create_diagrams' || featureKey === 'max_diagrams') && 
          (this.memberFeatureAccess.includes('create_diagram') || this.memberFeatureAccess.includes('create_diagrams') || this.memberFeatureAccess.includes('max_diagrams') || this.memberFeatureAccess.includes('diagram_creation'))) return true;
      if (featureKey === 'create_diagram' && (this.memberFeatureAccess.includes('create_diagrams') || this.memberFeatureAccess.includes('max_diagrams'))) return true;
      if (featureKey === 'create_workspaces' && this.memberFeatureAccess.includes('create_workspace')) return true;
      if (featureKey === 'create_workspace' && this.memberFeatureAccess.includes('create_workspaces')) return true;
      if ((featureKey === 'ai_chat' || featureKey === 'ai') && (this.memberFeatureAccess.includes('ai_chat') || this.memberFeatureAccess.includes('ai') || this.memberFeatureAccess.includes('ai_assistant'))) return true;
      if ((featureKey === 'db_connect' || featureKey === 'db_connection' || featureKey === 'dbconnect' || featureKey === 'live_connection' || featureKey === 'connect') &&
          (this.memberFeatureAccess.includes('db_connect') || this.memberFeatureAccess.includes('db_connection') || this.memberFeatureAccess.includes('dbconnect') || this.memberFeatureAccess.includes('live_connection') || this.memberFeatureAccess.includes('connect'))) return true;
      
      return false;
    }
    return true; // default to true if we don't have restriction data
  }


  orgHasFeature(featureKey: string): boolean {
    if (this.auth.isSuperAdmin()) return true;
    if (this.auth.isStudentPlan() && !this.auth.isStudentApproved()) return false;

    const env = (window as any).appConfig?.environment;
    if (env && env.isSaaS === false) return true;
    
    // If the member doesn't have access, pretend the org has the feature.
    // This forces the UI condition (orgHasFeature && !canUseFeature) to be true,
    // which results in the button being visually disabled rather than showing an upgrade modal.
    if (!this.hasMemberAccess(featureKey)) return true;

    // Check loaded user/org entitlements directly from api/user-features
    const ent = this.getEntitlement(featureKey);
    if (ent) {
      return ent.enabled === true || (ent as any).value === 'true' || (ent as any).value === true;
    }

    // Fallback to canUseFeature if entitlements are not available yet
    return this.canUseFeature(featureKey);
  }

  canUseFeature(featureKey: string): boolean {
    if (this.auth.isSuperAdmin()) return true;
    if (this.auth.isStudentPlan() && !this.auth.isStudentApproved()) return false;

    // Check member specific restrictions first
    if (!this.hasMemberAccess(featureKey)) {
      return false;
    }

    // 1. Check loaded entitlements from organization Context / backend API
    const ent = this.getEntitlement(featureKey);
    if (ent) {
      // Handle both boolean string values (e.g. "true"/"false") and boolean types
      const isEnabled = ent.enabled === true || (ent as any).value === 'true' || (ent as any).value === true;
      const isDisabled = ent.enabled === false || (ent as any).value === 'false' || (ent as any).value === false;

      if (isDisabled) return false;
      if (isEnabled) {
        // Numeric limit check
        const limit = ent.effective_limit ?? (ent as any).limit_value;
        if (limit !== undefined && limit !== null && Number(limit) !== -1) {
          if (Number(limit) === 0) {
            return false;
          }
          if (ent.remaining !== undefined && Number(ent.remaining) <= 0) {
            return false;
          }
          if (ent.used !== undefined && Number(ent.used) >= Number(limit)) {
            return false;
          }
        }
        return true;
      }
    }

    // 2. Fallback: retrieve user entitlements cached in local storage directly
    const cachedEnts = this.auth.getEntitlements();
    if (cachedEnts && cachedEnts.length > 0) {
      const userEnt = this.findFeatureInList(cachedEnts, featureKey);
      if (userEnt) {
        const isTrue = userEnt.enabled === true || userEnt.value === 'true' || userEnt.value === true;
        const isFalse = userEnt.enabled === false || userEnt.value === 'false' || userEnt.value === false;
        if (isFalse) return false;
        if (isTrue) {
          // Check numeric limit in cache if present
          const limit = userEnt.effective_limit ?? userEnt.limit_value;
          if (limit !== undefined && limit !== null && Number(limit) !== -1) {
            if (Number(limit) === 0) {
              return false;
            }
            if (userEnt.remaining !== undefined && Number(userEnt.remaining) <= 0) {
              return false;
            }
            if (userEnt.used !== undefined && Number(userEnt.used) >= Number(limit)) {
              return false;
            }
          }
          return true;
        }
      }
    }

    // 3. Fallback: check plans loaded dynamically from API response
    const planSlug = this.auth.getCurrentPlanSlug() || 'free';
    const plans = this.getPlans();
    const plan = plans.find((p: any) => p.slug === planSlug) || plans.find((p: any) => p.slug === 'free') || plans[0];
    if (plan && plan.entitlements) {
      const fallbackEnt = plan.entitlements.find((e: any) => 
        e.feature_key === featureKey || 
        (featureKey === 'create_diagrams' && e.feature_key === 'max_diagrams') ||
        (featureKey === 'max_diagrams' && e.feature_key === 'create_diagrams') ||
        (featureKey === 'ai_chat' && (e.feature_key === 'ai' || e.feature_key === 'ai_assistant')) ||
        (featureKey === 'ai' && (e.feature_key === 'ai_chat' || e.feature_key === 'ai_assistant')) ||
        ((featureKey === 'db_connect' || featureKey === 'db_connection' || featureKey === 'dbconnect' || featureKey === 'live_connection' || featureKey === 'connect') &&
         (e.feature_key === 'db_connect' || e.feature_key === 'db_connection' || e.feature_key === 'dbconnect' || e.feature_key === 'live_connection' || e.feature_key === 'connect'))
      );
      if (fallbackEnt) {
        const isValTrue = fallbackEnt.value !== 'false' && (fallbackEnt.value as any) !== false;
        if (!isValTrue) return false;
        const limit = (fallbackEnt as any).limit_value;
        if (limit !== undefined && limit !== null && Number(limit) !== -1) {
          if ((fallbackEnt as any).remaining !== undefined && Number((fallbackEnt as any).remaining) <= 0) {
            return false;
          }
          if ((fallbackEnt as any).used !== undefined && Number((fallbackEnt as any).used) >= Number(limit)) {
            return false;
          }
        }
        return true;
      }
    }

    // Default premium features that must be explicitly enabled
    if (
      featureKey === 'code_compare' ||
      ((planSlug === 'free' || this.auth.getCurrentPlanStatus() === 'expired') &&
        (featureKey === 'table_group' ||
          featureKey === 'diagram_notes' ||
          featureKey === 'document_view' ||
          featureKey === 'version_history' ||
          featureKey === 'ai_chat' ||
          featureKey === 'ai' ||
          featureKey === 'ai_assistant'))
    ) {
      return false;
    }

    return true; // default to true if the feature is unknown
  }

  private overallPercentage = 20;
  private defaultTrialDays = 14;

  getOverallPercentage(): number {
    return this.overallPercentage;
  }

  getDefaultTrialDays(): number {
    return this.defaultTrialDays;
  }

  loadPlans(force = false): Observable<any[]> {
    if (this.plansLoaded && !force && this.plansSubject.value.length > 0) {
      return of(this.plansSubject.value);
    }
    const cachedPlans = this.getCachedPlans();
    if (cachedPlans.length > 0 && !force) {
      this.plansSubject.next(cachedPlans);
    }

    const url = this.appConfig.environment?.pricingApiUrls?.plans;
    if (!url) {
      return of(this.plansSubject.value);
    }

    return this.http.get<any>(url).pipe(
      tap(res => {
        if (res?.overall_percentage !== undefined && res?.overall_percentage !== null) {
          this.overallPercentage = Number(res.overall_percentage) || 20;
        } else if (res?.data && Array.isArray(res.data)) {
          const found = res.data.find((p: any) => p.overall_percentage !== null && p.overall_percentage !== undefined);
          if (found) {
            this.overallPercentage = Number(found.overall_percentage || found.discount_percentage) || 20;
          }
        }
        if (res?.data && Array.isArray(res.data)) {
          const foundTrial = res.data.find((p: any) => p.trial_days && Number(p.trial_days) > 0);
          if (foundTrial) {
            this.defaultTrialDays = Number(foundTrial.trial_days);
          }
        }
      }),
      map(res => res?.data || res || []),
      tap(plans => {
        if (Array.isArray(plans) && plans.length > 0) {
          this.plansLoaded = true;
          this.setCachedPlans(plans);
          this.plansSubject.next(plans);
        }
      }),
      catchError(err => {
        console.error('Failed to load plans from response:', err);
        return of(this.plansSubject.value);
      }),
      shareReplay(1)
    );
  }

  getPlans(): any[] {
    if (this.plansSubject.value.length > 0) {
      return this.plansSubject.value;
    }
    return this.getCachedPlans();
  }

  private getCachedPlans(): any[] {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem('schemaflow_plans');
        if (stored) return JSON.parse(stored);
      } catch (e) {}
    }
    return [];
  }

  private setCachedPlans(plans: any[]): void {
    if (typeof window !== 'undefined' && window.localStorage && plans) {
      try {
        localStorage.setItem('schemaflow_plans', JSON.stringify(plans));
      } catch (e) {}
    }
  }
}
