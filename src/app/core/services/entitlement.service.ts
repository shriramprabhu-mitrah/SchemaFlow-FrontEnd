import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map, of, tap, shareReplay, catchError } from 'rxjs';
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
  public hasUsedTrial: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('userLogout', () => {
        this.hasUsedTrial = false;
        this.loadedOrgId = null;
        this.memberFeatureAccess = null;
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
      if (this.loadedOrgId === orgId && this.entitlementsSubject.value.length > 0) {
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
      map(res => {
        const data = res?.data || res;
        
        if (data?.memberFeatureAccess) this.memberFeatureAccess = data.memberFeatureAccess;
        else this.memberFeatureAccess = null;

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

        return Array.isArray(data) ? data : (data?.entitlements || (Array.isArray(res) ? res : []));
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

  getEntitlement(featureKey: string): any | undefined {
    let ent = this.entitlementsSubject.value.find(e => e.feature_key === featureKey);
    if (!ent) {
      if (featureKey === 'create_diagrams') ent = this.entitlementsSubject.value.find(e => e.feature_key === 'max_diagrams');
      else if (featureKey === 'max_diagrams') ent = this.entitlementsSubject.value.find(e => e.feature_key === 'create_diagrams');
    }
    return ent;
  }

  decrementUsage(featureKey: string, amount: number = 1): void {
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
    if (this.auth.isSuperAdmin() || this.auth.isOrganizationAdmin()) return true;
    if (!this.auth.getOrganizationId()) return true; // Personal workspaces have no member restrictions
    
    if (this.memberFeatureAccess) {
      if (this.memberFeatureAccess.includes(featureKey)) return true;
      
      // Handle aliases/plurals that might have been saved inconsistently in the past
      if ((featureKey === 'create_diagrams' || featureKey === 'max_diagrams') && 
          (this.memberFeatureAccess.includes('create_diagram') || this.memberFeatureAccess.includes('create_diagrams') || this.memberFeatureAccess.includes('max_diagrams') || this.memberFeatureAccess.includes('diagram_creation'))) return true;
      if (featureKey === 'create_diagram' && (this.memberFeatureAccess.includes('create_diagrams') || this.memberFeatureAccess.includes('max_diagrams'))) return true;
      if (featureKey === 'create_workspaces' && this.memberFeatureAccess.includes('create_workspace')) return true;
      if (featureKey === 'create_workspace' && this.memberFeatureAccess.includes('create_workspaces')) return true;
      
      return false;
    }
    return true; // default to true if we don't have restriction data
  }


  orgHasFeature(featureKey: string): boolean {
    if (this.auth.isSuperAdmin()) return true;

    const env = (window as any).appConfig?.environment;
    if (env && env.isSaaS === false) return true;
    
    // If the member doesn't have access, pretend the org has the feature.
    // This forces the UI condition (orgHasFeature && !canUseFeature) to be true,
    // which results in the button being visually disabled rather than showing an upgrade modal.
    if (!this.hasMemberAccess(featureKey)) return true;

    // Check org entitlements if available
    const orgEnts = this.orgEntitlementsSubject.value;
    if (orgEnts && orgEnts.length > 0) {
        let orgEnt = orgEnts.find(e => e.feature_key === featureKey);
        if (!orgEnt) {
          if (featureKey === 'create_diagrams') orgEnt = orgEnts.find(e => e.feature_key === 'max_diagrams');
          else if (featureKey === 'max_diagrams') orgEnt = orgEnts.find(e => e.feature_key === 'create_diagrams');
        }
        if (orgEnt) {
            return orgEnt.enabled === true || (orgEnt as any).value === 'true' || (orgEnt as any).value === true;
        }
    }
    
    // Fallback to canUseFeature if orgEntitlements are not available yet
    return this.canUseFeature(featureKey);
  }

  canUseFeature(featureKey: string): boolean {
    if (this.auth.isSuperAdmin()) return true;

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
        if (limit !== undefined && limit !== null && limit !== -1) {
          if (ent.remaining !== undefined && ent.remaining <= 0) {
            return false;
          }
          if (ent.used !== undefined && ent.used >= limit) {
            return false;
          }
        }
        return true;
      }
    }

    // 2. Fallback: retrieve user entitlements cached in local storage directly
    const cachedEnts = this.auth.getEntitlements();
    if (cachedEnts && cachedEnts.length > 0) {
      let userEnt = cachedEnts.find((e: any) => e.feature_key === featureKey);
      if (!userEnt) {
        if (featureKey === 'create_diagrams') userEnt = cachedEnts.find((e: any) => e.feature_key === 'max_diagrams');
        else if (featureKey === 'max_diagrams') userEnt = cachedEnts.find((e: any) => e.feature_key === 'create_diagrams');
      }
      if (userEnt) {
        const isTrue = userEnt.enabled === true || userEnt.value === 'true' || userEnt.value === true;
        const isFalse = userEnt.enabled === false || userEnt.value === 'false' || userEnt.value === false;
        if (isFalse) return false;
        if (isTrue) {
          // Check numeric limit in cache if present
          const limit = userEnt.effective_limit ?? userEnt.limit_value;
          if (limit !== undefined && limit !== null && limit !== -1) {
            if (userEnt.remaining !== undefined && userEnt.remaining <= 0) {
              return false;
            }
            if (userEnt.used !== undefined && userEnt.used >= limit) {
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
        (featureKey === 'max_diagrams' && e.feature_key === 'create_diagrams')
      );
      if (fallbackEnt) {
        const isValTrue = fallbackEnt.value !== 'false' && (fallbackEnt.value as any) !== false;
        if (!isValTrue) return false;
        const limit = (fallbackEnt as any).limit_value;
        if (limit !== undefined && limit !== null && limit !== -1) {
          if ((fallbackEnt as any).remaining !== undefined && (fallbackEnt as any).remaining <= 0) {
            return false;
          }
          if ((fallbackEnt as any).used !== undefined && (fallbackEnt as any).used >= limit) {
            return false;
          }
        }
        return true;
      }
    }

    // Default premium features that must be explicitly enabled
    if (featureKey === 'code_compare' || (planSlug === 'free' && (featureKey === 'table_group' || featureKey === 'diagram_notes'))) {
      return false;
    }

    return true; // default to true if the feature is unknown
  }

  private overallPercentage = 20;

  getOverallPercentage(): number {
    return this.overallPercentage;
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
          const found = res.data.find((p: any) => p.overall_percentage || p.discount_percentage);
          if (found) {
            this.overallPercentage = Number(found.overall_percentage || found.discount_percentage) || 20;
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
