import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, map, of, tap, shareReplay } from 'rxjs';
import { OrganizationService } from '../../features/organization/services/organization.service';
import { AuthService } from './auth.service';

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

  private entitlementsSubject = new BehaviorSubject<EffectiveEntitlement[]>([]);
  public entitlements$ = this.entitlementsSubject.asObservable();

  private loadedOrgId: number | null = null;
  private inflightRequest$: Observable<EffectiveEntitlement[]> | null = null;

  loadEntitlements(force = false): Observable<EffectiveEntitlement[]> {
    if (this.inflightRequest$ && !force) {
      return this.inflightRequest$;
    }

    const orgId = this.auth.getOrganizationId();
    if (!orgId) {
      if (!force) {
        const cached = this.auth.getEntitlements();
        if (cached && cached.length > 0) {
          this.entitlementsSubject.next(cached);
          // don't return early if we want to refresh in background, or just return.
          // return of(cached);
        }
      }
      this.inflightRequest$ = this.auth.getUserFeatures().pipe(
        map(res => (res?.data?.entitlements || res?.entitlements || [])),
        tap(data => {
          this.entitlementsSubject.next(data);
          this.inflightRequest$ = null;
        }),
        shareReplay(1)
      );
      return this.inflightRequest$;
    }

    if (!force) {
      if (this.loadedOrgId === orgId && this.entitlementsSubject.value.length > 0) {
        return of(this.entitlementsSubject.value);
      }
      
      const cached = this.auth.getEntitlements();
      if (cached && cached.length > 0) {
        this.loadedOrgId = orgId;
        this.entitlementsSubject.next(cached);
      }
    }

    // Call user features to sync personal plan data
    this.auth.getUserFeatures().subscribe();

    this.inflightRequest$ = this.orgService.getEntitlements(orgId).pipe(
      map(res => res?.data || []),
      tap(data => {
        this.loadedOrgId = orgId;
        this.entitlementsSubject.next(data);
        this.inflightRequest$ = null;
      }),
      shareReplay(1)
    );
    return this.inflightRequest$;
  }

  getEntitlement(featureKey: string): EffectiveEntitlement | undefined {
    return this.entitlementsSubject.value.find(e => e.feature_key === featureKey);
  }

  canUseFeature(featureKey: string): boolean {
    if (this.auth.isSuperAdmin()) return true;

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
        }
        return true;
      }
    }

    // 2. Fallback: retrieve user entitlements cached in local storage directly
    const cachedEnts = this.auth.getEntitlements();
    if (cachedEnts && cachedEnts.length > 0) {
      const userEnt = cachedEnts.find((e: any) => e.feature_key === featureKey);
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
          }
          return true;
        }
      }
    }

    // 3. Fallback: check fallback plans based on current plan slug
    const planSlug = this.auth.getCurrentPlanSlug() || 'free';
    const plan = FALLBACK_PLANS.find(p => p.slug === planSlug) || FALLBACK_PLANS[0];
    const fallbackEnt = plan.entitlements.find((e: any) => e.feature_key === featureKey);
    if (fallbackEnt) {
      return fallbackEnt.value !== 'false' && (fallbackEnt.value as any) !== false;
    }

    return true; // default to true if the feature is unknown
  }
}

export const FALLBACK_PLANS = [
  {
    slug: 'free',
    name: 'Free',
    description: 'For developers drafting personal schemas and single diagrams.',
    price_monthly: 0,
    price_annual: 0,
    plan_type: 'individual',
    highlight_color: '#3ec5c1',
    entitlements: [
      { feature_key: 'digram_view', value: 'false' },
      { feature_key: 'create_diagrams', value: 'true', limit_value: 5, display_text: 'Upto 5 Diagrams' },
      { feature_key: 'edit_diagram', value: 'true' },
      { feature_key: 'customize_canvas', value: 'true' },
      { feature_key: 'table_group', value: 'false' },
      { feature_key: 'table_color_and_connection_color', value: 'false' },
      { feature_key: 'import_sql', value: 'false' },
      { feature_key: 'export_image', value: 'true' },
      { feature_key: 'export_sql', value: 'false' },
      { feature_key: 'document_view', value: 'false' },
      { feature_key: 'version_history', value: 'false' },
      { feature_key: 'create_workspaces', value: 'false' },
      { feature_key: 'workspace_members', value: 'false' },
      { feature_key: 'workspace_types', value: 'personal' },
      { feature_key: 'realtime_collab', value: 'false' },
      { feature_key: 'sso', value: 'false' },
      { feature_key: 'audit_logs', value: 'false' },
      { feature_key: 'custom_hosting', value: 'false' },
      { feature_key: 'api_access', value: 'false' },
      { feature_key: 'advanced_iam', value: 'false' },
      { feature_key: 'share_diagram', value: 'false' },
      { feature_key: 'diagram_notes', value: 'false' },
      { feature_key: 'max_workspace_members', value: 'false', limit_value: 5 },
      { feature_key: 'diagram_detailing', value: 'false' }
    ]
  },
  {
    slug: 'premium',
    name: 'Premium Schema',
    description: 'For individual freelancers and consultants managing relational setups.',
    price_monthly: 399,
    price_annual: 299,
    plan_type: 'individual',
    highlight_color: '#3b82f6',
    entitlements: [
      { feature_key: 'digram_view', value: 'true' },
      { feature_key: 'create_diagrams', value: 'true', limit_value: -1, display_text: 'Unlimited diagrams' },
      { feature_key: 'edit_diagram', value: 'true' },
      { feature_key: 'customize_canvas', value: 'true' },
      { feature_key: 'table_group', value: 'true' },
      { feature_key: 'table_color_and_connection_color', value: 'true' },
      { feature_key: 'import_sql', value: 'true' },
      { feature_key: 'export_image', value: 'true' },
      { feature_key: 'export_sql', value: 'true' },
      { feature_key: 'document_view', value: 'true' },
      { feature_key: 'version_history', value: 'false' },
      { feature_key: 'create_workspaces', value: 'false' },
      { feature_key: 'workspace_members', value: 'false', limit_value: 0 },
      { feature_key: 'workspace_types', value: 'personal' },
      { feature_key: 'realtime_collab', value: 'false' },
      { feature_key: 'sso', value: 'false' },
      { feature_key: 'audit_logs', value: 'false' },
      { feature_key: 'custom_hosting', value: 'false' },
      { feature_key: 'api_access', value: 'false' },
      { feature_key: 'advanced_iam', value: 'false' },
      { feature_key: 'share_diagram', value: 'true' },
      { feature_key: 'diagram_notes', value: 'true' },
      { feature_key: 'max_workspace_members', value: 'false' },
      { feature_key: 'diagram_detailing', value: 'true' }
    ]
  },
  {
    slug: 'team',
    name: 'Team',
    description: 'For collaborative product squads syncing database schema blueprints.',
    price_monthly: 1999,
    price_annual: 1599,
    plan_type: 'organization',
    highlight_color: '#10b981',
    badge_text: 'POPULAR COLLABORATION',
    entitlements: [
      { feature_key: 'digram_view', value: 'true' },
      { feature_key: 'create_diagrams', value: 'true', limit_value: -1, display_text: 'Unlimited diagrams' },
      { feature_key: 'edit_diagram', value: 'true' },
      { feature_key: 'customize_canvas', value: 'true' },
      { feature_key: 'table_group', value: 'true' },
      { feature_key: 'table_color_and_connection_color', value: 'true' },
      { feature_key: 'import_sql', value: 'true' },
      { feature_key: 'export_image', value: 'true' },
      { feature_key: 'export_sql', value: 'true' },
      { feature_key: 'document_view', value: 'true' },
      { feature_key: 'version_history', value: 'true' },
      { feature_key: 'create_workspaces', value: 'true', limit_value: -1, display_text: 'Unlimited' },
      { feature_key: 'workspace_members', value: 'true', limit_value: 5, display_text: 'Max 5 members' },
      { feature_key: 'workspace_types', value: 'all', display_text: 'Personal & Shared' },
      { feature_key: 'realtime_collab', value: 'true' },
      { feature_key: 'sso', value: 'false' },
      { feature_key: 'audit_logs', value: 'false' },
      { feature_key: 'custom_hosting', value: 'false' },
      { feature_key: 'api_access', value: 'false' },
      { feature_key: 'advanced_iam', value: 'false' },
      { feature_key: 'share_diagram', value: 'true' },
      { feature_key: 'diagram_notes', value: 'true' },
      { feature_key: 'max_workspace_members', value: 'false' },
      { feature_key: 'diagram_detailing', value: 'true' }
    ]
  },
  {
    slug: 'enterprise',
    name: 'Enterprise Shield',
    description: 'For organizations requiring custom hostings, SLAs, and SAML SSO.',
    price_monthly: 0,
    price_annual: 0,
    plan_type: 'organization',
    highlight_color: '#f59e0b',
    entitlements: [
      { feature_key: 'digram_view', value: 'true' },
      { feature_key: 'create_diagrams', value: 'true', limit_value: -1, display_text: 'Unlimited diagrams' },
      { feature_key: 'edit_diagram', value: 'true' },
      { feature_key: 'customize_canvas', value: 'true' },
      { feature_key: 'table_group', value: 'true' },
      { feature_key: 'table_color_and_connection_color', value: 'true' },
      { feature_key: 'import_sql', value: 'true' },
      { feature_key: 'export_image', value: 'true' },
      { feature_key: 'export_sql', value: 'true' },
      { feature_key: 'document_view', value: 'true' },
      { feature_key: 'version_history', value: 'true' },
      { feature_key: 'create_workspaces', value: 'true', limit_value: -1, display_text: 'Unlimited' },
      { feature_key: 'workspace_members', value: 'true', limit_value: -1, display_text: 'Unlimited members' },
      { feature_key: 'workspace_types', value: 'all', display_text: 'Personal & Shared' },
      { feature_key: 'realtime_collab', value: 'true' },
      { feature_key: 'sso', value: 'true' },
      { feature_key: 'audit_logs', value: 'true' },
      { feature_key: 'custom_hosting', value: 'true' },
      { feature_key: 'api_access', value: 'true' },
      { feature_key: 'advanced_iam', value: 'true' },
      { feature_key: 'share_diagram', value: 'true' },
      { feature_key: 'diagram_notes', value: 'true' },
      { feature_key: 'max_workspace_members', value: 'true', limit_value: -1 },
      { feature_key: 'diagram_detailing', value: 'true' }
    ]
  }
];
